import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadForm } from "../lead-form";

interface PageProps {
  params: Promise<{ venueSlug: string }>;
}

export const metadata = { title: "Enquiry form", robots: { index: false } };

/**
 * Iframe-embeddable form: transparent background, no header band, no VenueFlow
 * chrome — it inherits the host venue site's look. Next.js sets no
 * X-Frame-Options by default, so this route frames cleanly.
 */
export default async function EmbedFormPage({ params }: PageProps) {
  const { venueSlug } = await params;
  const admin = createAdminClient();
  const { data: venue } = await admin
    .from("venues")
    .select("name")
    .eq("slug", venueSlug)
    .maybeSingle();
  if (!venue) notFound();

  return (
    <>
      {/* Transparent body so the form blends into the host page. */}
      <style>{`body{background:transparent !important;}`}</style>
      <main className="px-4 py-6">
        <div className="mx-auto max-w-[560px]">
          <LeadForm venueSlug={venueSlug} venueName={venue.name} embed />
        </div>
      </main>
    </>
  );
}
