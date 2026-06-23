/**
 * Couple Portal — real data page (Slice 8).
 *
 * Server component. ALL couple-scoped reads go through the RLS SESSION client
 * (src/lib/supabase/server.ts) so tenant isolation is DB-enforced — a couple can
 * physically only read their own wedding's rows. Venue-level menu OPTIONS (which
 * have no couple RLS policy) are read via the service-role client, scoped to the
 * couple's venue_id.
 *
 * The page resolves the couple context (auth + couple_accounts) the same way the
 * guarded layout does; if it cannot resolve, it redirects to /portal/login (the
 * layout already guards, but the page double-checks before any data fetch).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCoupleContext } from "../portal-data";
import { PortalClient } from "../portal-client";
import {
  mapGuest,
  mapTask,
  mapPayment,
  mapRunsheetItem,
  mapDoc,
  groupMenuByCourse,
  splitCoupleNames,
  daysUntil,
  formatLongDate,
} from "../portal-types";
import {
  parseLayout,
  toFloorplanTable,
  toRoomElement,
} from "@/app/(app)/weddings/[id]/floorplan/floorplan-types";
import type { Json } from "@/lib/supabase/types";

const COUPLE_TASK_CATEGORIES = new Set(["money", "planning"]);

function parseMealChoice(raw: Json | null): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, string>;
}

export default async function PortalPage() {
  const ctx = await resolveCoupleContext();
  if (!ctx) redirect("/portal/login");

  const { weddingId, venueId, venue } = ctx;

  // RLS session client — every read below is scoped to the couple's wedding by
  // the couple_select policies (current_couple_wedding_ids()).
  const supabase = await createClient();
  const admin = createAdminClient();

  const [
    weddingRes,
    guestsRes,
    selectionsRes,
    timelineRes,
    floorPlanRes,
    paymentsRes,
    documentsRes,
    tasksRes,
  ] = await Promise.all([
    supabase
      .from("weddings")
      .select(
        "id, couple_names, wedding_date, package_name, contract_status, guest_count_day, total_value_minor, space_id",
      )
      .eq("id", weddingId)
      .maybeSingle(),
    supabase.from("wedding_guests").select("*").eq("wedding_id", weddingId),
    supabase
      .from("wedding_menu_selections")
      .select("course, menu_item_id")
      .eq("wedding_id", weddingId),
    supabase
      .from("timeline_events")
      .select("*")
      .eq("wedding_id", weddingId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("floor_plans")
      .select("layout")
      .eq("wedding_id", weddingId)
      .maybeSingle(),
    supabase
      .from("payment_milestones")
      .select("*")
      .eq("wedding_id", weddingId)
      .order("sort_order", { ascending: true }),
    supabase.from("wedding_documents").select("*").eq("wedding_id", weddingId),
    supabase
      .from("wedding_tasks")
      .select("*")
      .eq("wedding_id", weddingId)
      .eq("visible_to_couple", true),
  ]);

  // The layout guard already redirects an unauthenticated/non-couple caller;
  // a missing wedding here means the couple's wedding row is gone.
  if (!weddingRes.data) redirect("/portal/login");
  const wedding = weddingRes.data;

  // Venue-level menu OPTIONS (no couple policy) — service-role, scoped to venue.
  const { data: menuItems } = await admin
    .from("menu_items")
    .select("*")
    .eq("venue_id", venueId)
    .eq("is_active", true);

  // Space name (spaces has no couple policy) — service-role, scoped to venue.
  let spaceName = "Your space";
  if (wedding.space_id) {
    const { data: space } = await admin
      .from("spaces")
      .select("name")
      .eq("id", wedding.space_id)
      .eq("venue_id", venueId)
      .maybeSingle();
    if (space?.name) spaceName = space.name;
  }

  // ── Map to client props ───────────────────────────────────────────────────
  const { partner1First, partner2First } = splitCoupleNames(
    wedding.couple_names,
  );

  const guests = (guestsRes.data ?? []).map(mapGuest);

  // chosenBy counts from guest meal_choice jsonb (per-guest dish picks).
  const chosenByMap = new Map<string, number>();
  for (const g of guestsRes.data ?? []) {
    const choice = parseMealChoice(g.meal_choice);
    if (!choice) continue;
    for (const itemId of new Set(Object.values(choice))) {
      chosenByMap.set(itemId, (chosenByMap.get(itemId) ?? 0) + 1);
    }
  }
  const menu = groupMenuByCourse(menuItems ?? [], chosenByMap);

  // Per-wedding course → menu_item_id picks (one per course).
  const menuSelections: Record<string, string> = {};
  for (const sel of selectionsRes.data ?? []) {
    if (sel.course) menuSelections[sel.course] = sel.menu_item_id;
  }

  const coupleTasks = (tasksRes.data ?? [])
    .map(mapTask)
    .filter((t) => COUPLE_TASK_CATEGORIES.has(t.category));
  const doneTasks = coupleTasks.filter((t) => t.done).length;
  const progressPct =
    coupleTasks.length > 0
      ? Math.round((doneTasks / coupleTasks.length) * 100)
      : 0;
  const nextTask = coupleTasks.find((t) => !t.done) ?? null;

  const payments = (paymentsRes.data ?? []).map(mapPayment);
  const paid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalValue =
    wedding.total_value_minor != null
      ? wedding.total_value_minor / 100
      : payments.reduce((sum, p) => sum + p.amount, 0);

  const runsheet = (timelineRes.data ?? []).map(mapRunsheetItem);
  const docs = (documentsRes.data ?? []).map(mapDoc);

  // Floor plan (couple SELECT policy) — read-only seating canvas (D5 gate: an
  // empty/absent layout renders the locked-state copy in the client).
  const layout = parseLayout(floorPlanRes.data?.layout);
  const floorplanTables = (layout?.tables ?? []).map(toFloorplanTable);
  const roomElements = (layout?.roomElements ?? []).map(toRoomElement);

  const guestCount =
    wedding.guest_count_day ??
    guests.filter((g) => g.rsvp !== "no").length;

  return (
    <PortalClient
      partner1First={partner1First}
      partner2First={partner2First}
      venueName={venue.name}
      daysUntil={daysUntil(wedding.wedding_date)}
      weddingDate={formatLongDate(wedding.wedding_date)}
      guestCount={guestCount}
      space={spaceName}
      packageName={wedding.package_name ?? undefined}
      coupleTasks={coupleTasks}
      progressPct={progressPct}
      nextTask={nextTask}
      payments={payments}
      contractStatus={wedding.contract_status}
      contractTerms={[]}
      docs={docs}
      menu={menu}
      menuSelections={menuSelections}
      guests={guests}
      runsheet={runsheet}
      totalValue={totalValue}
      paid={paid}
      floorplanTables={floorplanTables}
      roomElements={roomElements}
      portalTheme={null}
    />
  );
}
