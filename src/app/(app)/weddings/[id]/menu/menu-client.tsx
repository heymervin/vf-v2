"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  LayoutGrid,
  List,
  AlertTriangle,
  Users,
  ChefHat,
  Utensils,
  BookOpen,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { DataToolbar } from "@/components/data-toolbar";
import { SortableTable, type SortableColumn } from "@/components/sortable-table";
import { EntitySheet } from "@/components/entity-sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { buildAllergenRollup } from "@/lib/menu/allergens";
import { addMenuSelection, removeMenuSelection } from "./actions";
import type { DishRow, GuestForMenu, MenuPageData } from "./menu-types";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AllergenChip({ allergen }: { allergen: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-warning px-1.5 py-0.5 text-[11px] font-medium text-warning-foreground"
      aria-label={`Contains ${allergen}`}
    >
      <AlertTriangle className="size-3 shrink-0" aria-hidden />
      {allergen}
    </span>
  );
}

function DietaryChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-fun-teal px-1.5 py-0.5 text-[11px] font-medium text-foreground">
      {tag}
    </span>
  );
}

function MiniBar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${value} of ${max}`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-fun-pink-strong transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guest drill-down sheet
// ---------------------------------------------------------------------------

function GuestDrillDown({
  dish,
  guestIds,
  guestMap,
}: {
  dish: string;
  guestIds: string[];
  guestMap: Map<string, GuestForMenu>;
}) {
  const guests = guestIds
    .map((id) => guestMap.get(id))
    .filter((g): g is GuestForMenu => g !== undefined);

  if (guests.length === 0) {
    return (
      <div className="py-8 text-center">
        <Users className="mx-auto mb-2 size-8 text-muted-foreground/40" aria-hidden />
        <p className="text-sm text-muted-foreground">No guests linked to this option yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {guests.length} guest{guests.length !== 1 ? "s" : ""} chose {dish}
      </p>
      <div className="divide-y divide-border rounded-lg border border-border bg-muted/30">
        {guests.map((g) => (
          <div
            key={g.id}
            className="flex items-center gap-3 px-3 py-2.5 min-h-[44px]"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
              {g.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span className="flex-1 text-sm font-medium text-foreground">
              {g.name}
            </span>
            {g.dietary.length > 0 && (
              <span className="flex flex-wrap gap-1">
                {g.dietary.map((d) => (
                  <span
                    key={d}
                    className="rounded-full bg-warning/60 px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground"
                  >
                    {d}
                  </span>
                ))}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add / Remove button
// ---------------------------------------------------------------------------

function SelectToggleButton({
  row,
  weddingId,
  onToggle,
  pending,
}: {
  row: DishRow;
  weddingId: string;
  onToggle: (row: DishRow) => void;
  pending: boolean;
}) {
  if (row.isSelected) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs text-destructive hover:text-destructive"
        disabled={pending}
        onClick={() => onToggle(row)}
        aria-label={`Remove ${row.name} from menu`}
      >
        <Trash2 className="size-3.5 mr-1" aria-hidden />
        Remove
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs"
      disabled={pending}
      onClick={() => onToggle(row)}
      aria-label={`Add ${row.name} to menu`}
    >
      <Plus className="size-3.5 mr-1" aria-hidden />
      Add
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------

function TableView({
  rows,
  weddingId,
  guestMap,
  onToggle,
  pendingId,
}: {
  rows: DishRow[];
  weddingId: string;
  guestMap: Map<string, GuestForMenu>;
  onToggle: (row: DishRow) => void;
  pendingId: string | null;
}) {
  const columns: SortableColumn<DishRow>[] = [
    {
      key: "name",
      header: "Dish",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3 py-0.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <Utensils className="size-4 text-muted-foreground/50" aria-hidden />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-sm font-medium",
                row.isSelected ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {row.name}
            </p>
            {row.description && (
              <p className="truncate text-[11px] text-muted-foreground max-w-[220px]">
                {row.description}
              </p>
            )}
          </div>
          {row.isSelected && (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              Selected
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "course",
      header: "Course",
      sortable: true,
      className: "whitespace-nowrap",
      render: (row) => (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
          {row.course}
        </span>
      ),
    },
    {
      key: "allergens",
      header: "Allergens",
      render: (row) =>
        row.allergens.length === 0 ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.allergens.map((a) => (
              <AllergenChip key={a} allergen={a} />
            ))}
          </div>
        ),
    },
    {
      key: "dietaryTags",
      header: "Dietary",
      render: (row) =>
        row.dietaryTags.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.dietaryTags.map((d) => (
              <DietaryChip key={d} tag={d} />
            ))}
          </div>
        ),
    },
    {
      key: "pricePerHeadMinor",
      header: "Price/head",
      sortable: true,
      align: "right",
      sortValue: (row) => row.pricePerHeadMinor ?? 0,
      render: (row) =>
        row.pricePerHeadMinor != null ? (
          <span className="tabular-nums text-sm text-foreground">
            £{(row.pricePerHeadMinor / 100).toFixed(2)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "chosenBy",
      header: "Covers",
      sortable: true,
      align: "right",
      sortValue: (row) => row.chosenBy,
      render: (row) => (
        <span className="tabular-nums text-sm text-foreground">
          {row.chosenBy}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.chosenBy > 0 && (
            <EntitySheet
              trigger={
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  <Users className="size-3.5 mr-1" aria-hidden />
                  Guests
                </Button>
              }
              title={`Who chose: ${row.name}`}
              description={`${row.chosenBy} guest${row.chosenBy !== 1 ? "s" : ""} selected this option.`}
              saveLabel="Close"
              onSave={() => {}}
            >
              <GuestDrillDown
                dish={row.name}
                guestIds={row.guestIds}
                guestMap={guestMap}
              />
            </EntitySheet>
          )}
          <SelectToggleButton
            row={row}
            weddingId={weddingId}
            onToggle={onToggle}
            pending={pendingId === row.itemId}
          />
        </div>
      ),
    },
  ];

  return (
    <SortableTable<DishRow>
      columns={columns}
      rows={rows}
      getRowId={(r) => r.itemId}
      initialSort={{ key: "course", dir: "asc" }}
      stickyHeader
      emptyState={
        <div className="py-12 text-center">
          <Utensils className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">
            No dishes match your search
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search term or clear the filter.
          </p>
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Card view
// ---------------------------------------------------------------------------

function CardView({
  rows,
  weddingId,
  guestMap,
  onToggle,
  pendingId,
}: {
  rows: DishRow[];
  weddingId: string;
  guestMap: Map<string, GuestForMenu>;
  onToggle: (row: DishRow) => void;
  pendingId: string | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <Utensils className="mx-auto mb-3 size-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">
          No dishes match your search
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try a different search term or clear the filter.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((row) => (
        <div
          key={row.itemId}
          className={cn(
            "group rounded-xl border bg-card shadow-sm overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md",
            row.isSelected
              ? "border-fun-green-strong/40"
              : "border-border",
          )}
        >
          {/* Photo placeholder */}
          <div className="relative h-36 bg-muted">
            <div className="flex h-full items-center justify-center">
              <Utensils className="size-8 text-muted-foreground/30" aria-hidden />
            </div>
            <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground backdrop-blur-sm">
              {row.course}
            </span>
            {row.isSelected && (
              <span className="absolute right-2 top-2 rounded-full bg-fun-green-strong/90 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                Selected
              </span>
            )}
            {row.chosenBy > 0 && (
              <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-foreground/80 px-2 py-0.5 text-[11px] font-medium text-background backdrop-blur-sm">
                <Users className="size-3 shrink-0" aria-hidden />
                {row.chosenBy}
              </span>
            )}
          </div>

          {/* Body */}
          <div className="p-3 space-y-2">
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {row.name}
              </p>
              {row.description && (
                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                  {row.description}
                </p>
              )}
            </div>

            {row.allergens.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {row.allergens.map((a) => (
                  <AllergenChip key={a} allergen={a} />
                ))}
              </div>
            )}
            {row.dietaryTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {row.dietaryTags.map((d) => (
                  <DietaryChip key={d} tag={d} />
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-border">
              {row.pricePerHeadMinor != null ? (
                <span className="tabular-nums text-xs font-medium text-foreground">
                  £{(row.pricePerHeadMinor / 100).toFixed(2)}/head
                </span>
              ) : (
                <span />
              )}
              <SelectToggleButton
                row={row}
                weddingId={weddingId}
                onToggle={onToggle}
                pending={pendingId === row.itemId}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kitchen counts panel
// ---------------------------------------------------------------------------

interface CourseCount {
  course: string;
  items: { name: string; chosenBy: number }[];
}

function KitchenCountsPanel({ courses }: { courses: CourseCount[] }) {
  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ChefHat className="size-4 text-muted-foreground" aria-hidden />
          Kitchen counts
        </CardTitle>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Chef&apos;s prep sheet — covers per option per course
        </p>
      </CardHeader>
      <CardContent>
        {courses.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No items selected yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {courses.map((c) => {
              const total = c.items.reduce((s, i) => s + i.chosenBy, 0);
              return (
                <div key={c.course} className="py-3 first:pt-0 last:pb-0">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {c.course}
                    </span>
                    <span className="tabular-nums text-xs font-semibold text-foreground">
                      {total} total
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {c.items.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                          {item.name}
                        </span>
                        <span className="tabular-nums text-sm font-semibold text-foreground">
                          {item.chosenBy}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Allergen rollup panel
// ---------------------------------------------------------------------------

function AllergenRollupPanel({
  dishes,
  guests,
  totalGuests,
}: {
  dishes: DishRow[];
  guests: GuestForMenu[];
  totalGuests: number;
}) {
  const selectedDishes = dishes.filter((d) => d.isSelected);
  const rollupInput = selectedDishes.map((d) => ({
    allergens: d.allergens,
    chosenBy: d.chosenBy,
  }));
  const rollup = buildAllergenRollup(rollupInput, totalGuests);
  const dietaryCount = guests.filter((g) => g.dietary.length > 0).length;

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="size-4 text-warning-foreground" aria-hidden />
          Allergen rollup
        </CardTitle>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Guest-choices per allergen &mdash; % of {totalGuests} guests
        </p>
      </CardHeader>
      <CardContent>
        {rollup.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No allergens declared across selected menu items.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {rollup.map(({ allergen, count, pct }) => (
              <div
                key={allergen}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-warning px-1.5 py-0.5 text-[11px] font-medium text-warning-foreground shrink-0"
                  aria-label={`Allergen: ${allergen}`}
                >
                  <AlertTriangle className="size-3 shrink-0" aria-hidden />
                  {allergen}
                </span>
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <MiniBar value={count} max={totalGuests} className="flex-1" />
                  <span className="tabular-nums text-sm font-semibold text-foreground w-6 text-right shrink-0">
                    {count}
                  </span>
                  <span className="tabular-nums text-[11px] text-muted-foreground w-7 text-right shrink-0">
                    {pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-lg bg-accent/60 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Dietary cross-check
          </p>
          <p className="mt-1 text-sm text-foreground">
            <span className="tabular-nums font-semibold">{dietaryCount}</span>{" "}
            guest{dietaryCount !== 1 ? "s" : ""} declared dietary needs on
            RSVP.{" "}
            <span className="text-muted-foreground">
              Verify their chosen options are safe.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Completion bar
// ---------------------------------------------------------------------------

function CompletionBar({
  selectedCount,
  totalItems,
}: {
  selectedCount: number;
  totalItems: number;
}) {
  const pct =
    totalItems === 0 ? 0 : Math.round((selectedCount / totalItems) * 100);

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            {selectedCount > 0 ? (
              <CheckCircle2
                className="size-4 text-success-foreground shrink-0"
                aria-hidden
              />
            ) : (
              <Circle
                className="size-4 text-muted-foreground shrink-0"
                aria-hidden
              />
            )}
            <span className="text-sm font-medium text-foreground">
              Items selected from library
            </span>
          </div>
          <span className="tabular-nums text-sm font-semibold text-foreground shrink-0">
            {selectedCount}/{totalItems}
            <span className="ml-1 text-muted-foreground font-normal text-xs">
              ({pct}%)
            </span>
          </span>
        </div>
        <Progress value={pct} className="h-2" />
        {selectedCount === 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Add items from the library below to build this wedding&apos;s menu.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Menu library note
// ---------------------------------------------------------------------------

function MenuLibraryNote({ venueId }: { venueId: string }) {
  void venueId; // kept for future deep-link scoping
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-accent/30 px-4 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <BookOpen className="size-4 text-muted-foreground shrink-0" aria-hidden />
        <p className="text-[11px] text-muted-foreground truncate">
          Options sourced from your{" "}
          <span className="font-semibold text-foreground">Menu Library</span>
        </p>
      </div>
      <Link
        href="/settings/menu"
        className="shrink-0 text-[11px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        Manage library &rarr;
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root client component
// ---------------------------------------------------------------------------

export interface MenuClientProps {
  data: MenuPageData;
}

export function MenuClient({ data }: MenuClientProps) {
  const { weddingId, venueId, dishes: initialDishes, guests, totalGuests } =
    data;
  const router = useRouter();

  // ── Optimistic state ──────────────────────────────────────────────────────
  // We track which items are selected locally so the UI responds immediately.
  // The server revalidates the page on each mutation; local state re-syncs.
  const [optimisticDishes, setOptimisticDishes] =
    React.useState<DishRow[]>(initialDishes);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  // Re-sync local state when the server rerenders with new data. Render-time
  // prop-sync (React's "adjust state on prop change" pattern) — avoids the
  // set-state-in-effect cascading-render lint/perf issue.
  const [prevInitialDishes, setPrevInitialDishes] = React.useState(initialDishes);
  if (prevInitialDishes !== initialDishes) {
    setPrevInitialDishes(initialDishes);
    setOptimisticDishes(initialDishes);
  }

  // ── Filter / sort / view state ────────────────────────────────────────────
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState("course");
  const [view, setView] = React.useState<"table" | "card">("table");
  const [courseFilter, setCourseFilter] = React.useState<string>("all");
  const [showSelected, setShowSelected] = React.useState<
    "all" | "selected" | "unselected"
  >("all");

  // ── Derived ───────────────────────────────────────────────────────────────
  const courseNames = React.useMemo(
    () =>
      Array.from(new Set(optimisticDishes.map((d) => d.course))).sort(),
    [optimisticDishes],
  );

  const filteredDishes = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    return optimisticDishes.filter((row) => {
      const matchesCourse =
        courseFilter === "all" || row.course === courseFilter;
      const matchesSelection =
        showSelected === "all" ||
        (showSelected === "selected" && row.isSelected) ||
        (showSelected === "unselected" && !row.isSelected);
      const matchesSearch =
        !q ||
        row.name.toLowerCase().includes(q) ||
        row.course.toLowerCase().includes(q) ||
        row.allergens.some((a) => a.toLowerCase().includes(q)) ||
        row.dietaryTags.some((d) => d.toLowerCase().includes(q)) ||
        (row.description ?? "").toLowerCase().includes(q);
      return matchesCourse && matchesSelection && matchesSearch;
    });
  }, [optimisticDishes, search, courseFilter, showSelected]);

  const sortedDishes = React.useMemo(() => {
    if (view === "table") return filteredDishes;
    return [...filteredDishes].sort((a, b) => {
      if (sortKey === "course") return a.course.localeCompare(b.course);
      if (sortKey === "chosenBy") return b.chosenBy - a.chosenBy;
      if (sortKey === "pricePerHeadMinor")
        return (b.pricePerHeadMinor ?? 0) - (a.pricePerHeadMinor ?? 0);
      if (sortKey === "name") return a.name.localeCompare(b.name);
      return 0;
    });
  }, [filteredDishes, sortKey, view]);

  const selectedCount = React.useMemo(
    () => optimisticDishes.filter((d) => d.isSelected).length,
    [optimisticDishes],
  );

  // Kitchen counts — group selected items by course
  const kitchenCourses = React.useMemo(() => {
    const map = new Map<
      string,
      { name: string; chosenBy: number }[]
    >();
    for (const d of optimisticDishes) {
      if (!d.isSelected) continue;
      const existing = map.get(d.course) ?? [];
      existing.push({ name: d.name, chosenBy: d.chosenBy });
      map.set(d.course, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([course, items]) => ({ course, items }));
  }, [optimisticDishes]);

  const guestMap = React.useMemo(() => {
    const m = new Map<string, GuestForMenu>();
    for (const g of guests) m.set(g.id, g);
    return m;
  }, [guests]);

  // ── Toggle handler ────────────────────────────────────────────────────────
  async function handleToggle(row: DishRow) {
    if (pendingId) return; // prevent concurrent mutations
    setPendingId(row.itemId);

    // Optimistic update
    setOptimisticDishes((prev) =>
      prev.map((d) =>
        d.itemId === row.itemId ? { ...d, isSelected: !d.isSelected } : d,
      ),
    );

    try {
      if (row.isSelected && row.selectionId) {
        const result = await removeMenuSelection({
          selectionId: row.selectionId,
          weddingId,
        });
        if (!result.ok) {
          toast.error(result.error);
          // Roll back optimistic update
          setOptimisticDishes((prev) =>
            prev.map((d) =>
              d.itemId === row.itemId ? { ...d, isSelected: true } : d,
            ),
          );
        } else {
          toast.success(`${row.name} removed from menu`);
          router.refresh();
        }
      } else {
        const result = await addMenuSelection({
          weddingId,
          menuItemId: row.itemId,
          course: row.course,
          sortIndex: row.sortOrder,
        });
        if (!result.ok) {
          toast.error(result.error);
          // Roll back
          setOptimisticDishes((prev) =>
            prev.map((d) =>
              d.itemId === row.itemId ? { ...d, isSelected: false } : d,
            ),
          );
        } else {
          // Patch the selectionId in so a subsequent remove works
          setOptimisticDishes((prev) =>
            prev.map((d) =>
              d.itemId === row.itemId
                ? { ...d, isSelected: true, selectionId: result.data.id }
                : d,
            ),
          );
          toast.success(`${row.name} added to menu`);
          router.refresh();
        }
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      // Roll back
      setOptimisticDishes((prev) =>
        prev.map((d) =>
          d.itemId === row.itemId
            ? { ...d, isSelected: row.isSelected }
            : d,
        ),
      );
    } finally {
      setPendingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Completion bar */}
      <CompletionBar
        selectedCount={selectedCount}
        totalItems={optimisticDishes.length}
      />

      {/* Menu library note */}
      <MenuLibraryNote venueId={venueId} />

      {/* Toolbar */}
      <DataToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search dishes, allergens, dietary…",
        }}
        sort={{
          value: sortKey,
          onChange: setSortKey,
          options: [
            { value: "course", label: "Course order" },
            { value: "name", label: "Dish A–Z" },
            { value: "chosenBy", label: "Most chosen" },
            { value: "pricePerHeadMinor", label: "Price/head" },
          ],
        }}
        view={{
          value: view,
          onChange: (v) => setView(v as "table" | "card"),
          options: [
            { value: "table", label: "Table view", icon: List },
            { value: "card", label: "Card / photo view", icon: LayoutGrid },
          ],
        }}
        resultCount={filteredDishes.length}
        totalCount={optimisticDishes.length}
      >
        {/* Course filter chips */}
        <button
          type="button"
          onClick={() => setCourseFilter("all")}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors min-h-[32px]",
            courseFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          All courses
        </button>
        {courseNames.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() =>
              setCourseFilter(name === courseFilter ? "all" : name)
            }
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors min-h-[32px]",
              courseFilter === name
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {name}
          </button>
        ))}

        {/* Selected filter chips */}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        {(
          [
            { value: "all", label: "All items" },
            { value: "selected", label: "Selected" },
            { value: "unselected", label: "Not selected" },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setShowSelected(value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors min-h-[32px]",
              showSelected === value
                ? "bg-fun-green-strong text-white"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </DataToolbar>

      {/* Main view */}
      <div>
        {view === "table" ? (
          <TableView
            rows={filteredDishes}
            weddingId={weddingId}
            guestMap={guestMap}
            onToggle={handleToggle}
            pendingId={pendingId}
          />
        ) : (
          <CardView
            rows={sortedDishes}
            weddingId={weddingId}
            guestMap={guestMap}
            onToggle={handleToggle}
            pendingId={pendingId}
          />
        )}
      </div>

      {/* Kitchen + allergen panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KitchenCountsPanel courses={kitchenCourses} />
        <AllergenRollupPanel
          dishes={optimisticDishes}
          guests={guests}
          totalGuests={totalGuests}
        />
      </div>
    </div>
  );
}
