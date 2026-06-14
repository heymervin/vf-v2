"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { stageMeta, type PipelineStage } from "@/lib/pipeline";
import { OpportunityCard } from "./opportunity-card";
import type { BoardOpportunity } from "./types";

export function KanbanColumn({
  stage,
  items,
  totalCount,
  celebrateId,
  dragDisabled,
  onSelect,
  onMoveToStage,
}: {
  stage: PipelineStage;
  items: BoardOpportunity[];
  /** Full count before any search/filter is applied. When undefined, no "x of y" is shown. */
  totalCount?: number;
  celebrateId: string | null;
  /** When true, drag-and-drop is disabled (e.g. while a search/filter is active). */
  dragDisabled?: boolean;
  onSelect: (opp: BoardOpportunity) => void;
  onMoveToStage: (id: string, toStage: PipelineStage) => void;
}) {
  const meta = stageMeta(stage);
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: dragDisabled });
  const isFiltered = totalCount !== undefined && items.length !== totalCount;

  return (
    <section className="flex w-[300px] shrink-0 flex-col" aria-label={meta.label}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between px-1">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
            meta.chip,
          )}
        >
          {meta.label}
        </span>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {isFiltered ? `${items.length} of ${totalCount}` : items.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 rounded-lg p-1.5 transition-colors",
          isOver ? "bg-accent/50" : "bg-muted/40",
        )}
      >
        <SortableContext
          items={items.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              celebrating={celebrateId === opp.id}
              dragDisabled={dragDisabled}
              onSelect={onSelect}
              onMoveToStage={onMoveToStage}
            />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground/70">
            {isFiltered ? "No matches" : "Drop a card here"}
          </p>
        )}
      </div>
    </section>
  );
}
