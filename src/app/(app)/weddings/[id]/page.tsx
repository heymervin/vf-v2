import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  Users,
  Heart,
  Clock,
  Grid3x3,
  UserCheck,
  Utensils,
  Truck,
  ArrowRight,
  Globe,
  FileCheck2,
  CreditCard,
  MessageCircle,
} from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WeddingStatusBadge } from "@/components/status-badges";
import { NextActionCallout } from "@/components/next-action-callout";
import { pickNextAction } from "@/lib/weddings/next-action";
import { WeddingTasks } from "./wedding-tasks";

// ── Types ────────────────────────────────────────────────────────────────────

type WeddingStatus = "planning" | "confirmed" | "completed" | "cancelled";

function toSafeStatus(s: string): WeddingStatus {
  if (
    s === "planning" ||
    s === "confirmed" ||
    s === "completed" ||
    s === "cancelled"
  )
    return s;
  return "planning";
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Quick read — no auth needed for title generation
  const { createClient: mkClient } = await import("@/lib/supabase/server");
  const supabase = await mkClient();
  const { data } = await supabase
    .from("weddings")
    .select("couple_names")
    .eq("id", id)
    .maybeSingle();
  return {
    title: data ? `${data.couple_names} — Wedding` : "Wedding workspace",
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysFromToday(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Date TBC";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Status strip ─────────────────────────────────────────────────────────────

function StatusStrip({
  weddingDate,
  paidMinor,
  totalMinor,
  balanceMinor,
  taskDone,
  taskTotal,
}: {
  weddingDate: string | null;
  paidMinor: number;
  totalMinor: number;
  balanceMinor: number;
  taskDone: number;
  taskTotal: number;
}) {
  const days = daysFromToday(weddingDate);

  function fmt(minor: number): string {
    return (minor / 100).toLocaleString("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
    });
  }

  return (
    <div className="mb-6 grid grid-cols-2 gap-px rounded-xl border border-border bg-border sm:grid-cols-4">
      {/* Days to go */}
      <div className="flex flex-col gap-0.5 rounded-l-xl bg-card px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {days !== null && days >= 0 ? "Days to go" : "Status"}
        </span>
        <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
          {days === null ? "—" : days >= 0 ? days : "Done"}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatDate(weddingDate)}
        </span>
      </div>

      {/* Payments — Slice 5 */}
      <div className="flex flex-col gap-0.5 bg-card px-4 py-3 sm:rounded-none">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Paid
        </span>
        <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
          {totalMinor > 0 ? fmt(paidMinor) : "—"}
        </span>
        <span className="text-xs text-muted-foreground">
          {totalMinor > 0 ? `of ${fmt(totalMinor)}` : "No milestones yet"}
        </span>
      </div>

      {/* Balance */}
      <div className="flex flex-col gap-0.5 bg-card px-4 py-3 sm:rounded-none">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Balance
        </span>
        <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
          {totalMinor > 0 ? fmt(balanceMinor) : "—"}
        </span>
        <span className="text-xs text-muted-foreground">
          {totalMinor > 0 ? "outstanding" : "No milestones yet"}
        </span>
      </div>

      {/* Tasks */}
      <div className="flex flex-col gap-0.5 rounded-r-xl bg-card px-4 py-3 sm:rounded-l-none">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Tasks
        </span>
        <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
          {taskTotal > 0 ? `${taskDone}/${taskTotal}` : "—"}
        </span>
        <span className="text-xs text-muted-foreground">
          {taskTotal > 0 ? "complete" : "No tasks yet"}
        </span>
      </div>
    </div>
  );
}

// ── Planning rail ─────────────────────────────────────────────────────────────

interface PlanningTileConfig {
  label: string;
  href: string;
  icon: React.ElementType;
  accent: string;
  iconColor: string;
  /** Human-readable count label shown beneath the tool name. */
  countLabel: string;
  /** When set, the tile is locked and this is the reason shown. */
  lockedReason?: string;
  /** Deep-link for the locked state "fix" call-to-action. */
  lockedHref?: string;
}

function PlanningRail({ tiles }: { tiles: PlanningTileConfig[] }) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
      role="list"
      aria-label="Planning tools"
    >
      {tiles.map((tile) => {
        const { label, href, icon: Icon, accent, iconColor, countLabel, lockedReason, lockedHref } = tile;

        if (lockedReason) {
          return (
            <div
              key={href}
              role="listitem"
              className="flex min-w-[148px] shrink-0 flex-col gap-1.5 rounded-xl border border-border bg-card/60 px-4 py-3 opacity-60 cursor-not-allowed min-h-[72px]"
              title={lockedReason}
              aria-disabled="true"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${accent} opacity-50`}
                >
                  <Icon className={`size-4 ${iconColor}`} aria-hidden />
                </span>
                <p className="text-sm font-medium text-foreground whitespace-nowrap">{label}</p>
              </div>
              {lockedHref ? (
                <Link
                  href={lockedHref}
                  className="text-[10px] text-primary hover:underline leading-tight"
                  title={`Go to ${lockedReason}`}
                >
                  {lockedReason}
                </Link>
              ) : (
                <p className="text-[10px] text-muted-foreground leading-tight">{lockedReason}</p>
              )}
            </div>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            role="listitem"
            className="group flex min-w-[148px] shrink-0 flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:border-foreground/20 hover:shadow-sm min-h-[72px]"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${accent}`}
              >
                <Icon className={`size-4 ${iconColor}`} aria-hidden />
              </span>
              <p className="text-sm font-medium text-foreground whitespace-nowrap">{label}</p>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">{countLabel}</p>
          </Link>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function WeddingHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();

  // Load wedding scoped to this venue (RLS + explicit eq)
  const { data: wedding, error } = await supabase
    .from("weddings")
    .select(
      `id, couple_names, wedding_date, status, guest_count_day, guest_count_evening,
       total_value_minor, space_id, source, portal_active, portal_last_seen_at,
       coordinator_membership_id, notes, custom, package_name, ghl_contact_id,
       spaces(name)`,
    )
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (error) {
    console.error("wedding hub load error:", error.message);
  }

  if (!wedding) notFound();

  const days = daysFromToday(wedding.wedding_date);
  const spaceName =
    wedding.spaces && !Array.isArray(wedding.spaces)
      ? wedding.spaces.name
      : null;

  const guestLabel = (() => {
    if (wedding.guest_count_day != null && wedding.guest_count_evening != null) {
      return `${wedding.guest_count_day} day · ${wedding.guest_count_evening} eve`;
    }
    if (wedding.guest_count_day != null) return `${wedding.guest_count_day} guests`;
    if (wedding.guest_count_evening != null)
      return `${wedding.guest_count_evening} guests`;
    return null;
  })();

  // Custom key facts — cast the jsonb safely
  type KeyFact = { label: string; value: string };
  const keyFacts: KeyFact[] = Array.isArray(wedding.custom)
    ? (wedding.custom as unknown as KeyFact[]).filter(
        (f): f is KeyFact =>
          typeof f === "object" &&
          f !== null &&
          "label" in f &&
          "value" in f,
      )
    : [];

  // ── Planning-rail data (counts + gating) ──────────────────────────────────
  // All queries are parallel — each is a cheap count-only fetch.
  const [
    { count: guestTotal },
    { count: guestConfirmed },
    { count: menuSelections },
    { count: runsheetItems },
    { count: supplierCount },
    { count: activeMenuItems },
    { count: floorTemplates },
    { count: milestoneCount },
    { data: milestoneTotals },
    { data: taskRows },
  ] = await Promise.all([
    // Guests: total invited
    supabase
      .from("wedding_guests")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", id),
    // Guests: confirmed (rsvp = yes)
    supabase
      .from("wedding_guests")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", id)
      .eq("rsvp", "yes"),
    // Menu: items selected for this wedding
    supabase
      .from("wedding_menu_selections")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", id),
    // Run sheet: timeline events
    supabase
      .from("timeline_events")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", id),
    // Suppliers: attached to this wedding
    supabase
      .from("wedding_suppliers")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", id),
    // Gating — Menu: venue has at least one active menu item
    supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", ctx.venue.id)
      .eq("is_active", true),
    // Gating — Floor plan: wedding's space has at least one floor template
    wedding.space_id
      ? supabase
          .from("floor_templates")
          .select("id", { count: "exact", head: true })
          .eq("space_id", wedding.space_id)
          .eq("venue_id", ctx.venue.id)
      : Promise.resolve({ count: 0 }),
    // Payments: milestone count
    supabase
      .from("payment_milestones")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", id),
    // Payments: amount_minor + status (+ due_date/label for the next-action ladder)
    supabase
      .from("payment_milestones")
      .select("amount_minor, status, due_date, label")
      .eq("wedding_id", id)
      .order("sort_order"),
    // Tasks: live checklist + next-action source
    supabase
      .from("wedding_tasks")
      .select("id, title, due_date, done")
      .eq("wedding_id", id)
      .order("sort_index"),
  ]);

  // Derive paid / balance from milestone rows
  const milestoneRows = (milestoneTotals ?? []) as {
    amount_minor: number;
    status: string;
    due_date: string;
    label: string;
  }[];
  const totalMinor = milestoneRows.reduce((s, m) => s + m.amount_minor, 0);
  const paidMinor = milestoneRows
    .filter((m) => m.status === "paid")
    .reduce((s, m) => s + m.amount_minor, 0);
  const balanceMinor = totalMinor - paidMinor;

  function formatMinor(minor: number): string {
    return (minor / 100).toLocaleString("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
    });
  }

  const base = `/weddings/${id}`;

  // ── Tasks + next action ────────────────────────────────────────────────────
  const tasks = (taskRows ?? []) as {
    id: string;
    title: string;
    due_date: string | null;
    done: boolean;
  }[];
  const tasksDone = tasks.filter((t) => t.done).length;
  const today = new Date().toISOString().slice(0, 10);
  const nextAction = pickNextAction(
    tasks.map((t) => ({ title: t.title, due_date: t.due_date, done: t.done })),
    milestoneRows.map((m) => ({ label: m.label, status: m.status, due_date: m.due_date })),
    base,
    today,
  );

  const planningTiles: PlanningTileConfig[] = [
    {
      label: "Guests",
      href: `${base}/guests`,
      icon: UserCheck,
      accent: "bg-fun-pink text-fun-pink-foreground",
      iconColor: "text-fun-pink-strong",
      countLabel:
        (guestTotal ?? 0) === 0
          ? "No guests yet"
          : `${guestConfirmed ?? 0} confirmed · ${guestTotal ?? 0} invited`,
    },
    {
      label: "Menu",
      href: `${base}/menu`,
      icon: Utensils,
      accent: "bg-fun-green text-foreground",
      iconColor: "text-fun-green-strong",
      countLabel:
        (menuSelections ?? 0) === 0
          ? "No items selected"
          : `${menuSelections} item${menuSelections === 1 ? "" : "s"} selected`,
      ...((activeMenuItems ?? 0) === 0
        ? {
            lockedReason: "Add menu items in Settings",
            lockedHref: "/settings/menu",
          }
        : {}),
    },
    {
      label: "Run sheet",
      href: `${base}/runsheet`,
      icon: Clock,
      accent: "bg-fun-teal text-foreground",
      iconColor: "text-fun-teal-strong",
      countLabel:
        (runsheetItems ?? 0) === 0
          ? "No events yet"
          : `${runsheetItems} event${runsheetItems === 1 ? "" : "s"}`,
    },
    {
      label: "Floor plan",
      href: `${base}/floorplan`,
      icon: Grid3x3,
      accent: "bg-fun-blue text-foreground",
      iconColor: "text-fun-blue-strong",
      countLabel: `${guestConfirmed ?? 0} guests to seat`,
      ...((floorTemplates ?? 0) === 0
        ? {
            lockedReason: "Add a floor template in Settings",
            lockedHref: "/settings/spaces",
          }
        : {}),
    },
    {
      label: "Suppliers",
      href: `${base}/suppliers`,
      icon: Truck,
      accent: "bg-accent text-accent-foreground",
      iconColor: "text-primary",
      countLabel:
        (supplierCount ?? 0) === 0
          ? "None attached yet"
          : `${supplierCount} supplier${supplierCount === 1 ? "" : "s"}`,
    },
    // Slice 6 — Messaging mirror (Integration Point 3, specs/ghl-integration.md §7)
    // Linked to /weddings/[id]/messages; gracefully degrades when GHL is not connected.
    {
      label: "Messages",
      href: `${base}/messages`,
      icon: MessageCircle,
      accent: "bg-fun-pink text-fun-pink-foreground",
      iconColor: "text-fun-pink-strong",
      countLabel: wedding.ghl_contact_id
        ? "View GHL conversations"
        : "Connect GHL to view",
    },
    {
      label: "Payments",
      href: `${base}/payments`,
      icon: CreditCard,
      accent: "bg-fun-teal text-foreground",
      iconColor: "text-fun-teal-strong",
      countLabel:
        (milestoneCount ?? 0) === 0
          ? "No milestones yet"
          : `${milestoneCount} milestone${milestoneCount === 1 ? "" : "s"}`,
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title={wedding.couple_names}
        actions={
          <div className="flex items-center gap-2">
            <WeddingStatusBadge status={toSafeStatus(wedding.status)} />
            {wedding.portal_active && (
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

      {/* ── Couple meta strip ────────────────────────────────────────────── */}
      <div className="-mt-4 mb-6 flex flex-wrap items-center gap-x-5 gap-y-2">
        {days !== null && days >= 0 ? (
          <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {days} days to go
          </span>
        ) : (
          <span className="text-2xl font-bold tracking-tight text-muted-foreground">
            {days !== null ? "Completed" : "Date TBC"}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="size-4 shrink-0" aria-hidden />
          <span className="tabular-nums">{formatDate(wedding.wedding_date)}</span>
        </span>
        {spaceName && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {spaceName}
          </span>
        )}
        {guestLabel && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4 shrink-0" aria-hidden />
            {guestLabel}
          </span>
        )}
        {wedding.package_name && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Heart className="size-4 shrink-0 text-fun-pink-strong" aria-hidden />
            {wedding.package_name}
          </span>
        )}
      </div>

      {/* ── Next action ─────────────────────────────────────────────────── */}
      <NextActionCallout {...nextAction} className="mb-6" />

      {/* ── Status strip ────────────────────────────────────────────────── */}
      <StatusStrip
        weddingDate={wedding.wedding_date}
        paidMinor={paidMinor}
        totalMinor={totalMinor}
        balanceMinor={balanceMinor}
        taskDone={tasksDone}
        taskTotal={tasks.length}
      />

      {/* ── Planning rail (D7 — scoped to this wedding) ─────────────────── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Planning tools
          </h2>
          <p className="text-xs text-muted-foreground">
            {wedding.couple_names} workspace
          </p>
        </div>
        <PlanningRail tiles={planningTiles} />
      </div>

      {/* ── Key facts + Notes ────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Key facts — from custom jsonb or inline details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 className="size-4 text-fun-teal-strong" aria-hidden />
              Key facts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {keyFacts.length === 0 ? (
              <div className="space-y-2.5">
                {/* Always show the fixed facts from the wedding row itself */}
                {wedding.wedding_date && (
                  <KeyFactRow
                    label="Date"
                    value={formatDate(wedding.wedding_date)}
                  />
                )}
                {spaceName && (
                  <KeyFactRow label="Space" value={spaceName} />
                )}
                {wedding.package_name && (
                  <KeyFactRow label="Package" value={wedding.package_name} />
                )}
                {guestLabel && (
                  <KeyFactRow label="Guests" value={guestLabel} />
                )}
                {wedding.source && (
                  <KeyFactRow
                    label="Source"
                    value={wedding.source === "ghl_webhook" ? "GHL booking" : "Manual"}
                  />
                )}
              </div>
            ) : (
              <dl className="divide-y divide-border">
                {keyFacts.map((f) => (
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
            )}
          </CardContent>
        </Card>

        {/* Tasks — live checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="size-4 text-fun-blue-strong" aria-hidden />
              Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WeddingTasks tasks={tasks} />
          </CardContent>
        </Card>
      </div>

      {/* ── Payments mini-summary ────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Payments</h2>
          <Link
            href={`/weddings/${id}/payments`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Manage
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <Card>
          <CardContent className="py-4">
            {(milestoneCount ?? 0) === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CreditCard className="size-8 text-muted-foreground/40" aria-hidden />
                <p className="text-sm text-muted-foreground">No payment milestones yet.</p>
                <Link
                  href={`/weddings/${id}/payments`}
                  className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <ArrowRight className="size-3.5" aria-hidden />
                  Add milestones
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Milestones
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {milestoneCount}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Paid
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {(paidMinor / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" })}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Balance
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {(balanceMinor / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" })}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Small helper component ────────────────────────────────────────────────────

function KeyFactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}
