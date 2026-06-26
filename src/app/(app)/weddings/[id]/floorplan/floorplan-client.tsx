"use client";

/**
 * FloorplanClient (real) — per-wedding floor plan editor.
 *
 * Ports FloorplanClient from /preview/floorplan with real Supabase data:
 *   - Canvas + list view toggle
 *   - Dietary overlay
 *   - Assign unassigned guests to tables (optimistic + server action)
 *   - Reuses FloorCanvas + ShapedTable components unchanged
 *
 * Props come from the server page which has already seeded the floor plan
 * and loaded guests.
 */

import { useState, useMemo, useCallback, useTransition } from "react";
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
import type { Guest, Rsvp } from "@/lib/guests/types";
import type { FloorplanTable } from "@/lib/floorplan/types";
import type { RoomElement } from "@/lib/floorplan/types";
import { assignGuestToTable } from "./actions";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FloorplanClientProps {
  weddingId: string;
  floorPlanId: string;
  floorplanTables: FloorplanTable[];
  roomElements: RoomElement[];
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

function dietaryBadgeVariant(
  d: string,
): "warning" | "success" | "destructive" | "secondary" | "default" {
  const l = d.toLowerCase();
  if (l.includes("vegan")) return "success";
  if (l.includes("vegetarian")) return "success";
  if (l.includes("nut")) return "destructive";
  if (l.includes("gluten")) return "warning";
  return "secondary";
}

function guestsAtTable(
  tableNumber: number,
  guests: Guest[],
  overrides: Map<string, number | null>,
): Guest[] {
  return guests.filter((g) => {
    const eff = overrides.has(g.id) ? overrides.get(g.id) : g.table;
    return eff === tableNumber && g.rsvp !== "no";
  });
}

function isUnassigned(g: Guest, overrides: Map<string, number | null>): boolean {
  if (g.rsvp === "no") return false;
  const eff = overrides.has(g.id) ? overrides.get(g.id) : g.table;
  return eff === null || eff === undefined;
}

// ---------------------------------------------------------------------------
// DietaryChip
// ---------------------------------------------------------------------------

function DietaryChip({ label }: { label: string }) {
  return (
    <Badge variant={dietaryBadgeVariant(label)} className="py-0 px-1.5 text-[10px]">
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// GuestRow
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
        "flex min-h-[44px] items-start gap-3 border-b border-border px-3 py-2.5 last:border-0",
        isSelectable &&
          "cursor-pointer rounded-lg transition-colors hover:bg-accent/40",
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
            className="py-0 px-1.5 text-[10px]"
          >
            {rsvpLabel(guest.rsvp)}
          </Badge>
          {guest.dietary.map((d) => (
            <DietaryChip key={d} label={d} />
          ))}
          {(guest.tags ?? []).map((t) => (
            <TagChip key={t} tag={t} className="py-0 px-1.5 text-[10px]" />
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
// SummaryStrip
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
    <div className="mb-4 grid grid-cols-3 gap-2 border-b border-border pb-4">
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
// RightPanel
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
  const activeTab = selectedTable ? "table" : "unassigned";

  return (
    <div className="flex h-full flex-col">
      <SummaryStrip
        totalSeated={totalSeated}
        totalGuests={totalGuests}
        unassignedCount={unassigned.length}
      />

      {/* Tab strip */}
      <div className="mb-4 flex shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5">
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
              <Badge variant="warning" className="py-0 px-1.5 text-[10px]">
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
            !selectedTable && "cursor-default opacity-50",
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
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "table" && selectedTable ? (
          <div>
            <div className="mb-3 flex items-start justify-between px-1">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {selectedTable.label ?? `Table ${selectedTable.tableNumber}`}
                </p>
                <p className="text-sm font-medium text-foreground">
                  {tableGuests.length} of {selectedTable.capacity} seated
                </p>
                {pendingGuestId && (
                  <p className="mt-1 text-xs font-medium text-fun-blue-strong">
                    Click this table on the canvas to assign the selected guest
                  </p>
                )}
              </div>
              <button
                onClick={onCloseTable}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Deselect table"
              >
                <X className="size-4" />
              </button>
            </div>
            {tableGuests.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-8 text-center">
                <UserX className="mb-2 size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No guests assigned yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Select a guest from the Unassigned tab, then click a table on
                  the canvas.
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
              <div className="mb-3 rounded-lg border border-fun-blue-strong/30 bg-fun-blue/15 px-3 py-2.5">
                <p className="text-xs font-medium text-fun-blue-strong">
                  Guest selected — click a table on the canvas to assign them.
                </p>
              </div>
            ) : (
              unassigned.length > 0 && (
                <p className="mb-3 px-1 text-xs text-muted-foreground">
                  Select a guest, then click a table on the canvas to assign them.
                </p>
              )
            )}
            {unassigned.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-8 text-center">
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
// List-view columns
// ---------------------------------------------------------------------------

function buildColumns(
  floorplanTables: FloorplanTable[],
  overrides: Map<string, number | null>,
): SortableColumn<Guest>[] {
  return [
    {
      key: "name",
      header: "Guest",
      sortable: true,
      render: (g) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
            {g.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <span className="truncate text-sm font-medium text-foreground">
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
        const eff =
          overrides.has(g.id) ? overrides.get(g.id) : g.table;
        const ft =
          eff !== null && eff !== undefined
            ? floorplanTables.find((t) => t.tableNumber === eff)
            : null;
        if (eff === null || eff === undefined) {
          return (
            <Badge variant="secondary" className="text-[10px]">
              Unassigned
            </Badge>
          );
        }
        return (
          <span className="text-sm font-medium tabular-nums text-foreground">
            {ft ? ft.tableNumber : eff}
          </span>
        );
      },
      sortValue: (g) => {
        const eff =
          overrides.has(g.id) ? overrides.get(g.id) : g.table;
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
        <span className="text-xs capitalize text-muted-foreground">
          {g.sessionType ?? "day"}
        </span>
      ),
      sortValue: (g) => g.sessionType ?? "day",
    },
  ];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FloorplanClient({
  weddingId,
  floorPlanId,
  floorplanTables,
  roomElements,
  guests,
  totalSeated: initialSeated,
  totalGuests,
}: FloorplanClientProps) {
  const [, startTransition] = useTransition();

  const [viewMode, setViewMode] = useState<ViewMode>("canvas");
  const [overlay, setOverlay] = useState<"none" | "dietary">("none");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [pendingGuestId, setPendingGuestId] = useState<string | null>(null);
  const [tableOverrides, setTableOverrides] = useState<
    Map<string, number | null>
  >(new Map());
  const [search, setSearch] = useState("");

  const unassigned = useMemo(
    () => guests.filter((g) => isUnassigned(g, tableOverrides)),
    [guests, tableOverrides],
  );

  const totalSeated = useMemo(
    () =>
      guests.filter((g) => {
        if (g.rsvp === "no") return false;
        const eff = tableOverrides.has(g.id)
          ? tableOverrides.get(g.id)
          : g.table;
        return eff !== null && eff !== undefined;
      }).length,
    [guests, tableOverrides],
  );

  const selectedFt =
    floorplanTables.find((t) => t.id === selectedTableId) ?? null;

  const tableGuests = useMemo(
    () =>
      selectedFt
        ? guestsAtTable(selectedFt.tableNumber, guests, tableOverrides)
        : [],
    [selectedFt, guests, tableOverrides],
  );

  const filteredGuests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.dietary ?? []).some((d) => d.toLowerCase().includes(q)) ||
        (g.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [guests, search]);

  const handleTableClick = useCallback(
    (ft: FloorplanTable) => {
      if (pendingGuestId) {
        const guestName =
          guests.find((g) => g.id === pendingGuestId)?.name ?? "Guest";

        // Will this assignment push the table past capacity? (count before + 1)
        const seatedAfter =
          guestsAtTable(ft.tableNumber, guests, tableOverrides).length + 1;
        const over = seatedAfter > ft.capacity;

        // Optimistic update
        setTableOverrides((prev) => {
          const next = new Map(prev);
          next.set(pendingGuestId, ft.tableNumber);
          return next;
        });
        setPendingGuestId(null);
        setSelectedTableId(ft.id);

        // Assignment is still allowed when over capacity — just warn loudly.
        if (over) {
          toast.warning(
            `Table ${ft.tableNumber} over capacity — ${seatedAfter}/${ft.capacity} seated`,
            { description: `${guestName} assigned anyway.` },
          );
        } else {
          toast.success(`${guestName} assigned to Table ${ft.tableNumber}`, {
            description: ft.label ?? undefined,
          });
        }

        // Persist to DB
        startTransition(async () => {
          const result = await assignGuestToTable({
            weddingId,
            guestId: pendingGuestId,
            tableNumber: ft.tableNumber,
          });
          if (!result.ok) {
            toast.error("Could not save assignment", {
              description: result.error,
            });
            // Roll back optimistic update
            setTableOverrides((prev) => {
              const next = new Map(prev);
              next.delete(pendingGuestId);
              return next;
            });
          }
        });
      } else {
        setSelectedTableId((prev) => (prev === ft.id ? null : ft.id));
      }
    },
    [pendingGuestId, guests, weddingId, tableOverrides],
  );

  const handleGuestSelect = useCallback((guestId: string) => {
    setPendingGuestId((prev) => (prev === guestId ? null : guestId));
    setSelectedTableId(null);
  }, []);

  const handleCloseTable = useCallback(() => {
    setSelectedTableId(null);
  }, []);

  const columns = useMemo(
    () => buildColumns(floorplanTables, tableOverrides),
    [floorplanTables, tableOverrides],
  );

  const TABLE_SIZE = 110;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <DataToolbar
        search={
          viewMode === "list"
            ? {
                value: search,
                onChange: setSearch,
                placeholder: "Search guests...",
              }
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
                setOverlay((prev) =>
                  prev === "dietary" ? "none" : "dietary",
                )
              }
              className="h-8 gap-1.5 text-xs"
            >
              <Salad className="size-3.5" />
              Dietary overlay
            </Button>
          ) : undefined
        }
      >
        {viewMode === "canvas" && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full border border-fun-blue-strong/40 bg-fun-blue" />
              Seated
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full border border-border bg-muted" />
              Empty
            </span>
            {overlay === "dietary" && (
              <span className="flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-full border border-warning-foreground/40 bg-warning" />
                Dietary req.
              </span>
            )}
          </div>
        )}
      </DataToolbar>

      {/* Canvas view */}
      {viewMode === "canvas" && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            {floorplanTables.length === 0 ? (
              <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
                <div className="px-4 text-center">
                  <p className="text-sm font-medium text-muted-foreground">
                    No tables in layout
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Add tables to this space&apos;s floor template in Settings.
                  </p>
                </div>
              </div>
            ) : (
              <FloorCanvas roomElements={roomElements} className="shadow-sm">
                {floorplanTables.map((ft) => {
                  const seated = guestsAtTable(
                    ft.tableNumber,
                    guests,
                    tableOverrides,
                  );
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
                      {isPending && !isSelected && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 animate-pulse rounded-full ring-2 ring-primary/30"
                        />
                      )}
                    </div>
                  );
                })}
              </FloorCanvas>
            )}

            <p className="mt-2 text-center text-[11px] text-muted-foreground/60">
              {pendingGuestId
                ? "Click any table on the canvas to assign the selected guest"
                : "Click a table to view its guests · Select a guest in the panel, then click a table to assign"}
            </p>
          </div>

          {/* Right panel */}
          <div className="w-full shrink-0 lg:w-80 xl:w-96">
            <div className="flex h-full min-h-[400px] flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
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

      {/* List view */}
      {viewMode === "list" && (
        <div className="flex flex-col gap-3">
          {unassigned.length > 0 && (
            <div className="flex items-center gap-2.5 rounded-lg border border-warning/50 bg-warning/10 px-4 py-2.5">
              <UserX className="size-4 shrink-0 text-warning-foreground" />
              <p className="text-sm font-medium text-warning-foreground">
                {unassigned.length} guest
                {unassigned.length !== 1 ? "s" : ""} still need a table
                assignment
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
                <p className="text-sm text-muted-foreground">
                  No guests match your search
                </p>
              </div>
            }
          />

          <p className="pr-1 text-right text-xs tabular-nums text-muted-foreground">
            {filteredGuests.length} of {guests.length} guests
          </p>
        </div>
      )}
    </div>
  );
}
