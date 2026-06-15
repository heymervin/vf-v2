/**
 * VenueFlow — PROTOTYPE mock data: CRM (Contacts) layer.
 *
 * Notes, activity log, tasks, smart lists, tag vocabulary, custom-field
 * definitions and reply templates. Centred on c1 (Henderson & Carter) so the
 * Contacts detail screens are rich. Additive to `./index` — single import
 * path stays `@/lib/mock`.
 */

import type { Channel } from "./index";

// ---------------------------------------------------------------------------
// Tag vocabulary + custom-field definitions (the bounded escape-hatch)
// ---------------------------------------------------------------------------

export const VENUE_TAGS: string[] = [
  "VIP",
  "Hot lead",
  "Booked",
  "Proposal sent",
  "Hold expiring",
  "Viewing done",
  "Summer 2027",
  "Autumn 2027",
  "Repeat enquiry",
  "Outside caterer",
  "Big budget",
  "Needs nurture",
];

export interface CustomFieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date";
  options?: string[];
}

export const CUSTOM_FIELD_DEFS: CustomFieldDef[] = [
  { key: "how_heard", label: "How did you hear about us?", type: "select", options: ["Instagram", "Google", "Hitched", "Referral", "Facebook", "Website form", "Wedding fair"] },
  { key: "budget_band", label: "Budget band", type: "select", options: ["Under £12k", "£12k–£14k", "£14k–£16k", "£16k–£18k", "£18k+"] },
  { key: "preferred_space", label: "Preferred space", type: "select", options: ["The Long Barn", "The Orangery", "The Courtyard", "Undecided"] },
  { key: "guest_estimate", label: "Guest estimate", type: "number" },
  { key: "decision_makers", label: "Decision makers", type: "text" },
  { key: "dietary_notes", label: "Dietary notes", type: "text" },
  { key: "engagement_date", label: "Engagement date", type: "date" },
];

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export interface ContactNote {
  id: string;
  contactId: string;
  author: string;
  at: string; // ISO
  body: string;
}

export const NOTES: ContactNote[] = [
  { id: "n1", contactId: "c1", author: "Hannah Wells", at: "2026-02-21T12:30:00Z", body: "Viewing went beautifully — Emma's mum loved the Long Barn beams. Strong intent, just comparing one other venue." },
  { id: "n2", contactId: "c1", author: "Hannah Wells", at: "2026-06-13T15:25:00Z", body: "Booked! Deposit incoming today. Marcus to take over as coordinator from next week." },
  { id: "n3", contactId: "c1", author: "Marcus Bell", at: "2026-06-14T09:10:00Z", body: "Workspace set up. Need florist PLI before sign-off and to schedule the menu tasting for November." },
  { id: "n4", contactId: "c2", author: "Hannah Wells", at: "2026-06-11T10:05:00Z", body: "Sent the July package with the Orangery for the evening. Family decision over the weekend — hold expires Tue." },
  { id: "n5", contactId: "c8", author: "Priya Shah", at: "2026-06-11T16:10:00Z", body: "Adored the venue on the viewing. Asked specifically about next steps — propose ASAP, this is the moment." },
];

export function getNotes(contactId: string): ContactNote[] {
  return NOTES.filter((n) => n.contactId === contactId);
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export interface ContactActivity {
  id: string;
  contactId: string;
  kind: "message" | "note" | "stage_change" | "task" | "call" | "system";
  at: string; // ISO
  author: string;
  summary: string;
  channel?: Channel;
}

export const ACTIVITIES: ContactActivity[] = [
  { id: "a1", contactId: "c1", kind: "system", at: "2026-01-12T10:00:00Z", author: "System", summary: "Enquiry received via Instagram form" },
  { id: "a2", contactId: "c1", kind: "message", at: "2026-01-12T10:04:00Z", author: "Hannah Wells", summary: "Sent brochure + first reply", channel: "email" },
  { id: "a3", contactId: "c1", kind: "stage_change", at: "2026-01-12T10:05:00Z", author: "Hannah Wells", summary: "Moved to Responded" },
  { id: "a4", contactId: "c1", kind: "stage_change", at: "2026-02-03T18:25:00Z", author: "Hannah Wells", summary: "Moved to Appointment booked" },
  { id: "a5", contactId: "c1", kind: "stage_change", at: "2026-02-21T11:45:00Z", author: "Hannah Wells", summary: "Moved to Appointment attended" },
  { id: "a6", contactId: "c1", kind: "note", at: "2026-02-21T12:30:00Z", author: "Hannah Wells", summary: "Logged a note after the viewing" },
  { id: "a7", contactId: "c1", kind: "message", at: "2026-06-13T15:19:00Z", author: "Hannah Wells", summary: "Sent contract + deposit link", channel: "whatsapp" },
  { id: "a8", contactId: "c1", kind: "stage_change", at: "2026-06-13T15:21:00Z", author: "System", summary: "Moved to Wedding booked — deposit paid" },
  { id: "a9", contactId: "c1", kind: "system", at: "2026-06-13T15:22:00Z", author: "System", summary: "Wedding Workspace created (w1)" },
  { id: "a10", contactId: "c2", kind: "system", at: "2026-03-02T14:00:00Z", author: "System", summary: "Enquiry received via Google" },
  { id: "a11", contactId: "c2", kind: "message", at: "2026-06-11T10:00:00Z", author: "Hannah Wells", summary: "Sent tailored proposal", channel: "email" },
  { id: "a12", contactId: "c2", kind: "stage_change", at: "2026-06-11T10:01:00Z", author: "System", summary: "Moved to Date on hold (7-day hold)" },
  { id: "a13", contactId: "c8", kind: "stage_change", at: "2026-06-11T16:00:00Z", author: "Priya Shah", summary: "Moved to Appointment attended" },
  { id: "a14", contactId: "c8", kind: "note", at: "2026-06-11T16:10:00Z", author: "Priya Shah", summary: "Logged a note — ready to propose" },
];

export function getActivity(contactId: string): ContactActivity[] {
  return ACTIVITIES.filter((a) => a.contactId === contactId);
}

// ---------------------------------------------------------------------------
// Contact tasks
// ---------------------------------------------------------------------------

export interface ContactTask {
  id: string;
  contactId: string;
  label: string;
  done: boolean;
  dueDate: string | null;
  assigneeId: string;
}

export const CONTACT_TASKS: ContactTask[] = [
  { id: "ct1", contactId: "c1", label: "Send welcome pack", done: false, dueDate: "2026-06-20", assigneeId: "u2" },
  { id: "ct2", contactId: "c1", label: "Schedule first planning call", done: false, dueDate: "2026-06-25", assigneeId: "u2" },
  { id: "ct3", contactId: "c1", label: "Chase florist public liability insurance", done: false, dueDate: "2026-07-01", assigneeId: "u2" },
  { id: "ct4", contactId: "c2", label: "Nudge before date hold lapses", done: false, dueDate: "2026-06-15", assigneeId: "u1" },
  { id: "ct5", contactId: "c8", label: "Draft and send proposal", done: false, dueDate: "2026-06-16", assigneeId: "u3" },
  { id: "ct6", contactId: "c8", label: "Call to talk through package options", done: true, dueDate: "2026-06-12", assigneeId: "u3" },
];

export function getContactTasks(contactId: string): ContactTask[] {
  return CONTACT_TASKS.filter((t) => t.contactId === contactId);
}

// ---------------------------------------------------------------------------
// Smart lists (opinionated saved views — not a filter builder)
// ---------------------------------------------------------------------------

export interface SmartList {
  id: string;
  name: string;
  filter: {
    stages?: string[];
    owners?: string[];
    sources?: string[];
    scores?: string[];
    tags?: string[];
    unreadOnly?: boolean;
  };
  count?: number;
}

export const SMART_LISTS: SmartList[] = [
  { id: "sl1", name: "All contacts", filter: {}, count: 14 },
  { id: "sl2", name: "Hot leads", filter: { scores: ["hot"] }, count: 5 },
  { id: "sl3", name: "Unread", filter: { unreadOnly: true }, count: 6 },
  { id: "sl4", name: "Needs first reply", filter: { stages: ["inbound_enquiry"] }, count: 2 },
  { id: "sl5", name: "Proposals out", filter: { stages: ["date_on_hold", "appointment_attended"] }, count: 3 },
  { id: "sl6", name: "Booked", filter: { stages: ["wedding_booked"] }, count: 3 },
  { id: "sl7", name: "My pipeline", filter: { owners: ["u1"] }, count: 6 },
];

// ---------------------------------------------------------------------------
// Reply templates ({{coupleName}} tokens)
// ---------------------------------------------------------------------------

export interface ReplyTemplate {
  id: string;
  label: string;
  channel: Channel | "any";
  body: string;
}

export const REPLY_TEMPLATES: ReplyTemplate[] = [
  { id: "rt1", label: "First reply + brochure", channel: "email", body: "Hi {{coupleName}} — thank you so much for getting in touch! I've attached our brochure. We'd love to show you around — would a weekend viewing suit you?" },
  { id: "rt2", label: "Viewing confirmation", channel: "any", body: "Lovely to speak with you, {{coupleName}}! Your viewing is confirmed. We can't wait to welcome you to The Old Barn — any questions before then, just reply here." },
  { id: "rt3", label: "Proposal follow-up", channel: "whatsapp", body: "Hi {{coupleName}}, just checking you received the proposal okay? Happy to talk anything through — and your date is on hold for you in the meantime. 😊" },
  { id: "rt4", label: "Date hold reminder", channel: "any", body: "Hi {{coupleName}} — a gentle nudge that your date hold is coming to an end soon. Shall I extend it, or would you like to go ahead and secure it?" },
  { id: "rt5", label: "Welcome (just booked)", channel: "email", body: "Welcome to The Old Barn, {{coupleName}}! We're thrilled to be hosting your wedding. Your planning portal is now live — your coordinator will be in touch this week." },
];
