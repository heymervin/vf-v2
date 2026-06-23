/**
 * Unit tests for src/lib/copilot/insights.ts
 *
 * deriveInsights(input, today) is a pure function — no DB, no env, no I/O.
 * It maps already-venue-scoped DB aggregates (counts + sample rows) into an
 * ordered list of insight cards: { id, kind, severity, title, signal?, count,
 * href }. The caller (the /copilot server component) does the RLS queries; this
 * function only decides what is worth surfacing, how to phrase it, and the
 * priority order.
 *
 * Rules under test:
 *   - overdue tasks      → kind "at_risk"  when count > 0
 *   - overdue payments   → kind "at_risk"  when count > 0  (highest priority)
 *   - payments due soon  → kind "action"   when count > 0
 *   - imminent weddings  → kind "action"   when count > 0
 *   - stale pipeline     → kind "nudge"    when count > 0
 *   - outstanding RSVPs  → kind "nudge"    when count > 0
 *   - nothing pending    → empty array (page renders empty state)
 *   - ordering           → by severity rank, overdue payments first
 */

import { describe, it, expect } from "vitest";
import { deriveInsights, type InsightInput } from "./insights";

const EMPTY: InsightInput = {
  overdueTaskCount: 0,
  overduePaymentCount: 0,
  duePaymentCount: 0,
  imminentWeddingCount: 0,
  stalePipelineCount: 0,
  outstandingRsvpCount: 0,
};

describe("deriveInsights", () => {
  it("returns an empty list when nothing needs attention", () => {
    expect(deriveInsights(EMPTY)).toEqual([]);
  });

  it("surfaces overdue tasks as an at_risk insight", () => {
    const out = deriveInsights({ ...EMPTY, overdueTaskCount: 3 });
    const card = out.find((c) => c.id === "overdue-tasks");
    expect(card).toBeDefined();
    expect(card!.kind).toBe("at_risk");
    expect(card!.count).toBe(3);
    expect(card!.href).toBe("/weddings");
  });

  it("surfaces overdue payments as an at_risk insight at the top", () => {
    const out = deriveInsights({
      ...EMPTY,
      overdueTaskCount: 5,
      overduePaymentCount: 2,
      stalePipelineCount: 4,
    });
    expect(out[0].id).toBe("overdue-payments");
    expect(out[0].kind).toBe("at_risk");
    expect(out[0].href).toBe("/money");
  });

  it("surfaces due-soon payments and imminent weddings as actions", () => {
    const out = deriveInsights({
      ...EMPTY,
      duePaymentCount: 1,
      imminentWeddingCount: 2,
    });
    const due = out.find((c) => c.id === "due-payments");
    const imminent = out.find((c) => c.id === "imminent-weddings");
    expect(due?.kind).toBe("action");
    expect(imminent?.kind).toBe("action");
    expect(imminent?.count).toBe(2);
  });

  it("surfaces stale pipeline and outstanding RSVPs as nudges", () => {
    const out = deriveInsights({
      ...EMPTY,
      stalePipelineCount: 7,
      outstandingRsvpCount: 12,
    });
    const stale = out.find((c) => c.id === "stale-pipeline");
    const rsvp = out.find((c) => c.id === "outstanding-rsvps");
    expect(stale?.kind).toBe("nudge");
    expect(stale?.href).toBe("/pipeline");
    expect(rsvp?.kind).toBe("nudge");
    expect(rsvp?.count).toBe(12);
  });

  it("singularises the title copy when count is 1", () => {
    const out = deriveInsights({ ...EMPTY, overdueTaskCount: 1 });
    expect(out[0].title).toContain("1 wedding task");
    expect(out[0].title).not.toContain("tasks");
  });

  it("orders insights at_risk → action → nudge", () => {
    const out = deriveInsights({
      overdueTaskCount: 1,
      overduePaymentCount: 1,
      duePaymentCount: 1,
      imminentWeddingCount: 1,
      stalePipelineCount: 1,
      outstandingRsvpCount: 1,
    });
    const kinds = out.map((c) => c.kind);
    // every at_risk index < every action index < every nudge index
    const lastAtRisk = kinds.lastIndexOf("at_risk");
    const firstAction = kinds.indexOf("action");
    const lastAction = kinds.lastIndexOf("action");
    const firstNudge = kinds.indexOf("nudge");
    expect(lastAtRisk).toBeLessThan(firstAction);
    expect(lastAction).toBeLessThan(firstNudge);
  });
});
