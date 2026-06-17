import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, CheckCircle2, Clock, Table2, Utensils } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { buildRsvpCounts, buildDietaryBreakdown } from "@/lib/guests/summary";
import { GuestsClient } from "./guests-client";
import type { Tables } from "@/lib/supabase/types";

type GuestRow = Tables<"wedding_guests">;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("weddings")
    .select("couple_names")
    .eq("id", id)
    .maybeSingle();
  return { title: data ? `Guests — ${data.couple_names}` : "Guest list" };
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
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
        >
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
// Page
// ---------------------------------------------------------------------------

export default async function GuestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();

  // Verify wedding belongs to this venue
  const { data: wedding, error: weddingError } = await supabase
    .from("weddings")
    .select("id, couple_names")
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (weddingError) console.error("guests page wedding load:", weddingError.message);
  if (!wedding) notFound();

  // Load all guests for this wedding (RLS enforces venue_id)
  const { data: guestsData, error: guestsError } = await supabase
    .from("wedding_guests")
    .select("*")
    .eq("wedding_id", id)
    .order("name", { ascending: true });

  if (guestsError) console.error("guests page load:", guestsError.message);

  const guests: GuestRow[] = (guestsData ?? []) as GuestRow[];

  // Derive summary stats server-side (pure helpers, no extra query)
  const rsvpCounts = buildRsvpCounts(guests);
  const dietaryBreakdown = buildDietaryBreakdown(guests);
  const dietaryGuestCount = guests.filter((g) => g.dietary.length > 0).length;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Guest list"
        subtitle={`${wedding.couple_names} · ${rsvpCounts.total} invited`}
        actions={
          <Link
            href={`/weddings/${id}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm"
          >
            <ArrowLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {wedding.couple_names}
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total invited"
          value={rsvpCounts.total}
          icon={Users}
          colorClass="bg-fun-blue text-fun-blue-strong"
        />
        <StatCard
          label="RSVP yes"
          value={rsvpCounts.yes}
          icon={CheckCircle2}
          colorClass="bg-fun-green text-fun-green-strong"
        />
        <StatCard
          label="Pending"
          value={rsvpCounts.pending}
          icon={Clock}
          colorClass="bg-warning text-warning-foreground"
        />
        <StatCard
          label="Needs table"
          value={rsvpCounts.needsTable}
          icon={Table2}
          colorClass="bg-muted text-muted-foreground"
        />
      </div>

      {/* Dietary breakdown */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-start gap-x-6 gap-y-4 py-1">
          <div className="flex min-w-[160px] items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fun-teal text-fun-teal-strong">
              <Utensils className="size-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Dietary needs
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {dietaryGuestCount}
              </p>
            </div>
          </div>

          <div className="hidden self-stretch border-l border-border sm:block" />

          <div className="flex flex-1 flex-wrap items-center gap-2">
            {dietaryBreakdown.length > 0 ? (
              dietaryBreakdown.map(({ tag, count }) => (
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
              <p className="text-sm text-muted-foreground">
                No dietary needs recorded yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Interactive guest table */}
      <GuestsClient weddingId={id} guests={guests} />
    </div>
  );
}
