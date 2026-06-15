/**
 * VenueFlow — PROTOTYPE mock data: Proposals & Payments layer.
 *
 * Price library, proposal templates, the Proposal entity with a status
 * lifecycle, venue billing defaults, and the commercial helpers the Proposal
 * Builder relies on. Additive to `./index`; reuses the existing `ProposalLine`
 * shape (extended there with optional builder fields).
 */

import type { ProposalLine, Channel } from "./index";

// ---------------------------------------------------------------------------
// Price library
// ---------------------------------------------------------------------------

export interface PriceLibraryItem {
  id: string;
  name: string;
  category: "venue_hire" | "catering" | "drinks" | "evening" | "extras";
  unit: number; // GBP
  unitType: "flat" | "per_head" | "per_evening";
  defaultQtySource: "fixed" | "guest_count" | "evening_count";
  description?: string;
}

export const PRICE_LIBRARY: PriceLibraryItem[] = [
  { id: "pl1", name: "Venue hire — Long Barn (full day)", category: "venue_hire", unit: 6500, unitType: "flat", defaultQtySource: "fixed", description: "Exclusive use of the Long Barn from 8am to midnight." },
  { id: "pl2", name: "Venue hire — Orangery (full day)", category: "venue_hire", unit: 5500, unitType: "flat", defaultQtySource: "fixed", description: "Exclusive use of the Orangery, ideal for 60–100 guests." },
  { id: "pl3", name: "Ceremony in the Courtyard", category: "venue_hire", unit: 850, unitType: "flat", defaultQtySource: "fixed", description: "Outdoor ceremony setup with wet-weather backup." },
  { id: "pl4", name: "Three-course wedding breakfast", category: "catering", unit: 75, unitType: "per_head", defaultQtySource: "guest_count", description: "Seasonal three-course menu, freshly prepared in-house." },
  { id: "pl5", name: "Canapés (selection of 5)", category: "catering", unit: 14, unitType: "per_head", defaultQtySource: "guest_count", description: "Five chef-selected canapés during the drinks reception." },
  { id: "pl6", name: "Children's menu", category: "catering", unit: 28, unitType: "per_head", defaultQtySource: "fixed", description: "Two-course children's menu for under-12s." },
  { id: "pl7", name: "External catering corkage", category: "catering", unit: 35, unitType: "per_head", defaultQtySource: "guest_count", description: "Per-head fee for approved external caterers." },
  { id: "pl8", name: "Drinks package — Classic", category: "drinks", unit: 28, unitType: "per_head", defaultQtySource: "guest_count", description: "Arrival drink, half bottle of wine, toast fizz." },
  { id: "pl9", name: "Drinks package — Premium", category: "drinks", unit: 42, unitType: "per_head", defaultQtySource: "guest_count", description: "Champagne arrival, sommelier-selected wines, toast." },
  { id: "pl10", name: "Soft drinks package", category: "drinks", unit: 16, unitType: "per_head", defaultQtySource: "guest_count", description: "Unlimited soft drinks and mocktails (dry option)." },
  { id: "pl11", name: "Evening buffet", category: "evening", unit: 18, unitType: "per_evening", defaultQtySource: "evening_count", description: "Hot & cold evening buffet for day + evening guests." },
  { id: "pl12", name: "Bacon & sausage rolls (late)", category: "evening", unit: 8, unitType: "per_evening", defaultQtySource: "evening_count", description: "Late-night handheld bites at carriages." },
  { id: "pl13", name: "Overnight accommodation (per room)", category: "extras", unit: 180, unitType: "flat", defaultQtySource: "fixed", description: "On-site cottage rooms for the wedding party." },
  { id: "pl14", name: "Cake stand & cutting", category: "extras", unit: 95, unitType: "flat", defaultQtySource: "fixed", description: "Cake stand hire and cutting service." },
  { id: "pl15", name: "Master of ceremonies", category: "extras", unit: 350, unitType: "flat", defaultQtySource: "fixed", description: "Experienced toastmaster for the day." },
];

// ---------------------------------------------------------------------------
// Proposal templates
// ---------------------------------------------------------------------------

export interface ProposalTemplate {
  id: string;
  name: string;
  season: string;
  lineItemIds: string[]; // refs into PRICE_LIBRARY
  defaultDepositPct: number;
}

export const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  { id: "ptpl1", name: "The Full Day — Summer", season: "Summer", lineItemIds: ["pl1", "pl4", "pl5", "pl8", "pl11"], defaultDepositPct: 25 },
  { id: "ptpl2", name: "The Full Day — Autumn", season: "Autumn", lineItemIds: ["pl1", "pl4", "pl8", "pl11"], defaultDepositPct: 25 },
  { id: "ptpl3", name: "Intimate Orangery", season: "All year", lineItemIds: ["pl2", "pl4", "pl10"], defaultDepositPct: 25 },
  { id: "ptpl4", name: "Reception only (external catering)", season: "All year", lineItemIds: ["pl1", "pl7", "pl10", "pl11"], defaultDepositPct: 25 },
];

// ---------------------------------------------------------------------------
// Venue billing defaults
// ---------------------------------------------------------------------------

export const VENUE_BILLING = {
  vatRegistered: true,
  vatPct: 20,
  defaultDepositPct: 25,
  defaultHoldDays: 7,
  currency: "GBP" as const,
};

// ---------------------------------------------------------------------------
// Proposal entity (status lifecycle)
// ---------------------------------------------------------------------------

export interface Proposal {
  id: string;
  contactId: string;
  weddingId?: string;
  templateId: string;
  status: "draft" | "sent" | "viewed" | "accepted" | "expired";
  lines: ProposalLine[];
  discount: { type: "pct" | "fixed"; value: number } | null;
  depositPct: number;
  vatPct?: number;
  holdUntil: string | null;
  sentAt?: string;
  sentChannel?: Channel;
  total: number;
}

export const PROPOSALS: Proposal[] = [
  // Accepted — became w1 (Henderson & Carter).
  {
    id: "prop1",
    contactId: "c1",
    weddingId: "w1",
    templateId: "ptpl1",
    status: "accepted",
    lines: [
      { id: "prl1", label: "Venue hire — Long Barn (full day)", qty: 1, unit: 6500, category: "package", libraryItemId: "pl1", unitType: "flat", qtyTiedToGuests: false },
      { id: "prl2", label: "Three-course wedding breakfast", qty: 120, unit: 75, category: "package", libraryItemId: "pl4", unitType: "per_head", qtyTiedToGuests: true },
      { id: "prl3", label: "Evening buffet", qty: 60, unit: 18, category: "package", libraryItemId: "pl11", unitType: "per_evening", qtyTiedToGuests: false },
      { id: "prl4", label: "Drinks package — Classic", qty: 120, unit: 28, category: "package", libraryItemId: "pl8", unitType: "per_head", qtyTiedToGuests: true },
    ],
    discount: null,
    depositPct: 25,
    vatPct: 20,
    holdUntil: null,
    sentAt: "2026-05-30T10:00:00Z",
    sentChannel: "email",
    total: 18500,
  },
  // Sent / expiring — c2 (Khan & Reid).
  {
    id: "prop2",
    contactId: "c2",
    templateId: "ptpl3",
    status: "viewed",
    lines: [
      { id: "prl10", label: "Venue hire — Orangery (full day)", qty: 1, unit: 5500, category: "package", libraryItemId: "pl2", unitType: "flat", qtyTiedToGuests: false },
      { id: "prl11", label: "Three-course wedding breakfast", qty: 90, unit: 75, category: "package", libraryItemId: "pl4", unitType: "per_head", qtyTiedToGuests: true },
      { id: "prl12", label: "Soft drinks package", qty: 90, unit: 16, category: "package", libraryItemId: "pl10", unitType: "per_head", qtyTiedToGuests: true },
      { id: "prl13", label: "Evening buffet", qty: 40, unit: 18, category: "addon", libraryItemId: "pl11", unitType: "per_evening", qtyTiedToGuests: false },
    ],
    discount: { type: "pct", value: 5 },
    depositPct: 25,
    vatPct: 20,
    holdUntil: "2026-06-16",
    sentAt: "2026-06-11T10:00:00Z",
    sentChannel: "email",
    total: 14107.5,
  },
  // Draft — c8 (Mitchell & Hughes), not yet sent.
  {
    id: "prop3",
    contactId: "c8",
    templateId: "ptpl2",
    status: "draft",
    lines: [
      { id: "prl20", label: "Venue hire — Long Barn (full day)", qty: 1, unit: 6500, category: "package", libraryItemId: "pl1", unitType: "flat", qtyTiedToGuests: false },
      { id: "prl21", label: "Three-course wedding breakfast", qty: 95, unit: 75, category: "package", libraryItemId: "pl4", unitType: "per_head", qtyTiedToGuests: true },
      { id: "prl22", label: "Drinks package — Classic", qty: 95, unit: 28, category: "addon", libraryItemId: "pl8", unitType: "per_head", qtyTiedToGuests: true },
    ],
    discount: null,
    depositPct: 25,
    vatPct: 20,
    holdUntil: null,
    total: 16285,
  },
];

export function getProposal(id: string): Proposal | undefined {
  return PROPOSALS.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Commercial helpers
// ---------------------------------------------------------------------------

export function lineTotal(line: ProposalLine): number {
  const gross = line.qty * line.unit;
  return line.discountPct ? gross * (1 - line.discountPct / 100) : gross;
}

export function proposalSubtotal(lines: ProposalLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

export function applyDiscount(
  subtotal: number,
  discount: { type: "pct" | "fixed"; value: number } | null,
): number {
  if (!discount) return subtotal;
  return discount.type === "pct"
    ? subtotal * (1 - discount.value / 100)
    : Math.max(0, subtotal - discount.value);
}

export function depositAmount(total: number, depositPct: number): number {
  return Math.round((total * depositPct) / 100);
}

export interface ScheduleMilestone {
  label: string;
  amount: number;
  dueDate: string; // ISO
}

/**
 * Generate the standard deposit → interim → final schedule from a total and
 * the wedding date. Deposit is `depositPct`, interim is 50%, balance is the
 * remainder. Interim falls ~6 months before, balance ~30 days before.
 */
export function generateSchedule(
  total: number,
  depositPct: number,
  weddingDateIso: string,
): ScheduleMilestone[] {
  const deposit = depositAmount(total, depositPct);
  const interim = Math.round(total * 0.5);
  const balance = total - deposit - interim;
  const wedding = new Date(weddingDateIso);
  const interimDue = new Date(wedding);
  interimDue.setMonth(interimDue.getMonth() - 6);
  const balanceDue = new Date(wedding);
  balanceDue.setDate(balanceDue.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return [
    { label: `Booking deposit (${depositPct}%)`, amount: deposit, dueDate: iso(new Date()) },
    { label: "Interim payment (50%)", amount: interim, dueDate: iso(interimDue) },
    { label: `Final balance (${100 - depositPct - 50}%)`, amount: balance, dueDate: iso(balanceDue) },
  ];
}
