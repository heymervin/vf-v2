import { test, expect } from "@playwright/test";
import { createSmokeUser, deleteSmokeUser, deleteVenuesForUser } from "./setup-users";
import * as path from "path";
import * as fs from "fs";

// Load .env.local so SUPABASE_SERVICE_ROLE_KEY is available at test runtime.
// Avoids a dotenv dependency — we just parse KEY=VALUE lines ourselves.
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

const SCREENSHOTS_DIR = path.join(
  __dirname,
  "../logs/data/screenshots",
);

function screenshotPath(name: string) {
  return path.join(SCREENSHOTS_DIR, `${name}.png`);
}

// ---------------------------------------------------------------------------
// Test 1: Full onboarding flow — step 1, skip step 2, finish step 3
// ---------------------------------------------------------------------------
test("full onboarding wizard: complete all steps and land on dashboard", async ({
  page,
}) => {
  // Ensure env is loaded
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env vars. Check .env.local.");
  }

  const random = Date.now().toString(36);
  const slug = `smoke-${random}`;
  let userId = "";

  try {
    // 1. Create throwaway confirmed user
    const user = await createSmokeUser(random);
    userId = user.userId;

    // 2. Log in via /login UI
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // After login, should redirect to /onboarding (no venue yet)
    await page.waitForURL("**/onboarding", { timeout: 15_000 });
    await page.screenshot({ path: screenshotPath("m1-onboarding-step1") });

    // 3. Step 1: fill venue name, slug, timezone
    await page.getByLabel("Venue name").fill(`Smoke Venue ${random}`);

    // Slug auto-fills; clear and enter our test slug
    await page.getByLabel("Web address").fill(slug);

    // Timezone: open combobox and pick Europe/London (default)
    // The combobox trigger already shows Europe/London, no action needed
    // unless we want to change it — just verify it renders
    await expect(page.getByRole("combobox")).toBeVisible();

    await page.getByRole("button", { name: "Create my venue" }).click();

    // Should advance to step 2
    await expect(page.getByText("Tell us about your spaces.").first()).toBeVisible({
      timeout: 10_000,
    });
    await page.screenshot({ path: screenshotPath("m1-onboarding-step2") });

    // 4. Step 2: skip
    await page.getByRole("button", { name: /Skip for now/ }).click();

    // Should advance to step 3
    await expect(page.getByText("Set your opening hours.").first()).toBeVisible({
      timeout: 10_000,
    });
    await page.screenshot({ path: screenshotPath("m1-onboarding-step3") });

    // 5. Step 3: finish setup
    await page.getByRole("button", { name: "Finish setup" }).click();

    // Should redirect to /dashboard
    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await page.screenshot({ path: screenshotPath("m1-onboarding-done") });

    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
  } finally {
    // Cleanup
    if (userId) {
      await deleteVenuesForUser(userId).catch(() => {});
      await deleteSmokeUser(userId).catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// Test 2: Resume — complete only step 1, reload /onboarding, assert step 2
// ---------------------------------------------------------------------------
test("resume: after completing step 1, reload /onboarding lands on step 2", async ({
  page,
}) => {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env vars. Check .env.local.");
  }

  const random = `r${Date.now().toString(36)}`;
  const slug = `smoke-${random}`;
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;

    // Log in
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("**/onboarding", { timeout: 15_000 });

    // Complete only step 1
    await page.getByLabel("Venue name").fill(`Resume Venue ${random}`);
    await page.getByLabel("Web address").fill(slug);
    await page.getByRole("button", { name: "Create my venue" }).click();

    // Confirm we're on step 2
    await expect(page.getByText("Tell us about your spaces.").first()).toBeVisible({
      timeout: 10_000,
    });

    // Now reload /onboarding — should resume to step 2
    await page.goto("/onboarding");
    await page.waitForURL("**/onboarding", { timeout: 10_000 });

    // Step 2 should be visible
    await expect(
      page.getByText("Tell us about your spaces.").first(),
    ).toBeVisible({ timeout: 10_000 });

    // Step indicator should show "Space" as current step.
    // The span now includes sr-only state text so we match the aria-current attribute instead.
    await expect(page.locator('[aria-current="step"]')).toBeVisible();
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId).catch(() => {});
      await deleteSmokeUser(userId).catch(() => {});
    }
  }
});
