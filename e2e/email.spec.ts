import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  createSmokeUser,
  deleteSmokeUser,
  deleteVenuesForUser,
  createCompletedVenue, signIn } from "./setup-users";
import * as path from "path";
import * as fs from "fs";

// Load .env.local so SUPABASE_SERVICE_ROLE_KEY is available at test runtime.
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

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

const SCREENSHOTS_DIR = path.join(__dirname, "../logs/data/screenshots");
const screenshotPath = (name: string) =>
  path.join(SCREENSHOTS_DIR, `${name}.png`);

test("settings/email: save display name + reply-to → persisted in DB", async ({
  page,
}) => {
  page.setDefaultTimeout(12_000);
  const random = Date.now().toString(36);
  const slug = `email-${random}`;
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    const venueId = await createCompletedVenue(userId, slug);

    // Sign in → lands on dashboard
    await signIn(page, user);

    // Navigate to email settings page
    await page.goto("/settings/email");
    await expect(
      page.getByRole("heading", { name: "Email identity" }),
    ).toBeVisible();

    // Page should show the form with pre-filled defaults
    await expect(page.getByLabel("Display name")).toBeVisible();
    await expect(page.getByLabel("Reply-to address")).toBeVisible();

    await page.screenshot({ path: screenshotPath("email-settings-initial") });

    // Fill in a custom display name and reply-to
    const displayName = `Rosewood Venue ${random}`;
    const replyTo = `events+${random}@rosewoodvenue.com`;

    await page.getByLabel("Display name").fill(displayName);
    await page.getByLabel("Reply-to address").fill(replyTo);

    await page.getByRole("button", { name: "Save changes" }).click();

    // Toast confirms success
    await expect(page.getByText("Email settings saved.")).toBeVisible({
      timeout: 10_000,
    });

    await page.screenshot({ path: screenshotPath("email-settings-saved") });

    // Assert the DB row was upserted correctly via the service-role client
    const db = admin();
    const { data: row, error } = await db
      .from("venue_email_settings")
      .select("from_name, reply_to")
      .eq("venue_id", venueId)
      .single();

    expect(error).toBeNull();
    expect(row).not.toBeNull();
    expect(row!.from_name).toBe(displayName);
    expect(row!.reply_to).toBe(replyTo);

    // Reload the page — form should reflect the saved values
    await page.reload();
    await expect(page.getByLabel("Display name")).toHaveValue(displayName);
    await expect(page.getByLabel("Reply-to address")).toHaveValue(replyTo);

    await page.screenshot({ path: screenshotPath("email-settings-reload") });
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

test("settings/email: validation — blank display name and invalid email are rejected", async ({
  page,
}) => {
  page.setDefaultTimeout(12_000);
  const random = `v${Date.now().toString(36)}`;
  const slug = `email-val-${random}`;
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    await createCompletedVenue(userId, slug);

    await signIn(page, user);

    await page.goto("/settings/email");
    await expect(
      page.getByRole("heading", { name: "Email identity" }),
    ).toBeVisible();

    // Clear the display name and enter an invalid reply-to
    await page.getByLabel("Display name").fill("");
    await page.getByLabel("Reply-to address").fill("not-an-email");
    await page.getByRole("button", { name: "Save changes" }).click();

    // Both fields should show inline validation errors (client-side via zod/RHF)
    await expect(
      page.getByText("Display name is required."),
    ).toBeVisible({ timeout: 6_000 });
    await expect(
      page.getByText("Please enter a valid email address."),
    ).toBeVisible();

    await page.screenshot({ path: screenshotPath("email-settings-validation") });
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});
