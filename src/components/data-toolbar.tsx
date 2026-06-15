"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DataToolbarSearchProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export interface DataToolbarSortProps {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}

export interface DataToolbarViewOption {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export interface DataToolbarViewProps {
  value: string
  onChange: (v: string) => void
  options: DataToolbarViewOption[]
}

export interface DataToolbarProps {
  search?: DataToolbarSearchProps
  sort?: DataToolbarSortProps
  view?: DataToolbarViewProps
  resultCount?: number
  totalCount?: number
  /** Filter-chip slot — rendered after the search input on the left */
  children?: React.ReactNode
  /** Right side: import/export/add buttons, etc. */
  actions?: React.ReactNode
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * DataToolbar — sticky row for search, filters, sort, view-toggle, actions,
 * and a result count. Wraps on mobile, stays calm and dense.
 *
 * Layout (left→right):
 *   [search input] [children chips] ‹spacer› [sort] [view toggle] [actions] [count]
 */
export function DataToolbar({
  search,
  sort,
  view,
  resultCount,
  totalCount,
  children,
  actions,
}: DataToolbarProps) {
  const showCount =
    resultCount !== undefined && totalCount !== undefined

  return (
    <div
      data-slot="data-toolbar"
      className={cn(
        // Sticky bar just below the page header.
        "sticky top-0 z-10 flex flex-wrap items-center gap-2",
        "min-h-[44px] rounded-lg border border-border bg-background/95 backdrop-blur-sm",
        "px-3 py-2",
        // Ensure the bar itself doesn't clip interactive children on scroll.
        "supports-backdrop-blur:bg-background/80",
      )}
    >
      {/* ── Left cluster ── */}
      <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
        {search && (
          <div className="relative flex items-center min-w-[180px] max-w-xs w-full sm:w-auto">
            <Search
              className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground shrink-0"
              aria-hidden
            />
            <Input
              type="search"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? "Search…"}
              className="pl-8 pr-8 h-8 text-sm"
              aria-label={search.placeholder ?? "Search"}
            />
            {search.value && (
              <button
                type="button"
                onClick={() => search.onChange("")}
                aria-label="Clear search"
                className={cn(
                  "absolute right-2 flex items-center justify-center",
                  "size-4 rounded-sm text-muted-foreground",
                  "hover:text-foreground transition-colors",
                  // Ensure at least 44px tap target via padding trick on mobile
                  "pointer-coarse:p-3 pointer-coarse:-m-3",
                )}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Filter chips (passed as children) */}
        {children && (
          <div className="flex flex-wrap items-center gap-1.5">
            {children}
          </div>
        )}
      </div>

      {/* ── Right cluster ── */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Sort select */}
        {sort && (
          <Select value={sort.value} onValueChange={sort.onChange}>
            <SelectTrigger
              size="sm"
              className="h-8 gap-1 text-sm min-w-[120px]"
              aria-label="Sort by"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {sort.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* View toggle — icon button group */}
        {view && view.options.length > 1 && (
          <div
            data-slot="button-group"
            className="flex items-center rounded-md border border-border overflow-hidden"
            role="group"
            aria-label="View mode"
          >
            {view.options.map((opt) => {
              const Icon = opt.icon
              const isActive = view.value === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => view.onChange(opt.value)}
                  aria-label={opt.label}
                  aria-pressed={isActive}
                  title={opt.label}
                  className={cn(
                    "flex items-center justify-center size-8",
                    "transition-colors focus-visible:outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring/50",
                    "border-r border-border last:border-r-0",
                    // pointer-coarse ensures 44px minimum touch target height
                    "pointer-coarse:size-11",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </button>
              )
            })}
          </div>
        )}

        {/* Actions slot (import, export, add, etc.) */}
        {actions && (
          <div className="flex items-center gap-1.5">
            {actions}
          </div>
        )}

        {/* Result count */}
        {showCount && (
          <span className="tabular-nums text-xs text-muted-foreground whitespace-nowrap select-none pl-1">
            {resultCount!.toLocaleString()}
            {" of "}
            {totalCount!.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  )
}
