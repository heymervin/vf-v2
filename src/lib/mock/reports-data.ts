/**
 * VenueFlow — PROTOTYPE mock data: Reports support layer.
 *
 * The `REPORTS` object itself lives in `./index` (its top-level keys —
 * funnel / sourceRoi / revenueByMonth / kpis — must stay intact for existing
 * consumers, so the v2 keys were added there inline). This file adds the
 * benchmark thresholds and the typed period selector that downstream Reports
 * components rely on. Additive.
 */

import { REPORTS } from "./index";

// ---------------------------------------------------------------------------
// Benchmarks — good / watch thresholds (below watch is "needs attention")
// ---------------------------------------------------------------------------

export const BENCHMARKS = {
  conversion: { good: 25, watch: 15 },
  firstResponseMins: { good: 5, watch: 30 },
  onTimePayments: { good: 95, watch: 85 },
  utilisation: { good: 75, watch: 50 },
} as const;

// ---------------------------------------------------------------------------
// Period selector
// ---------------------------------------------------------------------------

export type ReportPeriod = "this_month" | "quarter" | "ytd" | "last_12m";

export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "ytd", label: "Year to date" },
  { value: "last_12m", label: "Last 12 months" },
];

/** Resolve a period's snapshot from `REPORTS.periods` (defaults to YTD). */
export function getReportPeriod(period: ReportPeriod = "ytd") {
  return REPORTS.periods[period] ?? REPORTS.periods.ytd;
}
