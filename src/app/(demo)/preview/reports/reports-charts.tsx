"use client";

/**
 * ReportsCharts — client component for all recharts visualisations on the
 * Reports page. Receives data as props from the server page so recharts
 * (which uses ResponsiveContainer / SVG / browser APIs) is isolated here.
 */

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types matching REPORTS structure in @/lib/mock
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
}

interface ReportsChartsProps {
  funnel: FunnelEntry[];
  revenueByMonth: RevenueEntry[];
  sourceRoi: SourceRoiEntry[];
}

// ---------------------------------------------------------------------------
// GBP formatter (mirrors the mock helper — safe to re-derive client-side)
// ---------------------------------------------------------------------------

function gbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);
}

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
// Tooltip render functions (inline arrow fns avoid TooltipContentProps friction)
// Recharts passes { active, payload, label } at runtime; we type the param as
// unknown and narrow — no dependency on recharts' internal tooltip types.
// ---------------------------------------------------------------------------

function renderRevenueTooltip(props: unknown) {
  const p = props as { active?: boolean; payload?: { value?: number }[]; label?: string };
  if (!p.active || !p.payload?.length) return null;
  const val = p.payload[0]?.value ?? 0;
  return (
    <TooltipBox>
      <p className="font-semibold text-foreground mb-0.5">{p.label}</p>
      <p className="tabular-nums text-muted-foreground">{gbp(val)}</p>
    </TooltipBox>
  );
}

function renderSourceTooltip(props: unknown) {
  const p = props as { active?: boolean; payload?: { value?: number }[]; label?: string };
  if (!p.active || !p.payload?.length) return null;
  const val = p.payload[0]?.value ?? 0;
  return (
    <TooltipBox>
      <p className="font-semibold text-foreground mb-0.5">{p.label}</p>
      <p className="tabular-nums text-muted-foreground">{gbp(val)}</p>
    </TooltipBox>
  );
}

// ---------------------------------------------------------------------------
// Chart colour palette — maps to CSS vars defined in globals.css
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  "var(--chart-1)", // fun-blue-strong — navy-periwinkle
  "var(--chart-2)", // fun-teal-strong
  "var(--chart-3)", // fun-pink-strong
  "var(--chart-4)", // fun-green-strong
  "var(--chart-5)", // warning amber
];

// ---------------------------------------------------------------------------
// Funnel section — custom horizontal bars (no recharts needed here;
// pure CSS gives precise drop-off layout with badges)
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
                    ((data[i - 1].value - entry.value) / data[i - 1].value) * 100,
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
                      backgroundColor: CHART_COLORS[Math.min(i, CHART_COLORS.length - 1)],
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 justify-end min-w-[5.5rem]">
                  <span className="tabular-nums text-sm font-semibold text-foreground">
                    {entry.value}
                  </span>
                  {dropPct !== null && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] py-0 px-1.5"
                    >
                      -{dropPct}%
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* End-to-end conversion callout */}
        <div className="mt-5 flex items-start gap-2 rounded-lg bg-fun-green/60 px-3 py-2">
          <span className="mt-px shrink-0 size-2 rounded-full bg-fun-green-strong" aria-hidden="true" />
          <p className="text-xs text-foreground leading-relaxed">
            <span className="font-semibold tabular-nums">
              {data[data.length - 1]?.value ?? 0}
            </span>{" "}
            of{" "}
            <span className="font-semibold tabular-nums">{data[0]?.value ?? 0}</span>{" "}
            enquiries converted to bookings —{" "}
            <span className="font-semibold tabular-nums">
              {Math.round(
                ((data[data.length - 1]?.value ?? 0) / (data[0]?.value ?? 1)) * 100,
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
          YTD Jan – Jun 2026
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.18} />
                <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "inherit" }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "inherit" }}
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
          tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "inherit" }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "inherit" }}
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

// ---------------------------------------------------------------------------
// Source ROI section — chart + table
// ---------------------------------------------------------------------------

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
          {/* Chart */}
          <div>
            <SourceRevenueChart data={data} />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {(["Source", "Enquiries", "Booked", "Conv.", "Revenue"] as const).map(
                    (h) => (
                      <th
                        key={h}
                        className={cn(
                          "pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
                          h === "Source" ? "pr-4 text-left" : "pl-2 text-right",
                        )}
                      >
                        {h}
                      </th>
                    ),
                  )}
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
                              backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
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
// Root export
// ---------------------------------------------------------------------------

export function ReportsCharts({
  funnel,
  revenueByMonth,
  sourceRoi,
}: ReportsChartsProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FunnelSection data={funnel} />
        <RevenueSection data={revenueByMonth} />
      </div>
      <SourceRoiSection data={sourceRoi} />
    </div>
  );
}
