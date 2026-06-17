"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";

export type GuestRow = Tables<"wedding_guests">;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const GuestIdSchema = z.object({
  guestId: z.string().uuid("Invalid guest ID"),
  weddingId: z.string().uuid("Invalid wedding ID"),
});

const UpsertGuestSchema = z.object({
  id: z.string().uuid().optional(),
  weddingId: z.string().uuid("Invalid wedding ID"),
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  side: z.enum(["partner1", "partner2", "both"]).default("partner1"),
  rsvp: z.enum(["yes", "no", "pending"]).default("pending"),
  session_type: z.enum(["day", "evening", "ceremony_only"]).default("day"),
  dietary: z.array(z.string()).default([]),
  allergen_notes: z.string().max(500).optional().or(z.literal("")),
  plus_one: z.boolean().default(false),
  plus_one_name: z.string().max(200).optional().or(z.literal("")),
  household_name: z.string().max(200).optional().or(z.literal("")),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(1000).optional().or(z.literal("")),
  table_number: z.number().int().min(1).max(999).nullable().default(null),
});

export type UpsertGuestInput = z.infer<typeof UpsertGuestSchema>;

const AssignTableSchema = z.object({
  guestId: z.string().uuid(),
  weddingId: z.string().uuid(),
  tableNumber: z.number().int().min(1).max(999).nullable(),
});

const ChaseRsvpSchema = z.object({
  guestId: z.string().uuid(),
  weddingId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Verify the wedding belongs to this venue. Returns the wedding id or null. */
async function assertWeddingBelongsToVenue(
  weddingId: string,
  venueId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("weddings")
    .select("id")
    .eq("id", weddingId)
    .eq("venue_id", venueId)
    .maybeSingle();
  return !!data;
}

// ---------------------------------------------------------------------------
// upsertGuest — create or update a guest
// ---------------------------------------------------------------------------

export async function upsertGuest(
  input: UpsertGuestInput,
): Promise<ActionResult<GuestRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = UpsertGuestSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { id, weddingId, ...fields } = parsed.data;

  const belongs = await assertWeddingBelongsToVenue(weddingId, ctx.venue.id);
  if (!belongs) return err("Wedding not found.");

  const admin = createAdminClient();

  if (id) {
    const { data, error } = await admin
      .from("wedding_guests")
      .update({
        name: fields.name,
        email: fields.email || null,
        phone: fields.phone || null,
        side: fields.side,
        rsvp: fields.rsvp,
        session_type: fields.session_type,
        dietary: fields.dietary,
        allergen_notes: fields.allergen_notes || null,
        plus_one: fields.plus_one,
        plus_one_name: fields.plus_one_name || null,
        household_name: fields.household_name || null,
        tags: fields.tags,
        notes: fields.notes || null,
        table_number: fields.table_number,
      })
      .eq("id", id)
      .eq("wedding_id", weddingId)
      .eq("venue_id", ctx.venue.id)
      .select()
      .single();

    if (error || !data) {
      console.error("upsertGuest update failed:", error?.message);
      return err("Could not update guest.");
    }

    revalidatePath(`/weddings/${weddingId}/guests`);
    return ok(data as GuestRow);
  }

  const { data, error } = await admin
    .from("wedding_guests")
    .insert({
      venue_id: ctx.venue.id,
      wedding_id: weddingId,
      name: fields.name,
      email: fields.email || null,
      phone: fields.phone || null,
      side: fields.side,
      rsvp: fields.rsvp,
      session_type: fields.session_type,
      dietary: fields.dietary,
      allergen_notes: fields.allergen_notes || null,
      plus_one: fields.plus_one,
      plus_one_name: fields.plus_one_name || null,
      household_name: fields.household_name || null,
      tags: fields.tags,
      notes: fields.notes || null,
      table_number: fields.table_number,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("upsertGuest insert failed:", error?.message);
    return err("Could not add guest.");
  }

  revalidatePath(`/weddings/${weddingId}/guests`);
  return ok(data as GuestRow);
}

// ---------------------------------------------------------------------------
// deleteGuest
// ---------------------------------------------------------------------------

export async function deleteGuest(input: {
  guestId: string;
  weddingId: string;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = GuestIdSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { guestId, weddingId } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .from("wedding_guests")
    .delete()
    .eq("id", guestId)
    .eq("wedding_id", weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("deleteGuest failed:", error.message);
    return err("Could not delete guest.");
  }

  revalidatePath(`/weddings/${weddingId}/guests`);
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// assignTable — inline table assignment from the guest table popover
// ---------------------------------------------------------------------------

export async function assignTable(input: {
  guestId: string;
  weddingId: string;
  tableNumber: number | null;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = AssignTableSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { guestId, weddingId, tableNumber } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .from("wedding_guests")
    .update({ table_number: tableNumber })
    .eq("id", guestId)
    .eq("wedding_id", weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("assignTable failed:", error.message);
    return err("Could not assign table.");
  }

  revalidatePath(`/weddings/${weddingId}/guests`);
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// chaseRsvp — record that a chase was sent (sets rsvp_chased_at)
// ---------------------------------------------------------------------------

export async function chaseRsvp(input: {
  guestId: string;
  weddingId: string;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = ChaseRsvpSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { guestId, weddingId } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .from("wedding_guests")
    .update({ rsvp_chased_at: new Date().toISOString() })
    .eq("id", guestId)
    .eq("wedding_id", weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("chaseRsvp failed:", error.message);
    return err("Could not record RSVP chase.");
  }

  revalidatePath(`/weddings/${weddingId}/guests`);
  return ok(undefined);
}
