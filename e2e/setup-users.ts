/**
 * Utility: create and cleanup throwaway Supabase users for E2E smoke tests.
 * Uses the service role key (admin API) — never anon key.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createSmokeUser(suffix: string) {
  const admin = adminClient();
  const email = `onboard-smoke+${suffix}@venueflow.io`;
  const password = `Test${Math.random().toString(36).slice(2, 10)}Aa1!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create smoke user: ${error?.message}`);
  }

  return { userId: data.user.id, email, password };
}

export async function deleteSmokeUser(userId: string) {
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}

/**
 * Seed a fully-onboarded venue + owner membership for `userId`, so a test can
 * log in and land straight on the app (skipping the onboarding wizard).
 */
export async function createCompletedVenue(userId: string, slug: string) {
  const admin = adminClient();
  const { data: venue, error } = await admin
    .from("venues")
    .insert({
      name: `Contacts Venue ${slug}`,
      slug,
      timezone: "Europe/London",
      onboarding_step: 3,
      onboarding_completed_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    })
    .select("id")
    .single();

  if (error || !venue) {
    throw new Error(`Failed to create venue: ${error?.message}`);
  }

  const { error: mErr } = await admin
    .from("memberships")
    .insert({ venue_id: venue.id, user_id: userId, role: "owner" });

  if (mErr) throw new Error(`Failed to create membership: ${mErr.message}`);

  return venue.id as string;
}

export async function deleteVenuesForUser(userId: string) {
  const admin = adminClient();
  // Get membership → venue IDs
  const { data: memberships } = await admin
    .from("memberships")
    .select("venue_id")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) return;

  const venueIds = memberships.map((m: { venue_id: string }) => m.venue_id);

  // Delete venue_hours, spaces, memberships, venues
  await admin.from("venue_hours").delete().in("venue_id", venueIds);
  await admin.from("spaces").delete().in("venue_id", venueIds);
  await admin.from("memberships").delete().in("venue_id", venueIds);
  await admin.from("venues").delete().in("id", venueIds);
}
