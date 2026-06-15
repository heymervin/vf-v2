"use client";

/**
 * FloorCanvas — spatial venue-room canvas for the VenueFlow floorplan module.
 *
 * Renders fixed RoomElements as labelled zones positioned by (x, y, w, h)
 * percentages. Children (ShapedTable instances from the consumer) are also
 * positioned absolutely using the same percentage coordinate system — the
 * consumer applies `style={{ left: '${t.x}%', top: '${t.y}%' }}` and
 * `position: 'absolute'` to each child.
 *
 * The canvas does NOT import ShapedTable; consumers compose them.
 *
 * Aspect ratio: 4:3 (landscape). Horizontal scroll on screens narrower than
 * the canvas's min-width so the spatial layout is never distorted on mobile.
 */

import { cn } from "@/lib/utils";
import type { RoomElement } from "@/lib/mock/planning";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FloorCanvasProps {
  roomElements: RoomElement[];
  /** ShapedTable instances absolutely positioned by the consumer. */
  children: React.ReactNode;
  className?: string;
}

// ---------------------------------------------------------------------------
// Room element appearance
// ---------------------------------------------------------------------------

interface ElementStyle {
  bg: string;
  border: string;
  text: string;
  icon: string;
}

const ELEMENT_STYLES: Record<RoomElement["kind"], ElementStyle> = {
  stage: {
    bg: "bg-fun-blue/20",
    border: "border-fun-blue-strong/40",
    text: "text-fun-blue-strong",
    icon: "🎤",
  },
  dancefloor: {
    bg: "bg-fun-pink/25",
    border: "border-fun-pink-strong/40",
    text: "text-fun-pink-strong",
    icon: "✦",
  },
  bar: {
    bg: "bg-fun-teal/25",
    border: "border-fun-teal-strong/40",
    text: "text-fun-teal-strong",
    icon: "◈",
  },
  entrance: {
    bg: "bg-fun-green/25",
    border: "border-fun-green-strong/40",
    text: "text-fun-green-strong",
    icon: "⬦",
  },
  wall: {
    bg: "bg-muted/60",
    border: "border-border",
    text: "text-muted-foreground",
    icon: "",
  },
};

// ---------------------------------------------------------------------------
// Dot-grid background (inline SVG data-uri — token-safe, dark-mode compatible)
// The grid is rendered via a CSS background so it costs zero DOM nodes.
// ---------------------------------------------------------------------------

const DOT_GRID_STYLE = {
  backgroundImage: `radial-gradient(circle, var(--border) 1px, transparent 1px)`,
  backgroundSize: "24px 24px",
} as React.CSSProperties;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FloorCanvas({
  roomElements,
  children,
  className,
}: FloorCanvasProps) {
  return (
    // Outer scroll wrapper — enables horizontal scroll on narrow viewports
    // without distorting the spatial layout.
    <div
      className={cn("w-full overflow-x-auto rounded-xl", className)}
      role="region"
      aria-label="Venue floor plan"
    >
      {/*
       * Canvas container:
       *  - min-w-[640px] ensures the layout is never crushed on mobile
       *  - aspect-[4/3] gives a consistent venue-room proportion
       *  - relative so all children (room elements + tables) position against it
       */}
      <div
        className={cn(
          "relative w-full min-w-[640px]",
          "aspect-[4/3]",
          "rounded-xl border border-border bg-card",
          "shadow-sm overflow-hidden"
        )}
        style={DOT_GRID_STYLE}
      >
        {/* ---- Fixed room elements ---- */}
        {roomElements.map((el) => {
          const styles = ELEMENT_STYLES[el.kind];
          return (
            <div
              key={el.id}
              aria-label={el.label}
              className={cn(
                "absolute flex flex-col items-center justify-center gap-0.5",
                "rounded-lg border",
                styles.bg,
                styles.border,
                "select-none"
              )}
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.w}%`,
                height: `${el.h}%`,
              }}
            >
              {styles.icon && (
                <span
                  aria-hidden
                  className={cn("text-[10px] leading-none", styles.text)}
                >
                  {styles.icon}
                </span>
              )}
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-[0.08em] leading-none text-center",
                  styles.text
                )}
              >
                {el.label}
              </span>
            </div>
          );
        })}

        {/* ---- Consumer-positioned tables ---- */}
        {children}
      </div>
    </div>
  );
}
