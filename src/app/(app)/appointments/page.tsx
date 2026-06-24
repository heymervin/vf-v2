import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppointmentsBoard } from "./appointments-board";

export const metadata = { title: "Appointments" };

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

export interface AppointmentRow {
  id: string;
  startsAtUtc: string;
  endsAtUtc: string;
  status: "booked" | "attended" | "no_show" | "cancelled";
  meetingTypeKind: "viewing" | "call";
  contactName: string;
  contactEmail: string | null;
  memberName: string | null;
  membershipId: string;
}

async function loadWeekAppointments(
  venueId: string,
  weekStart: Date,
): Promise<AppointmentRow[]> {
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400_000);
  const admin = createAdminClient();

  const { data } = await admin
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, meeting_type_id, membership_id, contact_id, contacts(first_name, last_name, email), meeting_types(kind), memberships(user_id)",
    )
    .eq("venue_id", venueId)
    .gte("starts_at", weekStart.toISOString())
    .lt("starts_at", weekEnd.toISOString())
    .order("starts_at", { ascending: true });

  if (!data) return [];

  // Resolve user display names from auth.users via admin
  const membershipIds = [...new Set(data.map((r) => r.membership_id))];
  const userIds: string[] = [];
  for (const mid of membershipIds) {
    const row = data.find((r) => r.membership_id === mid);
    const mb = row?.memberships as { user_id: string } | null;
    if (mb?.user_id) userIds.push(mb.user_id);
  }

  // Build membership_id → display email map via admin auth.
  // Resolve all users in parallel (avoid an N+1 serial round-trip per member);
  // name display is non-critical so failures resolve to a null email.
  const memberNames: Record<string, string> = {};
  const resolved = await Promise.all(
    userIds.map((uid) =>
      admin.auth.admin
        .getUserById(uid)
        .then(({ data: u }) => ({ uid, email: u?.user?.email ?? null }))
        .catch(() => ({ uid, email: null as string | null })),
    ),
  );
  for (const { uid, email } of resolved) {
    if (!email) continue;
    const row = data.find(
      (r) => (r.memberships as { user_id: string } | null)?.user_id === uid,
    );
    if (row) memberNames[row.membership_id] = email.split("@")[0] ?? email;
  }

  return data.map((r) => {
    const contact = r.contacts as {
      first_name: string;
      last_name: string | null;
      email: string | null;
    } | null;
    const mt = r.meeting_types as { kind: string } | null;
    return {
      id: r.id,
      startsAtUtc: r.starts_at,
      endsAtUtc: r.ends_at,
      status: r.status as AppointmentRow["status"],
      meetingTypeKind: (mt?.kind ?? "viewing") as "viewing" | "call",
      contactName: contact
        ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
        : "Unknown",
      contactEmail: contact?.email ?? null,
      memberName: memberNames[r.membership_id] ?? null,
      membershipId: r.membership_id,
    };
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function AppointmentsPage({ searchParams }: PageProps) {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const { week } = await searchParams;

  // Determine week start (Monday). Default = this week.
  function getWeekStart(ref: Date): Date {
    const d = new Date(ref);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day; // back to Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  let weekStart: Date;
  if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
    weekStart = getWeekStart(new Date(week + "T00:00:00"));
  } else {
    weekStart = getWeekStart(new Date());
  }

  const appointments = await loadWeekAppointments(ctx.venue.id, weekStart);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Appointments
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Viewings and calls for your venue.
        </p>
      </div>

      <AppointmentsBoard
        appointments={appointments}
        weekStart={weekStart.toISOString()}
        venueTimezone={ctx.venue.timezone}
      />
    </div>
  );
}
