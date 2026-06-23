/**
 * Unit tests for src/lib/copilot/insights.ts
 *
 * All functions under test are pure — no DB, no env vars, no Next.js.
 * Tests verify:
 *   - Correct insight shape (id, kind, title, signal, priority, actionHref, weddingId)
 *   - Priority ordering (at_risk=1, action=2, nudge=3 quiet/4 runsheet)
 *   - Graceful handling of empty arrays
 *   - Deduplication of quiet leads by wedding_id
 *   - Correct formatting of dates and amounts
 *   - computeInsights() aggregates and sorts across all four rules
 */

import { describe, it, expect } from "vitest";
import {
  buildAtRiskInsights,
  buildOverdueMilestoneInsights,
  buildQuietLeadInsights,
  buildUpcomingRunSheetInsights,
  computeInsights,
  type AtRiskWeddingRow,
  type OverdueMilestoneRow,
  type QuietLeadRow,
  type UpcomingRunSheetRow,
  type AllInsightRows,
} from "./insights";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const AT_RISK_ROW: AtRiskWeddingRow = {
  id: "wed-1",
  couple_names: "Henderson & Carter",
  wedding_date: "2026-07-15",
  portal_last_seen_at: null,
};

const AT_RISK_ROW_WITH_SEEN: AtRiskWeddingRow = {
  id: "wed-2",
  couple_names: "Khan & Reid",
  wedding_date: "2026-08-01",
  portal_last_seen_at: "2026-06-01T10:00:00Z",
};

const OVERDUE_ROW: OverdueMilestoneRow = {
  id: "pm-1",
  wedding_id: "wed-1",
  label: "Interim payment (50%)",
  amount_minor: 925000, // £9,250
  due_date: "2026-06-10",
  couple_names: "Henderson & Carter",
};

const QUIET_LEAD_ROW: QuietLeadRow = {
  wedding_id: "wed-3",
  invited_at: "2026-06-01T09:00:00Z",
  couple_names: "Bennett & Walsh",
};

const QUIET_LEAD_ROW_SAME_WEDDING: QuietLeadRow = {
  wedding_id: "wed-3", // same wedding — should be deduped
  invited_at: "2026-06-01T09:05:00Z",
  couple_names: "Bennett & Walsh",
};

const RUN_SHEET_ROW: UpcomingRunSheetRow = {
  id: "te-1",
  wedding_id: "wed-4",
  title: "Ceremony — The Long Barn",
  starts_at_time: "13:00",
  couple_names: "Campbell & Evans",
  wedding_date: "2026-06-20",
};

const EMPTY_ROWS: AllInsightRows = {
  atRisk: [],
  overdueMilestones: [],
  quietLeads: [],
  upcomingRunSheet: [],
};

// ---------------------------------------------------------------------------
// Rule 1 — At-risk insights
// ---------------------------------------------------------------------------

describe("buildAtRiskInsights", () => {
  it("returns empty array on empty input", () => {
    expect(buildAtRiskInsights([])).toEqual([]);
  });

  it("returns one insight per row", () => {
    const result = buildAtRiskInsights([AT_RISK_ROW, AT_RISK_ROW_WITH_SEEN]);
    expect(result).toHaveLength(2);
  });

  it("produces an insight with kind 'at_risk'", () => {
    const [insight] = buildAtRiskInsights([AT_RISK_ROW]);
    expect(insight.kind).toBe("at_risk");
  });

  it("sets priority to 1", () => {
    const [insight] = buildAtRiskInsights([AT_RISK_ROW]);
    expect(insight.priority).toBe(1);
  });

  it("id is deterministic: 'at_risk-{weddingId}'", () => {
    const [insight] = buildAtRiskInsights([AT_RISK_ROW]);
    expect(insight.id).toBe("at_risk-wed-1");
  });

  it("title contains couple_names", () => {
    const [insight] = buildAtRiskInsights([AT_RISK_ROW]);
    expect(insight.title).toContain("Henderson & Carter");
  });

  it("signal shows 'never' when portal_last_seen_at is null", () => {
    const [insight] = buildAtRiskInsights([AT_RISK_ROW]);
    expect(insight.signal).toContain("never");
  });

  it("signal includes formatted wedding_date", () => {
    const [insight] = buildAtRiskInsights([AT_RISK_ROW]);
    // 2026-07-15 → "15 Jul 2026" in en-GB
    expect(insight.signal).toContain("15 Jul 2026");
  });

  it("signal includes formatted portal_last_seen_at when present", () => {
    const [insight] = buildAtRiskInsights([AT_RISK_ROW_WITH_SEEN]);
    expect(insight.signal).toContain("1 Jun 2026");
    expect(insight.signal).not.toContain("never");
  });

  it("actionHref points to /weddings/{id}", () => {
    const [insight] = buildAtRiskInsights([AT_RISK_ROW]);
    expect(insight.actionHref).toBe("/weddings/wed-1");
  });

  it("weddingId matches row.id", () => {
    const [insight] = buildAtRiskInsights([AT_RISK_ROW]);
    expect(insight.weddingId).toBe("wed-1");
  });

  it("handles null wedding_date gracefully (shows 'date TBC')", () => {
    const row: AtRiskWeddingRow = { ...AT_RISK_ROW, wedding_date: null };
    const [insight] = buildAtRiskInsights([row]);
    expect(insight.signal).toContain("date TBC");
  });
});

// ---------------------------------------------------------------------------
// Rule 2 — Overdue milestone insights
// ---------------------------------------------------------------------------

describe("buildOverdueMilestoneInsights", () => {
  it("returns empty array on empty input", () => {
    expect(buildOverdueMilestoneInsights([])).toEqual([]);
  });

  it("returns one insight per row", () => {
    const second: OverdueMilestoneRow = { ...OVERDUE_ROW, id: "pm-2", label: "Final balance" };
    const result = buildOverdueMilestoneInsights([OVERDUE_ROW, second]);
    expect(result).toHaveLength(2);
  });

  it("produces an insight with kind 'action'", () => {
    const [insight] = buildOverdueMilestoneInsights([OVERDUE_ROW]);
    expect(insight.kind).toBe("action");
  });

  it("sets priority to 2", () => {
    const [insight] = buildOverdueMilestoneInsights([OVERDUE_ROW]);
    expect(insight.priority).toBe(2);
  });

  it("id is deterministic: 'action-{milestoneId}'", () => {
    const [insight] = buildOverdueMilestoneInsights([OVERDUE_ROW]);
    expect(insight.id).toBe("action-pm-1");
  });

  it("title contains couple_names and label", () => {
    const [insight] = buildOverdueMilestoneInsights([OVERDUE_ROW]);
    expect(insight.title).toContain("Henderson & Carter");
    expect(insight.title).toContain("Interim payment (50%)");
  });

  it("signal shows amount in GBP (amount_minor / 100)", () => {
    const [insight] = buildOverdueMilestoneInsights([OVERDUE_ROW]);
    // 925000 minor = £9,250
    expect(insight.signal).toContain("9,250");
  });

  it("signal contains formatted due_date", () => {
    const [insight] = buildOverdueMilestoneInsights([OVERDUE_ROW]);
    // 2026-06-10 → "10 Jun 2026"
    expect(insight.signal).toContain("10 Jun 2026");
  });

  it("actionHref points to /weddings/{wedding_id}", () => {
    const [insight] = buildOverdueMilestoneInsights([OVERDUE_ROW]);
    expect(insight.actionHref).toBe("/weddings/wed-1");
  });

  it("dueAt is set to due_date", () => {
    const [insight] = buildOverdueMilestoneInsights([OVERDUE_ROW]);
    expect(insight.dueAt).toBe("2026-06-10");
  });

  it("weddingId matches row.wedding_id", () => {
    const [insight] = buildOverdueMilestoneInsights([OVERDUE_ROW]);
    expect(insight.weddingId).toBe("wed-1");
  });

  it("small amounts (under 100) format correctly", () => {
    const row: OverdueMilestoneRow = { ...OVERDUE_ROW, amount_minor: 5000 }; // £50
    const [insight] = buildOverdueMilestoneInsights([row]);
    expect(insight.signal).toContain("50");
  });
});

// ---------------------------------------------------------------------------
// Rule 3 — Quiet lead insights
// ---------------------------------------------------------------------------

describe("buildQuietLeadInsights", () => {
  it("returns empty array on empty input", () => {
    expect(buildQuietLeadInsights([])).toEqual([]);
  });

  it("deduplicates by wedding_id — two rows for same wedding emit one insight", () => {
    const result = buildQuietLeadInsights([
      QUIET_LEAD_ROW,
      QUIET_LEAD_ROW_SAME_WEDDING,
    ]);
    expect(result).toHaveLength(1);
  });

  it("different wedding_ids produce separate insights", () => {
    const other: QuietLeadRow = {
      wedding_id: "wed-99",
      invited_at: "2026-06-05T12:00:00Z",
      couple_names: "Price & Foster",
    };
    const result = buildQuietLeadInsights([QUIET_LEAD_ROW, other]);
    expect(result).toHaveLength(2);
  });

  it("produces an insight with kind 'nudge'", () => {
    const [insight] = buildQuietLeadInsights([QUIET_LEAD_ROW]);
    expect(insight.kind).toBe("nudge");
  });

  it("sets priority to 3", () => {
    const [insight] = buildQuietLeadInsights([QUIET_LEAD_ROW]);
    expect(insight.priority).toBe(3);
  });

  it("id is deterministic: 'nudge-quiet-{weddingId}'", () => {
    const [insight] = buildQuietLeadInsights([QUIET_LEAD_ROW]);
    expect(insight.id).toBe("nudge-quiet-wed-3");
  });

  it("title contains couple_names", () => {
    const [insight] = buildQuietLeadInsights([QUIET_LEAD_ROW]);
    expect(insight.title).toContain("Bennett & Walsh");
  });

  it("signal contains formatted invited_at date", () => {
    const [insight] = buildQuietLeadInsights([QUIET_LEAD_ROW]);
    // 2026-06-01 → "1 Jun 2026"
    expect(insight.signal).toContain("1 Jun 2026");
  });

  it("signal handles null invited_at gracefully", () => {
    const row: QuietLeadRow = { ...QUIET_LEAD_ROW, invited_at: null };
    const [insight] = buildQuietLeadInsights([row]);
    expect(insight.signal).toContain("unknown date");
  });

  it("actionHref points to /weddings/{wedding_id}", () => {
    const [insight] = buildQuietLeadInsights([QUIET_LEAD_ROW]);
    expect(insight.actionHref).toBe("/weddings/wed-3");
  });

  it("weddingId matches row.wedding_id", () => {
    const [insight] = buildQuietLeadInsights([QUIET_LEAD_ROW]);
    expect(insight.weddingId).toBe("wed-3");
  });
});

// ---------------------------------------------------------------------------
// Rule 4 — Upcoming run-sheet insights
// ---------------------------------------------------------------------------

describe("buildUpcomingRunSheetInsights", () => {
  it("returns empty array on empty input", () => {
    expect(buildUpcomingRunSheetInsights([])).toEqual([]);
  });

  it("returns one insight per row", () => {
    const second: UpcomingRunSheetRow = { ...RUN_SHEET_ROW, id: "te-2", title: "Speeches" };
    const result = buildUpcomingRunSheetInsights([RUN_SHEET_ROW, second]);
    expect(result).toHaveLength(2);
  });

  it("produces an insight with kind 'nudge'", () => {
    const [insight] = buildUpcomingRunSheetInsights([RUN_SHEET_ROW]);
    expect(insight.kind).toBe("nudge");
  });

  it("sets priority to 4", () => {
    const [insight] = buildUpcomingRunSheetInsights([RUN_SHEET_ROW]);
    expect(insight.priority).toBe(4);
  });

  it("id is deterministic: 'nudge-runsheet-{eventId}'", () => {
    const [insight] = buildUpcomingRunSheetInsights([RUN_SHEET_ROW]);
    expect(insight.id).toBe("nudge-runsheet-te-1");
  });

  it("title is '{eventTitle} — {couple_names}'", () => {
    const [insight] = buildUpcomingRunSheetInsights([RUN_SHEET_ROW]);
    expect(insight.title).toBe("Ceremony — The Long Barn — Campbell & Evans");
  });

  it("signal contains starts_at_time", () => {
    const [insight] = buildUpcomingRunSheetInsights([RUN_SHEET_ROW]);
    expect(insight.signal).toContain("13:00");
  });

  it("signal contains formatted wedding_date", () => {
    const [insight] = buildUpcomingRunSheetInsights([RUN_SHEET_ROW]);
    // 2026-06-20 → "20 Jun 2026"
    expect(insight.signal).toContain("20 Jun 2026");
  });

  it("dueAt is set to wedding_date", () => {
    const [insight] = buildUpcomingRunSheetInsights([RUN_SHEET_ROW]);
    expect(insight.dueAt).toBe("2026-06-20");
  });

  it("dueAt is undefined when wedding_date is null", () => {
    const row: UpcomingRunSheetRow = { ...RUN_SHEET_ROW, wedding_date: null };
    const [insight] = buildUpcomingRunSheetInsights([row]);
    expect(insight.dueAt).toBeUndefined();
  });

  it("signal shows 'date TBC' when wedding_date is null", () => {
    const row: UpcomingRunSheetRow = { ...RUN_SHEET_ROW, wedding_date: null };
    const [insight] = buildUpcomingRunSheetInsights([row]);
    expect(insight.signal).toContain("date TBC");
  });

  it("actionHref points to /weddings/{wedding_id}", () => {
    const [insight] = buildUpcomingRunSheetInsights([RUN_SHEET_ROW]);
    expect(insight.actionHref).toBe("/weddings/wed-4");
  });
});

// ---------------------------------------------------------------------------
// computeInsights — aggregation and sorting
// ---------------------------------------------------------------------------

describe("computeInsights", () => {
  it("returns empty array when all inputs are empty", () => {
    expect(computeInsights(EMPTY_ROWS)).toEqual([]);
  });

  it("returns combined insights from all four rules", () => {
    const rows: AllInsightRows = {
      atRisk: [AT_RISK_ROW],
      overdueMilestones: [OVERDUE_ROW],
      quietLeads: [QUIET_LEAD_ROW],
      upcomingRunSheet: [RUN_SHEET_ROW],
    };
    const result = computeInsights(rows);
    expect(result).toHaveLength(4);
  });

  it("sorts by priority ascending (at_risk=1 first, runsheet=4 last)", () => {
    const rows: AllInsightRows = {
      atRisk: [AT_RISK_ROW],
      overdueMilestones: [OVERDUE_ROW],
      quietLeads: [QUIET_LEAD_ROW],
      upcomingRunSheet: [RUN_SHEET_ROW],
    };
    const result = computeInsights(rows);
    const priorities = result.map((i) => i.priority);
    expect(priorities).toEqual([1, 2, 3, 4]);
  });

  it("handles only at_risk insights correctly", () => {
    const rows: AllInsightRows = {
      atRisk: [AT_RISK_ROW, AT_RISK_ROW_WITH_SEEN],
      overdueMilestones: [],
      quietLeads: [],
      upcomingRunSheet: [],
    };
    const result = computeInsights(rows);
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.kind === "at_risk")).toBe(true);
  });

  it("deduplication of quiet leads is applied before aggregation", () => {
    const rows: AllInsightRows = {
      atRisk: [],
      overdueMilestones: [],
      quietLeads: [QUIET_LEAD_ROW, QUIET_LEAD_ROW_SAME_WEDDING],
      upcomingRunSheet: [],
    };
    const result = computeInsights(rows);
    // 2 rows for same wedding → 1 insight
    expect(result).toHaveLength(1);
  });

  it("two at_risk insights both have priority 1, then action at 2", () => {
    const rows: AllInsightRows = {
      atRisk: [AT_RISK_ROW, AT_RISK_ROW_WITH_SEEN],
      overdueMilestones: [OVERDUE_ROW],
      quietLeads: [],
      upcomingRunSheet: [],
    };
    const result = computeInsights(rows);
    expect(result[0].priority).toBe(1);
    expect(result[1].priority).toBe(1);
    expect(result[2].priority).toBe(2);
  });

  it("all insights have required fields (id, kind, title, priority)", () => {
    const rows: AllInsightRows = {
      atRisk: [AT_RISK_ROW],
      overdueMilestones: [OVERDUE_ROW],
      quietLeads: [QUIET_LEAD_ROW],
      upcomingRunSheet: [RUN_SHEET_ROW],
    };
    const result = computeInsights(rows);
    for (const insight of result) {
      expect(typeof insight.id).toBe("string");
      expect(insight.id.length).toBeGreaterThan(0);
      expect(["at_risk", "action", "win", "nudge"]).toContain(insight.kind);
      expect(typeof insight.title).toBe("string");
      expect(insight.title.length).toBeGreaterThan(0);
      expect(typeof insight.priority).toBe("number");
    }
  });

  it("all insights have actionHref pointing to /weddings/...", () => {
    const rows: AllInsightRows = {
      atRisk: [AT_RISK_ROW],
      overdueMilestones: [OVERDUE_ROW],
      quietLeads: [QUIET_LEAD_ROW],
      upcomingRunSheet: [RUN_SHEET_ROW],
    };
    const result = computeInsights(rows);
    for (const insight of result) {
      expect(insight.actionHref).toMatch(/^\/weddings\//);
    }
  });
});
