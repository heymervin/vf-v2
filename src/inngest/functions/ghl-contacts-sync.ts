import { inngest } from "@/inngest/client";
import { ghlClient } from "@/lib/ghl/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWeddingFromOpportunity } from "@/lib/weddings/create";

/**
 * ghl-contacts-sync — fires on every venue-owner login.
 *
 * Pulls won opportunities from GHL, checks which ones are already in the
 * weddings table, and imports any that are missing. No magic-link invites
 * are sent (this is a historical import, not a live booking event).
 * Idempotent — createWeddingFromOpportunity short-circuits on ghl_opportunity_id.
 */
export const ghlContactsSync = inngest.createFunction(
  { id: "ghl-contacts-sync", triggers: { event: "ghl/contacts-sync" } },
  async ({ event, step }) => {
    const { venueId } = event.data as { venueId: string };

    // 1. Fetch won opportunities from GHL (bail if no integration key)
    const wonOpportunities = await step.run("fetch-ghl-opportunities", async () => {
      const client = await ghlClient(venueId);
      if (!client) return [];
      const { opportunities } = await client.listOpportunities(500);
      return opportunities.filter((opp) => opp.status === "won");
    });

    if (!wonOpportunities.length) return { synced: 0 };

    // 2. Get ghl_opportunity_ids already in Supabase for this venue
    const existingIds = await step.run("fetch-existing-ids", async () => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("weddings")
        .select("ghl_opportunity_id")
        .eq("venue_id", venueId)
        .not("ghl_opportunity_id", "is", null);
      return (data ?? []).map((r) => r.ghl_opportunity_id as string);
    });

    const existingSet = new Set(existingIds);
    const missing = wonOpportunities.filter(
      (opp) => !existingSet.has(opp.id) && opp.contactId,
    );

    if (!missing.length) return { synced: 0 };

    // 3. Import each missing opportunity (sequential to avoid GHL rate limits)
    let synced = 0;
    for (const opp of missing) {
      const created = await step.run(`sync-opp-${opp.id}`, async () => {
        const client = await ghlClient(venueId);
        if (!client || !opp.contactId) return false;

        const contact = await client.getContact(opp.contactId);
        if (!contact.email) return false;

        const coupleNames =
          [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
          contact.email;

        await createWeddingFromOpportunity({
          venueId,
          ghlOpportunityId: opp.id,
          ghlContactId: opp.contactId,
          coupleNames,
          coupleEmail: contact.email,
          totalValueMinor: opp.monetaryValue ?? undefined,
        });

        return true;
      });

      if (created) synced++;
    }

    return { synced };
  },
);
