/**
 * GHL pipeline aggregate helper — server-only.
 *
 * Paginates GET /opportunities/search (location_id + limit, then startAfterId
 * cursor) and aggregates by pipelineStageId client-side.  GHL has no aggregate
 * API (specs/ghl-integration.md §9.1).
 *
 * Returns null when ghlClient(venueId) returns null (venue not connected).
 *
 * Called once per daily-brief run and once per Reports page server component
 * render.  Do NOT call from client components or on every keystroke.
 */

import "server-only";
import { ghlClient } from "@/lib/ghl/client";

// ---------------------------------------------------------------------------
// Exported types (also imported by daily-brief-email.tsx)
// ---------------------------------------------------------------------------

export interface PipelineStageAggregate {
  pipelineStageId: string;
  /** Raw value from GHL — display as-is.  A future call to
   *  GET /pipelines/{id}/stages can enrich this; out of scope for Slice 7. */
  stageName: string;
  count: number;
  /** Sum of monetaryValue across opportunities in this stage (minor units). */
  valueMinor: number;
}

export interface PipelineAggregate {
  stages: PipelineStageAggregate[];
  totalCount: number;
  totalValueMinor: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum pages of 100 opportunities each (= 1000 opps maximum).
 *  OQ-5: revisit if a venue's open pipeline grows past this ceiling. */
const MAX_PAGES = 10;

// ---------------------------------------------------------------------------
// getPipelineAggregate
// ---------------------------------------------------------------------------

/**
 * Paginate GET /opportunities/search, aggregate by pipelineStageId client-side.
 * Returns null when ghlClient(venueId) returns null (venue not connected).
 */
export async function getPipelineAggregate(
  venueId: string
): Promise<PipelineAggregate | null> {
  const client = await ghlClient(venueId);
  if (!client) {
    return null;
  }

  const { locationId } = client;

  // Accumulator: pipelineStageId → { count, valueMinor }
  const map = new Map<string, { count: number; valueMinor: number }>();

  let pageCount = 0;
  let startAfterId: string | null = null;
  let hasMore = true;

  while (hasMore && pageCount < MAX_PAGES) {
    const params = new URLSearchParams({
      location_id: locationId,
      limit: "100",
    });
    if (startAfterId !== null) {
      params.set("startAfterId", startAfterId);
    }

    const response = await client.request<{
      opportunities: {
        id: string;
        pipelineStageId: string;
        monetaryValue: number | null;
      }[];
      meta: {
        nextPageUrl: string | null;
        startAfterId: string | null;
      };
    }>(`/opportunities/search?${params.toString()}`);

    for (const opp of response.opportunities) {
      const stageId = opp.pipelineStageId;
      const value = opp.monetaryValue ?? 0;
      const existing = map.get(stageId);
      if (existing) {
        existing.count += 1;
        existing.valueMinor += value;
      } else {
        map.set(stageId, { count: 1, valueMinor: value });
      }
    }

    pageCount += 1;

    if (response.meta.nextPageUrl !== null && response.meta.startAfterId !== null) {
      startAfterId = response.meta.startAfterId;
    } else {
      hasMore = false;
    }
  }

  if (pageCount >= MAX_PAGES && hasMore) {
    console.warn(
      `getPipelineAggregate: reached MAX_PAGES (${MAX_PAGES}) for venue ${venueId}. ` +
        "Pipeline data may be incomplete. OQ-5: revisit pagination limit."
    );
  }

  // Build the sorted output array.  stageName = pipelineStageId for now;
  // enrichment from GET /pipelines/{id}/stages is deferred to a later slice.
  const stages: PipelineStageAggregate[] = Array.from(map.entries()).map(
    ([pipelineStageId, agg]) => ({
      pipelineStageId,
      stageName: pipelineStageId,
      count: agg.count,
      valueMinor: agg.valueMinor,
    })
  );

  const totalCount = stages.reduce((sum, s) => sum + s.count, 0);
  const totalValueMinor = stages.reduce((sum, s) => sum + s.valueMinor, 0);

  return { stages, totalCount, totalValueMinor };
}
