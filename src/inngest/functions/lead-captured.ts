import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { BrochureEmail } from "@/lib/email/templates/brochure-email";

/**
 * On lead/captured: if the venue has an active brochure, email it to the
 * contact with a tracked download link. No-ops gracefully when there's no
 * brochure or email isn't configured (capture already succeeded).
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

    const brochure = await step.run("load-brochure", async () => {
      const { data } = await admin
        .from("brochures")
        .select("download_token")
        .eq("venue_id", venueId)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    });
    if (!brochure) return { sent: false, reason: "no-active-brochure" };

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

    if (!ctx.contact?.email || !ctx.venue) {
      return { sent: false, reason: "no-recipient" };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.venueflow.io";
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

    return { sent: result.ok, reason: result.ok ? "sent" : result.error };
  },
);
