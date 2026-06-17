import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Utensils } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { MenuClient } from "./menu-client";
import type { DishRow, GuestForMenu, MenuPageData } from "./menu-types";
import type { Tables, Json } from "@/lib/supabase/types";

type MenuItemRow = Tables<"menu_items">;
type SelectionRow = Tables<"wedding_menu_selections">;
type GuestRow = Pick<
  Tables<"wedding_guests">,
  "id" | "name" | "dietary" | "meal_choice"
>;

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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse meal_choice jsonb (shape: { [course]: menuItemId }) to look up
 * which menu_items id a guest chose.
 */
function parseMealChoice(raw: Json | null): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, string>;
}

/**
 * Count how many guests chose each menu_item id, and collect those guest ids.
 * Returns a Map<menuItemId, { count, guestIds }>.
 */
function buildChosenByMap(
  guests: GuestRow[],
): Map<string, { count: number; guestIds: string[] }> {
  const map = new Map<string, { count: number; guestIds: string[] }>();

  for (const guest of guests) {
    const choice = parseMealChoice(guest.meal_choice);
    if (!choice) continue;

    // Each value in the meal_choice object is a menu_item id (one per course)
    const chosenItemIds = new Set(Object.values(choice));
    for (const itemId of chosenItemIds) {
      const existing = map.get(itemId) ?? { count: 0, guestIds: [] };
      existing.count += 1;
      existing.guestIds.push(guest.id);
      map.set(itemId, existing);
    }
  }

  return map;
}

/**
 * Compose the DishRow list from venue menu_items + per-wedding selections
 * + guest meal choices.
 */
function composeDishRows(
  items: MenuItemRow[],
  selections: SelectionRow[],
  guests: GuestRow[],
): DishRow[] {
  const selectionByItemId = new Map<string, SelectionRow>();
  for (const sel of selections) {
    selectionByItemId.set(sel.menu_item_id, sel);
  }

  const chosenByMap = buildChosenByMap(guests);

  return items.map((item): DishRow => {
    const sel = selectionByItemId.get(item.id) ?? null;
    const chosen = chosenByMap.get(item.id) ?? { count: 0, guestIds: [] };

    return {
      itemId: item.id,
      selectionId: sel?.id ?? null,
      name: item.name,
      course: sel?.course ?? item.course,
      description: item.description,
      allergens: item.allergens,
      dietaryTags: item.dietary_tags,
      pricePerHeadMinor: item.price_per_head_minor,
      isActive: item.is_active,
      sortOrder: item.sort_order,
      chosenBy: chosen.count,
      guestIds: chosen.guestIds,
      isSelected: sel !== null,
    };
  });
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

  // Verify wedding belongs to this venue
  const { data: wedding, error: weddingError } = await supabase
    .from("weddings")
    .select("id, couple_names")
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (weddingError) console.error("menu page wedding load:", weddingError.message);
  if (!wedding) notFound();

  // Load venue menu_items library (active only for display; include inactive
  // for selections that may already reference them)
  const { data: menuItemsData, error: itemsError } = await supabase
    .from("menu_items")
    .select("*")
    .eq("venue_id", ctx.venue.id)
    .order("sort_order", { ascending: true });

  if (itemsError) console.error("menu page items load:", itemsError.message);

  const menuItems: MenuItemRow[] = (menuItemsData ?? []) as MenuItemRow[];

  // Gating (D5): locked until at least one active item exists in the library
  const hasActiveItems = menuItems.some((item) => item.is_active);
  if (!hasActiveItems) {
    return <LockedState weddingId={id} />;
  }

  // Load wedding_menu_selections for this wedding
  const { data: selectionsData, error: selectionsError } = await supabase
    .from("wedding_menu_selections")
    .select("*")
    .eq("wedding_id", id)
    .eq("venue_id", ctx.venue.id)
    .order("sort_index", { ascending: true });

  if (selectionsError)
    console.error("menu page selections load:", selectionsError.message);

  const selections: SelectionRow[] = (selectionsData ?? []) as SelectionRow[];

  // Load guests (for chosenBy counts + dietary cross-check)
  const { data: guestsData, error: guestsError } = await supabase
    .from("wedding_guests")
    .select("id, name, dietary, meal_choice")
    .eq("wedding_id", id)
    .eq("venue_id", ctx.venue.id)
    .order("name", { ascending: true });

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
          <Link
            href={`/weddings/${id}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm"
          >
            <ArrowLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {wedding.couple_names}
          </Link>
        }
      />

      <MenuClient data={pageData} />
    </div>
  );
}
