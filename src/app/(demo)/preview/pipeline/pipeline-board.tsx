"use client";

import * as React from "react";
import {
  KanbanSquare,
  List,
  Download,
  Upload,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DataToolbar } from "@/components/data-toolbar";
import { SortableTable, type SortableColumn } from "@/components/sortable-table";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { EntitySheet } from "@/components/entity-sheet";
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/stage-badge";
import { PipelineCard } from "./pipeline-card";
import {
  gbp,
  formatLongDate,
  teamMember,
  TEAM,
  type Contact,
} from "@/lib/mock";
import { STAGES, type StageMeta, type PipelineStage } from "@/lib/pipeline";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ColumnData {
  stage: StageMeta;
  contacts: Contact[];
}

interface PipelineBoardProps {
  columnData: ColumnData[];
  totalCount: number;
}

// ─── Filter-chip helpers ──────────────────────────────────────────────────────

const SCORE_OPTIONS = [
  { value: "hot", label: "Hot" },
  { value: "warm", label: "Warm" },
  { value: "cold", label: "Cold" },
];

/** Score dot — color per DESIGN.md. Never color-only: paired with aria-label. */
function ScoreDot({ score }: { score: Contact["score"] }) {
  return (
    <span
      aria-label={`${score} lead`}
      title={`Lead score: ${score}`}
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        score === "hot" && "bg-fun-pink-strong",
        score === "warm" && "bg-warning",
        score === "cold" && "bg-muted-foreground/60",
      )}
    />
  );
}

/** Small dismissible filter chip rendered inside DataToolbar children slot. */
function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="flex items-center justify-center -my-4 -mr-1 min-h-[44px] min-w-[44px] p-0.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="size-3 shrink-0" aria-hidden />
      </button>
    </span>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(contacts: Contact[]) {
  const headers = [
    "Couple",
    "Stage",
    "Wedding Date",
    "Guests",
    "Budget (£)",
    "Score",
    "Owner",
    "Source",
    "Last Contact",
  ];
  const rows = contacts.map((c) => {
    const owner = teamMember(c.ownerId);
    return [
      c.coupleName,
      c.stage,
      c.weddingDate ?? "",
      c.guestCount ?? "",
      c.budget ?? "",
      c.score,
      owner?.name ?? "",
      c.source,
      c.lastMessageAt.slice(0, 10),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pipeline.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── List view columns ────────────────────────────────────────────────────────

function buildColumns(router: ReturnType<typeof useRouter>): SortableColumn<Contact>[] {
  return [
    {
      key: "couple",
      header: "Couple",
      sortable: true,
      sortValue: (c) => c.coupleName,
      render: (c) => (
        <span className="font-medium text-foreground">{c.coupleName}</span>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      sortable: true,
      sortValue: (c) => c.stage,
      render: (c) => <StageBadge stage={c.stage} />,
    },
    {
      key: "date",
      header: "Wedding date",
      sortable: true,
      sortValue: (c) => c.weddingDate ?? "",
      render: (c) =>
        c.weddingDate ? (
          <span className="tabular-nums text-muted-foreground">
            {formatLongDate(c.weddingDate)}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "guests",
      header: "Guests",
      sortable: true,
      align: "right",
      sortValue: (c) => c.guestCount ?? 0,
      render: (c) =>
        c.guestCount != null ? (
          <span className="tabular-nums text-muted-foreground">
            {c.guestCount}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "budget",
      header: "Budget",
      sortable: true,
      align: "right",
      sortValue: (c) => c.budget ?? 0,
      render: (c) =>
        c.budget != null ? (
          <span className="tabular-nums text-muted-foreground">
            {gbp(c.budget)}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "score",
      header: "Score",
      sortable: true,
      sortValue: (c) =>
        c.score === "hot" ? 0 : c.score === "warm" ? 1 : 2,
      render: (c) => (
        <span className="inline-flex items-center gap-1.5">
          <ScoreDot score={c.score} />
          <span className="capitalize text-muted-foreground">{c.score}</span>
        </span>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      sortable: true,
      sortValue: (c) => teamMember(c.ownerId)?.name ?? "",
      render: (c) => {
        const m = teamMember(c.ownerId);
        return m ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="flex size-6 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
              {m.initials}
            </span>
            <span className="text-muted-foreground">{m.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        );
      },
    },
    {
      key: "last_contact",
      header: "Last contact",
      sortable: true,
      sortValue: (c) => c.lastMessageAt,
      render: (c) => {
        // Compute recency label
        const diff = Date.now() - new Date(c.lastMessageAt).getTime();
        const days = Math.floor(diff / 86_400_000);
        const label =
          days === 0
            ? "Today"
            : days === 1
              ? "Yesterday"
              : `${days}d ago`;
        const urgent = days >= 7;
        return (
          <span
            className={cn(
              "tabular-nums text-xs",
              urgent ? "text-warning-foreground font-medium" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
        );
      },
    },
  ];
}

// ─── Drag-scroll hook ─────────────────────────────────────────────────────────

/**
 * Attaches pointer-based click-drag horizontal scroll to a scrollable ref.
 * Returns cursor state so the parent can apply grab/grabbing classes.
 * Importantly: if the pointer moves < 5px we treat it as a click — so
 * clicks on cards still navigate.
 */
function useDragScroll<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let scrollLeft = 0;
    let moved = false;
    let active = false;

    const onPointerDown = (e: PointerEvent) => {
      // Only main button; ignore clicks on interactive children
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("a, button, input, [role=button]")) return;

      active = true;
      moved = false;
      startX = e.clientX;
      scrollLeft = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
      setIsDragging(false); // visual grab cursor starts on move
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!active) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        setIsDragging(true);
      }
      if (moved) {
        el.scrollLeft = scrollLeft - dx;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!active) return;
      active = false;
      setIsDragging(false);
      // Release capture so normal click events fire on children if not moved
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  return { ref, isDragging };
}

// ─── Archived column ──────────────────────────────────────────────────────────

function ArchivedColumn({ contacts }: { contacts: Contact[] }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <section
      role="listitem"
      aria-label="Archived"
      className="flex w-[300px] shrink-0 flex-col"
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between px-0.5">
        <StageBadge stage="archived" />
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {contacts.length}
        </span>
      </div>

      {/* Collapsed toggle bar */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse archived column" : "Expand archived column"}
        className={cn(
          "group flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 py-2",
          "border border-dashed border-border bg-muted/30 text-sm text-muted-foreground",
          "transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span className="text-xs font-medium">
          {expanded ? "Hide archived" : `Show ${contacts.length} archived`}
        </span>
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 transition-transform" aria-hidden />
        ) : (
          <ChevronRight className="size-4 shrink-0 transition-transform" aria-hidden />
        )}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div
          className={cn(
            "mt-2 flex min-h-24 flex-1 flex-col gap-2 rounded-lg p-1.5",
            "bg-muted/30",
          )}
        >
          {contacts.length > 0 ? (
            contacts.map((c) => <PipelineCard key={c.id} contact={c} />)
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-3 py-8 text-center">
              <p className="text-xs font-medium text-muted-foreground">
                No archived contacts
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PipelineBoard({ columnData, totalCount }: PipelineBoardProps) {
  const router = useRouter();

  // ── View state ──────────────────────────────────────────────────────────────
  const [view, setView] = React.useState<"kanban" | "list">("kanban");

  // ── Search ──────────────────────────────────────────────────────────────────
  const [query, setQuery] = React.useState("");

  // ── Active filters ──────────────────────────────────────────────────────────
  const [stageFilter, setStageFilter] = React.useState<PipelineStage | "">("");
  const [ownerFilter, setOwnerFilter] = React.useState<string>("");
  const [scoreFilter, setScoreFilter] = React.useState<Contact["score"] | "">("");

  // ── Selection (list view) ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // ── Drag scroll (kanban) ────────────────────────────────────────────────────
  const { ref: scrollRef, isDragging } = useDragScroll<HTMLDivElement>();

  // ── Filtering ───────────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase();

  const allContacts = columnData.flatMap((col) => col.contacts);

  const filteredContacts = React.useMemo(() => {
    return allContacts.filter((c) => {
      if (q && !c.coupleName.toLowerCase().includes(q)) return false;
      if (stageFilter && c.stage !== stageFilter) return false;
      if (ownerFilter && c.ownerId !== ownerFilter) return false;
      if (scoreFilter && c.score !== scoreFilter) return false;
      return true;
    });
  }, [allContacts, q, stageFilter, ownerFilter, scoreFilter]);

  const filteredColumnData = React.useMemo(() => {
    return columnData.map((col) => ({
      ...col,
      contacts: filteredContacts.filter((c) => c.stage === col.stage.value),
    }));
  }, [columnData, filteredContacts]);

  const visibleCount = filteredContacts.length;
  const hasFilters = q || stageFilter || ownerFilter || scoreFilter;

  // ── Sort (DataToolbar) ──────────────────────────────────────────────────────
  const [sortVal, setSortVal] = React.useState("default");

  // ── Columns for list view ───────────────────────────────────────────────────
  const columns = React.useMemo(() => buildColumns(router), [router]);

  // ── Derived active filter chips ─────────────────────────────────────────────
  const activeChips: { label: string; clear: () => void }[] = [];
  if (stageFilter) {
    const meta = STAGES.find((s) => s.value === stageFilter);
    activeChips.push({ label: meta?.label ?? stageFilter, clear: () => setStageFilter("") });
  }
  if (ownerFilter) {
    const m = teamMember(ownerFilter);
    activeChips.push({ label: m?.name ?? ownerFilter, clear: () => setOwnerFilter("") });
  }
  if (scoreFilter) {
    activeChips.push({
      label: scoreFilter.charAt(0).toUpperCase() + scoreFilter.slice(1),
      clear: () => setScoreFilter(""),
    });
  }

  // ── CSV export ──────────────────────────────────────────────────────────────
  function handleExport() {
    exportCsv(filteredContacts);
    toast.success(`Exporting ${visibleCount} contact${visibleCount !== 1 ? "s" : ""} to CSV`);
  }

  // ── Sort options ─────────────────────────────────────────────────────────────
  const sortOptions = [
    { value: "default", label: "Default order" },
    { value: "name", label: "Name A–Z" },
    { value: "date", label: "Wedding date" },
    { value: "score", label: "Score" },
    { value: "last_contact", label: "Last contact" },
  ];

  // Apply sort to list-view rows
  const sortedForList = React.useMemo(() => {
    const rows = [...filteredContacts];
    if (sortVal === "name") rows.sort((a, b) => a.coupleName.localeCompare(b.coupleName));
    else if (sortVal === "date")
      rows.sort((a, b) =>
        (a.weddingDate ?? "9999").localeCompare(b.weddingDate ?? "9999"),
      );
    else if (sortVal === "score") {
      const ord = { hot: 0, warm: 1, cold: 2 } as const;
      rows.sort((a, b) => ord[a.score] - ord[b.score]);
    } else if (sortVal === "last_contact") {
      rows.sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
      );
    }
    return rows;
  }, [filteredContacts, sortVal]);

  // ── Filter-chip dropdowns (stage / owner / score) ───────────────────────────
  // We render these as small select-like buttons inline with the toolbar chips.
  // Because DataToolbar's children slot is free-form, we drop native <select>s
  // styled as ghost buttons — keeps zero dep overhead, DESIGN.md-compliant.

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1400px] px-0">
        <DataToolbar
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search couples…",
          }}
          sort={
            view === "list"
              ? { value: sortVal, onChange: setSortVal, options: sortOptions }
              : undefined
          }
          view={{
            value: view,
            onChange: (v) => setView(v as "kanban" | "list"),
            options: [
              { value: "kanban", label: "Kanban view", icon: KanbanSquare },
              { value: "list", label: "List view", icon: List },
            ],
          }}
          resultCount={hasFilters ? visibleCount : totalCount}
          totalCount={totalCount}
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleExport}
                title="Export visible contacts to CSV"
              >
                <Download className="size-3.5" aria-hidden />
                Export
              </Button>
              <EntitySheet
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    title="Import contacts from CSV"
                  >
                    <Upload className="size-3.5" aria-hidden />
                    Import
                  </Button>
                }
                title="Import contacts"
                description="Upload a CSV to bulk-import enquiries. Headers: Couple name, Email, Phone, Stage, Source, Wedding date, Guests, Budget."
                onSave={() => toast.info("Import queued — you'll receive a summary shortly.")}
                saveLabel="Start import"
              >
                <div className="flex flex-col gap-4">
                  <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
                    <Upload className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />
                    <p className="text-sm font-medium text-foreground">
                      Drop your CSV here or click to browse
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Supports .csv files up to 5 MB · 500 rows max
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => toast.info("File picker (prototype — not wired)")}
                    >
                      Choose file
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Download a{" "}
                    <button
                      type="button"
                      onClick={handleExport}
                      className="underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                      template CSV
                    </button>{" "}
                    to see the expected format.
                  </p>
                </div>
              </EntitySheet>
            </>
          }
        >
          {/* Filter chips — stage, owner, score */}
          <FilterSelectChip
            label="Stage"
            value={stageFilter}
            onChange={(v) => setStageFilter(v as PipelineStage | "")}
            options={STAGES.map((s) => ({ value: s.value, label: s.label }))}
          />
          <FilterSelectChip
            label="Owner"
            value={ownerFilter}
            onChange={setOwnerFilter}
            options={TEAM.map((m) => ({ value: m.id, label: m.name }))}
          />
          <FilterSelectChip
            label="Score"
            value={scoreFilter}
            onChange={(v) => setScoreFilter(v as Contact["score"] | "")}
            options={SCORE_OPTIONS}
          />

          {/* Active filter chips (dismissible) */}
          {activeChips.map((chip) => (
            <FilterChip
              key={chip.label}
              label={chip.label}
              onRemove={chip.clear}
            />
          ))}
        </DataToolbar>
      </div>

      {/* ── Bulk action bar (list view only) ─────────────────────────────────── */}
      {view === "list" && (
        <div className="mx-auto w-full max-w-[1400px] px-0">
          <BulkActionBar
            count={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                exportCsv(
                  sortedForList.filter((c) => selectedIds.has(c.id)),
                );
                toast.success(`Exporting ${selectedIds.size} selected contact${selectedIds.size !== 1 ? "s" : ""}`);
              }}
            >
              <Download className="mr-1.5 size-3.5" aria-hidden />
              Export selected
            </Button>
          </BulkActionBar>
        </div>
      )}

      {/* ── Kanban view ───────────────────────────────────────────────────────── */}
      {view === "kanban" && (
        <div
          ref={scrollRef}
          className={cn(
            // Full-bleed horizontal scroll region.
            // Breakout matches main's padding exactly:
            //   base -mx-5 / px-5 = 20px (main: px-5)
            //   md   -mx-8 / px-8 = 32px (main: md:px-8)
            // No sm step — main has no sm padding override (stays px-5 until md).
            "-mx-5 flex-1 overflow-x-auto px-5 pb-6 md:-mx-8 md:px-8",
            // Grab cursor for drag-scroll; grabbing while dragging
            "cursor-grab",
            isDragging && "cursor-grabbing select-none",
          )}
        >
          <div
            className="inline-flex min-w-full gap-3 align-top"
            role="list"
            aria-label="Pipeline stages"
            // Prevent text selection while drag-scrolling
            style={isDragging ? { userSelect: "none" } : undefined}
          >
            {filteredColumnData.map(({ stage, contacts }) => {
              if (stage.value === "archived") {
                return (
                  <ArchivedColumn key={stage.value} contacts={contacts} />
                );
              }

              return (
                <section
                  key={stage.value}
                  role="listitem"
                  aria-label={stage.label}
                  className="flex w-[300px] shrink-0 flex-col"
                >
                  {/* Column header */}
                  <div className="mb-2 flex items-center justify-between px-0.5">
                    <StageBadge stage={stage.value} />
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      {contacts.length}
                    </span>
                  </div>

                  {/* Column body */}
                  <div
                    className={cn(
                      "flex min-h-24 flex-1 flex-col gap-2 rounded-lg p-1.5",
                      "bg-muted/40",
                    )}
                  >
                    {contacts.length > 0 ? (
                      contacts.map((c) => (
                        <PipelineCard key={c.id} contact={c} />
                      ))
                    ) : (
                      <EmptyColumn
                        stageName={stage.label}
                        isFiltered={Boolean(hasFilters)}
                      />
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* ── List view ─────────────────────────────────────────────────────────── */}
      {view === "list" && (
        /*
         * Own scroll context: flex-1 + overflow-y-auto + min-h-0 makes this
         * div fill remaining height and scroll independently of <main>.
         * SortableTable's sticky thead (top-0) then sticks to THIS container's
         * top — never overlapping the DataToolbar that's sticky to <main>'s top.
         */
        <div className="flex flex-1 min-h-0 flex-col overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-0">
            <SortableTable<Contact>
              columns={columns}
              rows={sortedForList}
              getRowId={(c) => c.id}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onRowClick={(c) => router.push(`/preview/contacts/${c.id}`)}
              stickyHeader
              emptyState={
                <EmptyListState hasFilters={Boolean(hasFilters)} />
              }
            />
            {sortedForList.length > 0 && (
              <p className="mt-2 text-right text-xs text-muted-foreground tabular-nums">
                {visibleCount} of {totalCount} contacts
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyColumn({
  stageName,
  isFiltered,
}: {
  stageName: string;
  isFiltered: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-3 py-8 text-center">
      <p className="text-xs font-medium text-muted-foreground">
        {isFiltered ? "No matches" : `No couples in ${stageName}`}
      </p>
      {!isFiltered && (
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Cards move here as enquiries progress.
        </p>
      )}
    </div>
  );
}

function EmptyListState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <KanbanSquare className="size-8 text-muted-foreground/40" aria-hidden />
      <p className="text-sm font-medium text-muted-foreground">
        {hasFilters ? "No contacts match your filters" : "No contacts in the pipeline yet"}
      </p>
      {!hasFilters && (
        <p className="text-xs text-muted-foreground/70">
          Share your enquiry form to start receiving leads.
        </p>
      )}
    </div>
  );
}

// ─── FilterSelectChip ─────────────────────────────────────────────────────────

/**
 * A compact native <select> styled as a ghost chip. Rendered inline in the
 * DataToolbar children slot. When a value is chosen the chip gains a filled
 * appearance. No JS dropdown needed — native popover keeps this light.
 */
function FilterSelectChip({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const active = Boolean(value);
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Filter by ${label}`}
        className={cn(
          // Visual reset — we style the surrounding div, not the select element
          "appearance-none h-8 rounded-full border text-[11px] font-medium",
          "pl-2.5 pr-6 cursor-pointer transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-border bg-transparent text-muted-foreground hover:bg-muted",
        )}
      >
        <option value="">{label}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {/* Chevron icon overlaid — decorative */}
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 size-3.5",
          active ? "text-primary" : "text-muted-foreground",
        )}
        aria-hidden
      />
    </div>
  );
}
