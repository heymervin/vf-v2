import { inngest } from "@/inngest/client";
import { ghlClient } from "@/lib/ghl/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWeddingFromOpportunity } from "@/lib/weddings/create";
import { sendEmail } from "@/lib/email/send";
import { PortalInviteEmail } from "@/lib/email/templates/portal-invite-email";

/**
 * opportunity-won — fires when a GHL opportunity is marked WON (or moves to a
 * "Booked" stage). Emitted by src/app/api/webhooks/ghl/route.ts.
 *
 * Flow:
 *   1. Fetch the GHL contact to get email + name.
 *   2. Create a wedding row via createWeddingFromOpportunity (idempotent).
 *   3. Send a portal invite email to the couple via Resend.
 *   4. Tag the GHL contact "vf2-portal-invited" so the venue's pipeline reflects
 *      that this couple has been invited into the platform.
 *
 * Each step is individually memoised by Inngest — safe to replay without
 * creating duplicate records or duplicate emails.
 */
export const opportunityWon = inngest.createFunction(
  { id: "opportunity-won", triggers: { event: "ghl/opportunity-won" } },
  async ({ event, step }) => {
    const { venueId, ghlOpportunityId, ghlContactId } = event.data as {
      venueId: string;
      locationId: string;
      ghlOpportunityId: string;
      ghlContactId: string;
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.venueflow.io";

    // ------------------------------------------------------------------
    // 1. Fetch GHL contact details
    // ------------------------------------------------------------------
    const contact = await step.run("fetch-ghl-contact", async () => {
      const client = await ghlClient(venueId);
      if (!client) {
        // Venue disconnected from GHL between webhook and processing — skip.
        return null;
      }
      return client.getContact(ghlContactId);
    });

    if (!contact) {
      return { skipped: true, reason: "no-ghl-credentials" };
    }

    if (!contact.email) {
      return { skipped: true, reason: "contact-has-no-email" };
    }

    // ------------------------------------------------------------------
    // 2. Load venue details for the email sender identity
    // ------------------------------------------------------------------
    const venueCtx = await step.run("load-venue", async () => {
      const admin = createAdminClient();
      const [venueRes, settingsRes] = await Promise.all([
        admin.from("venues").select("name").eq("id", venueId).maybeSingle(),
        admin
          .from("venue_email_settings")
          .select("from_name, reply_to")
          .eq("venue_id", venueId)
          .maybeSingle(),
      ]);
      return { venue: venueRes.data, settings: settingsRes.data };
    });

    if (!venueCtx.venue) {
      return { skipped: true, reason: "venue-not-found" };
    }

    // ------------------------------------------------------------------
    // 3. Create wedding + couple_accounts (idempotent)
    // ------------------------------------------------------------------
    const coupleNames =
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      contact.email;

    const { weddingId, alreadyExisted } = await step.run(
      "create-wedding",
      async () =>
        createWeddingFromOpportunity({
          venueId,
          ghlOpportunityId,
          ghlContactId,
          coupleNames,
          coupleEmail: contact.email!,
        }),
    );

    // ------------------------------------------------------------------
    // 4. Send portal invite email
    // ------------------------------------------------------------------
    const portalUrl = `${appUrl}/portal`;

    await step.run("send-portal-invite", async () => {
      return sendEmail({
        to: contact.email!,
        subject: `Your wedding planning portal is ready — ${venueCtx.venue!.name}`,
        react: PortalInviteEmail({
          venueName: venueCtx.venue!.name,
          recipientName: contact.firstName,
          coupleNames,
          portalUrl,
        }),
        fromName: venueCtx.settings?.from_name ?? venueCtx.venue!.name,
        replyTo: venueCtx.settings?.reply_to ?? null,
      });
    });

    // ------------------------------------------------------------------
    // 5. Tag GHL contact "vf2-portal-invited"
    //    GHL API: PUT /contacts/{id}/tags  { tags: ["vf2-portal-invited"] }
    //    Best-effort — a tagging failure must not surface to the couple or
    //    block the wedding record from being created.
    // ------------------------------------------------------------------
    await step.run("tag-ghl-contact", async () => {
      const client = await ghlClient(venueId);
      if (!client) return { skipped: true, reason: "no-ghl-credentials" };

      try {
        await client.request(`/contacts/${ghlContactId}/tags`, {
          method: "PUT",
          body: JSON.stringify({ tags: ["vf2-portal-invited"] }),
        });
        return { tagged: true };
      } catch (err) {
        // Non-fatal: log and continue. The wedding + invite are already done.
        console.warn(
          `[opportunity-won] failed to tag contact ${ghlContactId}:`,
          err instanceof Error ? err.message : String(err),
        );
        return { tagged: false };
      }
    });

    return { weddingId, alreadyExisted };
  },
);
