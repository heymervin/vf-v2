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
  // couple_accounts cascade-deletes when wedding is deleted; delete them first
  // just in case RLS or FK ordering requires it in this Supabase version.
  await admin.from("couple_accounts").delete().eq("venue_id", venueId);
  await admin.from("weddings").delete().eq("venue_id", venueId);
}

// ---------------------------------------------------------------------------
// Test 1 — /weddings empty state: heading + create button visible
// ---------------------------------------------------------------------------

test("weddings/index: empty state shows heading and Create wedding button", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  const slug = `wed-empty-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    await page.goto("/weddings");

    // Page heading
    await expect(
      page.getByRole("heading", { name: "Weddings" }),
    ).toBeVisible();

    // Empty state copy
    await expect(
      page.getByText("No booked weddings yet"),
    ).toBeVisible();

    // Create wedding button in the empty state
    await expect(
      page.getByRole("button", { name: "Create wedding" }),
    ).toBeVisible();

    await page.screenshot({ path: "logs/data/weddings-empty-state.png" });
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 2 — /weddings: unauthenticated access redirects to /login
// ---------------------------------------------------------------------------

test("weddings/index: unauthenticated access redirects to /login", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);

  await page.goto("/weddings");
  await page.waitForURL("**/login", { timeout: 10_000 });
  await expect(page.getByLabel("Email")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 3 — Create wedding: happy path
//   login → /weddings (empty) → open sheet → fill form → submit
//   → wedding appears in index → click into it → hub shows details + planning
// ---------------------------------------------------------------------------

test("weddings: create wedding manually, appears in index, workspace hub shows details and planning tabs", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `wed-create-${random}`;
  let userId = "";
  let venueId = "";

  // Use a fixed future date so the workspace "days to go" renders deterministically
  const weddingDateValue = "2027-09-18";
  const coupleNamesValue = `Smoke & Test ${random}`;
  const partnerAEmail = `partner-a-${random}@smoke.venueflow.io`;

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    // ── Log in ────────────────────────────────────────────────────────────
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // ── Navigate to /weddings ─────────────────────────────────────────────
    await page.goto("/weddings");
    await expect(
      page.getByRole("heading", { name: "Weddings" }),
    ).toBeVisible();
    await expect(page.getByText("No booked weddings yet")).toBeVisible();

    await page.screenshot({ path: "logs/data/weddings-before-create.png" });

    // ── Open Create wedding sheet ─────────────────────────────────────────
    await page.getByRole("button", { name: "Create wedding" }).click();

    // Sheet title
    await expect(
      page.getByRole("heading", { name: "Create wedding" }),
    ).toBeVisible({ timeout: 5_000 });

    // ── Fill the form ─────────────────────────────────────────────────────
    await page.getByLabel("Couple names *").fill(coupleNamesValue);
    await page.getByLabel("Partner A email *").fill(partnerAEmail);
    await page.getByLabel("Wedding date").fill(weddingDateValue);

    await page.screenshot({ path: "logs/data/weddings-create-form-filled.png" });

    // ── Submit ────────────────────────────────────────────────────────────
    // The submit button inside the sheet form — scope to avoid ambiguity with
    // any other "Create wedding" button still visible behind the sheet overlay
    const submitBtn = page
      .getByRole("dialog")
      .getByRole("button", { name: "Create wedding" });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // ── Success toast ─────────────────────────────────────────────────────
    await expect(page.getByText("Wedding created")).toBeVisible({
      timeout: 12_000,
    });

    // ── Redirected to the workspace hub ──────────────────────────────────
    await page.waitForURL("**/weddings/**", { timeout: 12_000 });

    // ── Wedding Workspace hub: couple names in heading ────────────────────
    await expect(
      page.getByRole("heading", { name: coupleNamesValue }),
    ).toBeVisible({ timeout: 10_000 });

    // ── Status badge: "planning" is the default (exact: avoid the "Planning tools" heading) ──
    await expect(
      page.getByText("Planning", { exact: true }),
    ).toBeVisible();

    // ── "Planning tools" section heading (D7 — scoped to this wedding) ────
    await expect(
      page.getByRole("heading", { name: "Planning tools" }),
    ).toBeVisible();

    // ── Planning rail tiles ───────────────────────────────────────────────
    const rail = page.getByRole("list", { name: "Planning tools" });
    await expect(rail).toBeVisible();

    for (const label of ["Guests", "Menu", "Run sheet", "Floor plan", "Suppliers"]) {
      await expect(
        rail.getByRole("listitem").filter({ hasText: label }),
      ).toBeVisible({ timeout: 5_000 });
    }

    // ── Status strip cells are present (Days / Paid / Balance / Tasks) ────
    await expect(page.getByText("Days to go", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Paid", { exact: true })).toBeVisible();
    await expect(page.getByText("Balance", { exact: true })).toBeVisible();
    await expect(page.getByText("Tasks", { exact: true }).first()).toBeVisible();

    // ── Key facts section shows Source = Manual ───────────────────────────
    await expect(page.getByText("Manual").first()).toBeVisible();

    await page.screenshot({ path: "logs/data/weddings-hub-after-create.png" });

    // ── Navigate back to /weddings index ─────────────────────────────────
    await page.goto("/weddings");
    await expect(
      page.getByRole("heading", { name: "Weddings" }),
    ).toBeVisible();

    // The created wedding card must appear
    await expect(
      page.getByText(coupleNamesValue).first(),
    ).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "logs/data/weddings-index-with-wedding.png" });

    // ── Click the wedding card to re-enter the hub ────────────────────────
    await page.getByText(coupleNamesValue).first().click();
    await page.waitForURL("**/weddings/**", { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: coupleNamesValue }),
    ).toBeVisible({ timeout: 8_000 });
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 4 — Create wedding: form validation — couple names required
// ---------------------------------------------------------------------------

test("weddings/create: submitting without couple names must not proceed", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  const slug = `wed-val-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    await page.goto("/weddings");
    await page.getByRole("button", { name: "Create wedding" }).click();
    await expect(
      page.getByRole("heading", { name: "Create wedding" }),
    ).toBeVisible({ timeout: 5_000 });

    // Fill only the required email — leave couple names empty
    await page
      .getByLabel("Partner A email *")
      .fill(`noname-${random}@smoke.venueflow.io`);

    // Submit — HTML5 required on coupleNames must block the action
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create wedding" })
      .click();

    // Short wait — no toast should fire, no navigation should happen
    await page.waitForTimeout(800);
    await expect(page.getByText("Wedding created")).not.toBeVisible();

    // Sheet stays open; form is still present
    await expect(page.getByLabel("Couple names *")).toBeVisible();
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 5 — Create wedding: form validation — partner A email required
// ---------------------------------------------------------------------------

test("weddings/create: submitting without Partner A email must not proceed", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  const slug = `wed-noeml-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    await page.goto("/weddings");
    await page.getByRole("button", { name: "Create wedding" }).click();
    await expect(
      page.getByRole("heading", { name: "Create wedding" }),
    ).toBeVisible({ timeout: 5_000 });

    // Fill only couple names — leave email empty
    await page.getByLabel("Couple names *").fill(`NoEmail & Couple ${random}`);

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create wedding" })
      .click();

    await page.waitForTimeout(800);
    await expect(page.getByText("Wedding created")).not.toBeVisible();

    // Sheet stays open
    await expect(page.getByLabel("Partner A email *")).toBeVisible();
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 6 — Workspace hub: direct /weddings/[nonexistent-id] returns 404
// ---------------------------------------------------------------------------

test("weddings/hub: non-existent wedding ID returns 404", async ({ page }) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  const slug = `wed-404-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // A valid UUID that doesn't belong to this venue
    const fakeId = "00000000-0000-0000-0000-000000000001";
    const response = await page.goto(`/weddings/${fakeId}`);

    // Next.js notFound() → 404 status. Some frameworks return 200 with the
    // not-found UI, so accept either: status 404 OR the visible not-found text.
    const status = response?.status() ?? 0;
    if (status !== 404) {
      // Fallback: the page must render Next.js not-found UI text
      await expect(
        page.getByText(/not found|404/i),
      ).toBeVisible({ timeout: 8_000 });
    }
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 7 — /weddings/[id]: unauthenticated access redirects to /login
// ---------------------------------------------------------------------------

test("weddings/hub: unauthenticated access redirects to /login", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);

  const fakeId = "00000000-0000-0000-0000-000000000002";
  await page.goto(`/weddings/${fakeId}`);
  await page.waitForURL("**/login", { timeout: 10_000 });
  await expect(page.getByLabel("Email")).toBeVisible();
});
