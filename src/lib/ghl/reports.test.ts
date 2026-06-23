/**
 * Unit tests for src/lib/ghl/reports.ts — getPipelineAggregate
 *
 * Strategy:
 *   - Mock "server-only" to a no-op so the module can be imported in vitest.
 *   - Mock "@/lib/ghl/client" so we control ghlClient() without any DB or
 *     network calls.  The mock returns a fake client whose request() method
 *     is a vi.fn() that we configure per-test.
 *
 * Test matrix:
 *   1. Null passthrough — ghlClient returns null → getPipelineAggregate returns null.
 *   2. Single page — correct per-stage count and value totals.
 *   3. Multi-page — pagination cursor is followed; final aggregate is correct.
 *   4. Null monetaryValue — treated as 0 in the aggregate.
 *   5. Stages with zero opportunities are absent (only stages that appeared in
 *      the API response are included — no synthetic zero rows).
 *   6. MAX_PAGES guard — pagination stops at 10 pages and a warning is logged.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── module-level mocks (hoisted before imports) ───────────────────────────────

vi.mock("server-only", () => ({}));

// We control what ghlClient returns via this variable.
let mockGhlClientReturnValue: null | { locationId: string; request: ReturnType<typeof vi.fn> } = null;

vi.mock("@/lib/ghl/client", () => ({
  ghlClient: async (_venueId: string) => mockGhlClientReturnValue,
}));

// ── import module under test (after mocks) ────────────────────────────────────

import { getPipelineAggregate } from "./reports";

// ── helpers ───────────────────────────────────────────────────────────────────

interface FakeOpp {
  id: string;
  pipelineStageId: string;
  monetaryValue: number | null;
}

interface FakePage {
  opportunities: FakeOpp[];
  meta: {
    nextPageUrl: string | null;
    startAfterId: string | null;
  };
}

/** Build a fake page response with optional next-page cursor. */
function makePage(opps: FakeOpp[], nextId: string | null = null): FakePage {
  return {
    opportunities: opps,
    meta: {
      nextPageUrl: nextId !== null ? "https://ghl/next" : null,
      startAfterId: nextId,
    },
  };
}

/** Build a fake GHL client with a controllable request() mock. */
function makeFakeClient(pages: FakePage[]) {
  let callIndex = 0;
  const requestMock = vi.fn(async () => {
    const page = pages[callIndex] ?? makePage([]);
    callIndex += 1;
    return page;
  });
  return {
    locationId: "loc_test_abc",
    request: requestMock,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("getPipelineAggregate", () => {
  beforeEach(() => {
    mockGhlClientReturnValue = null;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Null passthrough ─────────────────────────────────────────────────────

  it("returns null when ghlClient returns null (venue not connected)", async () => {
    mockGhlClientReturnValue = null;

    const result = await getPipelineAggregate("venue-123");

    expect(result).toBeNull();
  });

  // ── 2. Single page — correct per-stage aggregation ─────────────────────────

  it("aggregates a single page correctly", async () => {
    const opps: FakeOpp[] = [
      { id: "o1", pipelineStageId: "stage_a", monetaryValue: 1000 },
      { id: "o2", pipelineStageId: "stage_a", monetaryValue: 2000 },
      { id: "o3", pipelineStageId: "stage_b", monetaryValue: 500 },
    ];
    mockGhlClientReturnValue = makeFakeClient([makePage(opps, null)]);

    const result = await getPipelineAggregate("venue-abc");

    expect(result).not.toBeNull();
    expect(result!.stages).toHaveLength(2);

    const stageA = result!.stages.find((s) => s.pipelineStageId === "stage_a");
    const stageB = result!.stages.find((s) => s.pipelineStageId === "stage_b");

    expect(stageA).toBeDefined();
    expect(stageA!.count).toBe(2);
    expect(stageA!.valueMinor).toBe(3000);
    expect(stageA!.stageName).toBe("stage_a"); // stageName = raw ID for now

    expect(stageB).toBeDefined();
    expect(stageB!.count).toBe(1);
    expect(stageB!.valueMinor).toBe(500);
  });

  it("returns correct totalCount and totalValueMinor", async () => {
    const opps: FakeOpp[] = [
      { id: "o1", pipelineStageId: "stage_a", monetaryValue: 1000 },
      { id: "o2", pipelineStageId: "stage_b", monetaryValue: 2000 },
    ];
    mockGhlClientReturnValue = makeFakeClient([makePage(opps, null)]);

    const result = await getPipelineAggregate("venue-abc");

    expect(result!.totalCount).toBe(2);
    expect(result!.totalValueMinor).toBe(3000);
  });

  // ── 3. Multi-page pagination ────────────────────────────────────────────────

  it("follows pagination cursor across two pages and merges aggregates", async () => {
    const page1Opps: FakeOpp[] = [
      { id: "o1", pipelineStageId: "stage_a", monetaryValue: 1000 },
    ];
    const page2Opps: FakeOpp[] = [
      { id: "o2", pipelineStageId: "stage_a", monetaryValue: 500 },
      { id: "o3", pipelineStageId: "stage_c", monetaryValue: 800 },
    ];
    const pages = [
      makePage(page1Opps, "cursor_after_page1"),
      makePage(page2Opps, null),
    ];
    mockGhlClientReturnValue = makeFakeClient(pages);

    const result = await getPipelineAggregate("venue-paginated");

    const stageA = result!.stages.find((s) => s.pipelineStageId === "stage_a");
    const stageC = result!.stages.find((s) => s.pipelineStageId === "stage_c");

    expect(stageA!.count).toBe(2);
    expect(stageA!.valueMinor).toBe(1500);

    expect(stageC!.count).toBe(1);
    expect(stageC!.valueMinor).toBe(800);

    expect(result!.totalCount).toBe(3);
    expect(result!.totalValueMinor).toBe(2300);
  });

  it("passes startAfterId as a query param on the second page request", async () => {
    const page1Opps: FakeOpp[] = [
      { id: "o1", pipelineStageId: "stage_a", monetaryValue: 100 },
    ];
    const pages = [
      makePage(page1Opps, "cursor_id_42"),
      makePage([], null),
    ];
    const fakeClient = makeFakeClient(pages);
    mockGhlClientReturnValue = fakeClient;

    await getPipelineAggregate("venue-cursor");

    // Second call to request() should include startAfterId in the path.
    const secondCallPath = (fakeClient.request as ReturnType<typeof vi.fn>).mock.calls[1]?.[0] as
      | string
      | undefined;
    expect(secondCallPath).toBeDefined();
    expect(secondCallPath).toContain("startAfterId=cursor_id_42");
  });

  // ── 4. Null monetaryValue → treated as 0 ───────────────────────────────────

  it("treats null monetaryValue as 0 in the aggregate", async () => {
    const opps: FakeOpp[] = [
      { id: "o1", pipelineStageId: "stage_x", monetaryValue: null },
      { id: "o2", pipelineStageId: "stage_x", monetaryValue: 500 },
    ];
    mockGhlClientReturnValue = makeFakeClient([makePage(opps, null)]);

    const result = await getPipelineAggregate("venue-null-value");

    const stageX = result!.stages.find((s) => s.pipelineStageId === "stage_x");
    expect(stageX!.count).toBe(2);
    expect(stageX!.valueMinor).toBe(500);
  });

  // ── 5. Empty response → empty aggregate (no phantom zero rows) ─────────────

  it("returns an empty stages array when there are no opportunities", async () => {
    mockGhlClientReturnValue = makeFakeClient([makePage([], null)]);

    const result = await getPipelineAggregate("venue-empty");

    expect(result).not.toBeNull();
    expect(result!.stages).toHaveLength(0);
    expect(result!.totalCount).toBe(0);
    expect(result!.totalValueMinor).toBe(0);
  });

  // ── 6. MAX_PAGES guard ──────────────────────────────────────────────────────

  it("stops after MAX_PAGES (10) and logs a warning when there are more pages", async () => {
    // Build 11 pages — all returning one opp with a next cursor except the last.
    const pages: FakePage[] = Array.from({ length: 11 }, (_, i) => {
      const isLast = i === 10;
      return makePage(
        [{ id: `o${i}`, pipelineStageId: "stage_a", monetaryValue: 100 }],
        isLast ? null : `cursor_${i + 1}`
      );
    });
    mockGhlClientReturnValue = makeFakeClient(pages);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getPipelineAggregate("venue-large");

    // Should have stopped at page 10 (MAX_PAGES), not fetched page 11.
    const stageA = result!.stages.find((s) => s.pipelineStageId === "stage_a");
    // 10 pages × 1 opp each = 10 opps
    expect(stageA!.count).toBe(10);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("MAX_PAGES"));
  });
});
