import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  computeInsights,
  type CopilotInsight,
  type AtRiskWeddingRow,
  type OverdueMilestoneRow,
  type QuietLeadRow,
  type UpcomingRunSheetRow,
} from "@/lib/copilot/insights";

// ── Date helpers (plain JS — no extra dependencies) ──────────────────────────

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

/**
 * computeCopilotInsights — the four-rule copilot data loader, shared by the
 * Copilot page and the Dashboard. Four parallel Supabase queries (one per rule),
 * each falling back to [] on error, fed into the pure computeInsights().
 *
 * Schema note (Rule 4): timeline_events.starts_at_time is a HH:MM string, not a
 * datetime — we approximate "upcoming run-sheet items" via weddings.wedding_date
 * within the next 7 days.
 */
export async function computeCopilotInsights(
  venueId: string,
): Promise<CopilotInsight[]> {
  const supabase = await createClient();

  const in60Days = daysFromNow(60);
  const fourteenDaysAgo = daysAgoIso(14);
  const sevenDaysAgo = daysAgoIso(7);
  const today = todayIso();
  const in7Days = daysFromNow(7);

  const [atRiskRes, overdueRes, quietRes, runSheetRes] = await Promise.all([
    supabase
      .from("weddings")
      .select("id, couple_names, wedding_date, portal_last_seen_at")
      .eq("venue_id", venueId)
      .eq("status", "planning")
      .gte("wedding_date", today)
      .lte("wedding_date", in60Days)
      .or(`portal_last_seen_at.is.null,portal_last_seen_at.lt.${fourteenDaysAgo}`),

    supabase
      .from("payment_milestones")
      .select("id, wedding_id, label, amount_minor, due_date, weddings!inner(couple_names)")
      .eq("venue_id", venueId)
      .in("status", ["due", "overdue"])
      .lt("due_date", today),

    supabase
      .from("couple_accounts")
      .select("wedding_id, invited_at, weddings!inner(couple_names, status)")
      .eq("venue_id", venueId)
      .lt("invited_at", sevenDaysAgo)
      .is("last_login_at", null),

    supabase
      .from("timeline_events")
      .select("id, wedding_id, title, starts_at_time, weddings!inner(couple_names, wedding_date, status)")
      .eq("venue_id", venueId)
      .gte("weddings.wedding_date", today)
      .lte("weddings.wedding_date", in7Days)
      .order("starts_at_time", { ascending: true })
      .limit(5),
  ]);

  const atRiskRows: AtRiskWeddingRow[] = (atRiskRes.data ?? []).map((w) => ({
    id: w.id,
    couple_names: w.couple_names,
    wedding_date: w.wedding_date,
    portal_last_seen_at: w.portal_last_seen_at,
  }));

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
