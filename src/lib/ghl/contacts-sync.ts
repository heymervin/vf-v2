import "server-only";
import { ghlClient } from "@/lib/ghl/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWeddingFromOpportunity } from "@/lib/weddings/create";

/**
 * syncWonOpportunities — runs on every venue-owner login (fire-and-forget via
 * Next.js `after`).
 *
 * Pulls won opportunities from GHL, checks which ones are already in the
 * weddings table, and imports any that are missing. No magic-link invites
 * are sent (this is a historical import, not a live booking event).
 * Idempotent — createWeddingFromOpportunity short-circuits on ghl_opportunity_id.
 */
export async function syncWonOpportunities(
  venueId: string,
): Promise<{ synced: number }> {
  // 1. Fetch won opportunities from GHL (bail if no integration key).
  const client = await ghlClient(venueId);
  if (!client) return { synced: 0 };

  const { opportunities } = await client.listOpportunities(500);
  const wonOpportunities = opportunities.filter((opp) => opp.status === "won");

  if (!wonOpportunities.length) return { synced: 0 };

  // 2. Get ghl_opportunity_ids already in Supabase for this venue.
  const admin = createAdminClient();
  const { data } = await admin
    .from("weddings")
    .select("ghl_opportunity_id")
    .eq("venue_id", venueId)
    .not("ghl_opportunity_id", "is", null);

  const existingSet = new Set((data ?? []).map((r) => r.ghl_opportunity_id as string));
  const missing = wonOpportunities.filter(
    (opp) => !existingSet.has(opp.id) && opp.contactId,
  );

  if (!missing.length) return { synced: 0 };

  // 3. Import each missing opportunity (sequential to avoid GHL rate limits).
  let synced = 0;
  for (const opp of missing) {
    if (!opp.contactId) continue;

    const contact = await client.getContact(opp.contactId);
    if (!contact.email) continue;

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

    synced++;
  }

  return { synced };
}
