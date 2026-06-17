"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  MapPin,
  Users,
  ArrowRight,
  AlertCircle,
  CalendarDays,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WeddingStatusBadge } from "@/components/status-badges";
import { cn } from "@/lib/utils";
import { createWedding } from "./actions";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WeddingRow {
  id: string;
  couple_names: string;
  wedding_date: string | null;
  status: string;
  guest_count_day: number | null;
  guest_count_evening: number | null;
  total_value_minor: number | null;
  space_id: string | null;
  source: string;
  /** Joined from spaces */
  space_name: string | null;
}

type WeddingStatus = "planning" | "final_details" | "this_week" | "completed";

function toSafeStatus(s: string): WeddingStatus {
  if (
    s === "planning" ||
    s === "final_details" ||
    s === "this_week" ||
    s === "completed"
  )
    return s;
  return "planning";
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

function guestLabel(day: number | null, evening: number | null): string | null {
  if (day == null && evening == null) return null;
  if (day != null && evening != null) return `${day} day · ${evening} eve`;
  if (day != null) return `${day} guests`;
  return `${evening} evening`;
}

// ── Smart list bar ───────────────────────────────────────────────────────────

interface SmartList {
  id: string;
  name: string;
  count: number;
}

function SmartListBar({
  lists,
  activeId,
  onChange,
}: {
  lists: SmartList[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Filter weddings"
    >
      {lists.map((list) => (
        <button
          key={list.id}
          type="button"
          onClick={() => onChange(list.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            activeId === list.id
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-accent-foreground hover:bg-accent/80",
          )}
          aria-pressed={activeId === list.id}
        >
          {list.name}
          <span
            className={cn(
              "tabular-nums",
              activeId === list.id
                ? "text-primary-foreground/70"
                : "text-muted-foreground",
            )}
          >
            {list.count}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Filter helpers ───────────────────────────────────────────────────────────

function buildLists(weddings: WeddingRow[]): SmartList[] {
  const now = new Date();
  const thisMonth = weddings.filter((w) => {
    if (!w.wedding_date) return false;
    const d = new Date(w.wedding_date);
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
  });

  return [
    { id: "all", name: "All", count: weddings.length },
    { id: "this_month", name: "This month", count: thisMonth.length },
  ];
}

function filterByList(weddings: WeddingRow[], listId: string): WeddingRow[] {
  const now = new Date();
  if (listId === "this_month") {
    return weddings.filter((w) => {
      if (!w.wedding_date) return false;
      const d = new Date(w.wedding_date);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      );
    });
  }
  return weddings;
}

function filterBySearch(weddings: WeddingRow[], query: string): WeddingRow[] {
  if (!query.trim()) return weddings;
  const q = query.toLowerCase();
  return weddings.filter(
    (w) =>
      w.couple_names.toLowerCase().includes(q) ||
      (w.space_name?.toLowerCase().includes(q) ?? false),
  );
}

function sortWeddings(weddings: WeddingRow[], sortKey: string): WeddingRow[] {
  return [...weddings].sort((a, b) => {
    switch (sortKey) {
      case "date_asc":
        return (a.wedding_date ?? "9999").localeCompare(
          b.wedding_date ?? "9999",
        );
      case "date_desc":
        return (b.wedding_date ?? "0000").localeCompare(
          a.wedding_date ?? "0000",
        );
      case "name_asc":
        return a.couple_names.localeCompare(b.couple_names);
      default:
        return (a.wedding_date ?? "9999").localeCompare(
          b.wedding_date ?? "9999",
        );
    }
  });
}

// ── Wedding card ─────────────────────────────────────────────────────────────

function WeddingCard({ wedding }: { wedding: WeddingRow }) {
  const days = daysFromToday(wedding.wedding_date);
  const guests = guestLabel(
    wedding.guest_count_day,
    wedding.guest_count_evening,
  );
  const initials = wedding.couple_names
    .split(/\s*&\s*/)
    .map((n) => n.trim()[0] ?? "?")
    .join("");

  return (
    <Link href={`/weddings/${wedding.id}`} className="group">
      <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex flex-col gap-4">
          {/* Top row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fun-pink text-sm font-semibold text-fun-pink-foreground">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold leading-tight text-foreground">
                  {wedding.couple_names}
                </p>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="size-3 shrink-0" aria-hidden />
                  <span className="tabular-nums">
                    {formatDate(wedding.wedding_date)}
                  </span>
                </span>
              </div>
            </div>
            <WeddingStatusBadge
              status={toSafeStatus(wedding.status)}
              className="shrink-0"
            />
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {wedding.space_name && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                {wedding.space_name}
              </span>
            )}
            {guests && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5 shrink-0" aria-hidden />
                {guests}
              </span>
            )}
          </div>

          {/* Days to go */}
          {days !== null && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2",
                days < 0 ? "bg-muted/50" : days <= 14 ? "bg-warning/15" : "bg-muted/30",
              )}
            >
              <AlertCircle
                className={cn(
                  "size-3.5 shrink-0",
                  days < 0
                    ? "text-muted-foreground"
                    : days <= 14
                      ? "text-warning-foreground"
                      : "text-muted-foreground",
                )}
                aria-hidden
              />
              <p
                className={cn(
                  "text-[12px] font-medium",
                  days < 0
                    ? "text-muted-foreground"
                    : days <= 14
                      ? "text-warning-foreground"
                      : "text-foreground",
                )}
              >
                {days < 0
                  ? "Completed"
                  : days === 0
                    ? "Wedding day!"
                    : `${days} days to go`}
              </p>
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

// ── Create wedding sheet ──────────────────────────────────────────────────────

function CreateWeddingSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [coupleNames, setCoupleNames] = React.useState("");
  const [coupleEmail, setCoupleEmail] = React.useState("");
  const [partnerBEmail, setPartnerBEmail] = React.useState("");
  const [weddingDate, setWeddingDate] = React.useState("");

  function reset() {
    setCoupleNames("");
    setCoupleEmail("");
    setPartnerBEmail("");
    setWeddingDate("");
    setPending(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await createWedding({
      coupleNames,
      coupleEmail,
      partnerBEmail: partnerBEmail || undefined,
      weddingDate: weddingDate || undefined,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Wedding created");
    reset();
    onClose();
    router.push(`/weddings/${result.data.weddingId}`);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent side="right" className="w-full max-w-md">
        <SheetHeader>
          <SheetTitle>Create wedding</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="coupleNames">Couple names *</Label>
            <Input
              id="coupleNames"
              placeholder="e.g. Henderson & Carter"
              value={coupleNames}
              onChange={(e) => setCoupleNames(e.target.value)}
              required
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              How you refer to this couple internally.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="coupleEmail">Partner A email *</Label>
            <Input
              id="coupleEmail"
              type="email"
              placeholder="partner@example.com"
              value={coupleEmail}
              onChange={(e) => setCoupleEmail(e.target.value)}
              required
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="partnerBEmail">Partner B email</Label>
            <Input
              id="partnerBEmail"
              type="email"
              placeholder="partner@example.com (optional)"
              value={partnerBEmail}
              onChange={(e) => setPartnerBEmail(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="weddingDate">Wedding date</Label>
            <Input
              id="weddingDate"
              type="date"
              value={weddingDate}
              onChange={(e) => setWeddingDate(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? "Creating…" : "Create wedding"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

export function WeddingsList({ weddings }: { weddings: WeddingRow[] }) {
  const [activeList, setActiveList] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState("date_asc");
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const lists = buildLists(weddings);
  const hasActiveFilters = search.trim() !== "" || activeList !== "all";

  const filtered = React.useMemo(() => {
    const byList = filterByList(weddings, activeList);
    const bySearch = filterBySearch(byList, search);
    return sortWeddings(bySearch, sortKey);
  }, [weddings, activeList, search, sortKey]);

  // True empty state — no weddings exist at all
  if (weddings.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card py-16 text-center">
          <Heart className="mb-4 size-10 text-fun-pink-strong" />
          <p className="text-base font-semibold text-foreground">
            No booked weddings yet
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first wedding manually, or mark an opportunity as{" "}
            <span className="font-medium">Won</span> in GoHighLevel to have it
            appear here automatically.
          </p>
          <Button
            size="sm"
            className="mt-5"
            onClick={() => setSheetOpen(true)}
          >
            <Plus className="size-4" />
            Create wedding
          </Button>
        </div>

        <CreateWeddingSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SmartListBar
          lists={lists}
          activeId={activeList}
          onChange={setActiveList}
        />
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="size-4" />
          Create wedding
        </Button>
      </div>

      {/* Search + sort */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search weddings…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
          aria-label="Search weddings"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Sort weddings"
        >
          <option value="date_asc">Wedding date (soon first)</option>
          <option value="date_desc">Wedding date (later first)</option>
          <option value="name_asc">Couple name A–Z</option>
        </select>
        {hasActiveFilters && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {weddings.length} weddings
          </p>
        )}
      </div>

      {/* List */}
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

      <CreateWeddingSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
