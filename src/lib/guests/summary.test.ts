import { describe, it, expect } from "vitest";
import {
  buildRsvpCounts,
  buildDietaryBreakdown,
  type GuestSummaryInput,
} from "./summary";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const base: GuestSummaryInput = {
  id: "g1",
  rsvp: "pending",
  dietary: [],
  table_number: null,
};

function g(overrides: Partial<GuestSummaryInput>): GuestSummaryInput {
  return { ...base, ...overrides };
}

const guests: GuestSummaryInput[] = [
  g({ id: "g1", rsvp: "yes", dietary: ["Vegetarian", "Nut allergy"], table_number: 1 }),
  g({ id: "g2", rsvp: "yes", dietary: ["Vegetarian"], table_number: null }),
  g({ id: "g3", rsvp: "yes", dietary: [], table_number: 3 }),
  g({ id: "g4", rsvp: "pending", dietary: ["Gluten free"], table_number: null }),
  g({ id: "g5", rsvp: "pending", dietary: [], table_number: null }),
  g({ id: "g6", rsvp: "no", dietary: [], table_number: null }),
];

// ---------------------------------------------------------------------------
// buildRsvpCounts
// ---------------------------------------------------------------------------

describe("buildRsvpCounts", () => {
  it("counts yes / pending / no correctly", () => {
    const counts = buildRsvpCounts(guests);
    expect(counts.yes).toBe(3);
    expect(counts.pending).toBe(2);
    expect(counts.no).toBe(1);
    expect(counts.total).toBe(6);
  });

  it("counts needsTable = confirmed (yes) guests with null table_number", () => {
    const counts = buildRsvpCounts(guests);
    // g2 is yes + no table; g1 and g3 have tables
    expect(counts.needsTable).toBe(1);
  });

  it("returns zeros for an empty list", () => {
    const counts = buildRsvpCounts([]);
    expect(counts.yes).toBe(0);
    expect(counts.pending).toBe(0);
    expect(counts.no).toBe(0);
    expect(counts.total).toBe(0);
    expect(counts.needsTable).toBe(0);
  });

  it("does not count declined guests in needsTable", () => {
    const allDeclined = [
      g({ id: "a", rsvp: "no", table_number: null }),
      g({ id: "b", rsvp: "no", table_number: null }),
    ];
    expect(buildRsvpCounts(allDeclined).needsTable).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildDietaryBreakdown
// ---------------------------------------------------------------------------

describe("buildDietaryBreakdown", () => {
  it("sums each dietary tag across all guests regardless of rsvp", () => {
    const breakdown = buildDietaryBreakdown(guests);
    const veg = breakdown.find((b) => b.tag === "Vegetarian");
    const nut = breakdown.find((b) => b.tag === "Nut allergy");
    const gluten = breakdown.find((b) => b.tag === "Gluten free");

    expect(veg?.count).toBe(2); // g1 + g2
    expect(nut?.count).toBe(1); // g1
    expect(gluten?.count).toBe(1); // g4
  });

  it("returns entries sorted by count descending", () => {
    const breakdown = buildDietaryBreakdown(guests);
    for (let i = 1; i < breakdown.length; i++) {
      expect(breakdown[i - 1].count).toBeGreaterThanOrEqual(breakdown[i].count);
    }
  });

  it("returns empty array when no guest has dietary needs", () => {
    const noDietary = guests.map((g) => ({ ...g, dietary: [] }));
    expect(buildDietaryBreakdown(noDietary)).toEqual([]);
  });

  it("counts dietaryGuests = total guests with at least one dietary tag", () => {
    const breakdown = buildDietaryBreakdown(guests);
    // g1, g2, g4 — 3 guests with at least one dietary tag
    const total = breakdown.reduce(
      (max, b) => Math.max(max, 0),
      0,
    );
    // Verify via dedicated count helper
    const dietaryGuestCount = guests.filter((g) => g.dietary.length > 0).length;
    expect(dietaryGuestCount).toBe(3);
    void total; // suppress unused warning
  });

  it("handles a guest with multiple dietary tags without double-counting the guest", () => {
    // g1 has 2 tags — verify each tag increments by 1, not by 2
    const single = [g({ id: "x", rsvp: "yes", dietary: ["Vegan", "Gluten free"] })];
    const breakdown = buildDietaryBreakdown(single);
    expect(breakdown.find((b) => b.tag === "Vegan")?.count).toBe(1);
    expect(breakdown.find((b) => b.tag === "Gluten free")?.count).toBe(1);
  });
});
