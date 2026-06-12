/**
 * Fractional ordering for kanban cards. A card's position in its column is a
 * numeric `sort_index`; to place a card between two neighbours we take the
 * midpoint, so a move only ever rewrites the one moved row (no reindexing).
 *
 * - top of column:    before = null → after - 1000
 * - bottom of column: after  = null → before + 1000
 * - between two:      midpoint(before, after)
 * - empty column:     1000
 */
export function sortIndexBetween(
  before: number | null,
  after: number | null,
): number {
  if (before == null && after == null) return 1000;
  if (before == null) return after! - 1000;
  if (after == null) return before + 1000;
  return (before + after) / 2;
}
