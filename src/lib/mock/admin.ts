/**
 * VenueFlow — PROTOTYPE mock data: Admin / configuration layer.
 *
 * Content + identity configuration only (the 8 stages, 3-step sequence and 2
 * meeting types stay fixed — opinionated templates, not builders). Backs the
 * `/preview/admin` settings shell. Additive to `./index`.
 */

import type { Channel } from "./index";

// ---------------------------------------------------------------------------
// Spaces
// ---------------------------------------------------------------------------

export interface Space {
  id: string;
  name: string;
  description: string;
  seatedCapacity: number;
  standingCapacity: number;
  ceremonyCapacity: number;
  indoorOutdoor: "indoor" | "outdoor" | "both";
  photoUrl: string;
  order: number;
}

export const SPACES: Space[] = [
  { id: "sp1", name: "The Long Barn", description: "Our flagship 17th-century barn with exposed oak beams and a vaulted ceiling — the heart of the venue.", seatedCapacity: 140, standingCapacity: 220, ceremonyCapacity: 150, indoorOutdoor: "indoor", photoUrl: "/spaces/long-barn.jpg", order: 1 },
  { id: "sp2", name: "The Orangery", description: "A light-filled glasshouse opening onto the gardens — perfect for intimate weddings and evening receptions.", seatedCapacity: 100, standingCapacity: 140, ceremonyCapacity: 110, indoorOutdoor: "both", photoUrl: "/spaces/orangery.jpg", order: 2 },
  { id: "sp3", name: "The Courtyard", description: "A walled cobbled courtyard for outdoor ceremonies and drinks receptions, with wet-weather cover.", seatedCapacity: 80, standingCapacity: 160, ceremonyCapacity: 120, indoorOutdoor: "outdoor", photoUrl: "/spaces/courtyard.jpg", order: 3 },
];

// ---------------------------------------------------------------------------
// Floor templates (saved table layouts per space)
// ---------------------------------------------------------------------------

export interface FloorTemplate {
  id: string;
  spaceId: string;
  name: string;
  tableCount: number;
  capacity: number;
  isDefault: boolean;
}

export const FLOOR_TEMPLATES: FloorTemplate[] = [
  { id: "fl1", spaceId: "sp1", name: "Long Barn — 12 rounds + head", tableCount: 13, capacity: 130, isDefault: true },
  { id: "fl2", spaceId: "sp1", name: "Long Barn — banqueting rows", tableCount: 8, capacity: 140, isDefault: false },
  { id: "fl3", spaceId: "sp2", name: "Orangery — 10 rounds", tableCount: 10, capacity: 100, isDefault: true },
  { id: "fl4", spaceId: "sp3", name: "Courtyard — ceremony rows", tableCount: 0, capacity: 120, isDefault: true },
];

// ---------------------------------------------------------------------------
// Menu library (master dishes — includes the w1 menu options)
// ---------------------------------------------------------------------------

export interface MenuLibraryItem {
  id: string;
  course: string;
  name: string;
  description: string;
  allergens: string[];
  dietary: string[];
  pricePerHead: number;
  photoUrl: string | null;
  isActive: boolean;
}

export const MENU_LIBRARY: MenuLibraryItem[] = [
  { id: "ml1", course: "Starter", name: "Heritage tomato & burrata", description: "Heritage tomatoes, Puglian burrata, basil oil & aged balsamic.", allergens: ["Dairy"], dietary: ["Vegetarian"], pricePerHead: 12, photoUrl: "/dishes/heritage-tomato-burrata.jpg", isActive: true },
  { id: "ml2", course: "Starter", name: "Ham hock terrine", description: "Pressed ham hock, piccalilli & toasted sourdough.", allergens: ["Mustard", "Gluten"], dietary: [], pricePerHead: 11, photoUrl: null, isActive: true },
  { id: "ml3", course: "Starter", name: "Wild mushroom tart", description: "Wild mushroom & tarragon tart, truffled crème fraîche.", allergens: ["Gluten", "Dairy"], dietary: ["Vegetarian"], pricePerHead: 11, photoUrl: null, isActive: true },
  { id: "ml4", course: "Main", name: "Roast sirloin of beef", description: "28-day aged sirloin, duck-fat potatoes, roasted roots & red wine jus.", allergens: [], dietary: [], pricePerHead: 28, photoUrl: "/dishes/roast-sirloin-of-beef.jpg", isActive: true },
  { id: "ml5", course: "Main", name: "Pan-roast chicken", description: "Free-range chicken supreme, dauphinoise, tenderstem & tarragon cream.", allergens: ["Dairy"], dietary: [], pricePerHead: 25, photoUrl: null, isActive: true },
  { id: "ml6", course: "Main", name: "Squash & sage risotto", description: "Roast squash & sage risotto, toasted pumpkin seeds, crispy kale.", allergens: [], dietary: ["Vegan", "Gluten-free"], pricePerHead: 22, photoUrl: null, isActive: true },
  { id: "ml7", course: "Dessert", name: "Sticky toffee pudding", description: "Sticky toffee pudding, salted caramel & clotted cream.", allergens: ["Gluten", "Dairy", "Egg"], dietary: ["Vegetarian"], pricePerHead: 10, photoUrl: "/dishes/sticky-toffee-pudding.jpg", isActive: true },
  { id: "ml8", course: "Dessert", name: "Lemon posset", description: "Sicilian lemon posset, shortbread crumb & summer berries.", allergens: ["Dairy"], dietary: ["Vegetarian", "Gluten-free"], pricePerHead: 9, photoUrl: null, isActive: true },
  { id: "ml9", course: "Children", name: "Mini fish & chips", description: "Battered fish goujons, chunky chips & garden peas.", allergens: ["Gluten", "Fish"], dietary: [], pricePerHead: 14, photoUrl: null, isActive: true },
  { id: "ml10", course: "Evening", name: "Hot & cold evening buffet", description: "Carved meats, sliders, salads & artisan breads.", allergens: ["Gluten", "Dairy", "Mustard"], dietary: [], pricePerHead: 18, photoUrl: null, isActive: true },
];

// ---------------------------------------------------------------------------
// Packages & price list
// ---------------------------------------------------------------------------

export interface PackageLine {
  id: string;
  label: string;
  unit: number;
  unitType: "flat" | "per_head" | "per_evening";
  qtyTiedToGuests: boolean;
}

export interface Package {
  id: string;
  name: string;
  season: string;
  description: string;
  fromPrice: number;
  isActive: boolean;
  lines: PackageLine[];
}

export const PACKAGES: Package[] = [
  {
    id: "pkg1", name: "The Full Day — Summer", season: "Summer", description: "Exclusive use, three-course breakfast, classic drinks and an evening buffet.", fromPrice: 18500, isActive: true,
    lines: [
      { id: "pkl1", label: "Venue hire — Long Barn (full day)", unit: 6500, unitType: "flat", qtyTiedToGuests: false },
      { id: "pkl2", label: "Three-course wedding breakfast", unit: 75, unitType: "per_head", qtyTiedToGuests: true },
      { id: "pkl3", label: "Drinks package — Classic", unit: 28, unitType: "per_head", qtyTiedToGuests: true },
      { id: "pkl4", label: "Evening buffet", unit: 18, unitType: "per_evening", qtyTiedToGuests: false },
    ],
  },
  {
    id: "pkg2", name: "The Full Day — Autumn", season: "Autumn", description: "Our flagship day package with a warming seasonal menu.", fromPrice: 17500, isActive: true,
    lines: [
      { id: "pkl5", label: "Venue hire — Long Barn (full day)", unit: 6500, unitType: "flat", qtyTiedToGuests: false },
      { id: "pkl6", label: "Three-course wedding breakfast", unit: 72, unitType: "per_head", qtyTiedToGuests: true },
      { id: "pkl7", label: "Drinks package — Classic", unit: 28, unitType: "per_head", qtyTiedToGuests: true },
    ],
  },
  {
    id: "pkg3", name: "Intimate Orangery", season: "All year", description: "A light-filled celebration for up to 100 guests.", fromPrice: 13500, isActive: true,
    lines: [
      { id: "pkl8", label: "Venue hire — Orangery (full day)", unit: 5500, unitType: "flat", qtyTiedToGuests: false },
      { id: "pkl9", label: "Three-course wedding breakfast", unit: 75, unitType: "per_head", qtyTiedToGuests: true },
      { id: "pkl10", label: "Soft drinks package", unit: 16, unitType: "per_head", qtyTiedToGuests: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------

export interface Role {
  key: string;
  name: string;
  description: string;
}

export const ROLES: Role[] = [
  { key: "owner", name: "Owner", description: "Full access including billing and account settings." },
  { key: "admin", name: "Admin", description: "Manage configuration, team and all weddings." },
  { key: "coordinator", name: "Coordinator", description: "Run assigned weddings end to end; no account settings." },
  { key: "member", name: "Member", description: "View and reply; limited edit on assigned records." },
];

export type Capability =
  | "manage_billing"
  | "manage_settings"
  | "manage_team"
  | "manage_pipeline"
  | "edit_weddings"
  | "view_reports"
  | "send_messages";

export const ROLE_PERMISSIONS: Record<string, Record<Capability, boolean>> = {
  owner: { manage_billing: true, manage_settings: true, manage_team: true, manage_pipeline: true, edit_weddings: true, view_reports: true, send_messages: true },
  admin: { manage_billing: false, manage_settings: true, manage_team: true, manage_pipeline: true, edit_weddings: true, view_reports: true, send_messages: true },
  coordinator: { manage_billing: false, manage_settings: false, manage_team: false, manage_pipeline: true, edit_weddings: true, view_reports: true, send_messages: true },
  member: { manage_billing: false, manage_settings: false, manage_team: false, manage_pipeline: false, edit_weddings: false, view_reports: false, send_messages: true },
};

// ---------------------------------------------------------------------------
// Custom fields (the capped jsonb escape-hatch — a bounded list, not a builder)
// ---------------------------------------------------------------------------

export interface CustomField {
  id: string;
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date";
  options?: string[];
  appliesTo: "contact" | "wedding";
  order: number;
}

export const CUSTOM_FIELDS: CustomField[] = [
  { id: "cf1", key: "how_heard", label: "How did you hear about us?", type: "select", options: ["Instagram", "Google", "Hitched", "Referral", "Facebook", "Website form", "Wedding fair"], appliesTo: "contact", order: 1 },
  { id: "cf2", key: "budget_band", label: "Budget band", type: "select", options: ["Under £12k", "£12k–£14k", "£14k–£16k", "£16k–£18k", "£18k+"], appliesTo: "contact", order: 2 },
  { id: "cf3", key: "preferred_space", label: "Preferred space", type: "select", options: ["The Long Barn", "The Orangery", "The Courtyard", "Undecided"], appliesTo: "contact", order: 3 },
  { id: "cf4", key: "guest_estimate", label: "Guest estimate", type: "number", appliesTo: "contact", order: 4 },
  { id: "cf5", key: "decision_makers", label: "Decision makers", type: "text", appliesTo: "contact", order: 5 },
  { id: "cf6", key: "dietary_notes", label: "Dietary notes", type: "text", appliesTo: "wedding", order: 6 },
  { id: "cf7", key: "engagement_date", label: "Engagement date", type: "date", appliesTo: "contact", order: 7 },
];

// ---------------------------------------------------------------------------
// Communications identity (M8 — SMS / WhatsApp / email sending profile)
// ---------------------------------------------------------------------------

export interface CommsIdentity {
  emailFromName: string;
  emailReplyTo: string;
  emailSignature: string;
  sendingDomain: string;
  smsSenderName: string;
  smsStatus: "verified" | "in_review" | "action_needed" | "not_started";
  whatsappDisplayName: string;
  whatsappStatus: "verified" | "in_review" | "action_needed" | "not_started";
  whatsappAbout: string;
  whatsappCategory: string;
}

export const COMMS_IDENTITY: CommsIdentity = {
  emailFromName: "The Old Barn Weddings",
  emailReplyTo: "weddings@theoldbarn.co.uk",
  emailSignature: "Warm wishes,\nThe team at The Old Barn\nweddings@theoldbarn.co.uk · 01451 000000",
  sendingDomain: "mail.theoldbarn.co.uk",
  smsSenderName: "OldBarn",
  smsStatus: "verified",
  whatsappDisplayName: "The Old Barn",
  whatsappStatus: "in_review",
  whatsappAbout: "Wedding enquiries & planning for The Old Barn, Cotswolds.",
  whatsappCategory: "Event Planning Service",
};

// ---------------------------------------------------------------------------
// Nurture sequence (multi-channel content; the 3-step cadence stays fixed)
// ---------------------------------------------------------------------------

export interface NurtureStep {
  order: number;
  channel: Channel;
  subject?: string;
  body: string;
  smsBody?: string;
  delayDays: number;
  enabled: boolean;
}

export const NURTURE_STEPS: NurtureStep[] = [
  {
    order: 1, channel: "email", delayDays: 0, enabled: true,
    subject: "Your brochure for The Old Barn",
    body: "Hi {{coupleName}},\n\nThank you for your enquiry — your brochure is attached. We'd love to show you around. Just reply with a couple of dates that suit and we'll arrange a viewing.\n\nWarm wishes,\nThe Old Barn",
    smsBody: "Hi {{coupleName}}, thanks for your enquiry with The Old Barn! Your brochure is on its way by email. Reply here any time. 🌿",
  },
  {
    order: 2, channel: "email", delayDays: 3, enabled: true,
    subject: "Still dreaming about your day?",
    body: "Hi {{coupleName}},\n\nJust checking the brochure landed okay. Dates for next year are filling up — would a weekend viewing work for you? We can hold a date while you decide.\n\nThe Old Barn",
    smsBody: "Hi {{coupleName}}, just checking our brochure reached you okay. Want to book a viewing? Weekends are popular! — The Old Barn",
  },
  {
    order: 3, channel: "sms", delayDays: 7, enabled: true,
    body: "Hi {{coupleName}}, it's the team at The Old Barn. We'd hate for you to miss your dream date — shall we pencil you in for a viewing this month? Reply and we'll sort it. 😊",
    smsBody: "Hi {{coupleName}}, it's the team at The Old Barn. We'd hate for you to miss your dream date — shall we pencil you in for a viewing this month? Reply and we'll sort it. 😊",
  },
];
