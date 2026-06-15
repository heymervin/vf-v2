"use client"

import * as React from "react"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SortableColumn<T> {
  key: string
  header: string
  sortable?: boolean
  align?: "left" | "right" | "center"
  className?: string
  render: (row: T) => React.ReactNode
  /** Override what value is used for sorting. Defaults to render output (string coerce). */
  sortValue?: (row: T) => string | number
}

export type SortDir = "asc" | "desc"

export interface SortableTableProps<T> {
  columns: SortableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  /** Enable row checkboxes */
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  onRowClick?: (row: T) => void
  initialSort?: { key: string; dir: SortDir }
  /** Pin the thead when the table scrolls */
  stickyHeader?: boolean
  emptyState?: React.ReactNode
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

function resolveValue<T>(
  row: T,
  col: SortableColumn<T>,
): string | number {
  if (col.sortValue) return col.sortValue(row)
  // Fall back to string coercion of whatever render returns.
  const rendered = col.render(row)
  if (typeof rendered === "string" || typeof rendered === "number") return rendered
  return ""
}

function sortRows<T>(
  rows: T[],
  columns: SortableColumn<T>[],
  sortKey: string,
  sortDir: SortDir,
): T[] {
  const col = columns.find((c) => c.key === sortKey)
  if (!col) return rows

  return [...rows].sort((a, b) => {
    const av = resolveValue(a, col)
    const bv = resolveValue(b, col)
    let cmp = 0
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv
    } else {
      cmp = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    }
    return sortDir === "asc" ? cmp : -cmp
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SortableTable<T> — generic, fully typed data table built on the existing
 * ui/table primitives. Handles internal sort state, optional row selection,
 * sticky header, and an empty state slot.
 */
export function SortableTable<T>({
  columns,
  rows,
  getRowId,
  selectable = false,
  selectedIds,
  onSelectionChange,
  onRowClick,
  initialSort,
  stickyHeader = false,
  emptyState,
}: SortableTableProps<T>) {
  // ── Sort state ────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = React.useState<string>(
    initialSort?.key ?? "",
  )
  const [sortDir, setSortDir] = React.useState<SortDir>(
    initialSort?.dir ?? "asc",
  )

  const handleHeadClick = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sorted = React.useMemo(
    () =>
      sortKey
        ? sortRows(rows, columns, sortKey, sortDir)
        : rows,
    [rows, columns, sortKey, sortDir],
  )

  // ── Selection helpers ─────────────────────────────────────────────────────
  const controlled = selectedIds !== undefined
  const selection: Set<string> = controlled ? selectedIds! : new Set()

  const allIds = React.useMemo(
    () => sorted.map((r) => getRowId(r)),
    [sorted, getRowId],
  )

  const allSelected = allIds.length > 0 && allIds.every((id) => selection.has(id))
  const someSelected = !allSelected && allIds.some((id) => selection.has(id))

  const handleSelectAll = () => {
    if (!onSelectionChange) return
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(allIds))
    }
  }

  const handleSelectRow = (id: string) => {
    if (!onSelectionChange) return
    const next = new Set(selection)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onSelectionChange(next)
  }

  // ── Align helper ──────────────────────────────────────────────────────────
  const alignClass = (align?: "left" | "right" | "center") => {
    if (align === "right") return "text-right"
    if (align === "center") return "text-center"
    return "text-left"
  }

  // ── Sort icon ─────────────────────────────────────────────────────────────
  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey)
      return <ChevronsUpDown className="ml-1 inline size-3 text-muted-foreground/50" aria-hidden />
    if (sortDir === "asc")
      return <ChevronUp className="ml-1 inline size-3 text-foreground" aria-hidden />
    return <ChevronDown className="ml-1 inline size-3 text-foreground" aria-hidden />
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      data-slot="sortable-table"
      className="relative w-full overflow-x-auto rounded-xl border border-border bg-card shadow-xs"
    >
      <table className="w-full caption-bottom text-sm">
        <thead
          data-slot="table-header"
          className={cn(
            "[&_tr]:border-b [&_tr]:border-border",
            stickyHeader && "sticky top-0 z-10 bg-card",
          )}
        >
          <tr>
            {selectable && (
              <th
                data-slot="table-head"
                className="h-10 w-10 px-3 align-middle"
                aria-label="Select all rows"
              >
                <Checkbox
                  checked={allSelected}
                  // indeterminate state via data attribute on the underlying input
                  data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                  className={cn(someSelected && "opacity-70")}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                data-slot="table-head"
                className={cn(
                  "h-10 px-3 align-middle text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap",
                  alignClass(col.align),
                  col.sortable &&
                    "cursor-pointer select-none hover:text-foreground transition-colors",
                  col.className,
                )}
                onClick={col.sortable ? () => handleHeadClick(col.key) : undefined}
                aria-sort={
                  col.sortable && sortKey === col.key
                    ? sortDir === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                {col.header}
                {col.sortable && <SortIcon colKey={col.key} />}
              </th>
            ))}
          </tr>
        </thead>

        <tbody data-slot="table-body" className="[&_tr:last-child]:border-0">
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={selectable ? columns.length + 1 : columns.length}
                className="px-3 py-12 text-center"
              >
                {emptyState ?? (
                  <span className="text-sm text-muted-foreground">
                    No rows to display.
                  </span>
                )}
              </td>
            </tr>
          ) : (
            sorted.map((row) => {
              const id = getRowId(row)
              const isSelected = selection.has(id)
              const isClickable = Boolean(onRowClick)

              return (
                <tr
                  key={id}
                  data-slot="table-row"
                  data-state={isSelected ? "selected" : undefined}
                  onClick={isClickable ? () => onRowClick!(row) : undefined}
                  className={cn(
                    "border-b border-border transition-colors",
                    "hover:bg-accent/40 data-[state=selected]:bg-accent/60",
                    // Enforce 44px minimum row height on touch devices
                    "pointer-coarse:min-h-[44px]",
                    isClickable && "cursor-pointer",
                  )}
                >
                  {selectable && (
                    <td
                      data-slot="table-cell"
                      className="w-10 px-3 py-3 align-middle"
                      onClick={(e) => {
                        // Prevent row click when toggling checkbox
                        e.stopPropagation()
                        handleSelectRow(id)
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleSelectRow(id)}
                        aria-label={`Select row ${id}`}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      data-slot="table-cell"
                      className={cn(
                        "px-3 py-3 align-middle whitespace-nowrap",
                        alignClass(col.align),
                        col.className,
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
