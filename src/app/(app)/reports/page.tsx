import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  LeadsByStageChart,
  LeadsBySourceChart,
  ConversionTable,
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

  // User-scoped client: the report_* views are security_invoker=on, so RLS on
  // the underlying opportunities/contacts applies to the querying user. The
  // explicit venue_id filter is belt-and-suspenders on top of that.
  const supabase = await createClient();

  const [stageRes, sourceRes] = await Promise.all([
    supabase
      .from("report_leads_by_stage")
      .select("stage, lead_count")
      .eq("venue_id", ctx.venue.id)
      .order("lead_count", { ascending: false }),
    supabase
      .from("report_leads_by_source")
      .select("source, lead_count")
      .eq("venue_id", ctx.venue.id)
      .order("lead_count", { ascending: false }),
  ]);

  const stageData: StageRow[] = (stageRes.data ?? []).map((r) => ({
    stage: r.stage as string,
    lead_count: Number(r.lead_count),
  }));

  const sourceData: SourceRow[] = (sourceRes.data ?? []).map((r) => ({
    source: r.source,
    lead_count: Number(r.lead_count),
  }));

  // Sort stage data by pipeline order for the bar chart
  const stageOrdered = [...stageData].sort(
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
          Pipeline and source analytics for {ctx.venue.name}.
        </p>
      </div>

      {totalLeads === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm max-w-xl">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            No data yet
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            Reports will appear once you have leads
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Add contacts manually or set up your enquiry form so couples can
            reach you. Stage and source breakdowns will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Row 1: two charts side by side */}
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
              <LeadsBySourceChart data={sourceData} />
            </div>
          </div>

          {/* Row 2: conversion table */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Funnel
            </p>
            <h2 className="mb-5 text-base font-semibold text-foreground">
              Stage conversion
            </h2>
            <ConversionTable rows={conversionRows} />
          </div>
        </div>
      )}
    </div>
  );
}
