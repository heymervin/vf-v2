import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Phone, CheckCircle2 } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Event day" };

const hhmm = (t: string | null) => (t ?? "").slice(0, 5);

export default async function EventDayPage({
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
    .select("id, couple_names, wedding_date, guest_count_day, guest_count_evening")
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();
  if (!wedding) notFound();

  const [{ data: evData }, { data: supData }] = await Promise.all([
    supabase
      .from("timeline_events")
      .select("id, title, starts_at_time, done, owner")
      .eq("wedding_id", id)
      .eq("venue_id", ctx.venue.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("wedding_suppliers")
      .select("id, name, phone, arrival_time, checked_in_at")
      .eq("wedding_id", id)
      .eq("venue_id", ctx.venue.id)
      .order("arrival_time", { ascending: true, nullsFirst: false }),
  ]);

  const events = evData ?? [];
  const suppliers = supData ?? [];

  // NOW / NEXT from the current local time (assumes you're viewing on the day).
  const now = new Date();
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  let currentIdx = -1;
  for (let i = 0; i < events.length; i++) {
    if (hhmm(events[i]!.starts_at_time) <= nowHHMM) currentIdx = i;
    else break;
  }
  const current = currentIdx >= 0 ? events[currentIdx]! : null;
  const next = events[currentIdx + 1] ?? null;

  const guests = wedding.guest_count_day ?? wedding.guest_count_evening ?? 0;
  const dateLabel = wedding.wedding_date
    ? new Date(wedding.wedding_date).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "Date TBC";

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-4">
        <Link
          href={`/weddings/${id}/runsheet`}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Run-sheet
        </Link>
      </div>

      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Event day
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          {wedding.couple_names}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {dateLabel} · {guests} guests
        </p>
      </div>

      {/* NOW / NEXT */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <NowNext label="Now" event={current} highlight />
        <NowNext label="Next" event={next} />
      </div>

      {/* Run of show */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Run of show
      </h2>
      {events.length === 0 ? (
        <p className="mb-8 text-sm text-muted-foreground">No run-sheet items yet.</p>
      ) : (
        <ul className="mb-8 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {events.map((e) => {
            const isNow = current?.id === e.id;
            return (
              <li
                key={e.id}
                className={
                  "flex min-h-[56px] items-center gap-3 px-4 py-3 " +
                  (isNow ? "bg-fun-pink/10" : "")
                }
              >
                <span className="w-14 shrink-0 text-right text-base font-bold tabular-nums text-foreground">
                  {hhmm(e.starts_at_time)}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      "text-base " +
                      (e.done ? "text-muted-foreground line-through" : "font-medium text-foreground")
                    }
                  >
                    {e.title}
                  </span>
                  {e.owner && (
                    <span className="ml-2 text-xs text-muted-foreground">{e.owner}</span>
                  )}
                </span>
                {e.done && <Check className="size-5 shrink-0 text-fun-green-strong" aria-label="Done" />}
              </li>
            );
          })}
        </ul>
      )}

      {/* Suppliers */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Suppliers
      </h2>
      {suppliers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No suppliers assigned.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {suppliers.map((s) => (
            <li key={s.id} className="flex min-h-[56px] items-center gap-3 px-4 py-3">
              <span className="w-14 shrink-0 text-right text-sm font-medium tabular-nums text-muted-foreground">
                {hhmm(s.arrival_time) || "—"}
              </span>
              <span className="min-w-0 flex-1 text-base font-medium text-foreground">{s.name}</span>
              {s.checked_in_at ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-fun-green-strong">
                  <CheckCircle2 className="size-4" /> In
                </span>
              ) : (
                s.phone && (
                  <a
                    href={`tel:${s.phone}`}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border text-muted-foreground"
                    aria-label={`Call ${s.name}`}
                  >
                    <Phone className="size-4" />
                  </a>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Tick items off and check suppliers in from the{" "}
        <Link href={`/weddings/${id}/runsheet`} className="underline underline-offset-2">
          full run-sheet
        </Link>
        .
      </p>
    </div>
  );
}

function NowNext({
  label,
  event,
  highlight = false,
}: {
  label: string;
  event: { title: string; starts_at_time: string | null } | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl border p-4 " +
        (highlight ? "border-fun-pink bg-fun-pink/10" : "border-border bg-card")
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      {event ? (
        <>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {hhmm(event.starts_at_time)}
          </p>
          <p className="text-sm text-foreground">{event.title}</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">—</p>
      )}
    </div>
  );
}
