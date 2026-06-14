"use client";

import { useState, useMemo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
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
}

type Filter = "all" | "confirmed" | "pending" | "dietary";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rsvpVariant(rsvp: Rsvp): "success" | "warning" | "secondary" {
  if (rsvp === "yes") return "success";
  if (rsvp === "pending") return "warning";
  return "secondary";
}

function rsvpLabel(rsvp: Rsvp): string {
  if (rsvp === "yes") return "Confirmed";
  if (rsvp === "pending") return "Pending";
  return "Declined";
}

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------

function FilterChip({
  active,
  count,
  children,
  onClick,
}: {
  active: boolean;
  count: number;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
      <span
        className={cn(
          "inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
          active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GuestTable({ guests }: { guests: GuestRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: guests.length,
      confirmed: guests.filter((g) => g.rsvp === "yes").length,
      pending: guests.filter((g) => g.rsvp === "pending").length,
      dietary: guests.filter((g) => g.dietary.length > 0).length,
    }),
    [guests],
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case "confirmed":
        return guests.filter((g) => g.rsvp === "yes");
      case "pending":
        return guests.filter((g) => g.rsvp === "pending");
      case "dietary":
        return guests.filter((g) => g.dietary.length > 0);
      default:
        return guests;
    }
  }, [guests, filter]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} count={counts.all} onClick={() => setFilter("all")}>
          All guests
        </FilterChip>
        <FilterChip active={filter === "confirmed"} count={counts.confirmed} onClick={() => setFilter("confirmed")}>
          Confirmed
        </FilterChip>
        <FilterChip active={filter === "pending"} count={counts.pending} onClick={() => setFilter("pending")}>
          Pending
        </FilterChip>
        <FilterChip active={filter === "dietary"} count={counts.dietary} onClick={() => setFilter("dietary")}>
          Dietary needs
        </FilterChip>
      </div>

      {/* Table wrapper — scrollable, sticky header */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <div
            className="max-h-[560px] overflow-y-auto"
            // allow sticky thead inside a scroll container
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-center">Table</TableHead>
                  <TableHead>RSVP</TableHead>
                  <TableHead>Dietary</TableHead>
                  <TableHead className="text-center pr-4">+1</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="py-16 text-center text-sm text-muted-foreground">
                      No guests match this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((g) => (
                    <TableRow key={g.id} className="min-h-[44px]">
                      <TableCell className="pl-4 font-medium text-foreground">
                        {g.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {g.sideLabel}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm text-muted-foreground">
                        {g.table !== null ? g.table : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rsvpVariant(g.rsvp)}>
                          {rsvpLabel(g.rsvp)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {g.dietary.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {g.dietary.map((d) => (
                              <span
                                key={d}
                                className="inline-flex items-center rounded-full bg-warning/60 px-2 py-0.5 text-[11px] font-medium text-warning-foreground"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center pr-4">
                        {g.plusOne ? (
                          <Check
                            className="mx-auto size-4 text-fun-green-strong"
                            aria-label="Plus one"
                          />
                        ) : (
                          <span className="text-muted-foreground/50 text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer row — shown count */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Showing
          </span>
          <span className="tabular-nums text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span> of {guests.length} guests
          </span>
        </div>
      </div>
    </div>
  );
}
