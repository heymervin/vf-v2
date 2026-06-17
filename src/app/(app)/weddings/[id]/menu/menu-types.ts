/**
 * Shared type definitions for the per-wedding Menu tool.
 *
 * NOT a server module — safe to import from both server components and
 * client components. No "use server", no DB calls, no secrets.
 */

import type { Tables } from "@/lib/supabase/types";

// Raw DB row shapes
export type MenuItemRow = Tables<"menu_items">;
export type WeddingMenuSelectionRow = Tables<"wedding_menu_selections">;

// ── Derived flat dish row (what the client renders) ──────────────────────────

/**
 * One dish as it appears in the menu UI: an item from the venue library
 * joined with its per-wedding selection (if selected) and a chosenBy count
 * derived from wedding_guests.meal_choice.
 */
export interface DishRow {
  /** menu_items.id */
  itemId: string;
  /** wedding_menu_selections.id — null if not yet selected for this wedding */
  selectionId: string | null;
  name: string;
  course: string;
  description: string | null;
  allergens: string[];
  dietaryTags: string[];
  /** price in minor units (pence) */
  pricePerHeadMinor: number | null;
  isActive: boolean;
  sortOrder: number;
  /** Count of guests whose meal_choice includes this item id */
  chosenBy: number;
  /** IDs of guests who chose this item (for drill-down) */
  guestIds: string[];
  isSelected: boolean;
}

// ── Guest shape (only fields the menu tool needs) ────────────────────────────

export interface GuestForMenu {
  id: string;
  name: string;
  dietary: string[];
  /** jsonb from wedding_guests.meal_choice — keys are course names, values are menu_items.id */
  mealChoice: Record<string, string> | null;
}

// ── Page data shape (passed from server page → client) ───────────────────────

export interface MenuPageData {
  weddingId: string;
  weddingName: string;
  venueId: string;
  dishes: DishRow[];
  guests: GuestForMenu[];
  totalGuests: number;
}
