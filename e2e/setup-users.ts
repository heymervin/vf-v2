/**
 * Utility: create and cleanup throwaway Supabase users for E2E smoke tests.
 * Uses the service role key (admin API) — never anon key.
 */

import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

/**
 * Hydration-safe sign-in for E2E specs. The login form is a client component;
 * if the submit button is clicked before React hydrates, the browser performs a
 * native GET (credentials land in the URL) and stays on /login. We detect that
 * and retry once against the now-hydrated page.
 */
export async function signIn(
  page: Page,
  user: { email: string; password: string },
) {
  async function attempt() {
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
  }
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await attempt();
  try {
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
      timeout: 12_000,
    });
  } catch {
    // Pre-hydration native GET — reload (now hydrated) and try once more.
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await attempt();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
      timeout: 30_000,
    });
  }
}

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
