/**
 * Neutral type definitions for the VenueFlow guest module.
 *
 * Rsvp and Guest describe the guest-list shape shared between the wedding
 * workspace, the floorplan seating tool, and the portal. They are
 * intentionally free of any mock-data dependency.
 */

// ---------------------------------------------------------------------------
// RSVP status
// ---------------------------------------------------------------------------

export type Rsvp = "yes" | "no" | "pending";

// ---------------------------------------------------------------------------
// Guest
// ---------------------------------------------------------------------------

export interface Guest {
  id: string;
  name: string;
  side: "partner1" | "partner2" | "both";
  table: number | null;
  rsvp: Rsvp;
  dietary: string[]; // e.g. ["Vegetarian"], ["Nut allergy"]
  plusOne: boolean;
  // --- v2 additive (optional) ---
  /** vocab: 'VIP' | 'Family' | 'Wedding party' | 'Kids' | 'Supplier' | 'Evening' */
  tags?: string[];
  householdId?: string | null;
  householdName?: string | null;
  plusOneName?: string | null;
  sessionType?: "day" | "evening" | "ceremony_only";
  rsvpChasedAt?: string | null;
  seatIndex?: number | null;
  mealChoice?: { starter?: string; main?: string; dessert?: string };
}
