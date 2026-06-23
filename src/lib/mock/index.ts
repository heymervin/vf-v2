/**
 * VenueFlow — PROTOTYPE mock data layer.
 *
 * Backs the no-login `/preview` showcase of the v2 combined platform
 * (PRODUCT.md › The Combined Platform). NOT used by the real app (M0–M7),
 * which reads Supabase. This is pure in-memory seed data so the vision is
 * navigable without a database.
 *
 * One coherent cast: the same couples appear across Inbox, Pipeline, Contacts
 * and Wedding Workspaces. The primary fully-fleshed wedding is "Henderson–
 * Carter" (WED_PRIMARY_ID); the planning tools default to it.
 *
 * Dates are ISO strings relative to a fixed "today" so the prototype is stable.
 */

import type { PipelineStage } from "@/lib/pipeline";
import type { Guest, Rsvp } from "@/lib/guests/types";
export type { Guest, Rsvp } from "@/lib/guests/types";

// Fixed reference point for the prototype (keeps "days until" stable-ish).
export const TODAY = "2026-06-14";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Channel = "email" | "sms" | "whatsapp";
export type LeadScore = "hot" | "warm" | "cold";

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  // --- v2 additive (optional) ---
  email?: string;
  status?: "active" | "invited" | "disabled";
  roleKey?: string;
}

/** A single editable custom field value on a contact (the bounded jsonb escape-hatch). */
export interface ContactCustomField {
  key: string;
  label: string;
  value: string | number | null;
  type: "text" | "number" | "select" | "date";
}

export interface Contact {
  id: string;
  partner1: string;
  partner2: string;
  /** "Henderson–Carter" style short label used as the couple name. */
  coupleName: string;
  initials: string;
  email: string;
  phone: string;
  weddingDate: string | null; // ISO
  guestCount: number | null;
  budget: number | null; // GBP
  source: string;
  stage: PipelineStage;
  score: LeadScore;
  createdAt: string; // ISO
  lastChannel: Channel;
  lastMessageAt: string; // ISO
  lastMessagePreview: string;
  unread: number;
  ownerId: string;
  // --- v2 additive (optional) ---
  tags?: string[];
  customFields?: ContactCustomField[];
  snoozedUntil?: string | null;
  isArchived?: boolean;
  assignedAt?: string | null;
  dateHoldExpiresAt?: string | null;
  nextAction?: { label: string; due?: string };
}

export interface Message {
  id: string;
  contactId: string;
  channel: Channel;
  direction: "in" | "out";
  body: string;
  at: string; // ISO
  author: string; // couple name or staff name
}

export interface Conversation {
  contactId: string;
  messages: Message[];
}

export type MilestoneStatus = "paid" | "due" | "upcoming" | "overdue";

export interface PaymentMilestone {
  id: string;
  label: string;
  amount: number; // GBP
  dueDate: string; // ISO
  status: MilestoneStatus;
  // --- v2 additive (optional) ---
  reminderSent?: boolean;
  paidOn?: string | null;
  receiptUrl?: string | null;
}

export interface ProposalLine {
  id: string;
  label: string;
  qty: number;
  unit: number; // GBP
  // --- v2 additive (optional) — used by the Proposal Builder ---
  category?: "package" | "addon";
  libraryItemId?: string;
  unitType?: string;
  qtyTiedToGuests?: boolean;
  discountPct?: number;
}

export type DocStatus = "signed" | "sent" | "draft" | "received" | "missing";

export interface WeddingDoc {
  id: string;
  name: string;
  kind: "contract" | "insurance" | "invoice" | "supplier" | "other";
  status: DocStatus;
  updatedAt: string;
  // --- v2 additive (optional) ---
  supplierId?: string | null;
  expiryDate?: string | null;
  lastChasedAt?: string | null;
}

export interface RunsheetItem {
  id: string;
  time: string; // "14:00"
  title: string;
  owner: string;
  durationMin: number;
  category: "ceremony" | "reception" | "catering" | "supplier" | "logistics";
  // --- v2 additive (optional) ---
  done?: boolean;
  supplierId?: string | null;
  notes?: string | null;
}

export interface MenuOption {
  id: string;
  name: string;
  allergens: string[];
  chosenBy: number; // guest count who chose it
  // --- v2 additive (optional) ---
  description?: string | null;
  pricePerHead?: number | null;
  dietaryTags?: string[];
  photoUrl?: string | null;
  sortOrder?: number;
  /** Guest ids who chose this option (length ≈ chosenBy). */
  guestIds?: string[];
}

export interface MenuCourse {
  id: string;
  course: string; // "Starter", "Main", "Dessert", "Children", "Evening"
  options: MenuOption[];
  // --- v2 additive (optional) ---
  sortOrder?: number;
  isActive?: boolean;
  mealPeriod?: "wedding_breakfast" | "evening" | "canapés";
}

export type SupplierStatus = "confirmed" | "pending" | "enquired" | "declined";

export interface Supplier {
  id: string;
  name: string;
  category: string; // Photographer, Florist, Band, Caterer...
  contactName: string;
  phone: string;
  status: SupplierStatus;
  arrivalTime: string | null;
  docs: number;
  // --- v2 additive (optional) ---
  checkedInAt?: string | null;
  email?: string;
  website?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface WeddingTask {
  id: string;
  label: string;
  done: boolean;
  dueDate: string | null;
  category: "money" | "planning" | "suppliers" | "admin";
}

export interface Wedding {
  id: string;
  contactId: string;
  coupleName: string;
  date: string; // ISO
  space: string;
  guestCount: number;
  status: "planning" | "final_details" | "this_week" | "completed";
  packageName: string;
  totalValue: number; // GBP
  paid: number; // GBP
  keyFacts: { label: string; value: string }[];
  tasks: WeddingTask[];
  proposal: ProposalLine[];
  payments: PaymentMilestone[];
  contractStatus: DocStatus;
  docs: WeddingDoc[];
  runsheet: RunsheetItem[];
  guests: Guest[];
  menu: MenuCourse[];
  suppliers: Supplier[];
  // --- v2 additive (optional) ---
  portalActive?: boolean;
  portalLastSeen?: string | null;
  coordinatorId?: string; // TEAM id
  portalTheme?: { accent: string; logoText: string; welcomeNote?: string };
  contractTerms?: string[];
}

export interface CopilotInsight {
  id: string;
  kind: "at_risk" | "action" | "win" | "nudge";
  title: string;
  detail: string;
  contactId?: string;
  // --- v2 additive (optional) ---
  priority?: number;
  signal?: string;
  dueAt?: string;
  weddingId?: string;
  actionHref?: string;
  status?: "open" | "snoozed" | "dismissed";
  scheduledFor?: string;
}

// ---------------------------------------------------------------------------
// Venue + team
// ---------------------------------------------------------------------------

export const VENUE = {
  name: "The Old Barn",
  slug: "the-old-barn",
  tagline: "A restored 17th-century barn in the Cotswolds",
  spaces: ["The Long Barn", "The Orangery", "The Courtyard"],
  email: "weddings@theoldbarn.co.uk",
} as const;

export const TEAM: TeamMember[] = [
  { id: "u1", name: "Hannah Wells", initials: "HW", role: "Sales Manager", email: "hannah@theoldbarn.co.uk", status: "active", roleKey: "owner" },
  { id: "u2", name: "Marcus Bell", initials: "MB", role: "Coordinator", email: "marcus@theoldbarn.co.uk", status: "active", roleKey: "coordinator" },
  { id: "u3", name: "Priya Shah", initials: "PS", role: "Events Lead", email: "priya@theoldbarn.co.uk", status: "active", roleKey: "admin" },
];

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

// ---------------------------------------------------------------------------
// Contacts (one cast, all 8 stages)
// ---------------------------------------------------------------------------

export const CONTACTS: Contact[] = [
  {
    id: "c1", partner1: "Emma Henderson", partner2: "James Carter",
    coupleName: "Henderson & Carter", initials: "EH",
    email: "emma.henderson@gmail.com", phone: "+44 7700 900123",
    weddingDate: "2027-05-22", guestCount: 120, budget: 18500,
    source: "Instagram", stage: "wedding_booked", score: "hot",
    createdAt: "2026-01-12", lastChannel: "whatsapp", lastMessageAt: "2026-06-13T15:20:00Z",
    lastMessagePreview: "Perfect, we'll get the deposit across today! 🎉", unread: 0, ownerId: "u1",
    tags: ["Booked", "Summer 2027", "VIP"], assignedAt: "2026-01-12",
    customFields: [
      { key: "how_heard", label: "How did you hear about us?", value: "Instagram", type: "select" },
      { key: "dietary_notes", label: "Dietary notes", value: "2 vegan, 1 nut allergy", type: "text" },
      { key: "engagement_date", label: "Engagement date", value: "2025-12-25", type: "date" },
    ],
    nextAction: { label: "Send welcome pack & schedule first planning call", due: "2026-06-20" },
  },
  {
    id: "c2", partner1: "Aisha Khan", partner2: "Daniel Reid",
    coupleName: "Khan & Reid", initials: "AK",
    email: "aisha.k@outlook.com", phone: "+44 7700 900234",
    weddingDate: "2027-07-10", guestCount: 90, budget: 14000,
    source: "Google", stage: "date_on_hold", score: "hot",
    createdAt: "2026-03-02", lastChannel: "email", lastMessageAt: "2026-06-13T09:05:00Z",
    lastMessagePreview: "Thanks for the proposal — reviewing with family this weekend.", unread: 2, ownerId: "u1",
    tags: ["Proposal sent", "Hold expiring", "Summer 2027"], assignedAt: "2026-03-02",
    dateHoldExpiresAt: "2026-06-16",
    customFields: [
      { key: "how_heard", label: "How did you hear about us?", value: "Google", type: "select" },
      { key: "decision_makers", label: "Decision makers", value: "Couple + both sets of parents", type: "text" },
      { key: "preferred_space", label: "Preferred space", value: "The Orangery", type: "select" },
    ],
    nextAction: { label: "Nudge before date hold lapses", due: "2026-06-15" },
  },
  {
    id: "c3", partner1: "Olivia Bennett", partner2: "Tom Walsh",
    coupleName: "Bennett & Walsh", initials: "OB",
    email: "olivia.bennett@gmail.com", phone: "+44 7700 900345",
    weddingDate: "2027-09-04", guestCount: 140, budget: 21000,
    source: "Hitched", stage: "appointment_booked", score: "warm",
    createdAt: "2026-04-18", lastChannel: "sms", lastMessageAt: "2026-06-12T17:40:00Z",
    lastMessagePreview: "Looking forward to the viewing on Saturday!", unread: 0, ownerId: "u2",
  },
  {
    id: "c4", partner1: "Grace Adeyemi", partner2: "Mohammed Al-Rashid",
    coupleName: "Adeyemi & Al-Rashid", initials: "GA",
    email: "grace.ade@gmail.com", phone: "+44 7700 900456",
    weddingDate: "2026-09-19", guestCount: 80, budget: 16000,
    source: "Referral", stage: "wedding_booked", score: "hot",
    createdAt: "2025-11-20", lastChannel: "whatsapp", lastMessageAt: "2026-06-11T11:15:00Z",
    lastMessagePreview: "Can we add 6 more evening guests?", unread: 1, ownerId: "u3",
  },
  {
    id: "c5", partner1: "Charlotte Price", partner2: "Ben Foster",
    coupleName: "Price & Foster", initials: "CP",
    email: "charlotte.price@gmail.com", phone: "+44 7700 900567",
    weddingDate: "2027-06-12", guestCount: 110, budget: 17000,
    source: "Website form", stage: "inbound_enquiry", score: "warm",
    createdAt: "2026-06-13", lastChannel: "email", lastMessageAt: "2026-06-13T08:30:00Z",
    lastMessagePreview: "Hi! We'd love your brochure and 2027 availability.", unread: 1, ownerId: "u1",
  },
  {
    id: "c6", partner1: "Sophie Turner", partner2: "Liam O'Connor",
    coupleName: "Turner & O'Connor", initials: "ST",
    email: "sophie.t@gmail.com", phone: "+44 7700 900678",
    weddingDate: "2027-08-21", guestCount: 100, budget: 15500,
    source: "Facebook", stage: "responded", score: "warm",
    createdAt: "2026-06-09", lastChannel: "sms", lastMessageAt: "2026-06-12T14:10:00Z",
    lastMessagePreview: "That sounds great, what dates are free in August?", unread: 0, ownerId: "u2",
  },
  {
    id: "c7", partner1: "Mia Robinson", partner2: "Noah Clarke",
    coupleName: "Robinson & Clarke", initials: "MR",
    email: "mia.robinson@gmail.com", phone: "+44 7700 900789",
    weddingDate: "2028-05-13", guestCount: 130, budget: 20000,
    source: "Instagram", stage: "viewing_interest", score: "warm",
    createdAt: "2026-05-28", lastChannel: "whatsapp", lastMessageAt: "2026-06-10T19:25:00Z",
    lastMessagePreview: "We loved the photos — can we come see it?", unread: 0, ownerId: "u1",
  },
  {
    id: "c8", partner1: "Freya Mitchell", partner2: "Oscar Hughes",
    coupleName: "Mitchell & Hughes", initials: "FM",
    email: "freya.m@gmail.com", phone: "+44 7700 900890",
    weddingDate: "2027-10-02", guestCount: 95, budget: 14500,
    source: "Hitched", stage: "appointment_attended", score: "hot",
    createdAt: "2026-04-30", lastChannel: "email", lastMessageAt: "2026-06-11T16:00:00Z",
    lastMessagePreview: "We adored the venue. What are the next steps?", unread: 1, ownerId: "u3",
    tags: ["Hot lead", "Viewing done", "Autumn 2027"], assignedAt: "2026-04-30",
    customFields: [
      { key: "how_heard", label: "How did you hear about us?", value: "Hitched", type: "select" },
      { key: "budget_band", label: "Budget band", value: "£14k–£16k", type: "select" },
      { key: "guest_estimate", label: "Guest estimate", value: 95, type: "number" },
    ],
    nextAction: { label: "Send proposal — highest-converting moment", due: "2026-06-16" },
  },
  {
    id: "c9", partner1: "Isla Campbell", partner2: "Harry Evans",
    coupleName: "Campbell & Evans", initials: "IC",
    email: "isla.c@gmail.com", phone: "+44 7700 900901",
    weddingDate: "2027-04-17", guestCount: 105, budget: 16500,
    source: "Referral", stage: "wedding_booked", score: "hot",
    createdAt: "2025-12-08", lastChannel: "email", lastMessageAt: "2026-06-08T10:45:00Z",
    lastMessagePreview: "Menu tasting booked — thank you!", unread: 0, ownerId: "u3",
  },
  {
    id: "c10", partner1: "Ruby Ward", partner2: "Jack Murphy",
    coupleName: "Ward & Murphy", initials: "RW",
    email: "ruby.ward@gmail.com", phone: "+44 7700 901012",
    weddingDate: "2027-09-25", guestCount: 85, budget: 13000,
    source: "Google", stage: "responded", score: "cold",
    createdAt: "2026-06-05", lastChannel: "sms", lastMessageAt: "2026-06-09T12:30:00Z",
    lastMessagePreview: "Thanks, will discuss and come back to you.", unread: 0, ownerId: "u2",
  },
  {
    id: "c11", partner1: "Chloe Davies", partner2: "Ethan Bell",
    coupleName: "Davies & Bell", initials: "CD",
    email: "chloe.davies@gmail.com", phone: "+44 7700 901123",
    weddingDate: "2028-06-30", guestCount: 150, budget: 23000,
    source: "Website form", stage: "inbound_enquiry", score: "warm",
    createdAt: "2026-06-14", lastChannel: "email", lastMessageAt: "2026-06-14T07:50:00Z",
    lastMessagePreview: "Do you allow outside caterers? Big family wedding.", unread: 1, ownerId: "u1",
  },
  {
    id: "c12", partner1: "Ava Morgan", partner2: "Leo Hughes",
    coupleName: "Morgan & Hughes", initials: "AM",
    email: "ava.morgan@gmail.com", phone: "+44 7700 901234",
    weddingDate: "2027-11-13", guestCount: 120, budget: 18000,
    source: "Instagram", stage: "viewing_interest", score: "warm",
    createdAt: "2026-05-15", lastChannel: "whatsapp", lastMessageAt: "2026-06-07T20:10:00Z",
    lastMessagePreview: "Is the November date still open?", unread: 0, ownerId: "u2",
  },
  {
    id: "c13", partner1: "Poppy Hall", partner2: "Max Reid",
    coupleName: "Hall & Reid", initials: "PH",
    email: "poppy.hall@gmail.com", phone: "+44 7700 901345",
    weddingDate: "2027-08-07", guestCount: 100, budget: 15000,
    source: "Hitched", stage: "appointment_booked", score: "warm",
    createdAt: "2026-05-02", lastChannel: "sms", lastMessageAt: "2026-06-06T15:35:00Z",
    lastMessagePreview: "Viewing confirmed for the 21st, thank you!", unread: 0, ownerId: "u1",
  },
  {
    id: "c14", partner1: "Lily Cooper", partner2: "George Wright",
    coupleName: "Cooper & Wright", initials: "LC",
    email: "lily.cooper@gmail.com", phone: "+44 7700 901456",
    weddingDate: "2027-05-08", guestCount: 90, budget: 12000,
    source: "Facebook", stage: "archived", score: "cold",
    createdAt: "2026-02-19", lastChannel: "email", lastMessageAt: "2026-05-20T09:00:00Z",
    lastMessagePreview: "We've decided to go with another venue — thank you.", unread: 0, ownerId: "u2",
  },
];

// ---------------------------------------------------------------------------
// Conversations (multi-channel threads)
// ---------------------------------------------------------------------------

export const CONVERSATIONS: Conversation[] = [
  {
    contactId: "c1",
    messages: [
      { id: "m1", contactId: "c1", channel: "email", direction: "in", author: "Emma Henderson",
        at: "2026-01-12T10:00:00Z", body: "Hi! We found you on Instagram and fell in love with the Long Barn. Could we get your brochure and check 2027 dates?" },
      { id: "m2", contactId: "c1", channel: "email", direction: "out", author: "Hannah Wells",
        at: "2026-01-12T10:04:00Z", body: "Hi Emma — so lovely to hear from you! Brochure attached. May 2027 has good availability. Would you like to book a viewing?" },
      { id: "m3", contactId: "c1", channel: "whatsapp", direction: "in", author: "Emma Henderson",
        at: "2026-02-03T18:20:00Z", body: "We'd love to come see it! Is a Saturday possible?" },
      { id: "m4", contactId: "c1", channel: "whatsapp", direction: "out", author: "Hannah Wells",
        at: "2026-02-03T18:24:00Z", body: "Of course — I've got Sat 21st Feb at 11am free. Shall I pop you in?" },
      { id: "m5", contactId: "c1", channel: "whatsapp", direction: "in", author: "Emma Henderson",
        at: "2026-06-13T15:18:00Z", body: "We've made our decision — it's The Old Barn! 😍" },
      { id: "m6", contactId: "c1", channel: "whatsapp", direction: "out", author: "Hannah Wells",
        at: "2026-06-13T15:19:00Z", body: "Amazing!! I'll send the contract and deposit link now." },
      { id: "m7", contactId: "c1", channel: "whatsapp", direction: "in", author: "Emma Henderson",
        at: "2026-06-13T15:20:00Z", body: "Perfect, we'll get the deposit across today! 🎉" },
    ],
  },
  {
    contactId: "c2",
    messages: [
      { id: "m10", contactId: "c2", channel: "email", direction: "in", author: "Aisha Khan",
        at: "2026-03-02T14:00:00Z", body: "Hello, do you hold dates? We're looking at July 2027 for ~90 guests." },
      { id: "m11", contactId: "c2", channel: "email", direction: "out", author: "Hannah Wells",
        at: "2026-03-02T14:12:00Z", body: "Hi Aisha — yes, we can hold a date for 7 days. I'll send a tailored proposal." },
      { id: "m12", contactId: "c2", channel: "email", direction: "out", author: "Hannah Wells",
        at: "2026-06-11T10:00:00Z", body: "Proposal attached — the July package with the Orangery for your evening reception." },
      { id: "m13", contactId: "c2", channel: "email", direction: "in", author: "Aisha Khan",
        at: "2026-06-13T09:05:00Z", body: "Thanks for the proposal — reviewing with family this weekend." },
    ],
  },
  {
    contactId: "c5",
    messages: [
      { id: "m20", contactId: "c5", channel: "email", direction: "in", author: "Charlotte Price",
        at: "2026-06-13T08:30:00Z", body: "Hi! We'd love your brochure and 2027 availability. Saw you on a wedding blog." },
    ],
  },
  {
    contactId: "c4",
    messages: [
      { id: "m30", contactId: "c4", channel: "whatsapp", direction: "in", author: "Grace Adeyemi",
        at: "2026-06-11T11:15:00Z", body: "Can we add 6 more evening guests?" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Weddings (booked → Wedding Workspaces). c1 is fully fleshed (primary).
// ---------------------------------------------------------------------------

export const WED_PRIMARY_ID = "w1";

export const WEDDINGS: Wedding[] = [
  {
    id: "w1", contactId: "c1", coupleName: "Henderson & Carter",
    date: "2027-05-22", space: "The Long Barn", guestCount: 120,
    status: "planning", packageName: "The Full Day — Summer",
    totalValue: 18500, paid: 4625, contractStatus: "signed",
    keyFacts: [
      { label: "Ceremony", value: "On-site, 1:00pm" },
      { label: "Coordinator", value: "Marcus Bell" },
      { label: "Catering", value: "In-house, 3 courses" },
      { label: "Evening guests", value: "+60" },
    ],
    tasks: [
      { id: "t1", label: "Deposit received", done: true, dueDate: "2026-06-14", category: "money" },
      { id: "t2", label: "Contract signed", done: true, dueDate: "2026-06-14", category: "admin" },
      { id: "t3", label: "Menu tasting booked", done: false, dueDate: "2026-11-01", category: "planning" },
      { id: "t4", label: "Interim payment due", done: false, dueDate: "2026-11-22", category: "money" },
      { id: "t5", label: "Final guest numbers", done: false, dueDate: "2027-04-22", category: "planning" },
      { id: "t6", label: "Confirm florist", done: false, dueDate: "2026-09-01", category: "suppliers" },
    ],
    proposal: [
      { id: "p1", label: "Venue hire — Long Barn (full day)", qty: 1, unit: 6500 },
      { id: "p2", label: "Three-course wedding breakfast", qty: 120, unit: 75 },
      { id: "p3", label: "Evening buffet", qty: 60, unit: 18 },
      { id: "p4", label: "Drinks package — Classic", qty: 120, unit: 28 },
    ],
    payments: [
      { id: "pm1", label: "Booking deposit (25%)", amount: 4625, dueDate: "2026-06-14", status: "paid", reminderSent: true, paidOn: "2026-06-14", receiptUrl: "/receipts/w1-deposit.pdf" },
      { id: "pm2", label: "Interim payment (50%)", amount: 9250, dueDate: "2026-11-22", status: "upcoming", reminderSent: false, paidOn: null, receiptUrl: null },
      { id: "pm3", label: "Final balance (25%)", amount: 4625, dueDate: "2027-04-22", status: "upcoming", reminderSent: false, paidOn: null, receiptUrl: null },
    ],
    docs: [
      { id: "d1", name: "Booking contract", kind: "contract", status: "signed", updatedAt: "2026-06-14" },
      { id: "d2", name: "Deposit invoice", kind: "invoice", status: "received", updatedAt: "2026-06-14" },
      { id: "d3", name: "Public liability (florist)", kind: "insurance", status: "missing", updatedAt: "2026-06-13", supplierId: "s1", expiryDate: "2027-03-31", lastChasedAt: "2026-06-13" },
    ],
    runsheet: [
      { id: "r1", time: "08:00", title: "Supplier access — florist & stylist", owner: "Marcus Bell", durationMin: 120, category: "supplier", done: true, supplierId: "s1", notes: "Loading via Courtyard gate; trestle tables pre-set in the Long Barn." },
      { id: "r2", time: "11:00", title: "Registrar arrival & briefing", owner: "Priya Shah", durationMin: 30, category: "ceremony", done: true, notes: "Confirm pronunciation of both surnames; two readings (aunt + best man)." },
      { id: "r3", time: "12:30", title: "Guests arrive — Courtyard drinks", owner: "Front of house", durationMin: 30, category: "logistics" },
      { id: "r4", time: "13:00", title: "Ceremony — The Long Barn", owner: "Registrar", durationMin: 40, category: "ceremony" },
      { id: "r5", time: "13:45", title: "Drinks reception & canapés", owner: "Catering", durationMin: 75, category: "catering" },
      { id: "r6", time: "15:00", title: "Wedding breakfast", owner: "Catering", durationMin: 120, category: "catering" },
      { id: "r7", time: "17:00", title: "Speeches", owner: "Toastmaster", durationMin: 45, category: "reception" },
      { id: "r8", time: "19:00", title: "Evening guests arrive · first dance", owner: "Band", durationMin: 30, category: "reception", supplierId: "s3", notes: "First dance track shared with the band; mics tested before doors." },
      { id: "r9", time: "19:30", title: "Evening buffet", owner: "Catering", durationMin: 60, category: "catering" },
      { id: "r10", time: "23:30", title: "Last orders · carriages", owner: "Marcus Bell", durationMin: 30, category: "logistics" },
    ],
    guests: makeGuests(),
    menu: [
      { id: "mc1", course: "Starter", sortOrder: 1, isActive: true, mealPeriod: "wedding_breakfast", options: [
        { id: "o1", name: "Heritage tomato & burrata", allergens: ["Dairy"], chosenBy: 64, description: "Heritage tomatoes, Puglian burrata, basil oil & aged balsamic.", pricePerHead: 12, dietaryTags: ["Vegetarian"], photoUrl: "/dishes/heritage-tomato-burrata.jpg", sortOrder: 1, guestIds: pickGuestIds(64, 0) },
        { id: "o2", name: "Ham hock terrine", allergens: ["Mustard"], chosenBy: 41, description: "Pressed ham hock, piccalilli & toasted sourdough.", pricePerHead: 11, dietaryTags: [], photoUrl: null, sortOrder: 2, guestIds: pickGuestIds(41, 64) },
        { id: "o3", name: "Wild mushroom tart (v)", allergens: ["Gluten"], chosenBy: 15, description: "Wild mushroom & tarragon tart, truffled crème fraîche.", pricePerHead: 11, dietaryTags: ["Vegetarian"], photoUrl: null, sortOrder: 3, guestIds: pickGuestIds(15, 105) },
      ]},
      { id: "mc2", course: "Main", sortOrder: 2, isActive: true, mealPeriod: "wedding_breakfast", options: [
        { id: "o4", name: "Roast sirloin of beef", allergens: [], chosenBy: 70, description: "28-day aged sirloin, duck-fat potatoes, roasted roots & red wine jus.", pricePerHead: 28, dietaryTags: [], photoUrl: "/dishes/roast-sirloin-of-beef.jpg", sortOrder: 1, guestIds: pickGuestIds(70, 0) },
        { id: "o5", name: "Pan-roast chicken", allergens: ["Dairy"], chosenBy: 34, description: "Free-range chicken supreme, dauphinoise, tenderstem & tarragon cream.", pricePerHead: 25, dietaryTags: [], photoUrl: null, sortOrder: 2, guestIds: pickGuestIds(34, 70) },
        { id: "o6", name: "Squash & sage risotto (vg)", allergens: [], chosenBy: 16, description: "Roast squash & sage risotto, toasted pumpkin seeds, crispy kale.", pricePerHead: 22, dietaryTags: ["Vegan", "Gluten-free"], photoUrl: null, sortOrder: 3, guestIds: pickGuestIds(16, 104) },
      ]},
      { id: "mc3", course: "Dessert", sortOrder: 3, isActive: true, mealPeriod: "wedding_breakfast", options: [
        { id: "o7", name: "Sticky toffee pudding", allergens: ["Gluten", "Dairy", "Egg"], chosenBy: 88, description: "Sticky toffee pudding, salted caramel & clotted cream.", pricePerHead: 10, dietaryTags: ["Vegetarian"], photoUrl: "/dishes/sticky-toffee-pudding.jpg", sortOrder: 1, guestIds: pickGuestIds(88, 0) },
        { id: "o8", name: "Lemon posset (gf)", allergens: ["Dairy"], chosenBy: 32, description: "Sicilian lemon posset, shortbread crumb & summer berries.", pricePerHead: 9, dietaryTags: ["Vegetarian", "Gluten-free"], photoUrl: null, sortOrder: 2, guestIds: pickGuestIds(32, 88) },
      ]},
      { id: "mc4", course: "Children", sortOrder: 4, isActive: true, mealPeriod: "wedding_breakfast", options: [
        { id: "o9", name: "Mini fish & chips", allergens: ["Gluten", "Fish"], chosenBy: 6, description: "Battered fish goujons, chunky chips & garden peas.", pricePerHead: 14, dietaryTags: [], photoUrl: null, sortOrder: 1, guestIds: pickGuestIds(6, 0) },
      ]},
    ],
    suppliers: [
      { id: "s1", name: "Bloom & Wild Co.", category: "Florist", contactName: "Jess Allen", phone: "+44 7700 902001", status: "confirmed", arrivalTime: "08:00", docs: 1, checkedInAt: null, email: "jess@bloomandwild.co", website: "https://bloomandwild.co", notes: "Arch + 12 table runners; needs water access in the Long Barn.", tags: ["Preferred", "Florals"] },
      { id: "s2", name: "Aperture Studios", category: "Photographer", contactName: "Dan Pryce", phone: "+44 7700 902002", status: "confirmed", arrivalTime: "11:30", docs: 2, checkedInAt: null, email: "dan@aperturestudios.co.uk", website: "https://aperturestudios.co.uk", notes: "Two shooters; golden-hour portraits in the Courtyard ~20:15.", tags: ["Preferred", "Photo"] },
      { id: "s3", name: "The Vinyl Frontier", category: "Band / DJ", contactName: "Mike Roe", phone: "+44 7700 902003", status: "pending", arrivalTime: "17:30", docs: 0, checkedInAt: null, email: "bookings@vinylfrontier.band", website: null, notes: "Awaiting PLI + PAT certificates before sign-off.", tags: ["Music"] },
      { id: "s4", name: "Sweet Cheeks Cakes", category: "Cake", contactName: "Lara Fenn", phone: "+44 7700 902004", status: "confirmed", arrivalTime: "10:00", docs: 1, checkedInAt: null, email: "lara@sweetcheekscakes.co.uk", website: "https://sweetcheekscakes.co.uk", notes: "Three-tier; delivered & assembled on-site, nut-free kitchen.", tags: ["Cake"] },
      { id: "s5", name: "Lux Coaches", category: "Transport", contactName: "Office", phone: "+44 7700 902005", status: "enquired", arrivalTime: null, docs: 0, checkedInAt: null, email: "hire@luxcoaches.co.uk", website: "https://luxcoaches.co.uk", notes: "Two 49-seaters quoted for evening guest shuttle; awaiting confirmation.", tags: ["Transport"] },
    ],
    portalActive: true,
    portalLastSeen: "2026-06-13T20:42:00Z",
    coordinatorId: "u2",
    portalTheme: { accent: "#c8607a", logoText: "Emma & James", welcomeNote: "We can't wait to celebrate with you at The Old Barn." },
    contractTerms: [
      "A 25% non-refundable deposit secures your date.",
      "Final guest numbers and menu choices are due 28 days before the wedding.",
      "The interim payment of 50% is due six months before the event.",
      "The final balance is payable no later than 30 days before the wedding.",
      "Cancellation within 90 days forfeits all payments made to date.",
      "All external suppliers must provide valid public liability insurance.",
    ],
  },
  {
    id: "w2", contactId: "c4", coupleName: "Adeyemi & Al-Rashid",
    date: "2026-09-19", space: "The Orangery", guestCount: 80,
    status: "final_details", packageName: "The Full Day — Autumn",
    totalValue: 16000, paid: 12000, contractStatus: "signed",
    keyFacts: [
      { label: "Ceremony", value: "Off-site (mosque), reception only" },
      { label: "Coordinator", value: "Priya Shah" },
      { label: "Catering", value: "External (halal) — approved" },
      { label: "Evening guests", value: "+40" },
    ],
    tasks: [
      { id: "t20", label: "Deposit received", done: true, dueDate: "2025-12-01", category: "money" },
      { id: "t21", label: "Interim payment received", done: true, dueDate: "2026-03-19", category: "money" },
      { id: "t22", label: "Final balance due", done: false, dueDate: "2026-08-19", category: "money" },
      { id: "t23", label: "Final guest numbers", done: false, dueDate: "2026-08-22", category: "planning" },
      { id: "t24", label: "External caterer insurance", done: true, dueDate: "2026-06-01", category: "suppliers" },
    ],
    proposal: [
      { id: "p20", label: "Venue hire — Orangery (full day)", qty: 1, unit: 5500 },
      { id: "p21", label: "External catering corkage", qty: 80, unit: 35 },
      { id: "p22", label: "Soft drinks package", qty: 80, unit: 16 },
    ],
    payments: [
      { id: "pm20", label: "Booking deposit (25%)", amount: 4000, dueDate: "2025-12-01", status: "paid" },
      { id: "pm21", label: "Interim payment (50%)", amount: 8000, dueDate: "2026-03-19", status: "paid" },
      { id: "pm22", label: "Final balance (25%)", amount: 4000, dueDate: "2026-08-19", status: "due" },
    ],
    docs: [
      { id: "d20", name: "Booking contract", kind: "contract", status: "signed", updatedAt: "2025-12-01" },
      { id: "d21", name: "Caterer liability insurance", kind: "insurance", status: "received", updatedAt: "2026-06-01" },
    ],
    runsheet: [
      { id: "r20", time: "13:00", title: "Supplier access", owner: "Priya Shah", durationMin: 120, category: "supplier" },
      { id: "r21", time: "15:00", title: "Guests arrive — Orangery", owner: "Front of house", durationMin: 60, category: "logistics" },
      { id: "r22", time: "16:00", title: "Reception & meal", owner: "External caterer", durationMin: 150, category: "catering" },
      { id: "r23", time: "19:00", title: "Evening celebration", owner: "DJ", durationMin: 180, category: "reception" },
    ],
    guests: [],
    menu: [],
    suppliers: [
      { id: "s20", name: "Saffron Kitchen", category: "Caterer (halal)", contactName: "Yusuf Ali", phone: "+44 7700 902020", status: "confirmed", arrivalTime: "13:00", docs: 2 },
      { id: "s21", name: "Lens & Light", category: "Photographer", contactName: "Amara Obi", phone: "+44 7700 902021", status: "confirmed", arrivalTime: "14:30", docs: 1 },
    ],
    portalActive: true,
    portalLastSeen: "2026-06-10T18:05:00Z",
    coordinatorId: "u3",
  },
  {
    id: "w3", contactId: "c9", coupleName: "Campbell & Evans",
    date: "2027-04-17", space: "The Long Barn", guestCount: 105,
    status: "planning", packageName: "The Full Day — Spring",
    totalValue: 16500, paid: 4125, contractStatus: "signed",
    keyFacts: [
      { label: "Ceremony", value: "On-site, 2:00pm" },
      { label: "Coordinator", value: "Priya Shah" },
      { label: "Catering", value: "In-house, 3 courses" },
      { label: "Evening guests", value: "+45" },
    ],
    tasks: [
      { id: "t30", label: "Deposit received", done: true, dueDate: "2025-12-08", category: "money" },
      { id: "t31", label: "Menu tasting", done: true, dueDate: "2026-06-08", category: "planning" },
      { id: "t32", label: "Interim payment due", done: false, dueDate: "2026-10-17", category: "money" },
    ],
    proposal: [
      { id: "p30", label: "Venue hire — Long Barn (full day)", qty: 1, unit: 6500 },
      { id: "p31", label: "Three-course wedding breakfast", qty: 105, unit: 72 },
    ],
    payments: [
      { id: "pm30", label: "Booking deposit (25%)", amount: 4125, dueDate: "2025-12-08", status: "paid" },
      { id: "pm31", label: "Interim payment (50%)", amount: 8250, dueDate: "2026-10-17", status: "upcoming" },
      { id: "pm32", label: "Final balance (25%)", amount: 4125, dueDate: "2027-03-17", status: "upcoming" },
    ],
    docs: [
      { id: "d30", name: "Booking contract", kind: "contract", status: "signed", updatedAt: "2025-12-08" },
    ],
    runsheet: [],
    guests: [],
    menu: [],
    suppliers: [],
    portalActive: false,
    portalLastSeen: null,
    coordinatorId: "u3",
  },
];

/**
 * Pick a deterministic, contiguous slice of guest ids for a menu option.
 * Returns g{start+1}..g{start+count} clamped to the 96-guest roster — the
 * length matches `chosenBy` so menu drill-downs and guestIds stay coherent.
 */
function pickGuestIds(count: number, start: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(`g${((start + i) % 96) + 1}`);
  }
  return ids;
}

// Generate a realistic-ish guest list for the primary wedding.
function makeGuests(): Guest[] {
  const firsts = ["Oliver","Amelia","Jack","Isla","Harry","Ava","George","Mia","Noah","Grace","Leo","Ella","Arthur","Lily","Oscar","Sophie","Henry","Freya","Charlie","Ruby","Jacob","Evie","Thomas","Poppy","William","Florence","Joshua","Daisy","Alfie","Maya"];
  const lasts = ["Smith","Jones","Taylor","Brown","Wilson","Evans","Thomas","Roberts","Walker","Wright","Hughes","Green","Hall","Wood","Harris","Clarke","Patel","Baker","Cooper","Ward"];
  const dietaryPool: string[][] = [[], [], [], [], ["Vegetarian"], ["Vegan"], ["Gluten-free"], ["Nut allergy"], ["Dairy-free"], ["Pescatarian"]];
  const starters = ["o1", "o2", "o3"];
  const mains = ["o4", "o5", "o6"];
  const desserts = ["o7", "o8"];
  // Roster index ranges (deterministic so counts are exact):
  //   0–2   VIP (3)        · 3–8   Wedding party (6)
  //   9–20  Family (12)    · 21–26 Kids (6)
  //   66–95 Evening (30)   · the rest are untagged day guests.
  // ~10 households grouped by name + side over the first ~26 guests.
  const householdNames = [
    "The Hendersons", "The Carters", "The Walsh Family", "Khan Household",
    "The Bennetts", "Reid & Family", "The Campbells", "The Adeyemis",
    "The Mitchells", "The Coopers",
  ];
  const guests: Guest[] = [];
  for (let i = 0; i < 96; i++) {
    const f = firsts[i % firsts.length];
    const l = lasts[(i * 7) % lasts.length];
    const rsvp: Rsvp = i % 9 === 0 ? "pending" : i % 13 === 0 ? "no" : "yes";

    // Tagging by index band.
    const tags: string[] = [];
    if (i < 3) tags.push("VIP");
    else if (i < 9) tags.push("Wedding party");
    else if (i < 21) tags.push("Family");
    else if (i < 27) tags.push("Kids");
    if (i >= 66) tags.push("Evening");

    const isKid = i >= 21 && i < 27;
    const isEvening = i >= 66;
    const sessionType: Guest["sessionType"] = isEvening
      ? "evening"
      : i === 30 || i === 47
        ? "ceremony_only"
        : "day";

    // Households over the first 26 guests (pairs of two share a household).
    const inHousehold = i < 20;
    const householdIdx = Math.floor(i / 2);
    const householdId = inHousehold ? `h${householdIdx + 1}` : null;
    const householdName = inHousehold
      ? householdNames[householdIdx % householdNames.length]
      : null;

    const plusOne = i % 5 === 0;
    // Some +1s are named, some not yet.
    const plusOneName = plusOne ? (i % 10 === 0 ? `Guest of ${f}` : null) : null;

    // Day-session guests have a meal choice; evening/kids/ceremony-only don't.
    const mealChoice =
      sessionType === "day" && !isKid && rsvp !== "no"
        ? {
            starter: starters[i % starters.length],
            main: mains[i % mains.length],
            dessert: desserts[i % desserts.length],
          }
        : undefined;

    guests.push({
      id: `g${i + 1}`,
      name: `${f} ${l}`,
      side: i % 2 === 0 ? "partner1" : "partner2",
      table: rsvp === "no" ? null : (i % 12) + 1,
      rsvp,
      dietary: isKid ? [] : dietaryPool[(i * 3) % dietaryPool.length],
      plusOne,
      tags,
      householdId,
      householdName,
      plusOneName,
      sessionType,
      rsvpChasedAt: rsvp === "pending" ? "2026-06-10T09:00:00Z" : null,
      seatIndex: rsvp === "no" ? null : (i % 10) + 1,
      mealChoice,
    });
  }
  return guests;
}

// ---------------------------------------------------------------------------
// AI Copilot insights
// ---------------------------------------------------------------------------

export const COPILOT_INSIGHTS: CopilotInsight[] = [
  { id: "ci1", kind: "at_risk", contactId: "c2", title: "Khan & Reid date hold expires in 2 days",
    detail: "Proposal sent 11 Jun, no decision yet. Suggest a friendly WhatsApp nudge before the hold lapses.",
    priority: 1, signal: "Date hold lapses 16 Jun · proposal unviewed for 3 days", dueAt: "2026-06-16",
    actionHref: "/preview/contacts/c2", status: "open" },
  { id: "ci2", kind: "action", contactId: "c5", title: "New enquiry needs a first reply",
    detail: "Charlotte Price enquired 1 hour ago. Brochure auto-sent. Draft a personal reply mentioning 2027 dates?",
    priority: 2, signal: "First-response window — book-rate is 21× higher under 5 mins", dueAt: "2026-06-13T09:30:00Z",
    actionHref: "/preview/contacts/c5", status: "open" },
  { id: "ci3", kind: "win", contactId: "c1", title: "Henderson & Carter just booked",
    detail: "Deposit paid today. Wedding Workspace opened and payment schedule generated automatically.",
    priority: 5, signal: "Deposit £4,625 received · workspace created", weddingId: "w1",
    actionHref: "/preview/weddings/w1", status: "open" },
  { id: "ci4", kind: "nudge", contactId: "c4", title: "Adeyemi & Al-Rashid final balance due soon",
    detail: "£4,000 due 19 Aug. Auto-reminder scheduled; consider confirming final guest numbers too.",
    priority: 3, signal: "Final balance £4,000 due 19 Aug · numbers not yet final", dueAt: "2026-08-19",
    weddingId: "w2", actionHref: "/preview/weddings/w2", status: "open",
    scheduledFor: "2026-08-05T09:00:00Z" },
  { id: "ci5", kind: "action", contactId: "c8", title: "Mitchell & Hughes ready to propose",
    detail: "Attended viewing, asked for next steps. Highest-converting moment — send a proposal today.",
    priority: 2, signal: "Viewing attended · asked for next steps", dueAt: "2026-06-16",
    actionHref: "/preview/contacts/c8", status: "open" },
];

// ---------------------------------------------------------------------------
// Reports / lifecycle metrics
// ---------------------------------------------------------------------------

export const REPORTS = {
  // --- Existing top-level keys (consumers depend on these — do not remove) ---
  funnel: [
    { stage: "Enquiries", value: 142 },
    { stage: "Responded", value: 128 },
    { stage: "Viewings booked", value: 61 },
    { stage: "Attended", value: 48 },
    { stage: "Proposals", value: 39 },
    { stage: "Booked", value: 24 },
  ],
  sourceRoi: [
    { source: "Instagram", enquiries: 44, booked: 9, revenue: 162000, spend: 4800, cac: 533 },
    { source: "Hitched", enquiries: 31, booked: 6, revenue: 109000, spend: 6000, cac: 1000 },
    { source: "Referral", enquiries: 18, booked: 5, revenue: 96000, spend: 0, cac: 0 },
    { source: "Google", enquiries: 27, booked: 3, revenue: 51000, spend: 3600, cac: 1200 },
    { source: "Website form", enquiries: 22, booked: 1, revenue: 17000, spend: 0, cac: 0 },
  ],
  revenueByMonth: [
    { month: "Jan", booked: 32000 },
    { month: "Feb", booked: 41000 },
    { month: "Mar", booked: 56000 },
    { month: "Apr", booked: 38000 },
    { month: "May", booked: 67000 },
    { month: "Jun", booked: 72000 },
  ],
  kpis: {
    conversionRate: 16.9, // %
    avgBookingValue: 17400,
    avgFirstResponseMins: 4,
    bookedRevenueYtd: 306000,
    onTimePayments: 96, // %
    portalAdoption: 84, // %
    // --- v2 additive: prior-period values for delta calc ---
    conversionRatePrev: 14.2,
    avgBookingValuePrev: 16800,
    avgFirstResponseMinsPrev: 7,
    bookedRevenueYtdPrev: 248000,
    onTimePaymentsPrev: 93,
    portalAdoptionPrev: 79,
  },

  // --- v2 additive top-level keys ----------------------------------------

  /** Per-KPI sparkline series (last 6 periods), keyed by KPI name. */
  sparklines: {
    conversionRate: [13.1, 14.2, 14.0, 15.6, 16.1, 16.9],
    avgBookingValue: [16200, 16800, 16500, 17100, 17000, 17400],
    avgFirstResponseMins: [9, 7, 8, 6, 5, 4],
    bookedRevenueYtd: [42000, 83000, 139000, 177000, 244000, 306000],
    onTimePayments: [91, 93, 92, 94, 95, 96],
    portalAdoption: [70, 74, 76, 79, 82, 84],
  } as Record<string, number[]>,

  /** Funnel + sourceRoi + revenueByMonth + kpis snapshotted per period. */
  periods: {
    this_month: {
      funnel: [
        { stage: "Enquiries", value: 28 },
        { stage: "Responded", value: 26 },
        { stage: "Viewings booked", value: 13 },
        { stage: "Attended", value: 10 },
        { stage: "Proposals", value: 8 },
        { stage: "Booked", value: 5 },
      ],
      sourceRoi: [
        { source: "Instagram", enquiries: 9, booked: 2, revenue: 36000, spend: 800, cac: 400 },
        { source: "Hitched", enquiries: 6, booked: 1, revenue: 18000, spend: 1000, cac: 1000 },
        { source: "Referral", enquiries: 4, booked: 1, revenue: 19000, spend: 0, cac: 0 },
        { source: "Google", enquiries: 6, booked: 1, revenue: 17000, spend: 600, cac: 600 },
        { source: "Website form", enquiries: 3, booked: 0, revenue: 0, spend: 0, cac: 0 },
      ],
      revenueByMonth: [{ month: "Jun", booked: 72000 }],
      kpis: { conversionRate: 17.9, avgBookingValue: 18000, avgFirstResponseMins: 4, bookedRevenueYtd: 72000, onTimePayments: 96, portalAdoption: 84 },
      kpisPrev: { conversionRate: 15.4, avgBookingValue: 17000, avgFirstResponseMins: 5, bookedRevenueYtd: 67000, onTimePayments: 95, portalAdoption: 82 },
    },
    quarter: {
      funnel: [
        { stage: "Enquiries", value: 78 },
        { stage: "Responded", value: 71 },
        { stage: "Viewings booked", value: 34 },
        { stage: "Attended", value: 27 },
        { stage: "Proposals", value: 22 },
        { stage: "Booked", value: 14 },
      ],
      sourceRoi: [
        { source: "Instagram", enquiries: 24, booked: 5, revenue: 90000, spend: 2400, cac: 480 },
        { source: "Hitched", enquiries: 17, booked: 3, revenue: 54000, spend: 3000, cac: 1000 },
        { source: "Referral", enquiries: 10, booked: 3, revenue: 57000, spend: 0, cac: 0 },
        { source: "Google", enquiries: 15, booked: 2, revenue: 34000, spend: 1800, cac: 900 },
        { source: "Website form", enquiries: 12, booked: 1, revenue: 17000, spend: 0, cac: 0 },
      ],
      revenueByMonth: [
        { month: "Apr", booked: 38000 },
        { month: "May", booked: 67000 },
        { month: "Jun", booked: 72000 },
      ],
      kpis: { conversionRate: 17.9, avgBookingValue: 17900, avgFirstResponseMins: 4, bookedRevenueYtd: 177000, onTimePayments: 96, portalAdoption: 84 },
      kpisPrev: { conversionRate: 15.1, avgBookingValue: 16900, avgFirstResponseMins: 6, bookedRevenueYtd: 129000, onTimePayments: 93, portalAdoption: 78 },
    },
    ytd: {
      funnel: [
        { stage: "Enquiries", value: 142 },
        { stage: "Responded", value: 128 },
        { stage: "Viewings booked", value: 61 },
        { stage: "Attended", value: 48 },
        { stage: "Proposals", value: 39 },
        { stage: "Booked", value: 24 },
      ],
      sourceRoi: [
        { source: "Instagram", enquiries: 44, booked: 9, revenue: 162000, spend: 4800, cac: 533 },
        { source: "Hitched", enquiries: 31, booked: 6, revenue: 109000, spend: 6000, cac: 1000 },
        { source: "Referral", enquiries: 18, booked: 5, revenue: 96000, spend: 0, cac: 0 },
        { source: "Google", enquiries: 27, booked: 3, revenue: 51000, spend: 3600, cac: 1200 },
        { source: "Website form", enquiries: 22, booked: 1, revenue: 17000, spend: 0, cac: 0 },
      ],
      revenueByMonth: [
        { month: "Jan", booked: 32000 },
        { month: "Feb", booked: 41000 },
        { month: "Mar", booked: 56000 },
        { month: "Apr", booked: 38000 },
        { month: "May", booked: 67000 },
        { month: "Jun", booked: 72000 },
      ],
      kpis: { conversionRate: 16.9, avgBookingValue: 17400, avgFirstResponseMins: 4, bookedRevenueYtd: 306000, onTimePayments: 96, portalAdoption: 84 },
      kpisPrev: { conversionRate: 14.2, avgBookingValue: 16800, avgFirstResponseMins: 7, bookedRevenueYtd: 248000, onTimePayments: 93, portalAdoption: 79 },
    },
    last_12m: {
      funnel: [
        { stage: "Enquiries", value: 284 },
        { stage: "Responded", value: 256 },
        { stage: "Viewings booked", value: 122 },
        { stage: "Attended", value: 97 },
        { stage: "Proposals", value: 78 },
        { stage: "Booked", value: 47 },
      ],
      sourceRoi: [
        { source: "Instagram", enquiries: 88, booked: 18, revenue: 324000, spend: 9600, cac: 533 },
        { source: "Hitched", enquiries: 62, booked: 12, revenue: 218000, spend: 12000, cac: 1000 },
        { source: "Referral", enquiries: 36, booked: 10, revenue: 192000, spend: 0, cac: 0 },
        { source: "Google", enquiries: 54, booked: 6, revenue: 102000, spend: 7200, cac: 1200 },
        { source: "Website form", enquiries: 44, booked: 2, revenue: 34000, spend: 0, cac: 0 },
      ],
      revenueByMonth: [
        { month: "Jul", booked: 58000 },
        { month: "Aug", booked: 71000 },
        { month: "Sep", booked: 64000 },
        { month: "Oct", booked: 49000 },
        { month: "Nov", booked: 44000 },
        { month: "Dec", booked: 38000 },
        { month: "Jan", booked: 32000 },
        { month: "Feb", booked: 41000 },
        { month: "Mar", booked: 56000 },
        { month: "Apr", booked: 38000 },
        { month: "May", booked: 67000 },
        { month: "Jun", booked: 72000 },
      ],
      kpis: { conversionRate: 16.5, avgBookingValue: 17600, avgFirstResponseMins: 5, bookedRevenueYtd: 870000, onTimePayments: 95, portalAdoption: 82 },
      kpisPrev: { conversionRate: 13.8, avgBookingValue: 16400, avgFirstResponseMins: 8, bookedRevenueYtd: 712000, onTimePayments: 91, portalAdoption: 74 },
    },
  },

  /** Forward booking pacing — booked vs held vs target by upcoming month. */
  pacing: [
    { month: "Jul 26", booked: 6, held: 2, target: 7 },
    { month: "Aug 26", booked: 7, held: 1, target: 7 },
    { month: "Sep 26", booked: 8, held: 2, target: 8 },
    { month: "Oct 26", booked: 5, held: 3, target: 7 },
    { month: "Nov 26", booked: 4, held: 2, target: 6 },
    { month: "Dec 26", booked: 3, held: 1, target: 4 },
    { month: "Jan 27", booked: 2, held: 1, target: 3 },
    { month: "Feb 27", booked: 2, held: 2, target: 3 },
    { month: "Mar 27", booked: 4, held: 3, target: 6 },
    { month: "Apr 27", booked: 5, held: 4, target: 8 },
    { month: "May 27", booked: 6, held: 3, target: 9 },
    { month: "Jun 27", booked: 4, held: 5, target: 9 },
    { month: "Jul 27", booked: 3, held: 4, target: 8 },
    { month: "Aug 27", booked: 2, held: 3, target: 7 },
    { month: "Sep 27", booked: 1, held: 4, target: 8 },
    { month: "Oct 27", booked: 1, held: 2, target: 6 },
    { month: "Nov 27", booked: 0, held: 2, target: 5 },
    { month: "Dec 27", booked: 0, held: 1, target: 3 },
  ],

  /** Date / capacity utilisation — saturdays available vs booked per month. */
  capacityByMonth: [
    { month: "Jul", availableSaturdays: 4, bookedSaturdays: 4, allDates: 31, bookedDates: 9 },
    { month: "Aug", availableSaturdays: 5, bookedSaturdays: 4, allDates: 31, bookedDates: 8 },
    { month: "Sep", availableSaturdays: 4, bookedSaturdays: 4, allDates: 30, bookedDates: 10 },
    { month: "Oct", availableSaturdays: 4, bookedSaturdays: 3, allDates: 31, bookedDates: 7 },
    { month: "Nov", availableSaturdays: 5, bookedSaturdays: 3, allDates: 30, bookedDates: 6 },
    { month: "Dec", availableSaturdays: 4, bookedSaturdays: 2, allDates: 31, bookedDates: 4 },
    { month: "Jan", availableSaturdays: 4, bookedSaturdays: 1, allDates: 31, bookedDates: 2 },
    { month: "Feb", availableSaturdays: 4, bookedSaturdays: 1, allDates: 28, bookedDates: 2 },
    { month: "Mar", availableSaturdays: 4, bookedSaturdays: 3, allDates: 31, bookedDates: 5 },
    { month: "Apr", availableSaturdays: 4, bookedSaturdays: 3, allDates: 30, bookedDates: 6 },
    { month: "May", availableSaturdays: 5, bookedSaturdays: 5, allDates: 31, bookedDates: 9 },
    { month: "Jun", availableSaturdays: 4, bookedSaturdays: 4, allDates: 30, bookedDates: 9 },
  ],

  /** Seasonality — share of bookings by month (the 69% May–Nov curve). */
  seasonality: [
    { month: "Jan", bookings: 2, share: 3 },
    { month: "Feb", bookings: 2, share: 3 },
    { month: "Mar", bookings: 5, share: 7 },
    { month: "Apr", bookings: 6, share: 8 },
    { month: "May", bookings: 9, share: 13 },
    { month: "Jun", bookings: 9, share: 13 },
    { month: "Jul", bookings: 8, share: 11 },
    { month: "Aug", bookings: 8, share: 11 },
    { month: "Sep", bookings: 8, share: 11 },
    { month: "Oct", bookings: 6, share: 8 },
    { month: "Nov", bookings: 5, share: 7 },
    { month: "Dec", bookings: 3, share: 4 },
  ],

  /** Per-team-member sales performance (keyed by TEAM id). */
  teamPerformance: [
    { memberId: "u1", enquiries: 64, viewings: 31, booked: 12, revenue: 214000, avgFirstResponseMins: 3, conversionRate: 18.8 },
    { memberId: "u2", enquiries: 41, viewings: 18, booked: 6, revenue: 102000, avgFirstResponseMins: 6, conversionRate: 14.6 },
    { memberId: "u3", enquiries: 37, viewings: 17, booked: 6, revenue: 119000, avgFirstResponseMins: 4, conversionRate: 16.2 },
  ],

  /** Payment health / AR snapshot. */
  paymentHealth: {
    collected: 192000,
    outstanding: 84000,
    overdue: 4000,
    upcoming: [
      { weddingId: "w2", coupleName: "Adeyemi & Al-Rashid", label: "Final balance (25%)", amount: 4000, dueDate: "2026-08-19", status: "due" as MilestoneStatus },
      { weddingId: "w3", coupleName: "Campbell & Evans", label: "Interim payment (50%)", amount: 8250, dueDate: "2026-10-17", status: "upcoming" as MilestoneStatus },
      { weddingId: "w1", coupleName: "Henderson & Carter", label: "Interim payment (50%)", amount: 9250, dueDate: "2026-11-22", status: "upcoming" as MilestoneStatus },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getContact(id: string): Contact | undefined {
  return CONTACTS.find((c) => c.id === id);
}

export function getConversation(contactId: string): Message[] {
  return CONVERSATIONS.find((c) => c.contactId === contactId)?.messages ?? [];
}

export function getWedding(id: string): Wedding | undefined {
  return WEDDINGS.find((w) => w.id === id);
}

export function primaryWedding(): Wedding {
  return WEDDINGS.find((w) => w.id === WED_PRIMARY_ID) ?? WEDDINGS[0];
}

export function teamMember(id: string): TeamMember | undefined {
  return TEAM.find((t) => t.id === id);
}

/** The coordinator TeamMember assigned to a wedding (via `coordinatorId`). */
export function getCoordinator(weddingId: string): TeamMember | undefined {
  const wedding = getWedding(weddingId);
  return wedding?.coordinatorId ? teamMember(wedding.coordinatorId) : undefined;
}

/** GBP, no decimals (e.g. £18,500). */
export function gbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Whole days from TODAY to an ISO date (negative if past). */
export function daysFromToday(iso: string): number {
  const ms = new Date(iso).getTime() - new Date(TODAY).getTime();
  return Math.round(ms / 86_400_000);
}

/** "22 May 2027" */
export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "13 Jun, 15:20" — for message timestamps. */
export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function proposalTotal(lines: ProposalLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty * l.unit, 0);
}

// ---------------------------------------------------------------------------
// v2 entity modules — single import path: `@/lib/mock`
// ---------------------------------------------------------------------------

export * from "./crm";
export * from "./proposals";
export * from "./planning";
export * from "./suppliers";
export * from "./admin";
export * from "./reports-data";
