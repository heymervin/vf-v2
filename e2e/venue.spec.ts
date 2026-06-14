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

const SCREENSHOTS_DIR = path.join(__dirname, "../logs/data/screenshots");
const screenshotPath = (name: string) =>
  path.join(SCREENSHOTS_DIR, `${name}.png`);

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

test("venue settings: rename + save profile → DB updated; toggle hours + save → DB updated", async ({
  page,
}) => {
  page.setDefaultTimeout(12_000);
  const random = Date.now().toString(36);
  const slug = `venue-${random}`;
  let userId = "";

  // Ensure the screenshots dir exists before the test writes into it.
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    const venueId = await createCompletedVenue(userId, slug);

    // -----------------------------------------------------------------------
    // Sign in
    // -----------------------------------------------------------------------
    await signIn(page, user);

    // -----------------------------------------------------------------------
    // Navigate to venue settings
    // -----------------------------------------------------------------------
    await page.goto("/settings/venue");
    await expect(
      page.getByRole("heading", { name: "Venue profile & hours" }),
    ).toBeVisible();

    await page.screenshot({ path: screenshotPath("venue-settings-initial") });

    // -----------------------------------------------------------------------
    // Update venue name (profile section)
    // -----------------------------------------------------------------------
    const nameInput = page.getByLabel("Venue name");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Updated Grand Hall");

    // Slug should auto-derive from name (not manually edited yet).
    const slugInput = page.getByLabel("Web address");
    await expect(slugInput).toHaveValue("updated-grand-hall");

    // Confirm the slug preview helper text reflects the new slug.
    await expect(
      page.getByText(/venueflow\.io\/f\/updated-grand-hall/),
    ).toBeVisible();

    await page.screenshot({ path: screenshotPath("venue-settings-name-changed") });

    // -----------------------------------------------------------------------
    // Save profile
    // -----------------------------------------------------------------------
    await page.getByRole("button", { name: "Save profile" }).click();

    // Toast confirmation appears.
    await expect(page.getByText("Venue profile saved")).toBeVisible({
      timeout: 10_000,
    });

    await page.screenshot({ path: screenshotPath("venue-settings-profile-saved") });

    // -----------------------------------------------------------------------
    // Assert DB change via service-role client
    // -----------------------------------------------------------------------
    const db = admin();
    const { data: venue } = await db
      .from("venues")
      .select("name, slug")
      .eq("id", venueId)
      .single();

    expect(venue?.name).toBe("Updated Grand Hall");
    expect(venue?.slug).toBe("updated-grand-hall");

    // -----------------------------------------------------------------------
    // Opening hours: toggle Sunday open and set custom times
    // -----------------------------------------------------------------------
    // Sunday switch has aria-label "Sun open"
    const sunSwitch = page.getByRole("switch", { name: "Sun open" });
    const isSunOpen = await sunSwitch.getAttribute("data-state");

    // We want Sunday toggled ON — if it's already on, toggle it off first then
    // back on so we always end up with a known open state and custom times.
    if (isSunOpen === "checked") {
      await sunSwitch.click();
      // wait for Closed label to appear confirming toggle happened
      await expect(
        page.locator('[id="switch-0"]').locator("..").getByText("Closed"),
      ).toBeVisible();
    }

    // Toggle Sunday open.
    await sunSwitch.click();

    // The time inputs for weekday=0 should now appear.
    const openTimeInput = page.locator("#open-0");
    const closeTimeInput = page.locator("#close-0");
    await expect(openTimeInput).toBeVisible();
    await expect(closeTimeInput).toBeVisible();

    // Set custom hours for Sunday.
    await openTimeInput.fill("10:00");
    await closeTimeInput.fill("16:00");

    await page.screenshot({ path: screenshotPath("venue-settings-hours-sunday") });

    // Save hours.
    await page.getByRole("button", { name: "Save hours" }).click();
    await expect(page.getByText("Opening hours saved")).toBeVisible({
      timeout: 10_000,
    });

    await page.screenshot({ path: screenshotPath("venue-settings-hours-saved") });

    // -----------------------------------------------------------------------
    // Assert hours persisted in DB (weekday 0 = Sunday)
    // -----------------------------------------------------------------------
    const { data: hoursRow } = await db
      .from("venue_hours")
      .select("open_time, close_time")
      .eq("venue_id", venueId)
      .eq("weekday", 0)
      .single();

    // PostgREST returns "HH:MM:SS" format — normalise for comparison.
    expect(hoursRow?.open_time?.slice(0, 5)).toBe("10:00");
    expect(hoursRow?.close_time?.slice(0, 5)).toBe("16:00");
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});
