/**
 * Pure helpers for computing guest summary stats and dietary rollup.
 * No DB access — takes plain arrays and returns derived values.
 * Tested in summary.test.ts.
 */

// ---------------------------------------------------------------------------
// Input type — minimal slice of wedding_guests the helpers need
// ---------------------------------------------------------------------------

export interface GuestSummaryInput {
  id: string;
  rsvp: string; // "yes" | "no" | "pending"
  dietary: string[];
  table_number: number | null;
}

// ---------------------------------------------------------------------------
// RSVP counts
// ---------------------------------------------------------------------------

export interface RsvpCounts {
  total: number;
  yes: number;
  pending: number;
  no: number;
  /** Confirmed (rsvp = "yes") guests with no table assigned */
  needsTable: number;
}

export function buildRsvpCounts(guests: GuestSummaryInput[]): RsvpCounts {
  let yes = 0;
  let pending = 0;
  let no = 0;
  let needsTable = 0;

  for (const g of guests) {
    if (g.rsvp === "yes") {
      yes++;
      if (g.table_number === null) needsTable++;
    } else if (g.rsvp === "pending") {
      pending++;
    } else {
      no++;
    }
  }

  return { total: guests.length, yes, pending, no, needsTable };
}

// ---------------------------------------------------------------------------
// Dietary breakdown
// ---------------------------------------------------------------------------

export interface DietaryBreakdownEntry {
  tag: string;
  count: number;
}

/**
 * Count how many guests carry each dietary tag.
 * A guest with two dietary tags contributes 1 to each tag count.
 * Returns entries sorted by count descending.
 */
export function buildDietaryBreakdown(
  guests: GuestSummaryInput[],
): DietaryBreakdownEntry[] {
  const counts = new Map<string, number>();

  for (const g of guests) {
    for (const tag of g.dietary) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
