import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, LayoutGrid } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FloorplanClient } from "./floorplan-client";
import { seedFloorPlan } from "./actions";
import {
  parseLayout,
  emptyLayout,
  toFloorplanTable,
  toRoomElement,
  toGuest,
  type DbGuest,
} from "./floorplan-types";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

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
  return { title: data ? `Floor plan — ${data.couple_names}` : "Floor plan" };
}

// ---------------------------------------------------------------------------
// Gated state
// ---------------------------------------------------------------------------

function GatedState({ weddingId }: { weddingId: string }) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Floor plan"
        actions={
          <Link
            href={`/weddings/${weddingId}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm"
          >
            <ArrowLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Back to wedding
          </Link>
        }
      />

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Lock className="size-6 text-muted-foreground" aria-hidden />
          </span>
          <div className="max-w-sm">
            <p className="text-base font-semibold text-foreground">
              Floor plan not available yet
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This wedding&apos;s space needs a floor template before you can
              build a seating plan. Add one in Settings.
            </p>
          </div>
          <Link
            href="/settings/spaces"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <LayoutGrid className="size-4" aria-hidden />
            Settings &rarr; Spaces
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function FloorplanPage({
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
    .select("id, couple_names, space_id")
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (weddingError) console.error("floorplan page wedding load:", weddingError.message);
  if (!wedding) notFound();

  // ── Gating (D5): locked until the space has a floor template ────────────────
  if (!wedding.space_id) {
    return <GatedState weddingId={id} />;
  }

  // Check whether the space has at least one floor template
  const { data: template } = await supabase
    .from("floor_templates")
    .select("id, layout, name")
    .eq("space_id", wedding.space_id)
    .eq("venue_id", ctx.venue.id)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!template) {
    return <GatedState weddingId={id} />;
  }

  // ── Seed or load per-wedding floor plan ────────────────────────────────────
  // Use the server action so seeding is idempotent and properly guarded.
  const seedResult = await seedFloorPlan({
    weddingId: id,
    spaceId: wedding.space_id,
    templateId: template.id,
  });

  const floorPlan = seedResult.ok
    ? seedResult.data
    : { id: "", layout: emptyLayout() };

  if (!seedResult.ok) {
    console.error("floorplan page seed failed:", seedResult.error);
  }

  // ── Load the floor_plans row id if seed succeeded to confirm ───────────────
  // seedFloorPlan returns {id, layout} — use it directly.
  const layout = floorPlan.layout;

  // Load room elements from the template (they are space-level, not per-wedding)
  const templateLayout = parseLayout(template.layout);

  // ── Load guests for this wedding ────────────────────────────────────────────
  const { data: guestsData, error: guestsError } = await supabase
    .from("wedding_guests")
    .select("id, name, rsvp, dietary, table_number, seat_index, tags, session_type")
    .eq("wedding_id", id)
    .neq("rsvp", "no")
    .order("name", { ascending: true });

  if (guestsError) console.error("floorplan page guests load:", guestsError.message);

  const dbGuests: DbGuest[] = (guestsData ?? []) as DbGuest[];
  const guests = dbGuests.map(toGuest);

  // Derive counts
  const floorplanTables = layout.tables.map(toFloorplanTable);
  const roomElements = (templateLayout?.roomElements ?? layout.roomElements).map(
    toRoomElement,
  );

  const totalSeated = guests.filter((g) => g.table !== null && g.table !== undefined).length;
  const totalGuests = guests.length;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Floor plan"
        subtitle={`${wedding.couple_names} · ${totalSeated} of ${totalGuests} seated`}
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

      <FloorplanClient
        weddingId={id}
        floorPlanId={floorPlan.id}
        floorplanTables={floorplanTables}
        roomElements={roomElements}
        guests={guests}
        totalSeated={totalSeated}
        totalGuests={totalGuests}
      />
    </div>
  );
}
