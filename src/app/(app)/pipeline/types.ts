import type { PipelineStage } from "@/lib/pipeline";

/** A card on the board — one active opportunity with its contact's facts. */
export interface BoardOpportunity {
  id: string;
  stage: PipelineStage;
  sortIndex: number;
  contactId: string;
  name: string;
  partnerName: string | null;
  email: string | null;
  phone: string | null;
  weddingDate: string | null;
  guestCount: number | null;
  budgetMinor: number | null;
  source: string | null;
}

/** Cards grouped by stage, each list ordered by sortIndex ascending. */
export type BoardColumns = Record<PipelineStage, BoardOpportunity[]>;
