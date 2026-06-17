/**
 * Pure composition helpers for the items-first menu model (D4).
 *
 * menu_items is the master catalogue. menus reference items via
 * menu_item_selections. These functions operate on in-memory row shapes
 * matching the Supabase types — no DB calls, safe to test without mocks.
 */

// ---------------------------------------------------------------------------
// Row types (subset of Tables<"menu_items"> / Tables<"menu_item_selections">)
// ---------------------------------------------------------------------------

export interface MenuItemRow {
  id: string;
  name: string;
  course: string;
  description: string | null;
  price_per_head_minor: number | null;
  allergens: string[];
  dietary_tags: string[];
  is_active: boolean;
  sort_order: number;
}

export interface SelectionRow {
  id: string;
  menu_id: string;
  menu_item_id: string;
  /** Course stored on the selection — may override item.course for display grouping. */
  course: string | null;
  sort_index: number;
}

// ---------------------------------------------------------------------------
// groupSelectionsByCourse
// ---------------------------------------------------------------------------

export interface CourseGroup {
  item: MenuItemRow;
  sort_index: number;
}

/**
 * Given the venue's item library and the selections for one menu template,
 * return a record keyed by course with the matched items sorted by sort_index.
 *
 * - Uses the course value from the selection row (not from the item) so that
 *   per-menu course overrides are respected.
 * - Selections whose menu_item_id does not match any item are silently skipped.
 */
export function groupSelectionsByCourse(
  items: MenuItemRow[],
  selections: SelectionRow[],
): Record<string, CourseGroup[]> {
  const itemMap = new Map<string, MenuItemRow>(items.map((i) => [i.id, i]));

  const result: Record<string, CourseGroup[]> = {};

  for (const sel of selections) {
    const item = itemMap.get(sel.menu_item_id);
    if (!item) continue;

    const course = sel.course ?? item.course;

    if (!result[course]) {
      result[course] = [];
    }
    result[course]!.push({ item, sort_index: sel.sort_index });
  }

  // Sort each course group by sort_index ascending
  for (const course of Object.keys(result)) {
    result[course]!.sort((a, b) => a.sort_index - b.sort_index);
  }

  return result;
}

// ---------------------------------------------------------------------------
// validateMenuComposition
// ---------------------------------------------------------------------------

export type CompositionErrorType = "missing_item" | "inactive_item";

export interface CompositionError {
  type: CompositionErrorType;
  menuItemId: string;
  /** The item's name when the item exists in the library; null if it was deleted. */
  itemName: string | null;
}

export interface CompositionValidation {
  valid: boolean;
  errors: CompositionError[];
}

/**
 * Validate that every selection in a menu template refers to an existing,
 * active item in the venue's library.
 *
 * Two error types are returned:
 *   - "missing_item"   — menu_item_id not found in the library at all
 *                        (item was hard-deleted after being added to a menu)
 *   - "inactive_item"  — item exists but is_active = false
 *                        (item was archived while still referenced by the menu)
 *
 * An empty selections list is valid (an empty menu is a valid draft state).
 */
export function validateMenuComposition(
  items: MenuItemRow[],
  selections: SelectionRow[],
): CompositionValidation {
  const itemMap = new Map<string, MenuItemRow>(items.map((i) => [i.id, i]));
  const errors: CompositionError[] = [];

  for (const sel of selections) {
    const item = itemMap.get(sel.menu_item_id);

    if (!item) {
      errors.push({
        type: "missing_item",
        menuItemId: sel.menu_item_id,
        itemName: null,
      });
      continue;
    }

    if (!item.is_active) {
      errors.push({
        type: "inactive_item",
        menuItemId: sel.menu_item_id,
        itemName: item.name,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
