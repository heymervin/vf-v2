"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import type { Tables } from "@/lib/supabase/types";

export type MenuItemRow = Tables<"menu_items">;
export type MenuRow = Tables<"menus">;
export type MenuItemSelectionRow = Tables<"menu_item_selections">;

// ---------------------------------------------------------------------------
// Validation constants (Natasha's Law 14 + dietary tags)
// ---------------------------------------------------------------------------

const VALID_ALLERGENS = new Set([
  "celery",
  "crustaceans",
  "dairy",
  "egg",
  "fish",
  "gluten",
  "lupin",
  "molluscs",
  "mustard",
  "nuts",
  "peanuts",
  "sesame",
  "soya",
  "sulphites",
]);

const VALID_DIETARY = new Set([
  "vegan",
  "vegetarian",
  "gluten-free",
  "dairy-free",
  "nut-free",
]);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const MenuItemSchema = z.object({
  name: z.string().min(1, "Dish name is required").max(120),
  course: z.string().min(1, "Course is required"),
  description: z.string().max(500).optional().default(""),
  price_per_head_minor: z
    .number()
    .int("Price must be whole pence")
    .min(0)
    .nullable()
    .optional()
    .default(null),
  allergens: z.array(z.string()).default([]),
  dietary_tags: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
});

const MenuSchema = z.object({
  name: z.string().min(1, "Menu name is required").max(120),
  notes: z.string().max(500).optional().default(""),
  is_active: z.boolean().default(true),
});

const AddSelectionSchema = z.object({
  menuId: z.string().uuid(),
  menuItemId: z.string().uuid(),
  course: z.string().min(1),
  sortIndex: z.number().min(0).default(0),
});

const RemoveSelectionSchema = z.object({
  selectionId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// createMenuItem
// ---------------------------------------------------------------------------

/**
 * Add a dish to the venue's menu library. Owner/admin only.
 */
export async function createMenuItem(
  input: z.infer<typeof MenuItemSchema>,
): Promise<ActionResult<MenuItemRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage the menu library.");
  }

  const parsed = MenuItemSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const data = parsed.data;

  // Validate allergen + dietary values against allowed sets
  const badAllergens = data.allergens.filter(
    (a) => !VALID_ALLERGENS.has(a.toLowerCase()),
  );
  if (badAllergens.length > 0) {
    return err(`Unknown allergens: ${badAllergens.join(", ")}`);
  }
  const badDietary = data.dietary_tags.filter(
    (d) => !VALID_DIETARY.has(d.toLowerCase()),
  );
  if (badDietary.length > 0) {
    return err(`Unknown dietary tags: ${badDietary.join(", ")}`);
  }

  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("menu_items")
    .insert({
      venue_id: ctx.venue.id,
      name: data.name,
      course: data.course,
      description: data.description,
      price_per_head_minor: data.price_per_head_minor,
      allergens: data.allergens,
      dietary_tags: data.dietary_tags,
      is_active: data.is_active,
    })
    .select("*")
    .single();

  if (error || !row) {
    console.error("createMenuItem failed:", error?.message);
    return err("Could not create dish.");
  }

  revalidatePath("/settings/menu");
  return ok(row);
}

// ---------------------------------------------------------------------------
// updateMenuItem
// ---------------------------------------------------------------------------

/**
 * Edit a dish in the library. Changes propagate everywhere the item is
 * referenced (menus reference by id — no denormalised copies). Owner/admin only.
 */
export async function updateMenuItem(
  itemId: string,
  input: Partial<z.infer<typeof MenuItemSchema>>,
): Promise<ActionResult<MenuItemRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage the menu library.");
  }

  if (!itemId) return err("Item ID is required.");

  const parsed = MenuItemSchema.partial().safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const data = parsed.data;

  if (data.allergens) {
    const badAllergens = data.allergens.filter(
      (a) => !VALID_ALLERGENS.has(a.toLowerCase()),
    );
    if (badAllergens.length > 0) {
      return err(`Unknown allergens: ${badAllergens.join(", ")}`);
    }
  }

  if (data.dietary_tags) {
    const badDietary = data.dietary_tags.filter(
      (d) => !VALID_DIETARY.has(d.toLowerCase()),
    );
    if (badDietary.length > 0) {
      return err(`Unknown dietary tags: ${badDietary.join(", ")}`);
    }
  }

  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("menu_items")
    .update(data)
    .eq("id", itemId)
    .eq("venue_id", ctx.venue.id)
    .select("*")
    .single();

  if (error || !row) {
    console.error("updateMenuItem failed:", error?.message);
    return err("Could not update dish.");
  }

  revalidatePath("/settings/menu");
  return ok(row);
}

// ---------------------------------------------------------------------------
// archiveMenuItem
// ---------------------------------------------------------------------------

/**
 * Soft-archive a dish (sets is_active = false). It remains in any menus it
 * was added to but will be flagged as inactive in validateMenuComposition.
 * Owner/admin only.
 */
export async function archiveMenuItem(
  itemId: string,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage the menu library.");
  }

  if (!itemId) return err("Item ID is required.");

  const admin = createAdminClient();

  const { error } = await admin
    .from("menu_items")
    .update({ is_active: false })
    .eq("id", itemId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("archiveMenuItem failed:", error.message);
    return err("Could not archive dish.");
  }

  revalidatePath("/settings/menu");
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// createMenu
// ---------------------------------------------------------------------------

/**
 * Create a named menu template for the venue. Owner/admin only.
 * A menu without a wedding_id is a library template (not per-wedding).
 */
export async function createMenu(
  input: z.infer<typeof MenuSchema>,
): Promise<ActionResult<MenuRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage menus.");
  }

  const parsed = MenuSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("menus")
    .insert({
      venue_id: ctx.venue.id,
      name: parsed.data.name,
      notes: parsed.data.notes,
      is_active: parsed.data.is_active,
    })
    .select("*")
    .single();

  if (error || !row) {
    console.error("createMenu failed:", error?.message);
    return err("Could not create menu.");
  }

  revalidatePath("/settings/menu");
  return ok(row);
}

// ---------------------------------------------------------------------------
// updateMenu
// ---------------------------------------------------------------------------

/**
 * Edit a menu template's metadata (name, notes, is_active). Owner/admin only.
 */
export async function updateMenu(
  menuId: string,
  input: Partial<z.infer<typeof MenuSchema>>,
): Promise<ActionResult<MenuRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage menus.");
  }

  if (!menuId) return err("Menu ID is required.");

  const parsed = MenuSchema.partial().safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("menus")
    .update(parsed.data)
    .eq("id", menuId)
    .eq("venue_id", ctx.venue.id)
    .select("*")
    .single();

  if (error || !row) {
    console.error("updateMenu failed:", error?.message);
    return err("Could not update menu.");
  }

  revalidatePath("/settings/menu");
  return ok(row);
}

// ---------------------------------------------------------------------------
// addItemToMenu
// ---------------------------------------------------------------------------

/**
 * Add a dish to a named menu template (creates a menu_item_selections row).
 * Owner/admin only.
 */
export async function addItemToMenu(
  input: z.infer<typeof AddSelectionSchema>,
): Promise<ActionResult<MenuItemSelectionRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage menus.");
  }

  const parsed = AddSelectionSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("menu_item_selections")
    .insert({
      venue_id: ctx.venue.id,
      menu_id: parsed.data.menuId,
      menu_item_id: parsed.data.menuItemId,
      course: parsed.data.course,
      sort_index: parsed.data.sortIndex,
    })
    .select("*")
    .single();

  if (error || !row) {
    console.error("addItemToMenu failed:", error?.message);
    return err("Could not add item to menu.");
  }

  revalidatePath("/settings/menu");
  return ok(row);
}

// ---------------------------------------------------------------------------
// removeItemFromMenu
// ---------------------------------------------------------------------------

/**
 * Remove a dish from a named menu template. Owner/admin only.
 */
export async function removeItemFromMenu(
  input: z.infer<typeof RemoveSelectionSchema>,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage menus.");
  }

  const parsed = RemoveSelectionSchema.safeParse(input);
  if (!parsed.success) return err("Invalid selection ID.");

  const admin = createAdminClient();

  const { error } = await admin
    .from("menu_item_selections")
    .delete()
    .eq("id", parsed.data.selectionId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("removeItemFromMenu failed:", error.message);
    return err("Could not remove item from menu.");
  }

  revalidatePath("/settings/menu");
  return ok(undefined);
}
