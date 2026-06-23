/**
 * Pure mapper for GHL pipeline data used on the Reports page.
 *
 * GHL has no aggregate API — getPipelineCounts() groups opportunities
 * client-side. This module summarises those stage counts into a shape
 * the Reports UI can render without knowing GHL internals.
 *
 * No I/O, no imports from server-only modules — safe to unit-test directly.
 */

import type { GhlPipelineStageCounts } from "@/lib/ghl/types";

export interface GhlPipelineSummary {
  /** Raw per-stage rows (pass-through for the table). */
  stages: GhlPipelineStageCounts[];
  /** Sum of counts across all stages. */
  totalCount: number;
  /** Sum of totalValue across all stages. */
  totalValue: number;
}

/**
 * Summarise an array of GhlPipelineStageCounts into totals + the original rows.
 * Returns zeroed totals for an empty input — never throws.
 */
export function summariseGhlPipeline(
  stages: GhlPipelineStageCounts[],
): GhlPipelineSummary {
  let totalCount = 0;
  let totalValue = 0;

  for (const s of stages) {
    totalCount += s.count;
    totalValue += s.totalValue;
  }

  return { stages, totalCount, totalValue };
}
