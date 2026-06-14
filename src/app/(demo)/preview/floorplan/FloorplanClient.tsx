"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserX, Wheat, Leaf, Nut, Milk, Fish, X } from "lucide-react";
import type { Guest, Rsvp } from "@/lib/mock";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TableGroup {
  tableNumber: number;
  guests: Guest[];
}

export interface FloorplanClientProps {
  tables: TableGroup[];
  unassigned: Guest[];
  totalSeated: number;
  totalGuests: number;
  tableCapacity: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TABLE_CAPACITY = 10;

function fillColor(seated: number, capacity: number): string {
  const pct = seated / capacity;
  if (pct >= 1) return "bg-fun-teal border-fun-teal-strong/40";
  if (pct >= 0.7) return "bg-fun-green border-fun-green-strong/30";
  return "bg-accent border-border";
}

function rsvpVariant(rsvp: Rsvp): "success" | "destructive" | "secondary" {
  switch (rsvp) {
    case "yes":
      return "success";
    case "no":
      return "destructive";
    case "pending":
      return "secondary";
  }
}

function rsvpLabel(rsvp: Rsvp): string {
  switch (rsvp) {
    case "yes":
      return "Attending";
    case "no":
      return "Declined";
    case "pending":
      return "Pending";
  }
}

/** Map dietary string to a small readable chip. */
function DietaryChip({ label }: { label: string }) {
  let icon: React.ReactNode = null;
  let variant: "success" | "warning" | "destructive" | "teal" | "blue" | "pink" | "secondary" | "default" = "default";

  const lower = label.toLowerCase();
  if (lower.includes("vegan")) {
    icon = <Leaf className="size-3 shrink-0" />;
    variant = "success";
  } else if (lower.includes("vegetarian")) {
    icon = <Leaf className="size-3 shrink-0" />;
    variant = "teal";
  } else if (lower.includes("gluten")) {
    icon = <Wheat className="size-3 shrink-0" />;
    variant = "warning";
  } else if (lower.includes("nut")) {
    icon = <Nut className="size-3 shrink-0" />;
    variant = "destructive";
  } else if (lower.includes("dairy")) {
    icon = <Milk className="size-3 shrink-0" />;
    variant = "blue";
  } else if (lower.includes("fish") || lower.includes("pescatarian")) {
    icon = <Fish className="size-3 shrink-0" />;
    variant = "secondary";
  }

  return (
    <Badge variant={variant} className="text-[10px] py-0 px-1.5 gap-0.5">
      {icon}
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Table tile
// ---------------------------------------------------------------------------

function TableTile({
  group,
  isSelected,
  onClick,
}: {
  group: TableGroup;
  isSelected: boolean;
  onClick: () => void;
}) {
  const seated = group.guests.length;
  const pct = Math.round((seated / TABLE_CAPACITY) * 100);
  const isFull = seated >= TABLE_CAPACITY;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-4 text-center",
        "min-h-[100px] w-full cursor-pointer select-none",
        "transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        fillColor(seated, TABLE_CAPACITY),
        isSelected
          ? "ring-2 ring-primary ring-offset-2 shadow-md -translate-y-0.5"
          : "",
      )}
      aria-pressed={isSelected}
      aria-label={`Table ${group.tableNumber}, ${seated} of ${TABLE_CAPACITY} guests seated`}
    >
      {/* Table number */}
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Table
      </span>
      <span className="text-2xl font-bold tabular-nums leading-none tracking-tight text-foreground">
        {group.tableNumber}
      </span>
      {/* Count */}
      <span
        className={cn(
          "text-xs font-medium tabular-nums",
          isFull ? "text-fun-teal-strong" : "text-muted-foreground",
        )}
      >
        {seated}/{TABLE_CAPACITY}
      </span>

      {/* Fill bar — subtle arc at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300",
            isFull
              ? "bg-fun-teal-strong"
              : pct >= 70
                ? "bg-fun-green-strong"
                : "bg-primary/30",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Guest row
// ---------------------------------------------------------------------------

function GuestRow({ guest }: { guest: Guest }) {
  return (
    <li className="flex min-h-[44px] items-start gap-3 py-2.5 border-b border-border last:border-0">
      {/* Avatar initial */}
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
        {guest.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight text-foreground">{guest.name}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge variant={rsvpVariant(guest.rsvp)} className="text-[10px] py-0 px-1.5">
            {rsvpLabel(guest.rsvp)}
          </Badge>
          {guest.dietary.map((d) => (
            <DietaryChip key={d} label={d} />
          ))}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Side panel
// ---------------------------------------------------------------------------

function SidePanel({
  selected,
  unassigned,
  totalSeated,
  totalGuests,
  onClose,
}: {
  selected: TableGroup | null;
  unassigned: Guest[];
  totalSeated: number;
  totalGuests: number;
  onClose: () => void;
}) {
  // Summary row always at top
  const summary = (
    <div className="flex flex-col gap-3 border-b border-border pb-4 mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Seating summary
      </p>
      <div className="grid grid-cols-3 gap-2">
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
          <p className="mt-0.5 text-[10px] text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg bg-accent/50 px-3 py-2 text-center">
          <p className="text-lg font-bold tabular-nums leading-none text-foreground">
            {unassigned.length}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Unassigned</p>
        </div>
      </div>
    </div>
  );

  // Table detail
  if (selected) {
    return (
      <div className="flex flex-col gap-0">
        {summary}

        {/* Table header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Table {selected.tableNumber}
            </p>
            <p className="text-base font-semibold text-foreground">
              {selected.guests.length} of {TABLE_CAPACITY} seated
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Deselect table"
          >
            <X className="size-4" />
          </button>
        </div>

        {selected.guests.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <UserX className="mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No guests assigned yet</p>
          </div>
        ) : (
          <ul className="divide-y-0">
            {selected.guests.map((g) => (
              <GuestRow key={g.id} guest={g} />
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Default: unassigned guests
  return (
    <div className="flex flex-col gap-0">
      {summary}

      <div className="flex items-center gap-2 mb-3">
        <UserX className="size-4 text-warning-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Unassigned guests
        </p>
        {unassigned.length > 0 && (
          <Badge variant="warning" className="ml-auto">
            {unassigned.length}
          </Badge>
        )}
      </div>

      {unassigned.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Users className="mb-2 size-8 text-fun-green-strong/60" />
          <p className="text-sm font-medium text-foreground">All guests seated</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every confirmed guest has a table assignment.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            These guests are pending RSVP or haven&apos;t been assigned a table yet.
            Select a table tile to view its guest list.
          </p>
          <ul className="divide-y-0">
            {unassigned.map((g) => (
              <GuestRow key={g.id} guest={g} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function FloorplanClient({
  tables,
  unassigned,
  totalSeated,
  totalGuests,
}: FloorplanClientProps) {
  const [selectedTable, setSelectedTable] = useState<number | null>(null);

  const selectedGroup = selectedTable !== null
    ? tables.find((t) => t.tableNumber === selectedTable) ?? null
    : null;

  function handleTableClick(tableNumber: number) {
    setSelectedTable((prev) => (prev === tableNumber ? null : tableNumber));
  }

  function handleDeselect() {
    setSelectedTable(null);
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* ----------------------------------------------------------------- */}
      {/* Canvas — venue floor                                               */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex-1 min-w-0">
        {/* Stage / top table marker */}
        <div className="mb-5 flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-6 py-2.5 shadow-xs">
            <div className="h-px w-10 bg-border" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Top table · stage
            </span>
            <div className="h-px w-10 bg-border" />
          </div>
        </div>

        {/* Floor canvas */}
        <div className="rounded-xl bg-accent/30 p-5 ring-1 ring-border/60">
          {/* Legend */}
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Fill
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="size-2.5 rounded-sm bg-accent border border-border inline-block" />
              Low
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="size-2.5 rounded-sm bg-fun-green border border-fun-green-strong/30 inline-block" />
              70 %+
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="size-2.5 rounded-sm bg-fun-teal border border-fun-teal-strong/40 inline-block" />
              Full
            </span>
          </div>

          {/* Table grid */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {tables.map((group) => (
              <TableTile
                key={group.tableNumber}
                group={group}
                isSelected={selectedTable === group.tableNumber}
                onClick={() => handleTableClick(group.tableNumber)}
              />
            ))}
          </div>

          {/* Instruction hint */}
          <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
            Tap a table to view its guests
          </p>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Side panel                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="w-full lg:w-80 xl:w-96 shrink-0">
        <Card>
          <CardContent>
            <SidePanel
              selected={selectedGroup}
              unassigned={unassigned}
              totalSeated={totalSeated}
              totalGuests={totalGuests}
              onClose={handleDeselect}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
