"use server";

import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/actions";

// ---------------------------------------------------------------------------
// Answer shape — rendered by the answer sheet. No LLM: structured answers are
// composed from real, RLS-scoped DB queries per the spec (v1).
// ---------------------------------------------------------------------------

export type CopilotCategory =
  | "Planning"
  | "Finance"
  | "Pipeline"
  | "Guests";

export interface CopilotAnswerItem {
  label: string;
  meta?: string;
  kind: "done" | "pending" | "warning";
}

export interface CopilotAnswerCard {
  heading: string;
  items: CopilotAnswerItem[];
  cta?: { label: string; href: string };
}

export interface CopilotAnswer {
  intro: string;
  cards: CopilotAnswerCard[];
}

/** YYYY-MM-DD for `date`-typed columns. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function gbp(minor: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const ALL_CLEAR: CopilotAnswerItem = {
  label: "Nothing outstanding — you're all caught up here.",
  kind: "done",
};

/**
 * Answer a Copilot question over the venue's live records.
 *
 * `category` routes to a structured query; `question` is the free-text/label the
 * user picked (kept for the sheet header). All reads go through the RLS session
 * client AND filter by venue_id, so a user can only ever see their own data.
 */
export async function askCopilot(
  category: CopilotCategory,
  question: string,
): Promise<ActionResult<CopilotAnswer>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const venueId = ctx.venue.id;
  const supabase = await createClient();
  const today = isoDate(new Date());

  if (category === "Finance") {
    const { data, error } = await supabase
      .from("payment_milestones")
      .select("label, amount_minor, due_date, status")
      .eq("venue_id", venueId)
      .in("status", ["overdue", "due", "upcoming"])
      .order("due_date", { ascending: true })
      .limit(8);
    if (error) return err("Could not load payments.");

    const rows = data ?? [];
    return ok({
      intro: rows.length
        ? "Outstanding balances, soonest first."
        : "No outstanding balances right now.",
      cards: [
        {
          heading: "Payments",
          items: rows.length
            ? rows.map((p) => ({
                label: `${p.label} — ${gbp(p.amount_minor)}`,
                meta:
                  p.status === "overdue"
                    ? `Overdue since ${formatDate(p.due_date)}`
                    : `Due ${formatDate(p.due_date)}`,
                kind: p.status === "overdue" ? ("warning" as const) : ("pending" as const),
              }))
            : [ALL_CLEAR],
          cta: { label: "Money overview", href: "/money" },
        },
      ],
    });
  }

  if (category === "Planning") {
    const { data, error } = await supabase
      .from("wedding_tasks")
      .select("title, category, due_date")
      .eq("venue_id", venueId)
      .eq("done", false)
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(8);
    if (error) return err("Could not load tasks.");

    const rows = data ?? [];
    return ok({
      intro: rows.length
        ? "Open planning tasks past their due date."
        : "No overdue planning tasks.",
      cards: [
        {
          heading: "Overdue tasks",
          items: rows.length
            ? rows.map((t) => ({
                label: `${t.title} — ${t.category}`,
                meta: t.due_date ? `Due ${formatDate(t.due_date)}` : undefined,
                kind: "warning" as const,
              }))
            : [ALL_CLEAR],
          cta: { label: "Open weddings", href: "/weddings" },
        },
      ],
    });
  }

  if (category === "Pipeline") {
    const fortnightAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
    type Row = {
      stage: string;
      updated_at: string;
      contacts: { first_name: string; last_name: string | null } | null;
    };
    const { data, error } = await supabase
      .from("opportunities")
      .select("stage, updated_at, contacts(first_name, last_name)")
      .eq("venue_id", venueId)
      .is("archived_at", null)
      .lt("updated_at", fortnightAgo)
      .order("updated_at", { ascending: true })
      .limit(8)
      .overrideTypes<Row[]>();
    if (error) return err("Could not load pipeline.");

    const rows = data ?? [];
    return ok({
      intro: rows.length
        ? "Enquiries with no activity in the last 14 days."
        : "No stale enquiries — your pipeline is fresh.",
      cards: [
        {
          heading: "Gone quiet",
          items: rows.length
            ? rows.map((o) => ({
                label: o.contacts
                  ? `${o.contacts.first_name} ${o.contacts.last_name ?? ""}`.trim()
                  : "Enquiry",
                meta: `${o.stage.replace(/_/g, " ")} · last touched ${formatDate(o.updated_at)}`,
                kind: "pending" as const,
              }))
            : [ALL_CLEAR],
          cta: { label: "Open pipeline", href: "/pipeline" },
        },
      ],
    });
  }

  // Guests — outstanding RSVPs
  const { data, error } = await supabase
    .from("wedding_guests")
    .select("name, household_name, wedding_id")
    .eq("venue_id", venueId)
    .eq("rsvp", "pending")
    .limit(8);
  if (error) return err("Could not load guests.");

  const rows = data ?? [];
  return ok({
    intro: rows.length
      ? "Guests who still need to RSVP."
      : "Every guest has responded.",
    cards: [
      {
        heading: "Awaiting RSVP",
        items: rows.length
          ? rows.map((g) => ({
              label: g.name,
              meta: g.household_name ?? undefined,
              kind: "pending" as const,
            }))
          : [ALL_CLEAR],
        cta: { label: "Open weddings", href: "/weddings" },
      },
    ],
  });
}
