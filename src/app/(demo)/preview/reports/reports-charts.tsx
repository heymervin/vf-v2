"use client";

/**
 * ReportsCharts — client component for all recharts visualisations on the
 * Reports page. Receives data as props from the server page so recharts
 * (which uses ResponsiveContainer / SVG / browser APIs) is isolated here.
 *
 * v2: extended with pacing chart, capacity utilisation, payment health, team
 * performance table, and period-aware KPI cards via MetricCard.
 */

import * as React from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/metric-card";
import { SortableTable, type SortableColumn } from "@/components/sortable-table";
import { DataToolbar } from "@/components/data-toolbar";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import {
  REPORTS,
  TEAM,
  type MilestoneStatus,
} from "@/lib/mock";
import { BENCHMARKS, REPORT_PERIODS, getReportPeriod, type ReportPeriod } from "@/lib/mock/reports-data";

// ---------------------------------------------------------------------------
// Types matching REPORTS structure
// ---------------------------------------------------------------------------

interface FunnelEntry {
  stage: string;
  value: number;
}

interface RevenueEntry {
  month: string;
  booked: number;
}

interface SourceRoiEntry {
  source: string;
  enquiries: number;
  booked: number;
  revenue: number;
  spend?: number;
  cac?: number;
}

interface PacingEntry {
  month: string;
  booked: number;
  held: number;
  target: number;
}

interface CapacityEntry {
  month: string;
  availableSaturdays: number;
  bookedSaturdays: number;
  allDates: number;
  bookedDates: number;
}

interface TeamPerformanceEntry {
  memberId: string;
  enquiries: number;
  viewings: number;
  booked: number;
  revenue: number;
  avgFirstResponseMins: number;
  conversionRate: number;
}

interface PaymentUpcoming {
  weddingId: string;
  coupleName: string;
  label: string;
  amount: number;
  dueDate: string;
  status: MilestoneStatus;
}

interface PaymentHealth {
  collected: number;
  outstanding: number;
  overdue: number;
  upcoming: PaymentUpcoming[];
}

interface KpisSnapshot {
  conversionRate: number;
  avgBookingValue: number;
  avgFirstResponseMins: number;
  bookedRevenueYtd: number;
  onTimePayments: number;
  portalAdoption: number;
}

// ---------------------------------------------------------------------------
// GBP formatter (safe to derive client-side)
// ---------------------------------------------------------------------------

function gbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Chart colour palette — maps to CSS vars defined in globals.css
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

// ---------------------------------------------------------------------------
// Shared tooltip shell
// ---------------------------------------------------------------------------

function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs text-foreground">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip renderers — typed as unknown and narrowed to avoid recharts import
// ---------------------------------------------------------------------------

function renderRevenueTooltip(props: unknown) {
  const p = props as { active?: boolean; payload?: { value?: number }[]; label?: string };
  if (!p.active || !p.payload?.length) return null;
  return (
    <TooltipBox>
      <p className="font-semibold mb-0.5">{p.label}</p>
      <p className="tabular-nums text-muted-foreground">{gbp(p.payload[0]?.value ?? 0)}</p>
    </TooltipBox>
  );
}

function renderSourceTooltip(props: unknown) {
  const p = props as { active?: boolean; payload?: { value?: number }[]; label?: string };
  if (!p.active || !p.payload?.length) return null;
  return (
    <TooltipBox>
      <p className="font-semibold mb-0.5">{p.label}</p>
      <p className="tabular-nums text-muted-foreground">{gbp(p.payload[0]?.value ?? 0)}</p>
    </TooltipBox>
  );
}

function renderPacingTooltip(props: unknown) {
  const p = props as {
    active?: boolean;
    payload?: { name?: string; value?: number; color?: string }[];
    label?: string;
  };
  if (!p.active || !p.payload?.length) return null;
  return (
    <TooltipBox>
      <p className="font-semibold mb-1">{p.label}</p>
      {p.payload.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 tabular-nums">
          <span
            className="inline-block size-2 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted-foreground capitalize">{item.name}:</span>
          <span className="font-medium">{item.value}</span>
        </div>
      ))}
    </TooltipBox>
  );
}

// ---------------------------------------------------------------------------
// KPI section — MetricCard row driven by the active period
// ---------------------------------------------------------------------------

interface KpiSectionProps {
  kpis: KpisSnapshot;
  kpisPrev: KpisSnapshot;
  period: ReportPeriod;
}

function fmtDelta(curr: number, prev: number, isMin = false): {
  value: string;
  direction: "up" | "down";
  good: boolean;
} {
  const diff = curr - prev;
  const direction: "up" | "down" = diff >= 0 ? "up" : "down";
  const absStr = Math.abs(diff) < 1 ? Math.abs(diff).toFixed(1) : Math.round(Math.abs(diff)).toString();
  // For response time, lower = better
  const good = isMin ? direction === "down" : direction === "up";
  return { value: absStr, direction, good };
}

function KpiSection({ kpis, kpisPrev }: KpiSectionProps) {
  const convDelta = fmtDelta(kpis.conversionRate, kpisPrev.conversionRate);
  const abvDelta = fmtDelta(kpis.avgBookingValue, kpisPrev.avgBookingValue);
  const responseDelta = fmtDelta(kpis.avgFirstResponseMins, kpisPrev.avgFirstResponseMins, true);
  const revDelta = fmtDelta(kpis.bookedRevenueYtd, kpisPrev.bookedRevenueYtd);
  const onTimeDelta = fmtDelta(kpis.onTimePayments, kpisPrev.onTimePayments);
  const portalDelta = fmtDelta(kpis.portalAdoption, kpisPrev.portalAdoption);

  const convBenchmark =
    kpis.conversionRate >= BENCHMARKS.conversion.good
      ? "good"
      : kpis.conversionRate >= BENCHMARKS.conversion.watch
        ? "watch"
        : "bad";

  const responseBenchmark =
    kpis.avgFirstResponseMins <= BENCHMARKS.firstResponseMins.good
      ? "good"
      : kpis.avgFirstResponseMins <= BENCHMARKS.firstResponseMins.watch
        ? "watch"
        : "bad";

  const onTimeBenchmark =
    kpis.onTimePayments >= BENCHMARKS.onTimePayments.good
      ? "good"
      : kpis.onTimePayments >= BENCHMARKS.onTimePayments.watch
        ? "watch"
        : "bad";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <MetricCard
        label="Conversion rate"
        value={`${kpis.conversionRate}%`}
        delta={{ ...convDelta, value: `${convDelta.value}%` }}
        series={REPORTS.sparklines.conversionRate}
        benchmark={convBenchmark}
        note="enquiry → booked"
      />
      <MetricCard
        label="Avg booking value"
        value={gbp(kpis.avgBookingValue)}
        delta={{ ...abvDelta, value: `£${abvDelta.value}` }}
        series={REPORTS.sparklines.avgBookingValue}
        note="per wedding"
      />
      <MetricCard
        label="Avg first response"
        value={`${kpis.avgFirstResponseMins} min`}
        delta={{ ...responseDelta, value: `${responseDelta.value} min` }}
        series={REPORTS.sparklines.avgFirstResponseMins}
        benchmark={responseBenchmark}
        note="any channel"
      />
      <MetricCard
        label="Booked revenue"
        value={gbp(kpis.bookedRevenueYtd)}
        delta={{ ...revDelta, value: `£${(Math.abs(kpis.bookedRevenueYtd - kpisPrev.bookedRevenueYtd) / 1000).toFixed(0)}k` }}
        series={REPORTS.sparklines.bookedRevenueYtd}
        note="this period"
      />
      <MetricCard
        label="On-time payments"
        value={`${kpis.onTimePayments}%`}
        delta={{ ...onTimeDelta, value: `${onTimeDelta.value}%` }}
        series={REPORTS.sparklines.onTimePayments}
        benchmark={onTimeBenchmark}
        note="auto-reminders"
      />
      <MetricCard
        label="Portal adoption"
        value={`${kpis.portalAdoption}%`}
        delta={{ ...portalDelta, value: `${portalDelta.value}%` }}
        series={REPORTS.sparklines.portalAdoption}
        note="booked couples"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forward Booking Pacing chart — booked / held / target by month (P0)
// ---------------------------------------------------------------------------

function PacingSection({ data }: { data: PacingEntry[] }) {
  const belowTarget = data.filter(
    (d) => d.booked + d.held < d.target,
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">
              Forward booking pacing
            </CardTitle>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-1">
              Booked · held · target — next 18 months
            </p>
          </div>
          {belowTarget.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/70 px-2.5 py-1 text-[11px] font-semibold text-warning-foreground">
              <AlertCircle className="size-3 shrink-0" />
              {belowTarget.length} months below target
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Horizontal scroll on narrow viewports */}
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="min-w-[600px]">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart
                data={data}
                margin={{ top: 4, right: 4, left: -8, bottom: 0 }}
                barGap={2}
                barCategoryGap="22%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontFamily: "inherit" }}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "inherit" }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                  allowDecimals={false}
                />
                <Tooltip content={renderPacingTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) =>
                    <span style={{ color: "var(--muted-foreground)", textTransform: "capitalize" }}>{value}</span>
                  }
                />
                <Bar dataKey="booked" name="booked" stackId="a" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="held" name="held" stackId="a" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="target"
                  stroke="var(--destructive)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Legend explainer */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-[var(--chart-1)]" />
            Confirmed bookings
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-[var(--chart-4)]" />
            Dates on hold (unconfirmed)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t border-dashed border-destructive" />
            Monthly target
          </div>
        </div>

        {/* Gap alert list */}
        {belowTarget.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Months needing attention
            </p>
            <div className="flex flex-wrap gap-2">
              {belowTarget.map((d) => {
                const gap = d.target - d.booked - d.held;
                return (
                  <span
                    key={d.month}
                    className="inline-flex items-center gap-1 rounded-full bg-warning/60 px-2.5 py-0.5 text-xs font-medium text-warning-foreground tabular-nums"
                  >
                    {d.month}: {gap < 0 ? "0" : gap} short
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Funnel section
// ---------------------------------------------------------------------------

function FunnelSection({ data }: { data: FunnelEntry[] }) {
  const max = data[0]?.value ?? 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">
          Enquiry funnel
        </CardTitle>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-1">
          Lead source to booked — drop-off by stage
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {data.map((entry, i) => {
            const pct = (entry.value / max) * 100;
            const dropPct =
              i > 0
                ? Math.round(
                    ((data[i - 1].value - entry.value) / data[i - 1].value) *
                      100,
                  )
                : null;

            return (
              <div
                key={entry.stage}
                className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 sm:grid-cols-[10rem_1fr_auto]"
              >
                <span className="text-sm text-foreground font-medium truncate">
                  {entry.stage}
                </span>
                <div className="h-6 rounded-md bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor:
                        CHART_COLORS[Math.min(i, CHART_COLORS.length - 1)],
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 justify-end min-w-[5.5rem]">
                  <span className="tabular-nums text-sm font-semibold text-foreground">
                    {entry.value}
                  </span>
                  {dropPct !== null && (
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                      -{dropPct}%
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-lg bg-fun-green/60 px-3 py-2">
          <span
            className="mt-px shrink-0 size-2 rounded-full bg-fun-green-strong"
            aria-hidden="true"
          />
          <p className="text-xs text-foreground leading-relaxed">
            <span className="font-semibold tabular-nums">
              {data[data.length - 1]?.value ?? 0}
            </span>{" "}
            of{" "}
            <span className="font-semibold tabular-nums">{data[0]?.value ?? 0}</span>{" "}
            enquiries converted to bookings —{" "}
            <span className="font-semibold tabular-nums">
              {Math.round(
                ((data[data.length - 1]?.value ?? 0) /
                  (data[0]?.value ?? 1)) *
                  100,
              )}
              %
            </span>{" "}
            end-to-end conversion
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Revenue by month — area chart
// ---------------------------------------------------------------------------

function RevenueSection({ data }: { data: RevenueEntry[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">
          Booked revenue by month
        </CardTitle>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-1">
          Period breakdown
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={CHART_COLORS[0]}
                  stopOpacity={0.18}
                />
                <stop
                  offset="95%"
                  stopColor={CHART_COLORS[0]}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{
                fontSize: 11,
                fill: "var(--muted-foreground)",
                fontFamily: "inherit",
              }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`}
              tick={{
                fontSize: 11,
                fill: "var(--muted-foreground)",
                fontFamily: "inherit",
              }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={renderRevenueTooltip}
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="booked"
              stroke={CHART_COLORS[0]}
              strokeWidth={2}
              fill="url(#revenueGrad)"
              dot={false}
              activeDot={{
                r: 4,
                fill: CHART_COLORS[0],
                stroke: "var(--card)",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Source ROI — bar chart of revenue by source
// ---------------------------------------------------------------------------

function SourceRevenueChart({ data }: { data: SourceRoiEntry[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
        barSize={28}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis
          dataKey="source"
          tick={{
            fontSize: 11,
            fill: "var(--muted-foreground)",
            fontFamily: "inherit",
          }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`}
          tick={{
            fontSize: 11,
            fill: "var(--muted-foreground)",
            fontFamily: "inherit",
          }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          content={renderSourceTooltip}
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
        />
        <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
          {data.map((_entry, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SourceRoiSection({ data }: { data: SourceRoiEntry[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">
          Source ROI
        </CardTitle>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-1">
          Enquiries, bookings and revenue by lead source
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <SourceRevenueChart data={data} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {(
                    ["Source", "Enquiries", "Booked", "Conv.", "Revenue", "CAC"] as const
                  ).map((h) => (
                    <th
                      key={h}
                      className={cn(
                        "pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
                        h === "Source" ? "pr-4 text-left" : "pl-2 text-right",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((row, i) => {
                  const conv = Math.round((row.booked / row.enquiries) * 100);
                  return (
                    <tr
                      key={row.source}
                      className="transition-colors hover:bg-accent/30"
                    >
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                CHART_COLORS[i % CHART_COLORS.length],
                            }}
                            aria-hidden="true"
                          />
                          <span className="font-medium text-foreground">
                            {row.source}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pl-2 text-right tabular-nums text-muted-foreground">
                        {row.enquiries}
                      </td>
                      <td className="py-2.5 pl-2 text-right tabular-nums text-muted-foreground">
                        {row.booked}
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <span
                          className={cn(
                            "inline-block tabular-nums text-xs font-semibold rounded-full px-2 py-0.5",
                            conv >= 25
                              ? "bg-fun-green text-foreground"
                              : conv >= 15
                                ? "bg-fun-blue text-foreground"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {conv}%
                        </span>
                      </td>
                      <td className="py-2.5 pl-2 text-right tabular-nums font-medium text-foreground">
                        {gbp(row.revenue)}
                      </td>
                      <td className="py-2.5 pl-2 text-right tabular-nums text-muted-foreground">
                        {row.cac ? gbp(row.cac) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="pt-3 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                    Total
                  </td>
                  <td className="pt-3 pl-2 text-right tabular-nums text-sm font-semibold text-foreground">
                    {data.reduce((s, r) => s + r.enquiries, 0)}
                  </td>
                  <td className="pt-3 pl-2 text-right tabular-nums text-sm font-semibold text-foreground">
                    {data.reduce((s, r) => s + r.booked, 0)}
                  </td>
                  <td className="pt-3 pl-2 text-right tabular-nums text-sm text-muted-foreground">
                    —
                  </td>
                  <td className="pt-3 pl-2 text-right tabular-nums text-sm font-semibold text-foreground">
                    {gbp(data.reduce((s, r) => s + r.revenue, 0))}
                  </td>
                  <td className="pt-3 pl-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Payment Health / AR panel (P1)
// ---------------------------------------------------------------------------

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

function PaymentHealthSection({ data }: { data: PaymentHealth }) {
  const total = data.collected + data.outstanding;
  const collectedPct = total > 0 ? Math.round((data.collected / total) * 100) : 0;
  const outstandingPct = total > 0 ? Math.round((data.outstanding / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">
          Payment health / AR
        </CardTitle>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-1">
          Collected vs outstanding across all active weddings
        </p>
      </CardHeader>
      <CardContent>
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
              {data.overdue > 0 && (
                <div
                  className="bg-destructive transition-all"
                  style={{
                    width: `${Math.round((data.overdue / total) * 100)}%`,
                  }}
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
                  {gbp(data.collected)}
                </p>
                <p className="text-xs text-muted-foreground">{collectedPct}% of total</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Outstanding
                </p>
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {gbp(data.outstanding)}
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
                    data.overdue > 0 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {gbp(data.overdue)}
                </p>
                {data.overdue > 0 && (
                  <p className="text-xs text-destructive">Needs chasing</p>
                )}
              </div>
            </div>
          </div>

          {/* Upcoming payments list */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Upcoming milestones
            </p>
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {data.upcoming.map((p) => {
                const cfg = STATUS_CONFIG[p.status];
                return (
                  <div
                    key={`${p.weddingId}-${p.label}`}
                    className="flex items-center justify-between gap-3 px-3 py-3 min-h-[44px] hover:bg-accent/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {p.coupleName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.label} · due{" "}
                        {new Date(p.dueDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="tabular-nums text-sm font-semibold text-foreground">
                        {gbp(p.amount)}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          cfg.className,
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
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Team Performance table (P1)
// ---------------------------------------------------------------------------

interface TeamRow {
  memberId: string;
  name: string;
  initials: string;
  role: string;
  enquiries: number;
  viewings: number;
  booked: number;
  revenue: number;
  avgFirstResponseMins: number;
  conversionRate: number;
}

function TeamPerformanceSection({ data }: { data: TeamPerformanceEntry[] }) {
  const rows: TeamRow[] = data.map((d) => {
    const member = TEAM.find((t) => t.id === d.memberId);
    return {
      ...d,
      name: member?.name ?? d.memberId,
      initials: member?.initials ?? "??",
      role: member?.role ?? "",
    };
  });

  const columns: SortableColumn<TeamRow>[] = [
    {
      key: "name",
      header: "Team member",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
            {row.initials}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground leading-snug">
              {row.name}
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {row.role}
            </p>
          </div>
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "enquiries",
      header: "Enquiries",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.enquiries}
        </span>
      ),
      sortValue: (row) => row.enquiries,
    },
    {
      key: "viewings",
      header: "Viewings",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.viewings}
        </span>
      ),
      sortValue: (row) => row.viewings,
    },
    {
      key: "booked",
      header: "Booked",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className="tabular-nums text-sm font-semibold text-foreground">
          {row.booked}
        </span>
      ),
      sortValue: (row) => row.booked,
    },
    {
      key: "conversionRate",
      header: "Conv. %",
      sortable: true,
      align: "right",
      render: (row) => (
        <span
          className={cn(
            "inline-block tabular-nums text-xs font-semibold rounded-full px-2 py-0.5",
            row.conversionRate >= 18
              ? "bg-fun-green text-foreground"
              : row.conversionRate >= 14
                ? "bg-fun-blue text-foreground"
                : "bg-muted text-muted-foreground",
          )}
        >
          {row.conversionRate}%
        </span>
      ),
      sortValue: (row) => row.conversionRate,
    },
    {
      key: "revenue",
      header: "Revenue",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className="tabular-nums text-sm font-semibold text-foreground">
          {gbp(row.revenue)}
        </span>
      ),
      sortValue: (row) => row.revenue,
    },
    {
      key: "avgFirstResponseMins",
      header: "Resp. time",
      sortable: true,
      align: "right",
      render: (row) => (
        <span
          className={cn(
            "tabular-nums text-xs font-semibold",
            row.avgFirstResponseMins <= 5
              ? "text-success-foreground"
              : row.avgFirstResponseMins <= 15
                ? "text-warning-foreground"
                : "text-destructive",
          )}
        >
          {row.avgFirstResponseMins} min
        </span>
      ),
      sortValue: (row) => row.avgFirstResponseMins,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">
          Team performance
        </CardTitle>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-1">
          Sales stats per team member — enquiries handled, booked, conversion rate
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <SortableTable<TeamRow>
          columns={columns}
          rows={rows}
          getRowId={(row) => row.memberId}
          initialSort={{ key: "revenue", dir: "desc" }}
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Capacity / Utilisation panel (P1)
// ---------------------------------------------------------------------------

function CapacitySection({ data }: { data: CapacityEntry[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">
          Date &amp; capacity utilisation
        </CardTitle>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-1">
          Prime-Saturday occupancy — next 12 months
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="min-w-[480px] space-y-1.5">
            {/* Column headers */}
            <div className="grid grid-cols-[4rem_1fr_auto] items-center gap-3 pb-1 border-b border-border">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Month
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Saturdays booked
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground text-right min-w-[5rem]">
                All dates
              </span>
            </div>

            {data.map((row) => {
              const satPct =
                row.availableSaturdays > 0
                  ? (row.bookedSaturdays / row.availableSaturdays) * 100
                  : 0;
              const satBenchmark =
                satPct >= BENCHMARKS.utilisation.good
                  ? "good"
                  : satPct >= BENCHMARKS.utilisation.watch
                    ? "watch"
                    : "bad";

              return (
                <div
                  key={row.month}
                  className="grid grid-cols-[4rem_1fr_auto] items-center gap-3"
                >
                  <span className="text-sm font-medium text-foreground">
                    {row.month}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-5 rounded-md bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-md transition-all",
                          satBenchmark === "good"
                            ? "bg-fun-green-strong"
                            : satBenchmark === "watch"
                              ? "bg-warning-foreground"
                              : "bg-muted-foreground",
                        )}
                        style={{ width: `${satPct}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-xs font-semibold text-foreground w-16 text-right shrink-0">
                      {row.bookedSaturdays}/{row.availableSaturdays} (
                      {Math.round(satPct)}%)
                    </span>
                  </div>
                  <span className="tabular-nums text-xs text-muted-foreground text-right min-w-[5rem]">
                    {row.bookedDates}/{row.allDates} dates
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-fun-green-strong" />
            75%+ (on target)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-warning-foreground" />
            50–74% (watch)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-muted-foreground" />
            Below 50%
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Period toolbar + root export
// ---------------------------------------------------------------------------

export interface ReportsChartsProps {
  funnel: FunnelEntry[];
  revenueByMonth: RevenueEntry[];
  sourceRoi: SourceRoiEntry[];
}

/**
 * ReportsChartsV2 — the full client shell for the upgraded reports page.
 * Manages period state, derives per-period datasets, and renders all sections.
 * The legacy `ReportsCharts` export is preserved at the bottom for compatibility.
 */
export function ReportsChartsV2(_props: ReportsChartsProps) {
  const [period, setPeriod] = React.useState<ReportPeriod>("ytd");
  const snapshot = getReportPeriod(period);

  // kpisPrev may be undefined if the period key only has `kpis` (type guard)
  const kpisPrev: KpisSnapshot = (snapshot as Record<string, unknown>).kpisPrev as KpisSnapshot ??
    REPORTS.kpis;

  return (
    <div className="space-y-6">
      {/* Period toolbar */}
      <DataToolbar
        actions={
          <div className="flex items-center gap-1.5">
            {REPORT_PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                aria-pressed={period === p.value}
                className={cn(
                  "min-h-[32px] rounded-md px-3 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  period === p.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {/* KPI cards — period-aware */}
      <KpiSection
        kpis={snapshot.kpis}
        kpisPrev={kpisPrev}
        period={period}
      />

      {/* Forward booking pacing (P0) */}
      <PacingSection data={REPORTS.pacing} />

      {/* Funnel + Revenue side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FunnelSection data={snapshot.funnel} />
        <RevenueSection data={snapshot.revenueByMonth} />
      </div>

      {/* Source ROI */}
      <SourceRoiSection data={snapshot.sourceRoi} />

      {/* P1: Payment Health + Team Performance */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PaymentHealthSection data={REPORTS.paymentHealth} />
        <TeamPerformanceSection data={REPORTS.teamPerformance} />
      </div>

      {/* P1: Capacity utilisation */}
      <CapacitySection data={REPORTS.capacityByMonth} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legacy export — kept so the old page.tsx import continues to resolve.
// ---------------------------------------------------------------------------

export function ReportsCharts({
  funnel,
  revenueByMonth,
  sourceRoi,
}: ReportsChartsProps) {
  return (
    <ReportsChartsV2
      funnel={funnel}
      revenueByMonth={revenueByMonth}
      sourceRoi={sourceRoi}
    />
  );
}
