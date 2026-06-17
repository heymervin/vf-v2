"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ACCENT_SEEDS = ["pink", "teal", "blue", "green", "mint", "muted"] as const;

const ProfileSchema = z.object({
  name: z.string().min(1, "Venue name is required"),
  legalName: z.string().optional(),
  tagline: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  accentSeed: z.enum(ACCENT_SEEDS),
  timezone: z.string().min(1, "Timezone is required"),
});

// Time string: HH:MM  (00:00 – 23:59)
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const HourEntrySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  openTime: z
    .string()
    .nullable()
    .refine((v) => v === null || TIME_RE.test(v), { message: "Invalid time format" }),
  closeTime: z
    .string()
    .nullable()
    .refine((v) => v === null || TIME_RE.test(v), { message: "Invalid time format" }),
  closed: z.boolean(),
});

const VenueHoursSchema = z
  .array(HourEntrySchema)
  .length(7, "Exactly 7 day entries are required");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProfileInput = z.infer<typeof ProfileSchema>;
export type HourEntry = z.infer<typeof HourEntrySchema>;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Persist venue profile fields to the venues row.
 * Owner/admin only.
 */
export async function updateVenueProfile(
  input: ProfileInput,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can update venue profile.");
  }

  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Invalid input.");
  }

  const { name, legalName, tagline, address, phone, accentSeed, timezone } =
    parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("venues")
    .update({
      name,
      legal_name: legalName ?? null,
      tagline: tagline ?? null,
      address: address ?? null,
      phone: phone ?? null,
      accent_seed: accentSeed,
      timezone,
    })
    .eq("id", ctx.venue.id);

  if (error) {
    console.error("updateVenueProfile failed:", error.message);
    return err("Could not save profile. Please try again.");
  }

  revalidatePath("/settings/profile");
  return ok(undefined);
}

/**
 * Bulk-upsert the 7-day opening hours for the venue.
 * Null open_time / close_time represents a closed day.
 * Owner/admin only.
 */
export async function upsertVenueHours(
  hours: HourEntry[],
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can update opening hours.");
  }

  const parsed = VenueHoursSchema.safeParse(hours);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Invalid hours data.");
  }

  const venueId = ctx.venue.id;

  const rows = parsed.data.map((h) => ({
    venue_id: venueId,
    weekday: h.weekday,
    open_time: h.closed ? null : h.openTime,
    close_time: h.closed ? null : h.closeTime,
  }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_hours")
    .upsert(rows, { onConflict: "venue_id,weekday" })
    .eq("venue_id", venueId);

  if (error) {
    console.error("upsertVenueHours failed:", error.message);
    return err("Could not save opening hours. Please try again.");
  }

  revalidatePath("/settings/profile");
  return ok(undefined);
}
