"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Phone,
  Users,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import type { RunsheetItem, Supplier, Wedding } from "@/lib/mock"

// ---------------------------------------------------------------------------
// Category config — matches page.tsx exactly
// ---------------------------------------------------------------------------

type Category = RunsheetItem["category"]

const CATEGORY: Record<
  Category,
  { label: string; dot: string; chip: string }
> = {
  ceremony: {
    label: "Ceremony",
    dot: "bg-fun-pink-strong",
    chip: "bg-fun-pink text-fun-pink-foreground",
  },
  reception: {
    label: "Reception",
    dot: "bg-fun-blue-strong",
    chip: "bg-fun-blue text-foreground",
  },
  catering: {
    label: "Catering",
    dot: "bg-fun-green-strong",
    chip: "bg-fun-green text-foreground",
  },
  supplier: {
    label: "Supplier",
    dot: "bg-fun-teal-strong",
    chip: "bg-fun-teal text-foreground",
  },
  logistics: {
    label: "Logistics",
    dot: "bg-accent-foreground",
    chip: "bg-mint text-foreground",
  },
}

const CATEGORY_ORDER: Category[] = [
  "ceremony",
  "reception",
  "catering",
  "supplier",
  "logistics",
]

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// ---------------------------------------------------------------------------
// Live clock hook
// ---------------------------------------------------------------------------

function useLiveClock() {
  const [time, setTime] = React.useState<string>(() => {
    const now = new Date()
    return now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  })

  React.useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }))
    }
    tick()
    const interval = setInterval(tick, 10_000) // update every 10s
    return () => clearInterval(interval)
  }, [])

  return time
}

// ---------------------------------------------------------------------------
// Parse "HH:MM" to minutes-since-midnight for comparison
// ---------------------------------------------------------------------------

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

// ---------------------------------------------------------------------------
// NOW / NEXT derivation (based on live clock)
// ---------------------------------------------------------------------------

function getNowNext(
  items: { id: string; time: string; durationMin: number }[],
  clockTime: string,
): { nowId: string | null; nextId: string | null } {
  const nowMins = timeToMinutes(clockTime)

  let nowId: string | null = null
  let nextId: string | null = null

  for (const item of items) {
    const start = timeToMinutes(item.time)
    const end = start + item.durationMin
    if (nowMins >= start && nowMins < end) {
      nowId = item.id
    }
  }

  // next = first item that starts strictly after current time, or after the current item ends
  for (const item of items) {
    const start = timeToMinutes(item.time)
    if (start > nowMins) {
      nextId = item.id
      break
    }
  }

  return { nowId, nextId }
}

// ---------------------------------------------------------------------------
// Count board
// ---------------------------------------------------------------------------

interface CountBoardProps {
  totalGuests: number
  suppliersCheckedIn: number
  totalSuppliers: number
  itemsDone: number
  totalItems: number
  nextTime: string | null
}

function CountBoard({
  totalGuests,
  suppliersCheckedIn,
  totalSuppliers,
  itemsDone,
  totalItems,
  nextTime,
}: CountBoardProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Guests */}
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <Users className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Guests
          </span>
        </div>
        <span className="text-2xl font-bold tabular-nums text-foreground leading-tight">
          {totalGuests}
        </span>
      </div>

      {/* Suppliers checked in */}
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-fun-green-strong" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Suppliers in
          </span>
        </div>
        <span className="text-2xl font-bold tabular-nums text-foreground leading-tight">
          {suppliersCheckedIn}
          <span className="text-base font-normal text-muted-foreground">
            /{totalSuppliers}
          </span>
        </span>
      </div>

      {/* Items done */}
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <Zap className="size-3.5 text-warning-foreground" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Done
          </span>
        </div>
        <span className="text-2xl font-bold tabular-nums text-foreground leading-tight">
          {itemsDone}
          <span className="text-base font-normal text-muted-foreground">
            /{totalItems}
          </span>
        </span>
      </div>

      {/* Next item time */}
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Next item
          </span>
        </div>
        <span className="text-2xl font-bold tabular-nums text-foreground leading-tight">
          {nextTime ?? "—"}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NOW / NEXT strip
// ---------------------------------------------------------------------------

interface NowNextStripProps {
  nowItem: { id: string; time: string; title: string; owner: string; category: Category; supplierId?: string | null } | null
  nextItem: { id: string; time: string; title: string; owner: string; category: Category; supplierId?: string | null } | null
  clockTime: string
  supplierMap: Record<string, Supplier>
}

function NowNextStrip({ nowItem, nextItem, clockTime, supplierMap }: NowNextStripProps) {
  if (!nowItem && !nextItem) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* NOW */}
      {nowItem && (
        <div className="relative overflow-hidden rounded-xl border-2 border-primary/30 bg-primary/5 px-5 py-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
              Now
            </span>
            <span className="ml-auto font-mono text-2xl font-bold tabular-nums text-foreground">
              {clockTime}
            </span>
          </div>
          <p className="text-lg font-semibold leading-snug text-foreground sm:text-xl">
            {nowItem.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{nowItem.owner}</span>
            {nowItem.supplierId && supplierMap[nowItem.supplierId] && (
              <a
                href={`tel:${supplierMap[nowItem.supplierId].phone}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                aria-label={`Call ${supplierMap[nowItem.supplierId].name}`}
              >
                <Phone className="size-3.5" aria-hidden />
                Call {supplierMap[nowItem.supplierId].contactName}
              </a>
            )}
          </div>
        </div>
      )}

      {/* NEXT */}
      {nextItem && (
        <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Up next
            </span>
            <span className="ml-auto text-lg font-bold tabular-nums text-foreground">
              {nextItem.time}
            </span>
          </div>
          <p className="text-base font-semibold leading-snug text-foreground">
            {nextItem.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{nextItem.owner}</span>
            {nextItem.supplierId && supplierMap[nextItem.supplierId] && (
              <a
                href={`tel:${supplierMap[nextItem.supplierId].phone}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                aria-label={`Call ${supplierMap[nextItem.supplierId].name}`}
              >
                <Phone className="size-3.5" aria-hidden />
                Call {supplierMap[nextItem.supplierId].contactName}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Event-Day check-off row
// ---------------------------------------------------------------------------

interface EventDayRowProps {
  item: RunsheetItem
  done: boolean
  isNow: boolean
  isNext: boolean
  onToggle: (id: string, done: boolean) => void
  supplier: Supplier | null
}

function EventDayRow({
  item,
  done,
  isNow,
  isNext,
  onToggle,
  supplier,
}: EventDayRowProps) {
  const cat = CATEGORY[item.category]

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-xl border px-4 py-4 transition-all",
        "min-h-[64px]",
        done
          ? "border-border bg-muted/40 opacity-60"
          : isNow
            ? "border-primary/30 bg-primary/5 shadow-sm"
            : isNext
              ? "border-border bg-card shadow-xs"
              : "border-border bg-card",
      )}
    >
      {/* Check-off button — 44px tap target */}
      <button
        type="button"
        onClick={() => onToggle(item.id, !done)}
        aria-label={done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
        className={cn(
          "mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors",
          "-ml-1",
          done
            ? "text-fun-green-strong hover:text-muted-foreground"
            : "text-muted-foreground/50 hover:text-fun-green-strong",
        )}
      >
        {done ? (
          <CheckCircle2 className="size-6" aria-hidden />
        ) : (
          <Circle className="size-6" aria-hidden />
        )}
      </button>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        {/* Time + category chip */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-mono text-sm font-semibold tabular-nums",
              done ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {item.time}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
              cat.chip,
            )}
          >
            <span className={cn("size-1.5 rounded-full", cat.dot)} />
            {cat.label}
          </span>
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
            {formatDuration(item.durationMin)}
          </span>
        </div>

        {/* Title */}
        <p
          className={cn(
            "text-base font-semibold leading-snug sm:text-lg",
            done ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground",
          )}
        >
          {item.title}
        </p>

        {/* Owner + supplier contact */}
        <div className="flex flex-wrap items-center gap-3 mt-0.5">
          <span className="text-sm text-muted-foreground">{item.owner}</span>

          {supplier && (
            <a
              href={`tel:${supplier.phone}`}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-3",
                "text-sm font-medium text-foreground transition-colors hover:bg-accent",
              )}
              aria-label={`Call ${supplier.name}: ${supplier.phone}`}
            >
              <Phone className="size-3.5 shrink-0" aria-hidden />
              {supplier.contactName} · {supplier.name}
            </a>
          )}
        </div>

        {/* Notes (if present) */}
        {item.notes && (
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {item.notes}
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Planning view item (preserved original look)
// ---------------------------------------------------------------------------

interface PlanningRowProps {
  item: RunsheetItem
  isLast: boolean
  supplier: Supplier | null
}

function PlanningRow({ item, isLast, supplier }: PlanningRowProps) {
  const cat = CATEGORY[item.category]

  return (
    <div className="grid grid-cols-[72px_auto] gap-x-4 sm:grid-cols-[88px_auto]">
      {/* Left rail: time + connector line */}
      <div className="relative flex flex-col items-end pt-0.5">
        <span className="text-base font-semibold tabular-nums leading-tight text-foreground sm:text-lg">
          {item.time}
        </span>
        {!isLast && (
          <div className="absolute right-[-17px] top-6 bottom-[-32px] w-px bg-border sm:right-[-21px]" />
        )}
      </div>

      {/* Dot + card */}
      <div className="relative pb-8">
        <div
          className={cn(
            "absolute left-[-21px] top-1.5 size-3.5 rounded-full border-2 border-card sm:left-[-25px]",
            cat.dot,
          )}
        />

        <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
          {/* Top row: chip + duration */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
                cat.chip,
              )}
            >
              <span className={cn("size-1.5 rounded-full", cat.dot)} />
              {cat.label}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-medium tabular-nums text-muted-foreground">
              <Clock className="size-3" />
              {formatDuration(item.durationMin)}
            </span>
          </div>

          {/* Title */}
          <p className="text-sm font-medium leading-snug text-foreground sm:text-[15px]">
            {item.title}
          </p>

          {/* Owner + supplier contact */}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{item.owner}</span>
            </div>
            {supplier && (
              <a
                href={`tel:${supplier.phone}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                aria-label={`Call ${supplier.name}`}
              >
                <Phone className="size-3.5" aria-hidden />
                {supplier.contactName}
              </a>
            )}
          </div>

          {/* Notes */}
          {item.notes && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-t border-border pt-2">
              {item.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CATEGORY_ORDER.map((cat) => {
        const c = CATEGORY[cat]
        return (
          <span
            key={cat}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]",
              c.chip,
            )}
          >
            <span className={cn("size-1.5 rounded-full", c.dot)} />
            {c.label}
          </span>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category filter pills (Event-Day)
// ---------------------------------------------------------------------------

interface CategoryPillsProps {
  active: Category | "all"
  onChange: (c: Category | "all") => void
  counts: Record<Category, number>
}

function CategoryPills({ active, onChange, counts }: CategoryPillsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
      <button
        type="button"
        onClick={() => onChange("all")}
        aria-pressed={active === "all"}
        className={cn(
          "inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors",
          active === "all"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        All
      </button>
      {CATEGORY_ORDER.filter((c) => counts[c] > 0).map((cat) => {
        const c = CATEGORY[cat]
        const isActive = active === cat
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : cn(c.chip, "opacity-80 hover:opacity-100"),
            )}
          >
            <span className={cn("size-2 rounded-full", isActive ? "bg-primary-foreground" : c.dot)} />
            {c.label}
            <span
              className={cn(
                "ml-0.5 tabular-nums text-xs",
                isActive ? "text-primary-foreground/70" : "text-inherit opacity-70",
              )}
            >
              {counts[cat]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export interface RunsheetClientProps {
  wedding: Pick<Wedding, "coupleName" | "date" | "space" | "guestCount" | "runsheet" | "suppliers" | "keyFacts">
  weddingId: string
  formattedDate: string
}

type ViewMode = "planning" | "event-day"

export function RunsheetClient({ wedding, weddingId, formattedDate }: RunsheetClientProps) {
  const [mode, setMode] = React.useState<ViewMode>("planning")
  const clockTime = useLiveClock()

  // --- Check-off state (optimistic) ---
  const [doneIds, setDoneIds] = React.useState<Set<string>>(
    () => new Set(wedding.runsheet.filter((r) => r.done).map((r) => r.id)),
  )

  // --- Category filter (event-day mode) ---
  const [categoryFilter, setCategoryFilter] = React.useState<Category | "all">("all")

  // --- Supplier lookup map ---
  const supplierMap: Record<string, Supplier> = React.useMemo(
    () => Object.fromEntries(wedding.suppliers.map((s) => [s.id, s])),
    [wedding.suppliers],
  )

  // --- Derived: NOW / NEXT based on clock ---
  const { nowId, nextId } = React.useMemo(
    () => getNowNext(wedding.runsheet, clockTime),
    [wedding.runsheet, clockTime],
  )

  const nowItem = wedding.runsheet.find((r) => r.id === nowId) ?? null
  const nextItem = wedding.runsheet.find((r) => r.id === nextId) ?? null

  // --- Toggle done state ---
  function handleToggle(id: string, nextDone: boolean) {
    setDoneIds((prev) => {
      const next = new Set(prev)
      if (nextDone) next.add(id)
      else next.delete(id)
      return next
    })

    const item = wedding.runsheet.find((r) => r.id === id)
    if (item) {
      toast.success(nextDone ? `Checked off: ${item.title}` : `Unchecked: ${item.title}`, {
        duration: 2000,
      })
    }
  }

  // --- Filter + sort for event-day ---
  const filteredItems = React.useMemo(() => {
    if (categoryFilter === "all") return wedding.runsheet
    return wedding.runsheet.filter((r) => r.category === categoryFilter)
  }, [wedding.runsheet, categoryFilter])

  // --- Counts ---
  const itemsDone = doneIds.size
  const totalItems = wedding.runsheet.length
  const progressPct = totalItems > 0 ? Math.round((itemsDone / totalItems) * 100) : 0

  const suppliersCheckedIn = wedding.suppliers.filter((s) => s.checkedInAt).length

  const categoryCounts = React.useMemo(() => {
    const counts = {} as Record<Category, number>
    for (const cat of CATEGORY_ORDER) {
      counts[cat] = wedding.runsheet.filter((r) => r.category === cat).length
    }
    return counts
  }, [wedding.runsheet])

  // --- Mode toggle UI ---
  const modeToggleEl = (
      <div
        className="flex items-center rounded-lg border border-border bg-muted p-1"
        role="group"
        aria-label="View mode"
      >
        <button
          type="button"
          onClick={() => setMode("planning")}
          aria-pressed={mode === "planning"}
          className={cn(
            "flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
            mode === "planning"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <CalendarDays className="size-3.5" aria-hidden />
          Planning
        </button>
        <button
          type="button"
          onClick={() => setMode("event-day")}
          aria-pressed={mode === "event-day"}
          className={cn(
            "flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
            mode === "event-day"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Zap className="size-3.5" aria-hidden />
          Event Day
        </button>
      </div>
  )

  // ---------------------------------------------------------------------------
  // PLANNING MODE
  // ---------------------------------------------------------------------------

  if (mode === "planning") {
    return (
      <div className="mx-auto max-w-[1400px]">
        {/* Page header row */}
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="inline-block title-shimmer-underline text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
              Run-sheet
            </h1>
            <p className="mt-5 max-w-2xl text-sm text-muted-foreground">
              {wedding.coupleName} · {formattedDate} · {wedding.space}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {modeToggleEl}
            <Link
              href={`/preview/weddings/${weddingId}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <ArrowLeft className="size-4" />
              Open workspace
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
          {/* Timeline */}
          <div>
            {/* Legend row */}
            <div className="mb-8">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Categories
              </p>
              <Legend />
            </div>

            {/* Items */}
            <div>
              {wedding.runsheet.length === 0 ? (
                <div className="flex flex-col items-center rounded-xl border border-border bg-card py-16 text-center shadow-xs">
                  <Clock className="mb-4 size-10 text-muted-foreground/40" />
                  <p className="text-base font-semibold text-foreground">No run-sheet yet</p>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    Add timed items to build the day&apos;s timeline. Your coordinator can share
                    this with suppliers.
                  </p>
                </div>
              ) : (
                <div>
                  {wedding.runsheet.map((item, i) => (
                    <PlanningRow
                      key={item.id}
                      item={item}
                      isLast={i === wedding.runsheet.length - 1}
                      supplier={item.supplierId ? (supplierMap[item.supplierId] ?? null) : null}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar summary */}
          <aside className="space-y-5">
            {/* Summary card */}
            <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Day at a glance
              </p>
              {wedding.runsheet.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Doors open</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {wedding.runsheet[0].time}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Last item</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {wedding.runsheet[wedding.runsheet.length - 1].time}
                    </span>
                  </div>
                  <div className="my-2 h-px bg-border" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Items by category
                  </p>
                  <div className="space-y-2">
                    {CATEGORY_ORDER.map((cat) => {
                      const count = wedding.runsheet.filter((r) => r.category === cat).length
                      if (count === 0) return null
                      const c = CATEGORY[cat]
                      return (
                        <div key={cat} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={cn("size-2 rounded-full", c.dot)} />
                            <span className="text-xs text-muted-foreground">{c.label}</span>
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-foreground">
                            {count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Wedding facts */}
            <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Wedding details
              </p>
              <div className="space-y-3">
                {wedding.keyFacts.map((fact) => (
                  <div key={fact.label} className="flex items-start justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{fact.label}</span>
                    <span className="text-right text-xs font-medium text-foreground">
                      {fact.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cross-links */}
            <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Planning tools
              </p>
              <nav className="space-y-1">
                {[
                  { label: "Guests", href: "/preview/guests" },
                  { label: "Menu", href: "/preview/menu" },
                  { label: "Suppliers", href: "/preview/suppliers" },
                  { label: "Floor plan", href: "/preview/floorplan" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex min-h-[40px] items-center rounded-lg px-2 text-sm text-foreground transition-colors hover:bg-accent"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // EVENT-DAY MODE
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Event-day header — compact, high-contrast */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/preview/weddings/${weddingId}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            aria-label="Open wedding workspace"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {wedding.coupleName}
            </h1>
            <p className="text-sm text-muted-foreground">{formattedDate} · {wedding.space}</p>
          </div>
        </div>
        {modeToggleEl}
      </div>

      {/* Count board (P1) */}
      <div className="mb-5">
        <CountBoard
          totalGuests={wedding.guestCount}
          suppliersCheckedIn={suppliersCheckedIn}
          totalSuppliers={wedding.suppliers.length}
          itemsDone={itemsDone}
          totalItems={totalItems}
          nextTime={nextItem?.time ?? null}
        />
      </div>

      {/* Progress strip */}
      <div className="mb-5 rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Day progress
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {itemsDone} / {totalItems} items
          </span>
        </div>
        <Progress value={progressPct} className="h-2" aria-label={`${progressPct}% complete`} />
        <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
          {progressPct}% complete
        </p>
      </div>

      {/* NOW / NEXT strip */}
      {(nowItem || nextItem) && (
        <div className="mb-5">
          <NowNextStrip
            nowItem={nowItem}
            nextItem={nextItem}
            clockTime={clockTime}
            supplierMap={supplierMap}
          />
        </div>
      )}

      {/* Category filter pills (P1) */}
      <div className="mb-4">
        <CategoryPills
          active={categoryFilter}
          onChange={setCategoryFilter}
          counts={categoryCounts}
        />
      </div>

      {/* Run-sheet items */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-border bg-card py-12 text-center shadow-xs">
            <Clock className="mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">No items in this category</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <EventDayRow
              key={item.id}
              item={item}
              done={doneIds.has(item.id)}
              isNow={item.id === nowId}
              isNext={item.id === nextId}
              onToggle={handleToggle}
              supplier={item.supplierId ? (supplierMap[item.supplierId] ?? null) : null}
            />
          ))
        )}
      </div>

      {/* Done-state note when all complete */}
      {itemsDone === totalItems && totalItems > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-fun-green/40 px-5 py-4">
          <CheckCircle2 className="size-5 shrink-0 text-fun-green-strong" aria-hidden />
          <p className="text-sm font-semibold text-foreground">
            All {totalItems} items complete. Great work today.
          </p>
        </div>
      )}
    </div>
  )
}
