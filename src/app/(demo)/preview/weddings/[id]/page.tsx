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
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  getWedding,
  gbp,
  daysFromToday,
  formatLongDate,
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
// Status helpers
// ---------------------------------------------------------------------------

function statusVariant(
  status: Wedding["status"],
): "outline" | "warning" | "pink" | "success" {
  switch (status) {
    case "planning":
      return "outline";
    case "final_details":
      return "warning";
    case "this_week":
      return "pink";
    case "completed":
      return "success";
  }
}

function statusLabel(status: Wedding["status"]): string {
  switch (status) {
    case "planning":
      return "Planning";
    case "final_details":
      return "Final details";
    case "this_week":
      return "This week";
    case "completed":
      return "Completed";
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "warning" | "pink";
}) {
  const valueClass =
    accent === "green"
      ? "text-fun-green-strong"
      : accent === "warning"
        ? "text-warning-foreground"
        : accent === "pink"
          ? "text-fun-pink-strong"
          : "text-foreground";

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <span
          className={`text-2xl font-bold tabular-nums tracking-tight ${valueClass}`}
        >
          {value}
        </span>
        {sub && (
          <span className="text-xs tabular-nums text-muted-foreground">{sub}</span>
        )}
      </CardContent>
    </Card>
  );
}

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

  const nextMilestone = wedding.payments.find(
    (p) => p.status === "due" || p.status === "upcoming",
  );

  // Planning tools counts
  const menuCourseCount = wedding.menu.length;

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <PageHeader
        title={wedding.coupleName}
        actions={
          <Badge variant={statusVariant(wedding.status)} className="text-sm px-3 py-1">
            {statusLabel(wedding.status)}
          </Badge>
        }
      />

      {/* Couple meta strip */}
      <div className="-mt-4 mb-8 flex flex-wrap items-center gap-x-5 gap-y-2">
        {days >= 0 ? (
          <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {days} days to go
          </span>
        ) : (
          <span className="text-3xl font-bold tracking-tight text-muted-foreground">
            Completed
          </span>
        )}
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          <span className="tabular-nums">{formatLongDate(wedding.date)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          {wedding.space}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" />
          {wedding.guestCount} guests
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Heart className="size-4 text-fun-pink-strong" />
          {wedding.packageName}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Stat cards row                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total value" value={gbp(wedding.totalValue)} />
        <StatCard
          label="Paid"
          value={gbp(wedding.paid)}
          sub={`${paidPct}% of total`}
          accent="green"
        />
        <StatCard
          label="Balance"
          value={gbp(balance)}
          sub={balance === 0 ? "Fully settled" : "Outstanding"}
          accent={balance > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Tasks"
          value={`${doneTasks}/${totalTasks}`}
          sub={doneTasks === totalTasks ? "All complete" : `${totalTasks - doneTasks} remaining`}
          accent={doneTasks === totalTasks ? "green" : undefined}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Key facts + Tasks                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Key facts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 className="size-4 text-fun-teal-strong" />
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

        {/* Task checklist */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="size-4 text-fun-blue-strong" />
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
      {/* Planning tools                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Planning tools
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          These tools show the primary wedding (Henderson &amp; Carter) in this
          prototype.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            {
              label: "Run-sheet",
              href: "/preview/runsheet",
              icon: Clock,
              count: wedding.runsheet.length,
              unit: "items",
              color: "bg-fun-teal text-foreground",
              iconColor: "text-fun-teal-strong",
            },
            {
              label: "Floor plan",
              href: "/preview/floorplan",
              icon: Grid3x3,
              count: null,
              unit: null,
              color: "bg-fun-blue text-foreground",
              iconColor: "text-fun-blue-strong",
            },
            {
              label: "Guests",
              href: "/preview/guests",
              icon: UserCheck,
              count: wedding.guests.length,
              unit: "guests",
              color: "bg-fun-pink text-fun-pink-foreground",
              iconColor: "text-fun-pink-strong",
            },
            {
              label: "Menu",
              href: "/preview/menu",
              icon: Utensils,
              count: menuCourseCount,
              unit: "courses",
              color: "bg-fun-green text-foreground",
              iconColor: "text-fun-green-strong",
            },
            {
              label: "Suppliers",
              href: "/preview/suppliers",
              icon: Truck,
              count: wedding.suppliers.length,
              unit: "suppliers",
              color: "bg-accent text-accent-foreground",
              iconColor: "text-primary",
            },
          ].map(({ label, href, icon: Icon, count, unit, color, iconColor }) => (
            <Link key={href} href={href} className="group">
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="flex flex-col items-start gap-3 py-5">
                  <span
                    className={`flex size-10 items-center justify-center rounded-lg ${color}`}
                  >
                    <Icon className={`size-5 ${iconColor}`} />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                      {label}
                      <ArrowRight className="size-3 -translate-x-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </p>
                    {count !== null && unit && (
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {count} {unit}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
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
            <ul className="divide-y divide-border">
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
                      Due {formatLongDate(pm.dueDate)}
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

            {/* Next milestone callout */}
            {nextMilestone && (
              <div className="mt-4 flex items-center justify-between rounded-lg bg-warning/30 px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-warning-foreground">
                    Next milestone
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {nextMilestone.label} —{" "}
                    <span className="tabular-nums">{gbp(nextMilestone.amount)}</span>
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    Due {formatLongDate(nextMilestone.dueDate)}
                  </p>
                </div>
                <Link
                  href="/preview/money"
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <Banknote className="size-4" />
                  View payments
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
