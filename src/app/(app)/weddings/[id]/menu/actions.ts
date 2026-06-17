"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";

// ── addMenuSelection ──────────────────────────────────────────────────────────

const AddMenuSelectionSchema = z.object({
  weddingId: z.string().uuid("Invalid wedding ID"),
  menuItemId: z.string().uuid("Invalid menu item ID"),
  course: z.string().min(1, "Course is required").max(80),
  sortIndex: z.number().int().min(0).default(0),
});

export type AddMenuSelectionInput = z.infer<typeof AddMenuSelectionSchema>;

/**
 * Add a venue menu item to this wedding's selected menu.
 * Creates a wedding_menu_selections row scoped to both venue_id + wedding_id.
 * If the item is already selected for this wedding the action is a no-op (returns ok).
 */
export async function addMenuSelection(
  input: AddMenuSelectionInput,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = AddMenuSelectionSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { weddingId, menuItemId, course, sortIndex } = parsed.data;
  const admin = createAdminClient();

  // Verify the wedding belongs to this venue
  const { data: wedding } = await admin
    .from("weddings")
    .select("id")
    .eq("id", weddingId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (!wedding) return err("Wedding not found.");

  // Verify the menu item belongs to this venue and is active
  const { data: item } = await admin
    .from("menu_items")
    .select("id, is_active")
    .eq("id", menuItemId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (!item) return err("Menu item not found.");
  if (!item.is_active) return err("Menu item is no longer active.");

  // Check for existing selection (idempotent — no duplicate allowed)
  const { data: existing } = await admin
    .from("wedding_menu_selections")
    .select("id")
    .eq("wedding_id", weddingId)
    .eq("menu_item_id", menuItemId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (existing) return ok({ id: existing.id });

  const { data: inserted, error } = await admin
    .from("wedding_menu_selections")
    .insert({
      wedding_id: weddingId,
      menu_item_id: menuItemId,
      venue_id: ctx.venue.id,
      course,
      sort_index: sortIndex,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("addMenuSelection failed:", error?.message);
    return err("Could not add menu item. Please try again.");
  }

  revalidatePath(`/weddings/${weddingId}/menu`);
  return ok({ id: inserted.id });
}

// ── removeMenuSelection ───────────────────────────────────────────────────────

const RemoveMenuSelectionSchema = z.object({
  selectionId: z.string().uuid("Invalid selection ID"),
  weddingId: z.string().uuid("Invalid wedding ID"),
});

export type RemoveMenuSelectionInput = z.infer<typeof RemoveMenuSelectionSchema>;

/**
 * Remove a menu item from this wedding's selected menu.
 * Deletes the wedding_menu_selections row, scoped to venue_id + wedding_id.
 */
export async function removeMenuSelection(
  input: RemoveMenuSelectionInput,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = RemoveMenuSelectionSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { selectionId, weddingId } = parsed.data;
  const admin = createAdminClient();

  const { error } = await admin
    .from("wedding_menu_selections")
    .delete()
    .eq("id", selectionId)
    .eq("wedding_id", weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("removeMenuSelection failed:", error.message);
    return err("Could not remove menu item. Please try again.");
  }

  revalidatePath(`/weddings/${weddingId}/menu`);
  return ok(undefined);
}
