import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { CopilotTriage } from "./copilot-triage";
import {
  computeInsights,
  type CopilotInsight,
  type AtRiskWeddingRow,
  type OverdueMilestoneRow,
  type QuietLeadRow,
  type UpcomingRunSheetRow,
} from "@/lib/copilot/insights";

export const metadata = { title: "Copilot" };

// ---------------------------------------------------------------------------
// Date helpers (avoid extra dependencies — plain JS is fine here)
// ---------------------------------------------------------------------------

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Main data loader — four parallel Supabase queries, one per rule
//
// Schema note for Rule 4:
//   timeline_events.starts_at_time is a HH:MM string, NOT a datetime column.
//   There is no starts_at timestamp on timeline_events — confirmed in DB types.
//   We approximate "upcoming run-sheet items" by joining weddings and filtering
//   on wedding_date BETWEEN today AND today+7days instead.
// ---------------------------------------------------------------------------

async function computeCopilotInsights(venueId: string): Promise<CopilotInsight[]> {
  const supabase = await createClient();

  const in60Days = daysFromNow(60);
  const fourteenDaysAgo = daysAgoIso(14);
  const sevenDaysAgo = daysAgoIso(7);
  const today = todayIso();
  const in7Days = daysFromNow(7);

  // Run all four queries in parallel — gracefully handle errors by falling back to [].
  const [atRiskRes, overdueRes, quietRes, runSheetRes] = await Promise.all([
    // Rule 1 — At-risk weddings:
    //   status='planning', wedding_date within 60 days,
    //   portal_last_seen_at NULL or older than 14 days
    supabase
      .from("weddings")
      .select("id, couple_names, wedding_date, portal_last_seen_at")
      .eq("venue_id", venueId)
      .eq("status", "planning")
      .gte("wedding_date", today)
      .lte("wedding_date", in60Days)
      .or(`portal_last_seen_at.is.null,portal_last_seen_at.lt.${fourteenDaysAgo}`),

    // Rule 2 — Overdue payment milestones:
    //   the canonical stored 'overdue' status (set by GHL balance-due sync /
    //   manually) OR a 'due' milestone whose date has already passed.
    //   Join weddings for couple_names.
    supabase
      .from("payment_milestones")
      .select("id, wedding_id, label, amount_minor, due_date, weddings!inner(couple_names)")
      .eq("venue_id", venueId)
      .in("status", ["due", "overdue"])
      .lt("due_date", today),

    // Rule 3 — Quiet leads:
    //   couple_accounts invited >7 days ago, never logged in,
    //   join weddings WHERE status='planning'
    supabase
      .from("couple_accounts")
      .select("wedding_id, invited_at, weddings!inner(couple_names, status)")
      .eq("venue_id", venueId)
      .lt("invited_at", sevenDaysAgo)
      .is("last_login_at", null),

    // Rule 4 — Upcoming run-sheet items on weddings happening within 7 days:
    //   (timeline_events has no datetime timestamp — see schema note above)
    //   Join weddings and filter wedding_date within next 7 days.
    supabase
      .from("timeline_events")
      .select("id, wedding_id, title, starts_at_time, weddings!inner(couple_names, wedding_date, status)")
      .eq("venue_id", venueId)
      .gte("weddings.wedding_date", today)
      .lte("weddings.wedding_date", in7Days)
      .order("starts_at_time", { ascending: true })
      .limit(5),
  ]);

  // Map rule 1 results — safe fallback to []
  const atRiskRows: AtRiskWeddingRow[] = (atRiskRes.data ?? []).map((w) => ({
    id: w.id,
    couple_names: w.couple_names,
    wedding_date: w.wedding_date,
    portal_last_seen_at: w.portal_last_seen_at,
  }));

  // Map rule 2 results — flatten joined weddings row
  const overdueRows: OverdueMilestoneRow[] = (overdueRes.data ?? []).flatMap((m) => {
    const wedding = Array.isArray(m.weddings) ? m.weddings[0] : m.weddings;
    if (!wedding) return [];
    return [
      {
        id: m.id,
        wedding_id: m.wedding_id,
        label: m.label,
        amount_minor: m.amount_minor,
        due_date: m.due_date,
        couple_names: wedding.couple_names,
      },
    ];
  });

  // Map rule 3 results — filter to planning weddings only (belt-and-suspenders),
  // deduplicate by wedding_id handled inside buildQuietLeadInsights
  const quietRows: QuietLeadRow[] = (quietRes.data ?? []).flatMap((ca) => {
    const wedding = Array.isArray(ca.weddings) ? ca.weddings[0] : ca.weddings;
    if (!wedding || wedding.status !== "planning") return [];
    return [
      {
        wedding_id: ca.wedding_id,
        invited_at: ca.invited_at,
        couple_names: wedding.couple_names,
      },
    ];
  });

  // Map rule 4 results — flatten joined weddings row
  const runSheetRows: UpcomingRunSheetRow[] = (runSheetRes.data ?? []).flatMap((te) => {
    const wedding = Array.isArray(te.weddings) ? te.weddings[0] : te.weddings;
    if (!wedding) return [];
    return [
      {
        id: te.id,
        wedding_id: te.wedding_id,
        title: te.title,
        starts_at_time: te.starts_at_time,
        couple_names: wedding.couple_names,
        wedding_date: wedding.wedding_date,
      },
    ];
  });

  return computeInsights({
    atRisk: atRiskRows,
    overdueMilestones: overdueRows,
    quietLeads: quietRows,
    upcomingRunSheet: runSheetRows,
  });
}

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------

export default async function CopilotPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const insights = await computeCopilotInsights(ctx.venue.id);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Copilot"
        subtitle="Ranked by priority. Act on what matters most."
        shimmer={false}
      />

      <div className="max-w-2xl">
        <CopilotTriage insights={insights} />
      </div>
    </div>
  );
}
