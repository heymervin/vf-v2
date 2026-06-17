/**
 * Unit tests for src/lib/money/proposal.ts
 *
 * Covers (no DB, no server imports — pure function assertions):
 *   computeProposalTotals  — subtotal, percentage/fixed discount, edge cases
 *   milestoneStatus        — all four status labels, boundary conditions
 *   formatMinor            — GBP string formatting, zero, negatives, rounding
 */

import { describe, it, expect } from "vitest";
import {
  computeProposalTotals,
  milestoneStatus,
  formatMinor,
  type LineItem,
  type Discount,
} from "./proposal";

// ─────────────────────────────────────────────────────────────────────────────
// computeProposalTotals
// ─────────────────────────────────────────────────────────────────────────────

describe("computeProposalTotals", () => {
  // ── baseline ───────────────────────────────────────────────────────────────

  it("returns zero totals for an empty line-item array with no discount", () => {
    const result = computeProposalTotals([]);
    expect(result).toEqual({ subtotalMinor: 0, discountMinor: 0, totalMinor: 0 });
  });

  it("sums a single line item correctly", () => {
    const items: LineItem[] = [{ qty: 2, unit_minor: 500 }];
    const result = computeProposalTotals(items);
    expect(result.subtotalMinor).toBe(1000);
    expect(result.discountMinor).toBe(0);
    expect(result.totalMinor).toBe(1000);
  });

  it("sums multiple line items", () => {
    const items: LineItem[] = [
      { qty: 100, unit_minor: 5000 }, // 500 000 p
      { qty: 1,   unit_minor: 25000 }, //  25 000 p
    ];
    const result = computeProposalTotals(items);
    expect(result.subtotalMinor).toBe(525_000);
    expect(result.totalMinor).toBe(525_000);
  });

  // ── per-line discount_pct ──────────────────────────────────────────────────

  it("applies per-line discount_pct before summing", () => {
    // 10 × 1000 p = 10 000 p, then 10% off = 9 000 p
    const items: LineItem[] = [{ qty: 10, unit_minor: 1000, discount_pct: 10 }];
    const result = computeProposalTotals(items);
    expect(result.subtotalMinor).toBe(9_000);
  });

  it("treats null discount_pct as zero", () => {
    const items: LineItem[] = [{ qty: 5, unit_minor: 200, discount_pct: null }];
    const result = computeProposalTotals(items);
    expect(result.subtotalMinor).toBe(1_000);
  });

  it("clamps per-line discount_pct above 100 to 100 (free item)", () => {
    const items: LineItem[] = [{ qty: 3, unit_minor: 1000, discount_pct: 150 }];
    const result = computeProposalTotals(items);
    expect(result.subtotalMinor).toBe(0);
  });

  it("clamps per-line discount_pct below 0 to 0 (no negative discount)", () => {
    const items: LineItem[] = [{ qty: 2, unit_minor: 1000, discount_pct: -10 }];
    const result = computeProposalTotals(items);
    // discount clamped to 0 → full line total
    expect(result.subtotalMinor).toBe(2_000);
  });

  // ── proposal-level percentage discount ────────────────────────────────────

  it("applies a percentage proposal-level discount", () => {
    const items: LineItem[] = [{ qty: 1, unit_minor: 10_000 }];
    const discount: Discount = { discount_type: "percentage", discount_value_minor: 10 };
    const result = computeProposalTotals(items, discount);
    expect(result.subtotalMinor).toBe(10_000);
    expect(result.discountMinor).toBe(1_000); // 10%
    expect(result.totalMinor).toBe(9_000);
  });

  it("applies a 0% proposal-level percentage discount (no change)", () => {
    const items: LineItem[] = [{ qty: 1, unit_minor: 10_000 }];
    const discount: Discount = { discount_type: "percentage", discount_value_minor: 0 };
    const result = computeProposalTotals(items, discount);
    expect(result.discountMinor).toBe(0);
    expect(result.totalMinor).toBe(10_000);
  });

  it("clamps proposal-level percentage > 100 to 100 (free)", () => {
    const items: LineItem[] = [{ qty: 1, unit_minor: 5_000 }];
    const discount: Discount = { discount_type: "percentage", discount_value_minor: 200 };
    const result = computeProposalTotals(items, discount);
    expect(result.discountMinor).toBe(5_000);
    expect(result.totalMinor).toBe(0);
  });

  // ── proposal-level fixed discount ─────────────────────────────────────────

  it("applies a fixed proposal-level discount", () => {
    const items: LineItem[] = [{ qty: 1, unit_minor: 50_000 }];
    const discount: Discount = { discount_type: "fixed", discount_value_minor: 5_000 };
    const result = computeProposalTotals(items, discount);
    expect(result.discountMinor).toBe(5_000);
    expect(result.totalMinor).toBe(45_000);
  });

  it("clamps fixed discount larger than subtotal to subtotal (total = 0)", () => {
    const items: LineItem[] = [{ qty: 1, unit_minor: 1_000 }];
    const discount: Discount = { discount_type: "fixed", discount_value_minor: 9_999 };
    const result = computeProposalTotals(items, discount);
    // discount is clamped to subtotal
    expect(result.discountMinor).toBe(1_000);
    expect(result.totalMinor).toBe(0);
  });

  it("ignores a null/undefined discount_type (no discount applied)", () => {
    const items: LineItem[] = [{ qty: 1, unit_minor: 3_000 }];
    const discount: Discount = { discount_type: null, discount_value_minor: 500 };
    const result = computeProposalTotals(items, discount);
    expect(result.discountMinor).toBe(0);
    expect(result.totalMinor).toBe(3_000);
  });

  it("handles undefined discount argument gracefully", () => {
    const items: LineItem[] = [{ qty: 2, unit_minor: 1_000 }];
    const result = computeProposalTotals(items, undefined);
    expect(result.discountMinor).toBe(0);
    expect(result.totalMinor).toBe(2_000);
  });

  it("handles null discount argument gracefully", () => {
    const items: LineItem[] = [{ qty: 2, unit_minor: 1_000 }];
    const result = computeProposalTotals(items, null);
    expect(result.discountMinor).toBe(0);
    expect(result.totalMinor).toBe(2_000);
  });

  // ── rounding ───────────────────────────────────────────────────────────────

  it("rounds per-line discount to nearest pence (no fractional pence)", () => {
    // 10 000 × 33.333% would be 3333.3 — should round to 3333
    const items: LineItem[] = [{ qty: 1, unit_minor: 10_000, discount_pct: 33.333 }];
    const result = computeProposalTotals(items);
    // Math.round(10_000 * 0.33333) = Math.round(3333.3) = 3333
    expect(result.subtotalMinor).toBe(6_667);
  });

  it("rounds proposal-level percentage discount to nearest pence", () => {
    // 100 × 3% = 3 (already integer; use awkward value: 333 × 33.333%)
    const items: LineItem[] = [{ qty: 1, unit_minor: 333 }];
    const discount: Discount = { discount_type: "percentage", discount_value_minor: 33 };
    const result = computeProposalTotals(items, discount);
    // Math.round(333 * 0.33) = Math.round(109.89) = 110
    expect(result.discountMinor).toBe(110);
    expect(result.totalMinor).toBe(223);
  });

  // ── combined line + proposal discounts ────────────────────────────────────

  it("applies both per-line and proposal-level discounts in the correct order", () => {
    // Line: 10 × 2 000 p = 20 000 p, 10% per-line → 18 000 p subtotal
    // Proposal: 5% off subtotal → 18 000 × 0.05 = 900 → total = 17 100
    const items: LineItem[] = [{ qty: 10, unit_minor: 2_000, discount_pct: 10 }];
    const discount: Discount = { discount_type: "percentage", discount_value_minor: 5 };
    const result = computeProposalTotals(items, discount);
    expect(result.subtotalMinor).toBe(18_000);
    expect(result.discountMinor).toBe(900);
    expect(result.totalMinor).toBe(17_100);
  });

  // ── zero-value items ───────────────────────────────────────────────────────

  it("handles zero-priced items without error", () => {
    const items: LineItem[] = [
      { qty: 100, unit_minor: 0 },
      { qty: 0, unit_minor: 5_000 },
    ];
    const result = computeProposalTotals(items);
    expect(result.subtotalMinor).toBe(0);
    expect(result.totalMinor).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// milestoneStatus
// ─────────────────────────────────────────────────────────────────────────────

describe("milestoneStatus", () => {
  // ── awaiting_deposit ────────────────────────────────────────────────────────

  it("returns awaiting_deposit when paidMinor is 0", () => {
    const milestone = { amount_minor: 10_000, status: "upcoming" };
    expect(milestoneStatus(milestone, 0)).toBe("awaiting_deposit");
  });

  it("returns awaiting_deposit when paidMinor is 0 and milestone is overdue", () => {
    const milestone = { amount_minor: 10_000, status: "overdue" };
    expect(milestoneStatus(milestone, 0)).toBe("awaiting_deposit");
  });

  // ── paid_in_full ────────────────────────────────────────────────────────────

  it("returns paid_in_full when paidMinor equals amount_minor", () => {
    const milestone = { amount_minor: 50_000, status: "paid" };
    expect(milestoneStatus(milestone, 50_000)).toBe("paid_in_full");
  });

  it("returns paid_in_full when paidMinor exceeds amount_minor (overpayment)", () => {
    const milestone = { amount_minor: 50_000, status: "paid" };
    expect(milestoneStatus(milestone, 55_000)).toBe("paid_in_full");
  });

  // ── balance_due ─────────────────────────────────────────────────────────────

  it("returns balance_due when partial payment exists and status is overdue", () => {
    const milestone = { amount_minor: 20_000, status: "overdue" };
    expect(milestoneStatus(milestone, 5_000)).toBe("balance_due");
  });

  it("returns balance_due when partial payment exists and status is due", () => {
    const milestone = { amount_minor: 20_000, status: "due" };
    expect(milestoneStatus(milestone, 10_000)).toBe("balance_due");
  });

  // ── deposit_paid ────────────────────────────────────────────────────────────

  it("returns deposit_paid when partial payment exists and no overdue status", () => {
    const milestone = { amount_minor: 20_000, status: "upcoming" };
    expect(milestoneStatus(milestone, 5_000)).toBe("deposit_paid");
  });

  it("returns deposit_paid when paid just one pence short of full and not overdue", () => {
    const milestone = { amount_minor: 10_000, status: "upcoming" };
    expect(milestoneStatus(milestone, 9_999)).toBe("deposit_paid");
  });

  // ── edge cases ──────────────────────────────────────────────────────────────

  it("returns awaiting_deposit for a zero-amount milestone with zero paid", () => {
    // amount_minor = 0 means totalMinor = 0 → cannot be paid_in_full (guard)
    const milestone = { amount_minor: 0, status: "upcoming" };
    // paidMinor = 0 → awaiting_deposit path hits first
    expect(milestoneStatus(milestone, 0)).toBe("awaiting_deposit");
  });

  it("handles unknown/custom status strings as non-overdue (deposit_paid if partial)", () => {
    const milestone = { amount_minor: 10_000, status: "pending_review" };
    expect(milestoneStatus(milestone, 3_000)).toBe("deposit_paid");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatMinor
// ─────────────────────────────────────────────────────────────────────────────

describe("formatMinor", () => {
  it("formats zero as £0.00", () => {
    expect(formatMinor(0)).toBe("£0.00");
  });

  it("formats 50p as £0.50", () => {
    expect(formatMinor(50)).toBe("£0.50");
  });

  it("formats 100p as £1.00", () => {
    expect(formatMinor(100)).toBe("£1.00");
  });

  it("formats 123400p as £1,234.00", () => {
    expect(formatMinor(123_400)).toBe("£1,234.00");
  });

  it("formats 100000p as £1,000.00 (thousand separator)", () => {
    expect(formatMinor(100_000)).toBe("£1,000.00");
  });

  it("formats large amounts with thousand separators", () => {
    // £12,500.50
    expect(formatMinor(1_250_050)).toBe("£12,500.50");
  });

  it("formats negative amounts with leading minus and £ symbol", () => {
    expect(formatMinor(-100)).toBe("-£1.00");
  });

  it("formats negative zero as £0.00 (no minus sign)", () => {
    expect(formatMinor(-0)).toBe("£0.00");
  });

  it("always shows two decimal places", () => {
    // 1p → £0.01
    expect(formatMinor(1)).toBe("£0.01");
    // 10p → £0.10
    expect(formatMinor(10)).toBe("£0.10");
  });
});
