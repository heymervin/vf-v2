import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import type { HourEntry, ProfileInput } from "./actions";

export const metadata = { title: "Profile & brand · Settings" };

// Weekday mapping: DB weekday 0 = Sunday (ISO-like). The venue_hours table uses
// weekday 0–6. We display Mon–Sun (indices 1–0 wrapping). We store and pass
// all 7 rows sorted by weekday ascending and let the form label them.

const DEFAULT_HOURS: HourEntry[] = [
  { weekday: 0, openTime: "09:00", closeTime: "17:00", closed: false }, // Sun
  { weekday: 1, openTime: "09:00", closeTime: "17:00", closed: false }, // Mon
  { weekday: 2, openTime: "09:00", closeTime: "17:00", closed: false }, // Tue
  { weekday: 3, openTime: "09:00", closeTime: "17:00", closed: false }, // Wed
  { weekday: 4, openTime: "09:00", closeTime: "17:00", closed: false }, // Thu
  { weekday: 5, openTime: "09:00", closeTime: "18:00", closed: false }, // Fri
  { weekday: 6, openTime: "10:00", closeTime: "17:00", closed: false }, // Sat
];

export default async function ProfileSettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const canManage = ctx.role === "owner" || ctx.role === "admin";

  const supabase = await createClient();

  // Fetch the full venue row
  const { data: venue, error: venueErr } = await supabase
    .from("venues")
    .select(
      "name, legal_name, tagline, address, phone, accent_seed, timezone",
    )
    .eq("id", ctx.venue.id)
    .single();

  if (venueErr || !venue) {
    return (
      <div className="mx-auto max-w-[680px]">
        <p className="text-sm text-destructive">Could not load venue profile.</p>
      </div>
    );
  }

  // Fetch opening hours — fall back to defaults when none are set yet
  const { data: hoursRows } = await supabase
    .from("venue_hours")
    .select("weekday, open_time, close_time")
    .eq("venue_id", ctx.venue.id)
    .order("weekday", { ascending: true });

  const openingHours: HourEntry[] =
    hoursRows && hoursRows.length === 7
      ? hoursRows.map((r) => ({
          weekday: r.weekday,
          openTime: r.open_time ?? null,
          closeTime: r.close_time ?? null,
          closed: r.open_time === null,
        }))
      : DEFAULT_HOURS;

  const initial: ProfileInput = {
    name: venue.name,
    legalName: venue.legal_name ?? "",
    tagline: venue.tagline ?? "",
    address: venue.address ?? "",
    phone: venue.phone ?? "",
    accentSeed: (venue.accent_seed as ProfileInput["accentSeed"]) ?? "pink",
    timezone: venue.timezone,
  };

  return (
    <div className="mx-auto max-w-[680px]">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Venue
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Profile &amp; brand
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Your venue&apos;s identity — shown to couples on brochures, emails and
          the planning portal. Changes take effect on the next send.
        </p>
      </div>

      <ProfileForm
        initial={initial}
        openingHours={openingHours}
        canManage={canManage}
      />
    </div>
  );
}
