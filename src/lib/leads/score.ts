/**
 * Lead score (0–100) — a heuristic upgrade of the binary quiet-lead rule, used
 * to prioritise the contacts list. Pure + deterministic (pass `now` for tests).
 *
 * Weights (sum to 100): budget 30 · date-set+proximity 25 · guest count 15 ·
 * contactable (email/phone) 15 · freshness 15. A booked contact scores 100.
 */

export interface ScorableLead {
  email: string | null;
  phone: string | null;
  wedding_date: string | null;
  guest_count: number | null;
  budget_minor: number | null;
  created_at: string;
  status: "lead" | "booked";
}

const DAY = 86_400_000;
const BUDGET_FULL_MINOR = 2_000_000; // £20,000 → full budget points

function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);
}
function daysUntil(iso: string, now: Date): number {
  return Math.floor((new Date(iso).getTime() - now.getTime()) / DAY);
}

export function scoreLead(c: ScorableLead, now = new Date()): number {
  if (c.status === "booked") return 100;

  let score = 0;

  // Budget (0–30)
  if (c.budget_minor != null && c.budget_minor > 0) {
    score += Math.min(30, Math.round((c.budget_minor / BUDGET_FULL_MINOR) * 30));
  }

  // Wedding date set (+15) and within the next year (+10)
  if (c.wedding_date) {
    score += 15;
    const until = daysUntil(c.wedding_date, now);
    if (until >= 0 && until <= 365) score += 10;
  }

  // Guest count (0–15), 100+ guests = full
  if (c.guest_count != null && c.guest_count > 0) {
    score += Math.min(15, Math.round((c.guest_count / 100) * 15));
  }

  // Contactable (0–15)
  if (c.email) score += 8;
  if (c.phone) score += 7;

  // Freshness (0–15)
  const age = daysSince(c.created_at, now);
  if (age <= 7) score += 15;
  else if (age <= 30) score += 10;
  else if (age <= 90) score += 5;

  return Math.max(0, Math.min(100, score));
}
