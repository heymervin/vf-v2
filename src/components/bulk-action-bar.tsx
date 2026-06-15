"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BulkActionBarProps {
  /** Number of currently selected items. Bar is hidden when 0. */
  count: number
  /** Called when the user dismisses the selection (X button or Escape key). */
  onClear: () => void
  /** Action buttons to render (delete, tag, assign, export…). */
  children: React.ReactNode
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * BulkActionBar — appears at the top of a list/table whenever rows are
 * selected. Shows the count, the caller's action buttons, and a clear button.
 * Pressing Escape anywhere on the page calls onClear.
 *
 * Renders nothing when count === 0 so callers can unconditionally mount it.
 */
export function BulkActionBar({ count, onClear, children }: BulkActionBarProps) {
  // Escape key dismisses the selection from anywhere on the page.
  React.useEffect(() => {
    if (count === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClear()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [count, onClear])

  if (count === 0) return null

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label={`${count} item${count === 1 ? "" : "s"} selected`}
      data-slot="bulk-action-bar"
      className={cn(
        // Layout — flex row, wraps on very small screens
        "flex flex-wrap items-center gap-2",
        "min-h-[44px] rounded-lg px-3 py-2",
        // Calm navy-tinted surface — distinct from the toolbar but not alarming
        "border border-primary/20 bg-accent/60",
        // Subtle entrance animation; respects prefers-reduced-motion
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1",
        "motion-safe:duration-150",
      )}
    >
      {/* Count label */}
      <span className="tabular-nums text-sm font-medium text-foreground select-none shrink-0">
        {count.toLocaleString()} selected
      </span>

      {/* Divider */}
      <div
        aria-hidden
        className="hidden sm:block h-4 w-px bg-border shrink-0"
      />

      {/* Action buttons slot */}
      <div className="flex flex-wrap items-center gap-1.5">
        {children}
      </div>

      {/* Spacer pushes clear button to the right */}
      <div className="flex-1" aria-hidden />

      {/* Clear / dismiss */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        aria-label="Clear selection"
        title="Clear selection (Esc)"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
