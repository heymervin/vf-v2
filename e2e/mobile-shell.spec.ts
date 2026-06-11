import { test } from "@playwright/test";
import { createSmokeUser, deleteSmokeUser, deleteVenuesForUser } from "./setup-users";
import * as path from "path";
import * as fs from "fs";

// Load .env.local
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

const SCREENSHOTS_DIR = path.join(__dirname, "../logs/data/screenshots");

test("mobile shell screenshots (390x844)", async ({ browser }) => {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env vars. Check .env.local.");
  }

  const suffix = `mob${Date.now().toString(36)}`;
  let userId = "";

  try {
    const user = await createSmokeUser(suffix);
    userId = user.userId;

    // iPhone 14 viewport
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const page = await ctx.newPage();

    // Log in
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/onboarding", { timeout: 15_000 });

    // Complete onboarding to reach dashboard
    await page.getByLabel("Venue name").fill(`Mobile Shell ${suffix}`);
    await page.getByLabel("Web address").fill(`mobile-${suffix}`);
    await page.getByRole("button", { name: "Create my venue" }).click();
    await page.getByRole("button", { name: /Skip for now/ }).click();
    await page.getByRole("button", { name: "Finish setup" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Screenshot: nav closed
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "m1-shell-mobile.png") });

    // Open bottom-sheet nav
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.waitForTimeout(450); // let sheet animate up

    // Screenshot: nav open
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "m1-shell-mobile-nav.png") });

    await ctx.close();
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId).catch(() => {});
      await deleteSmokeUser(userId).catch(() => {});
    }
  }
});
