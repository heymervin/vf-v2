import { test, expect } from "@playwright/test";
import {
  createSmokeUser,
  deleteSmokeUser,
  deleteVenuesForUser,
  createCompletedVenue,
} from "./setup-users";
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
// Test 1 — Settings index tile links to /settings/ghl
// ---------------------------------------------------------------------------

test("settings/index: GoHighLevel tile is present and navigates to /settings/ghl", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  const slug = `ghl-tile-${random}`;
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    await createCompletedVenue(userId, slug);

    // Log in
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Navigate to settings index
    await page.goto("/settings");
    const ghlTile = page.getByRole("link", { name: /GoHighLevel/ });
    await expect(ghlTile).toBeVisible();

    // Click the tile and confirm navigation
    await ghlTile.click();
    await page.waitForURL("**/settings/ghl", { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: "GoHighLevel" }),
    ).toBeVisible();
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 2 — Disconnected state: page structure and connect form
// ---------------------------------------------------------------------------

test("settings/ghl: disconnected state shows connect form with correct fields", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  const slug = `ghl-disc-${random}`;
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    await createCompletedVenue(userId, slug);

    // Log in
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Navigate to GHL settings
    await page.goto("/settings/ghl");
    await expect(
      page.getByRole("heading", { name: "GoHighLevel" }),
    ).toBeVisible();

    // Back-navigation link must be present (scope to main; nav also has a Settings link)
    await expect(
      page.getByRole("main").getByRole("link", { name: "Settings" }),
    ).toBeVisible();

    // Status card shows "Not connected" (exact: the description also contains the phrase)
    await expect(page.getByText("Not connected", { exact: true })).toBeVisible();
    // The status description paragraph
    await expect(
      page.getByText("Not connected — GHL features are disabled."),
    ).toBeVisible();

    // Connect-sub-account section visible (h2 text)
    await expect(
      page.getByText("Connect your sub-account", { exact: false }),
    ).toBeVisible();

    // Both form fields must be present and labeled
    await expect(page.getByLabel("Private Integration Token")).toBeVisible();
    await expect(page.getByLabel("Location ID")).toBeVisible();

    // Submit button present and enabled
    const connectBtn = page.getByRole("button", { name: "Connect GoHighLevel" });
    await expect(connectBtn).toBeVisible();
    await expect(connectBtn).toBeEnabled();

    // Disconnect and Test connection buttons must NOT exist in disconnected state
    await expect(
      page.getByRole("button", { name: "Disconnect" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Test connection" }),
    ).not.toBeVisible();

    // Screenshot for visual record
    await page.screenshot({ path: "logs/data/ghl-settings-disconnected.png" });
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 3 — Connect flow: fake token → success or encryption-error toast;
//           if success → connected UI; Test connection → graceful API error;
//           reload persists; Disconnect returns to disconnected state.
// ---------------------------------------------------------------------------

test("settings/ghl: connect with fake token, test connection shows graceful error, disconnect reverts state", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  const slug = `ghl-conn-${random}`;
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    await createCompletedVenue(userId, slug);

    // Log in
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Navigate to GHL settings
    await page.goto("/settings/ghl");
    await expect(
      page.getByRole("heading", { name: "GoHighLevel" }),
    ).toBeVisible();

    // Fill connect form with a fake PIT + locationId
    await page.getByLabel("Private Integration Token").fill("fake-pit-token-for-testing");
    await page.getByLabel("Location ID").fill("fake-location-abc123");

    // Screenshot before submit
    await page.screenshot({ path: "logs/data/ghl-settings-before-connect.png" });

    // Submit
    await page.getByRole("button", { name: "Connect GoHighLevel" }).click();

    // Either a success toast (encryption key present) or an encryption-error
    // toast (key absent). Both are valid — the page must not crash either way.
    const successToast = page.getByText("GoHighLevel connected.");
    const encryptionErrorToast = page.getByText(/Token encryption failed/);
    await expect(successToast.or(encryptionErrorToast)).toBeVisible({
      timeout: 8_000,
    });

    // If the encryption key is present and credentials are stored, verify the
    // full connected flow.
    if (await successToast.isVisible()) {
      // Status badge flips to "Connected"
      await expect(page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 8_000 });

      // Location ID appears in the status description
      await expect(
        page.getByText(/Location fake-location-abc123/),
      ).toBeVisible();

      // Connect form is gone once connected
      await expect(
        page.getByRole("button", { name: "Connect GoHighLevel" }),
      ).not.toBeVisible();

      // Action buttons are present
      await expect(
        page.getByRole("button", { name: "Test connection" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Disconnect" }),
      ).toBeVisible();

      // Screenshot of connected state
      await page.screenshot({ path: "logs/data/ghl-settings-connected.png" });

      // Test connection with a fake token → GHL rejects it → graceful error toast
      await page.getByRole("button", { name: "Test connection" }).click();
      await expect(
        page.getByText(/GHL API error|Connection failed|Unauthorized/),
      ).toBeVisible({ timeout: 10_000 });

      // Reload: "Connected" state must persist (credentials were written to DB)
      await page.reload();
      await expect(page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 8_000 });
      await expect(
        page.getByRole("button", { name: "Test connection" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Disconnect" }),
      ).toBeVisible();
      // Connect form stays hidden after reload
      await expect(
        page.getByRole("button", { name: "Connect GoHighLevel" }),
      ).not.toBeVisible();

      // Screenshot after reload
      await page.screenshot({ path: "logs/data/ghl-settings-after-reload.png" });

      // Disconnect
      await page.getByRole("button", { name: "Disconnect" }).click();
      await expect(
        page.getByText("GoHighLevel disconnected."),
      ).toBeVisible({ timeout: 8_000 });

      // Back to disconnected state
      await expect(page.getByText("Not connected", { exact: true })).toBeVisible({
        timeout: 8_000,
      });
      await expect(
        page.getByRole("button", { name: "Connect GoHighLevel" }),
      ).toBeVisible();
    }
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 4 — Token field must be a password input (masked), not plaintext
// ---------------------------------------------------------------------------

test("settings/ghl: Private Integration Token field masks input", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  const slug = `ghl-mask-${random}`;
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    await createCompletedVenue(userId, slug);

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    await page.goto("/settings/ghl");
    await expect(
      page.getByRole("heading", { name: "GoHighLevel" }),
    ).toBeVisible();

    // The token input must be type="password" so the raw PIT is never visible
    const tokenInput = page.getByLabel("Private Integration Token");
    await expect(tokenInput).toHaveAttribute("type", "password");
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 5 — Form validation: submitting empty fields must not proceed
// ---------------------------------------------------------------------------

test("settings/ghl: connect form requires both token and location ID", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  const slug = `ghl-val-${random}`;
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    await createCompletedVenue(userId, slug);

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    await page.goto("/settings/ghl");
    await expect(
      page.getByRole("heading", { name: "GoHighLevel" }),
    ).toBeVisible();

    // Submit without filling anything — HTML5 required attributes must block it
    await page.getByRole("button", { name: "Connect GoHighLevel" }).click();

    // The page must NOT navigate away, toast must NOT fire "GoHighLevel connected."
    await page.waitForTimeout(500);
    await expect(page.getByText("GoHighLevel connected.")).not.toBeVisible();

    // Form fields still visible (page didn't navigate or crash)
    await expect(page.getByLabel("Private Integration Token")).toBeVisible();
    await expect(page.getByLabel("Location ID")).toBeVisible();
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 6 — Unauthenticated request redirects to /login
// ---------------------------------------------------------------------------

test("settings/ghl: unauthenticated access redirects to /login", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);

  // Visit GHL settings without logging in
  await page.goto("/settings/ghl");

  // Must redirect to login
  await page.waitForURL("**/login", { timeout: 10_000 });
  await expect(page.getByLabel("Email")).toBeVisible();
});
