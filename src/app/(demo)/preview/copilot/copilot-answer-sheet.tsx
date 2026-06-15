"use client"

import * as React from "react"
import Link from "next/link"
import {
  CheckCircle2,
  Clock,
  TriangleAlert,
  ExternalLink,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  primaryWedding,
  formatLongDate,
  gbp,
} from "@/lib/mock"
import type { CopilotQuestion } from "@/components/ask-copilot"

// ---------------------------------------------------------------------------
// Derived structured answer from primaryWedding mock data
// ---------------------------------------------------------------------------

interface AnswerCard {
  heading: string
  items: { label: string; meta?: string; kind: "done" | "pending" | "warning" }[]
  cta?: { label: string; href: string }
}

function buildAnswer(q: CopilotQuestion): { intro: string; cards: AnswerCard[] } {
  const w = primaryWedding()

  // Outstanding tasks grouped by category
  const incompleteTasks = w.tasks.filter((t) => !t.done)
  const unconfirmedSuppliers = w.suppliers.filter((s) => s.status !== "confirmed")
  const overduePayments = w.payments.filter((p) => p.status === "overdue")
  const upcomingPayments = w.payments.filter((p) => p.status === "due" || p.status === "upcoming")

  const label = q.label.toLowerCase()

  // "What's left for Henderson" — default breakdown
  if (label.includes("henderson") || label.includes("left") || label.includes("outstanding") || label.includes("confirm")) {
    const cards: AnswerCard[] = []

    if (incompleteTasks.length > 0) {
      cards.push({
        heading: "Open tasks",
        items: incompleteTasks.slice(0, 6).map((t) => ({
          label: t.label,
          meta: t.dueDate ? formatLongDate(t.dueDate) : undefined,
          kind: "pending" as const,
        })),
        cta: { label: "Open wedding workspace", href: "/preview/weddings/w1" },
      })
    }

    if (unconfirmedSuppliers.length > 0) {
      cards.push({
        heading: "Suppliers to confirm",
        items: unconfirmedSuppliers.map((s) => ({
          label: `${s.name} — ${s.category}`,
          meta: s.status,
          kind: s.status === "declined" ? ("warning" as const) : ("pending" as const),
        })),
        cta: { label: "Supplier hub", href: "/preview/suppliers" },
      })
    }

    if (cards.length === 0) {
      cards.push({
        heading: "All clear",
        items: [{ label: "No outstanding items — this wedding is ready.", kind: "done" }],
        cta: { label: "View workspace", href: "/preview/weddings/w1" },
      })
    }

    return {
      intro: `Here's what's still open for ${w.coupleName} ahead of ${formatLongDate(w.date)}.`,
      cards,
    }
  }

  // Revenue / conversion questions
  if (label.includes("revenue") || label.includes("conversion") || label.includes("track") || label.includes("pipeline")) {
    return {
      intro: "Conversion and revenue are trending ahead of prior period.",
      cards: [
        {
          heading: "Key numbers — YTD",
          items: [
            { label: "Conversion rate", meta: "16.9%  (vs 14.2% prior)", kind: "done" },
            { label: "Avg. booking value", meta: "£17,400  (+£600)", kind: "done" },
            { label: "Booked revenue", meta: "£306,000  (+£58k vs same point last year)", kind: "done" },
            { label: "Avg. first response", meta: "4 min  (was 7 min)", kind: "done" },
          ],
          cta: { label: "Full reports", href: "/preview/reports" },
        },
        {
          heading: "Watch",
          items: [
            { label: "Google leads", meta: "11.1% conversion — below venue average. Review ad creative.", kind: "warning" },
          ],
        },
      ],
    }
  }

  // Payment / at-risk
  if (label.includes("risk") || label.includes("payment") || label.includes("overdue") || label.includes("balance")) {
    return {
      intro: "Payment health is strong. One item needs attention.",
      cards: [
        {
          heading: "Upcoming payments",
          items: [
            ...overduePayments.map((p) => ({
              label: `${p.label} — ${gbp(p.amount)}`,
              meta: `Overdue since ${formatLongDate(p.dueDate)}`,
              kind: "warning" as const,
            })),
            ...upcomingPayments.slice(0, 3).map((p) => ({
              label: `${p.label} — ${gbp(p.amount)}`,
              meta: `Due ${formatLongDate(p.dueDate)}`,
              kind: "pending" as const,
            })),
          ],
          cta: { label: "Money overview", href: "/preview/money" },
        },
      ],
    }
  }

  // Generic fallback
  return {
    intro: `Here's a summary for "${q.label}".`,
    cards: [
      {
        heading: "Weddings in planning",
        items: [
          { label: `${w.coupleName} — ${formatLongDate(w.date)}`, meta: `${w.guestCount} guests · ${gbp(w.totalValue)}`, kind: "pending" },
        ],
        cta: { label: "View workspace", href: "/preview/weddings/w1" },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Item row inside a card
// ---------------------------------------------------------------------------

const KIND_ICON = {
  done: CheckCircle2,
  pending: Clock,
  warning: TriangleAlert,
} as const

const KIND_COLOR = {
  done: "text-success-foreground",
  pending: "text-muted-foreground",
  warning: "text-warning-foreground",
} as const

function AnswerItemRow({
  label,
  meta,
  kind,
}: {
  label: string
  meta?: string
  kind: "done" | "pending" | "warning"
}) {
  const Icon = KIND_ICON[kind]
  return (
    <li className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
      <Icon
        className={cn("mt-0.5 size-3.5 shrink-0", KIND_COLOR[kind])}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground leading-snug">{label}</span>
        {meta && (
          <span className="block mt-0.5 text-xs text-muted-foreground tabular-nums">{meta}</span>
        )}
      </span>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Props + main export
// ---------------------------------------------------------------------------

export interface CopilotAnswerSheetProps {
  question: CopilotQuestion | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CopilotAnswerSheet({
  question,
  open,
  onOpenChange,
}: CopilotAnswerSheetProps) {
  const answer = React.useMemo(
    () => (question ? buildAnswer(question) : null),
    [question],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-md"
      >
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
          {answer?.cards.map((card, i) => (
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
                  <Button variant="outline" size="sm" asChild className="min-h-[36px] gap-1.5">
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
  )
}
