import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getPipelineAggregate } from "@/lib/ghl/reports";
import {
  LeadsByStageChart,
  LeadsBySourceChart,
  ConversionTable,
  GhlPipelineSection,
  PaymentHealthSection,
  type StageRow,
  type SourceRow,
  type ConversionRow,
  type PaymentHealthData,
  type UpcomingMilestoneRow,
  type KpiData,
  KpiCards,
} from "./reports-charts";

export const metadata = { title: "Reports" };

// ── stage ordering ────────────────────────────────────────────────────────────

const STAGE_ORDER = [
  "inbound_enquiry",
  "responded",
  "viewing_interest",
  "appointment_booked",
  "appointment_attended",
  "date_on_hold",
  "wedding_booked",
] as const;

type Stage = (typeof STAGE_ORDER)[number];

function buildConversionRows(stageData: StageRow[]): ConversionRow[] {
  const countByStage: Record<string, number> = {};
  for (const r of stageData) {
    countByStage[r.stage] = r.lead_count;
  }

  const rows: ConversionRow[] = [];
  for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
    const from = STAGE_ORDER[i] as Stage;
    const to = STAGE_ORDER[i + 1] as Stage;
    const fromCount = countByStage[from] ?? 0;
    const toCount = countByStage[to] ?? 0;
    if (fromCount === 0) continue;
    rows.push({
      from_stage: from,
      to_stage: to,
      from_count: fromCount,
      to_count: toCount,
      conversion_pct: (toCount / fromCount) * 100,
    });
  }
  return rows;
}

// ── KPI derivation ────────────────────────────────────────────────────────────

interface MilestoneStatusRow {
  status: string;
  amount_sum: number;
  count: number;
}

interface CoupleAccountRow {
  has_login: boolean;
}

function deriveKpis(params: {
  stageData: StageRow[];
  milestonesByStatus: MilestoneStatusRow[];
  coupleAccounts: CoupleAccountRow[];
  ghlTotalValueMinor: number | null;
  weddingCount: number;
}): KpiData {
  const { stageData, milestonesByStatus, coupleAccounts, ghlTotalValueMinor, weddingCount } =
    params;

  // conversionRate: enquiry → booked
  const countByStage: Record<string, number> = {};
  for (const r of stageData) {
    countByStage[r.stage] = r.lead_count;
  }
  const inbound = countByStage["inbound_enquiry"] ?? 0;
  const booked = countByStage["wedding_booked"] ?? 0;
  const conversionRate = inbound > 0 ? Math.round((booked / inbound) * 100) : 0;

  // bookedRevenueYtd: sum of paid milestones (already a minor-units sum from DB)
  const paidRow = milestonesByStatus.find((r) => r.status === "paid");
  const bookedRevenueYtdMinor = paidRow?.amount_sum ?? 0;

  // onTimePayments: (paid / (paid + overdue)) * 100 — proxy when paid_at absent
  const paidCount = paidRow?.count ?? 0;
  const overdueRow = milestonesByStatus.find((r) => r.status === "overdue");
  const overdueCount = overdueRow?.count ?? 0;
  // TODO: Slice 8 — use paid_at vs due_date for true on-time rate when column exists.
  const onTimePayments =
    paidCount + overdueCount > 0
      ? Math.round((paidCount / (paidCount + overdueCount)) * 100)
      : 100;

  // portalAdoption: accounts with last_login_at not null / total
  const totalAccounts = coupleAccounts.length;
  const activeAccounts = coupleAccounts.filter((a) => a.has_login).length;
  const portalAdoption =
    totalAccounts > 0 ? Math.round((activeAccounts / totalAccounts) * 100) : 0;

  // avgBookingValue: GHL totalValueMinor / wedding count (0 if no GHL)
  const avgBookingValueMinor =
    ghlTotalValueMinor !== null && weddingCount > 0
      ? Math.round(ghlTotalValueMinor / weddingCount)
      : 0;

  return {
    conversionRate,
    bookedRevenueYtdMinor,
    onTimePayments,
    portalAdoption,
    avgBookingValueMinor,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ReportsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const venueId = ctx.venue.id;

  // User-scoped client: the report_* views are security_invoker=on, so RLS on
  // the underlying tables applies to the querying user.
  const supabase = await createClient();

  const [
    stageRes,
    sourceRes,
    paymentRes,
    coupleAccountsRes,
    weddingsRes,
    ghlPipeline,
  ] = await Promise.all([
    // Leads by stage
    supabase
      .from("report_leads_by_stage")
      .select("stage, lead_count")
      .eq("venue_id", venueId)
      .order("lead_count", { ascending: false }),

    // Leads by source
    supabase
      .from("report_leads_by_source")
      .select("source, lead_count")
      .eq("venue_id", venueId)
      .order("lead_count", { ascending: false }),

    // Payment health — status + fields needed for upcoming milestones list
    supabase
      .from("payment_milestones")
      .select("status, amount_minor, due_date, label, wedding_id")
      .eq("venue_id", venueId),

    // Portal adoption
    supabase
      .from("couple_accounts")
      .select("last_login_at")
      .eq("venue_id", venueId),

    // Wedding count (for avgBookingValue denominator)
    supabase
      .from("weddings")
      .select("id")
      .eq("venue_id", venueId)
      .eq("status", "planning"),

    // GHL live pipeline aggregate — null if not connected
    getPipelineAggregate(venueId),
  ]);

  // ── Aggregate payment data ────────────────────────────────────────────────

  const paymentRows = paymentRes.data ?? [];

  // Group payment rows by status client-side
  const statusMap = new Map<string, { amount_sum: number; count: number }>();
  for (const row of paymentRows) {
    const s = row.status as string;
    const existing = statusMap.get(s);
    if (existing) {
      existing.amount_sum += Number(row.amount_minor ?? 0);
      existing.count += 1;
    } else {
      statusMap.set(s, { amount_sum: Number(row.amount_minor ?? 0), count: 1 });
    }
  }
  const milestonesByStatus: MilestoneStatusRow[] = Array.from(statusMap.entries()).map(
    ([status, agg]) => ({ status, ...agg })
  );

  // Upcoming milestones (due, upcoming, overdue) — top 10 by due date
  const upcomingMilestones: UpcomingMilestoneRow[] = paymentRows
    .filter((r) => ["due", "upcoming", "overdue"].includes(r.status as string))
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 10)
    .map((r) => ({
      label: r.label ?? "Milestone",
      amount_minor: Number(r.amount_minor ?? 0),
      due_date: r.due_date ?? "",
      status: r.status as "due" | "upcoming" | "overdue",
      wedding_id: r.wedding_id ?? "",
      couple_names: "",
    }));

  // ── Build typed chart props ───────────────────────────────────────────────

  const stageData: StageRow[] = (stageRes.data ?? []).map((r) => ({
    stage: r.stage as string,
    lead_count: Number(r.lead_count),
  }));

  const sourceDataForChart: SourceRow[] = (sourceRes.data ?? []).map((r) => ({
    source: r.source ?? "Unknown",
    lead_count: Number(r.lead_count),
  }));

  const stageOrdered: StageRow[] = [...stageData].sort(
    (a, b) =>
      STAGE_ORDER.indexOf(a.stage as Stage) - STAGE_ORDER.indexOf(b.stage as Stage)
  );

  const conversionRows = buildConversionRows(stageOrdered);
  const totalLeads = stageData.reduce((sum, r) => sum + r.lead_count, 0);

  const coupleAccountRows: CoupleAccountRow[] = (coupleAccountsRes.data ?? []).map((r) => ({
    has_login: r.last_login_at !== null,
  }));

  const paymentHealthData: PaymentHealthData = {
    collectedMinor: statusMap.get("paid")?.amount_sum ?? 0,
    outstandingMinor:
      (statusMap.get("due")?.amount_sum ?? 0) +
      (statusMap.get("upcoming")?.amount_sum ?? 0),
    overdueMinor: statusMap.get("overdue")?.amount_sum ?? 0,
    upcomingMilestones,
  };

  const weddingCount = weddingsRes.data?.length ?? 0;

  const kpis = deriveKpis({
    stageData,
    milestonesByStatus,
    coupleAccounts: coupleAccountRows,
    ghlTotalValueMinor: ghlPipeline?.totalValueMinor ?? null,
    weddingCount,
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Reports
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Pipeline analytics for {ctx.venue.name}.
        </p>
      </div>

      <div className="space-y-8">
        {/* KPI row */}
        <KpiCards kpis={kpis} />

        {totalLeads === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 shadow-sm max-w-xl">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              No pipeline data yet
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              Lead funnel will appear once you have leads
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Add contacts manually or set up your enquiry form. Stage and source breakdowns
              appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Leads by stage */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Pipeline
                </p>
                <h2 className="mb-5 text-base font-semibold text-foreground">Leads by stage</h2>
                <LeadsByStageChart data={stageOrdered} />
              </div>

              {/* Leads by source */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Acquisition
                </p>
                <h2 className="mb-5 text-base font-semibold text-foreground">Leads by source</h2>
                <LeadsBySourceChart data={sourceDataForChart} />
              </div>
            </div>

            {/* Stage conversion table */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Funnel
              </p>
              <h2 className="mb-5 text-base font-semibold text-foreground">Stage conversion</h2>
              <ConversionTable rows={conversionRows} />
            </div>
          </>
        )}

        {/* GHL Pipeline (live) — graceful degrade when not connected */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Pipeline (live)
          </p>
          <h2 className="mb-5 text-base font-semibold text-foreground">GHL opportunities</h2>
          {ghlPipeline !== null ? (
            <GhlPipelineSection aggregate={ghlPipeline} />
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <p className="text-sm text-muted-foreground">
                Connect GoHighLevel to see live pipeline data.
              </p>
              <Link
                href="/settings/ghl"
                className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Connect GHL
              </Link>
            </div>
          )}
        </div>

        {/* Payment health */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Payments
          </p>
          <h2 className="mb-5 text-base font-semibold text-foreground">Payment health</h2>
          <PaymentHealthSection data={paymentHealthData} />
        </div>
      </div>
    </div>
  );
}
