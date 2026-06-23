"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  BellOff,
  PartyPopper,
  Zap,
  X,
  CalendarClock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CopilotInsight } from "@/lib/copilot/insights";

// ---------------------------------------------------------------------------
// Re-export type so page.tsx can import from one place
// ---------------------------------------------------------------------------

export type { CopilotInsight };

// ---------------------------------------------------------------------------
// Kind config — matches demo design (badges, icons, action labels)
// ---------------------------------------------------------------------------

const KIND_CONFIG = {
  at_risk: {
    icon: AlertTriangle,
    badge: "warning" as const,
    label: "At risk",
    actionLabel: "Review wedding",
  },
  action: {
    icon: Zap,
    badge: "blue" as const,
    label: "Action",
    actionLabel: "Open",
  },
  win: {
    icon: PartyPopper,
    badge: "success" as const,
    label: "Win",
    actionLabel: "Open workspace",
  },
  nudge: {
    icon: Bell,
    badge: "teal" as const,
    label: "Nudge",
    actionLabel: "View",
  },
} satisfies Record<
  CopilotInsight["kind"],
  {
    icon: React.ComponentType<{ className?: string }>;
    badge: "warning" | "blue" | "success" | "teal";
    label: string;
    actionLabel: string;
  }
>;

// ---------------------------------------------------------------------------
// Single insight row
// ---------------------------------------------------------------------------

interface InsightRowProps {
  insight: CopilotInsight;
  onSnooze: (id: string) => void;
  onDismiss: (id: string) => void;
}

function InsightRow({ insight, onSnooze, onDismiss }: InsightRowProps) {
  const cfg = KIND_CONFIG[insight.kind];

  return (
    <div
      className={cn(
        "group flex min-h-[44px] flex-col gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5",
        "transition-all hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      {/* Row 1: kind badge + title + dismiss/snooze */}
      <div className="flex items-start gap-3">
        <Badge variant={cfg.badge} className="mt-px shrink-0 text-[11px]">
          {cfg.label}
        </Badge>

        <p className="flex-1 text-sm font-semibold text-foreground leading-snug">
          {insight.title}
        </p>

        {/* Snooze + dismiss — visible on hover, keyboard-always */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={() => onSnooze(insight.id)}
            aria-label="Snooze this insight"
            className="flex size-[28px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BellOff className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onDismiss(insight.id)}
            aria-label="Dismiss this insight"
            className="flex size-[28px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Row 2: signal subline */}
      {insight.signal && (
        <p className="text-[12px] text-muted-foreground leading-snug pl-[1px]">
          {insight.signal}
        </p>
      )}

      {/* Row 3: due date chip + primary action */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          {insight.dueAt && (
            <span className="inline-flex min-h-[28px] items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] text-muted-foreground tabular-nums">
              <CalendarClock className="size-3" aria-hidden />
              {new Date(insight.dueAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
        </div>

        {insight.actionHref ? (
          <Button variant="outline" size="sm" asChild className="min-h-[32px] shrink-0">
            <Link href={insight.actionHref}>{cfg.actionLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pulse summary bar
// ---------------------------------------------------------------------------

interface PulseBarProps {
  need: number;
  wins: number;
  scheduled: number;
}

function PulseBar({ need, wins, scheduled }: PulseBarProps) {
  if (need === 0 && wins === 0 && scheduled === 0) return null;

  const parts: string[] = [];
  if (need > 0) parts.push(`${need} need${need === 1 ? "s" : ""} your attention`);
  if (wins > 0) parts.push(`${wins} win${wins === 1 ? "" : "s"}`);
  if (scheduled > 0) parts.push(`${scheduled} scheduled`);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
      <span className="flex size-2 shrink-0 rounded-full bg-fun-pink-strong" aria-hidden />
      <span>{parts.join(" · ")}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyTriage() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center">
      <span className="mb-4 flex size-10 items-center justify-center rounded-full bg-fun-green text-fun-green-strong">
        <PartyPopper className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-foreground">All clear</p>
      <p className="mt-1.5 max-w-[300px] text-sm text-muted-foreground">
        No open insights. Check back after your next enquiry comes in.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface CopilotTriageProps {
  insights: CopilotInsight[];
}

export function CopilotTriage({ insights: initialInsights }: CopilotTriageProps) {
  // Optimistic client state — server passes pre-sorted insights.
  // Dismiss and snooze are ephemeral (no DB write — per contract).
  const [insights, setInsights] = React.useState<CopilotInsight[]>(initialInsights);

  function handleSnooze(id: string) {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    toast("Snoozed for 24 hours", {
      description: "This insight will reappear on next page load if still relevant.",
    });
  }

  function handleDismiss(id: string) {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    toast("Dismissed");
  }

  const needCount = insights.filter(
    (i) => i.kind === "at_risk" || i.kind === "action",
  ).length;
  const winCount = insights.filter((i) => i.kind === "win").length;
  const scheduledCount = insights.filter(
    (i) => i.kind === "nudge" && i.dueAt,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Pulse summary — one calm line */}
      <PulseBar need={needCount} wins={winCount} scheduled={scheduledCount} />

      {/* Toolbar row: count label */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {insights.length > 0
            ? `${insights.length} insight${insights.length === 1 ? "" : "s"} — ranked by priority`
            : "Insights"}
        </p>
        {/* TODO: M13 — AI question answering (AskCopilot button goes here) */}
      </div>

      {/* Ranked triage list */}
      {insights.length === 0 ? (
        <EmptyTriage />
      ) : (
        <div className="flex flex-col gap-2">
          {insights.map((insight) => (
            <InsightRow
              key={insight.id}
              insight={insight}
              onSnooze={handleSnooze}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}
