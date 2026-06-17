/**
 * e2e tests for the Messages tab — Slice 6 (messaging mirror).
 *
 * Scope: rendering + graceful states in the dev environment.
 * Live GHL message round-trips are NOT tested (VF2 dev has no real GHL PIT).
 *
 * Covers:
 *   1. Messages tab renders the correct heading when GHL is not connected
 *      (no ghl_credentials row → graceful "GHL is not connected" connect prompt).
 *   2. Messages tab renders a "no contact linked" prompt when the wedding has
 *      no ghl_contact_id (venue has GHL config but wedding was manually created).
 *   3. The Messages tile appears on the Planning rail of the Wedding Workspace hub.
 *   4. Unauthenticated access to /weddings/{id}/messages redirects to /login.
 *
 * Playwright locator rules applied:
 *   - data-testid attributes on connect-prompt elements for unambiguous targeting.
 *   - .first() on any locator where duplicates might appear (responsive layouts).
 *   - role+name selectors preferred over bare getByText.
 */

import { test, expect } from "@playwright/test";
import {
  createSmokeUser,
  deleteSmokeUser,
  deleteVenuesForUser,
  createCompletedVenue,
} from "./setup-users";
import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as fs from "fs";
import { encryptToken } from "../src/lib/ghl/crypto";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function deleteWeddingsForVenue(venueId: string) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  await admin.from("couple_accounts").delete().eq("venue_id", venueId);
  await admin.from("weddings").delete().eq("venue_id", venueId);
}

async function createManualWedding(venueId: string): Promise<string> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const random = Date.now().toString(36);
  const { data, error } = await admin
    .from("weddings")
    .insert({
      venue_id: venueId,
      couple_names: `Messages Smoke ${random}`,
      wedding_date: "2027-11-15",
      status: "planning",
      source: "manual",
      // ghl_contact_id intentionally left null
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createManualWedding failed: ${error?.message}`);
  return data.id as string;
}

// ---------------------------------------------------------------------------
// Test 1 — Messages tab shows "GHL not connected" prompt when no GHL creds
// ---------------------------------------------------------------------------

test("messages tab: shows connect-GHL prompt when venue has no GHL credentials", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `msg-no-ghl-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    // Create a wedding manually (no GHL credentials exist for this venue)
    const weddingId = await createManualWedding(venueId);

    // Log in
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Navigate to the Messages tab
    await page.goto(`/weddings/${weddingId}/messages`);

    // Heading must appear
    await expect(
      page.getByRole("heading", { name: "Messages" }),
    ).toBeVisible({ timeout: 10_000 });

    // Graceful connect prompt (no-ghl state)
    await expect(
      page.locator("[data-testid='messages-no-ghl']"),
    ).toBeVisible({ timeout: 8_000 });

    // The prompt copy explains the situation
    await expect(
      page.getByText("GHL is not connected", { exact: false }).first(),
    ).toBeVisible();

    // "Connect GHL" link points to /settings/ghl
    const connectLink = page.getByRole("link", { name: "Connect GHL" });
    await expect(connectLink).toBeVisible();
    await expect(connectLink).toHaveAttribute("href", /settings\/ghl/);

    await page.screenshot({
      path: "logs/data/messages-no-ghl-prompt.png",
    });
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 2 — Messages tab shows "no contact linked" prompt when wedding has
//           no ghl_contact_id (even if venue has GHL credentials configured)
//           We simulate this by inserting a ghl_credentials row without a real
//           PIT so ghlClient returns a non-null client, but the wedding has
//           no ghl_contact_id. The page should still render gracefully.
//
//  NOTE: This test relies on the page's degradation path:
//    ghlClient != null BUT wedding.ghl_contact_id == null
//          → render MessagesConnectPrompt reason="no-contact"
//
//  Because there is no real GHL PIT in the dev env, inserting a fake
//  ghl_credentials row won't cause a live API call to succeed — but
//  the page still renders the connect prompt before ever calling listConversations
//  (because ghl_contact_id is null). So no live GHL call is made.
// ---------------------------------------------------------------------------

test("messages tab: shows no-contact prompt when wedding has no ghl_contact_id", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `msg-no-contact-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    // Insert a fake ghl_credentials row so ghlClient(venueId) returns non-null.
    // The access_token is a placeholder (encrypted form doesn't matter here —
    // the page will return the no-contact prompt before calling GHL).
    // We use the admin service-role client to bypass RLS (ghl_credentials is
    // service-role only per specs/ghl-integration.md §13.1).
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    await admin.from("ghl_credentials").insert({
      venue_id: venueId,
      location_id: `loc_smoke_${random}`,
      auth_type: "pit",
      // A VALID encrypted token (same GHL_TOKEN_ENCRYPTION_KEY as .env.local) so
      // ghlClient() decrypts it and returns non-null, letting the page reach the
      // "no contact linked" branch. No live GHL call happens — ghl_contact_id is null.
      access_token: encryptToken("fake-pit-for-no-contact-test"),
    });

    // Create a wedding WITHOUT ghl_contact_id
    const weddingId = await createManualWedding(venueId);

    // Log in
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Navigate to the Messages tab
    await page.goto(`/weddings/${weddingId}/messages`);

    // Heading must appear
    await expect(
      page.getByRole("heading", { name: "Messages" }),
    ).toBeVisible({ timeout: 10_000 });

    // Graceful no-contact prompt
    await expect(
      page.locator("[data-testid='messages-no-contact']"),
    ).toBeVisible({ timeout: 8_000 });

    await expect(
      page.getByText("No GHL contact linked", { exact: false }).first(),
    ).toBeVisible();

    await page.screenshot({
      path: "logs/data/messages-no-contact-prompt.png",
    });
  } finally {
    if (venueId) {
      // Clean up ghl_credentials too
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      await admin.from("ghl_credentials").delete().eq("venue_id", venueId);
      await deleteWeddingsForVenue(venueId);
    }
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 3 — Messages tile appears on the Planning rail of the hub
// ---------------------------------------------------------------------------

test("wedding hub: Messages tile appears on the planning rail", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `msg-tile-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);
    const weddingId = await createManualWedding(venueId);

    // Log in
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Open the wedding workspace hub
    await page.goto(`/weddings/${weddingId}`);
    await expect(
      page.getByRole("heading", { name: "Planning tools" }),
    ).toBeVisible({ timeout: 10_000 });

    // Messages tile must be in the planning rail
    const rail = page.getByRole("list", { name: "Planning tools" });
    await expect(rail).toBeVisible();

    const messagesTile = rail.getByRole("listitem").filter({ hasText: "Messages" });
    await expect(messagesTile).toBeVisible({ timeout: 5_000 });

    // The tile links to /weddings/{id}/messages
    await expect(messagesTile.first()).toHaveAttribute(
      "href",
      new RegExp(`/weddings/${weddingId}/messages`),
    );

    await page.screenshot({ path: "logs/data/messages-rail-tile.png" });
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 4 — Unauthenticated access redirects to /login
// ---------------------------------------------------------------------------

test("messages tab: unauthenticated access redirects to /login", async ({
  page,
}) => {
  page.setDefaultTimeout(10_000);
  // Use a plausible-looking UUID — will never match a real wedding since we're
  // not logged in, and the redirect fires before any DB read.
  await page.goto("/weddings/00000000-0000-4000-8000-000000000000/messages");
  await page.waitForURL("**/login", { timeout: 10_000 });
  await expect(page.getByLabel("Email")).toBeVisible();
});
