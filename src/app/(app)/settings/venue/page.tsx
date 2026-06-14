import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import type { VenueHourRow } from "@/lib/zod-schemas/settings-venue";
import { VenueForm } from "./venue-form";
import { DEFAULT_HOURS } from "@/app/onboarding/hours-defaults";

export const metadata = { title: "Venue profile & hours" };

export default async function VenueSettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const canManage = ctx.role === "owner" || ctx.role === "admin";
  const supabase = await createClient();

  // Load venue (name/slug/timezone/logo_path) — getTenantContext only has a subset
  const { data: venue } = await supabase
    .from("venues")
    .select("name, slug, timezone, logo_path")
    .eq("id", ctx.venue.id)
    .single();

  // Load opening hours
  const { data: hoursRows } = await supabase
    .from("venue_hours")
    .select("weekday, open_time, close_time")
    .eq("venue_id", ctx.venue.id)
    .order("weekday", { ascending: true });

  // Map DB rows → VenueHourRow (open=true when open_time is set)
  const hoursMap = new Map(
    (hoursRows ?? []).map((r) => [
      r.weekday,
      {
        weekday: r.weekday,
        open: r.open_time !== null,
        open_time: r.open_time ? r.open_time.slice(0, 5) : null,
        close_time: r.close_time ? r.close_time.slice(0, 5) : null,
      } satisfies VenueHourRow,
    ]),
  );

  // Merge DB rows with defaults so all 7 weekdays are always represented
  const initialHours: VenueHourRow[] = DEFAULT_HOURS.map((def) => {
    return hoursMap.get(def.weekday) ?? def;
  });

  // Resolve logo to a signed URL (60-minute window — enough for a settings page)
  let initialLogoUrl: string | null = null;
  if (venue?.logo_path) {
    const { data } = await supabase.storage
      .from("venue-assets")
      .createSignedUrl(venue.logo_path, 60 * 60);
    initialLogoUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="mx-auto max-w-[680px]">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
        Venue profile &amp; hours
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Your venue name, web address, timezone, logo, and opening hours.
      </p>

      <div className="mt-8">
        <VenueForm
          initialName={venue?.name ?? ctx.venue.name}
          initialSlug={venue?.slug ?? ctx.venue.slug}
          initialTimezone={venue?.timezone ?? ctx.venue.timezone}
          initialLogoUrl={initialLogoUrl}
          initialHours={initialHours}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
