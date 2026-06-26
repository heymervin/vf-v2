import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Banknote,
  Heart,
  Sparkles,
  ArrowRight,
  Clock,
} from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMinor } from "@/lib/money/proposal";
import { computeCopilotInsights } from "@/lib/copilot/load";

export const metadata = { title: "Dashboard" };

const OUTSTANDING = ["due", "overdue", "upcoming"];

function flat<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function formatDate(d: string | null): string {
  if (!d) return "Date TBC";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();
  const venueId = ctx.venue.id;
  const today = new Date().toISOString().slice(0, 10);
  // ponytail: UTC day window for "today's appointments" — fine for a dashboard
  // glance; switch to the venue timezone if it ever drifts visibly.
  const dayStart = `${today}T00:00:00.000Z`;
  const dayEnd = `${today}T23:59:59.999Z`;

  const [weddingsRes, milestonesRes, apptsRes, insights] = await Promise.all([
    supabase
      .from("weddings")
      .select("id")
      .eq("venue_id", venueId)
      .neq("status", "cancelled")
      .gte("wedding_date", today),
    supabase
      .from("payment_milestones")
      .select("id, label, amount_minor, due_date, status, wedding_id, weddings!inner(couple_names)")
      .eq("venue_id", venueId)
      .in("status", OUTSTANDING)
      .order("due_date", { ascending: true }),
    supabase
      .from("appointments")
      .select("id, starts_at, status, contact_id, contacts(first_name, last_name), meeting_types(kind)")
      .eq("venue_id", venueId)
      .neq("status", "cancelled")
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd)
      .order("starts_at", { ascending: true }),
    computeCopilotInsights(venueId),
  ]);

  const upcomingWeddings = weddingsRes.data?.length ?? 0;
  const milestones = milestonesRes.data ?? [];
  const outstandingMinor = milestones.reduce((sum, m) => sum + (m.amount_minor ?? 0), 0);
  const appts = apptsRes.data ?? [];
  const topInsights = insights.slice(0, 3);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back to ${ctx.venue.name}. Here's what needs you today.`}
      />

      {/* KPI strip */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          icon={<Heart className="size-4" />}
          tone="fun-pink"
          label="Upcoming weddings"
          value={String(upcomingWeddings)}
        />
        <Kpi
          icon={<Banknote className="size-4" />}
          tone="fun-green"
          label="Outstanding balance"
          value={formatMinor(outstandingMinor)}
        />
        <Kpi
          icon={<CalendarDays className="size-4" />}
          tone="fun-blue"
          label="Today's appointments"
          value={String(appts.length)}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <CardTitle className="text-base font-semibold">Today&apos;s appointments</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/appointments">View all <ArrowRight className="size-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {appts.length === 0 ? (
              <Empty>Nothing booked today.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {appts.map((a) => {
                  const c = flat(a.contacts);
                  const mt = flat(a.meeting_types);
                  const name = c
                    ? [c.first_name, c.last_name].filter(Boolean).join(" ")
                    : "—";
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums text-foreground">
                        <Clock className="size-3.5 text-muted-foreground" />
                        {formatTime(a.starts_at)}
                      </span>
                      <span className="truncate text-sm text-foreground">{name}</span>
                      {mt?.kind && (
                        <span className="ml-auto text-xs capitalize text-muted-foreground">
                          {mt.kind}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Copilot — top 3 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <CardTitle className="flex items-center gap-1.5 text-base font-semibold">
              <Sparkles className="size-4 text-fun-pink-strong" /> What needs attention
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/copilot">Open Copilot <ArrowRight className="size-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {topInsights.length === 0 ? (
              <Empty>You&apos;re all caught up. ✨</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {topInsights.map((i) => {
                  const body = (
                    <div className="flex items-start gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{i.title}</p>
                        {i.signal && (
                          <p className="truncate text-xs text-muted-foreground">{i.signal}</p>
                        )}
                      </div>
                      {i.actionHref && (
                        <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                  );
                  return i.actionHref ? (
                    <li key={i.id} className="transition-colors hover:bg-accent/40">
                      <Link href={i.actionHref}>{body}</Link>
                    </li>
                  ) : (
                    <li key={i.id}>{body}</li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Next payment milestones */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle className="text-base font-semibold">Next payments due</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/money">View money <ArrowRight className="size-3.5" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {milestones.length === 0 ? (
            <Empty>No outstanding payments.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {milestones.slice(0, 5).map((m) => {
                const w = flat(m.weddings);
                return (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <Link
                      href={`/weddings/${m.wedding_id}`}
                      className="truncate text-sm font-medium text-foreground hover:text-primary"
                    >
                      {w?.couple_names ?? "—"}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">{m.label}</span>
                    <span className="ml-auto text-sm font-medium tabular-nums text-foreground">
                      {formatMinor(m.amount_minor ?? 0)}
                    </span>
                    <span
                      className={
                        "w-24 text-right text-xs tabular-nums " +
                        (m.status === "overdue" ? "text-destructive" : "text-muted-foreground")
                      }
                    >
                      {formatDate(m.due_date)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: "fun-pink" | "fun-green" | "fun-blue";
  label: string;
  value: string;
}) {
  const toneClass = {
    "fun-pink": "bg-fun-pink text-fun-pink-foreground",
    "fun-green": "bg-fun-green text-fun-green-strong",
    "fun-blue": "bg-fun-blue text-fun-blue-strong",
  }[tone];
  return (
    <Card size="sm">
      <CardContent className="flex items-start gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 py-8 text-center text-sm text-muted-foreground">{children}</p>
  );
}
