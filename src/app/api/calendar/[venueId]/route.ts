import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFeedToken } from "@/lib/calendar/ical-token";
import { buildIcs, type IcsEvent } from "@/lib/calendar/ical";

export const dynamic = "force-dynamic";

/**
 * Read-only iCalendar feed of a venue's appointments. Token-gated (stateless
 * HMAC, see ical-token.ts) so it needs no user session — calendar apps
 * subscribe to the URL. Venue-scoped via the service-role admin client.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ venueId: string }> },
) {
  const { venueId } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? "";

  if (!verifyFeedToken(venueId, token)) {
    return new Response("Forbidden", { status: 403 });
  }

  const admin = createAdminClient();

  const { data: venue } = await admin
    .from("venues")
    .select("name")
    .eq("id", venueId)
    .maybeSingle();
  if (!venue) return new Response("Not found", { status: 404 });

  const { data: appts } = await admin
    .from("appointments")
    .select("id, starts_at, ends_at, status, contacts(first_name, last_name), meeting_types(kind)")
    .eq("venue_id", venueId)
    .order("starts_at", { ascending: true })
    .limit(1000);

  const events: IcsEvent[] = (appts ?? []).map((a) => {
    const c = Array.isArray(a.contacts) ? a.contacts[0] : a.contacts;
    const mt = Array.isArray(a.meeting_types) ? a.meeting_types[0] : a.meeting_types;
    const name = c
      ? [c.first_name, c.last_name].filter(Boolean).join(" ") || "Appointment"
      : "Appointment";
    const kind = mt?.kind ? ` (${mt.kind})` : "";
    return {
      uid: `${a.id}@venueflow`,
      start: a.starts_at,
      end: a.ends_at,
      summary: `${name}${kind}`,
      status: a.status,
    };
  });

  const ics = buildIcs(`${venue.name} — Appointments`, events);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="appointments.ics"',
      "Cache-Control": "public, max-age=300",
    },
  });
}
