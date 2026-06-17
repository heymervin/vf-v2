/**
 * Unit tests for src/lib/menu/compose.ts
 *
 * Covers the items-first menu model (D4):
 *   - groupSelectionsByCourse: maps menu_item_selections + menu_items into
 *     a course-keyed record, ordered by sort_index within each course.
 *   - validateMenuComposition: checks that a named menu template has at least
 *     one active item per course it declares, returning typed errors.
 *
 * All tests are DB-free and secret-free — pure function tests with mock data.
 */

import { describe, it, expect } from "vitest";
import {
  groupSelectionsByCourse,
  validateMenuComposition,
  type MenuItemRow,
  type SelectionRow,
  type CourseGroup,
} from "./compose";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ITEMS: MenuItemRow[] = [
  {
    id: "item-1",
    name: "Heritage tomato & burrata",
    course: "Starter",
    description: "Heritage tomatoes, Puglian burrata.",
    price_per_head_minor: 1200,
    allergens: ["Dairy"],
    dietary_tags: ["Vegetarian"],
    is_active: true,
    sort_order: 0,
  },
  {
    id: "item-2",
    name: "Ham hock terrine",
    course: "Starter",
    description: "Pressed ham hock, piccalilli.",
    price_per_head_minor: 1100,
    allergens: ["Mustard", "Gluten"],
    dietary_tags: [],
    is_active: true,
    sort_order: 1,
  },
  {
    id: "item-3",
    name: "Roast sirloin of beef",
    course: "Main",
    description: "28-day aged sirloin.",
    price_per_head_minor: 2800,
    allergens: [],
    dietary_tags: [],
    is_active: true,
    sort_order: 0,
  },
  {
    id: "item-4",
    name: "Squash & sage risotto",
    course: "Main",
    description: "Roast squash risotto.",
    price_per_head_minor: 2200,
    allergens: [],
    dietary_tags: ["Vegan", "Gluten-free"],
    is_active: true,
    sort_order: 1,
  },
  {
    id: "item-5",
    name: "Sticky toffee pudding",
    course: "Dessert",
    description: "Sticky toffee pudding.",
    price_per_head_minor: 1000,
    allergens: ["Gluten", "Dairy", "Egg"],
    dietary_tags: ["Vegetarian"],
    is_active: true,
    sort_order: 0,
  },
  {
    id: "item-inactive",
    name: "Archived soup",
    course: "Starter",
    description: "No longer served.",
    price_per_head_minor: 800,
    allergens: [],
    dietary_tags: [],
    is_active: false,
    sort_order: 99,
  },
];

const SELECTIONS: SelectionRow[] = [
  { id: "sel-1", menu_id: "menu-a", menu_item_id: "item-1", course: "Starter", sort_index: 1 },
  { id: "sel-2", menu_id: "menu-a", menu_item_id: "item-2", course: "Starter", sort_index: 2 },
  { id: "sel-3", menu_id: "menu-a", menu_item_id: "item-3", course: "Main", sort_index: 1 },
  { id: "sel-4", menu_id: "menu-a", menu_item_id: "item-5", course: "Dessert", sort_index: 1 },
];

// ---------------------------------------------------------------------------
// groupSelectionsByCourse
// ---------------------------------------------------------------------------

describe("groupSelectionsByCourse", () => {
  it("returns an empty object when selections is empty", () => {
    const result = groupSelectionsByCourse(ITEMS, []);
    expect(result).toEqual({});
  });

  it("returns an empty object when items is empty", () => {
    const result = groupSelectionsByCourse([], SELECTIONS);
    expect(result).toEqual({});
  });

  it("groups items by their course key", () => {
    const result = groupSelectionsByCourse(ITEMS, SELECTIONS);
    expect(Object.keys(result).sort()).toEqual(["Dessert", "Main", "Starter"]);
  });

  it("populates each group with the correct items", () => {
    const result = groupSelectionsByCourse(ITEMS, SELECTIONS);

    const starterNames = result["Starter"]!.map((g) => g.item.name);
    expect(starterNames).toContain("Heritage tomato & burrata");
    expect(starterNames).toContain("Ham hock terrine");

    const mainNames = result["Main"]!.map((g) => g.item.name);
    expect(mainNames).toContain("Roast sirloin of beef");
    expect(mainNames).not.toContain("Squash & sage risotto"); // item-4 not in selections

    const dessertNames = result["Dessert"]!.map((g) => g.item.name);
    expect(dessertNames).toContain("Sticky toffee pudding");
  });

  it("orders items within a course by sort_index ascending", () => {
    const selectionsReversed: SelectionRow[] = [
      { id: "sel-r1", menu_id: "menu-a", menu_item_id: "item-2", course: "Starter", sort_index: 10 },
      { id: "sel-r2", menu_id: "menu-a", menu_item_id: "item-1", course: "Starter", sort_index: 1 },
    ];
    const result = groupSelectionsByCourse(ITEMS, selectionsReversed);
    const starters = result["Starter"]!;
    expect(starters[0]!.item.id).toBe("item-1"); // sort_index 1 first
    expect(starters[1]!.item.id).toBe("item-2"); // sort_index 10 second
  });

  it("attaches sort_index from the selection to each group entry", () => {
    const result = groupSelectionsByCourse(ITEMS, SELECTIONS);
    const starters = result["Starter"]!;
    const entry1 = starters.find((g) => g.item.id === "item-1");
    const entry2 = starters.find((g) => g.item.id === "item-2");
    expect(entry1?.sort_index).toBe(1);
    expect(entry2?.sort_index).toBe(2);
  });

  it("skips selections whose menu_item_id does not match any item", () => {
    const withOrphan: SelectionRow[] = [
      ...SELECTIONS,
      { id: "sel-orphan", menu_id: "menu-a", menu_item_id: "item-nonexistent", course: "Starter", sort_index: 99 },
    ];
    const result = groupSelectionsByCourse(ITEMS, withOrphan);
    const starterIds = result["Starter"]!.map((g) => g.item.id);
    expect(starterIds).not.toContain("item-nonexistent");
  });

  it("uses the course value from the selection row (not from the item)", () => {
    // A selection that overrides the course (e.g. 'Evening' override for an
    // item whose item.course is 'Starter').
    const overrideSelections: SelectionRow[] = [
      { id: "sel-ov1", menu_id: "menu-a", menu_item_id: "item-1", course: "Evening", sort_index: 1 },
    ];
    const result = groupSelectionsByCourse(ITEMS, overrideSelections);
    // Should be grouped under "Evening", not "Starter"
    expect(result["Evening"]).toBeDefined();
    expect(result["Starter"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateMenuComposition
// ---------------------------------------------------------------------------

describe("validateMenuComposition", () => {
  it("returns valid=true when every selection has a matching active item", () => {
    const result = validateMenuComposition(ITEMS, SELECTIONS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid=true for an empty composition (no selections)", () => {
    const result = validateMenuComposition(ITEMS, []);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns an error when a selection references an inactive item", () => {
    const selectionsWithInactive: SelectionRow[] = [
      ...SELECTIONS,
      { id: "sel-bad", menu_id: "menu-a", menu_item_id: "item-inactive", course: "Starter", sort_index: 99 },
    ];
    const result = validateMenuComposition(ITEMS, selectionsWithInactive);
    expect(result.valid).toBe(false);
    const archivedError = result.errors.find((e) => e.type === "inactive_item");
    expect(archivedError).toBeDefined();
    expect(archivedError?.menuItemId).toBe("item-inactive");
  });

  it("returns an error when a selection references an item that does not exist in the library", () => {
    const selectionsWithMissing: SelectionRow[] = [
      ...SELECTIONS,
      { id: "sel-missing", menu_id: "menu-a", menu_item_id: "item-deleted", course: "Main", sort_index: 99 },
    ];
    const result = validateMenuComposition(ITEMS, selectionsWithMissing);
    expect(result.valid).toBe(false);
    const missingError = result.errors.find((e) => e.type === "missing_item");
    expect(missingError).toBeDefined();
    expect(missingError?.menuItemId).toBe("item-deleted");
  });

  it("returns multiple errors when several selections are problematic", () => {
    const badSelections: SelectionRow[] = [
      { id: "sel-bad1", menu_id: "menu-a", menu_item_id: "item-inactive", course: "Starter", sort_index: 1 },
      { id: "sel-bad2", menu_id: "menu-a", menu_item_id: "item-deleted", course: "Main", sort_index: 2 },
    ];
    const result = validateMenuComposition(ITEMS, badSelections);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it("carries the item name in the error when the item exists but is inactive", () => {
    const selectionsWithInactive: SelectionRow[] = [
      { id: "sel-bad", menu_id: "menu-a", menu_item_id: "item-inactive", course: "Starter", sort_index: 1 },
    ];
    const result = validateMenuComposition(ITEMS, selectionsWithInactive);
    const err = result.errors[0];
    expect(err?.itemName).toBe("Archived soup");
  });

  it("carries null itemName in the error when the item is completely missing from the library", () => {
    const selectionsWithMissing: SelectionRow[] = [
      { id: "sel-missing", menu_id: "menu-a", menu_item_id: "item-deleted", course: "Main", sort_index: 1 },
    ];
    const result = validateMenuComposition(ITEMS, selectionsWithMissing);
    const err = result.errors[0];
    expect(err?.itemName).toBeNull();
  });
});
