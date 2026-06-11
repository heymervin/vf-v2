"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { STAGES, type PipelineStage } from "@/lib/pipeline";
import { sortIndexBetween } from "@/lib/sort-index";
import { KanbanColumn } from "./kanban-column";
import { OpportunityCard } from "./opportunity-card";
import { OpportunityPeek } from "./opportunity-peek";
import { moveOpportunity } from "./actions";
import type { BoardColumns, BoardOpportunity } from "./types";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function PipelineBoard({
  initialColumns,
}: {
  initialColumns: BoardColumns;
}) {
  // Server data seeds the board once; the board stays authoritative for the
  // session (optimistic moves), so we deliberately don't sync prop changes.
  const [columns, setColumnsState] = React.useState<BoardColumns>(initialColumns);
  const columnsRef = React.useRef(columns);
  const setColumns = React.useCallback(
    (updater: BoardColumns | ((prev: BoardColumns) => BoardColumns)) => {
      setColumnsState((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (p: BoardColumns) => BoardColumns)(prev)
            : updater;
        columnsRef.current = next;
        return next;
      });
    },
    [],
  );

  const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);
  const [peek, setPeek] = React.useState<BoardOpportunity | null>(null);
  const [celebrateId, setCelebrateId] = React.useState<string | null>(null);
  const snapshotRef = React.useRef<BoardColumns | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findStage = React.useCallback(
    (id: UniqueIdentifier): PipelineStage | null => {
      if (id in columnsRef.current) return id as PipelineStage;
      for (const stage of STAGES) {
        if (columnsRef.current[stage.value].some((o) => o.id === id)) {
          return stage.value;
        }
      }
      return null;
    },
    [],
  );

  const findOpp = React.useCallback(
    (id: UniqueIdentifier): BoardOpportunity | null => {
      for (const stage of STAGES) {
        const hit = columnsRef.current[stage.value].find((o) => o.id === id);
        if (hit) return hit;
      }
      return null;
    },
    [],
  );

  // Render-safe lookup of the dragged card (reads state, not the ref).
  const activeOpp = React.useMemo(() => {
    if (!activeId) return null;
    for (const stage of STAGES) {
      const hit = columns[stage.value].find((o) => o.id === activeId);
      if (hit) return hit;
    }
    return null;
  }, [activeId, columns]);

  function celebrate(stage: PipelineStage, id: string) {
    if (stage === "wedding_booked" && !prefersReducedMotion()) {
      setCelebrateId(id);
      setTimeout(() => setCelebrateId(null), 600);
    }
  }

  async function persist(id: string, stage: PipelineStage, sortIndex: number) {
    const res = await moveOpportunity({ opportunityId: id, stage, sortIndex });
    if (!res.ok) {
      if (snapshotRef.current) setColumns(snapshotRef.current);
      toast.error(res.error);
    } else {
      celebrate(stage, id);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    snapshotRef.current = columnsRef.current;
    setActiveId(event.active.id);
  }

  // Cross-column hover: relocate the dragged card into the column under cursor.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const from = findStage(active.id);
    const to = findStage(over.id);
    if (!from || !to || from === to) return;

    setColumns((prev) => {
      const fromItems = prev[from];
      const moving = fromItems.find((o) => o.id === active.id);
      if (!moving) return prev;
      const overItems = prev[to];
      const overIdx =
        over.id === to
          ? overItems.length
          : (() => {
              const i = overItems.findIndex((o) => o.id === over.id);
              return i >= 0 ? i : overItems.length;
            })();
      return {
        ...prev,
        [from]: fromItems.filter((o) => o.id !== active.id),
        [to]: [
          ...overItems.slice(0, overIdx),
          { ...moving, stage: to },
          ...overItems.slice(overIdx),
        ],
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) {
      if (snapshotRef.current) setColumns(snapshotRef.current);
      return;
    }

    const stage = findStage(over.id);
    if (!stage) return;

    const items = columnsRef.current[stage];
    const oldIndex = items.findIndex((o) => o.id === active.id);
    if (oldIndex < 0) return;
    const overIndex =
      over.id === stage
        ? items.length - 1
        : (() => {
            const i = items.findIndex((o) => o.id === over.id);
            return i >= 0 ? i : items.length - 1;
          })();

    const reordered = arrayMove(items, oldIndex, overIndex);
    const pos = reordered.findIndex((o) => o.id === active.id);
    const before = pos > 0 ? reordered[pos - 1].sortIndex : null;
    const after = pos < reordered.length - 1 ? reordered[pos + 1].sortIndex : null;
    const newSort = sortIndexBetween(before, after);

    // No-op guard: same column, same position, unchanged from snapshot.
    const snap = snapshotRef.current;
    const wasSameStage = snap?.[stage].some((o) => o.id === active.id);
    if (wasSameStage && oldIndex === overIndex) return;

    reordered[pos] = { ...reordered[pos], stage, sortIndex: newSort };
    setColumns((prev) => ({ ...prev, [stage]: reordered }));
    void persist(String(active.id), stage, newSort);
  }

  // Keyboard / mobile path: move a card to the top of another column.
  function moveToStage(id: string, toStage: PipelineStage) {
    const opp = findOpp(id);
    if (!opp || opp.stage === toStage) return;
    snapshotRef.current = columnsRef.current;
    const newSort = sortIndexBetween(
      null,
      columnsRef.current[toStage][0]?.sortIndex ?? null,
    );
    setColumns((prev) => ({
      ...prev,
      [opp.stage]: prev[opp.stage].filter((o) => o.id !== id),
      [toStage]: [{ ...opp, stage: toStage, sortIndex: newSort }, ...prev[toStage]],
    }));
    void persist(id, toStage, newSort);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="-mx-6 flex min-h-0 flex-1 gap-3 overflow-x-auto px-6 pb-4 md:-mx-8 md:px-8">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage.value}
              stage={stage.value}
              items={columns[stage.value]}
              celebrateId={celebrateId}
              onSelect={setPeek}
              onMoveToStage={moveToStage}
            />
          ))}
        </div>

        <DragOverlay>
          {activeOpp ? (
            <OpportunityCard opportunity={activeOpp} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <OpportunityPeek
        opportunity={peek}
        open={peek !== null}
        onOpenChange={(o) => !o && setPeek(null)}
      />
    </>
  );
}
