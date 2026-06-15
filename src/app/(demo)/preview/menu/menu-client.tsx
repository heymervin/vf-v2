"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
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
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { DataToolbar } from "@/components/data-toolbar"
import { SortableTable, type SortableColumn } from "@/components/sortable-table"
import { EntitySheet } from "@/components/entity-sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { MenuCourse, Guest } from "@/lib/mock"

// ---------------------------------------------------------------------------
// Types for the flat "dish row" model used in the table/card views
// ---------------------------------------------------------------------------

export interface DishRow {
  id: string
  dish: string
  course: string
  courseId: string
  description: string | null
  allergens: string[]
  dietaryTags: string[]
  pricePerHead: number | null
  chosenBy: number
  courseTotal: number
  guestIds: string[]
}

// ---------------------------------------------------------------------------
// Derived data helpers — kept pure (no useState)
// ---------------------------------------------------------------------------

function buildDishRows(courses: MenuCourse[]): DishRow[] {
  const rows: DishRow[] = []
  for (const course of courses) {
    const total = course.options.reduce((s, o) => s + o.chosenBy, 0)
    for (const opt of course.options) {
      rows.push({
        id: opt.id,
        dish: opt.name,
        course: course.course,
        courseId: course.id,
        description: opt.description ?? null,
        allergens: opt.allergens ?? [],
        dietaryTags: opt.dietaryTags ?? [],
        pricePerHead: opt.pricePerHead ?? null,
        chosenBy: opt.chosenBy,
        courseTotal: total,
        guestIds: opt.guestIds ?? [],
      })
    }
  }
  return rows
}

/** Total covers across all courses in a single course. */
function courseTotal(course: MenuCourse): number {
  return course.options.reduce((s, o) => s + o.chosenBy, 0)
}

/** Allergen rollup — count is total guest-choice instances per allergen.
 *  Denominator is total guest count (unique guests), NOT total option selections
 *  across courses (which is N × guestCount and inflates the percentage). */
function buildAllergenRollup(
  courses: MenuCourse[],
  totalGuests: number,
): { allergen: string; count: number; pct: number }[] {
  const map = new Map<string, number>()
  for (const course of courses) {
    for (const option of course.options) {
      for (const allergen of option.allergens) {
        map.set(allergen, (map.get(allergen) ?? 0) + option.chosenBy)
      }
    }
  }
  return Array.from(map.entries())
    .map(([allergen, count]) => ({
      allergen,
      count,
      // pct relative to total unique guests — this is the meaningful signal
      // (e.g. 64 of 120 guests picked burrata which contains Dairy)
      pct: totalGuests === 0 ? 0 : Math.round((count / totalGuests) * 100),
    }))
    .sort((a, b) => b.count - a.count)
}

/** Guests with any dietary need declared. */
function guestsWithDietary(guests: Guest[]): number {
  return guests.filter((g) => g.dietary.length > 0).length
}

/** Guests who have made at least one menu choice (via mealChoice). */
function guestsWithChoices(guests: Guest[]): number {
  return guests.filter((g) => g.mealChoice && Object.keys(g.mealChoice).length > 0).length
}

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------

/** Amber allergen chip */
function AllergenChip({ allergen }: { allergen: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-warning px-1.5 py-0.5 text-[11px] font-medium text-warning-foreground"
      aria-label={`Contains ${allergen}`}
    >
      <AlertTriangle className="size-3 shrink-0" aria-hidden />
      {allergen}
    </span>
  )
}

/** Green / teal dietary chip */
function DietaryChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-fun-teal px-1.5 py-0.5 text-[11px] font-medium text-foreground">
      {tag}
    </span>
  )
}

/** Inline progress bar — RSC-safe, no dependency. */
function MiniBar({
  value,
  max,
  className,
}: {
  value: number
  max: number
  className?: string
}) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
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
  )
}

// ---------------------------------------------------------------------------
// Guest Drill-Down Sheet content
// ---------------------------------------------------------------------------

function GuestDrillDown({
  dish,
  guestIds,
  guestMap,
}: {
  dish: string
  guestIds: string[]
  guestMap: Map<string, Guest>
}) {
  const guests = guestIds.map((id) => guestMap.get(id)).filter(Boolean) as Guest[]

  if (guests.length === 0) {
    return (
      <div className="py-8 text-center">
        <Users className="mx-auto mb-2 size-8 text-muted-foreground/40" aria-hidden />
        <p className="text-sm text-muted-foreground">No guest ids linked to this option.</p>
      </div>
    )
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
              {g.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
            <span className="flex-1 text-sm font-medium text-foreground">{g.name}</span>
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
  )
}

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------

function TableView({
  rows,
  guestMap,
  photoMap,
}: {
  rows: DishRow[]
  guestMap: Map<string, Guest>
  photoMap: Map<string, string>
}) {
  const columns: SortableColumn<DishRow>[] = [
    {
      key: "dish",
      header: "Dish",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3 py-0.5">
          {photoMap.has(row.id) ? (
            <div className="relative size-9 shrink-0 overflow-hidden rounded-md">
              <Image
                src={photoMap.get(row.id)!}
                alt={row.dish}
                fill
                className="object-cover"
                sizes="36px"
              />
            </div>
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <Utensils className="size-4 text-muted-foreground/50" aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{row.dish}</p>
            {row.description && (
              <p className="truncate text-[11px] text-muted-foreground max-w-[220px]">
                {row.description}
              </p>
            )}
          </div>
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
      key: "dietary",
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
      key: "pricePerHead",
      header: "Price/head",
      sortable: true,
      align: "right",
      sortValue: (row) => row.pricePerHead ?? 0,
      render: (row) =>
        row.pricePerHead != null ? (
          <span className="tabular-nums text-sm text-foreground">
            £{row.pricePerHead}
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
      render: (row) => {
        const pct =
          row.courseTotal === 0
            ? 0
            : Math.round((row.chosenBy / row.courseTotal) * 100)
        return (
          <div className="flex items-center justify-end gap-2 min-w-[80px]">
            <MiniBar value={row.chosenBy} max={row.courseTotal} className="w-16" />
            <span className="tabular-nums text-sm font-semibold text-foreground w-6 text-right">
              {row.chosenBy}
            </span>
            <span className="tabular-nums text-[11px] text-muted-foreground w-8 text-right">
              {pct}%
            </span>
          </div>
        )
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <EntitySheet
          trigger={
            <Button variant="ghost" size="sm" className="h-8 text-xs">
              <Users className="size-3.5 mr-1" aria-hidden />
              Guests
            </Button>
          }
          title={`Who chose: ${row.dish}`}
          description={`${row.chosenBy} guest${row.chosenBy !== 1 ? "s" : ""} selected this option.`}
          saveLabel="Close"
          onSave={() => {}}
        >
          <GuestDrillDown dish={row.dish} guestIds={row.guestIds} guestMap={guestMap} />
        </EntitySheet>
      ),
    },
  ]

  return (
    <SortableTable<DishRow>
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      initialSort={{ key: "course", dir: "asc" }}
      stickyHeader
      emptyState={
        <div className="py-12 text-center">
          <Utensils className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">No dishes match your search</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different search term or clear the filter.</p>
        </div>
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Card / photo view
// ---------------------------------------------------------------------------

function CardView({
  rows,
  guestMap,
  photoMap,
}: {
  rows: DishRow[]
  guestMap: Map<string, Guest>
  photoMap: Map<string, string>
}) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <Utensils className="mx-auto mb-3 size-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">No dishes match your search</p>
        <p className="mt-1 text-sm text-muted-foreground">Try a different search term or clear the filter.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((row) => {
        const photoUrl = photoMap.get(row.id)
        const pct =
          row.courseTotal === 0
            ? 0
            : Math.round((row.chosenBy / row.courseTotal) * 100)

        return (
          <div
            key={row.id}
            className="group rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            {/* Photo / placeholder */}
            <div className="relative h-36 bg-muted">
              {photoUrl ? (
                <Image
                  src={photoUrl}
                  alt={row.dish}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Utensils className="size-8 text-muted-foreground/30" aria-hidden />
                </div>
              )}
              {/* Course badge overlay */}
              <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground backdrop-blur-sm">
                {row.course}
              </span>
              {/* Covers badge */}
              <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-foreground/80 px-2 py-0.5 text-[11px] font-medium text-background backdrop-blur-sm">
                <Users className="size-3 shrink-0" aria-hidden />
                {row.chosenBy}
              </span>
            </div>

            {/* Body */}
            <div className="p-3 space-y-2">
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">{row.dish}</p>
                {row.description && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                    {row.description}
                  </p>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <MiniBar value={row.chosenBy} max={row.courseTotal} />
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {row.chosenBy} of {row.courseTotal} covers ({pct}%)
                </p>
              </div>

              {/* Allergens */}
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

              {/* Footer: price + drill-down */}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                {row.pricePerHead != null ? (
                  <span className="tabular-nums text-xs font-medium text-foreground">
                    £{row.pricePerHead}/head
                  </span>
                ) : (
                  <span />
                )}
                <EntitySheet
                  trigger={
                    <Button variant="ghost" size="sm" className="h-7 text-xs -mr-1">
                      <Users className="size-3 mr-1" aria-hidden />
                      {row.chosenBy} guests
                    </Button>
                  }
                  title={`Who chose: ${row.dish}`}
                  description={`${row.chosenBy} guest${row.chosenBy !== 1 ? "s" : ""} selected this option.`}
                  saveLabel="Close"
                  onSave={() => {}}
                >
                  <GuestDrillDown dish={row.dish} guestIds={row.guestIds} guestMap={guestMap} />
                </EntitySheet>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kitchen counts panel (kept from v1)
// ---------------------------------------------------------------------------

function KitchenCountsPanel({ courses }: { courses: MenuCourse[] }) {
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
        <div className="divide-y divide-border">
          {courses.map((course) => {
            const total = courseTotal(course)
            return (
              <div key={course.id} className="py-3 first:pt-0 last:pb-0">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {course.course}
                  </span>
                  <span className="tabular-nums text-xs font-semibold text-foreground">
                    {total} total
                  </span>
                </div>
                <div className="space-y-1.5">
                  {course.options.map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {o.name}
                      </span>
                      <span className="tabular-nums text-sm font-semibold text-foreground">
                        {o.chosenBy}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Allergen rollup panel (fixed denominator)
// ---------------------------------------------------------------------------

function AllergenRollupPanel({
  courses,
  guests,
  totalGuests,
}: {
  courses: MenuCourse[]
  guests: Guest[]
  totalGuests: number
}) {
  const rollup = buildAllergenRollup(courses, totalGuests)
  const dietaryCount = guestsWithDietary(guests)

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
            No allergens declared across this menu.
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

        {/* Dietary cross-check */}
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
  )
}

// ---------------------------------------------------------------------------
// Completion bar
// ---------------------------------------------------------------------------

function CompletionBar({
  chosen,
  total,
}: {
  chosen: number
  total: number
}) {
  const pct = total === 0 ? 0 : Math.round((chosen / total) * 100)
  const outstanding = total - chosen

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            {pct === 100 ? (
              <CheckCircle2 className="size-4 text-success-foreground shrink-0" aria-hidden />
            ) : (
              <Circle className="size-4 text-muted-foreground shrink-0" aria-hidden />
            )}
            <span className="text-sm font-medium text-foreground">
              Menu choices complete
            </span>
          </div>
          <span className="tabular-nums text-sm font-semibold text-foreground shrink-0">
            {chosen}/{total}
            <span className="ml-1 text-muted-foreground font-normal text-xs">({pct}%)</span>
          </span>
        </div>
        <Progress value={pct} className="h-2" />
        {outstanding > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            <span className="tabular-nums font-semibold text-foreground">{outstanding}</span>{" "}
            guest{outstanding !== 1 ? "s" : ""} yet to confirm a meal choice.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Menu Library note
// ---------------------------------------------------------------------------

function MenuLibraryNote() {
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
        href="/preview/admin/menu"
        className="shrink-0 text-[11px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        Manage library →
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props & root component
// ---------------------------------------------------------------------------

export interface MenuClientProps {
  courses: MenuCourse[]
  guests: Guest[]
  guestCount: number
}

export function MenuClient({ courses, guests, guestCount }: MenuClientProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [search, setSearch] = React.useState("")
  const [sortKey, setSortKey] = React.useState("course")
  const [view, setView] = React.useState<"table" | "card">("table")
  const [courseFilter, setCourseFilter] = React.useState<string>("all")

  // ── Derived ───────────────────────────────────────────────────────────────
  const allRows = React.useMemo(() => buildDishRows(courses), [courses])

  // Course names for filter chips
  const courseNames = React.useMemo(
    () => Array.from(new Set(allRows.map((r) => r.course))),
    [allRows],
  )

  // Apply search + course filter
  const filteredRows = React.useMemo(() => {
    const q = search.toLowerCase().trim()
    return allRows.filter((row) => {
      const matchesCourse =
        courseFilter === "all" || row.course === courseFilter
      const matchesSearch =
        !q ||
        row.dish.toLowerCase().includes(q) ||
        row.course.toLowerCase().includes(q) ||
        row.allergens.some((a) => a.toLowerCase().includes(q)) ||
        row.dietaryTags.some((d) => d.toLowerCase().includes(q)) ||
        (row.description ?? "").toLowerCase().includes(q)
      return matchesCourse && matchesSearch
    })
  }, [allRows, search, courseFilter])

  // Sort the filtered rows (for card view; table view sorts internally via SortableTable)
  const sortedRows = React.useMemo(() => {
    if (view === "table") return filteredRows // SortableTable handles sorting
    return [...filteredRows].sort((a, b) => {
      if (sortKey === "course") return a.course.localeCompare(b.course)
      if (sortKey === "chosenBy") return b.chosenBy - a.chosenBy
      if (sortKey === "pricePerHead")
        return (b.pricePerHead ?? 0) - (a.pricePerHead ?? 0)
      if (sortKey === "dish") return a.dish.localeCompare(b.dish)
      return 0
    })
  }, [filteredRows, sortKey, view])

  // Photo map (id → url) for dishes that have photos
  const photoMap = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const course of courses) {
      for (const opt of course.options) {
        if (opt.photoUrl) m.set(opt.id, opt.photoUrl)
      }
    }
    return m
  }, [courses])

  // Guest map for drill-downs
  const guestMap = React.useMemo(() => {
    const m = new Map<string, Guest>()
    for (const g of guests) m.set(g.id, g)
    return m
  }, [guests])

  // Completion: guests with at least a starter choice
  const chosenCount = React.useMemo(
    () => guestsWithChoices(guests),
    [guests],
  )

  // Export handler (optimistic demo)
  const handleExport = () => {
    toast("Exporting kitchen sheet… (prototype demo)")
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Completion bar */}
      <CompletionBar chosen={chosenCount} total={guestCount} />

      {/* Menu Library note */}
      <MenuLibraryNote />

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
            { value: "dish", label: "Dish A–Z" },
            { value: "chosenBy", label: "Most chosen" },
            { value: "pricePerHead", label: "Price/head" },
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
        resultCount={filteredRows.length}
        totalCount={allRows.length}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handleExport}
          >
            Export kitchen sheet
          </Button>
        }
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
            onClick={() => setCourseFilter(name === courseFilter ? "all" : name)}
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
      </DataToolbar>

      {/* Main view */}
      <div>
        {view === "table" ? (
          <TableView rows={filteredRows} guestMap={guestMap} photoMap={photoMap} />
        ) : (
          <CardView rows={sortedRows} guestMap={guestMap} photoMap={photoMap} />
        )}
      </div>

      {/* Right-panel section (kitchen + allergen) — below on mobile, inline note above */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KitchenCountsPanel courses={courses} />
        <AllergenRollupPanel courses={courses} guests={guests} totalGuests={guestCount} />
      </div>
    </div>
  )
}
