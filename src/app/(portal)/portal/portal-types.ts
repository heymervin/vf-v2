/**
 * Pure mapping helpers: DB rows → the prop shapes PortalClient expects.
 *
 * NOT a server module — no "use server", no DB calls, no secrets. Safe to import
 * from the server page and from unit tests.
 */

import type { Tables } from "@/lib/supabase/types";

// ── Client-facing shapes (mirror portal-client.tsx interfaces) ───────────────

export interface ClientGuest {
  id: string;
  name: string;
  side: "partner1" | "partner2" | "both";
  table: number | null;
  rsvp: "yes" | "no" | "pending";
  dietary: string[];
  plusOne: boolean;
  plusOneName: string | null;
  tags: string[];
  sessionType: "day" | "evening" | "ceremony_only";
}

export interface ClientTask {
  id: string;
  label: string;
  done: boolean;
  dueDate: string | null;
  category: "money" | "planning" | "suppliers" | "admin";
}

export interface ClientPayment {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  status: "paid" | "due" | "upcoming" | "overdue";
  paidOn: string | null;
  receiptUrl: string | null;
}

export interface ClientMenuOption {
  id: string;
  name: string;
  allergens: string[];
  chosenBy: number;
  description: string | null;
  dietaryTags: string[];
}

export interface ClientMenuCourse {
  id: string; // the course key (text) — used as courseId in menuChoices
  course: string;
  options: ClientMenuOption[];
  sortOrder: number;
  isActive: boolean;
}

export interface ClientRunsheetItem {
  id: string;
  time: string;
  title: string;
  category: "ceremony" | "reception" | "catering" | "supplier" | "logistics";
}

export interface ClientDoc {
  id: string;
  name: string;
  kind: "contract" | "insurance" | "invoice" | "supplier" | "other";
  status: string;
  updatedAt: string;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

const RSVP_VALUES = new Set(["yes", "no", "pending"]);
const SESSION_VALUES = new Set(["day", "evening", "ceremony_only"]);
const SIDE_VALUES = new Set(["partner1", "partner2", "both"]);

export function mapGuest(g: Tables<"wedding_guests">): ClientGuest {
  return {
    id: g.id,
    name: g.name,
    side: SIDE_VALUES.has(g.side ?? "")
      ? (g.side as ClientGuest["side"])
      : "both",
    table: g.table_number,
    rsvp: RSVP_VALUES.has(g.rsvp)
      ? (g.rsvp as ClientGuest["rsvp"])
      : "pending",
    dietary: g.dietary ?? [],
    plusOne: g.plus_one,
    plusOneName: g.plus_one_name,
    tags: g.tags ?? [],
    sessionType: SESSION_VALUES.has(g.session_type ?? "")
      ? (g.session_type as ClientGuest["sessionType"])
      : "day",
  };
}

const TASK_CATEGORIES = new Set(["money", "planning", "suppliers", "admin"]);

export function mapTask(t: Tables<"wedding_tasks">): ClientTask {
  return {
    id: t.id,
    label: t.title,
    done: t.done,
    dueDate: t.due_date,
    category: TASK_CATEGORIES.has(t.category)
      ? (t.category as ClientTask["category"])
      : "planning",
  };
}

const PAYMENT_STATUSES = new Set(["paid", "due", "upcoming", "overdue"]);

export function mapPayment(p: Tables<"payment_milestones">): ClientPayment {
  return {
    id: p.id,
    label: p.label,
    amount: p.amount_minor / 100,
    dueDate: p.due_date,
    status: PAYMENT_STATUSES.has(p.status)
      ? (p.status as ClientPayment["status"])
      : "upcoming",
    paidOn: p.paid_on,
    receiptUrl: p.receipt_url,
  };
}

const RUNSHEET_CATEGORIES = new Set([
  "ceremony",
  "reception",
  "catering",
  "supplier",
  "logistics",
]);

export function mapRunsheetItem(
  e: Tables<"timeline_events">,
): ClientRunsheetItem {
  return {
    id: e.id,
    time: e.starts_at_time,
    title: e.title,
    category: RUNSHEET_CATEGORIES.has(e.category)
      ? (e.category as ClientRunsheetItem["category"])
      : "logistics",
  };
}

const DOC_KINDS = new Set([
  "contract",
  "insurance",
  "invoice",
  "supplier",
  "other",
]);

export function mapDoc(d: Tables<"wedding_documents">): ClientDoc {
  return {
    id: d.id,
    name: d.name ?? "Document",
    kind: DOC_KINDS.has(d.kind ?? "")
      ? (d.kind as ClientDoc["kind"])
      : "other",
    status: d.signed_at ? "signed" : "sent",
    updatedAt: d.updated_at,
  };
}

/**
 * Group active venue menu items by course into the MenuCourse shape. The course
 * key (text) is used as the course id so menu selections (also keyed by course)
 * line up. Items within a course keep their sort_order; courses are ordered by
 * the minimum sort_order of their items.
 */
export function groupMenuByCourse(
  items: Tables<"menu_items">[],
  chosenByMap: Map<string, number>,
): ClientMenuCourse[] {
  const byCourse = new Map<string, ClientMenuOption[]>();
  const courseMinSort = new Map<string, number>();

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  for (const item of sorted) {
    if (!item.is_active) continue;
    const list = byCourse.get(item.course) ?? [];
    list.push({
      id: item.id,
      name: item.name,
      allergens: item.allergens ?? [],
      chosenBy: chosenByMap.get(item.id) ?? 0,
      description: item.description,
      dietaryTags: item.dietary_tags ?? [],
    });
    byCourse.set(item.course, list);
    if (!courseMinSort.has(item.course)) {
      courseMinSort.set(item.course, item.sort_order);
    }
  }

  return [...byCourse.entries()]
    .map(([course, options], idx) => ({
      id: course,
      course,
      options,
      sortOrder: courseMinSort.get(course) ?? idx,
      isActive: true,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Split a "couple_names" string ("Emma Henderson & James Carter") into the two
 * partner first names the hero greeting uses.
 */
export function splitCoupleNames(coupleNames: string): {
  partner1First: string;
  partner2First: string;
} {
  const parts = coupleNames
    .split(/\s*(?:&|and|\+)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const first = (full: string | undefined, fallback: string) =>
    full?.split(/\s+/)[0] ?? fallback;
  return {
    partner1First: first(parts[0], "Partner 1"),
    partner2First: first(parts[1], "Partner 2"),
  };
}

/** Whole days from today (UTC-safe, calendar-day granularity) to an ISO date. */
export function daysUntil(isoDate: string | null, today = new Date()): number {
  if (!isoDate) return 0;
  const target = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).getTime();
  const start = new Date(
    `${today.toISOString().slice(0, 10)}T00:00:00Z`,
  ).getTime();
  return Math.round((target - start) / 86_400_000);
}

/** "22 May 2027" */
export function formatLongDate(isoDate: string | null): string {
  if (!isoDate) return "Date to be confirmed";
  return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  );
}
