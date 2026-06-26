"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { AlertCircle, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineAggregate } from "@/lib/ghl/reports";

// ── Shared palette (matches DESIGN.md fun-pastels, strong variants for bars)
const STAGE_COLOR = "oklch(0.584 0.152 272)"; // fun-blue-strong
const SOURCE_COLORS = [
  "oklch(0.703 0.189 319)", // fun-pink-strong
  "oklch(0.584 0.152 272)", // fun-blue-strong
  "oklch(0.774 0.161 135)", // fun-green-strong
  "oklch(0.731 0.1 194)", // fun-teal-strong
  "oklch(0.477 0.09 76)", // warning-foreground (amber)
  "oklch(0.541 0.061 271)", // muted-foreground (navy)
];

// ── Exported row types (consumed by page.tsx) ─────────────────────────────────

export interface StageRow {
  stage: string;
  lead_count: number;
}

export interface SourceRow {
  source: string;
  lead_count: number;
}

export interface ConversionRow {
  from_stage: string;
  to_stage: string;
  from_count: number;
  to_count: number;
  conversion_pct: number;
}

export type MilestoneStatus = "paid" | "due" | "upcoming" | "overdue";

export interface UpcomingMilestoneRow {
  label: string;
  amount_minor: number;
  due_date: string;
  status: MilestoneStatus;
  wedding_id: string;
  couple_names: string;
}

export interface PaymentHealthData {
  collectedMinor: number;
  outstandingMinor: number;
  overdueMinor: number;
  upcomingMilestones: UpcomingMilestoneRow[];
}

export interface KpiData {
  conversionRate: number;
  bookedRevenueYtdMinor: number;
  onTimePayments: number;
  portalAdoption: number;
  avgBookingValueMinor: number;
}

// ── GBP formatter ─────────────────────────────────────────────────────────────

function gbp(minor: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

// ── Friendly stage label map ──────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  inbound_enquiry: "Enquiry",
  responded: "Responded",
  viewing_interest: "Viewing Interest",
  appointment_booked: "Appt Booked",
  appointment_attended: "Appt Attended",
  date_on_hold: "Date on Hold",
  wedding_booked: "Booked",
  archived: "Archived",
};

// ── KPI cards ─────────────────────────────────────────────────────────────────

interface KpiCardsProps {
  kpis: KpiData;
}

export function KpiCards({ kpis }: KpiCardsProps) {
  const items = [
    {
      label: "Conversion rate",
      value: `${kpis.conversionRate}%`,
      note: "enquiry → booked",
    },
    {
      label: "Avg booking value",
      value: kpis.avgBookingValueMinor > 0 ? gbp(kpis.avgBookingValueMinor) : "—",
      note: kpis.avgBookingValueMinor > 0 ? "from pipeline" : "Connect VenueFlow",
    },
    {
      label: "Booked revenue YTD",
      value: gbp(kpis.bookedRevenueYtdMinor),
      note: "paid milestones",
    },
    {
      label: "On-time payments",
      value: `${kpis.onTimePayments}%`,
      note: "paid vs overdue",
    },
    {
      label: "Portal adoption",
      value: `${kpis.portalAdoption}%`,
      note: "booked couples",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((k) => (
        <div
          key={k.label}
          className="rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {k.label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {k.value}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{k.note}</p>
        </div>
      ))}
    </div>
  );
}

// ── Leads by stage — bar chart ────────────────────────────────────────────────

interface LeadsByStageChartProps {
  data: StageRow[];
}

export function LeadsByStageChart({ data }: LeadsByStageChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No pipeline data yet.
      </p>
    );
  }

  const formatted = data.map((r) => ({
    stage: STAGE_LABELS[r.stage] ?? r.stage,
    count: r.lead_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.899 0.013 273)" />
        <XAxis
          dataKey="stage"
          tick={{ fontSize: 11, fill: "oklch(0.541 0.061 271)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "oklch(0.541 0.061 271)" }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "0.5rem",
            border: "1px solid oklch(0.899 0.013 273)",
            fontSize: 12,
          }}
          cursor={{ fill: "oklch(0.933 0.008 273)" }}
        />
        <Bar dataKey="count" name="Leads" fill={STAGE_COLOR} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Leads by source — pie chart ───────────────────────────────────────────────

interface LeadsBySourceChartProps {
  data: SourceRow[];
}

export function LeadsBySourceChart({ data }: LeadsBySourceChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No source data yet.
      </p>
    );
  }

  const formatted = data.map((r) => ({
    name: r.source,
    value: r.lead_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={formatted}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={40}
          paddingAngle={2}
          label={({ name, percent }) =>
            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {formatted.map((_entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={SOURCE_COLORS[index % SOURCE_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: "0.5rem",
            border: "1px solid oklch(0.899 0.013 273)",
            fontSize: 12,
          }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Stage conversion table ────────────────────────────────────────────────────

interface ConversionTableProps {
  rows: ConversionRow[];
}

export function ConversionTable({ rows }: ConversionTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Not enough pipeline data to calculate conversions.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <th className="pb-3 pr-6">From stage</th>
            <th className="pb-3 pr-6">To stage</th>
            <th className="pb-3 pr-6 text-right">Leads in</th>
            <th className="pb-3 pr-6 text-right">Leads out</th>
            <th className="pb-3 text-right">Conversion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="py-3 pr-6 text-foreground">
                {STAGE_LABELS[r.from_stage] ?? r.from_stage}
              </td>
              <td className="py-3 pr-6 text-foreground">
                {STAGE_LABELS[r.to_stage] ?? r.to_stage}
              </td>
              <td className="py-3 pr-6 text-right tabular-nums text-foreground">
                {r.from_count}
              </td>
              <td className="py-3 pr-6 text-right tabular-nums text-foreground">
                {r.to_count}
              </td>
              <td className="py-3 text-right tabular-nums font-semibold text-foreground">
                {r.conversion_pct.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── GHL Pipeline section ──────────────────────────────────────────────────────

interface GhlPipelineSectionProps {
  aggregate: PipelineAggregate;
}

export function GhlPipelineSection({ aggregate }: GhlPipelineSectionProps) {
  if (aggregate.stages.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No open opportunities found in this pipeline.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <th className="pb-3 pr-6">Stage</th>
              <th className="pb-3 pr-6 text-right">Count</th>
              <th className="pb-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {aggregate.stages.map((s) => (
              <tr key={s.pipelineStageId} className="border-b border-border/50 last:border-0">
                <td className="py-3 pr-6 text-foreground font-medium">{s.stageName}</td>
                <td className="py-3 pr-6 text-right tabular-nums text-foreground">
                  {s.count}
                </td>
                <td className="py-3 text-right tabular-nums font-semibold text-foreground">
                  {gbp(s.valueMinor)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td className="pt-3 pr-6 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Total
              </td>
              <td className="pt-3 pr-6 text-right tabular-nums text-sm font-semibold text-foreground">
                {aggregate.totalCount}
              </td>
              <td className="pt-3 text-right tabular-nums text-sm font-semibold text-foreground">
                {gbp(aggregate.totalValueMinor)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Payment health section ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  MilestoneStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  paid: {
    label: "Paid",
    className: "bg-fun-green text-foreground",
    icon: <CheckCircle2 className="size-3" />,
  },
  due: {
    label: "Due",
    className: "bg-warning text-warning-foreground",
    icon: <Clock className="size-3" />,
  },
  upcoming: {
    label: "Upcoming",
    className: "bg-fun-blue text-foreground",
    icon: <TrendingUp className="size-3" />,
  },
  overdue: {
    label: "Overdue",
    className: "bg-destructive/15 text-destructive",
    icon: <AlertCircle className="size-3" />,
  },
};

interface PaymentHealthSectionProps {
  data: PaymentHealthData;
}

export function PaymentHealthSection({ data }: PaymentHealthSectionProps) {
  const total = data.collectedMinor + data.outstandingMinor + data.overdueMinor;
  const collectedPct = total > 0 ? Math.round((data.collectedMinor / total) * 100) : 0;
  const outstandingPct = total > 0 ? Math.round((data.outstandingMinor / total) * 100) : 0;
  const overduePct = total > 0 ? Math.round((data.overdueMinor / total) * 100) : 0;

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No payment milestones yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Summary */}
      <div className="space-y-4">
        {/* Stacked bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          <div
            className="bg-fun-green-strong transition-all"
            style={{ width: `${collectedPct}%` }}
            title={`Collected: ${collectedPct}%`}
          />
          {data.overdueMinor > 0 && (
            <div
              className="bg-destructive transition-all"
              style={{ width: `${overduePct}%` }}
              title="Overdue"
            />
          )}
          <div
            className="bg-muted transition-all"
            style={{ width: `${outstandingPct}%` }}
            title={`Outstanding: ${outstandingPct}%`}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Collected
            </p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {gbp(data.collectedMinor)}
            </p>
            <p className="text-xs text-muted-foreground">{collectedPct}% of total</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Outstanding
            </p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {gbp(data.outstandingMinor)}
            </p>
            <p className="text-xs text-muted-foreground">{outstandingPct}% of total</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Overdue
            </p>
            <p
              className={cn(
                "text-lg font-semibold tabular-nums",
                data.overdueMinor > 0 ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {gbp(data.overdueMinor)}
            </p>
            {data.overdueMinor > 0 && (
              <p className="text-xs text-destructive">Needs chasing</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming milestones list */}
      {data.upcomingMilestones.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Upcoming milestones
          </p>
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {data.upcomingMilestones.map((p, i) => {
              const cfg = STATUS_CONFIG[p.status];
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 px-3 py-3 min-h-[44px] hover:bg-accent/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {p.couple_names || p.label}
                    </p>
                    {p.due_date && (
                      <p className="text-xs text-muted-foreground truncate">
                        {p.label} · due{" "}
                        {new Date(p.due_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums text-sm font-semibold text-foreground">
                      {gbp(p.amount_minor)}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        cfg.className
                      )}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// TODO: Slice 9 — team performance (requires stage_events attribution per member)
