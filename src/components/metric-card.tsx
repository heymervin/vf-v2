"use client"

import { ArrowDown, ArrowUp, Dot } from "lucide-react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Internal Sparkline
// ---------------------------------------------------------------------------

interface SparklineProps {
  series: number[]
  /** Color class for the stroke — a Tailwind arbitrary value using CSS vars */
  colorClass: "success" | "warning" | "destructive" | "default"
}

const SPARKLINE_COLORS: Record<SparklineProps["colorClass"], { stroke: string; fill: string }> = {
  success:     { stroke: "var(--color-success-foreground)",     fill: "var(--color-success)" },
  warning:     { stroke: "var(--color-warning-foreground)",     fill: "var(--color-warning)" },
  destructive: { stroke: "var(--color-destructive)",            fill: "var(--color-destructive)" },
  default:     { stroke: "var(--color-muted-foreground)",       fill: "var(--color-muted)" },
}

function Sparkline({ series, colorClass }: SparklineProps) {
  const data = series.map((v, i) => ({ i, v }))
  const { stroke, fill } = SPARKLINE_COLORS[colorClass]

  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`spark-fill-${colorClass}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity={0.35} />
            <stop offset="100%" stopColor={fill} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={stroke}
          strokeWidth={1.5}
          fill={`url(#spark-fill-${colorClass})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// MetricCard
// ---------------------------------------------------------------------------

export interface MetricCardProps {
  label: string
  value: string
  delta?: {
    value: string
    direction: "up" | "down"
    /** true = this direction is positive (e.g. revenue up = good) */
    good?: boolean
  }
  /** Sparkline data points — raw numbers, no labels needed */
  series?: number[]
  benchmark?: "good" | "watch" | "bad"
  /** Small footnote beneath the value row */
  note?: string
  className?: string
}

const BENCHMARK_DOT: Record<NonNullable<MetricCardProps["benchmark"]>, string> = {
  good:  "text-success-foreground",
  watch: "text-warning-foreground",
  bad:   "text-destructive",
}

function benchmarkSparkColor(
  benchmark: MetricCardProps["benchmark"],
): SparklineProps["colorClass"] {
  if (benchmark === "good") return "success"
  if (benchmark === "watch") return "warning"
  if (benchmark === "bad") return "destructive"
  return "default"
}

/**
 * MetricCard — eyebrow label, tabular value, delta chip, optional sparkline,
 * optional benchmark dot, optional footnote. Built on Card. "use client" for recharts.
 */
export function MetricCard({
  label,
  value,
  delta,
  series,
  benchmark,
  note,
  className,
}: MetricCardProps) {
  const isDeltaGood = delta ? (delta.good ?? true) : undefined
  const deltaPositive = isDeltaGood !== undefined
    ? (delta!.direction === "up" ? isDeltaGood : !isDeltaGood)
    : undefined

  const DeltaIcon = delta?.direction === "up" ? ArrowUp : ArrowDown

  return (
    <Card
      size="sm"
      className={cn(
        "transition-all hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:transform-none",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-2 pt-4 pb-3">
        {/* Eyebrow */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>

        {/* Value row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xl font-semibold tabular-nums leading-none text-foreground">
            {value}
          </span>

          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                deltaPositive
                  ? "bg-success text-success-foreground"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              <DeltaIcon className="size-3 shrink-0" aria-hidden />
              {delta.value}
            </span>
          )}

          {benchmark && (
            <Dot
              className={cn("size-5 shrink-0 -ml-1", BENCHMARK_DOT[benchmark])}
              aria-label={`Benchmark: ${benchmark}`}
            />
          )}
        </div>

        {/* Footnote */}
        {note && (
          <p className="text-[11px] text-muted-foreground leading-tight">{note}</p>
        )}

        {/* Sparkline */}
        {series && series.length > 1 && (
          <div className="-mx-1 mt-1">
            <Sparkline series={series} colorClass={benchmarkSparkColor(benchmark)} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
