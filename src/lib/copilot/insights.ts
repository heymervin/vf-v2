/**
 * Pure insight-derivation logic for the (app) Copilot triage.
 *
 * The /copilot server component runs the RLS-scoped DB queries and passes the
 * resulting counts here. This module owns ZERO data access — it only decides
 * which signals are worth surfacing, how to phrase them, and the priority
 * order. Keeping it pure makes the ranking unit-testable without a database.
 */

export type InsightKind = "at_risk" | "action" | "nudge";

export interface Insight {
  /** Stable id — used as React key and as a test selector anchor. */
  id: string;
  kind: InsightKind;
  /** Numeric rank for ordering (lower = more urgent). */
  severity: number;
  title: string;
  /** Optional supporting subline. */
  signal?: string;
  count: number;
  /** Where the primary action navigates. */
  href: string;
}

/** Already-venue-scoped aggregates gathered by the server component. */
export interface InsightInput {
  overdueTaskCount: number;
  overduePaymentCount: number;
  duePaymentCount: number;
  imminentWeddingCount: number;
  stalePipelineCount: number;
  outstandingRsvpCount: number;
}

/** "1 thing" / "3 things" — pluralise a noun against a count. */
function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Build the ranked insight list from venue-scoped counts.
 * Returns [] when nothing needs attention (page shows the empty state).
 *
 * Ordering: ascending `severity`, which groups at_risk (0–9) before
 * action (10–19) before nudge (20–29).
 */
export function deriveInsights(input: InsightInput): Insight[] {
  const out: Insight[] = [];

  // ── at_risk: overdue payments are the single most urgent signal ──────────
  if (input.overduePaymentCount > 0) {
    out.push({
      id: "overdue-payments",
      kind: "at_risk",
      severity: 0,
      count: input.overduePaymentCount,
      title: `${plural(input.overduePaymentCount, "payment is", "payments are")} overdue`,
      signal: "Balances past their due date — chase before the wedding date.",
      href: "/money",
    });
  }

  if (input.overdueTaskCount > 0) {
    out.push({
      id: "overdue-tasks",
      kind: "at_risk",
      severity: 1,
      count: input.overdueTaskCount,
      title: `${plural(input.overdueTaskCount, "wedding task is", "wedding tasks are")} overdue`,
      signal: "Planning tasks past their due date across active weddings.",
      href: "/weddings",
    });
  }

  // ── action: time-sensitive but not yet failing ──────────────────────────
  if (input.duePaymentCount > 0) {
    out.push({
      id: "due-payments",
      kind: "action",
      severity: 10,
      count: input.duePaymentCount,
      title: `${plural(input.duePaymentCount, "payment is", "payments are")} due soon`,
      signal: "Upcoming balances reaching their due date.",
      href: "/money",
    });
  }

  if (input.imminentWeddingCount > 0) {
    out.push({
      id: "imminent-weddings",
      kind: "action",
      severity: 11,
      count: input.imminentWeddingCount,
      title: `${plural(input.imminentWeddingCount, "wedding is", "weddings are")} within 30 days`,
      signal: "Final-details window — confirm runsheet, numbers, and suppliers.",
      href: "/weddings",
    });
  }

  // ── nudge: housekeeping that keeps the pipeline and guest list healthy ───
  if (input.stalePipelineCount > 0) {
    out.push({
      id: "stale-pipeline",
      kind: "nudge",
      severity: 20,
      count: input.stalePipelineCount,
      title: `${plural(input.stalePipelineCount, "enquiry has", "enquiries have")} gone quiet`,
      signal: "No activity in 14+ days — a follow-up may revive the booking.",
      href: "/pipeline",
    });
  }

  if (input.outstandingRsvpCount > 0) {
    out.push({
      id: "outstanding-rsvps",
      kind: "nudge",
      severity: 21,
      count: input.outstandingRsvpCount,
      title: `${plural(input.outstandingRsvpCount, "guest is", "guests are")} still to RSVP`,
      signal: "Pending RSVPs across upcoming weddings — chase for final numbers.",
      href: "/weddings",
    });
  }

  return out.sort((a, b) => a.severity - b.severity);
}
