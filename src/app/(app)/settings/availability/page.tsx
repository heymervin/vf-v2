import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailabilitySettings } from "./actions";
import { AvailabilitySettings } from "./availability-settings";

export const metadata = { title: "Availability" };

async function loadMembers(venueId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("memberships")
    .select("id, role, user_id")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });

  if (!data) return [];

  const members: { id: string; role: string; displayName: string }[] = [];
  for (const m of data) {
    let displayName = m.role === "owner" ? "Owner" : m.role;
    try {
      const { data: u } = await admin.auth.admin.getUserById(m.user_id);
      if (u?.user?.email) {
        displayName = u.user.email.split("@")[0] ?? u.user.email;
      }
    } catch {
      // non-critical
    }
    members.push({ id: m.id, role: m.role, displayName });
  }
  return members;
}

export default async function AvailabilitySettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const canManage = ctx.role === "owner" || ctx.role === "admin";

  const [settingsResult, members] = await Promise.all([
    getAvailabilitySettings(),
    loadMembers(ctx.venue.id),
  ]);

  if (!settingsResult.ok) {
    return (
      <div className="mx-auto max-w-[680px]">
        <p className="text-sm text-destructive">{settingsResult.error}</p>
      </div>
    );
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
        Availability
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Set when each team member is available for viewings and calls. You can
        add multiple windows per day (e.g. morning and afternoon). Also tune
        the duration and buffer for each meeting type.
      </p>

      <div className="mt-8">
        <AvailabilitySettings
          rules={settingsResult.data.rules}
          meetingTypes={settingsResult.data.meetingTypes}
          members={members}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
