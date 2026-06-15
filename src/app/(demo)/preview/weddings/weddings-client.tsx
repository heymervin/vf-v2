"use client";

import * as React from "react";
import Link from "next/link";
import {
  Heart,
  MapPin,
  Users,
  ArrowRight,
  AlertCircle,
  CalendarDays,
  Banknote,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SmartListBar } from "@/components/smart-list-bar";
import { DataToolbar } from "@/components/data-toolbar";
import { WeddingStatusBadge } from "@/components/status-badges";
import { gbp, daysFromToday, formatLongDate, type Wedding } from "@/lib/mock";
import { cn } from "@/lib/utils";

// ─── Smart list definitions ──────────────────────────────────────────────────

function buildLists(weddings: Wedding[]) {
  const now = new Date();

  // "This month" = wedding date in the same calendar month as today
  const thisMonth = weddings.filter((w) => {
    const d = new Date(w.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  // "Awaiting numbers" = has a task with label containing "numbers" not done
  const awaitingNumbers = weddings.filter((w) =>
    w.tasks.some(
      (t) =>
        !t.done &&
        (t.label.toLowerCase().includes("numbers") ||
          t.label.toLowerCase().includes("guest")),
    ),
  );

  // "Balance due" = has a payment milestone with status "due" or "overdue"
  const balanceDue = weddings.filter((w) =>
    w.payments.some((p) => p.status === "due" || p.status === "overdue"),
  );

  return [
    { id: "all", name: "All", count: weddings.length },
    { id: "this_month", name: "This month", count: thisMonth.length },
    {
      id: "awaiting_numbers",
      name: "Awaiting numbers",
      count: awaitingNumbers.length,
    },
    { id: "balance_due", name: "Balance due", count: balanceDue.length },
  ];
}

function filterByList(weddings: Wedding[], listId: string): Wedding[] {
  const now = new Date();
  switch (listId) {
    case "this_month":
      return weddings.filter((w) => {
        const d = new Date(w.date);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      });
    case "awaiting_numbers":
      return weddings.filter((w) =>
        w.tasks.some(
          (t) =>
            !t.done &&
            (t.label.toLowerCase().includes("numbers") ||
              t.label.toLowerCase().includes("guest")),
        ),
      );
    case "balance_due":
      return weddings.filter((w) =>
        w.payments.some((p) => p.status === "due" || p.status === "overdue"),
      );
    default:
      return weddings;
  }
}

function filterBySearch(weddings: Wedding[], query: string): Wedding[] {
  if (!query.trim()) return weddings;
  const q = query.toLowerCase();
  return weddings.filter(
    (w) =>
      w.coupleName.toLowerCase().includes(q) ||
      w.space.toLowerCase().includes(q) ||
      w.packageName.toLowerCase().includes(q),
  );
}

function sortWeddings(
  weddings: Wedding[],
  sortKey: string,
): Wedding[] {
  return [...weddings].sort((a, b) => {
    switch (sortKey) {
      case "date_asc":
        return a.date.localeCompare(b.date);
      case "date_desc":
        return b.date.localeCompare(a.date);
      case "name_asc":
        return a.coupleName.localeCompare(b.coupleName);
      case "balance_desc":
        return b.totalValue - b.paid - (a.totalValue - a.paid);
      default:
        return a.date.localeCompare(b.date);
    }
  });
}

// ─── Urgency derivation ──────────────────────────────────────────────────────

interface UrgencySignal {
  label: string;
  daysUntil: number | null; // null = overdue or already done
  isOverdue: boolean;
  amount?: number;
}

function getUrgency(wedding: Wedding): UrgencySignal | null {
  // Check for overdue payments first (highest urgency)
  const overduePay = wedding.payments.find((p) => p.status === "overdue");
  if (overduePay) {
    return {
      label: overduePay.label,
      daysUntil: null,
      isOverdue: true,
      amount: overduePay.amount,
    };
  }

  // Next "due" payment
  const duePay = wedding.payments.find((p) => p.status === "due");
  if (duePay) {
    const days = daysFromToday(duePay.dueDate);
    return {
      label: duePay.label,
      daysUntil: days,
      isOverdue: days < 0,
      amount: duePay.amount,
    };
  }

  // Next "upcoming" payment within 90 days
  const upcoming = wedding.payments
    .filter((p) => p.status === "upcoming")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (upcoming) {
    const days = daysFromToday(upcoming.dueDate);
    if (days <= 90) {
      return {
        label: upcoming.label,
        daysUntil: days,
        isOverdue: false,
        amount: upcoming.amount,
      };
    }
  }

  // Next overdue/pending task
  const nextTask = wedding.tasks
    .filter((t) => !t.done && t.dueDate)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0];
  if (nextTask && nextTask.dueDate) {
    const days = daysFromToday(nextTask.dueDate);
    if (days <= 60) {
      return {
        label: nextTask.label,
        daysUntil: days,
        isOverdue: days < 0,
      };
    }
  }

  return null;
}

// ─── Card ────────────────────────────────────────────────────────────────────

function WeddingCard({ wedding }: { wedding: Wedding }) {
  const paidPct = Math.round((wedding.paid / wedding.totalValue) * 100);
  const urgency = getUrgency(wedding);

  const initials = wedding.coupleName
    .split(" & ")
    .map((n) => n[0])
    .join("");

  return (
    <Link href={`/preview/weddings/${wedding.id}`} className="group">
      <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex flex-col gap-4">
          {/* Top row: avatar + couple name + status badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fun-pink text-sm font-semibold text-fun-pink-foreground">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold leading-tight text-foreground">
                  {wedding.coupleName}
                </p>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="size-3 shrink-0" aria-hidden />
                  <span className="tabular-nums">
                    {formatLongDate(wedding.date)}
                  </span>
                </span>
              </div>
            </div>
            <WeddingStatusBadge status={wedding.status} className="shrink-0" />
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {wedding.space}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5 shrink-0" aria-hidden />
              {wedding.guestCount} guests
            </span>
          </div>

          {/* Payment progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Paid</span>
              <span className="tabular-nums font-medium text-foreground">
                {gbp(wedding.paid)}{" "}
                <span className="font-normal text-muted-foreground">
                  of {gbp(wedding.totalValue)}
                </span>
              </span>
            </div>
            <Progress value={paidPct} className="h-1.5" />
          </div>

          {/* Urgency signal */}
          {urgency && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-lg px-3 py-2",
                urgency.isOverdue ? "bg-destructive/10" : "bg-warning/15",
              )}
            >
              <AlertCircle
                className={cn(
                  "mt-0.5 size-3.5 shrink-0",
                  urgency.isOverdue
                    ? "text-destructive"
                    : "text-warning-foreground",
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[12px] font-medium leading-snug",
                    urgency.isOverdue
                      ? "text-destructive"
                      : "text-warning-foreground",
                  )}
                >
                  {urgency.isOverdue ? "Overdue" : `Due in ${urgency.daysUntil}d`}
                  {" — "}
                  {urgency.label}
                </p>
                {urgency.amount !== undefined && (
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    <Banknote className="mr-0.5 inline-block size-3" aria-hidden />
                    {gbp(urgency.amount)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Arrow hint */}
          <div className="flex items-center justify-end gap-1 text-xs font-medium text-primary">
            Open workspace
            <ArrowRight className="size-3.5 -translate-x-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Main client component ───────────────────────────────────────────────────

export function WeddingsClient({ weddings }: { weddings: Wedding[] }) {
  const [activeList, setActiveList] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState("date_asc");

  const lists = buildLists(weddings);

  const filtered = React.useMemo(() => {
    const byList = filterByList(weddings, activeList);
    const bySearch = filterBySearch(byList, search);
    return sortWeddings(bySearch, sortKey);
  }, [weddings, activeList, search, sortKey]);

  return (
    <div className="space-y-4">
      <SmartListBar
        lists={lists}
        activeId={activeList}
        onChange={setActiveList}
      />

      <DataToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search weddings…",
        }}
        sort={{
          value: sortKey,
          onChange: setSortKey,
          options: [
            { value: "date_asc", label: "Wedding date (soon first)" },
            { value: "date_desc", label: "Wedding date (later first)" },
            { value: "name_asc", label: "Couple name A–Z" },
            { value: "balance_desc", label: "Balance outstanding" },
          ],
        }}
        resultCount={filtered.length}
        totalCount={weddings.length}
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Heart className="mb-4 size-10 text-fun-pink-strong" />
          <p className="text-base font-semibold text-foreground">
            No weddings match
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Try adjusting your search or switching to a different view.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setActiveList("all");
            }}
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((w) => (
            <WeddingCard key={w.id} wedding={w} />
          ))}
        </div>
      )}
    </div>
  );
}
