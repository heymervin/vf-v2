import type * as React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  MapPin,
  Users,
  Clock,
  Grid3x3,
  UserCheck,
  Utensils,
  Truck,
  Banknote,
  ArrowRight,
  CalendarDays,
  FileCheck2,
  MessageSquare,
  ExternalLink,
  Globe,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { NextActionCallout } from "@/components/next-action-callout";
import { WeddingStatusBadge } from "@/components/status-badges";
import {
  getWedding,
  gbp,
  daysFromToday,
  formatLongDate,
  teamMember,
  type Wedding,
} from "@/lib/mock";
import { TaskList } from "./task-list";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wedding = getWedding(id);
  return { title: wedding ? `${wedding.coupleName} — Wedding` : "Not found" };
}

// ---------------------------------------------------------------------------
// Next-action derivation (drives the callout + urgency)
// ---------------------------------------------------------------------------

interface HubAction {
  severity: "info" | "warning" | "destructive" | "success";
  title: string;
  detail?: string;
  href?: string;
  actionLabel?: string;
}

function deriveNextAction(wedding: Wedding): HubAction | null {
  // 1. Overdue payments — highest urgency
  const overdue = wedding.payments.find((p) => p.status === "overdue");
  if (overdue) {
    return {
      severity: "destructive",
      title: `Payment overdue — ${overdue.label}`,
      detail: `${gbp(overdue.amount)} was due ${formatLongDate(overdue.dueDate)}. Chase the couple now.`,
      href: "/preview/money",
      actionLabel: "View payments",
    };
  }

  // 2. Payment due (within ~30 days)
  const due = wedding.payments.find((p) => p.status === "due");
  if (due) {
    const days = daysFromToday(due.dueDate);
    return {
      severity: "warning",
      title: `Payment due — ${due.label}`,
      detail: `${gbp(due.amount)} due ${formatLongDate(due.dueDate)} (${days >= 0 ? `in ${days} days` : "overdue"}).`,
      href: "/preview/money",
      actionLabel: "View payments",
    };
  }

  // 3. Overdue task
  const overdueTask = wedding.tasks
    .filter((t) => !t.done && t.dueDate && daysFromToday(t.dueDate) < 0)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0];
  if (overdueTask) {
    return {
      severity: "warning",
      title: `Task overdue — ${overdueTask.label}`,
      detail: `Was due ${formatLongDate(overdueTask.dueDate!)}. Mark complete or update the date.`,
    };
  }

  // 4. Next task due within 30 days
  const nearTask = wedding.tasks
    .filter((t) => !t.done && t.dueDate)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .find((t) => {
      const d = daysFromToday(t.dueDate!);
      return d >= 0 && d <= 30;
    });
  if (nearTask) {
    const days = daysFromToday(nearTask.dueDate!);
    return {
      severity: "info",
      title: `Coming up — ${nearTask.label}`,
      detail: `Due in ${days} day${days === 1 ? "" : "s"} (${formatLongDate(nearTask.dueDate!)}).`,
    };
  }

  // 5. Upcoming payment within 90 days
  const upcoming = wedding.payments
    .filter((p) => p.status === "upcoming")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (upcoming) {
    const days = daysFromToday(upcoming.dueDate);
    if (days >= 0 && days <= 90) {
      return {
        severity: "info",
        title: `Upcoming payment — ${upcoming.label}`,
        detail: `${gbp(upcoming.amount)} due in ${days} days (${formatLongDate(upcoming.dueDate)}).`,
        href: "/preview/money",
        actionLabel: "View payments",
      };
    }
  }

  // 6. All done — positive signal
  const allPaid = wedding.payments.every((p) => p.status === "paid");
  const allTasksDone = wedding.tasks.every((t) => t.done);
  if (allPaid && allTasksDone) {
    return {
      severity: "success",
      title: "All payments settled and tasks complete",
      detail: "Everything is in order for this wedding.",
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Status strip (replaces the 4 identical stat cards)
// ---------------------------------------------------------------------------

function StatusStrip({ wedding }: { wedding: Wedding }) {
  const paidPct = Math.round((wedding.paid / wedding.totalValue) * 100);
  const balance = wedding.totalValue - wedding.paid;
  const doneTasks = wedding.tasks.filter((t) => t.done).length;
  const totalTasks = wedding.tasks.length;
  const pendingDocs = wedding.docs.filter(
    (d) => d.status === "missing" || d.status === "draft",
  ).length;
  const days = daysFromToday(wedding.date);

  return (
    <div className="mb-6 grid grid-cols-2 gap-px rounded-xl border border-border bg-border sm:grid-cols-4">
      {/* Days to go */}
      <div className="flex flex-col gap-0.5 rounded-l-xl bg-card px-4 py-3 sm:rounded-l-xl sm:rounded-r-none">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {days >= 0 ? "Days to go" : "Status"}
        </span>
        <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
          {days >= 0 ? days : "Done"}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatLongDate(wedding.date)}
        </span>
      </div>

      {/* Payment progress */}
      <div className="flex flex-col gap-0.5 bg-card px-4 py-3 sm:rounded-none">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Paid
        </span>
        <span className="text-2xl font-bold tabular-nums tracking-tight text-fun-green-strong">
          {paidPct}%
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {gbp(wedding.paid)} of {gbp(wedding.totalValue)}
        </span>
        <Progress value={paidPct} className="mt-1 h-1" />
      </div>

      {/* Balance */}
      <div className="flex flex-col gap-0.5 bg-card px-4 py-3 sm:rounded-none">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Balance
        </span>
        <span
          className={`text-2xl font-bold tabular-nums tracking-tight ${balance > 0 ? "text-warning-foreground" : "text-fun-green-strong"}`}
        >
          {gbp(balance)}
        </span>
        <span className="text-xs text-muted-foreground">
          {balance === 0 ? "Fully settled" : "Outstanding"}
        </span>
      </div>

      {/* Tasks + docs */}
      <div className="flex flex-col gap-0.5 rounded-r-xl bg-card px-4 py-3 sm:rounded-l-none sm:rounded-r-xl">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Tasks
        </span>
        <span
          className={`text-2xl font-bold tabular-nums tracking-tight ${
            doneTasks === totalTasks ? "text-fun-green-strong" : "text-foreground"
          }`}
        >
          {doneTasks}/{totalTasks}
        </span>
        <span className="text-xs text-muted-foreground">
          {doneTasks === totalTasks
            ? "All complete"
            : `${totalTasks - doneTasks} remaining`}
          {pendingDocs > 0 && ` · ${pendingDocs} doc${pendingDocs > 1 ? "s" : ""} needed`}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Planning rail (horizontal, replaces icon grid)
// ---------------------------------------------------------------------------

interface PlanningTool {
  label: string;
  href: string;
  icon: React.ElementType;
  count: number | null;
  unit: string | null;
  accent: string;
  iconColor: string;
}

function PlanningRail({
  tools,
}: {
  tools: PlanningTool[];
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
      role="list"
      aria-label="Planning tools"
    >
      {tools.map(({ label, href, icon: Icon, count, unit, accent, iconColor }) => (
        <Link
          key={href}
          href={href}
          role="listitem"
          className="group flex min-w-[120px] shrink-0 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-md min-h-[56px]"
        >
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${accent}`}
          >
            <Icon className={`size-4 ${iconColor}`} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-0.5 text-sm font-medium text-foreground whitespace-nowrap">
              {label}
              <ArrowRight className="size-3 -translate-x-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </p>
            {count !== null && unit && (
              <p className="text-xs tabular-nums text-muted-foreground">
                {count} {unit}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Milestone status badge
// ---------------------------------------------------------------------------

function MilestoneStatusBadge({
  status,
}: {
  status: "paid" | "due" | "upcoming" | "overdue";
}) {
  switch (status) {
    case "paid":
      return <Badge variant="success">Paid</Badge>;
    case "due":
      return <Badge variant="warning">Due</Badge>;
    case "overdue":
      return <Badge variant="destructive">Overdue</Badge>;
    case "upcoming":
      return <Badge variant="outline">Upcoming</Badge>;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WeddingHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wedding = getWedding(id);

  if (!wedding) notFound();

  const days = daysFromToday(wedding.date);
  const paidPct = Math.round((wedding.paid / wedding.totalValue) * 100);
  const balance = wedding.totalValue - wedding.paid;

  const doneTasks = wedding.tasks.filter((t) => t.done).length;
  const totalTasks = wedding.tasks.length;

  const nextAction = deriveNextAction(wedding);
  const coordinator = wedding.coordinatorId
    ? teamMember(wedding.coordinatorId)
    : undefined;

  // Planning tools
  const menuCourseCount = wedding.menu.length;

  const planningTools: PlanningTool[] = [
    {
      label: "Run-sheet",
      href: "/preview/runsheet",
      icon: Clock,
      count: wedding.runsheet.length,
      unit: "items",
      accent: "bg-fun-teal text-foreground",
      iconColor: "text-fun-teal-strong",
    },
    {
      label: "Floor plan",
      href: "/preview/floorplan",
      icon: Grid3x3,
      count: null,
      unit: null,
      accent: "bg-fun-blue text-foreground",
      iconColor: "text-fun-blue-strong",
    },
    {
      label: "Guests",
      href: "/preview/guests",
      icon: UserCheck,
      count: wedding.guests.length,
      unit: "guests",
      accent: "bg-fun-pink text-fun-pink-foreground",
      iconColor: "text-fun-pink-strong",
    },
    {
      label: "Menu",
      href: "/preview/menu",
      icon: Utensils,
      count: menuCourseCount,
      unit: "courses",
      accent: "bg-fun-green text-foreground",
      iconColor: "text-fun-green-strong",
    },
    {
      label: "Suppliers",
      href: "/preview/suppliers",
      icon: Truck,
      count: wedding.suppliers.length,
      unit: "suppliers",
      accent: "bg-accent text-accent-foreground",
      iconColor: "text-primary",
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <PageHeader
        title={wedding.coupleName}
        actions={
          <div className="flex items-center gap-2">
            <WeddingStatusBadge status={wedding.status} />
            {wedding.contactId && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/preview/contacts/${wedding.contactId}`}>
                  <ExternalLink className="size-3.5" aria-hidden />
                  Contact
                </Link>
              </Button>
            )}
            {wedding.portalActive && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal">
                  <Globe className="size-3.5" aria-hidden />
                  Portal
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {/* Couple meta strip */}
      <div className="-mt-4 mb-6 flex flex-wrap items-center gap-x-5 gap-y-2">
        {days >= 0 ? (
          <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {days} days to go
          </span>
        ) : (
          <span className="text-2xl font-bold tracking-tight text-muted-foreground">
            Completed
          </span>
        )}
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="size-4 shrink-0" aria-hidden />
          <span className="tabular-nums">{formatLongDate(wedding.date)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden />
          {wedding.space}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4 shrink-0" aria-hidden />
          {wedding.guestCount} guests
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Heart className="size-4 shrink-0 text-fun-pink-strong" aria-hidden />
          {wedding.packageName}
        </span>
        {coordinator && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <UserCheck className="size-4 shrink-0" aria-hidden />
            {coordinator.name}
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Next-action callout                                                 */}
      {/* ------------------------------------------------------------------ */}
      {nextAction && (
        <div className="mb-6">
          <NextActionCallout
            severity={nextAction.severity}
            title={nextAction.title}
            detail={nextAction.detail}
            href={nextAction.href}
            actionLabel={nextAction.actionLabel}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Status strip (replaces 4 identical stat cards)                     */}
      {/* ------------------------------------------------------------------ */}
      <StatusStrip wedding={wedding} />

      {/* ------------------------------------------------------------------ */}
      {/* Planning rail                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Planning tools
          </h2>
          <p className="text-xs text-muted-foreground">
            Showing {wedding.coupleName} workspace
          </p>
        </div>
        <PlanningRail tools={planningTools} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Cross-links: inbox thread + contact record                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href={`/preview/inbox`}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-all hover:shadow-sm hover:-translate-y-0.5"
        >
          <MessageSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          Inbox thread
          <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
        </Link>
        {wedding.contactId && (
          <Link
            href={`/preview/contacts/${wedding.contactId}`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-all hover:shadow-sm hover:-translate-y-0.5"
          >
            <UserCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Contact record
            <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
          </Link>
        )}
        {wedding.portalActive && (
          <Link
            href="/portal"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-all hover:shadow-sm hover:-translate-y-0.5"
          >
            <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Couple portal
            {wedding.portalLastSeen && (
              <span className="text-xs text-muted-foreground">
                · last seen {formatLongDate(wedding.portalLastSeen.split("T")[0])}
              </span>
            )}
            <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
          </Link>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Key facts + Tasks                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Key facts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 className="size-4 text-fun-teal-strong" aria-hidden />
              Key facts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              {wedding.keyFacts.map((f) => (
                <div
                  key={f.label}
                  className="flex min-h-[44px] items-center justify-between gap-4 py-2.5"
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {f.label}
                  </dt>
                  <dd className="text-right text-sm font-medium text-foreground">
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Task checklist — interactive via TaskList client component */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="size-4 text-fun-blue-strong" aria-hidden />
                Tasks
              </CardTitle>
              <span className="text-xs tabular-nums text-muted-foreground">
                {doneTasks}/{totalTasks} done
              </span>
            </div>
            <Progress
              value={totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}
              className="mt-2 h-1.5"
            />
          </CardHeader>
          <CardContent>
            {wedding.tasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No tasks yet — tasks are created automatically when you move a
                couple to Wedding booked.
              </p>
            ) : (
              <TaskList tasks={wedding.tasks} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Payments mini-summary                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Payments
        </h2>
        <Card>
          <CardContent>
            {/* Progress bar */}
            <div className="mb-4 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Payment progress</span>
                <span className="tabular-nums font-semibold text-foreground">
                  {gbp(wedding.paid)}{" "}
                  <span className="font-normal text-muted-foreground">
                    of {gbp(wedding.totalValue)}
                  </span>
                </span>
              </div>
              <Progress value={paidPct} className="h-2" />
              <p className="text-xs tabular-nums text-muted-foreground">
                {paidPct}% paid · {gbp(balance)} outstanding
              </p>
            </div>

            {/* Milestone list */}
            <ul className="divide-y divide-border" aria-label="Payment milestones">
              {wedding.payments.map((pm) => (
                <li
                  key={pm.id}
                  className="flex min-h-[44px] items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {pm.label}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {pm.status === "paid" && pm.paidOn
                        ? `Paid ${formatLongDate(pm.paidOn)}`
                        : `Due ${formatLongDate(pm.dueDate)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums text-sm font-semibold text-foreground">
                      {gbp(pm.amount)}
                    </span>
                    <MilestoneStatusBadge status={pm.status} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Link to full payments page */}
            <div className="mt-4 flex justify-end">
              <Link
                href="/preview/money"
                className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Banknote className="size-4" aria-hidden />
                View all payments
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
