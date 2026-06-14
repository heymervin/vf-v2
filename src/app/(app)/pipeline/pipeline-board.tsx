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
import { Search, X } from "lucide-react";
import { STAGES, type PipelineStage } from "@/lib/pipeline";
import { sortIndexBetween } from "@/lib/sort-index";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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

// Stable signature of the server board: stage → ordered card ids with their
// stage + sortIndex. Used to detect when fresh server data (a new enquiry,
// another staffer's move) differs from what we last seeded, so the board can
// re-sync instead of staying stuck on the initial seed.
function boardSignature(columns: BoardColumns): string {
  return STAGES.map(
    (s) =>
      `${s.value}:` +
      columns[s.value].map((o) => `${o.id}@${o.stage}#${o.sortIndex}`).join(","),
  ).join("|");
}

/** Normalise a string for case-insensitive substring matching. */
function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

function matchesSearch(opp: BoardOpportunity, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    norm(opp.name).includes(q) ||
    norm(opp.partnerName).includes(q) ||
    norm(opp.email).includes(q)
  );
}

export function PipelineBoard({
  initialColumns,
}: {
  initialColumns: BoardColumns;
}) {
  // Search / filter state — purely presentational, does not affect DnD logic.
  const [query, setQuery] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState<string>("__all__");

  // Server data seeds the board, but we re-sync when the incoming prop changes
  // (a new enquiry, another staffer's move) so the board doesn't go stale until
  // a hard reload. Optimistic moves stay until the server data they wrote lands.
  const [columns, setColumnsState] = React.useState<BoardColumns>(initialColumns);
  const columnsRef = React.useRef(columns);
  // Signature of the server data we last synced from; lets us detect genuinely
  // new server data without clobbering on every unrelated re-render.
  const syncedSignatureRef = React.useRef(boardSignature(initialColumns));
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
  // In-flight optimistic moves. While > 0, prop re-sync is held off so an
  // earlier move's revalidate can't clobber a later still-pending move.
  const pendingMovesRef = React.useRef(0);
  // Bumped when a move settles so the re-sync effect re-runs once pending drains
  // to 0 — otherwise a prop change that arrived mid-move stays stranded until the
  // next unrelated prop change.
  const [settleTick, setSettleTick] = React.useState(0);

  // Collect unique non-null source values across all columns for the filter dropdown.
  const allSources = React.useMemo<string[]>(() => {
    const seen = new Set<string>();
    for (const stage of STAGES) {
      for (const opp of columns[stage.value]) {
        if (opp.source) seen.add(opp.source);
      }
    }
    return Array.from(seen).sort();
  }, [columns]);

  const isFiltering = query.trim() !== "" || sourceFilter !== "__all__";

  // Filtered view — only used for rendering. All DnD logic uses `columns` / `columnsRef`.
  const visibleColumns = React.useMemo<BoardColumns>(() => {
    if (!isFiltering) return columns;
    const trimmed = query.trim();
    return Object.fromEntries(
      STAGES.map((s) => [
        s.value,
        columns[s.value].filter(
          (opp) =>
            matchesSearch(opp, trimmed) &&
            (sourceFilter === "__all__" || opp.source === sourceFilter),
        ),
      ]),
    ) as BoardColumns;
  }, [columns, query, sourceFilter, isFiltering]);

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

  // Re-sync from the server when the incoming board prop changes by id/stage/
  // sortIndex. Skipped mid-drag so we never yank the board out from under an
  // in-progress drag, and while an optimistic move is still in flight so its
  // own revalidate can't clobber it — the next prop change reconciles instead.
  React.useEffect(() => {
    if (activeId || pendingMovesRef.current > 0) return;
    const next = boardSignature(initialColumns);
    if (next === syncedSignatureRef.current) return;
    syncedSignatureRef.current = next;
    setColumns(initialColumns);
  }, [initialColumns, activeId, setColumns, settleTick]);

  function celebrate(stage: PipelineStage, id: string) {
    if (stage === "wedding_booked" && !prefersReducedMotion()) {
      setCelebrateId(id);
      setTimeout(() => setCelebrateId(null), 600);
    }
  }

  async function persist(
    id: string,
    stage: PipelineStage,
    sortIndex: number,
    rollback: BoardColumns,
  ) {
    pendingMovesRef.current += 1;
    try {
      const res = await moveOpportunity({ opportunityId: id, stage, sortIndex });
      if (!res.ok) {
        // Roll back to the snapshot captured for *this* move, so rapid
        // successive moves don't restore an unrelated (newer) board state.
        setColumns(rollback);
        toast.error(res.error);
      } else {
        celebrate(stage, id);
      }
    } finally {
      pendingMovesRef.current -= 1;
      setSettleTick((t) => t + 1);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    snapshotRef.current = columnsRef.current;
    setActiveId(event.active.id);
  }

  // Cross-column hover: relocate the dragged card into the column under cursor.
  function handleDragOver(event: DragOverEvent) {
    if (isFiltering) return;
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
    setActiveId(null);
    if (isFiltering) return;
    const { active, over } = event;
    // Pre-drag state, captured at drag start. Copy it into a closure-local so a
    // later drag overwriting snapshotRef can't corrupt this move's rollback.
    const snapshot = snapshotRef.current;
    if (!over) {
      if (snapshot) setColumns(snapshot);
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
    const wasSameStage = snapshot?.[stage].some((o) => o.id === active.id);
    if (wasSameStage && oldIndex === overIndex) return;

    reordered[pos] = { ...reordered[pos], stage, sortIndex: newSort };
    setColumns((prev) => ({ ...prev, [stage]: reordered }));
    if (snapshot) void persist(String(active.id), stage, newSort, snapshot);
  }

  // Keyboard / mobile path: move a card to the top of another column.
  function moveToStage(id: string, toStage: PipelineStage) {
    const opp = findOpp(id);
    if (!opp || opp.stage === toStage) return;
    // Per-move snapshot: rapid successive moves each roll back to their own
    // pre-move state, not a shared (possibly newer) one.
    const snapshot = columnsRef.current;
    const newSort = sortIndexBetween(
      null,
      columnsRef.current[toStage][0]?.sortIndex ?? null,
    );
    setColumns((prev) => ({
      ...prev,
      [opp.stage]: prev[opp.stage].filter((o) => o.id !== id),
      [toStage]: [{ ...opp, stage: toStage, sortIndex: newSort }, ...prev[toStage]],
    }));
    void persist(id, toStage, newSort, snapshot);
  }

  return (
    <>
      {/* Search + filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
        <div className="relative flex-1" style={{ minWidth: "180px", maxWidth: "320px" }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search couples or email…"
            className="pl-9 text-base h-9"
            aria-label="Search pipeline"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {allSources.length > 0 && (
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-9 w-[160px] text-sm">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All sources</SelectItem>
              {allSources.map((src) => (
                <SelectItem key={src} value={src}>
                  {src}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {isFiltering && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setQuery(""); setSourceFilter("__all__"); }}
            className="h-9 text-muted-foreground"
          >
            Clear filters
          </Button>
        )}
      </div>

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
              items={visibleColumns[stage.value]}
              totalCount={isFiltering ? columns[stage.value].length : undefined}
              celebrateId={celebrateId}
              dragDisabled={isFiltering}
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
