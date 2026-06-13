/**
 * M6 — Billing & Reports smoke test.
 * Screenshots saved to logs/data/m6-*.png.
 *
 * Requires the dev server running on localhost:3103.
 * Run: pnpm exec playwright test e2e/m6-billing-reports.spec.ts
 */

import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { createSmokeUser, deleteSmokeUser, deleteVenuesForUser } from "./setup-users";

// Load .env.local so Supabase admin credentials are available at test runtime.
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

const SCREENSHOTS_DIR = path.join(__dirname, "../logs/data");

async function loginAndOnboard(page: import("@playwright/test").Page, email: string, password: string, slug: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("**/onboarding", { timeout: 15_000 });

  // Step 1: venue name + slug
  await page.getByLabel("Venue name").fill(`M6 Test ${slug}`);
  await page.getByLabel("Web address").fill(slug);
  await page.getByRole("button", { name: "Create my venue" }).click();

  // Step 2: skip spaces
  await expect(page.getByText("Tell us about your spaces.").first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Skip for now/ }).click();

  // Step 3: finish hours
  await expect(page.getByText("Set your opening hours.").first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Finish setup" }).click();

  await page.waitForURL(/\/(dashboard|contacts|pipeline)/, { timeout: 20_000 });
}

test("billing settings page renders", async ({ page }) => {
  const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const user = await createSmokeUser(`m6b-${runId}`);
  const slug = `m6b-${runId}`;

  try {
    await loginAndOnboard(page, user.email, user.password, slug);

    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Billing/i })).toBeVisible();
    // Trial status should be visible (new venue → trialing)
    await expect(page.getByText(/trial|subscription|plan/i).first()).toBeVisible({ timeout: 5000 });

    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "m6-billing.png"), fullPage: true });
  } finally {
    await deleteVenuesForUser(user.userId).catch(() => {});
    await deleteSmokeUser(user.userId).catch(() => {});
  }
});

test("reports page renders", async ({ page }) => {
  const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const user = await createSmokeUser(`m6r-${runId}`);
  const slug = `m6r-${runId}`;

  try {
    await loginAndOnboard(page, user.email, user.password, slug);

    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();

    // Either empty state or charts section should be visible
    const hasEmptyState = await page
      .getByText(/no data yet|no pipeline data|reports will appear/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasSection = await page
      .getByText(/leads by stage|leads by source|stage conversion|pipeline|acquisition/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasEmptyState || hasSection).toBe(true);

    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "m6-reports.png"), fullPage: true });
  } finally {
    await deleteVenuesForUser(user.userId).catch(() => {});
    await deleteSmokeUser(user.userId).catch(() => {});
  }
});
