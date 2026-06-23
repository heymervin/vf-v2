/**
 * Slice 7 — Intelligence E2E tests
 *
 * Three scenarios:
 *   1. /reports — renders existing charts + conversion table + "Pipeline (live)"
 *      section; asserts the GHL empty state appears when no ghl_credentials row.
 *   2. /copilot — priority-ranked insight cards from REAL seeded data:
 *      - at_risk: wedding_date ~30 days out, portal_last_seen_at NULL, status='planning'
 *      - action:  payment_milestone status='due', due_date in the past
 *      Cards appear in priority order (at_risk before action).
 *      Dismiss is ephemeral — card vanishes on click, reappears on reload.
 *   3. Daily brief Inngest: driven via vitest unit tests (not browser).
 *      This spec file does NOT test the cron function — that's covered by
 *      src/inngest/functions/daily-brief.test.ts (13 passing tests).
 *
 * Auth pattern: createSmokeUser + createCompletedVenue (already-onboarded venue)
 * so we never go through the wizard.
 *
 * Run: pnpm exec playwright test e2e/slice7-intelligence.spec.ts
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as fs from "fs";
import {
  createSmokeUser,
  deleteSmokeUser,
  deleteVenuesForUser,
  createCompletedVenue,
} from "./setup-users";

// ---------------------------------------------------------------------------
// .env.local loader
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

const SS_DIR = path.join(__dirname, "../logs/data/screenshots");

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function deleteSlice7DataForVenue(venueId: string) {
  const admin = adminClient();
  // Order: dependents before parents
  await admin.from("timeline_events").delete().eq("venue_id", venueId);
  await admin.from("payment_milestones").delete().eq("venue_id", venueId);
  await admin.from("couple_accounts").delete().eq("venue_id", venueId);
  await admin.from("weddings").delete().eq("venue_id", venueId);
}

/**
 * Seed a wedding directly (bypasses the create-wedding UI).
 * Returns the weddingId.
 */
async function seedWedding(
  venueId: string,
  coupleNames: string,
  weddingDate: string,
  portalLastSeenAt: string | null = null,
): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("weddings")
    .insert({
      venue_id: venueId,
      couple_names: coupleNames,
      wedding_date: weddingDate,
      status: "planning",
      portal_last_seen_at: portalLastSeenAt,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`seedWedding: ${error?.message}`);
  return data.id as string;
}

/**
 * Seed an overdue payment milestone (status='due', due_date yesterday).
 */
async function seedOverdueMilestone(
  venueId: string,
  weddingId: string,
  label: string,
  amountMinor: number,
): Promise<void> {
  const admin = adminClient();
  // due_date = yesterday (ISO date string)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dueDateStr = yesterday.toISOString().split("T")[0];

  const { error } = await admin.from("payment_milestones").insert({
    venue_id: venueId,
    wedding_id: weddingId,
    label,
    amount_minor: amountMinor,
    due_date: dueDateStr,
    status: "due",
  });
  if (error) throw new Error(`seedOverdueMilestone: ${error.message}`);
}

/**
 * Seed a couple_account with invited_at > 7 days ago and last_login_at NULL
 * (triggers Rule 3 quiet-lead insight).
 */
async function seedQuietCoupleAccount(
  venueId: string,
  weddingId: string,
  email: string,
): Promise<void> {
  const admin = adminClient();
  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const { error } = await admin.from("couple_accounts").insert({
    venue_id: venueId,
    wedding_id: weddingId,
    email,
    invited_at: tenDaysAgo,
    last_login_at: null,
    status: "invited",
  });
  if (error) throw new Error(`seedQuietCoupleAccount: ${error.message}`);
}

/**
 * Common login helper — navigates to /login, fills credentials, waits for /dashboard.
 */
async function loginUser(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

// ---------------------------------------------------------------------------
// Scenario 1 — /reports: GHL connect prompt + existing chart sections
// ---------------------------------------------------------------------------

test("reports: renders Pipeline (live) section and shows GHL empty state when no credentials", async ({
  page,
}) => {
  page.setDefaultTimeout(30_000);
  fs.mkdirSync(SS_DIR, { recursive: true });

  const random = Date.now().toString(36);
  const slug = `s7-rpt-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    await loginUser(page, user.email, user.password);

    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    // ── 1. Page heading ────────────────────────────────────────────────────
    await expect(
      page.getByRole("heading", { name: "Reports", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: path.join(SS_DIR, `s7-reports-${random}.png`), fullPage: true });

    // ── 2. KPI cards strip is present ─────────────────────────────────────
    // The KpiCards section renders regardless of data volume.
    // Look for the metric labels defined in reports-charts.tsx.
    // We look for at least one KPI label to confirm the strip rendered.
    const kpiLabelPatterns = [
      /conversion rate|booked revenue|on-time payments|portal adoption|avg booking/i,
    ];
    let kpiFound = false;
    for (const pattern of kpiLabelPatterns) {
      const visible = await page
        .getByText(pattern)
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (visible) { kpiFound = true; break; }
    }
    expect(kpiFound, "At least one KPI label must be visible in the KPI strip").toBe(true);

    // ── 3. Pipeline (live) section heading is always rendered ─────────────
    // This section exists regardless of whether GHL is connected.
    await expect(
      page.getByText("Pipeline (live)", { exact: false }),
    ).toBeVisible({ timeout: 8_000 });

    // The section heading "GHL opportunities" is inside the card.
    await expect(
      page.getByRole("heading", { name: "GHL opportunities" }),
    ).toBeVisible({ timeout: 5_000 });

    // ── 4. GHL empty state — no credentials seeded → Connect GoHighLevel prompt ──
    // The text from page.tsx when ghlPipeline is null:
    //   "Connect GoHighLevel to see live pipeline data."
    // and the link text: "Connect GHL"
    await expect(
      page.getByText("Connect GoHighLevel to see live pipeline data.", { exact: false }),
    ).toBeVisible({ timeout: 8_000 });

    await expect(
      page.getByRole("link", { name: "Connect GHL" }),
    ).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: path.join(SS_DIR, `s7-reports-ghl-empty-${random}.png`), fullPage: true });

    // ── 5. Empty-state — this is a fresh venue with no leads, so the
    //       "no pipeline data" empty state card should be visible.
    await expect(
      page.getByText("Lead funnel will appear once you have leads", { exact: false }).or(
        page.getByRole("heading", { name: "Leads by stage" }),
      ),
    ).toBeVisible({ timeout: 8_000 });

    // ── 6. Payment health section always renders ───────────────────────────
    await expect(
      page.getByRole("heading", { name: "Payment health" }),
    ).toBeVisible({ timeout: 5_000 });

  } finally {
    await deleteSlice7DataForVenue(venueId).catch(() => {});
    if (userId) {
      await deleteVenuesForUser(userId).catch(() => {});
      await deleteSmokeUser(userId).catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// Scenario 1b — /reports: chart sections render when leads data exists
// ---------------------------------------------------------------------------

test("reports: chart sections (leads by stage, leads by source, stage conversion) render with data", async ({
  page,
}) => {
  page.setDefaultTimeout(30_000);
  fs.mkdirSync(SS_DIR, { recursive: true });

  const random = Date.now().toString(36);
  const slug = `s7-rpt2-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    // Seed a contact + opportunity so the report_leads_by_stage view has data.
    const admin = adminClient();
    const { data: contact, error: cErr } = await admin
      .from("contacts")
      .insert({
        venue_id: venueId,
        first_name: "Slice7",
        last_name: "Tester",
        email: `slice7-rpt-${random}@smoke.test`,
        wedding_date: "2027-09-15",
        source: "Website",
      })
      .select("id")
      .single();
    if (cErr || !contact) throw new Error(`seed contact: ${cErr?.message}`);

    await admin.from("opportunities").insert({
      venue_id: venueId,
      contact_id: contact.id,
      stage: "inbound_enquiry",
      sort_index: 0,
    });

    await loginUser(page, user.email, user.password);

    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "Reports", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    // With at least one lead, the funnel charts must render (not the empty-state card).
    await expect(
      page.getByRole("heading", { name: "Leads by stage" }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole("heading", { name: "Leads by source" }),
    ).toBeVisible({ timeout: 5_000 });

    // Stage conversion table is present
    await expect(
      page.getByRole("heading", { name: "Stage conversion" }),
    ).toBeVisible({ timeout: 5_000 });

    // Pipeline (live) section is always there even with leads
    await expect(
      page.getByRole("heading", { name: "GHL opportunities" }),
    ).toBeVisible({ timeout: 5_000 });

    await page.screenshot({
      path: path.join(SS_DIR, `s7-reports-with-data-${random}.png`),
      fullPage: true,
    });

    // Cleanup contact/opportunity before venue cleanup
    await admin.from("opportunities").delete().eq("venue_id", venueId);
    await admin.from("contacts").delete().eq("venue_id", venueId);
  } finally {
    await deleteSlice7DataForVenue(venueId).catch(() => {});
    if (userId) {
      await deleteVenuesForUser(userId).catch(() => {});
      await deleteSmokeUser(userId).catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// Scenario 2 — /copilot: at-risk and overdue insights from seeded data
// ---------------------------------------------------------------------------

test("copilot: renders at-risk and overdue payment insight cards from seeded data in priority order", async ({
  page,
}) => {
  page.setDefaultTimeout(30_000);
  fs.mkdirSync(SS_DIR, { recursive: true });

  const random = Date.now().toString(36);
  const slug = `s7-cop-${random}`;
  let userId = "";
  let venueId = "";

  // Couple names that will appear in insight titles
  const atRiskCouple = `AtRisk Couple ${random}`;
  const overdueCouple = `Overdue Couple ${random}`;

  // The milestone label used for the overdue payment insight
  const milestoneLabel = `Final Balance ${random}`;
  const milestoneAmountMinor = 250000; // £2,500

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    // ── Seed at-risk wedding ───────────────────────────────────────────────
    // wedding_date = now + 30 days (within 60-day window)
    // portal_last_seen_at = NULL (inactive portal)
    // status = 'planning' → triggers Rule 1 at_risk insight
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const atRiskWeddingDate = in30Days.toISOString().split("T")[0];
    const atRiskWeddingId = await seedWedding(
      venueId,
      atRiskCouple,
      atRiskWeddingDate,
      null, // portal_last_seen_at = NULL
    );

    // ── Seed overdue payment milestone wedding ─────────────────────────────
    // A separate wedding to own the milestone (avoids conflating the two insights).
    const overdueWeddingDate = new Date();
    overdueWeddingDate.setFullYear(overdueWeddingDate.getFullYear() + 1);
    const overdueWeddingId = await seedWedding(
      venueId,
      overdueCouple,
      overdueWeddingDate.toISOString().split("T")[0],
      new Date().toISOString(), // portal_last_seen_at = now (active → not at-risk)
    );

    // status='due', due_date=yesterday → triggers Rule 2 action insight
    await seedOverdueMilestone(venueId, overdueWeddingId, milestoneLabel, milestoneAmountMinor);

    await loginUser(page, user.email, user.password);

    await page.goto("/copilot");
    await page.waitForLoadState("networkidle");

    // ── Assert: Copilot page heading ──────────────────────────────────────
    await expect(
      page.getByRole("heading", { name: "Copilot" }),
    ).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: path.join(SS_DIR, `s7-copilot-loaded-${random}.png`),
      fullPage: true,
    });

    // ── Assert: at_risk insight appears with correct title ────────────────
    // insight.title = "{couple_names} — couple portal inactive"
    const atRiskTitle = `${atRiskCouple} — couple portal inactive`;
    await expect(
      page.getByText(atRiskTitle, { exact: false }),
    ).toBeVisible({ timeout: 10_000 });

    // The "At risk" badge should be visible in the card
    await expect(
      page.getByText("At risk", { exact: true }).first(),
    ).toBeVisible({ timeout: 5_000 });

    // ── Assert: action insight appears with overdue milestone ─────────────
    // insight.title = "{couple_names} — overdue payment: {label}"
    const actionTitle = `${overdueCouple} — overdue payment: ${milestoneLabel}`;
    await expect(
      page.getByText(actionTitle, { exact: false }),
    ).toBeVisible({ timeout: 10_000 });

    // The "Action" badge should be visible
    await expect(
      page.getByText("Action", { exact: true }).first(),
    ).toBeVisible({ timeout: 5_000 });

    // ── Assert: priority order — at_risk (priority 1) before action (priority 2) ──
    // The at_risk card must appear before the action card in DOM order.
    const atRiskCard = page.locator(`text=${atRiskCouple} — couple portal inactive`).first();
    const actionCard = page.locator(`text=${overdueCouple} — overdue payment`).first();

    const atRiskBox = await atRiskCard.boundingBox();
    const actionBox = await actionCard.boundingBox();

    expect(
      atRiskBox && actionBox && atRiskBox.y < actionBox.y,
      "at_risk card (priority 1) must appear above action card (priority 2) in the list",
    ).toBe(true);

    // ── Assert: signal text for action card contains the correct £ amount ─
    // signal = "£2,500 was due {date}. Mark paid or chase the couple."
    await expect(
      page.getByText("£2,500", { exact: false }),
    ).toBeVisible({ timeout: 5_000 });

    // ── Assert: pulse bar reflects needing attention ──────────────────────
    // PulseBar shows "N need(s) your attention" when at_risk or action present.
    // With 2 insights: "2 need your attention" (plural — no trailing 's').
    // With 1 insight:  "1 needs your attention".
    // Match both forms:
    await expect(
      page.getByText(/\d+ needs? your attention/i),
    ).toBeVisible({ timeout: 5_000 });

    await page.screenshot({
      path: path.join(SS_DIR, `s7-copilot-insights-${random}.png`),
      fullPage: true,
    });

    // ── Assert: dismiss is ephemeral ──────────────────────────────────────
    // Count insights before dismiss
    const insightsBefore = await page
      .locator('[aria-label="Dismiss this insight"]')
      .count();
    expect(insightsBefore, "There should be at least 1 dismiss button before dismissing").toBeGreaterThanOrEqual(1);

    // Hover the at_risk card to reveal dismiss button (opacity-0 until hover)
    // then click dismiss
    await atRiskCard.hover();
    const dismissBtn = page
      .locator('[aria-label="Dismiss this insight"]')
      .first();
    await expect(dismissBtn).toBeVisible({ timeout: 5_000 });
    await dismissBtn.click();

    // Card should disappear immediately (optimistic client state)
    await expect(
      page.getByText(atRiskTitle, { exact: false }),
    ).not.toBeVisible({ timeout: 5_000 });

    await page.screenshot({
      path: path.join(SS_DIR, `s7-copilot-after-dismiss-${random}.png`),
      fullPage: true,
    });

    // ── Assert: after hard reload, card reappears (no DB write) ───────────
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText(atRiskTitle, { exact: false }),
    ).toBeVisible({ timeout: 15_000 });

    await page.screenshot({
      path: path.join(SS_DIR, `s7-copilot-after-reload-${random}.png`),
      fullPage: true,
    });

    // ── Assert: at_risk wedding id is in action href ──────────────────────
    // "Review wedding" button should link to /weddings/{atRiskWeddingId}
    const reviewLink = page
      .getByText(atRiskTitle, { exact: false })
      .locator("xpath=ancestor::div[contains(@class,'rounded-xl')]")
      .getByRole("link", { name: "Review wedding" });
    const href = await reviewLink.getAttribute("href");
    expect(href).toContain(`/weddings/${atRiskWeddingId}`);

  } finally {
    await deleteSlice7DataForVenue(venueId).catch(() => {});
    if (userId) {
      await deleteVenuesForUser(userId).catch(() => {});
      await deleteSmokeUser(userId).catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// Scenario 2b — /copilot: empty state ("All clear") renders for a fresh venue
// ---------------------------------------------------------------------------

test("copilot: empty state renders 'All clear' when venue has no insight-triggering data", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  fs.mkdirSync(SS_DIR, { recursive: true });

  const random = Date.now().toString(36);
  const slug = `s7-cop-empty-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    // No weddings, no milestones, no couple_accounts, no timeline_events seeded.

    await loginUser(page, user.email, user.password);

    await page.goto("/copilot");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "Copilot" }),
    ).toBeVisible({ timeout: 10_000 });

    // EmptyTriage renders "All clear"
    await expect(
      page.getByText("All clear"),
    ).toBeVisible({ timeout: 8_000 });

    await expect(
      page.getByText("No open insights.", { exact: false }),
    ).toBeVisible({ timeout: 5_000 });

    await page.screenshot({
      path: path.join(SS_DIR, `s7-copilot-empty-${random}.png`),
      fullPage: true,
    });
  } finally {
    await deleteSlice7DataForVenue(venueId).catch(() => {});
    if (userId) {
      await deleteVenuesForUser(userId).catch(() => {});
      await deleteSmokeUser(userId).catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// Scenario 2c — /copilot: unauthenticated access redirects to /login
// ---------------------------------------------------------------------------

test("copilot: unauthenticated access redirects to /login", async ({ page }) => {
  page.setDefaultTimeout(15_000);

  await page.goto("/copilot");
  await page.waitForURL("**/login", { timeout: 10_000 });
  await expect(page.getByLabel("Email")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Scenario 2d — /copilot nav: Copilot appears in sidebar navigation
// ---------------------------------------------------------------------------

test("copilot: nav link appears in sidebar after login", async ({ page }) => {
  page.setDefaultTimeout(20_000);
  fs.mkdirSync(SS_DIR, { recursive: true });

  const random = Date.now().toString(36);
  const slug = `s7-nav-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    await loginUser(page, user.email, user.password);

    // On desktop viewport (lg+), the sidebar is fully expanded.
    // The nav item "Copilot" should be visible.
    // Wait for hydration — sidebar uses aria-current for active links.
    await expect(
      page.getByRole("link", { name: "Copilot" }),
    ).toBeVisible({ timeout: 10_000 });

    // Click the link — should navigate to /copilot
    await page.getByRole("link", { name: "Copilot" }).click();
    await page.waitForURL("**/copilot", { timeout: 10_000 });

    await expect(
      page.getByRole("heading", { name: "Copilot" }),
    ).toBeVisible({ timeout: 8_000 });

    await page.screenshot({
      path: path.join(SS_DIR, `s7-nav-copilot-${random}.png`),
      fullPage: true,
    });
  } finally {
    await deleteSlice7DataForVenue(venueId).catch(() => {});
    if (userId) {
      await deleteVenuesForUser(userId).catch(() => {});
      await deleteSmokeUser(userId).catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// Scenario 3 — Daily Brief: vitest unit tests cover this fully.
// This file intentionally has no browser-driven daily-brief test because
// the Inngest cron cannot be triggered via Playwright without the Inngest
// dev server running. The 13 vitest cases in
// src/inngest/functions/daily-brief.test.ts cover:
//   - Happy path with GHL connected
//   - GHL null → email still sent with pipeline=null
//   - GHL throws → email still sent with pipeline=null
//   - No owner membership → skip gracefully
//   - Owner email unresolvable → skip gracefully
//   - Multiple venues → one brief per venue
//   - Zero venues → no emails
//   - Overdue payments included when present
//   - Upcoming events payload shape (title, starts_at_time, wedding_date)
// ---------------------------------------------------------------------------
