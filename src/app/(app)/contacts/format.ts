import { format, parseISO } from "date-fns";

/** "Anna Smith" — primary contact name; falls back to first name only. */
export function contactDisplayName(c: {
  first_name: string;
  last_name: string | null;
}): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

/** Date-only string ("2027-06-12") → "12 Jun 2027". Returns null when absent. */
export function formatWeddingDate(date: string | null): string | null {
  if (!date) return null;
  try {
    return format(parseISO(date), "d MMM yyyy");
  } catch {
    return date;
  }
}

/** Integer pence → "£12,500" (no decimals). Returns null when absent. */
export function formatBudget(budgetMinor: number | null): string | null {
  if (budgetMinor == null) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(budgetMinor / 100);
}

/** ISO timestamp → "12 Jun 2026, 14:30". */
export function formatDateTime(ts: string): string {
  return format(parseISO(ts), "d MMM yyyy, HH:mm");
}
