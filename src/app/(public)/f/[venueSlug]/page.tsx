import { notFound } from "next/navigation";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadForm } from "./lead-form";

interface PageProps {
  params: Promise<{ venueSlug: string }>;
}

async function loadVenue(slug: string) {
  const admin = createAdminClient();
  const { data: venue } = await admin
    .from("venues")
    .select("id, name, logo_path")
    .eq("slug", slug)
    .maybeSingle();
  if (!venue) return null;

  let logoUrl: string | null = null;
  if (venue.logo_path) {
    const { data } = await admin.storage
      .from("venue-assets")
      .createSignedUrl(venue.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }
  return { name: venue.name, logoUrl };
}

export async function generateMetadata({ params }: PageProps) {
  const { venueSlug } = await params;
  const venue = await loadVenue(venueSlug);
  return {
    title: venue ? `Enquire · ${venue.name}` : "Enquire",
    description: venue
      ? `Request a brochure and start planning your wedding at ${venue.name}.`
      : undefined,
  };
}

export default async function PublicFormPage({ params }: PageProps) {
  const { venueSlug } = await params;
  const venue = await loadVenue(venueSlug);
  if (!venue) notFound();

  return (
    <main className="flex flex-1 flex-col items-center bg-[var(--background)] px-4 py-8 sm:py-14">
      <div className="w-full max-w-[560px]">
        {/* Warm header band — the venue's front door */}
        <header className="overflow-hidden rounded-t-2xl bg-gradient-to-br from-fun-pink via-mint to-fun-blue px-8 py-10 text-center">
          {venue.logoUrl ? (
            <Image
              src={venue.logoUrl}
              alt={venue.name}
              width={72}
              height={72}
              className="mx-auto mb-3 size-[72px] rounded-xl object-contain"
              unoptimized
            />
          ) : null}
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/70">
            Wedding enquiry
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-[1.1] tracking-[-0.022em] text-foreground">
            {venue.name}
          </h1>
        </header>

        {/* Form card */}
        <div className="rounded-b-2xl border border-t-0 border-border bg-card px-6 py-8 shadow-sm sm:px-8">
          <p className="mb-6 text-base leading-relaxed text-muted-foreground">
            Tell us a little about your wedding and we&apos;ll send your brochure
            straight to your inbox.
          </p>
          <LeadForm venueSlug={venueSlug} venueName={venue.name} />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by VenueFlow
        </p>
      </div>
    </main>
  );
}
