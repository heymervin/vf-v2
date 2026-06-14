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
}

export interface ProposalLine {
  id: string;
  label: string;
  qty: number;
  unit: number; // GBP
}

export type DocStatus = "signed" | "sent" | "draft" | "received" | "missing";

export interface WeddingDoc {
  id: string;
  name: string;
  kind: "contract" | "insurance" | "invoice" | "supplier" | "other";
  status: DocStatus;
  updatedAt: string;
}

export interface RunsheetItem {
  id: string;
  time: string; // "14:00"
  title: string;
  owner: string;
  durationMin: number;
  category: "ceremony" | "reception" | "catering" | "supplier" | "logistics";
}

export type Rsvp = "yes" | "no" | "pending";

export interface Guest {
  id: string;
  name: string;
  side: "partner1" | "partner2" | "both";
  table: number | null;
  rsvp: Rsvp;
  dietary: string[]; // e.g. ["Vegetarian"], ["Nut allergy"]
  plusOne: boolean;
}

export interface MenuOption {
  id: string;
  name: string;
  allergens: string[];
  chosenBy: number; // guest count who chose it
}

export interface MenuCourse {
  id: string;
  course: string; // "Starter", "Main", "Dessert", "Children", "Evening"
  options: MenuOption[];
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
}

export interface CopilotInsight {
  id: string;
  kind: "at_risk" | "action" | "win" | "nudge";
  title: string;
  detail: string;
  contactId?: string;
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
  { id: "u1", name: "Hannah Wells", initials: "HW", role: "Sales Manager" },
  { id: "u2", name: "Marcus Bell", initials: "MB", role: "Coordinator" },
  { id: "u3", name: "Priya Shah", initials: "PS", role: "Events Lead" },
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
  },
  {
    id: "c2", partner1: "Aisha Khan", partner2: "Daniel Reid",
    coupleName: "Khan & Reid", initials: "AK",
    email: "aisha.k@outlook.com", phone: "+44 7700 900234",
    weddingDate: "2027-07-10", guestCount: 90, budget: 14000,
    source: "Google", stage: "date_on_hold", score: "hot",
    createdAt: "2026-03-02", lastChannel: "email", lastMessageAt: "2026-06-13T09:05:00Z",
    lastMessagePreview: "Thanks for the proposal — reviewing with family this weekend.", unread: 2, ownerId: "u1",
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
      { id: "pm1", label: "Booking deposit (25%)", amount: 4625, dueDate: "2026-06-14", status: "paid" },
      { id: "pm2", label: "Interim payment (50%)", amount: 9250, dueDate: "2026-11-22", status: "upcoming" },
      { id: "pm3", label: "Final balance (25%)", amount: 4625, dueDate: "2027-04-22", status: "upcoming" },
    ],
    docs: [
      { id: "d1", name: "Booking contract", kind: "contract", status: "signed", updatedAt: "2026-06-14" },
      { id: "d2", name: "Deposit invoice", kind: "invoice", status: "received", updatedAt: "2026-06-14" },
      { id: "d3", name: "Public liability (florist)", kind: "insurance", status: "missing", updatedAt: "2026-06-13" },
    ],
    runsheet: [
      { id: "r1", time: "08:00", title: "Supplier access — florist & stylist", owner: "Marcus Bell", durationMin: 120, category: "supplier" },
      { id: "r2", time: "11:00", title: "Registrar arrival & briefing", owner: "Priya Shah", durationMin: 30, category: "ceremony" },
      { id: "r3", time: "12:30", title: "Guests arrive — Courtyard drinks", owner: "Front of house", durationMin: 30, category: "logistics" },
      { id: "r4", time: "13:00", title: "Ceremony — The Long Barn", owner: "Registrar", durationMin: 40, category: "ceremony" },
      { id: "r5", time: "13:45", title: "Drinks reception & canapés", owner: "Catering", durationMin: 75, category: "catering" },
      { id: "r6", time: "15:00", title: "Wedding breakfast", owner: "Catering", durationMin: 120, category: "catering" },
      { id: "r7", time: "17:00", title: "Speeches", owner: "Toastmaster", durationMin: 45, category: "reception" },
      { id: "r8", time: "19:00", title: "Evening guests arrive · first dance", owner: "Band", durationMin: 30, category: "reception" },
      { id: "r9", time: "19:30", title: "Evening buffet", owner: "Catering", durationMin: 60, category: "catering" },
      { id: "r10", time: "23:30", title: "Last orders · carriages", owner: "Marcus Bell", durationMin: 30, category: "logistics" },
    ],
    guests: makeGuests(),
    menu: [
      { id: "mc1", course: "Starter", options: [
        { id: "o1", name: "Heritage tomato & burrata", allergens: ["Dairy"], chosenBy: 64 },
        { id: "o2", name: "Ham hock terrine", allergens: ["Mustard"], chosenBy: 41 },
        { id: "o3", name: "Wild mushroom tart (v)", allergens: ["Gluten"], chosenBy: 15 },
      ]},
      { id: "mc2", course: "Main", options: [
        { id: "o4", name: "Roast sirloin of beef", allergens: [], chosenBy: 70 },
        { id: "o5", name: "Pan-roast chicken", allergens: ["Dairy"], chosenBy: 34 },
        { id: "o6", name: "Squash & sage risotto (vg)", allergens: [], chosenBy: 16 },
      ]},
      { id: "mc3", course: "Dessert", options: [
        { id: "o7", name: "Sticky toffee pudding", allergens: ["Gluten", "Dairy", "Egg"], chosenBy: 88 },
        { id: "o8", name: "Lemon posset (gf)", allergens: ["Dairy"], chosenBy: 32 },
      ]},
      { id: "mc4", course: "Children", options: [
        { id: "o9", name: "Mini fish & chips", allergens: ["Gluten", "Fish"], chosenBy: 6 },
      ]},
    ],
    suppliers: [
      { id: "s1", name: "Bloom & Wild Co.", category: "Florist", contactName: "Jess Allen", phone: "+44 7700 902001", status: "confirmed", arrivalTime: "08:00", docs: 1 },
      { id: "s2", name: "Aperture Studios", category: "Photographer", contactName: "Dan Pryce", phone: "+44 7700 902002", status: "confirmed", arrivalTime: "11:30", docs: 2 },
      { id: "s3", name: "The Vinyl Frontier", category: "Band / DJ", contactName: "Mike Roe", phone: "+44 7700 902003", status: "pending", arrivalTime: "17:30", docs: 0 },
      { id: "s4", name: "Sweet Cheeks Cakes", category: "Cake", contactName: "Lara Fenn", phone: "+44 7700 902004", status: "confirmed", arrivalTime: "10:00", docs: 1 },
      { id: "s5", name: "Lux Coaches", category: "Transport", contactName: "Office", phone: "+44 7700 902005", status: "enquired", arrivalTime: null, docs: 0 },
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
  },
];

// Generate a realistic-ish guest list for the primary wedding.
function makeGuests(): Guest[] {
  const firsts = ["Oliver","Amelia","Jack","Isla","Harry","Ava","George","Mia","Noah","Grace","Leo","Ella","Arthur","Lily","Oscar","Sophie","Henry","Freya","Charlie","Ruby","Jacob","Evie","Thomas","Poppy","William","Florence","Joshua","Daisy","Alfie","Maya"];
  const lasts = ["Smith","Jones","Taylor","Brown","Wilson","Evans","Thomas","Roberts","Walker","Wright","Hughes","Green","Hall","Wood","Harris","Clarke","Patel","Baker","Cooper","Ward"];
  const dietaryPool: string[][] = [[], [], [], [], ["Vegetarian"], ["Vegan"], ["Gluten-free"], ["Nut allergy"], ["Dairy-free"], ["Pescatarian"]];
  const guests: Guest[] = [];
  for (let i = 0; i < 96; i++) {
    const f = firsts[i % firsts.length];
    const l = lasts[(i * 7) % lasts.length];
    const rsvp: Rsvp = i % 9 === 0 ? "pending" : i % 13 === 0 ? "no" : "yes";
    guests.push({
      id: `g${i + 1}`,
      name: `${f} ${l}`,
      side: i % 2 === 0 ? "partner1" : "partner2",
      table: rsvp === "no" ? null : (i % 12) + 1,
      rsvp,
      dietary: dietaryPool[(i * 3) % dietaryPool.length],
      plusOne: i % 5 === 0,
    });
  }
  return guests;
}

// ---------------------------------------------------------------------------
// AI Copilot insights
// ---------------------------------------------------------------------------

export const COPILOT_INSIGHTS: CopilotInsight[] = [
  { id: "ci1", kind: "at_risk", contactId: "c2", title: "Khan & Reid date hold expires in 2 days",
    detail: "Proposal sent 11 Jun, no decision yet. Suggest a friendly WhatsApp nudge before the hold lapses." },
  { id: "ci2", kind: "action", contactId: "c5", title: "New enquiry needs a first reply",
    detail: "Charlotte Price enquired 1 hour ago. Brochure auto-sent. Draft a personal reply mentioning 2027 dates?" },
  { id: "ci3", kind: "win", contactId: "c1", title: "Henderson & Carter just booked 🎉",
    detail: "Deposit paid today. Wedding Workspace opened and payment schedule generated automatically." },
  { id: "ci4", kind: "nudge", contactId: "c4", title: "Adeyemi & Al-Rashid final balance due soon",
    detail: "£4,000 due 19 Aug. Auto-reminder scheduled; consider confirming final guest numbers too." },
  { id: "ci5", kind: "action", contactId: "c8", title: "Mitchell & Hughes ready to propose",
    detail: "Attended viewing, asked for next steps. Highest-converting moment — send a proposal today." },
];

// ---------------------------------------------------------------------------
// Reports / lifecycle metrics
// ---------------------------------------------------------------------------

export const REPORTS = {
  funnel: [
    { stage: "Enquiries", value: 142 },
    { stage: "Responded", value: 128 },
    { stage: "Viewings booked", value: 61 },
    { stage: "Attended", value: 48 },
    { stage: "Proposals", value: 39 },
    { stage: "Booked", value: 24 },
  ],
  sourceRoi: [
    { source: "Instagram", enquiries: 44, booked: 9, revenue: 162000 },
    { source: "Hitched", enquiries: 31, booked: 6, revenue: 109000 },
    { source: "Referral", enquiries: 18, booked: 5, revenue: 96000 },
    { source: "Google", enquiries: 27, booked: 3, revenue: 51000 },
    { source: "Website form", enquiries: 22, booked: 1, revenue: 17000 },
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
