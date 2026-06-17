/**
 * Pure allergen rollup for the per-wedding menu tool.
 *
 * Operates on in-memory data matching the real Supabase row shapes —
 * no DB calls, safe to test without mocks.
 *
 * The denominator rule (from spec §5 + demo comment L78-80):
 *   count = total guest-choice instances for this allergen across all chosen items
 *   pct   = count / totalGuests (unique guest count), NOT total selections
 *
 * A guest who picks two dishes that both contain Dairy counts once per allergen
 * per dish selection — the percentage tells the kitchen how many *guests* are
 * affected, not how many dish slots have that allergen.
 */

export interface AllergenRollupEntry {
  allergen: string;
  count: number;
  pct: number;
}

/**
 * One selected dish's contribution to the allergen rollup.
 * chosenBy = count of guests who picked this item.
 */
export interface SelectedDishSummary {
  allergens: string[];
  chosenBy: number;
}

/**
 * Build the allergen rollup from a flat list of selected dish summaries.
 *
 * For each dish:
 *   - For each allergen in the dish's allergen list:
 *     - Add dish.chosenBy to that allergen's running count
 *
 * Percentage is computed against totalGuests (unique guest count).
 * Result is sorted descending by count.
 */
export function buildAllergenRollup(
  dishes: SelectedDishSummary[],
  totalGuests: number,
): AllergenRollupEntry[] {
  const map = new Map<string, number>();

  for (const dish of dishes) {
    for (const allergen of dish.allergens) {
      map.set(allergen, (map.get(allergen) ?? 0) + dish.chosenBy);
    }
  }

  return Array.from(map.entries())
    .map(([allergen, count]) => ({
      allergen,
      count,
      pct:
        totalGuests === 0 ? 0 : Math.round((count / totalGuests) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}
