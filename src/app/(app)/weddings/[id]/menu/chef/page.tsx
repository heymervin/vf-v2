import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import {
  buildMenuSummary,
  formatLongDate,
  type MenuItemRow,
  type SelectionRow,
  type GuestRow,
} from "../menu-data";
import { MenuSummaryView } from "../menu-summary-view";

export const metadata = { title: "Kitchen sheet" };

export default async function ChefSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, couple_names, wedding_date")
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();
  if (!wedding) notFound();

  const [{ data: itemsData }, { data: selData }, { data: guestData }] = await Promise.all([
    supabase.from("menu_items").select("*").eq("venue_id", ctx.venue.id).order("sort_order", { ascending: true }),
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

  const guests = (guestData ?? []) as GuestRow[];
  const totalGuests = guests.length;
  const summary = buildMenuSummary(
    (itemsData ?? []) as MenuItemRow[],
    (selData ?? []) as SelectionRow[],
    guests,
  );

  return (
    <div className="mx-auto max-w-[1000px]">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #chef-sheet, #chef-sheet * { visibility: visible !important; }
        #chef-sheet { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }`}</style>

      <div className="no-print mb-6 flex items-center justify-between">
        <Link
          href={`/weddings/${id}/menu`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to menu
        </Link>
        <PrintButton />
      </div>

      <div
        id="chef-sheet"
        className="rounded-xl border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Kitchen sheet
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {wedding.couple_names}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatLongDate(wedding.wedding_date)}
            </p>
          </div>
          <p className="text-sm font-medium tabular-nums text-foreground">
            {totalGuests} guest{totalGuests === 1 ? "" : "s"}
          </p>
        </div>

        <MenuSummaryView summary={summary} />
      </div>
    </div>
  );
}
