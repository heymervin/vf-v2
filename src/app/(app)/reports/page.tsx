import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { ghlClient } from "@/lib/ghl/client";
import { summariseGhlPipeline, type GhlPipelineSummary } from "@/lib/reports/ghl-pipeline";
import {
  LeadsByStageChart,
  LeadsBySourceChart,
  ConversionTable,
  GhlPipelineSection,
  type StageRow,
  type SourceRow,
  type ConversionRow,
} from "./reports-charts";

export const metadata = { title: "Reports" };

// Ordered pipeline stages for conversion table
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

export default async function ReportsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const venueId = ctx.venue.id;

  // User-scoped client: the report_* views are security_invoker=on, so RLS on
  // the underlying opportunities/contacts applies to the querying user.
  const supabase = await createClient();

  // Fan out all data fetches in parallel. GHL pipeline is best-effort —
  // failures are caught so they never crash the page (graceful degradation).
  const ghlFetchPromise: Promise<GhlPipelineSummary | null> = (async () => {
    try {
      const client = await ghlClient(venueId);
      if (!client) return null;
      const stages = await client.getPipelineCounts();
      return summariseGhlPipeline(stages);
    } catch {
      // GHL unreachable or credentials invalid — degrade silently.
      return null;
    }
  })();

  const [stageRes, sourceRes, ghlSummary] = await Promise.all([
    supabase
      .from("report_leads_by_stage")
      .select("stage, lead_count")
      .eq("venue_id", venueId)
      .order("lead_count", { ascending: false }),
    supabase
      .from("report_leads_by_source")
      .select("source, lead_count")
      .eq("venue_id", venueId)
      .order("lead_count", { ascending: false }),
    ghlFetchPromise,
  ]);

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
      STAGE_ORDER.indexOf(a.stage as Stage) -
      STAGE_ORDER.indexOf(b.stage as Stage),
  );

  const conversionRows = buildConversionRows(stageOrdered);
  const totalLeads = stageData.reduce((sum, r) => sum + r.lead_count, 0);

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
        {totalLeads === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 shadow-sm max-w-xl">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              No pipeline data yet
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              Lead funnel will appear once you have leads
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Add contacts manually or set up your enquiry form. Stage and
              source breakdowns appear here.
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
                <h2 className="mb-5 text-base font-semibold text-foreground">
                  Leads by stage
                </h2>
                <LeadsByStageChart data={stageOrdered} />
              </div>

              {/* Leads by source */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Acquisition
                </p>
                <h2 className="mb-5 text-base font-semibold text-foreground">
                  Leads by source
                </h2>
                <LeadsBySourceChart data={sourceDataForChart} />
              </div>
            </div>

            {/* Stage conversion table */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Funnel
              </p>
              <h2 className="mb-5 text-base font-semibold text-foreground">
                Stage conversion
              </h2>
              <ConversionTable rows={conversionRows} />
            </div>
          </>
        )}

        {/* GHL Pipeline — shown when GHL is connected; hidden otherwise */}
        {ghlSummary !== null && (
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              GoHighLevel
            </p>
            <h2 className="mb-5 text-base font-semibold text-foreground">
              GHL Pipeline
            </h2>
            <GhlPipelineSection summary={ghlSummary} />
          </div>
        )}
      </div>
    </div>
  );
}
