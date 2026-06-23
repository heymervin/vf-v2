/**
 * Floor-plan geometry types — the real shape of `floor_plans.layout` (jsonb):
 *   { tables: FloorplanTable[], roomElements: RoomElement[] }   (see migration m11).
 *
 * Coordinates are percentages of the room canvas (0–100) so the plan renders at any size.
 */

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
