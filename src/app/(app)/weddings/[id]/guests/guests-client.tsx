"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Send, Table2, X, ChevronDown, UserPlus } from "lucide-react";
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
import { GuestSheet } from "./guest-sheet";
import { assignTable, chaseRsvp } from "./actions";
import type { Tables } from "@/lib/supabase/types";

type GuestRow = Tables<"wedding_guests">;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RsvpFilter = "all" | "yes" | "pending" | "no";
type SessionFilter = "all" | "day" | "evening" | "ceremony_only";

interface Props {
  weddingId: string;
  guests: GuestRow[];
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function rsvpVariant(rsvp: string): "success" | "warning" | "secondary" {
  if (rsvp === "yes") return "success";
  if (rsvp === "pending") return "warning";
  return "secondary";
}

function rsvpLabel(rsvp: string): string {
  if (rsvp === "yes") return "Confirmed";
  if (rsvp === "pending") return "Pending";
  return "Declined";
}

function sessionLabel(s: string | null): string {
  if (s === "evening") return "Evening";
  if (s === "ceremony_only") return "Ceremony only";
  return "Day";
}

// ---------------------------------------------------------------------------
// Table assignment popover
// ---------------------------------------------------------------------------

const TABLE_COUNT = 20;

function TableAssignPopover({
  current,
  guestName,
  guestId,
  weddingId,
  onOptimisticUpdate,
}: {
  current: number | null;
  guestName: string;
  guestId: string;
  weddingId: string;
  onOptimisticUpdate: (id: string, t: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleAssign(t: number | null) {
    onOptimisticUpdate(guestId, t);
    setOpen(false);
    startTransition(async () => {
      const result = await assignTable({ guestId, weddingId, tableNumber: t });
      if (!result.ok) {
        toast.error(result.error);
        onOptimisticUpdate(guestId, current); // rollback
      } else {
        toast.success(
          t != null
            ? `${guestName.split(" ")[0]} → table ${t}`
            : `Table cleared for ${guestName.split(" ")[0]}`,
        );
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={current != null ? `Table ${current} — click to change` : "Assign table"}
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
            <>{current}<ChevronDown className="size-3 text-muted-foreground" aria-hidden /></>
          ) : (
            <><Table2 className="size-3.5" aria-hidden /><span className="text-xs">—</span></>
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
              onClick={() => handleAssign(t)}
              className={cn(
                "flex min-h-[36px] items-center justify-center rounded-md text-sm font-medium tabular-nums transition-colors",
                "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                current === t ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {current != null && (
          <button
            type="button"
            onClick={() => handleAssign(null)}
            className="mt-1.5 flex w-full min-h-[32px] items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-3" aria-hidden /> Clear table
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Filter pill
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
        <span className={cn(
          "inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
          active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
        )}>
          {count}
        </span>
      )}
      {active && onRemove && (
        <span
          role="button"
          aria-label={`Remove ${label} filter`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
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

export function GuestsClient({ weddingId, guests: initialGuests }: Props) {
  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<GuestRow | null>(null);

  // Optimistic table map (guest id → table number)
  const [tableMap, setTableMap] = useState<Record<string, number | null>>(() => {
    const m: Record<string, number | null> = {};
    initialGuests.forEach((g) => { m[g.id] = g.table_number; });
    return m;
  });

  // Optimistic chased set
  const [chasedSet, setChasedSet] = useState<Set<string>>(() => {
    const s = new Set<string>();
    initialGuests.forEach((g) => { if (g.rsvp_chased_at) s.add(g.id); });
    return s;
  });

  // Filters / search / sort
  const [searchValue, setSearchValue] = useState("");
  const [rsvpFilter, setRsvpFilter] = useState<RsvpFilter>("all");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [sortValue, setSortValue] = useState("name");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [, startChaseTransition] = useTransition();

  // Sync tableMap when guests prop changes (after server revalidation)
  const guests = useMemo(() => {
    return initialGuests.map((g) => ({
      ...g,
      table_number: tableMap[g.id] !== undefined ? tableMap[g.id] : g.table_number,
    }));
  }, [initialGuests, tableMap]);

  const counts = useMemo(() => ({
    yes: guests.filter((g) => g.rsvp === "yes").length,
    pending: guests.filter((g) => g.rsvp === "pending").length,
    no: guests.filter((g) => g.rsvp === "no").length,
    day: guests.filter((g) => (g.session_type ?? "day") === "day").length,
    evening: guests.filter((g) => g.session_type === "evening").length,
  }), [guests]);

  const filtered = useMemo(() => {
    let rows = guests;
    if (searchValue.trim()) {
      const q = searchValue.trim().toLowerCase();
      rows = rows.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.household_name?.toLowerCase().includes(q) ?? false) ||
          (g.plus_one_name?.toLowerCase().includes(q) ?? false),
      );
    }
    if (rsvpFilter !== "all") rows = rows.filter((g) => g.rsvp === rsvpFilter);
    if (sessionFilter !== "all") rows = rows.filter((g) => (g.session_type ?? "day") === sessionFilter);
    return rows;
  }, [guests, searchValue, rsvpFilter, sessionFilter]);

  const handleOptimisticTableUpdate = useCallback((id: string, t: number | null) => {
    setTableMap((prev) => ({ ...prev, [id]: t }));
  }, []);

  const handleRowChase = useCallback((guestId: string) => {
    const g = guests.find((x) => x.id === guestId);
    if (!g || g.rsvp !== "pending") {
      toast.info("Guest is not pending");
      return;
    }
    setChasedSet((prev) => new Set(prev).add(guestId));
    startChaseTransition(async () => {
      const result = await chaseRsvp({ guestId, weddingId });
      if (!result.ok) toast.error(result.error);
      else toast.success("RSVP chase recorded");
    });
  }, [guests, weddingId]);

  const handleBulkChase = useCallback(() => {
    const pending = Array.from(selectedIds).filter((id) => {
      const g = guests.find((x) => x.id === id);
      return g?.rsvp === "pending";
    });
    if (pending.length === 0) { toast.info("No pending guests selected"); return; }
    pending.forEach((id) => setChasedSet((prev) => new Set(prev).add(id)));
    setSelectedIds(new Set());
    startChaseTransition(async () => {
      await Promise.all(pending.map((guestId) => chaseRsvp({ guestId, weddingId })));
      toast.success(`Chase recorded for ${pending.length} guest${pending.length !== 1 ? "s" : ""}`);
    });
  }, [selectedIds, guests, weddingId]);

  const columns: SortableColumn<GuestRow>[] = useMemo(() => [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (g) => g.name,
      render: (g) => (
        <button
          type="button"
          onClick={() => { setEditingGuest(g); setSheetOpen(true); }}
          className="text-left hover:underline"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground leading-snug">{g.name}</span>
            {g.household_name && (
              <span className="text-[11px] text-muted-foreground leading-none">{g.household_name}</span>
            )}
          </div>
        </button>
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
      sortValue: (g) => g.session_type ?? "day",
      render: (g) => (
        <span className={cn("text-xs font-medium",
          g.session_type === "evening" ? "text-warning-foreground" : "text-muted-foreground",
        )}>
          {sessionLabel(g.session_type)}
        </span>
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
          guestId={g.id}
          weddingId={weddingId}
          onOptimisticUpdate={handleOptimisticTableUpdate}
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
              <span key={d} className="inline-flex items-center rounded-full bg-warning/50 px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                {d}
              </span>
            ))}
          </div>
        ) : <span className="text-muted-foreground/40 text-xs">—</span>
      ),
    },
    {
      key: "plus_one",
      header: "+1",
      sortable: true,
      align: "center",
      sortValue: (g) => (g.plus_one ? 0 : 1),
      render: (g) => (
        g.plus_one ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] text-fun-green-strong font-semibold">Yes</span>
            {g.plus_one_name && (
              <span className="text-[10px] text-muted-foreground leading-none max-w-[80px] truncate">{g.plus_one_name}</span>
            )}
          </div>
        ) : <span className="text-muted-foreground/40 text-xs text-center block">—</span>
      ),
    },
  ], [tableMap, chasedSet, handleOptimisticTableUpdate, handleRowChase, weddingId]);

  const activeFilterCount = [rsvpFilter !== "all", sessionFilter !== "all"].filter(Boolean).length;
  const initialSort = useMemo(() => ({ key: sortValue, dir: "asc" as const }), [sortValue]);

  function openAdd() { setEditingGuest(null); setSheetOpen(true); }
  function handleSheetClose(open: boolean) {
    setSheetOpen(open);
    if (!open) setEditingGuest(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button onClick={openAdd} size="sm" className="gap-1.5">
          <Plus className="size-3.5" aria-hidden />
          Add guest
        </Button>
      </div>

      <DataToolbar
        search={{ value: searchValue, onChange: setSearchValue, placeholder: "Search guests, households…" }}
        sort={{
          value: sortValue,
          onChange: setSortValue,
          options: [
            { value: "name", label: "Name A–Z" },
            { value: "rsvp", label: "RSVP status" },
            { value: "table", label: "Table number" },
            { value: "session", label: "Session" },
          ],
        }}
        resultCount={filtered.length}
        totalCount={guests.length}
      >
        <FilterPill active={rsvpFilter === "yes"} label="Confirmed" count={counts.yes}
          onClick={() => setRsvpFilter(rsvpFilter === "yes" ? "all" : "yes")}
          onRemove={() => setRsvpFilter("all")} />
        <FilterPill active={rsvpFilter === "pending"} label="Pending" count={counts.pending}
          onClick={() => setRsvpFilter(rsvpFilter === "pending" ? "all" : "pending")}
          onRemove={() => setRsvpFilter("all")} />
        <FilterPill active={rsvpFilter === "no"} label="Declined" count={counts.no}
          onClick={() => setRsvpFilter(rsvpFilter === "no" ? "all" : "no")}
          onRemove={() => setRsvpFilter("all")} />
        <div aria-hidden className="hidden sm:block h-4 w-px bg-border shrink-0" />
        <FilterPill active={sessionFilter === "day"} label="Day" count={counts.day}
          onClick={() => setSessionFilter(sessionFilter === "day" ? "all" : "day")}
          onRemove={() => setSessionFilter("all")} />
        <FilterPill active={sessionFilter === "evening"} label="Evening" count={counts.evening}
          onClick={() => setSessionFilter(sessionFilter === "evening" ? "all" : "evening")}
          onRemove={() => setSessionFilter("all")} />
      </DataToolbar>

      <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
        <Button variant="outline" size="sm" onClick={handleBulkChase} className="gap-1.5">
          <Send className="size-3.5" aria-hidden />
          Chase RSVP
        </Button>
      </BulkActionBar>

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
          <div className="py-12 text-center">
            <UserPlus className="mx-auto mb-3 size-8 text-muted-foreground/40" aria-hidden />
            <p className="mb-1 text-sm font-medium text-foreground">
              {activeFilterCount > 0 || searchValue ? "No guests match these filters" : "No guests yet"}
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              {activeFilterCount > 0 || searchValue
                ? "Try clearing a filter or adjusting your search."
                : "Add your first guest to get started."}
            </p>
            {!activeFilterCount && !searchValue && (
              <Button onClick={openAdd} size="sm" variant="outline" className="gap-1.5">
                <Plus className="size-3.5" aria-hidden />
                Add guest
              </Button>
            )}
          </div>
        }
      />

      <p className="text-right text-[11px] tabular-nums text-muted-foreground select-none">
        Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {guests.length} guests
        {activeFilterCount > 0 && (
          <> ·{" "}
            <button type="button"
              onClick={() => { setRsvpFilter("all"); setSessionFilter("all"); setSearchValue(""); }}
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >Clear all filters</button>
          </>
        )}
      </p>

      <GuestSheet
        open={sheetOpen}
        onOpenChange={handleSheetClose}
        weddingId={weddingId}
        guest={editingGuest}
      />
    </div>
  );
}
