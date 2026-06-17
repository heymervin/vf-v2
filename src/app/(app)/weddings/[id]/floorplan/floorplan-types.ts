/**
 * Real-data types for the per-wedding floor plan tool.
 *
 * The DB stores layout as a jsonb blob in floor_plans.layout.
 * This module defines the shape of that jsonb and adapters to convert
 * DB rows into the FloorplanTable/RoomElement shapes expected by the
 * existing canvas components (FloorCanvas, ShapedTable).
 *
 * Adapters from DB guest rows to the Guest shape expected by ShapedTable
 * are also here so the client component stays import-free from @/lib/mock.
 */

import type { FloorplanTable, RoomElement } from "@/lib/mock/planning";
import type { Guest } from "@/lib/mock";

// ---------------------------------------------------------------------------
// Layout jsonb shape stored in floor_plans.layout
// ---------------------------------------------------------------------------

export interface LayoutTable {
  id: string;
  tableNumber: number;
  shape: "round" | "banquet" | "square" | "top";
  capacity: number;
  x: number;
  y: number;
  label: string | null;
}

export interface LayoutRoomElement {
  id: string;
  kind: "stage" | "dancefloor" | "bar" | "entrance" | "wall";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface FloorPlanLayout {
  tables: LayoutTable[];
  roomElements: LayoutRoomElement[];
}

// ---------------------------------------------------------------------------
// DB wedding_guests row shape (subset we need)
// ---------------------------------------------------------------------------

export interface DbGuest {
  id: string;
  name: string;
  rsvp: string;
  dietary: string[];
  table_number: number | null;
  seat_index: number | null;
  tags: string[];
  session_type: string | null;
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/** Convert a LayoutTable to the FloorplanTable shape used by ShapedTable. */
export function toFloorplanTable(t: LayoutTable): FloorplanTable {
  return {
    id: t.id,
    tableNumber: t.tableNumber,
    shape: t.shape,
    capacity: t.capacity,
    x: t.x,
    y: t.y,
    label: t.label,
  };
}

/** Convert a LayoutRoomElement to the RoomElement shape used by FloorCanvas. */
export function toRoomElement(el: LayoutRoomElement): RoomElement {
  return {
    id: el.id,
    kind: el.kind,
    x: el.x,
    y: el.y,
    w: el.w,
    h: el.h,
    label: el.label,
  };
}

/** Convert a DB wedding_guests row to the Guest shape used by ShapedTable. */
export function toGuest(g: DbGuest): Guest {
  const rsvp = g.rsvp === "yes" || g.rsvp === "no" ? g.rsvp : "pending";
  return {
    id: g.id,
    name: g.name,
    side: "both",
    table: g.table_number,
    rsvp,
    dietary: g.dietary ?? [],
    plusOne: false,
    tags: g.tags ?? [],
    seatIndex: g.seat_index,
    sessionType:
      g.session_type === "evening" || g.session_type === "ceremony_only"
        ? g.session_type
        : "day",
  };
}

/**
 * Parse the layout jsonb safely.
 * Returns null when the value is missing or not the expected shape.
 */
export function parseLayout(raw: unknown): FloorPlanLayout | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.tables) || !Array.isArray(obj.roomElements)) return null;
  return obj as unknown as FloorPlanLayout;
}

/**
 * Build a default empty layout when no template layout exists.
 * Returns an empty canvas so the tool still renders.
 */
export function emptyLayout(): FloorPlanLayout {
  return { tables: [], roomElements: [] };
}
