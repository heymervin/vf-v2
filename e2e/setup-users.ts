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

/** Insert a contact + one opportunity at `stage` for board tests. */
export async function seedOpportunity(
  venueId: string,
  firstName: string,
  lastName: string,
  stage: string,
  sortIndex: number,
) {
  const admin = adminClient();
  const { data: contact, error: cErr } = await admin
    .from("contacts")
    .insert({
      venue_id: venueId,
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      wedding_date: "2027-08-14",
      guest_count: 110,
      source: "Website",
    })
    .select("id")
    .single();
  if (cErr || !contact) throw new Error(`seed contact: ${cErr?.message}`);

  const { error: oErr } = await admin.from("opportunities").insert({
    venue_id: venueId,
    contact_id: contact.id,
    stage,
    sort_index: sortIndex,
  });
  if (oErr) throw new Error(`seed opportunity: ${oErr.message}`);
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

// ---------------------------------------------------------------------------
// M5 booking helpers
// ---------------------------------------------------------------------------

/**
 * Seed an availability rule for a membership on a given weekday.
 * weekday: 0=Sun … 6=Sat (JS Date.getDay convention).
 */
export async function seedAvailabilityRule(
  venueId: string,
  membershipId: string,
  weekday: number,
  startTime = "09:00",
  endTime = "17:00",
): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("availability_rules")
    .insert({
      venue_id: venueId,
      membership_id: membershipId,
      weekday,
      start_time: startTime,
      end_time: endTime,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`seed availability rule: ${error?.message}`);
  return data.id as string;
}

/**
 * Returns the membership id for a given user in a venue.
 */
export async function getMembershipId(venueId: string, userId: string): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("memberships")
    .select("id")
    .eq("venue_id", venueId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error(`getMembershipId: ${error?.message}`);
  return data.id as string;
}

/**
 * Delete all appointments for a venue (used in E2E cleanup).
 */
export async function deleteAppointmentsForVenue(venueId: string): Promise<void> {
  const admin = adminClient();
  await admin.from("appointments").delete().eq("venue_id", venueId);
}

/**
 * Delete all availability rules for a venue.
 */
export async function deleteAvailabilityRulesForVenue(venueId: string): Promise<void> {
  const admin = adminClient();
  await admin.from("availability_rules").delete().eq("venue_id", venueId);
}
