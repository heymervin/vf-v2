import Link from "next/link";
import { ArrowLeft, Clock, User } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { primaryWedding, WED_PRIMARY_ID, formatLongDate, type RunsheetItem } from "@/lib/mock";
import { cn } from "@/lib/utils";

export const metadata = { title: "Run-sheet" };

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

type Category = RunsheetItem["category"];

const CATEGORY: Record<
  Category,
  {
    label: string;
    dot: string;       // bg class for the connector dot
    chip: string;      // bg + text classes for the chip
    chipText: string;
  }
> = {
  ceremony: {
    label: "Ceremony",
    dot: "bg-fun-pink-strong",
    chip: "bg-fun-pink text-fun-pink-foreground",
    chipText: "text-fun-pink-foreground",
  },
  reception: {
    label: "Reception",
    dot: "bg-fun-blue-strong",
    chip: "bg-fun-blue text-foreground",
    chipText: "text-foreground",
  },
  catering: {
    label: "Catering",
    dot: "bg-fun-green-strong",
    chip: "bg-fun-green text-foreground",
    chipText: "text-foreground",
  },
  supplier: {
    label: "Supplier",
    dot: "bg-fun-teal-strong",
    chip: "bg-fun-teal text-foreground",
    chipText: "text-foreground",
  },
  logistics: {
    label: "Logistics",
    dot: "bg-accent-foreground",
    chip: "bg-mint text-foreground",
    chipText: "text-foreground",
  },
};

const CATEGORY_ORDER: Category[] = [
  "ceremony",
  "reception",
  "catering",
  "supplier",
  "logistics",
];

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CATEGORY_ORDER.map((cat) => {
        const c = CATEGORY[cat];
        return (
          <span
            key={cat}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]",
              c.chip,
            )}
          >
            <span className={cn("size-1.5 rounded-full", c.dot)} />
            {c.label}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline item
// ---------------------------------------------------------------------------

function TimelineItem({
  item,
  isLast,
}: {
  item: RunsheetItem;
  isLast: boolean;
}) {
  const cat = CATEGORY[item.category];

  return (
    <div className="grid grid-cols-[72px_auto] gap-x-4 sm:grid-cols-[88px_auto]">
      {/* Left rail: time + connector line */}
      <div className="relative flex flex-col items-end pt-0.5">
        {/* Time */}
        <span className="text-base font-semibold tabular-nums leading-tight text-foreground sm:text-lg">
          {item.time}
        </span>

        {/* Vertical line running down from this item */}
        {!isLast && (
          <div className="absolute right-[-17px] top-6 bottom-[-32px] w-px bg-border sm:right-[-21px]" />
        )}
      </div>

      {/* Dot + card */}
      <div className="relative pb-8">
        {/* Category dot — sits on the connector line */}
        <div
          className={cn(
            "absolute left-[-21px] top-1.5 size-3.5 rounded-full border-2 border-card sm:left-[-25px]",
            cat.dot,
          )}
        />

        {/* Item card */}
        <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
          {/* Top row: chip + duration */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
                cat.chip,
              )}
            >
              <span className={cn("size-1.5 rounded-full", cat.dot)} />
              {cat.label}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-medium tabular-nums text-muted-foreground">
              <Clock className="size-3" />
              {formatDuration(item.durationMin)}
            </span>
          </div>

          {/* Title */}
          <p className="text-sm font-medium leading-snug text-foreground sm:text-[15px]">
            {item.title}
          </p>

          {/* Owner */}
          <div className="mt-2 flex items-center gap-1.5">
            <User className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{item.owner}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RunsheetPage() {
  const wedding = primaryWedding();

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Run-sheet"
        subtitle={`${wedding.coupleName} · ${formatLongDate(wedding.date)} · ${wedding.space}`}
        actions={
          <Link
            href={`/preview/weddings/${WED_PRIMARY_ID}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-4" />
            Open workspace
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
        {/* Timeline */}
        <div>
          {/* Legend row */}
          <div className="mb-8">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Categories
            </p>
            <Legend />
          </div>

          {/* Items */}
          <div>
            {wedding.runsheet.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-border bg-card py-16 text-center shadow-xs">
                <Clock className="mb-4 size-10 text-muted-foreground/40" />
                <p className="text-base font-semibold text-foreground">
                  No run-sheet yet
                </p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Add timed items to build the day&apos;s timeline. Your
                  coordinator can share this with suppliers.
                </p>
              </div>
            ) : (
              <div>
                {wedding.runsheet.map((item, i) => (
                  <TimelineItem
                    key={item.id}
                    item={item}
                    isLast={i === wedding.runsheet.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar summary */}
        <aside className="space-y-5">
          {/* Summary card */}
          <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Day at a glance
            </p>

            {wedding.runsheet.length > 0 && (
              <div className="space-y-3">
                {/* Time range */}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Doors open</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {wedding.runsheet[0].time}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Last item</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {wedding.runsheet[wedding.runsheet.length - 1].time}
                  </span>
                </div>

                <div className="my-2 h-px bg-border" />

                {/* Item count by category */}
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Items by category
                </p>
                <div className="space-y-2">
                  {CATEGORY_ORDER.map((cat) => {
                    const count = wedding.runsheet.filter(
                      (r) => r.category === cat,
                    ).length;
                    if (count === 0) return null;
                    const c = CATEGORY[cat];
                    return (
                      <div
                        key={cat}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={cn("size-2 rounded-full", c.dot)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {c.label}
                          </span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-foreground">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Wedding facts */}
          <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Wedding details
            </p>
            <div className="space-y-3">
              {wedding.keyFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="flex items-start justify-between gap-3"
                >
                  <span className="text-xs text-muted-foreground">
                    {fact.label}
                  </span>
                  <span className="text-right text-xs font-medium text-foreground">
                    {fact.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cross-links */}
          <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Planning tools
            </p>
            <nav className="space-y-1">
              {[
                { label: "Guests", href: "/preview/guests" },
                { label: "Menu", href: "/preview/menu" },
                { label: "Suppliers", href: "/preview/suppliers" },
                { label: "Floor plan", href: "/preview/floorplan" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-[40px] items-center rounded-lg px-2 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
}
