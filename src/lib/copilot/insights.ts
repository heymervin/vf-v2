/**
 * Copilot Insights — heuristic rules (no LLM, no new dependency).
 *
 * Each exported function takes pre-fetched rows and returns CopilotInsight[].
 * They are pure functions over plain data so they are testable without a DB.
 *
 * The four rule types:
 *   Rule 1 — at_risk    weddings with soon wedding_date and inactive portal
 *   Rule 2 — action     overdue payment milestones (status='due', due_date in past)
 *   Rule 3 — nudge      couples invited but never logged in (quiet leads)
 *   Rule 4 — nudge      timeline_events on weddings happening within 7 days
 *
 * Schema note (Open Risk 1):
 *   `portal_last_seen_at` exists on `weddings` — confirmed in DB types.
 *   `last_login_at` and `invited_at` exist on `couple_accounts` — confirmed.
 *
 * Schema note for Rule 4:
 *   `timeline_events.starts_at_time` is a HH:MM time string, NOT a timestamp.
 *   There is no `starts_at` datetime column on timeline_events. Upcoming
 *   run-sheet items are surfaced by checking whether the related wedding's
 *   `wedding_date` falls within the next 7 days. The `starts_at_time` is
 *   included in the signal for context.
 */

// ---------------------------------------------------------------------------
// Exported insight type (source of truth — also re-exported from page.tsx)
// ---------------------------------------------------------------------------

export interface CopilotInsight {
  id: string;
  kind: "at_risk" | "action" | "win" | "nudge";
  title: string;
  signal?: string;
  priority: number; // lower = shown first
  dueAt?: string; // ISO string
  actionHref?: string;
  weddingId?: string;
}

// ---------------------------------------------------------------------------
// Row shapes expected from Supabase queries
// ---------------------------------------------------------------------------

export interface AtRiskWeddingRow {
  id: string;
  couple_names: string;
  wedding_date: string | null;
  portal_last_seen_at: string | null;
}

export interface OverdueMilestoneRow {
  id: string;
  wedding_id: string;
  label: string;
  amount_minor: number;
  due_date: string;
  couple_names: string; // joined from weddings
}

export interface QuietLeadRow {
  wedding_id: string;
  invited_at: string | null;
  couple_names: string; // joined from weddings
}

export interface UpcomingRunSheetRow {
  id: string;
  wedding_id: string;
  title: string;
  starts_at_time: string; // HH:MM — see schema note above
  couple_names: string; // joined from weddings
  wedding_date: string | null; // joined from weddings — used to determine "upcoming"
}

// ---------------------------------------------------------------------------
// Rule 1 — At-risk weddings
// ---------------------------------------------------------------------------

/**
 * Weddings in 'planning' status, wedding_date within 60 days,
 * and portal_last_seen_at is null or older than 14 days.
 *
 * The Supabase query (run in page.tsx) handles the date filtering.
 * This function maps the results to CopilotInsight[].
 */
export function buildAtRiskInsights(rows: AtRiskWeddingRow[]): CopilotInsight[] {
  return rows.map((row) => {
    const portalDisplay = row.portal_last_seen_at
      ? new Date(row.portal_last_seen_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "never";

    const weddingDisplay = row.wedding_date
      ? new Date(row.wedding_date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "date TBC";

    return {
      id: `at_risk-${row.id}`,
      kind: "at_risk",
      title: `${row.couple_names} — couple portal inactive`,
      signal: `Wedding on ${weddingDisplay}. Portal last seen: ${portalDisplay}.`,
      priority: 1,
      actionHref: `/weddings/${row.id}`,
      weddingId: row.id,
    };
  });
}

// ---------------------------------------------------------------------------
// Rule 2 — Overdue payment milestones
// ---------------------------------------------------------------------------

/**
 * payment_milestones WHERE status = 'due' AND due_date < today.
 * Joined with weddings to get couple_names.
 */
export function buildOverdueMilestoneInsights(
  rows: OverdueMilestoneRow[],
): CopilotInsight[] {
  return rows.map((row) => {
    const amountGbp = (row.amount_minor / 100).toLocaleString("en-GB", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

    const dueDateDisplay = new Date(row.due_date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return {
      id: `action-${row.id}`,
      kind: "action",
      title: `${row.couple_names} — overdue payment: ${row.label}`,
      signal: `£${amountGbp} was due ${dueDateDisplay}. Mark paid or chase the couple.`,
      priority: 2,
      dueAt: row.due_date,
      actionHref: `/weddings/${row.wedding_id}`,
      weddingId: row.wedding_id,
    };
  });
}

// ---------------------------------------------------------------------------
// Rule 3 — Quiet leads (invited but never logged in)
// ---------------------------------------------------------------------------

/**
 * couple_accounts WHERE invited_at < 7 days ago AND last_login_at IS NULL,
 * joined with weddings WHERE status = 'planning'.
 * Deduplicated by wedding_id (one insight per wedding, not per account row).
 */
export function buildQuietLeadInsights(rows: QuietLeadRow[]): CopilotInsight[] {
  // Deduplicate by wedding_id — if two partners on same wedding, emit once.
  const seen = new Set<string>();
  const deduplicated = rows.filter((row) => {
    if (seen.has(row.wedding_id)) return false;
    seen.add(row.wedding_id);
    return true;
  });

  return deduplicated.map((row) => {
    const invitedDisplay = row.invited_at
      ? new Date(row.invited_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "unknown date";

    return {
      id: `nudge-quiet-${row.wedding_id}`,
      kind: "nudge",
      title: `${row.couple_names} — haven't opened their portal yet`,
      signal: `Invited ${invitedDisplay}. No portal login yet — consider a follow-up.`,
      priority: 3,
      actionHref: `/weddings/${row.wedding_id}`,
      weddingId: row.wedding_id,
    };
  });
}

// ---------------------------------------------------------------------------
// Rule 4 — Upcoming run-sheet items
// ---------------------------------------------------------------------------

/**
 * timeline_events joined with weddings, filtered to weddings with
 * wedding_date within the next 7 days.
 *
 * NOTE: timeline_events has no datetime timestamp — only starts_at_time (HH:MM).
 * The date-proximity filter is applied via the joined wedding_date in page.tsx.
 * The starts_at_time is included in the signal for display.
 */
export function buildUpcomingRunSheetInsights(
  rows: UpcomingRunSheetRow[],
): CopilotInsight[] {
  return rows.map((row) => {
    const weddingDisplay = row.wedding_date
      ? new Date(row.wedding_date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "date TBC";

    return {
      id: `nudge-runsheet-${row.id}`,
      kind: "nudge",
      title: `${row.title} — ${row.couple_names}`,
      signal: `Scheduled for ${row.starts_at_time} on ${weddingDisplay}.`,
      priority: 4,
      dueAt: row.wedding_date ?? undefined,
      actionHref: `/weddings/${row.wedding_id}`,
      weddingId: row.wedding_id,
    };
  });
}

// ---------------------------------------------------------------------------
// Aggregate — run all four rules and sort by priority
// ---------------------------------------------------------------------------

export interface AllInsightRows {
  atRisk: AtRiskWeddingRow[];
  overdueMilestones: OverdueMilestoneRow[];
  quietLeads: QuietLeadRow[];
  upcomingRunSheet: UpcomingRunSheetRow[];
}

/**
 * Combine all four rule results into a single sorted array.
 * Gracefully handles empty/missing data — each rule returns [] on empty input.
 */
export function computeInsights(rows: AllInsightRows): CopilotInsight[] {
  const all: CopilotInsight[] = [
    ...buildAtRiskInsights(rows.atRisk),
    ...buildOverdueMilestoneInsights(rows.overdueMilestones),
    ...buildQuietLeadInsights(rows.quietLeads),
    ...buildUpcomingRunSheetInsights(rows.upcomingRunSheet),
  ];

  return all.sort((a, b) => a.priority - b.priority);
}
