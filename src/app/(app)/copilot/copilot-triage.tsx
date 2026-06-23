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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AskCopilot, type CopilotQuestion } from "@/components/ask-copilot";
import type { Insight, InsightKind } from "@/lib/copilot/insights";
import { CopilotAnswerSheet } from "./copilot-answer-sheet";

// ---------------------------------------------------------------------------
// Suggested questions — categories map to the askCopilot server action router.
// ---------------------------------------------------------------------------

const COPILOT_QUESTIONS: CopilotQuestion[] = [
  { id: "q1", label: "What planning tasks are overdue?", category: "Planning" },
  { id: "q2", label: "Are there any overdue or due payments?", category: "Finance" },
  { id: "q3", label: "Which enquiries have gone quiet?", category: "Pipeline" },
  { id: "q4", label: "Who still needs to RSVP?", category: "Guests" },
];

// ---------------------------------------------------------------------------
// Kind config — badge + action label per insight kind
// ---------------------------------------------------------------------------

const KIND_CONFIG = {
  at_risk: {
    icon: AlertTriangle,
    badge: "warning" as const,
    label: "At risk",
    actionLabel: "Review",
  },
  action: {
    icon: Zap,
    badge: "blue" as const,
    label: "Action",
    actionLabel: "Open",
  },
  nudge: {
    icon: Bell,
    badge: "teal" as const,
    label: "Nudge",
    actionLabel: "View",
  },
} satisfies Record<
  InsightKind,
  {
    icon: React.ComponentType<{ className?: string }>;
    badge: "warning" | "blue" | "teal";
    label: string;
    actionLabel: string;
  }
>;

// ---------------------------------------------------------------------------
// Single insight row
// ---------------------------------------------------------------------------

function InsightRow({
  insight,
  onSnooze,
  onDismiss,
}: {
  insight: Insight;
  onSnooze: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const cfg = KIND_CONFIG[insight.kind];

  return (
    <div
      className={cn(
        "group flex min-h-[44px] flex-col gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5",
        "transition-all hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <div className="flex items-start gap-3">
        <Badge variant={cfg.badge} className="mt-px shrink-0 text-[11px]">
          {cfg.label}
        </Badge>

        <p className="flex-1 text-sm font-semibold text-foreground leading-snug">
          {insight.title}
        </p>

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

      {insight.signal && (
        <p className="text-[12px] text-muted-foreground leading-snug pl-[1px]">
          {insight.signal}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <span className="inline-flex min-h-[28px] items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
          {insight.count} {insight.count === 1 ? "item" : "items"}
        </span>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="min-h-[32px] shrink-0"
        >
          <Link href={insight.href}>{cfg.actionLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pulse summary bar
// ---------------------------------------------------------------------------

function PulseBar({ need, nudges }: { need: number; nudges: number }) {
  if (need === 0 && nudges === 0) return null;

  const parts: string[] = [];
  if (need > 0) parts.push(`${need} need${need === 1 ? "s" : ""} your attention`);
  if (nudges > 0) parts.push(`${nudges} to keep an eye on`);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
      <span
        className="flex size-2 shrink-0 rounded-full bg-fun-pink-strong"
        aria-hidden
      />
      <span>{parts.join(" · ")}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyTriage() {
  return (
    <div
      data-testid="copilot-empty"
      className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center"
    >
      <span className="mb-4 flex size-10 items-center justify-center rounded-full bg-fun-green text-fun-green-strong">
        <PartyPopper className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-foreground">All clear</p>
      <p className="mt-1.5 max-w-[300px] text-sm text-muted-foreground">
        Nothing needs your attention right now. Check back later or use the
        command bar to ask a question.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component — receives real, server-derived insights
// ---------------------------------------------------------------------------

export function CopilotTriage({ insights }: { insights: Insight[] }) {
  // Optimistic local state — snooze/dismiss only hides for this session.
  const [visible, setVisible] = React.useState<Insight[]>(insights);

  const [answerQuestion, setAnswerQuestion] =
    React.useState<CopilotQuestion | null>(null);
  const [answerOpen, setAnswerOpen] = React.useState(false);

  function handleSnooze(id: string) {
    setVisible((prev) => prev.filter((i) => i.id !== id));
    toast("Snoozed for 24 hours", {
      description: "This insight will reappear tomorrow if still relevant.",
    });
  }

  function handleDismiss(id: string) {
    setVisible((prev) => prev.filter((i) => i.id !== id));
    toast("Dismissed");
  }

  function handleAsk(q: CopilotQuestion) {
    setAnswerQuestion(q);
    setAnswerOpen(true);
  }

  const needCount = visible.filter(
    (i) => i.kind === "at_risk" || i.kind === "action",
  ).length;
  const nudgeCount = visible.filter((i) => i.kind === "nudge").length;

  return (
    <>
      <div className="flex flex-col gap-4">
        <PulseBar need={needCount} nudges={nudgeCount} />

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {visible.length > 0
              ? `${visible.length} insight${visible.length === 1 ? "" : "s"} — ranked by priority`
              : "Insights"}
          </p>
          <AskCopilot questions={COPILOT_QUESTIONS} onAsk={handleAsk} />
        </div>

        {visible.length === 0 ? (
          <EmptyTriage />
        ) : (
          <div className="flex flex-col gap-2" data-testid="copilot-insights">
            {visible.map((insight) => (
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

      <CopilotAnswerSheet
        question={answerQuestion}
        open={answerOpen}
        onOpenChange={setAnswerOpen}
      />
    </>
  );
}
