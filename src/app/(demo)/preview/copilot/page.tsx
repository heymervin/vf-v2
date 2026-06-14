import Link from "next/link";
import {
  AlertTriangle,
  Zap,
  Bell,
  PartyPopper,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  COPILOT_INSIGHTS,
  getContact,
  type CopilotInsight,
} from "@/lib/mock";
import { CopilotChat } from "./copilot-chat";
import { InsightActionButton } from "./insight-action-button";

export const metadata = { title: "AI Copilot" };

// ---------------------------------------------------------------------------
// Insight kind → visual config
// ---------------------------------------------------------------------------

const KIND_CONFIG = {
  at_risk: {
    accent: "border-l-warning-foreground",
    bg: "bg-warning/20",
    iconBg: "bg-warning text-warning-foreground",
    icon: AlertTriangle,
    badge: "warning" as const,
    label: "At risk",
    actionLabel: "Send nudge",
  },
  action: {
    accent: "border-l-primary",
    bg: "bg-fun-blue/20",
    iconBg: "bg-fun-blue text-foreground",
    icon: Zap,
    badge: "blue" as const,
    label: "Action",
    actionLabel: "Draft reply",
  },
  win: {
    accent: "border-l-success-foreground",
    bg: "bg-fun-green/20",
    iconBg: "bg-fun-green text-foreground",
    icon: PartyPopper,
    badge: "success" as const,
    label: "Win",
    actionLabel: "Open",
  },
  nudge: {
    accent: "border-l-fun-teal-strong",
    bg: "bg-fun-teal/20",
    iconBg: "bg-fun-teal text-foreground",
    icon: Bell,
    badge: "teal" as const,
    label: "Nudge",
    actionLabel: "Send nudge",
  },
} satisfies Record<
  CopilotInsight["kind"],
  {
    accent: string;
    bg: string;
    iconBg: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: "warning" | "blue" | "success" | "teal";
    label: string;
    actionLabel: string;
  }
>;

// ---------------------------------------------------------------------------
// Insight card
// ---------------------------------------------------------------------------

function InsightCard({ insight }: { insight: CopilotInsight }) {
  const cfg = KIND_CONFIG[insight.kind];
  const Icon = cfg.icon;
  const contact = insight.contactId ? getContact(insight.contactId) : undefined;

  return (
    <div
      className={cn(
        "group relative flex min-h-[44px] flex-col gap-3 rounded-xl border border-border border-l-4 p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
        cfg.accent,
        cfg.bg,
      )}
    >
      {/* Top row: icon + title + badge */}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
            cfg.iconBg,
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant={cfg.badge}>{cfg.label}</Badge>
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug">
            {insight.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {insight.detail}
          </p>
        </div>
      </div>

      {/* Bottom row: contact chip + action */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {contact ? (
          <Link
            href={`/preview/contacts/${contact.id}`}
            className="group/contact flex min-h-[32px] items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent/60"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-fun-pink text-[9px] font-bold text-fun-pink-foreground">
              {contact.initials}
            </span>
            <span className="truncate">{contact.coupleName}</span>
            <ArrowRight className="size-3 opacity-0 transition-opacity group-hover/contact:opacity-100" />
          </Link>
        ) : (
          <span />
        )}

        <InsightActionButton kind={insight.kind} label={cfg.actionLabel} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CopilotPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="AI Copilot"
        subtitle="Your venue's AI — drafts replies, scores leads, and flags what needs attention across the whole lifecycle."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
        {/* ------------------------------------------------------------------ */}
        {/* Left: Insights feed                                                 */}
        {/* ------------------------------------------------------------------ */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-fun-pink-strong" />
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Today&apos;s insights
            </h2>
            <span className="ml-auto rounded-full bg-fun-pink px-2.5 py-0.5 text-xs font-semibold tabular-nums text-fun-pink-foreground">
              {COPILOT_INSIGHTS.length}
            </span>
          </div>

          {COPILOT_INSIGHTS.length === 0 ? (
            <EmptyInsights />
          ) : (
            <div className="space-y-3">
              {COPILOT_INSIGHTS.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}

          {/* Lifecycle explainer strip */}
          <Card className="mt-2 bg-accent/40">
            <CardContent className="py-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Lifecycle-aware AI
              </p>
              <p className="text-sm text-muted-foreground">
                The Copilot reads every stage — from first enquiry through
                post-event review — and surfaces the right prompt at the right
                moment. No other venue platform connects sales and planning like
                this.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  "Enquiry",
                  "Nurture",
                  "Viewing",
                  "Proposal",
                  "Booking",
                  "Planning",
                  "Event day",
                  "Archive",
                ].map((stage, i, arr) => (
                  <span key={stage} className="flex items-center gap-1">
                    <span className="rounded-full bg-card px-2.5 py-0.5 text-xs font-medium text-foreground ring-1 ring-border">
                      {stage}
                    </span>
                    {i < arr.length - 1 && (
                      <ArrowRight className="size-3 text-muted-foreground" />
                    )}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Right: Chat panel                                                   */}
        {/* ------------------------------------------------------------------ */}
        <aside className="sticky top-6 self-start">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span className="flex size-6 items-center justify-center rounded-md bg-fun-pink text-fun-pink-foreground">
                  <Sparkles className="size-3.5" />
                </span>
                Chat with your Copilot
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Ask about any booking, lead or trend — answers pull from your
                live data.
              </p>
            </CardHeader>

            {/* Fixed height so the chat feels like a panel, not an overflow page */}
            <div className="h-[600px] overflow-hidden">
              <CopilotChat />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyInsights() {
  return (
    <div className="rounded-xl border border-border bg-card p-10 text-center shadow-xs">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-fun-pink text-fun-pink-foreground">
        <Sparkles className="size-6" />
      </span>
      <h3 className="text-base font-semibold text-foreground">
        All clear for now
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        The Copilot will surface action items, at-risk leads, and wins here as
        your pipeline moves. Check back after your next enquiry comes in.
      </p>
    </div>
  );
}
