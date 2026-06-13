import { notFound } from "next/navigation";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookingWidget } from "./booking-widget";

interface PageProps {
  params: Promise<{ venueSlug: string; meetingType: string }>;
}

async function loadVenueAndMeetingType(slug: string, meetingTypeKind: string) {
  if (meetingTypeKind !== "viewing" && meetingTypeKind !== "call") return null;

  const admin = createAdminClient();

  const { data: venue } = await admin
    .from("venues")
    .select("id, name, logo_path, timezone")
    .eq("slug", slug)
    .maybeSingle();

  if (!venue) return null;

  const { data: mt } = await admin
    .from("meeting_types")
    .select("id, kind, duration_minutes, buffer_minutes, enabled")
    .eq("venue_id", venue.id)
    .eq("kind", meetingTypeKind)
    .maybeSingle();

  if (!mt || !mt.enabled) return null;

  let logoUrl: string | null = null;
  if (venue.logo_path) {
    const { data } = await admin.storage
      .from("venue-assets")
      .createSignedUrl(venue.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }

  return {
    venueSlug: slug,
    venueName: venue.name,
    venueTimezone: venue.timezone,
    logoUrl,
    meetingType: {
      id: mt.id,
      kind: mt.kind as "viewing" | "call",
      durationMinutes: mt.duration_minutes,
    },
  };
}

export async function generateMetadata({ params }: PageProps) {
  const { venueSlug, meetingType } = await params;
  const data = await loadVenueAndMeetingType(venueSlug, meetingType);
  const typeLabel = meetingType === "viewing" ? "Venue viewing" : "Discovery call";
  return {
    title: data ? `${typeLabel} · ${data.venueName}` : typeLabel,
    description: data
      ? `Book a ${typeLabel.toLowerCase()} at ${data.venueName}.`
      : undefined,
  };
}

export default async function PublicBookingPage({ params }: PageProps) {
  const { venueSlug, meetingType } = await params;
  const data = await loadVenueAndMeetingType(venueSlug, meetingType);
  if (!data) notFound();

  const typeLabel =
    data.meetingType.kind === "viewing" ? "Venue viewing" : "Discovery call";
  const typeDesc =
    data.meetingType.kind === "viewing"
      ? "Choose a time to come and see the venue in person."
      : "Choose a time for a quick call to talk through your plans.";

  return (
    <main className="flex flex-1 flex-col items-center bg-[var(--background)] px-4 py-8 sm:py-14">
      <div className="w-full max-w-[720px]">
        {/* Warm header — venue's front door */}
        <header className="overflow-hidden rounded-t-2xl bg-gradient-to-br from-fun-pink via-mint to-fun-blue px-8 py-10 text-center">
          {data.logoUrl ? (
            <Image
              src={data.logoUrl}
              alt={data.venueName}
              width={72}
              height={72}
              className="mx-auto mb-3 size-[72px] rounded-xl object-contain"
              unoptimized
            />
          ) : null}
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/70">
            {typeLabel}
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-[1.1] tracking-[-0.022em] text-foreground">
            {data.venueName}
          </h1>
          <p className="mt-2 text-base text-foreground/70">{typeDesc}</p>
        </header>

        {/* Widget card */}
        <div className="rounded-b-2xl border border-t-0 border-border bg-card shadow-sm">
          <BookingWidget
            venueSlug={data.venueSlug}
            venueName={data.venueName}
            venueTimezone={data.venueTimezone}
            meetingTypeKind={data.meetingType.kind}
            durationMinutes={data.meetingType.durationMinutes}
          />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by VenueFlow
        </p>
      </div>
    </main>
  );
}
