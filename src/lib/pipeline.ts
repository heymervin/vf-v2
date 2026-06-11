import type { Database } from "@/lib/supabase/types";

export type PipelineStage = Database["public"]["Enums"]["pipeline_stage"];

export interface StageMeta {
  value: PipelineStage;
  label: string;
  /** Tailwind classes for the stage chip — pastel bg + navy text (DESIGN.md). */
  chip: string;
}

/**
 * The fixed 8-stage pipeline (MVP — not configurable). Order here is the
 * canonical left-to-right kanban order and the order stages appear in filters.
 * Chip colors are assigned once in DESIGN.md and reused everywhere a stage is
 * shown (kanban headers, stage badges, reports).
 */
export const STAGES: readonly StageMeta[] = [
  { value: "inbound_enquiry", label: "Inbound enquiry", chip: "bg-accent text-accent-foreground" },
  { value: "responded", label: "Responded", chip: "bg-fun-teal text-foreground" },
  { value: "viewing_interest", label: "Viewing interest", chip: "bg-mint text-foreground" },
  { value: "appointment_booked", label: "Appointment booked", chip: "bg-fun-blue text-foreground" },
  { value: "appointment_attended", label: "Appointment attended", chip: "bg-fun-pink text-fun-pink-foreground" },
  { value: "date_on_hold", label: "Date on hold", chip: "bg-warning text-warning-foreground" },
  { value: "wedding_booked", label: "Wedding booked", chip: "bg-fun-green text-foreground" },
  { value: "archived", label: "Archived", chip: "bg-muted text-muted-foreground" },
] as const;

const STAGE_BY_VALUE = new Map(STAGES.map((s) => [s.value, s]));

export function stageMeta(stage: PipelineStage): StageMeta {
  return STAGE_BY_VALUE.get(stage) ?? STAGES[0];
}

export const STAGE_VALUES: readonly PipelineStage[] = STAGES.map((s) => s.value);
