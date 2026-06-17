/**
 * Unit tests for src/lib/menu/allergens.ts
 *
 * All tests are DB-free and secret-free — pure function tests with mock data.
 * Covers the denominator rule from spec §5 + demo comment L78-80:
 *   pct = count / totalGuests (unique guests), NOT total selections.
 */

import { describe, it, expect } from "vitest";
import {
  buildAllergenRollup,
  type SelectedDishSummary,
} from "./allergens";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DISHES: SelectedDishSummary[] = [
  // Starter: burrata — 64 guests picked it, contains Dairy
  { allergens: ["Dairy"], chosenBy: 64 },
  // Starter: ham hock — 56 guests, contains Mustard + Gluten
  { allergens: ["Mustard", "Gluten"], chosenBy: 56 },
  // Main: sirloin — 80 guests, no allergens
  { allergens: [], chosenBy: 80 },
  // Main: risotto — 40 guests, no allergens (vegan/gf)
  { allergens: [], chosenBy: 40 },
  // Dessert: sticky toffee — 120 guests, contains Gluten + Dairy + Egg
  { allergens: ["Gluten", "Dairy", "Egg"], chosenBy: 120 },
];

const TOTAL_GUESTS = 120;

// ---------------------------------------------------------------------------
// buildAllergenRollup
// ---------------------------------------------------------------------------

describe("buildAllergenRollup", () => {
  it("returns an empty array when given no dishes", () => {
    const result = buildAllergenRollup([], TOTAL_GUESTS);
    expect(result).toEqual([]);
  });

  it("returns an empty array when dishes have no allergens", () => {
    const noAllergenDishes: SelectedDishSummary[] = [
      { allergens: [], chosenBy: 50 },
      { allergens: [], chosenBy: 30 },
    ];
    const result = buildAllergenRollup(noAllergenDishes, TOTAL_GUESTS);
    expect(result).toEqual([]);
  });

  it("aggregates chosenBy counts per allergen across all dishes", () => {
    const result = buildAllergenRollup(DISHES, TOTAL_GUESTS);

    // Dairy: burrata 64 + sticky toffee 120 = 184
    const dairy = result.find((e) => e.allergen === "Dairy");
    expect(dairy?.count).toBe(184);

    // Gluten: ham hock 56 + sticky toffee 120 = 176
    const gluten = result.find((e) => e.allergen === "Gluten");
    expect(gluten?.count).toBe(176);

    // Mustard: ham hock 56 only
    const mustard = result.find((e) => e.allergen === "Mustard");
    expect(mustard?.count).toBe(56);

    // Egg: sticky toffee 120 only
    const egg = result.find((e) => e.allergen === "Egg");
    expect(egg?.count).toBe(120);
  });

  it("computes pct using totalGuests as denominator (not total selections)", () => {
    const result = buildAllergenRollup(DISHES, TOTAL_GUESTS);

    // Dairy: 184 / 120 * 100 = 153% (count > totalGuests is valid — multiple dishes)
    const dairy = result.find((e) => e.allergen === "Dairy");
    expect(dairy?.pct).toBe(153);

    // Mustard: 56 / 120 * 100 = 47%
    const mustard = result.find((e) => e.allergen === "Mustard");
    expect(mustard?.pct).toBe(47);
  });

  it("returns pct = 0 when totalGuests is 0 (avoids division by zero)", () => {
    const result = buildAllergenRollup(DISHES, 0);
    for (const entry of result) {
      expect(entry.pct).toBe(0);
    }
  });

  it("sorts results descending by count", () => {
    const result = buildAllergenRollup(DISHES, TOTAL_GUESTS);
    const counts = result.map((e) => e.count);
    for (let i = 0; i < counts.length - 1; i++) {
      expect(counts[i]!).toBeGreaterThanOrEqual(counts[i + 1]!);
    }
  });

  it("handles a single dish with multiple allergens correctly", () => {
    const single: SelectedDishSummary[] = [
      { allergens: ["Gluten", "Dairy", "Egg"], chosenBy: 30 },
    ];
    const result = buildAllergenRollup(single, 100);
    expect(result).toHaveLength(3);
    for (const entry of result) {
      expect(entry.count).toBe(30);
      expect(entry.pct).toBe(30);
    }
  });

  it("includes all expected allergen keys", () => {
    const result = buildAllergenRollup(DISHES, TOTAL_GUESTS);
    const allergens = result.map((e) => e.allergen);
    expect(allergens).toContain("Dairy");
    expect(allergens).toContain("Gluten");
    expect(allergens).toContain("Mustard");
    expect(allergens).toContain("Egg");
  });
});
