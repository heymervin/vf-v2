"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SmartList {
  id: string
  name: string
  /** Optional item count shown as a small badge beside the name. */
  count?: number
}

export interface SmartListBarProps {
  lists: SmartList[]
  activeId: string
  onChange: (id: string) => void
  /** If provided, a "+ Save view" ghost button is shown at the end. */
  onSaveCurrent?: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SmartListBar — horizontal scrolling pill/tab strip for switching between
 * saved list views (e.g. "All contacts", "Hot leads", "Booked 2026"). Active
 * pill is pulse-pink per DESIGN.md sidebar-primary. Scrolls horizontally on
 * mobile without showing a scrollbar.
 */
export function SmartListBar({
  lists,
  activeId,
  onChange,
  onSaveCurrent,
}: SmartListBarProps) {
  // Scroll the active pill into view when activeId changes programmatically.
  const activeRef = React.useRef<HTMLButtonElement | null>(null)

  React.useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    })
  }, [activeId])

  return (
    <div
      data-slot="smart-list-bar"
      className={cn(
        // Horizontal scroll container — hide scrollbar cross-browser but keep
        // the scroll gesture available (especially on mobile).
        "flex items-center gap-1.5 overflow-x-auto",
        "scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        "min-h-[44px] py-1",
      )}
      role="tablist"
      aria-label="Saved views"
    >
      {lists.map((list) => {
        const isActive = list.id === activeId
        return (
          <button
            key={list.id}
            ref={isActive ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`smartlist-panel-${list.id}`}
            id={`smartlist-tab-${list.id}`}
            onClick={() => onChange(list.id)}
            className={cn(
              // Pill shape — rounded-full per DESIGN.md chips
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1",
              // Typography
              "text-sm font-medium whitespace-nowrap",
              // Touch target — 44px minimum height via parent padding + own height
              "min-h-[32px] pointer-coarse:min-h-[44px] pointer-coarse:px-4",
              // Transitions
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              // Active = pulse-pink (sidebar-primary per DESIGN.md)
              isActive
                ? "bg-fun-pink text-fun-pink-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span>{list.name}</span>

            {list.count !== undefined && (
              <span
                className={cn(
                  "tabular-nums inline-flex items-center justify-center",
                  "rounded-full px-1.5 py-px text-[11px] font-semibold leading-none",
                  // Count badge sits inside the pill; tone shifts with active state
                  isActive
                    ? "bg-fun-pink-foreground/10 text-fun-pink-foreground"
                    : "bg-foreground/10 text-muted-foreground",
                )}
                aria-label={`${list.count} items`}
              >
                {list.count.toLocaleString()}
              </span>
            )}
          </button>
        )
      })}

      {/* "+ Save view" ghost button — only when onSaveCurrent is provided */}
      {onSaveCurrent && (
        <>
          {/* Visual separator between saved pills and the save action */}
          <div
            aria-hidden
            className="mx-0.5 h-4 w-px shrink-0 bg-border"
          />
          <button
            type="button"
            onClick={onSaveCurrent}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1",
              "text-sm font-medium whitespace-nowrap text-muted-foreground",
              "min-h-[32px] pointer-coarse:min-h-[44px]",
              "border border-dashed border-border",
              "hover:border-primary/40 hover:text-foreground",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
            aria-label="Save current view as a new list"
          >
            <Plus className="size-3.5 shrink-0" aria-hidden />
            <span>Save view</span>
          </button>
        </>
      )}
    </div>
  )
}
