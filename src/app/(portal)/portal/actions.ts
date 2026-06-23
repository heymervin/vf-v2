"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, err, type ActionResult } from "@/lib/actions";

/**
 * Couple Portal write actions.
 *
 * Every action:
 *   1. Resolves the couple session (getUser) and their active couple_accounts
 *      row (service-role, by user_id) → the authoritative wedding_id + venue_id.
 *   2. Re-validates wedding_id ∈ current_couple_wedding_ids() server-side, even
 *      though RLS already enforces it (defense in depth, spec §9).
 *   3. Writes via the RLS session client (DB enforces tenant isolation too).
 *   4. revalidatePath('/portal').
 *
 * Couples may set guest name/rsvp/dietary/plus_one/plus_one_name — NEVER side or
 * table_number (staff-owned). Menu selections are one item per course per wedding.
 */

// ── Session resolution ───────────────────────────────────────────────────────

interface CoupleSession {
  weddingId: string;
  venueId: string;
  // RLS-bound session client (writes go through this so RLS also enforces)
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Resolve + re-validate the couple session. Returns null when the caller is not
 * an active couple, or when the resolved wedding is not in their accessible set.
 */
async function getCoupleSession(): Promise<CoupleSession | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("couple_accounts")
    .select("wedding_id, venue_id, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!account) return null;

  // Defense in depth: re-validate against the RLS helper on the session client.
  const { data: allowedIds, error: rpcError } = await supabase.rpc(
    "current_couple_wedding_ids",
  );
  if (rpcError) return null;
  if (!allowedIds || !allowedIds.includes(account.wedding_id)) return null;

  return {
    weddingId: account.wedding_id,
    venueId: account.venue_id,
    supabase,
  };
}

// ── addGuest ─────────────────────────────────────────────────────────────────

const RSVP = z.enum(["yes", "no", "pending"]);

const AddGuestSchema = z.object({
  name: z.string().trim().min(1, "Guest name is required").max(120),
  rsvp: RSVP.default("pending"),
  dietary: z.array(z.string().trim().min(1)).default([]),
  plusOne: z.boolean().default(false),
  plusOneName: z.string().trim().max(120).nullable().default(null),
});

export type AddGuestInput = z.infer<typeof AddGuestSchema>;

export async function addGuest(
  input: AddGuestInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = AddGuestSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid guest details.");
  }

  const session = await getCoupleSession();
  if (!session) return err("Not authorised.");

  const { name, rsvp, dietary, plusOne, plusOneName } = parsed.data;

  const { data, error } = await session.supabase
    .from("wedding_guests")
    .insert({
      venue_id: session.venueId,
      wedding_id: session.weddingId,
      name,
      rsvp,
      dietary,
      plus_one: plusOne,
      plus_one_name: plusOneName,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("addGuest failed:", error?.message);
    return err("Could not add guest. Please try again.");
  }

  revalidatePath("/portal");
  return ok({ id: data.id });
}

// ── updateGuest ──────────────────────────────────────────────────────────────

const UpdateGuestSchema = z.object({
  guestId: z.string().uuid("Invalid guest id"),
  rsvp: RSVP.optional(),
  dietary: z.array(z.string().trim().min(1)).optional(),
  plusOne: z.boolean().optional(),
  plusOneName: z.string().trim().max(120).nullable().optional(),
});

export type UpdateGuestInput = z.infer<typeof UpdateGuestSchema>;

export async function updateGuest(
  input: UpdateGuestInput,
): Promise<ActionResult<void>> {
  const parsed = UpdateGuestSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid guest details.");
  }

  const session = await getCoupleSession();
  if (!session) return err("Not authorised.");

  const { guestId, rsvp, dietary, plusOne, plusOneName } = parsed.data;

  // Build a patch from only the couple-editable fields that were provided.
  const patch: {
    rsvp?: string;
    dietary?: string[];
    plus_one?: boolean;
    plus_one_name?: string | null;
  } = {};
  if (rsvp !== undefined) patch.rsvp = rsvp;
  if (dietary !== undefined) patch.dietary = dietary;
  if (plusOne !== undefined) patch.plus_one = plusOne;
  if (plusOneName !== undefined) patch.plus_one_name = plusOneName;

  if (Object.keys(patch).length === 0) return ok(undefined);

  // Scope the UPDATE to this wedding so a forged guestId from another wedding
  // can never match (RLS would block it anyway).
  const { error } = await session.supabase
    .from("wedding_guests")
    .update(patch)
    .eq("id", guestId)
    .eq("wedding_id", session.weddingId);

  if (error) {
    console.error("updateGuest failed:", error.message);
    return err("Could not update guest. Please try again.");
  }

  revalidatePath("/portal");
  return ok(undefined);
}

// ── upsertMenuSelection ──────────────────────────────────────────────────────

const UpsertMenuSelectionSchema = z.object({
  course: z.string().trim().min(1, "Course is required").max(80),
  menuItemId: z.string().uuid("Invalid menu item id"),
});

export type UpsertMenuSelectionInput = z.infer<
  typeof UpsertMenuSelectionSchema
>;

/**
 * Choose one menu item for a course (per-wedding, per-course — OQ-2 resolved to
 * per-wedding). Replaces any existing pick for that course so there is exactly
 * one selection per course.
 */
export async function upsertMenuSelection(
  input: UpsertMenuSelectionInput,
): Promise<ActionResult<void>> {
  const parsed = UpsertMenuSelectionSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid menu selection.");
  }

  const session = await getCoupleSession();
  if (!session) return err("Not authorised.");

  const { course, menuItemId } = parsed.data;

  // Confirm the chosen item belongs to this venue (service-role: menu_items has
  // no couple policy). Prevents selecting another venue's dish.
  const admin = createAdminClient();
  const { data: item } = await admin
    .from("menu_items")
    .select("id")
    .eq("id", menuItemId)
    .eq("venue_id", session.venueId)
    .maybeSingle();
  if (!item) return err("That menu option is not available.");

  // One pick per course: clear the existing pick, then insert the new one.
  const { error: delError } = await session.supabase
    .from("wedding_menu_selections")
    .delete()
    .eq("wedding_id", session.weddingId)
    .eq("course", course);
  if (delError) {
    console.error("upsertMenuSelection delete failed:", delError.message);
    return err("Could not save your choice. Please try again.");
  }

  const { error: insError } = await session.supabase
    .from("wedding_menu_selections")
    .insert({
      venue_id: session.venueId,
      wedding_id: session.weddingId,
      menu_item_id: menuItemId,
      course,
    });
  if (insError) {
    console.error("upsertMenuSelection insert failed:", insError.message);
    return err("Could not save your choice. Please try again.");
  }

  revalidatePath("/portal");
  return ok(undefined);
}
