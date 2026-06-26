import "server-only";
import { ghlClient } from "@/lib/ghl/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWeddingFromOpportunity } from "@/lib/weddings/create";
import { upsertGhlContact } from "@/lib/ghl/upsert-contact";

/**
 * syncWonOpportunities — runs on every venue-owner login (fire-and-forget via
 * Next.js `after`).
 *
 * Pulls WON opportunities from GHL. For each, upserts a native `contacts` row
 * (the person) and creates/links a `weddings` row (the booked event) via
 * weddings.contact_id — keeping the two tables separate but connected. Scope is
 * won/booked only; non-won GHL leads stay in GHL.
 *
 * Idempotent: createWeddingFromOpportunity short-circuits on ghl_opportunity_id,
 * and already-linked weddings are skipped without a GHL fetch. Weddings imported
 * before contacts were synced get their contact_id backfilled on the next login.
 * No magic-link invites are sent (historical import, not a live booking event).
 */
export async function syncWonOpportunities(
  venueId: string,
): Promise<{ synced: number }> {
  // 1. Fetch won opportunities from GHL (bail if no integration key).
  const client = await ghlClient(venueId);
  if (!client) return { synced: 0 };

  const { opportunities } = await client.listOpportunities(500);
  const wonOpportunities = opportunities.filter(
    (opp) => opp.status === "won" && opp.contactId,
  );

  if (!wonOpportunities.length) return { synced: 0 };

  // 2. Map existing weddings by GHL opportunity id (with their contact link state).
  const admin = createAdminClient();
  const { data } = await admin
    .from("weddings")
    .select("id, ghl_opportunity_id, contact_id")
    .eq("venue_id", venueId)
    .not("ghl_opportunity_id", "is", null);

  const existingByOpp = new Map(
    (data ?? []).map((r) => [r.ghl_opportunity_id as string, r]),
  );

  // 3. Import / link each won opportunity (sequential to avoid GHL rate limits).
  let synced = 0;
  for (const opp of wonOpportunities) {
    if (!opp.contactId) continue;

    const existing = existingByOpp.get(opp.id);
    // Already imported AND linked — nothing to do, skip the GHL fetch.
    if (existing && existing.contact_id) continue;

    const contact = await client.getContact(opp.contactId);
    if (!contact.email) continue;

    const contactId = await upsertGhlContact(admin, venueId, contact);

    if (existing) {
      // Backfill the contact link on a wedding imported before this change.
      if (contactId) {
        await admin
          .from("weddings")
          .update({ contact_id: contactId })
          .eq("id", existing.id);
      }
      continue;
    }

    const coupleNames =
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      contact.email;

    await createWeddingFromOpportunity({
      venueId,
      ghlOpportunityId: opp.id,
      ghlContactId: opp.contactId,
      contactId: contactId ?? undefined,
      coupleNames,
      coupleEmail: contact.email,
      totalValueMinor: opp.monetaryValue ?? undefined,
    });

    synced++;
  }

  return { synced };
}
