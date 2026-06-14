import Link from "next/link";
import { ArrowLeft, Users, CheckCircle2, Clock, XCircle, Utensils } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { GuestTable, type GuestRow } from "./GuestTable";
import { primaryWedding, getContact } from "@/lib/mock";

export const metadata = { title: "Guest list" };

// ---------------------------------------------------------------------------
// Build dietary breakdown (count per tag) from the guest list
// ---------------------------------------------------------------------------
function buildDietaryBreakdown(guests: ReturnType<typeof primaryWedding>["guests"]) {
  const counts: Record<string, number> = {};
  for (const g of guests) {
    for (const tag of g.dietary) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  // Sort by count descending
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// ---------------------------------------------------------------------------
// Map a guest's `side` value to a possessive label, e.g. "Emma's" / "James's"
// ---------------------------------------------------------------------------
function buildSideLabels(
  contact: ReturnType<typeof getContact>,
): Record<"partner1" | "partner2" | "both", string> {
  const p1First = contact?.partner1?.split(" ")[0] ?? "Partner 1";
  const p2First = contact?.partner2?.split(" ")[0] ?? "Partner 2";
  // Correct possessive: names ending in 's' get just an apostrophe
  const possessive = (name: string) =>
    name.endsWith("s") ? `${name}'` : `${name}'s`;
  return {
    partner1: possessive(p1First),
    partner2: possessive(p2First),
    both: "Both",
  };
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  colorClass: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3 py-1">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------
export default function GuestsPage() {
  const wedding = primaryWedding();
  const contact = getContact(wedding.contactId);
  const guests = wedding.guests;

  // Derive side labels
  const sideLabels = buildSideLabels(contact);

  // Summary stats
  const totalInvited = guests.length;
  const rsvpYes = guests.filter((g) => g.rsvp === "yes").length;
  const rsvpPending = guests.filter((g) => g.rsvp === "pending").length;
  const rsvpNo = guests.filter((g) => g.rsvp === "no").length;
  const dietaryCount = guests.filter((g) => g.dietary.length > 0).length;

  // Dietary breakdown
  const dietaryBreakdown = buildDietaryBreakdown(guests);

  // Serialise to the client table shape (avoids passing whole Guest objects)
  const tableRows: GuestRow[] = guests.map((g) => ({
    id: g.id,
    name: g.name,
    sideLabel: sideLabels[g.side],
    table: g.table,
    rsvp: g.rsvp,
    dietary: g.dietary,
    plusOne: g.plusOne,
  }));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Guest list"
        subtitle={
          // Subtitle with link — PageHeader accepts ReactNode for subtitle but types it as string;
          // we pass a plain string and put the link in the actions slot instead.
          `${wedding.coupleName} · ${totalInvited} invited · ${wedding.space}`
        }
        actions={
          <Link
            href={`/preview/weddings/${wedding.id}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm"
          >
            <ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
            {wedding.coupleName}
          </Link>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Summary stat cards                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total invited"
          value={totalInvited}
          icon={Users}
          colorClass="bg-fun-blue text-fun-blue-strong"
        />
        <StatCard
          label="RSVP yes"
          value={rsvpYes}
          icon={CheckCircle2}
          colorClass="bg-fun-green text-fun-green-strong"
        />
        <StatCard
          label="Pending"
          value={rsvpPending}
          icon={Clock}
          colorClass="bg-warning text-warning-foreground"
        />
        <StatCard
          label="Declined"
          value={rsvpNo}
          icon={XCircle}
          colorClass="bg-muted text-muted-foreground"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Dietary breakdown                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-start gap-x-6 gap-y-4 py-1">
          {/* Label + count */}
          <div className="flex min-w-[160px] items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fun-teal text-fun-teal-strong">
              <Utensils className="size-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Dietary needs
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {dietaryCount}
              </p>
            </div>
          </div>

          {/* Separator */}
          <div className="hidden self-stretch border-l border-border sm:block" />

          {/* Breakdown chips */}
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {dietaryBreakdown.length > 0 ? (
              dietaryBreakdown.map(([tag, count]) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm font-medium text-foreground"
                >
                  {tag}
                  <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-warning/70 px-1.5 text-[11px] font-bold tabular-nums text-warning-foreground">
                    {count}
                  </span>
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No dietary needs recorded yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Guest table (client — filterable)                                    */}
      {/* ------------------------------------------------------------------ */}
      <GuestTable guests={tableRows} />
    </div>
  );
}
