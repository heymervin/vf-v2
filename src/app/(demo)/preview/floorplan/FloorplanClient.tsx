"use client";

/**
 * FloorplanClient — real spatial seating planner for the VenueFlow prototype.
 *
 * P0 features:
 *  - Spatial canvas: FloorCanvas with room elements, each table positioned
 *    by x/y% centered via translate(-50%,-50%).
 *  - ShapedTable per FLOORPLAN_TABLES entry with seated guests derived from
 *    the primary wedding guest list grouped by table number.
 *  - Right panel: clicking a table reveals its guests; an unassigned pool
 *    shows guests with no table (or pending RSVP).
 *  - Assign flow: click an unassigned guest to select them, then click a
 *    table to assign — optimistic state + sonner toast.
 *
 * P1 features:
 *  - Canvas / list view toggle via DataToolbar.
 *  - Dietary overlay toggle (tints seats with dietary requirements).
 *  - Table labels shown on hover via ShapedTable tooltip.
 *  - SortableTable in list view for the full guest roster.
 */

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Map as MapIcon,
  List,
  Salad,
  Users,
  UserX,
  X,
  ChevronRight,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataToolbar } from "@/components/data-toolbar";
import { SortableTable, type SortableColumn } from "@/components/sortable-table";
import { FloorCanvas } from "@/components/floorplan/floor-canvas";
import { ShapedTable } from "@/components/floorplan/shaped-table";
import { TagChip } from "@/components/tag-chip";
import type { Guest, Rsvp } from "@/lib/mock";
import type { FloorplanTable } from "@/lib/mock/planning";
import type { RoomElement } from "@/lib/mock/planning";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FloorplanClientProps {
  floorplanTables: FloorplanTable[];
  roomElements: RoomElement[];
  /** All guests for the primary wedding */
  guests: Guest[];
  totalSeated: number;
  totalGuests: number;
}

type ViewMode = "canvas" | "list";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rsvpBadgeVariant(rsvp: Rsvp): "success" | "destructive" | "secondary" {
  if (rsvp === "yes") return "success";
  if (rsvp === "no") return "destructive";
  return "secondary";
}

function rsvpLabel(rsvp: Rsvp): string {
  if (rsvp === "yes") return "Attending";
  if (rsvp === "no") return "Declined";
  return "Pending";
}

function dietaryBadgeVariant(d: string): "warning" | "success" | "destructive" | "secondary" | "default" {
  const l = d.toLowerCase();
  if (l.includes("vegan")) return "success";
  if (l.includes("vegetarian")) return "success";
  if (l.includes("nut")) return "destructive";
  if (l.includes("gluten")) return "warning";
  return "secondary";
}

/** Derive the guest list for a specific table number, reflecting optimistic overrides. */
function guestsAtTable(
  tableNumber: number,
  guests: Guest[],
  overrides: Map<string, number | null>
): Guest[] {
  return guests.filter((g) => {
    const eff = overrides.has(g.id) ? overrides.get(g.id) : g.table;
    return eff === tableNumber && g.rsvp !== "no";
  });
}

function isUnassigned(g: Guest, overrides: Map<string, number | null>): boolean {
  if (g.rsvp === "no") return false;
  const eff = overrides.has(g.id) ? overrides.get(g.id) : g.table;
  return eff === null;
}

// ---------------------------------------------------------------------------
// DietaryChip
// ---------------------------------------------------------------------------

function DietaryChip({ label }: { label: string }) {
  return (
    <Badge
      variant={dietaryBadgeVariant(label)}
      className="text-[10px] py-0 px-1.5"
    >
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// GuestRow (side panel + unassigned pool)
// ---------------------------------------------------------------------------

function GuestRow({
  guest,
  isSelectable = false,
  isSelected = false,
  onSelect,
}: {
  guest: Guest;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const initials = guest.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <li
      className={cn(
        "flex min-h-[44px] items-start gap-3 py-2.5 px-3",
        "border-b border-border last:border-0",
        isSelectable &&
          "cursor-pointer transition-colors hover:bg-accent/40 rounded-lg",
        isSelected && "bg-fun-blue/20 hover:bg-fun-blue/25",
      )}
      onClick={isSelectable ? onSelect : undefined}
      role={isSelectable ? "option" : undefined}
      aria-selected={isSelectable ? isSelected : undefined}
    >
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          "text-[11px] font-semibold",
          isSelected
            ? "bg-fun-blue text-fun-blue-strong"
            : "bg-muted text-muted-foreground",
        )}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight text-foreground">
          {guest.name}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge
            variant={rsvpBadgeVariant(guest.rsvp)}
            className="text-[10px] py-0 px-1.5"
          >
            {rsvpLabel(guest.rsvp)}
          </Badge>
          {guest.dietary.map((d) => (
            <DietaryChip key={d} label={d} />
          ))}
          {(guest.tags ?? []).map((t) => (
            <TagChip key={t} tag={t} className="text-[10px] py-0 px-1.5" />
          ))}
        </div>
      </div>
      {isSelected && (
        <Check className="mt-1 size-4 shrink-0 text-fun-blue-strong" aria-hidden />
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Summary strip
// ---------------------------------------------------------------------------

function SummaryStrip({
  totalSeated,
  totalGuests,
  unassignedCount,
}: {
  totalSeated: number;
  totalGuests: number;
  unassignedCount: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-border pb-4 mb-4">
      <div className="rounded-lg bg-accent/50 px-3 py-2 text-center">
        <p className="text-lg font-bold tabular-nums leading-none text-foreground">
          {totalSeated}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">Seated</p>
      </div>
      <div className="rounded-lg bg-accent/50 px-3 py-2 text-center">
        <p className="text-lg font-bold tabular-nums leading-none text-foreground">
          {totalGuests}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">Confirmed</p>
      </div>
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-center",
          unassignedCount > 0 ? "bg-warning/30" : "bg-fun-green/30",
        )}
      >
        <p
          className={cn(
            "text-lg font-bold tabular-nums leading-none",
            unassignedCount > 0 ? "text-warning-foreground" : "text-foreground",
          )}
        >
          {unassignedCount}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">Unassigned</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right panel — table detail + unassigned pool
// ---------------------------------------------------------------------------

interface RightPanelProps {
  selectedTable: FloorplanTable | null;
  tableGuests: Guest[];
  unassigned: Guest[];
  totalSeated: number;
  totalGuests: number;
  pendingGuestId: string | null;
  onCloseTable: () => void;
  onSelectGuest: (guestId: string) => void;
}

function RightPanel({
  selectedTable,
  tableGuests,
  unassigned,
  totalSeated,
  totalGuests,
  pendingGuestId,
  onCloseTable,
  onSelectGuest,
}: RightPanelProps) {
  const [tab, setTab] = useState<"table" | "unassigned">("unassigned");

  // When a table is selected, switch to table tab automatically.
  // When deselected, revert to unassigned.
  const activeTab = selectedTable ? "table" : "unassigned";

  return (
    <div className="flex flex-col h-full">
      <SummaryStrip
        totalSeated={totalSeated}
        totalGuests={totalGuests}
        unassignedCount={unassigned.length}
      />

      {/* Tab strip */}
      <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5 mb-4 shrink-0">
        <button
          onClick={() => {
            if (selectedTable) onCloseTable();
          }}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px]",
            !selectedTable
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={!selectedTable}
        >
          <span className="flex items-center justify-center gap-1.5">
            <UserX className="size-3.5" />
            Unassigned
            {unassigned.length > 0 && (
              <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                {unassigned.length}
              </Badge>
            )}
          </span>
        </button>
        <button
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px]",
            selectedTable
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground",
            !selectedTable && "opacity-50 cursor-default",
          )}
          disabled={!selectedTable}
          aria-pressed={!!selectedTable}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Users className="size-3.5" />
            {selectedTable ? `Table ${selectedTable.tableNumber}` : "Table"}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "table" && selectedTable ? (
          <div>
            {/* Table header */}
            <div className="flex items-start justify-between mb-3 px-1">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {selectedTable.label ?? `Table ${selectedTable.tableNumber}`}
                </p>
                <p className="text-sm font-medium text-foreground">
                  {tableGuests.length} of {selectedTable.capacity} seated
                </p>
                {pendingGuestId && (
                  <p className="mt-1 text-xs text-fun-blue-strong font-medium">
                    Click this table on the canvas to assign the selected guest
                  </p>
                )}
              </div>
              <button
                onClick={onCloseTable}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Deselect table"
              >
                <X className="size-4" />
              </button>
            </div>
            {tableGuests.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center px-4">
                <UserX className="mb-2 size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No guests assigned yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Select a guest from the Unassigned tab, then click a table on the canvas.
                </p>
              </div>
            ) : (
              <ul aria-label={`Guests at table ${selectedTable.tableNumber}`}>
                {tableGuests.map((g) => (
                  <GuestRow key={g.id} guest={g} />
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div>
            {pendingGuestId ? (
              <div className="mb-3 rounded-lg bg-fun-blue/15 border border-fun-blue-strong/30 px-3 py-2.5">
                <p className="text-xs font-medium text-fun-blue-strong">
                  Guest selected — click a table on the canvas to assign them.
                </p>
              </div>
            ) : (
              unassigned.length > 0 && (
                <p className="mb-3 text-xs text-muted-foreground px-1">
                  Select a guest, then click a table on the canvas to assign them.
                </p>
              )
            )}
            {unassigned.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center px-4">
                <Users className="mb-2 size-8 text-fun-green-strong/60" />
                <p className="text-sm font-medium text-foreground">
                  All guests seated
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Every confirmed guest has a table assignment.
                </p>
              </div>
            ) : (
              <ul role="listbox" aria-label="Unassigned guests — select to assign">
                {unassigned.map((g) => (
                  <GuestRow
                    key={g.id}
                    guest={g}
                    isSelectable
                    isSelected={pendingGuestId === g.id}
                    onSelect={() => onSelectGuest(g.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List-view guest table columns
// ---------------------------------------------------------------------------

function buildColumns(
  floorplanTables: FloorplanTable[],
  overrides: Map<string, number | null>
): SortableColumn<Guest>[] {
  return [
    {
      key: "name",
      header: "Guest",
      sortable: true,
      render: (g) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
            {g.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </span>
          <span className="text-sm font-medium text-foreground truncate">
            {g.name}
          </span>
        </div>
      ),
      sortValue: (g) => g.name,
    },
    {
      key: "table",
      header: "Table",
      sortable: true,
      align: "center",
      render: (g) => {
        const eff = overrides.has(g.id) ? overrides.get(g.id) : g.table;
        const ft = eff !== null && eff !== undefined
          ? floorplanTables.find((t) => t.tableNumber === eff)
          : null;
        if (!eff) {
          return (
            <Badge variant="secondary" className="text-[10px]">
              Unassigned
            </Badge>
          );
        }
        return (
          <span className="tabular-nums text-sm font-medium text-foreground">
            {ft ? ft.tableNumber : eff}
          </span>
        );
      },
      sortValue: (g) => {
        const eff = overrides.has(g.id) ? overrides.get(g.id) : g.table;
        return eff ?? 999;
      },
    },
    {
      key: "rsvp",
      header: "RSVP",
      sortable: true,
      render: (g) => (
        <Badge variant={rsvpBadgeVariant(g.rsvp)} className="text-[10px]">
          {rsvpLabel(g.rsvp)}
        </Badge>
      ),
      sortValue: (g) => g.rsvp,
    },
    {
      key: "dietary",
      header: "Dietary",
      render: (g) =>
        g.dietary.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {g.dietary.map((d) => (
              <DietaryChip key={d} label={d} />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "tags",
      header: "Tags",
      render: (g) =>
        (g.tags ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {(g.tags ?? []).map((t) => (
              <TagChip key={t} tag={t} />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "session",
      header: "Session",
      sortable: true,
      render: (g) => (
        <span className="text-xs text-muted-foreground capitalize">
          {g.sessionType ?? "day"}
        </span>
      ),
      sortValue: (g) => g.sessionType ?? "day",
    },
  ];
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function FloorplanClient({
  floorplanTables,
  roomElements,
  guests,
  totalSeated: initialSeated,
  totalGuests,
}: FloorplanClientProps) {
  // ── View & overlay state ────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("canvas");
  const [overlay, setOverlay] = useState<"none" | "dietary">("none");

  // ── Canvas selection ────────────────────────────────────────────────────
  /** The floorplan table (from FLOORPLAN_TABLES) that's currently selected */
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // ── Assignment flow ─────────────────────────────────────────────────────
  /** Guest id selected from the unassigned pool, awaiting a table click */
  const [pendingGuestId, setPendingGuestId] = useState<string | null>(null);

  /** Optimistic overrides: guestId → tableNumber (or null = unassigned) */
  const [tableOverrides, setTableOverrides] = useState<Map<string, number | null>>(
    new Map()
  );

  // ── Search ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");

  // ── Derived data ────────────────────────────────────────────────────────

  const unassigned = useMemo(
    () => guests.filter((g) => isUnassigned(g, tableOverrides)),
    [guests, tableOverrides]
  );

  const totalSeated = useMemo(
    () =>
      guests.filter((g) => {
        if (g.rsvp === "no") return false;
        const eff = tableOverrides.has(g.id) ? tableOverrides.get(g.id) : g.table;
        return eff !== null;
      }).length,
    [guests, tableOverrides]
  );

  const selectedFt = floorplanTables.find((t) => t.id === selectedTableId) ?? null;

  const tableGuests = useMemo(
    () =>
      selectedFt
        ? guestsAtTable(selectedFt.tableNumber, guests, tableOverrides)
        : [],
    [selectedFt, guests, tableOverrides]
  );

  // Search-filtered guest list for the list view
  const filteredGuests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.dietary ?? []).some((d) => d.toLowerCase().includes(q)) ||
        (g.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  }, [guests, search]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleTableClick = useCallback(
    (ft: FloorplanTable) => {
      if (pendingGuestId) {
        // Assign the pending guest to this table
        const guestName = guests.find((g) => g.id === pendingGuestId)?.name ?? "Guest";
        setTableOverrides((prev) => {
          const next = new Map(prev);
          next.set(pendingGuestId, ft.tableNumber);
          return next;
        });
        setPendingGuestId(null);
        setSelectedTableId(ft.id);
        toast.success(`${guestName} assigned to Table ${ft.tableNumber}`, {
          description: ft.label ? ft.label : undefined,
        });
      } else {
        setSelectedTableId((prev) => (prev === ft.id ? null : ft.id));
      }
    },
    [pendingGuestId, guests]
  );

  const handleGuestSelect = useCallback((guestId: string) => {
    setPendingGuestId((prev) => (prev === guestId ? null : guestId));
    // When selecting a guest, deselect the table so the panel shows unassigned
    setSelectedTableId(null);
  }, []);

  const handleCloseTable = useCallback(() => {
    setSelectedTableId(null);
  }, []);

  // ── List-view columns (stable reference) ───────────────────────────────
  const columns = useMemo(
    () => buildColumns(floorplanTables, tableOverrides),
    [floorplanTables, tableOverrides]
  );

  // ── Canvas: size per table ──────────────────────────────────────────────
  // The canvas will be rendered at various widths. Tables need to be large
  // enough to show seat geometry but not so large they overlap on the 4:3 canvas.
  // 96px clears the 12-table layout in FLOORPLAN_TABLES at the 640×480 min
  // canvas: vertically-adjacent rows sit ~20% apart (~96px ≥ table size).
  const TABLE_SIZE = 96;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <DataToolbar
        search={
          viewMode === "list"
            ? { value: search, onChange: setSearch, placeholder: "Search guests…" }
            : undefined
        }
        view={{
          value: viewMode,
          onChange: (v) => setViewMode(v as ViewMode),
          options: [
            { value: "canvas", label: "Canvas view", icon: MapIcon },
            { value: "list", label: "List view", icon: List },
          ],
        }}
        resultCount={viewMode === "list" ? filteredGuests.length : undefined}
        totalCount={viewMode === "list" ? guests.length : undefined}
        actions={
          viewMode === "canvas" ? (
            <Button
              variant={overlay === "dietary" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setOverlay((prev) => (prev === "dietary" ? "none" : "dietary"))
              }
              className="h-8 gap-1.5 text-xs"
            >
              <Salad className="size-3.5" />
              Dietary overlay
            </Button>
          ) : undefined
        }
      >
        {/* Legend chips */}
        {viewMode === "canvas" && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full bg-fun-blue border border-fun-blue-strong/40" />
              Seated
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full bg-muted border border-border" />
              Empty
            </span>
            {overlay === "dietary" && (
              <span className="flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-full bg-warning border border-warning-foreground/40" />
                Dietary req.
              </span>
            )}
          </div>
        )}
      </DataToolbar>

      {/* ── Canvas view ── */}
      {viewMode === "canvas" && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Canvas */}
          <div className="flex-1 min-w-0">
            <FloorCanvas roomElements={roomElements} className="shadow-sm">
              {floorplanTables.map((ft) => {
                const seated = guestsAtTable(ft.tableNumber, guests, tableOverrides);
                const isSelected = selectedTableId === ft.id;
                const isPending = pendingGuestId !== null;

                return (
                  <div
                    key={ft.id}
                    className="absolute"
                    style={{
                      left: `${ft.x}%`,
                      top: `${ft.y}%`,
                      transform: "translate(-50%, -50%)",
                      zIndex: isSelected ? 10 : 1,
                    }}
                  >
                    <ShapedTable
                      table={ft}
                      seatedGuests={seated}
                      selected={isSelected}
                      onSelect={() => handleTableClick(ft)}
                      overlay={overlay}
                      sizePx={TABLE_SIZE}
                    />
                    {/* Pulse ring when a guest is pending — shows which tables can be clicked.
                        Sized to the round table-plus-seats footprint (~0.72×size) and
                        centered, so the ring hugs the table edge rather than the square box. */}
                    {isPending && !isSelected && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-primary/30 animate-pulse"
                        style={{ width: TABLE_SIZE * 0.72, height: TABLE_SIZE * 0.72 }}
                      />
                    )}
                  </div>
                );
              })}
            </FloorCanvas>

            {/* Canvas hint */}
            <p className="mt-2 text-center text-[11px] text-muted-foreground/60">
              {pendingGuestId
                ? "Click any table on the canvas to assign the selected guest"
                : "Click a table to view its guests · Select a guest in the panel, then click a table to assign"}
            </p>
          </div>

          {/* Right panel */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0">
            <div className="rounded-xl border border-border bg-card shadow-sm p-4 h-full min-h-[400px] flex flex-col">
              <RightPanel
                selectedTable={selectedFt}
                tableGuests={tableGuests}
                unassigned={unassigned}
                totalSeated={totalSeated}
                totalGuests={totalGuests}
                pendingGuestId={pendingGuestId}
                onCloseTable={handleCloseTable}
                onSelectGuest={handleGuestSelect}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── List view ── */}
      {viewMode === "list" && (
        <div className="flex flex-col gap-3">
          {/* Unassigned callout */}
          {unassigned.length > 0 && (
            <div className="flex items-center gap-2.5 rounded-lg border border-warning/50 bg-warning/10 px-4 py-2.5">
              <UserX className="size-4 text-warning-foreground shrink-0" />
              <p className="text-sm text-warning-foreground font-medium">
                {unassigned.length} guest
                {unassigned.length !== 1 ? "s" : ""} still need a table assignment
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs text-warning-foreground hover:bg-warning/20"
                onClick={() => setViewMode("canvas")}
              >
                Assign in canvas
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}

          <SortableTable<Guest>
            columns={columns}
            rows={filteredGuests}
            getRowId={(g) => g.id}
            initialSort={{ key: "table", dir: "asc" }}
            stickyHeader
            emptyState={
              <div className="flex flex-col items-center gap-2 py-4">
                <Users className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No guests match your search</p>
              </div>
            }
          />

          {/* Footer count */}
          <p className="text-right text-xs text-muted-foreground tabular-nums pr-1">
            {filteredGuests.length} of {guests.length} guests
          </p>
        </div>
      )}
    </div>
  );
}
