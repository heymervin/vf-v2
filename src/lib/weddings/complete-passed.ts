import "server-only";
import { ghlClient } from "@/lib/ghl/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const COMPLETED_TAG = "vf2-wedding-completed";

/**
 * completePassedWeddings — runs daily (wired into the daily-brief cron).
 *
 * Scans weddings whose date has passed but are still planning/confirmed, marks
 * them completed, and tags the GHL contact so the venue's post-wedding
 * automations (anniversary / referral / review) fire in GHL. Sonas has NO
 * post-wedding lifecycle — this is VF2's retention wedge.
 *
 * Ordering guarantees the tag (the whole point) fires before we stop scanning:
 * for a GHL-linked wedding we PUT the tag FIRST, then flip status only on
 * success; non-GHL weddings just flip. status NOT IN (completed,cancelled) is
 * the idempotency guard, so each contact is tagged exactly once.
 *
 * ponytail: a wedding whose ghl_contact_id is permanently bad stays
 * planning/confirmed and retries daily (one wasted PUT/day, self-heals if the
 * contact is fixed). Upgrade path: a weddings.lifecycle_tagged_at column to
 * decouple "completed" from "tagged" — deferred (needs a migration).
 */
export async function completePassedWeddings(): Promise<{
  completed: number;
  tagged: number;
}> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: passed } = await admin
    .from("weddings")
    .select("id, venue_id, ghl_contact_id")
    .lt("wedding_date", today)
    .in("status", ["planning", "confirmed"]);

  if (!passed?.length) return { completed: 0, tagged: 0 };

  // One GHL client per venue — don't re-fetch credentials per wedding.
  const clients = new Map<string, Awaited<ReturnType<typeof ghlClient>>>();
  async function clientFor(venueId: string) {
    if (!clients.has(venueId)) clients.set(venueId, await ghlClient(venueId));
    return clients.get(venueId) ?? null;
  }

  let completed = 0;
  let tagged = 0;

  for (const w of passed) {
    // Fire the GHL tag first — it's the feature's whole point. A transient
    // failure leaves the wedding for tomorrow's run rather than completing it
    // un-tagged (which would silently lose the comms forever).
    if (w.ghl_contact_id) {
      const client = await clientFor(w.venue_id);
      if (client) {
        try {
          await client.request(`/contacts/${w.ghl_contact_id}/tags`, {
            method: "PUT",
            body: JSON.stringify({ tags: [COMPLETED_TAG] }),
          });
          tagged += 1;
        } catch (err) {
          console.warn(
            `[complete-passed] failed to tag contact ${w.ghl_contact_id}:`,
            err instanceof Error ? err.message : String(err),
          );
          continue;
        }
      }
    }

    const { error } = await admin
      .from("weddings")
      .update({ status: "completed" })
      .eq("id", w.id);
    if (error) {
      console.warn(`[complete-passed] status flip failed for ${w.id}:`, error.message);
      continue;
    }
    completed += 1;
  }

  return { completed, tagged };
}
