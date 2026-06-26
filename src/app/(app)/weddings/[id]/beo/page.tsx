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
} from "../menu/menu-data";
import { MenuSummaryView } from "../menu/menu-summary-view";

export const metadata = { title: "Event order (BEO)" };

function flat<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function BeoPage({
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
    .select("id, couple_names, wedding_date, guest_count_day, guest_count_evening, notes, spaces(name)")
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();
  if (!wedding) notFound();

  const [timelineRes, suppliersRes, itemsRes, selRes, guestRes] = await Promise.all([
    supabase
      .from("timeline_events")
      .select("id, title, starts_at_time, owner, notes")
      .eq("wedding_id", id)
      .eq("venue_id", ctx.venue.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("wedding_suppliers")
      .select("id, name, category, contact_name, phone, arrival_time")
      .eq("wedding_id", id)
      .eq("venue_id", ctx.venue.id)
      .order("name", { ascending: true }),
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

  const timeline = timelineRes.data ?? [];
  const suppliers = suppliersRes.data ?? [];
  const guests = (guestRes.data ?? []) as GuestRow[];
  const summary = buildMenuSummary(
    (itemsRes.data ?? []) as MenuItemRow[],
    (selRes.data ?? []) as SelectionRow[],
    guests,
  );

  const spaceName = flat(wedding.spaces)?.name ?? null;
  const day = wedding.guest_count_day;
  const evening = wedding.guest_count_evening;

  return (
    <div className="mx-auto max-w-[1000px]">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #beo-sheet, #beo-sheet * { visibility: visible !important; }
        #beo-sheet { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }`}</style>

      <div className="no-print mb-6 flex items-center justify-between">
        <Link
          href={`/weddings/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to wedding
        </Link>
        <PrintButton label="Print BEO" />
      </div>

      <div
        id="beo-sheet"
        className="rounded-xl border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b-2 border-foreground pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Banquet Event Order
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {wedding.couple_names}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatLongDate(wedding.wedding_date)}
              {spaceName ? ` · ${spaceName}` : ""}
            </p>
          </div>
          <div className="text-right text-sm tabular-nums text-foreground">
            <p className="font-medium">{guests.length} guests</p>
            {(day != null || evening != null) && (
              <p className="text-xs text-muted-foreground">
                {day != null ? `Day ${day}` : ""}
                {day != null && evening != null ? " · " : ""}
                {evening != null ? `Evening ${evening}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Run of show */}
        <Section title="Run of show">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No run-sheet items yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {timeline.map((t) => (
                <li key={t.id} className="flex items-baseline gap-3 text-sm">
                  <span className="w-14 shrink-0 text-right font-medium tabular-nums text-foreground">
                    {t.starts_at_time}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">{t.title}</span>
                    {t.owner && <span className="ml-2 text-xs text-muted-foreground">{t.owner}</span>}
                    {t.notes && <p className="text-xs text-muted-foreground">{t.notes}</p>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Menu (shared with the chef sheet) */}
        <Section title="Catering">
          <MenuSummaryView summary={summary} />
        </Section>

        {/* Suppliers */}
        <Section title="Suppliers">
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suppliers assigned.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {suppliers.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-medium text-foreground">{s.name}</span>
                  <span className="text-xs uppercase tracking-[0.04em] text-muted-foreground">{s.category}</span>
                  {s.arrival_time && (
                    <span className="text-xs tabular-nums text-muted-foreground">arr {s.arrival_time}</span>
                  )}
                  {(s.contact_name || s.phone) && (
                    <span className="text-xs text-muted-foreground">
                      {[s.contact_name, s.phone].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Notes */}
        {wedding.notes && (
          <Section title="Notes">
            <p className="whitespace-pre-wrap text-sm text-foreground">{wedding.notes}</p>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h2 className="mb-2 border-b border-border pb-1 text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
