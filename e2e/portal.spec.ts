/**
 * E2E: Couple Portal — Slice 8
 *
 * Tests the couple portal auth flow and core UI behaviour.
 * Seeds a test couple account + wedding via the service-role admin client;
 * uses generateLink (magic link) so we never need a real email.
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as fs from "fs";

// ── Env bootstrap (mirrors other specs) ────────────────────────────────────

(function loadEnvLocal() {
  const envPath = path.join(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
})();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Seed / teardown helpers ─────────────────────────────────────────────────

interface PortalSeed {
  userId: string;
  email: string;
  venueId: string;
  weddingId: string;
  coupleAccountId: string;
}

async function seedPortalCouple(suffix: string): Promise<PortalSeed> {
  const admin = adminClient();
  const email = `portal-smoke+${suffix}@venueflow.io`;

  // Create auth user (email confirmed)
  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (userErr || !userData.user) {
    throw new Error(`Failed to create portal user: ${userErr?.message}`);
  }
  const userId = userData.user.id;

  // Create venue
  const { data: venue, error: venueErr } = await admin
    .from("venues")
    .insert({
      name: `Rosewood Manor (${suffix})`,
      slug: `rosewood-${suffix}`,
      timezone: "Europe/London",
      onboarding_step: 3,
      onboarding_completed_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (venueErr || !venue) {
    throw new Error(`Failed to create venue: ${venueErr?.message}`);
  }
  const venueId = venue.id as string;

  // Create wedding
  const { data: wedding, error: weddingErr } = await admin
    .from("weddings")
    .insert({
      venue_id: venueId,
      couple_names: "Emma Henderson & James Carter",
      wedding_date: "2027-06-12",
      status: "planning",
      contract_status: "missing",
      portal_active: true,
    })
    .select("id")
    .single();
  if (weddingErr || !wedding) {
    throw new Error(`Failed to create wedding: ${weddingErr?.message}`);
  }
  const weddingId = wedding.id as string;

  // Create active couple account linked to user
  const { data: ca, error: caErr } = await admin
    .from("couple_accounts")
    .insert({
      venue_id: venueId,
      wedding_id: weddingId,
      email,
      first_name: "Emma",
      user_id: userId,
      status: "active",
      activated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (caErr || !ca) {
    throw new Error(`Failed to create couple_account: ${caErr?.message}`);
  }

  return { userId, email, venueId, weddingId, coupleAccountId: ca.id as string };
}

async function teardownPortalSeed(seed: PortalSeed) {
  const admin = adminClient();
  // Delete in FK order (cascade on venue_id handles most; delete couple_account + user explicitly)
  await admin.from("wedding_guests").delete().eq("wedding_id", seed.weddingId);
  await admin.from("couple_messages").delete().eq("wedding_id", seed.weddingId);
  await admin.from("couple_accounts").delete().eq("id", seed.coupleAccountId);
  await admin.from("weddings").delete().eq("id", seed.weddingId);
  await admin.from("venues").delete().eq("id", seed.venueId);
  await admin.auth.admin.deleteUser(seed.userId);
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe("portal: couple portal smoke", () => {
  let seed: PortalSeed;

  test.beforeAll(async () => {
    const suffix = Date.now().toString(36);
    seed = await seedPortalCouple(suffix);
  });

  test.afterAll(async () => {
    if (seed) await teardownPortalSeed(seed);
  });

  test("couple can sign in via magic link and see portal", async ({ page }) => {
    page.setDefaultTimeout(15_000);

    const admin = adminClient();

    // Generate a magic link (OTP link) for the couple user
    const { data: linkData, error: linkErr } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: seed.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/portal/auth/callback`,
        },
      });

    if (linkErr || !linkData?.properties?.action_link) {
      throw new Error(`generateLink failed: ${linkErr?.message}`);
    }

    const actionLink = linkData.properties.action_link as string;

    // Navigate to the magic link — Supabase exchanges the token and redirects
    // to /api/portal/auth/callback, which then redirects to /portal.
    await page.goto(actionLink);
    await page.waitForURL("**/portal", { timeout: 20_000 });

    // Venue name visible in header
    await expect(
      page.getByText(`Rosewood Manor (${seed.venueId.split("-")[0]}`).or(
        page.getByText("Rosewood Manor"),
      ),
    ).toBeVisible({ timeout: 10_000 });

    // Tabs visible
    await expect(page.getByRole("tab", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Guests" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Menu" })).toBeVisible();

    // Wedding date shown — couple_names appear in hero
    await expect(page.getByText("Emma")).toBeVisible();
  });

  test("couple can add a guest", async ({ page }) => {
    page.setDefaultTimeout(15_000);

    const admin = adminClient();
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: seed.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/portal/auth/callback`,
      },
    });
    const actionLink = linkData?.properties?.action_link as string;
    await page.goto(actionLink);
    await page.waitForURL("**/portal", { timeout: 20_000 });

    // Navigate to guests tab
    await page.getByRole("tab", { name: "Guests" }).click();

    // Open add guest sheet
    await page.getByRole("button", { name: "Add guest" }).click();

    // Fill in the guest name
    await page.getByLabel("Full name").fill("Alice Wonderland");

    // Save
    await page.getByRole("button", { name: "Add guest" }).last().click();

    // Optimistic update: guest appears immediately
    await expect(page.getByText("Alice Wonderland")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("couple CANNOT access staff routes", async ({ page }) => {
    page.setDefaultTimeout(15_000);

    const admin = adminClient();
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: seed.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/portal/auth/callback`,
      },
    });
    const actionLink = linkData?.properties?.action_link as string;
    await page.goto(actionLink);
    await page.waitForURL("**/portal", { timeout: 20_000 });

    // Attempt to visit the staff dashboard — should redirect to /login
    await page.goto("/dashboard");
    // Staff routes redirect unauthenticated (or wrong session type) to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
