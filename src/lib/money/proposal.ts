/**
 * Pure money helpers for Slice 5 — proposals and payment milestones.
 *
 * ALL amounts are in integer minor units (pence / SD-7).
 * Format to £ only in the UI via formatMinor().
 *
 * No DB, no server-only imports. Safe to import from both server and client
 * modules (unlike actions.ts "use server" files).
 */

// ---------------------------------------------------------------------------
// Types (mirrored from types.ts rows — kept local to avoid circular deps)
// ---------------------------------------------------------------------------

export interface LineItem {
  /** Quantity (e.g. number of guests). */
  qty: number;
  /** Per-unit price in minor units (pence). */
  unit_minor: number;
  /** Optional per-line-item discount percentage (0–100). */
  discount_pct?: number | null;
}

export interface Discount {
  /**
   * "percentage" → discount_value_minor is treated as basis points * 100
   *   (i.e. a whole-number percentage, e.g. 10 = 10%).
   * "fixed"      → discount_value_minor is a flat pence deduction.
   * null / undefined → no discount.
   */
  discount_type?: "percentage" | "fixed" | null;
  /** The discount value: a percentage integer (0–100) or pence amount. */
  discount_value_minor?: number | null;
}

export interface ProposalTotals {
  /** Sum of all line-item totals, before proposal-level discount. */
  subtotalMinor: number;
  /** The proposal-level discount in minor units (already clamped ≥ 0). */
  discountMinor: number;
  /** subtotalMinor − discountMinor, clamped to ≥ 0. */
  totalMinor: number;
}

export type MilestoneStatusLabel =
  | "awaiting_deposit"
  | "deposit_paid"
  | "balance_due"
  | "paid_in_full";

// ---------------------------------------------------------------------------
// computeProposalTotals
// ---------------------------------------------------------------------------

/**
 * Compute subtotal, discount, and total for a proposal.
 *
 * Line-item-level discounts (discount_pct) reduce each line before summing.
 * The proposal-level discount (Discount) is then applied to the subtotal.
 *
 * Rounding: Math.round at every multiplication to avoid floating-point drift.
 * All results are clamped to ≥ 0 (a discount larger than the subtotal floors
 * at 0, not negative).
 */
export function computeProposalTotals(
  lineItems: LineItem[],
  discount?: Discount | null,
): ProposalTotals {
  // 1. Sum line totals (qty × unit_minor), applying per-line discount_pct.
  const subtotalMinor = lineItems.reduce((sum, item) => {
    const qty = Math.max(0, Math.round(item.qty));
    const unit = Math.max(0, Math.round(item.unit_minor));
    const lineTotal = qty * unit;

    // Per-line percentage discount (clamped 0–100).
    const pct = item.discount_pct ?? 0;
    const clampedPct = Math.min(100, Math.max(0, pct));
    const lineDiscount = Math.round(lineTotal * (clampedPct / 100));

    return sum + (lineTotal - lineDiscount);
  }, 0);

  // 2. Proposal-level discount.
  let discountMinor = 0;

  if (discount?.discount_type === "percentage") {
    const pct = discount.discount_value_minor ?? 0;
    const clampedPct = Math.min(100, Math.max(0, pct));
    discountMinor = Math.round(subtotalMinor * (clampedPct / 100));
  } else if (discount?.discount_type === "fixed") {
    discountMinor = Math.max(0, Math.round(discount.discount_value_minor ?? 0));
  }

  // Clamp: discount cannot exceed the subtotal.
  discountMinor = Math.min(discountMinor, subtotalMinor);

  const totalMinor = Math.max(0, subtotalMinor - discountMinor);

  return { subtotalMinor, discountMinor, totalMinor };
}

// ---------------------------------------------------------------------------
// milestoneStatus
// ---------------------------------------------------------------------------

/**
 * Derive the payment-progress label for a single wedding across all its
 * milestones.
 *
 * Logic (matches the four Slice-5 UI statuses):
 *   - "paid_in_full"    → paidMinor >= totalMinor (and totalMinor > 0)
 *   - "deposit_paid"    → paidMinor >= depositMinor AND paidMinor < totalMinor
 *   - "balance_due"     → any milestone is past due_date and still unpaid
 *                         (i.e. milestone.status indicates overdue/due + not paid)
 *   - "awaiting_deposit"→ nothing paid yet (paidMinor === 0)
 *
 * The caller passes a single representative milestone row (usually the first
 * unpaid one) plus the total paidMinor for the wedding. For the simpler
 * single-milestone variant, pass the milestone's own amount_minor as the
 * total and 0 or amount_minor as paidMinor.
 *
 * @param milestone  - a payment_milestones row (amount_minor, status string)
 * @param paidMinor  - total already paid toward this wedding in minor units
 */
export function milestoneStatus(
  milestone: { amount_minor: number; status: string },
  paidMinor: number,
): MilestoneStatusLabel {
  const totalMinor = Math.max(0, milestone.amount_minor);
  const paid = Math.max(0, paidMinor);

  // Fully paid
  if (totalMinor > 0 && paid >= totalMinor) {
    return "paid_in_full";
  }

  // Nothing paid yet
  if (paid === 0) {
    return "awaiting_deposit";
  }

  // Something paid — are we overdue on the remainder?
  const overdueStatuses = new Set(["overdue", "due"]);
  if (overdueStatuses.has(milestone.status)) {
    return "balance_due";
  }

  // Partial payment, not yet overdue
  return "deposit_paid";
}

// ---------------------------------------------------------------------------
// formatMinor
// ---------------------------------------------------------------------------

/**
 * Format an integer minor-unit (pence) amount as a GBP string.
 *
 * Examples:
 *   formatMinor(123400)  → "£1,234.00"
 *   formatMinor(50)      → "£0.50"
 *   formatMinor(0)       → "£0.00"
 *   formatMinor(-100)    → "-£1.00"
 *
 * Uses Intl.NumberFormat for locale-correct thousand-separators.
 */
export function formatMinor(minor: number): string {
  const abs = Math.abs(minor);
  const pounds = abs / 100;
  const formatted = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pounds);
  return minor < 0 ? `-£${formatted}` : `£${formatted}`;
}
