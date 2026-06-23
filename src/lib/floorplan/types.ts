/**
 * Neutral type definitions for the VenueFlow floorplan module.
 *
 * These types describe the canvas coordinate system (0–100 percentage-based)
 * shared between the floor-plan editor, the wedding floorplan tool, and their
 * canvas/table components. They are intentionally free of any mock-data
 * dependency.
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

// ---------------------------------------------------------------------------
// Fixed room elements
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
