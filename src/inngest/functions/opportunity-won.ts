import { inngest } from "@/inngest/client";
import { ghlClient } from "@/lib/ghl/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWeddingFromOpportunity } from "@/lib/weddings/create";

/**
 * opportunity-won — fires when a GHL opportunity is marked WON (or moves to a
 * "Booked" stage). Emitted by src/app/api/webhooks/ghl/route.ts.
 *
 * Flow:
 *   1. Confirm the opportunity is REALLY won via the GHL API (double-gate, §4.4).
 *      A stray/forged webhook must never create a phantom wedding.
 *   2. Fetch the GHL contact to get email + name.
 *   3. Create a wedding row + couple_accounts via createWeddingFromOpportunity
 *      (idempotent on ghl_opportunity_id).
 *   4. Send each couple a Supabase magic-link invite (Slice 8) — best-effort.
 *   5. Tag the GHL contact "vf2-portal-invited" so the venue's pipeline reflects
 *      that this couple has been invited into the platform.
 *
 * Each step is individually memoised by Inngest — safe to replay without
 * creating duplicate records or duplicate invites.
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
    // 0. DOUBLE-GATE — re-confirm the opportunity is really won (§4.4).
    //    The webhook in src/app/api/webhooks/ghl/route.ts already gates on
    //    status="won" / a Booked stage name, but webhooks can be stray,
    //    replayed, or forged. We re-fetch from the GHL API and bail before
    //    creating a wedding unless GHL itself reports the opp as won.
    //
    //    If the venue has no GHL credentials (standalone/manual path), there is
    //    nothing to confirm against — skip the gate gracefully and let the
    //    contact-fetch step below decide (it returns no-ghl-credentials).
    // ------------------------------------------------------------------
    const confirm = await step.run("confirm-opportunity", async () => {
      const client = await ghlClient(venueId);
      if (!client) {
        // No creds to confirm against — do not block; defer to fetch-ghl-contact.
        return { confirmed: true, hadClient: false };
      }
      const opp = await client.getOpportunity(ghlOpportunityId);
      return { confirmed: opp.status === "won", hadClient: true };
    });

    if (!confirm.confirmed) {
      // A stray webhook for an opp that GHL does not report as won — do NOT
      // create a phantom wedding.
      return { skipped: true, reason: "not-won" };
    }

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
    // 2. Confirm the venue still exists (guards against a deleted venue row).
    // ------------------------------------------------------------------
    const venue = await step.run("load-venue", async () => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("venues")
        .select("name")
        .eq("id", venueId)
        .maybeSingle();
      return data;
    });

    if (!venue) {
      return { skipped: true, reason: "venue-not-found" };
    }

    // ------------------------------------------------------------------
    // 3. Create wedding + couple_accounts (idempotent)
    // ------------------------------------------------------------------
    const coupleNames =
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      contact.email;

    const { weddingId, alreadyExisted, coupleAccounts } = await step.run(
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
    // 4. Send each couple a Supabase magic-link invite (Slice 8, P0).
    //    inviteUserByEmail emails the couple a clickable link that lands on
    //    /portal/auth/magic-link, which reads data.couple_account_id from the
    //    invite metadata and activates the couple_accounts row (sets user_id +
    //    status='active'). Best-effort, mirroring the tag step: a failed invite
    //    must NOT fail the run or roll back the wedding.
    //
    //    When alreadyExisted (replay / second webhook for the same opp),
    //    coupleAccounts is empty — we skip re-inviting to avoid duplicate emails.
    // ------------------------------------------------------------------
    const redirectTo = `${appUrl}/portal/auth/magic-link`;

    const invited = await step.run("send-magic-link-invites", async () => {
      const admin = createAdminClient();
      let sent = 0;

      for (const account of coupleAccounts) {
        try {
          const { error } = await admin.auth.admin.inviteUserByEmail(account.email, {
            data: {
              couple_account_id: account.id,
              wedding_id: account.weddingId,
              venue_id: account.venueId,
            },
            redirectTo,
          });
          if (error) {
            console.warn(
              `[opportunity-won] invite failed for couple ${account.id}:`,
              error.message,
            );
          } else {
            sent += 1;
          }
        } catch (err) {
          // Non-fatal: log and continue. The wedding row is already created.
          console.warn(
            `[opportunity-won] invite threw for couple ${account.id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }

      return { sent };
    });

    // ------------------------------------------------------------------
    // 5. Tag GHL contact "vf2-portal-invited"
    //    GHL API: PUT /contacts/{id}/tags  { tags: ["vf2-portal-invited"] }
    //    Best-effort — a tagging failure must not surface to the couple or
    //    block the wedding record from being created.
    //    (No-op if the venue disconnected from GHL between steps.)
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

    return { weddingId, alreadyExisted, invitesSent: invited.sent };
  },
);
