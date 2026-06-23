"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  TriangleAlert,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CopilotQuestion } from "@/components/ask-copilot";
import {
  askCopilot,
  type CopilotAnswer,
  type CopilotCategory,
} from "./actions";

// Map an AskCopilot question to a server-action category. Free-text questions
// have no category → keyword-match the label; default to Planning.
function resolveCategory(q: CopilotQuestion): CopilotCategory {
  if (q.category === "Finance") return "Finance";
  if (q.category === "Pipeline") return "Pipeline";
  if (q.category === "Guests") return "Guests";
  if (q.category === "Planning") return "Planning";

  const l = q.label.toLowerCase();
  if (/(pay|payment|invoice|balance|overdue|money|revenue)/.test(l)) return "Finance";
  if (/(lead|enquiry|enquiries|pipeline|quiet|follow.?up)/.test(l)) return "Pipeline";
  if (/(rsvp|guest|seating|table)/.test(l)) return "Guests";
  return "Planning";
}

const KIND_ICON = {
  done: CheckCircle2,
  pending: Clock,
  warning: TriangleAlert,
} as const;

const KIND_COLOR = {
  done: "text-success-foreground",
  pending: "text-muted-foreground",
  warning: "text-warning-foreground",
} as const;

function AnswerItemRow({
  label,
  meta,
  kind,
}: {
  label: string;
  meta?: string;
  kind: "done" | "pending" | "warning";
}) {
  const Icon = KIND_ICON[kind];
  return (
    <li className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
      <Icon
        className={cn("mt-0.5 size-3.5 shrink-0", KIND_COLOR[kind])}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground leading-snug">{label}</span>
        {meta && (
          <span className="block mt-0.5 text-xs text-muted-foreground tabular-nums">
            {meta}
          </span>
        )}
      </span>
    </li>
  );
}

export interface CopilotAnswerSheetProps {
  question: CopilotQuestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CopilotAnswerSheet({
  question,
  open,
  onOpenChange,
}: CopilotAnswerSheetProps) {
  const [answer, setAnswer] = React.useState<CopilotAnswer | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !question) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setAnswer(null);
      try {
        const res = await askCopilot(resolveCategory(question), question.label);
        if (cancelled) return;
        if (res.ok) setAnswer(res.data);
        else setError(res.error);
      } catch {
        if (!cancelled) setError("Something went wrong. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [open, question]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-5">
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="outline" className="text-[11px]">
              Copilot
            </Badge>
          </div>
          <SheetTitle className="text-base font-semibold text-foreground leading-snug">
            {question?.label ?? "Answer"}
          </SheetTitle>
          {answer && (
            <SheetDescription className="text-sm text-muted-foreground">
              {answer.intro}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Checking your live data…
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive-foreground">{error}</p>
          )}

          {!loading &&
            !error &&
            answer?.cards.map((card, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {card.heading}
                </p>
                <ul className="divide-border">
                  {card.items.map((item, j) => (
                    <AnswerItemRow key={j} {...item} />
                  ))}
                </ul>
                {card.cta && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="min-h-[36px] gap-1.5"
                    >
                      <Link href={card.cta.href}>
                        {card.cta.label}
                        <ExternalLink className="size-3" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            ))}
        </div>

        <div className="border-t border-border px-6 py-4">
          <p className="text-[11px] text-muted-foreground">
            Answers are derived from your live data — press{" "}
            <kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[10px]">
              Esc
            </kbd>{" "}
            to close.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
