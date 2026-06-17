"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import type { Tables } from "@/lib/supabase/types";

export type FloorTemplateRow = Tables<"floor_templates">;

// ── Schemas ──────────────────────────────────────────────────────────────────

const TableEntrySchema = z.object({
  id: z.string(),
  tableNumber: z.number().int().min(1),
  shape: z.enum(["round", "banquet", "square", "top"]),
  capacity: z.number().int().min(1),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  label: z.string().nullable(),
});

export type TableEntry = z.infer<typeof TableEntrySchema>;

const SaveFloorTemplateSchema = z.object({
  /** When provided, update the existing template row; otherwise create a new one. */
  id: z.string().uuid().optional(),
  spaceId: z.string().uuid("Invalid space ID."),
  name: z.string().min(1, "Template name is required"),
  tables: z.array(TableEntrySchema),
  isDefault: z.boolean().default(false),
});

export type SaveFloorTemplateInput = z.infer<typeof SaveFloorTemplateSchema>;

// ── saveFloorTemplate ─────────────────────────────────────────────────────────

/**
 * Create or update a floor template for a space.
 * Stores the table array as the `layout` jsonb column.
 * Updates the denormalised `table_count` and `capacity` fields.
 * Owner/admin only.
 */
export async function saveFloorTemplate(
  input: SaveFloorTemplateInput,
): Promise<ActionResult<FloorTemplateRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage floor templates.");
  }

  const parsed = SaveFloorTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { id, spaceId, name, tables, isDefault } = parsed.data;

  const tableCount = tables.length;
  const capacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  const layout = tables;

  const supabase = await createClient();

  if (id) {
    const { data, error } = await supabase
      .from("floor_templates")
      .update({
        name,
        layout: layout as unknown as import("@/lib/supabase/types").Json,
        table_count: tableCount,
        capacity,
        is_default: isDefault,
      })
      .eq("id", id)
      .eq("venue_id", ctx.venue.id)
      .select()
      .single();

    if (error || !data) {
      console.error("saveFloorTemplate update failed:", error?.message);
      return err("Could not update floor template.");
    }

    revalidatePath(`/settings/spaces/${spaceId}/floor`);
    return ok(data as FloorTemplateRow);
  }

  // Verify the space belongs to this venue before inserting
  const { data: space, error: spaceErr } = await supabase
    .from("spaces")
    .select("id")
    .eq("id", spaceId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (spaceErr || !space) {
    return err("Space not found.");
  }

  const { data, error } = await supabase
    .from("floor_templates")
    .insert({
      venue_id: ctx.venue.id,
      space_id: spaceId,
      name,
      layout: layout as unknown as import("@/lib/supabase/types").Json,
      table_count: tableCount,
      capacity,
      is_default: isDefault,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("saveFloorTemplate insert failed:", error?.message);
    return err("Could not create floor template.");
  }

  revalidatePath(`/settings/spaces/${spaceId}/floor`);
  return ok(data as FloorTemplateRow);
}

// ── deleteFloorTemplate ───────────────────────────────────────────────────────

const DeleteFloorTemplateSchema = z.object({
  templateId: z.string().uuid("Invalid template ID."),
  spaceId: z.string().uuid("Invalid space ID."),
});

/**
 * Delete a floor template. Owner/admin only.
 */
export async function deleteFloorTemplate(input: {
  templateId: string;
  spaceId: string;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can delete floor templates.");
  }

  const parsed = DeleteFloorTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("floor_templates")
    .delete()
    .eq("id", parsed.data.templateId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("deleteFloorTemplate failed:", error.message);
    return err("Could not delete floor template.");
  }

  revalidatePath(`/settings/spaces/${parsed.data.spaceId}/floor`);
  return ok(undefined);
}

// ── setDefaultTemplate ────────────────────────────────────────────────────────

/**
 * Mark a template as the default for its space (clears the previous default).
 * Owner/admin only.
 */
export async function setDefaultTemplate(input: {
  templateId: string;
  spaceId: string;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can set the default template.");
  }

  const parsed = DeleteFloorTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const supabase = await createClient();

  // Clear previous default for this space
  const { error: clearErr } = await supabase
    .from("floor_templates")
    .update({ is_default: false })
    .eq("space_id", parsed.data.spaceId)
    .eq("venue_id", ctx.venue.id);

  if (clearErr) {
    console.error("setDefaultTemplate clear failed:", clearErr.message);
    return err("Could not update default template.");
  }

  // Set new default
  const { error: setErr } = await supabase
    .from("floor_templates")
    .update({ is_default: true })
    .eq("id", parsed.data.templateId)
    .eq("venue_id", ctx.venue.id);

  if (setErr) {
    console.error("setDefaultTemplate set failed:", setErr.message);
    return err("Could not set default template.");
  }

  revalidatePath(`/settings/spaces/${parsed.data.spaceId}/floor`);
  return ok(undefined);
}
