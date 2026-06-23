"use client";

/**
 * ShapedTable — visual seating primitive for the VenueFlow floorplan module.
 *
 * Renders an SVG table body in its actual shape with per-seat markers arranged
 * around the perimeter. Seat-placement math:
 *
 *   round   — N seats at angle (2π·i/N − π/2) on a radius of (tableR + gap + seatR)
 *   square  — seats distributed across 4 sides; extras go to left/right to match capacity
 *   banquet — half capacity along top edge, half along bottom, evenly spaced
 *   top     — same as banquet but wider aspect; seats run along long sides only
 *
 * The SVG viewBox is always square (sizePx × sizePx) with the table body
 * centred and seats drawn just outside. This means the consumer can position
 * the component by its top-left corner knowing the bounding box is consistent.
 */

import { cn } from "@/lib/utils";
import type { FloorplanTable } from "@/lib/floorplan/types";
import type { Guest } from "@/lib/guests/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShapedTableProps {
  table: FloorplanTable;
  seatedGuests: Guest[];
  selected?: boolean;
  onSelect?: () => void;
  /** "dietary" tints filled seats whose guest has dietary requirements in warning. */
  overlay?: "none" | "dietary";
  /** Overall bounding-box size in pixels (SVG viewBox + element size). Default 120. */
  sizePx?: number;
}

// ---------------------------------------------------------------------------
// Seat geometry helpers
// ---------------------------------------------------------------------------

interface SeatPoint {
  cx: number;
  cy: number;
  guestIndex: number | null; // index into seatedGuests (null = empty)
}

function seatsForRound(
  cx: number,
  cy: number,
  tableR: number,
  seatR: number,
  gap: number,
  capacity: number
): SeatPoint[] {
  const orbitR = tableR + gap + seatR;
  return Array.from({ length: capacity }, (_, i) => {
    const angle = (2 * Math.PI * i) / capacity - Math.PI / 2;
    return {
      cx: cx + orbitR * Math.cos(angle),
      cy: cy + orbitR * Math.sin(angle),
      guestIndex: i < capacity ? i : null,
    };
  });
}

function seatsForBanquet(
  cx: number,
  cy: number,
  tableW: number,
  tableH: number,
  seatR: number,
  gap: number,
  capacity: number
): SeatPoint[] {
  // Distribute evenly: half on top, half on bottom. Odd capacity → extra on bottom.
  const topCount = Math.floor(capacity / 2);
  const bottomCount = capacity - topCount;
  const seats: SeatPoint[] = [];

  const makeRow = (count: number, rowY: number, startIndex: number) => {
    const slotW = tableW / count;
    for (let i = 0; i < count; i++) {
      seats.push({
        cx: cx - tableW / 2 + slotW * (i + 0.5),
        cy: rowY,
        guestIndex: startIndex + i,
      });
    }
  };

  makeRow(topCount, cy - tableH / 2 - gap - seatR, 0);
  makeRow(bottomCount, cy + tableH / 2 + gap + seatR, topCount);

  return seats;
}

function seatsForSquare(
  cx: number,
  cy: number,
  halfSide: number,
  seatR: number,
  gap: number,
  capacity: number
): SeatPoint[] {
  // Distribute across 4 sides: top, right, bottom, left.
  // Base = floor(capacity/4); leftovers go to top then bottom then right then left.
  const base = Math.floor(capacity / 4);
  const rem = capacity % 4;
  const counts = [
    base + (rem >= 1 ? 1 : 0), // top
    base + (rem >= 3 ? 1 : 0), // right
    base + (rem >= 2 ? 1 : 0), // bottom
    base + (rem >= 4 ? 1 : 0), // left
  ];

  const seats: SeatPoint[] = [];
  let idx = 0;

  const makeEdge = (
    count: number,
    edgeCx: number,
    edgeCy: number,
    axis: "h" | "v",
    edgeLen: number
  ) => {
    const slotSize = edgeLen / count;
    for (let i = 0; i < count; i++) {
      const offset = -edgeLen / 2 + slotSize * (i + 0.5);
      seats.push({
        cx: axis === "h" ? edgeCx + offset : edgeCx,
        cy: axis === "v" ? edgeCy + offset : edgeCy,
        guestIndex: idx++,
      });
    }
  };

  const edgeLen = halfSide * 2 * 0.85; // slightly inset from corners
  const orbit = halfSide + gap + seatR;

  makeEdge(counts[0], cx, cy - orbit, "h", edgeLen); // top
  makeEdge(counts[1], cx + orbit, cy, "v", edgeLen); // right
  makeEdge(counts[2], cx, cy + orbit, "h", edgeLen); // bottom
  makeEdge(counts[3], cx - orbit, cy, "v", edgeLen); // left

  return seats;
}

// ---------------------------------------------------------------------------
// Color resolution
// ---------------------------------------------------------------------------

function seatFill(
  guestIndex: number,
  seatedGuests: Guest[],
  overlay: "none" | "dietary"
): { fill: string; stroke: string } {
  if (guestIndex >= seatedGuests.length) {
    // Empty seat
    return { fill: "var(--muted)", stroke: "var(--border)" };
  }

  const guest = seatedGuests[guestIndex];
  const hasDietary =
    overlay === "dietary" && guest.dietary && guest.dietary.length > 0;

  if (hasDietary) {
    return {
      fill: "var(--warning)",
      stroke: "var(--warning-foreground)",
    };
  }

  return { fill: "var(--fun-blue)", stroke: "var(--fun-blue-strong)" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShapedTable({
  table,
  seatedGuests,
  selected = false,
  onSelect,
  overlay = "none",
  sizePx = 120,
}: ShapedTableProps) {
  const { shape, capacity, tableNumber, label } = table;
  const seated = seatedGuests.length;

  const vb = sizePx;
  const cx = vb / 2;
  const cy = vb / 2;

  // Seat radius scales with sizePx
  const seatR = Math.max(3.5, sizePx * 0.038);
  const gap = Math.max(2, sizePx * 0.022);

  // ---------------------------------------------------------------------------
  // Compute table body geometry + seats
  // ---------------------------------------------------------------------------

  let tableBody: React.ReactNode;
  let seats: SeatPoint[] = [];

  if (shape === "round") {
    const tableR = sizePx * 0.24;
    tableBody = (
      <circle
        cx={cx}
        cy={cy}
        r={tableR}
        fill="var(--card)"
        stroke={selected ? "var(--primary)" : "var(--border)"}
        strokeWidth={selected ? 2.5 : 1.5}
      />
    );
    seats = seatsForRound(cx, cy, tableR, seatR, gap, capacity);
  } else if (shape === "square") {
    const halfSide = sizePx * 0.22;
    tableBody = (
      <rect
        x={cx - halfSide}
        y={cy - halfSide}
        width={halfSide * 2}
        height={halfSide * 2}
        rx={sizePx * 0.04}
        fill="var(--card)"
        stroke={selected ? "var(--primary)" : "var(--border)"}
        strokeWidth={selected ? 2.5 : 1.5}
      />
    );
    seats = seatsForSquare(cx, cy, halfSide, seatR, gap, capacity);
  } else if (shape === "banquet") {
    // Long rectangle (landscape): wider than tall
    const tableW = sizePx * 0.58;
    const tableH = sizePx * 0.22;
    tableBody = (
      <rect
        x={cx - tableW / 2}
        y={cy - tableH / 2}
        width={tableW}
        height={tableH}
        rx={tableH * 0.35}
        fill="var(--card)"
        stroke={selected ? "var(--primary)" : "var(--border)"}
        strokeWidth={selected ? 2.5 : 1.5}
      />
    );
    seats = seatsForBanquet(cx, cy, tableW, tableH, seatR, gap, capacity);
  } else {
    // "top" — head table: very wide, shallow
    const tableW = sizePx * 0.72;
    const tableH = sizePx * 0.16;
    tableBody = (
      <rect
        x={cx - tableW / 2}
        y={cy - tableH / 2}
        width={tableW}
        height={tableH}
        rx={tableH * 0.4}
        fill="var(--card)"
        stroke={selected ? "var(--primary)" : "var(--border)"}
        strokeWidth={selected ? 2.5 : 1.5}
      />
    );
    seats = seatsForBanquet(cx, cy, tableW, tableH, seatR, gap, capacity);
  }

  // ---------------------------------------------------------------------------
  // Label sizing
  // ---------------------------------------------------------------------------
  const labelFontSize = Math.max(7, sizePx * 0.09);
  const numberFontSize = Math.max(9, sizePx * 0.115);
  const countFontSize = Math.max(6.5, sizePx * 0.075);

  // For banquet/top the center y is shared for both lines; offset them
  const numberY = cy - labelFontSize * 0.4;
  const countY = cy + countFontSize + labelFontSize * 0.1;

  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Table ${tableNumber}${label ? ` — ${label}` : ""}, ${seated} of ${capacity} seated`}
      className={cn(
        "group relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-full",
        "transition-transform duration-150",
        selected && "-translate-y-0.5",
        onSelect ? "cursor-pointer" : "cursor-default pointer-events-none"
      )}
      style={{ width: sizePx, height: sizePx }}
      tabIndex={onSelect ? 0 : -1}
    >
      {/* Selection ring — rendered as an SVG drop-shadow/glow effect */}
      {selected && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full ring-2 ring-primary ring-offset-1 pointer-events-none"
        />
      )}

      <svg
        viewBox={`0 0 ${vb} ${vb}`}
        width={sizePx}
        height={sizePx}
        aria-hidden
        overflow="visible"
        style={{ display: "block" }}
      >
        {/* ---- Seat markers (drawn first = behind table body) ---- */}
        {seats.map((seat, i) => {
          const isFilled = seat.guestIndex !== null && i < capacity;
          const colors =
            isFilled && seat.guestIndex !== null
              ? seatFill(seat.guestIndex, seatedGuests, overlay)
              : { fill: "var(--muted)", stroke: "var(--border)" };

          return (
            <circle
              key={i}
              cx={seat.cx}
              cy={seat.cy}
              r={seatR}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={1}
              opacity={isFilled ? 1 : 0.65}
            />
          );
        })}

        {/* ---- Table body ---- */}
        {tableBody}

        {/* ---- Table number ---- */}
        <text
          x={cx}
          y={numberY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={numberFontSize}
          fontWeight={700}
          fill="var(--foreground)"
          fontFamily="inherit"
          letterSpacing="-0.02em"
        >
          {tableNumber}
        </text>

        {/* ---- Seated / capacity count ---- */}
        <text
          x={cx}
          y={countY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={countFontSize}
          fontWeight={500}
          fill="var(--muted-foreground)"
          fontFamily="inherit"
        >
          {seated}/{capacity}
        </text>
      </svg>

      {/* ---- Tooltip label on hover (only when label exists) ---- */}
      {label && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2",
            "whitespace-nowrap rounded-full bg-foreground px-2 py-0.5",
            "text-[10px] font-medium text-primary-foreground",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
            "z-10"
          )}
        >
          {label}
        </span>
      )}
    </button>
  );
}
