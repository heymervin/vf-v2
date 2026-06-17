"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import type { Tables } from "@/lib/supabase/types";

export type SpaceRow = Tables<"spaces">;

// ── Schemas ──────────────────────────────────────────────────────────────────

const UpsertSpaceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Space name is required"),
  description: z.string().default(""),
  indoor_outdoor: z.enum(["indoor", "outdoor", "both"]),
  capacity_seated: z.number().int().min(0).nullable(),
  capacity_standing: z.number().int().min(0).nullable(),
  capacity_ceremony: z.number().int().min(0).nullable(),
});

export type UpsertSpaceInput = z.infer<typeof UpsertSpaceSchema>;

// ── upsertSpace ───────────────────────────────────────────────────────────────

/**
 * Create or update a space. Owner/admin only.
 * When `id` is provided the row is updated; otherwise a new row is inserted.
 */
export async function upsertSpace(
  input: UpsertSpaceInput,
): Promise<ActionResult<SpaceRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage spaces.");
  }

  const parsed = UpsertSpaceSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const supabase = await createClient();
  const { id, ...fields } = parsed.data;

  if (id) {
    // Update existing row — must belong to this venue
    const { data, error } = await supabase
      .from("spaces")
      .update({
        name: fields.name,
        description: fields.description,
        indoor_outdoor: fields.indoor_outdoor,
        capacity_seated: fields.capacity_seated,
        capacity_standing: fields.capacity_standing,
        capacity_ceremony: fields.capacity_ceremony,
      })
      .eq("id", id)
      .eq("venue_id", ctx.venue.id)
      .select()
      .single();

    if (error || !data) {
      console.error("upsertSpace update failed:", error?.message);
      return err("Could not update space.");
    }

    revalidatePath("/settings/spaces");
    return ok(data as SpaceRow);
  }

  // Insert new row
  const { data, error } = await supabase
    .from("spaces")
    .insert({
      venue_id: ctx.venue.id,
      name: fields.name,
      description: fields.description,
      indoor_outdoor: fields.indoor_outdoor,
      capacity_seated: fields.capacity_seated,
      capacity_standing: fields.capacity_standing,
      capacity_ceremony: fields.capacity_ceremony,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("upsertSpace insert failed:", error?.message);
    return err("Could not create space.");
  }

  revalidatePath("/settings/spaces");
  return ok(data as SpaceRow);
}

// ── archiveSpace ──────────────────────────────────────────────────────────────

const ArchiveSpaceSchema = z.string().uuid("Invalid space ID.");

/**
 * Soft-delete a space by setting is_archived = true. Owner/admin only.
 */
export async function archiveSpace(
  spaceId: string,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can archive spaces.");
  }

  const parsed = ArchiveSpaceSchema.safeParse(spaceId);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid space ID.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("spaces")
    .update({ is_archived: true })
    .eq("id", parsed.data)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("archiveSpace failed:", error.message);
    return err("Could not archive space.");
  }

  revalidatePath("/settings/spaces");
  return ok(undefined);
}

// ── listSpaces ────────────────────────────────────────────────────────────────

/**
 * Fetch all non-archived spaces for the current venue,
 * ordered by sort_order then name.
 */
export async function listSpaces(): Promise<ActionResult<SpaceRow[]>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("spaces")
    .select("*")
    .eq("venue_id", ctx.venue.id)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("listSpaces failed:", error.message);
    return err("Could not load spaces.");
  }

  return ok((data ?? []) as SpaceRow[]);
}
