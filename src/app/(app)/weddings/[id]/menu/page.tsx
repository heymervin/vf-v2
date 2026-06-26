import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChefHat, Lock, Utensils } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { MenuClient } from "./menu-client";
import type { GuestForMenu, MenuPageData } from "./menu-types";
import {
  composeDishRows,
  parseMealChoice,
  type MenuItemRow,
  type SelectionRow,
  type GuestRow,
} from "./menu-data";

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
  return { title: data ? `Menu — ${data.couple_names}` : "Wedding menu" };
}

// ---------------------------------------------------------------------------
// Gated empty state
// ---------------------------------------------------------------------------

function LockedState({ weddingId }: { weddingId: string }) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Menu"
        subtitle="Per-wedding menu selections"
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
      <Card className="mt-4">
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Lock className="size-6 text-muted-foreground" aria-hidden />
          </span>
          <div className="max-w-xs space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Menu library is empty
            </p>
            <p className="text-sm text-muted-foreground">
              Add at least one active dish to your menu library before building
              per-wedding menus.
            </p>
          </div>
          <Link
            href="/settings/menu"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90"
          >
            <Utensils className="size-4 shrink-0" aria-hidden />
            Add menu items in Settings
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();

  // Verify wedding ownership + load the venue menu_items library in parallel
  // (independent; include inactive items for selections that may reference them)
  const [
    { data: wedding, error: weddingError },
    { data: menuItemsData, error: itemsError },
  ] = await Promise.all([
    supabase
      .from("weddings")
      .select("id, couple_names")
      .eq("id", id)
      .eq("venue_id", ctx.venue.id)
      .maybeSingle(),
    supabase
      .from("menu_items")
      .select("*")
      .eq("venue_id", ctx.venue.id)
      .order("sort_order", { ascending: true }),
  ]);

  if (weddingError) console.error("menu page wedding load:", weddingError.message);
  if (!wedding) notFound();
  if (itemsError) console.error("menu page items load:", itemsError.message);

  const menuItems: MenuItemRow[] = (menuItemsData ?? []) as MenuItemRow[];

  // Gating (D5): locked until at least one active item exists in the library
  const hasActiveItems = menuItems.some((item) => item.is_active);
  if (!hasActiveItems) {
    return <LockedState weddingId={id} />;
  }

  // Load selections + guests in parallel (independent; both scoped to this wedding)
  const [
    { data: selectionsData, error: selectionsError },
    { data: guestsData, error: guestsError },
  ] = await Promise.all([
    supabase
      .from("wedding_menu_selections")
      .select("*")
      .eq("wedding_id", id)
      .eq("venue_id", ctx.venue.id)
      .order("sort_index", { ascending: true }),
    supabase
      .from("wedding_guests")
      .select("id, name, dietary, meal_choice")
      .eq("wedding_id", id)
      .eq("venue_id", ctx.venue.id)
      .order("name", { ascending: true }),
  ]);

  if (selectionsError)
    console.error("menu page selections load:", selectionsError.message);

  const selections: SelectionRow[] = (selectionsData ?? []) as SelectionRow[];

  if (guestsError) console.error("menu page guests load:", guestsError.message);

  const rawGuests = (guestsData ?? []) as GuestRow[];

  // Compose DishRow[] from items + selections + guest choices
  // Only show active items plus any inactive items already selected
  const visibleItems = menuItems.filter(
    (item) =>
      item.is_active || selections.some((s) => s.menu_item_id === item.id),
  );
  const dishes = composeDishRows(visibleItems, selections, rawGuests);

  // Shape guests for the client (only fields needed)
  const guests: GuestForMenu[] = rawGuests.map((g) => ({
    id: g.id,
    name: g.name,
    dietary: g.dietary,
    mealChoice: parseMealChoice(g.meal_choice),
  }));

  const totalGuests = rawGuests.length;
  const selectedCount = dishes.filter((d) => d.isSelected).length;

  const pageData: MenuPageData = {
    weddingId: id,
    weddingName: wedding.couple_names,
    venueId: ctx.venue.id,
    dishes,
    guests,
    totalGuests,
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Menu"
        subtitle={`${wedding.couple_names} · ${selectedCount} item${selectedCount !== 1 ? "s" : ""} selected`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/weddings/${id}/menu/chef`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm"
            >
              <ChefHat className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Kitchen sheet
            </Link>
            <Link
              href={`/weddings/${id}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm"
            >
              <ArrowLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {wedding.couple_names}
            </Link>
          </div>
        }
      />

      <MenuClient data={pageData} />
    </div>
  );
}
