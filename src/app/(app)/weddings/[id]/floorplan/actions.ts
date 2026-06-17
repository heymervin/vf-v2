"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import {
  parseLayout,
  emptyLayout,
  type FloorPlanLayout,
} from "./floorplan-types";

// ── seedFloorPlan ─────────────────────────────────────────────────────────────

const SeedFloorPlanSchema = z.object({
  weddingId: z.string().uuid(),
  spaceId: z.string().uuid(),
  templateId: z.string().uuid(),
});

/**
 * On first open: clone the floor template's layout jsonb into a new
 * floor_plans row for this wedding. Idempotent — returns existing row if
 * one already exists.
 */
export async function seedFloorPlan(input: {
  weddingId: string;
  spaceId: string;
  templateId: string;
}): Promise<ActionResult<{ id: string; layout: FloorPlanLayout }>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = SeedFloorPlanSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const supabase = await createClient();

  // Return existing plan if already seeded
  const { data: existing } = await supabase
    .from("floor_plans")
    .select("id, layout")
    .eq("wedding_id", parsed.data.weddingId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (existing) {
    return ok({
      id: existing.id,
      layout: parseLayout(existing.layout) ?? emptyLayout(),
    });
  }

  // Load the template layout
  const { data: template, error: tErr } = await supabase
    .from("floor_templates")
    .select("layout, name")
    .eq("id", parsed.data.templateId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (tErr || !template) {
    return err("Floor template not found.");
  }

  const layout = parseLayout(template.layout) ?? emptyLayout();

  // Insert the per-wedding plan
  const { data: plan, error: iErr } = await supabase
    .from("floor_plans")
    .insert({
      venue_id: ctx.venue.id,
      wedding_id: parsed.data.weddingId,
      space_id: parsed.data.spaceId,
      template_id: parsed.data.templateId,
      name: template.name ?? "Floor plan",
      layout: layout as unknown as import("@/lib/supabase/types").Json,
    })
    .select("id, layout")
    .single();

  if (iErr || !plan) {
    console.error("seedFloorPlan insert failed:", iErr?.message);
    return err("Could not seed floor plan.");
  }

  revalidatePath(`/weddings/${parsed.data.weddingId}/floorplan`);

  return ok({
    id: plan.id,
    layout: parseLayout(plan.layout) ?? emptyLayout(),
  });
}

// ── saveFloorPlanLayout ───────────────────────────────────────────────────────

const SaveLayoutSchema = z.object({
  floorPlanId: z.string().uuid(),
  weddingId: z.string().uuid(),
  layout: z.object({
    tables: z.array(z.any()),
    roomElements: z.array(z.any()),
  }),
});

/**
 * Persist an updated layout jsonb to the existing floor_plans row.
 */
export async function saveFloorPlanLayout(input: {
  floorPlanId: string;
  weddingId: string;
  layout: FloorPlanLayout;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = SaveLayoutSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("floor_plans")
    .update({
      layout: parsed.data.layout as unknown as import("@/lib/supabase/types").Json,
    })
    .eq("id", parsed.data.floorPlanId)
    .eq("wedding_id", parsed.data.weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("saveFloorPlanLayout failed:", error.message);
    return err("Could not save floor plan.");
  }

  revalidatePath(`/weddings/${parsed.data.weddingId}/floorplan`);
  return ok(undefined);
}

// ── assignGuestToTable ────────────────────────────────────────────────────────

const AssignGuestSchema = z.object({
  weddingId: z.string().uuid(),
  guestId: z.string().uuid(),
  tableNumber: z.number().int().min(0).nullable(),
});

/**
 * Assign (or unassign) a guest to a table by writing wedding_guests.table_number.
 * Scoped by venue_id + wedding_id for safety.
 */
export async function assignGuestToTable(input: {
  weddingId: string;
  guestId: string;
  tableNumber: number | null;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = AssignGuestSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("wedding_guests")
    .update({ table_number: parsed.data.tableNumber })
    .eq("id", parsed.data.guestId)
    .eq("wedding_id", parsed.data.weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("assignGuestToTable failed:", error.message);
    return err("Could not assign guest to table.");
  }

  revalidatePath(`/weddings/${parsed.data.weddingId}/floorplan`);
  revalidatePath(`/weddings/${parsed.data.weddingId}/guests`);
  return ok(undefined);
}
