import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ManageBooking } from "./manage-booking";

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params;
  const data = await loadAppointment(token);
  return {
    title: data ? `Your booking · ${data.venueName}` : "Manage booking",
  };
}

async function loadAppointment(token: string) {
  // UUID pattern guard — avoid hitting DB with garbage
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;

  const admin = createAdminClient();

  const { data: appt } = await admin
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, manage_token, meeting_type_id, venue_id, contact_id",
    )
    .eq("manage_token", token)
    .maybeSingle();

  if (!appt) return null;

  const [venueRes, mtRes, contactRes] = await Promise.all([
    admin
      .from("venues")
      .select("name, slug, timezone")
      .eq("id", appt.venue_id)
      .maybeSingle(),
    admin
      .from("meeting_types")
      .select("kind, duration_minutes")
      .eq("id", appt.meeting_type_id)
      .maybeSingle(),
    admin
      .from("contacts")
      .select("first_name, last_name, email")
      .eq("id", appt.contact_id)
      .maybeSingle(),
  ]);

  if (!venueRes.data || !mtRes.data) return null;

  return {
    id: appt.id,
    manageToken: appt.manage_token,
    startsAtUtc: appt.starts_at,
    endsAtUtc: appt.ends_at,
    status: appt.status as "booked" | "attended" | "no_show" | "cancelled",
    venueName: venueRes.data.name,
    venueSlug: venueRes.data.slug,
    venueTimezone: venueRes.data.timezone,
    meetingTypeKind: mtRes.data.kind as "viewing" | "call",
    durationMinutes: mtRes.data.duration_minutes,
    contactName: contactRes.data
      ? [contactRes.data.first_name, contactRes.data.last_name]
          .filter(Boolean)
          .join(" ")
      : null,
    contactEmail: contactRes.data?.email ?? null,
  };
}

export default async function ManageBookingPage({ params }: PageProps) {
  const { token } = await params;
  const data = await loadAppointment(token);
  if (!data) notFound();

  return (
    <main className="flex flex-1 flex-col items-center bg-[var(--background)] px-4 py-8 sm:py-14">
      <div className="w-full max-w-[560px]">
        {/* Warm header */}
        <header className="overflow-hidden rounded-t-2xl bg-gradient-to-br from-fun-pink via-mint to-fun-blue px-8 py-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/70">
            Manage booking
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-[1.1] tracking-[-0.022em] text-foreground">
            {data.venueName}
          </h1>
        </header>

        {/* Manage card */}
        <div className="rounded-b-2xl border border-t-0 border-border bg-card shadow-sm">
          <ManageBooking {...data} />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by VenueFlow
        </p>
      </div>
    </main>
  );
}
