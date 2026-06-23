/**
 * Slice 7 — Copilot (Intelligence) smoke test.
 *
 * An authenticated, fully-onboarded user visits /copilot and sees either the
 * ranked insights list or the "all clear" empty state, plus the page heading.
 * A fresh venue has no tasks/payments/guests, so the empty state is expected —
 * the test accepts EITHER so it stays green once real data is seeded.
 *
 * Requires the dev server running. Run:
 *   pnpm exec playwright test e2e/intelligence.spec.ts
 */

import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import {
  createSmokeUser,
  deleteSmokeUser,
  deleteVenuesForUser,
} from "./setup-users";

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

async function loginAndOnboard(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  slug: string,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("**/onboarding", { timeout: 15_000 });

  // Step 1: venue name + slug
  await page.getByLabel("Venue name").fill(`Intel Test ${slug}`);
  await page.getByLabel("Web address").fill(slug);
  await page.getByRole("button", { name: "Create my venue" }).click();

  // Step 2: skip spaces
  await expect(page.getByText("Tell us about your spaces.").first()).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: /Skip for now/ }).click();

  // Step 3: finish hours
  await expect(page.getByText("Set your opening hours.").first()).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Finish setup" }).click();

  await page.waitForURL(/\/(dashboard|contacts|pipeline)/, { timeout: 20_000 });
}

test("copilot page renders insights list or empty state", async ({ page }) => {
  const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const user = await createSmokeUser(`intel-${runId}`);
  const slug = `intel-${runId}`;

  try {
    await loginAndOnboard(page, user.email, user.password, slug);

    await page.goto("/copilot");
    await page.waitForLoadState("networkidle");

    // Page heading is always present.
    await expect(
      page.getByRole("heading", { name: "Copilot", exact: true }),
    ).toBeVisible();

    // Either the ranked insights list OR the empty state must render.
    const hasInsights = await page
      .getByTestId("copilot-insights")
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasEmpty = await page
      .getByTestId("copilot-empty")
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasInsights || hasEmpty).toBe(true);

    // The Ask Copilot trigger should be available regardless of data state.
    await expect(
      page.getByRole("button", { name: /Ask Copilot/i }),
    ).toBeVisible();
  } finally {
    await deleteVenuesForUser(user.userId).catch(() => {});
    await deleteSmokeUser(user.userId).catch(() => {});
  }
});
