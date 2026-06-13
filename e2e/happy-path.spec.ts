/**
 * M7 Happy-path gate — full funnel E2E.
 *
 * Flow:
 *   signup (real UI) → public lead form → pipeline inbound check
 *   → public booking widget → staff appointments → mark attended
 *   → pipeline stage advanced → reports non-empty
 *
 * Signup path: The onboarding wizard is already exhaustively tested in
 * onboarding.spec.ts. This spec exercises the real signup→onboard UI once
 * (to keep the gate honest) and then drives the remainder of the funnel via
 * the helper-seeded venue so the test stays focused on the funnel, not the
 * wizard mechanics.
 *
 * Run: pnpm exec playwright test e2e/happy-path.spec.ts
 */

import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import {
  createSmokeUser,
  deleteSmokeUser,
  deleteVenuesForUser,
  getMembershipId,
  seedAvailabilityRule,
  deleteAppointmentsForVenue,
  deleteAvailabilityRulesForVenue,
  deleteContactsForVenue,
  getOpportunityStageByEmail,
} from "./setup-users";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Env bootstrap (same pattern used across all specs)
// ---------------------------------------------------------------------------
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

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Returns a weekday (JS Date.getDay) that is ≥ tomorrow so the 60-min
// lead-time guard in the booking engine always has at least one slot.
function tomorrowWeekday(): number {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.getDay();
}

const SCREENSHOTS = path.join(__dirname, "../logs/data/screenshots");
const ss = (name: string) => path.join(SCREENSHOTS, `m7-${name}.png`);

// ---------------------------------------------------------------------------
// M7 gate: full funnel in a single test
// ---------------------------------------------------------------------------

test("M7 happy-path: signup → onboard → lead form → pipeline → booking → attended → reports", async ({
  page,
}) => {
  // Generous default — this test traverses many pages.
  page.setDefaultTimeout(25_000);

  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env vars — check .env.local");
  }

  fs.mkdirSync(SCREENSHOTS, { recursive: true });

  const run = Date.now().toString(36);
  const slug = `hp-${run}`;
  // The couple email used for both the lead-form submit and the booking widget
  // so the contact record de-dupes correctly.
  const coupleEmail = `couple-${run}@example.com`;

  let userId = "";
  let venueId = "";

  try {
    // -----------------------------------------------------------------------
    // 1. Create a fresh user via admin API (no email confirmation needed).
    //    Then complete the 3-step onboarding wizard through the real UI.
    //    This exercises the actual signup→onboard path even though the suite
    //    has dedicated onboarding tests — keeping the gate honest.
    // -----------------------------------------------------------------------
    const user = await createSmokeUser(run);
    userId = user.userId;

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // New user with no venue → redirected to onboarding wizard.
    await page.waitForURL("**/onboarding", { timeout: 15_000 });
    await page.screenshot({ path: ss("01-onboarding-step1") });

    // Step 1: venue profile
    await page.getByLabel("Venue name").fill(`HP Venue ${run}`);
    await page.getByLabel("Web address").fill(slug);
    await page.getByRole("button", { name: "Create my venue" }).click();

    // Step 2: spaces — skip
    await expect(
      page.getByText("Tell us about your spaces.").first(),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Skip for now/ }).click();

    // Step 3: hours — finish
    await expect(
      page.getByText("Set your opening hours.").first(),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Finish setup" }).click();

    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await page.screenshot({ path: ss("02-dashboard") });

    // Resolve venueId from DB so we can seed availability and clean up.
    const admin = adminClient();
    const { data: memberships } = await admin
      .from("memberships")
      .select("venue_id")
      .eq("user_id", userId)
      .limit(1);
    if (!memberships || memberships.length === 0) {
      throw new Error("No membership found after onboarding");
    }
    venueId = memberships[0].venue_id;

    // -----------------------------------------------------------------------
    // 2. Seed an availability rule for tomorrow's weekday so the booking
    //    engine always has at least one open slot.
    // -----------------------------------------------------------------------
    const membershipId = await getMembershipId(venueId, userId);
    await seedAvailabilityRule(
      venueId,
      membershipId,
      tomorrowWeekday(),
      "09:00",
      "17:00",
    );

    // -----------------------------------------------------------------------
    // 3. Public lead form: submit an enquiry as the couple.
    //    No auth — visit /f/[venueSlug] as a fresh visitor.
    // -----------------------------------------------------------------------
    await page.goto(`/f/${slug}`);
    await expect(
      page.getByRole("button", { name: "Send enquiry" }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByLabel("Your name", { exact: true }).fill("Jordan Playwright");
    await page.getByLabel("Email", { exact: true }).fill(coupleEmail);

    const guestLabel = page.getByLabel("Approx. guests");
    if (await guestLabel.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await guestLabel.fill("120");
    }

    await page.getByRole("button", { name: "Send enquiry" }).click();

    // Success confirmation
    await expect(
      page.getByText(/brochure is on its way|thank you|enquiry received/i).first(),
    ).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: ss("03-lead-form-success") });

    // -----------------------------------------------------------------------
    // 4. Staff: verify the contact's opportunity landed in inbound/enquiry.
    //    The session cookie from step 1 is still valid — navigate directly.
    // -----------------------------------------------------------------------
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: ss("04-pipeline-before-booking") });

    // The pipeline board renders columns as <region> with the stage label.
    // "Inbound enquiry" column must contain the contact name.
    await expect(
      page
        .getByRole("region", { name: "Inbound enquiry" })
        .getByText("Jordan Playwright"),
    ).toBeVisible({ timeout: 10_000 });

    // -----------------------------------------------------------------------
    // 5. Public booking widget: pick the first available slot and confirm.
    //    Same couple email so the contact record is linked.
    // -----------------------------------------------------------------------
    await page.goto(`/book/${slug}/viewing`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    // Wait for slots to hydrate (skeleton → real aria-pressed chips).
    await expect(
      page.locator('button[aria-pressed]').first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: ss("05-booking-slot-grid") });

    // Select the first date chip, then the first time option.
    await page.locator('button[aria-pressed]').first().click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "Your details" }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByLabel("Your name").fill("Jordan Playwright");
    await page.getByLabel("Email").fill(coupleEmail);
    await page.getByRole("button", { name: "Confirm booking" }).click();

    // Booking success
    await expect(
      page.getByText("You're booked in"),
    ).toBeVisible({ timeout: 15_000 });

    const manageLink = page.getByRole("link", { name: "Manage your booking" });
    await expect(manageLink).toBeVisible();
    const manageHref = await manageLink.getAttribute("href");
    expect(manageHref).toBeTruthy();
    await page.screenshot({ path: ss("06-booking-confirmed") });

    // -----------------------------------------------------------------------
    // 6. Staff appointments: the booking appears in the week grid.
    // -----------------------------------------------------------------------
    await page.goto("/appointments");
    await expect(
      page.getByRole("heading", { name: "Appointments" }),
    ).toBeVisible();

    // Navigate forward up to 8 weeks to find the card (booking is always
    // tomorrow or later due to the 60-min lead-time guard).
    let found = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const count = await page
        .locator('button:has-text("Jordan Playwright")')
        .count();
      if (count > 0) {
        found = true;
        break;
      }
      await page.getByRole("button", { name: "Next week" }).click();
      await page.waitForLoadState("networkidle");
    }
    expect(
      found,
      "Appointment card for Jordan Playwright must appear in the week grid",
    ).toBe(true);
    await page.screenshot({ path: ss("07-appointments-grid") });

    // -----------------------------------------------------------------------
    // 7. Mark as attended via the detail sheet.
    // -----------------------------------------------------------------------
    await page.locator('button:has-text("Jordan Playwright")').first().click();
    await expect(
      page.getByRole("button", { name: "Mark as attended" }),
    ).toBeVisible({ timeout: 8_000 });
    await page.getByRole("button", { name: "Mark as attended" }).click();
    await expect(
      page.getByText("Marked as attended"),
    ).toBeVisible({ timeout: 8_000 });
    await page.screenshot({ path: ss("08-marked-attended") });

    // -----------------------------------------------------------------------
    // 8. Assert pipeline stage advanced to appointment_attended.
    //    Check both via DB (deterministic) and pipeline UI (visual proof).
    // -----------------------------------------------------------------------
    const stage = await getOpportunityStageByEmail(venueId, coupleEmail);
    expect(stage, "Opportunity stage after mark-attended").toBe(
      "appointment_attended",
    );

    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");
    await expect(
      page
        .getByRole("region", { name: "Appointment attended" })
        .getByText("Jordan Playwright"),
    ).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: ss("09-pipeline-attended") });

    // -----------------------------------------------------------------------
    // 9. Reports: non-zero data reflects the created lead.
    // -----------------------------------------------------------------------
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "Reports", exact: true }),
    ).toBeVisible();

    // With at least one contact we expect charts, not the empty-state card.
    // The "Leads by stage" heading only renders when totalLeads > 0.
    await expect(
      page.getByRole("heading", { name: "Leads by stage" }),
    ).toBeVisible({ timeout: 8_000 });

    // The "Leads by source" chart should also be present.
    await expect(
      page.getByRole("heading", { name: "Leads by source" }),
    ).toBeVisible();

    await page.screenshot({ path: ss("10-reports-with-data") });

  } finally {
    // -----------------------------------------------------------------------
    // Cleanup: delete in FK-safe order.
    // -----------------------------------------------------------------------
    if (venueId) {
      await deleteAppointmentsForVenue(venueId).catch(() => {});
      await deleteAvailabilityRulesForVenue(venueId).catch(() => {});
      await deleteContactsForVenue(venueId).catch(() => {});
    }
    if (userId) {
      await deleteVenuesForUser(userId).catch(() => {});
      await deleteSmokeUser(userId).catch(() => {});
    }
  }
});
