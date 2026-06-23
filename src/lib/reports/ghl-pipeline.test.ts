/**
 * Unit tests for src/lib/reports/ghl-pipeline.ts
 *
 * Tests the pure summariseGhlPipeline mapper.
 * DB-free, no mocks needed — purely functional.
 */

import { describe, it, expect } from "vitest";
import { summariseGhlPipeline } from "./ghl-pipeline";
import type { GhlPipelineStageCounts } from "@/lib/ghl/types";

describe("summariseGhlPipeline", () => {
  it("returns total count and value for multiple stages", () => {
    const stages: GhlPipelineStageCounts[] = [
      { pipelineStageId: "stage-a", count: 3, totalValue: 1500 },
      { pipelineStageId: "stage-b", count: 5, totalValue: 2500 },
      { pipelineStageId: "stage-c", count: 2, totalValue: 0 },
    ];

    const result = summariseGhlPipeline(stages);

    expect(result.totalCount).toBe(10);
    expect(result.totalValue).toBe(4000);
    expect(result.stages).toHaveLength(3);
  });

  it("returns zeroed totals for an empty array", () => {
    const result = summariseGhlPipeline([]);

    expect(result.totalCount).toBe(0);
    expect(result.totalValue).toBe(0);
    expect(result.stages).toHaveLength(0);
  });

  it("returns correct totals for a single stage", () => {
    const stages: GhlPipelineStageCounts[] = [
      { pipelineStageId: "stage-only", count: 7, totalValue: 3500 },
    ];

    const result = summariseGhlPipeline(stages);

    expect(result.totalCount).toBe(7);
    expect(result.totalValue).toBe(3500);
    expect(result.stages[0]).toEqual({ pipelineStageId: "stage-only", count: 7, totalValue: 3500 });
  });

  it("handles stages with zero value gracefully", () => {
    const stages: GhlPipelineStageCounts[] = [
      { pipelineStageId: "stage-x", count: 1, totalValue: 0 },
      { pipelineStageId: "stage-y", count: 1, totalValue: 0 },
    ];

    const result = summariseGhlPipeline(stages);

    expect(result.totalValue).toBe(0);
    expect(result.totalCount).toBe(2);
  });
});
