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
import type { GhlPipelineSummary } from "@/lib/reports/ghl-pipeline";

// ── Shared palette (matches DESIGN.md fun-pastels, strong variants for bars)
const STAGE_COLOR = "oklch(0.584 0.152 272)"; // fun-blue-strong
const SOURCE_COLORS = [
  "oklch(0.703 0.189 319)", // fun-pink-strong
  "oklch(0.584 0.152 272)", // fun-blue-strong
  "oklch(0.774 0.161 135)", // fun-green-strong
  "oklch(0.731 0.1 194)",   // fun-teal-strong
  "oklch(0.477 0.09 76)",   // warning-foreground (amber)
  "oklch(0.541 0.061 271)", // muted-foreground (navy)
];

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

// Friendly stage label map
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
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── GHL Pipeline section ──────────────────────────────────────────────────────

export interface GhlPipelineSectionProps {
  /** null = GHL not connected; render a subtle hint instead. */
  summary: GhlPipelineSummary | null;
}

/**
 * Server-rendered data passed down as props — no secrets reach the browser.
 * Renders nothing when summary is null (GHL not connected or call failed).
 */
export function GhlPipelineSection({ summary }: GhlPipelineSectionProps) {
  if (summary === null) {
    return (
      <p className="text-xs text-muted-foreground">
        Connect GoHighLevel to see live pipeline data.
      </p>
    );
  }

  const { stages, totalCount, totalValue } = summary;

  if (stages.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No open opportunities in GHL yet.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex gap-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Total opportunities
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {totalCount}
          </p>
        </div>
        {totalValue > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Pipeline value
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {totalValue.toLocaleString()}
            </p>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <th className="pb-3 pr-6">Stage ID</th>
              <th className="pb-3 pr-6 text-right">Count</th>
              <th className="pb-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr
                key={s.pipelineStageId}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-3 pr-6 font-mono text-xs text-foreground">
                  {s.pipelineStageId}
                </td>
                <td className="py-3 pr-6 text-right tabular-nums text-foreground">
                  {s.count}
                </td>
                <td className="py-3 text-right tabular-nums text-foreground">
                  {s.totalValue > 0 ? s.totalValue.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
