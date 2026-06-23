/**
 * Guest / RSVP types used by the seating + floor-plan rendering layer.
 * (Extracted from the old prototype mock so real code carries its own shape.)
 */

export type Rsvp = "yes" | "no" | "pending";

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
