/**
 * VenueFlow — PROTOTYPE mock data: Floor plan / planning layer.
 *
 * Tables and fixed room elements for the primary wedding (w1) in The Long
 * Barn. Coordinates are 0–100 percentages of the room canvas so the floor
 * plan can render at any size. Additive to `./index`.
 */

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export interface FloorplanTable {
  id: string;
  tableNumber: number;
  shape: "round" | "banquet" | "square" | "top";
  capacity: number;
  /** Position as a percentage of the room canvas (0–100). */
  x: number;
  y: number;
  label: string | null;
}

export const FLOORPLAN_TABLES: FloorplanTable[] = [
  { id: "ft1", tableNumber: 1, shape: "top", capacity: 10, x: 50, y: 11, label: "Head table" },
  { id: "ft2", tableNumber: 2, shape: "round", capacity: 10, x: 25, y: 31, label: "Family — Henderson" },
  { id: "ft3", tableNumber: 3, shape: "round", capacity: 10, x: 50, y: 31, label: "Family — Carter" },
  { id: "ft4", tableNumber: 4, shape: "round", capacity: 10, x: 75, y: 31, label: "Wedding party" },
  { id: "ft5", tableNumber: 5, shape: "round", capacity: 10, x: 18, y: 51, label: null },
  { id: "ft6", tableNumber: 6, shape: "round", capacity: 10, x: 40, y: 51, label: null },
  { id: "ft7", tableNumber: 7, shape: "round", capacity: 10, x: 62, y: 51, label: null },
  { id: "ft8", tableNumber: 8, shape: "round", capacity: 10, x: 84, y: 51, label: null },
  { id: "ft9", tableNumber: 9, shape: "banquet", capacity: 12, x: 28, y: 71, label: "Uni friends" },
  { id: "ft10", tableNumber: 10, shape: "banquet", capacity: 12, x: 72, y: 71, label: "Work friends" },
  { id: "ft11", tableNumber: 11, shape: "square", capacity: 8, x: 20, y: 90, label: "Kids' table" },
  { id: "ft12", tableNumber: 12, shape: "round", capacity: 10, x: 80, y: 90, label: null },
];

// ---------------------------------------------------------------------------
// Fixed room elements (The Long Barn)
// ---------------------------------------------------------------------------

export interface RoomElement {
  id: string;
  kind: "stage" | "dancefloor" | "bar" | "entrance" | "wall";
  /** Position + size as percentages of the room canvas (0–100). */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export const ROOM_ELEMENTS: RoomElement[] = [
  { id: "re1", kind: "stage", x: 42, y: 1, w: 16, h: 6, label: "Stage" },
  { id: "re2", kind: "dancefloor", x: 40, y: 88, w: 20, h: 10, label: "Dance floor" },
  { id: "re3", kind: "bar", x: 2, y: 60, w: 8, h: 16, label: "Bar" },
  { id: "re4", kind: "entrance", x: 88, y: 92, w: 10, h: 6, label: "Entrance" },
];
