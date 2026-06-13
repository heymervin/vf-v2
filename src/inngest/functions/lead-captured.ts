import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { BrochureEmail } from "@/lib/email/templates/brochure-email";

/**
 * On lead/captured:
 *   1. If the venue has an active brochure, email it to the contact.
 *   2. If the venue's nurture sequence is enabled, enroll the contact
 *      (skip if already active for this opportunity, skip if suppressed)
 *      and emit sequence/enrolled to kick off sequence-run.
 *
 * Both paths are best-effort: the lead is already captured. A send or
 * enrollment failure must not surface to the submitter.
 */
export const leadCaptured = inngest.createFunction(
  { id: "lead-captured", triggers: { event: "lead/captured" } },
  async ({ event, step }) => {
    const { venueId, contactId } = event.data as {
      venueId: string;
      contactId: string;
      submissionId: string;
    };
    const admin = createAdminClient();

    // ------------------------------------------------------------------
    // 1. Brochure delivery (M3 — unchanged logic, now non-early-exit)
    // ------------------------------------------------------------------
    const brochure = await step.run("load-brochure", async () => {
      const { data } = await admin
        .from("brochures")
        .select("download_token")
        .eq("venue_id", venueId)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    });

    let brochureSent = false;
    if (brochure) {
      const ctx = await step.run("load-recipient", async () => {
        const { data: contact } = await admin
          .from("contacts")
          .select("first_name, email")
          .eq("id", contactId)
          .maybeSingle();
        const { data: venue } = await admin
          .from("venues")
          .select("name")
          .eq("id", venueId)
          .maybeSingle();
        const { data: settings } = await admin
          .from("venue_email_settings")
          .select("from_name, reply_to")
          .eq("venue_id", venueId)
          .maybeSingle();
        return { contact, venue, settings };
      });

      if (ctx.contact?.email && ctx.venue) {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ?? "https://app.venueflow.io";
        const brochureUrl = `${appUrl}/b/${brochure.download_token}?c=${contactId}`;

        const result = await step.run("send-brochure-email", async () => {
          return sendEmail({
            to: ctx.contact!.email!,
            subject: `Your ${ctx.venue!.name} brochure`,
            react: BrochureEmail({
              venueName: ctx.venue!.name,
              recipientName: ctx.contact!.first_name,
              brochureUrl,
            }),
            fromName: ctx.settings?.from_name ?? ctx.venue!.name,
            replyTo: ctx.settings?.reply_to ?? null,
          });
        });
        brochureSent = result.ok;
      }
    }

    // ------------------------------------------------------------------
    // 2. Nurture sequence enrollment (M4)
    // ------------------------------------------------------------------
    const enrollmentId = await step.run("enroll-in-sequence", async () => {
      // Is the sequence enabled for this venue?
      const { data: seq } = await admin
        .from("sequences")
        .select("id, enabled")
        .eq("venue_id", venueId)
        .maybeSingle();

      if (!seq?.enabled) return null;

      // Load the contact's email + status.
      const { data: contact } = await admin
        .from("contacts")
        .select("email, email_status")
        .eq("id", contactId)
        .maybeSingle();

      if (!contact?.email || contact.email_status !== "ok") return null;

      // Global suppression check.
      const { data: suppressed } = await admin
        .from("email_suppressions")
        .select("id")
        .eq("email", contact.email)
        .maybeSingle();

      if (suppressed) return null;

      // Resolve the active opportunity for this contact at this venue.
      const { data: opp } = await admin
        .from("opportunities")
        .select("id, stage")
        .eq("venue_id", venueId)
        .eq("contact_id", contactId)
        .is("archived_at", null)
        .maybeSingle();

      if (!opp) return null;

      // Skip if there is already an active enrollment for this opportunity.
      const { data: existing } = await admin
        .from("sequence_enrollments")
        .select("id")
        .eq("opportunity_id", opp.id)
        .eq("status", "active")
        .maybeSingle();

      if (existing) return null;

      // Create the enrollment row.
      const { data: enrollment, error } = await admin
        .from("sequence_enrollments")
        .insert({
          venue_id: venueId,
          contact_id: contactId,
          opportunity_id: opp.id,
          status: "active",
          current_step: 0,
        })
        .select("id")
        .single();

      if (error) {
        // Unique partial-index violation = concurrent event; safe to skip.
        console.warn(
          "[lead-captured] enrollment insert skipped:",
          error.message,
        );
        return null;
      }

      return enrollment.id;
    });

    // step.sendEvent (not bare inngest.send) so the emit is memoised on
    // replay — otherwise a re-run would spawn a duplicate sequence-run job.
    if (enrollmentId) {
      await step.sendEvent("send-sequence-enrolled", {
        name: "sequence/enrolled",
        data: { enrollmentId },
      });
    }

    return { brochureSent, enrollmentId: enrollmentId ?? null };
  },
);
