import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { GhlContact } from "./types";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Find-or-create a native VF2 `contacts` row for a GHL contact, returning its id
 * (or null if the insert failed — non-fatal; the caller still creates the wedding).
 *
 * Match order: existing `ghl_contact_id` → existing `email` (the (venue_id, email)
 * unique key, e.g. the same couple captured via a VF2 form) → insert a thin contact.
 * GHL's contact payload is name/email/phone only, so synced contacts are thin;
 * enriching from GHL custom fields is a later add.
 *
 * Deliberately does NOT create an opportunity — GHL owns pre-sales staging (no
 * native pipeline/stages in V2).
 */
export async function upsertGhlContact(
  admin: Admin,
  venueId: string,
  ghl: GhlContact,
): Promise<string | null> {
  // 1. Already linked by GHL id?
  const { data: byGhl } = await admin
    .from("contacts")
    .select("id")
    .eq("venue_id", venueId)
    .eq("ghl_contact_id", ghl.id)
    .maybeSingle();
  if (byGhl) return byGhl.id;

  // 2. Same person already captured via a VF2 form? Match the (venue, email) key
  //    and adopt the GHL id so the two systems stay linked.
  if (ghl.email) {
    const { data: byEmail } = await admin
      .from("contacts")
      .select("id, ghl_contact_id")
      .eq("venue_id", venueId)
      .eq("email", ghl.email)
      .maybeSingle();
    if (byEmail) {
      if (!byEmail.ghl_contact_id) {
        await admin
          .from("contacts")
          .update({ ghl_contact_id: ghl.id })
          .eq("id", byEmail.id);
      }
      return byEmail.id;
    }
  }

  // 3. New contact. first_name is NOT NULL — fall back to email when GHL has no name.
  const { data: created, error } = await admin
    .from("contacts")
    .insert({
      venue_id: venueId,
      first_name: ghl.firstName ?? ghl.email ?? "Unknown",
      last_name: ghl.lastName ?? null,
      email: ghl.email ?? null,
      phone: ghl.phone ?? null,
      ghl_contact_id: ghl.id,
      source: "ghl",
    })
    .select("id")
    .single();

  if (error) {
    console.warn(`upsertGhlContact: insert failed — ${error.message}`);
    return null;
  }
  return created.id;
}
