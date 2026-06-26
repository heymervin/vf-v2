import type { Tables, Json } from "@/lib/supabase/types";
import type { DishRow } from "./menu-types";
import { buildAllergenRollup, type AllergenRollupEntry } from "@/lib/menu/allergens";

// Shared menu-composition helpers — used by the menu tool and the chef sheet.
// Pure (no DB calls); the page/route does the querying.

export type MenuItemRow = Tables<"menu_items">;
export type SelectionRow = Tables<"wedding_menu_selections">;
export type GuestRow = Pick<
  Tables<"wedding_guests">,
  "id" | "name" | "dietary" | "meal_choice"
>;

/** "Saturday 12 June 2027" — shared by the chef sheet and the BEO. */
export function formatLongDate(d: string | null): string {
  if (!d) return "Date TBC";
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Parse meal_choice jsonb (shape: { [course]: menuItemId }) to look up
 * which menu_items id a guest chose.
 */
export function parseMealChoice(raw: Json | null): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, string>;
}

/**
 * Count how many guests chose each menu_item id, and collect those guest ids.
 * Returns a Map<menuItemId, { count, guestIds }>.
 */
export function buildChosenByMap(
  guests: GuestRow[],
): Map<string, { count: number; guestIds: string[] }> {
  const map = new Map<string, { count: number; guestIds: string[] }>();

  for (const guest of guests) {
    const choice = parseMealChoice(guest.meal_choice);
    if (!choice) continue;

    const chosenItemIds = new Set(Object.values(choice));
    for (const itemId of chosenItemIds) {
      const existing = map.get(itemId) ?? { count: 0, guestIds: [] };
      existing.count += 1;
      existing.guestIds.push(guest.id);
      map.set(itemId, existing);
    }
  }

  return map;
}

/**
 * Compose the DishRow list from venue menu_items + per-wedding selections
 * + guest meal choices.
 */
export function composeDishRows(
  items: MenuItemRow[],
  selections: SelectionRow[],
  guests: GuestRow[],
): DishRow[] {
  const selectionByItemId = new Map<string, SelectionRow>();
  for (const sel of selections) {
    selectionByItemId.set(sel.menu_item_id, sel);
  }

  const chosenByMap = buildChosenByMap(guests);

  return items.map((item): DishRow => {
    const sel = selectionByItemId.get(item.id) ?? null;
    const chosen = chosenByMap.get(item.id) ?? { count: 0, guestIds: [] };

    return {
      itemId: item.id,
      selectionId: sel?.id ?? null,
      name: item.name,
      course: sel?.course ?? item.course,
      description: item.description,
      allergens: item.allergens,
      dietaryTags: item.dietary_tags,
      pricePerHeadMinor: item.price_per_head_minor,
      isActive: item.is_active,
      sortOrder: item.sort_order,
      chosenBy: chosen.count,
      guestIds: chosen.guestIds,
      isSelected: sel !== null,
    };
  });
}

// ── Kitchen / BEO menu summary (shared by the chef sheet + the BEO) ──────────

export interface DietaryGuest {
  id: string;
  name: string;
  dietary: string[];
  picks: string[];
}

export interface MenuSummary {
  dishesByCourse: { course: string; dishes: DishRow[] }[];
  rollup: AllergenRollupEntry[];
  dietaryGuests: DietaryGuest[];
}

/**
 * Compose the kitchen-facing summary for a wedding: selected dishes grouped by
 * course, the allergen rollup over those dishes, and guests with special
 * dietary requirements (+ what they chose). Pure — the caller does the queries.
 */
export function buildMenuSummary(
  items: MenuItemRow[],
  selections: SelectionRow[],
  guests: GuestRow[],
): MenuSummary {
  const dishes = composeDishRows(items, selections, guests).filter((d) => d.isSelected);

  const rollup = buildAllergenRollup(
    dishes.map((d) => ({ allergens: d.allergens, chosenBy: d.chosenBy })),
    guests.length,
  );

  const byCourse = new Map<string, DishRow[]>();
  for (const d of dishes) {
    const arr = byCourse.get(d.course) ?? [];
    arr.push(d);
    byCourse.set(d.course, arr);
  }
  const dishesByCourse = Array.from(byCourse.entries()).map(([course, list]) => ({
    course,
    dishes: list,
  }));

  const nameById = new Map(dishes.map((d) => [d.itemId, d.name]));
  const dietaryGuests: DietaryGuest[] = guests
    .filter((g) => (g.dietary?.length ?? 0) > 0)
    .map((g) => {
      const choice = parseMealChoice(g.meal_choice) ?? {};
      const picks = Object.values(choice)
        .map((iid) => nameById.get(iid))
        .filter(Boolean) as string[];
      return { id: g.id, name: g.name, dietary: g.dietary ?? [], picks };
    });

  return { dishesByCourse, rollup, dietaryGuests };
}
