"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Send,
  Table2,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DataToolbar } from "@/components/data-toolbar";
import { SortableTable, type SortableColumn } from "@/components/sortable-table";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { TagChip } from "@/components/tag-chip";
import type { Rsvp } from "@/lib/mock";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GuestRow {
  id: string;
  name: string;
  sideLabel: string; // "Emma's" | "James's" | "Both"
  table: number | null;
  rsvp: Rsvp;
  dietary: string[];
  plusOne: boolean;
  // P0 / P1 new fields
  tags: string[];
  sessionType: "day" | "evening" | "ceremony_only";
  rsvpChasedAt: string | null;
  householdId: string | null;
  householdName: string | null;
  plusOneName: string | null;
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type RsvpFilter = "all" | "yes" | "pending" | "no";
type TagFilter = string | "all";
type SessionFilter = "all" | "day" | "evening" | "ceremony_only";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rsvpVariant(rsvp: Rsvp): "success" | "warning" | "secondary" | "destructive" {
  if (rsvp === "yes") return "success";
  if (rsvp === "pending") return "warning";
  return "secondary";
}

function rsvpLabel(rsvp: Rsvp): string {
  if (rsvp === "yes") return "Confirmed";
  if (rsvp === "pending") return "Pending";
  return "Declined";
}

function sessionLabel(s: GuestRow["sessionType"]): string {
  if (s === "evening") return "Evening";
  if (s === "ceremony_only") return "Ceremony only";
  return "Day";
}

// ---------------------------------------------------------------------------
// Table assignment popover
// ---------------------------------------------------------------------------

const TABLE_COUNT = 12;

function TableAssignPopover({
  current,
  guestName,
  onAssign,
}: {
  current: number | null;
  guestName: string;
  onAssign: (t: number | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            current != null ? `Table ${current} — click to change` : "Assign table"
          }
          className={cn(
            "inline-flex min-h-[32px] min-w-[52px] items-center justify-center gap-1 rounded-md px-2 py-1",
            "text-sm tabular-nums transition-colors",
            "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            current != null
              ? "font-medium text-foreground"
              : "text-muted-foreground/50 hover:text-muted-foreground",
          )}
        >
          {current != null ? (
            <>
              {current}
              <ChevronDown className="size-3 text-muted-foreground" aria-hidden />
            </>
          ) : (
            <>
              <Table2 className="size-3.5" aria-hidden />
              <span className="text-xs">—</span>
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="center" sideOffset={4} className="w-52 p-2">
        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Assign table — {guestName.split(" ")[0]}
        </p>
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onAssign(t);
                setOpen(false);
              }}
              className={cn(
                "flex min-h-[36px] items-center justify-center rounded-md text-sm font-medium tabular-nums transition-colors",
                "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                current === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {current != null && (
          <button
            type="button"
            onClick={() => {
              onAssign(null);
              setOpen(false);
            }}
            className={cn(
              "mt-1.5 flex w-full min-h-[32px] items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground",
              "hover:bg-muted hover:text-foreground transition-colors",
            )}
          >
            <X className="size-3" aria-hidden /> Clear table
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Filter chip (for toolbar children)
// ---------------------------------------------------------------------------

function FilterPill({
  active,
  label,
  count,
  onClick,
  onRemove,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
            active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
      {active && onRemove && (
        <span
          role="button"
          aria-label={`Remove ${label} filter`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 flex size-3.5 items-center justify-center rounded-full hover:opacity-70"
        >
          <X className="size-2.5" aria-hidden />
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GuestTable({ guests }: { guests: GuestRow[] }) {
  // ── Local mutable state (optimistic) ────────────────────────────────────
  const [tableMap, setTableMap] = useState<Record<string, number | null>>(() => {
    const m: Record<string, number | null> = {};
    guests.forEach((g) => { m[g.id] = g.table; });
    return m;
  });

  const [chasedSet, setChasedSet] = useState<Set<string>>(() => {
    const s = new Set<string>();
    guests.forEach((g) => { if (g.rsvpChasedAt) s.add(g.id); });
    return s;
  });

  // ── Selection ────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Filters ──────────────────────────────────────────────────────────────
  const [searchValue, setSearchValue] = useState("");
  const [rsvpFilter, setRsvpFilter] = useState<RsvpFilter>("all");
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [sortValue, setSortValue] = useState("name");

  // ── Derived counts for filter chips ──────────────────────────────────────
  const counts = useMemo(() => ({
    yes: guests.filter((g) => g.rsvp === "yes").length,
    pending: guests.filter((g) => g.rsvp === "pending").length,
    no: guests.filter((g) => g.rsvp === "no").length,
    day: guests.filter((g) => g.sessionType === "day").length,
    evening: guests.filter((g) => g.sessionType === "evening").length,
    VIP: guests.filter((g) => g.tags.includes("VIP")).length,
    Family: guests.filter((g) => g.tags.includes("Family")).length,
    "Wedding party": guests.filter((g) => g.tags.includes("Wedding party")).length,
    Kids: guests.filter((g) => g.tags.includes("Kids")).length,
  }), [guests]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = guests;

    if (searchValue.trim()) {
      const q = searchValue.trim().toLowerCase();
      rows = rows.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.householdName?.toLowerCase().includes(q) ?? false) ||
          (g.plusOneName?.toLowerCase().includes(q) ?? false),
      );
    }

    if (rsvpFilter !== "all") {
      rows = rows.filter((g) => g.rsvp === rsvpFilter);
    }

    if (tagFilter !== "all") {
      rows = rows.filter((g) => g.tags.includes(tagFilter));
    }

    if (sessionFilter !== "all") {
      rows = rows.filter((g) => g.sessionType === sessionFilter);
    }

    return rows;
  }, [guests, searchValue, rsvpFilter, tagFilter, sessionFilter]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleChaseRsvp = useCallback((ids: string[]) => {
    const pending = ids.filter((id) => {
      const g = guests.find((x) => x.id === id);
      return g && g.rsvp === "pending";
    });
    if (pending.length === 0) {
      toast.info("No pending guests in selection");
      return;
    }
    setChasedSet((prev) => {
      const next = new Set(prev);
      pending.forEach((id) => next.add(id));
      return next;
    });
    toast.success(
      `RSVP chase sent to ${pending.length} guest${pending.length !== 1 ? "s" : ""}`,
      { description: "Reminder queued via the couple portal." },
    );
  }, [guests]);

  const handleBulkChase = useCallback(() => {
    handleChaseRsvp(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, handleChaseRsvp]);

  const handleRowChase = useCallback((id: string) => {
    handleChaseRsvp([id]);
  }, [handleChaseRsvp]);

  const handleTableAssign = useCallback((id: string, t: number | null, name: string) => {
    setTableMap((prev) => ({ ...prev, [id]: t }));
    toast.success(
      t != null ? `${name.split(" ")[0]} assigned to table ${t}` : `Table cleared for ${name.split(" ")[0]}`,
    );
  }, []);

  // ── Columns ──────────────────────────────────────────────────────────────

  const columns: SortableColumn<GuestRow>[] = useMemo(() => [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (g) => g.name,
      render: (g) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground leading-snug">{g.name}</span>
          {g.householdName && (
            <span className="text-[11px] text-muted-foreground leading-none">{g.householdName}</span>
          )}
        </div>
      ),
    },
    {
      key: "tags",
      header: "Tags",
      sortable: false,
      render: (g) => (
        <div className="flex flex-wrap gap-1">
          {g.tags.length > 0
            ? g.tags.map((tag) => <TagChip key={tag} tag={tag} />)
            : <span className="text-muted-foreground/40 text-xs">—</span>}
        </div>
      ),
    },
    {
      key: "session",
      header: "Session",
      sortable: true,
      sortValue: (g) => g.sessionType,
      render: (g) => (
        <span
          className={cn(
            "text-xs font-medium",
            g.sessionType === "evening" ? "text-warning-foreground" : "text-muted-foreground",
          )}
        >
          {sessionLabel(g.sessionType)}
        </span>
      ),
    },
    {
      key: "side",
      header: "Side",
      sortable: true,
      sortValue: (g) => g.sideLabel,
      render: (g) => (
        <span className="text-sm text-muted-foreground">{g.sideLabel}</span>
      ),
    },
    {
      key: "table",
      header: "Table",
      sortable: true,
      align: "center",
      sortValue: (g) => tableMap[g.id] ?? 999,
      render: (g) => (
        <TableAssignPopover
          current={tableMap[g.id] ?? null}
          guestName={g.name}
          onAssign={(t) => handleTableAssign(g.id, t, g.name)}
        />
      ),
    },
    {
      key: "rsvp",
      header: "RSVP",
      sortable: true,
      sortValue: (g) => g.rsvp,
      render: (g) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={rsvpVariant(g.rsvp)}>{rsvpLabel(g.rsvp)}</Badge>
          {g.rsvp === "pending" && (
            <button
              type="button"
              title={chasedSet.has(g.id) ? "Chase sent" : "Send RSVP chase"}
              aria-label={chasedSet.has(g.id) ? `Chase already sent to ${g.name}` : `Chase RSVP from ${g.name}`}
              onClick={(e) => { e.stopPropagation(); handleRowChase(g.id); }}
              className={cn(
                "flex min-h-[28px] min-w-[28px] items-center justify-center rounded-md p-1 transition-colors",
                chasedSet.has(g.id)
                  ? "text-success-foreground opacity-60 cursor-default"
                  : "text-muted-foreground hover:bg-warning/20 hover:text-warning-foreground",
              )}
            >
              <Send className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      ),
    },
    {
      key: "dietary",
      header: "Dietary",
      sortable: false,
      render: (g) => (
        g.dietary.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {g.dietary.map((d) => (
              <span
                key={d}
                className="inline-flex items-center rounded-full bg-warning/50 px-2 py-0.5 text-[11px] font-medium text-warning-foreground"
              >
                {d}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )
      ),
    },
    {
      key: "plus_one",
      header: "+1",
      sortable: true,
      align: "center",
      sortValue: (g) => (g.plusOne ? 0 : 1),
      render: (g) => (
        g.plusOne ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] text-fun-green-strong font-semibold">Yes</span>
            {g.plusOneName && (
              <span className="text-[10px] text-muted-foreground leading-none max-w-[80px] truncate">
                {g.plusOneName}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-xs text-center block">—</span>
        )
      ),
    },
  ], [tableMap, chasedSet, handleTableAssign, handleRowChase]);

  // ── Sort options for select ───────────────────────────────────────────────

  const sortOptions = [
    { value: "name", label: "Name A–Z" },
    { value: "rsvp", label: "RSVP status" },
    { value: "table", label: "Table number" },
    { value: "session", label: "Session" },
    { value: "plus_one", label: "+1 first" },
  ];

  // Map sortValue to initialSort for SortableTable
  const initialSort = useMemo(
    () => ({ key: sortValue, dir: "asc" as const }),
    [sortValue],
  );

  // Active filter count for result display
  const activeFilterCount = [
    rsvpFilter !== "all",
    tagFilter !== "all",
    sessionFilter !== "all",
  ].filter(Boolean).length;

  const resultCount = filtered.length;
  const totalCount = guests.length;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* DataToolbar */}
      <DataToolbar
        search={{
          value: searchValue,
          onChange: setSearchValue,
          placeholder: "Search guests, households…",
        }}
        sort={{
          value: sortValue,
          onChange: setSortValue,
          options: sortOptions,
        }}
        resultCount={resultCount}
        totalCount={totalCount}
      >
        {/* RSVP filter chips */}
        <FilterPill
          active={rsvpFilter === "yes"}
          label="Confirmed"
          count={counts.yes}
          onClick={() => setRsvpFilter(rsvpFilter === "yes" ? "all" : "yes")}
          onRemove={() => setRsvpFilter("all")}
        />
        <FilterPill
          active={rsvpFilter === "pending"}
          label="Pending"
          count={counts.pending}
          onClick={() => setRsvpFilter(rsvpFilter === "pending" ? "all" : "pending")}
          onRemove={() => setRsvpFilter("all")}
        />
        <FilterPill
          active={rsvpFilter === "no"}
          label="Declined"
          count={counts.no}
          onClick={() => setRsvpFilter(rsvpFilter === "no" ? "all" : "no")}
          onRemove={() => setRsvpFilter("all")}
        />

        {/* Session filter */}
        <div
          aria-hidden
          className="hidden sm:block h-4 w-px bg-border shrink-0"
        />
        <FilterPill
          active={sessionFilter === "day"}
          label="Day"
          count={counts.day}
          onClick={() => setSessionFilter(sessionFilter === "day" ? "all" : "day")}
          onRemove={() => setSessionFilter("all")}
        />
        <FilterPill
          active={sessionFilter === "evening"}
          label="Evening"
          count={counts.evening}
          onClick={() => setSessionFilter(sessionFilter === "evening" ? "all" : "evening")}
          onRemove={() => setSessionFilter("all")}
        />

        {/* Tag filters */}
        <div
          aria-hidden
          className="hidden sm:block h-4 w-px bg-border shrink-0"
        />
        {(["VIP", "Family", "Wedding party", "Kids"] as const).map((tag) => (
          <FilterPill
            key={tag}
            active={tagFilter === tag}
            label={tag}
            count={counts[tag]}
            onClick={() => setTagFilter(tagFilter === tag ? "all" : tag)}
            onRemove={() => setTagFilter("all")}
          />
        ))}
      </DataToolbar>

      {/* Bulk action bar */}
      <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBulkChase}
          className="gap-1.5"
        >
          <Send className="size-3.5" aria-hidden />
          Chase RSVP
        </Button>
      </BulkActionBar>

      {/* Table */}
      <SortableTable<GuestRow>
        columns={columns}
        rows={filtered}
        getRowId={(g) => g.id}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        initialSort={initialSort}
        stickyHeader
        emptyState={
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-foreground mb-1">
              {activeFilterCount > 0 || searchValue
                ? "No guests match these filters"
                : "No guests yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {activeFilterCount > 0 || searchValue
                ? "Try clearing a filter or adjusting your search."
                : "Guests will appear here once they've been added to the wedding."}
            </p>
          </div>
        }
      />

      {/* Footer count */}
      <p className="text-right text-[11px] tabular-nums text-muted-foreground select-none">
        Showing{" "}
        <span className="font-semibold text-foreground">{resultCount}</span>{" "}
        of {totalCount} guests
        {activeFilterCount > 0 && (
          <>
            {" "}·{" "}
            <button
              type="button"
              onClick={() => {
                setRsvpFilter("all");
                setTagFilter("all");
                setSessionFilter("all");
                setSearchValue("");
              }}
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Clear all filters
            </button>
          </>
        )}
      </p>
    </div>
  );
}
