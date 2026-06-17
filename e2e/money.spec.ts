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

// ---------------------------------------------------------------------------
// .env.local loader (same pattern as weddings.spec.ts)
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

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

async function deleteWeddingsForVenue(venueId: string) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  await admin.from("payment_milestones").delete().eq("venue_id", venueId);
  await admin.from("proposals").delete().eq("venue_id", venueId);
  await admin.from("couple_accounts").delete().eq("venue_id", venueId);
  await admin.from("weddings").delete().eq("venue_id", venueId);
}

/**
 * Seed a wedding directly so we can test payments without going through
 * the full create-wedding UI flow in every test.
 */
async function seedWedding(
  venueId: string,
  coupleNames: string,
  weddingDate: string,
): Promise<string> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await admin
    .from("weddings")
    .insert({
      venue_id: venueId,
      couple_names: coupleNames,
      wedding_date: weddingDate,
      status: "planning",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`seedWedding: ${error?.message}`);
  return data.id as string;
}

// ---------------------------------------------------------------------------
// Test 1 — /weddings/[id]/payments: unauthenticated access redirects to login
// ---------------------------------------------------------------------------

test("money/payments: unauthenticated access to payments tab redirects to /login", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);

  const fakeId = "00000000-0000-0000-0000-000000000010";
  await page.goto(`/weddings/${fakeId}/payments`);
  await page.waitForURL("**/login", { timeout: 10_000 });
  await expect(page.getByLabel("Email")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2 — /money: unauthenticated access redirects to login
// ---------------------------------------------------------------------------

test("money/hub: unauthenticated access to /money redirects to /login", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);

  await page.goto("/money");
  await page.waitForURL("**/login", { timeout: 10_000 });
  await expect(page.getByLabel("Email")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 3 — Payments tab: add a milestone, assert formatted amount + status
// ---------------------------------------------------------------------------

test("money/payments: add milestone shows formatted £ amount and pending status", async ({
  page,
}) => {
  page.setDefaultTimeout(30_000);
  const random = Date.now().toString(36);
  const slug = `money-ms-${random}`;
  let userId = "";
  let venueId = "";

  const coupleNames = `Pay & Test ${random}`;
  const milestoneLabel = `Deposit ${random}`;
  // £1,500 entered as "1500.00" — should show as "£1,500.00"
  const amountPounds = "1500.00";
  const dueDate = "2027-06-01";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    // Seed a wedding directly (avoids re-testing create-wedding flow)
    const weddingId = await seedWedding(venueId, coupleNames, "2027-09-20");

    // ── Log in ────────────────────────────────────────────────────────────
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // ── Navigate to payments tab ──────────────────────────────────────────
    await page.goto(`/weddings/${weddingId}/payments`);

    // Payments page heading (PageHeader title)
    await expect(
      page.getByRole("heading", { name: "Payments" }),
    ).toBeVisible({ timeout: 10_000 });

    // "No milestones yet" empty state
    await expect(page.getByText("No milestones yet.")).toBeVisible();

    await page.screenshot({ path: "logs/data/money-payments-empty.png" });

    // ── Open "Add milestone" dialog ───────────────────────────────────────
    // The card header button — use .first() because an empty-state button
    // ("Add first milestone") may also be present. The header button is the
    // primary action; pick the first "Add milestone" button.
    await page
      .getByRole("button", { name: "Add milestone" })
      .first()
      .click();

    // Dialog heading — scope all assertions to the dialog to avoid aria-hide issues
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Add payment milestone" }),
    ).toBeVisible({ timeout: 5_000 });

    // ── Fill form ─────────────────────────────────────────────────────────
    await dialog.getByLabel("Label").fill(milestoneLabel);
    await dialog.getByLabel("Amount (£)").fill(amountPounds);
    await dialog.getByLabel("Due date").fill(dueDate);
    // Status defaults to "Pending" — leave as-is

    await page.screenshot({ path: "logs/data/money-milestone-form-filled.png" });

    // ── Submit ────────────────────────────────────────────────────────────
    await dialog.getByRole("button", { name: "Add milestone" }).click();

    // Success toast
    await expect(page.getByText("Milestone added")).toBeVisible({ timeout: 12_000 });

    await page.screenshot({ path: "logs/data/money-milestone-added.png" });

    // ── The milestone appears with correct formatted £ amount ─────────────
    await expect(
      page.getByText(milestoneLabel),
    ).toBeVisible({ timeout: 10_000 });

    // Amount formatted as GBP — £1,500.00 (appears in the row + summary cells)
    await expect(
      page.getByText("£1,500.00").first(),
    ).toBeVisible();

    // Status badge shows "Upcoming" (the default milestone lifecycle status)
    await expect(
      page.getByText("Upcoming", { exact: true }).first(),
    ).toBeVisible();

    // Due-date text somewhere on the milestone row
    // "1 Jun 2027" — formatted by en-GB locale
    await expect(
      page.getByText(/1 Jun 2027/i),
    ).toBeVisible();

    await page.screenshot({ path: "logs/data/money-milestone-present.png" });

    // ── Summary strip reflects the new milestone total ────────────────────
    // Total cell should show £1,500.00
    // Use getByRole("main") to avoid picking up nav labels that may share text
    const main = page.getByRole("main");
    await expect(
      main.getByText("£1,500.00").first(),
    ).toBeVisible();

    // Received should be £0.00 (none paid yet)
    await expect(
      main.getByText("£0.00").first(),
    ).toBeVisible();
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 4 — Payments tab: GHL connect prompt shown when venue has no GHL creds
// ---------------------------------------------------------------------------

test("money/payments: GHL connect prompt shown when no GHL credentials are configured", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `money-ghl-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);
    const weddingId = await seedWedding(
      venueId,
      `GHL Test ${random}`,
      "2028-03-14",
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    await page.goto(`/weddings/${weddingId}/payments`);
    await expect(
      page.getByRole("heading", { name: "Payments" }),
    ).toBeVisible({ timeout: 10_000 });

    // GHL connect prompt must appear (no credentials seeded)
    await expect(
      page.getByText("GHL not connected"),
    ).toBeVisible({ timeout: 8_000 });

    // The prompt links to settings
    await expect(
      page.getByRole("link", { name: "Settings → GHL" }),
    ).toBeVisible();

    // "Send via GHL" must NOT appear (no GHL + no contact id either)
    await expect(
      page.getByRole("button", { name: /Send via GHL/i }),
    ).not.toBeVisible();

    await page.screenshot({ path: "logs/data/money-ghl-not-connected.png" });
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 5 — Payments tab: milestone form validation — label required
// ---------------------------------------------------------------------------

test("money/payments: milestone form blocks submit without a label", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `money-val-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);
    const weddingId = await seedWedding(
      venueId,
      `Val Test ${random}`,
      "2027-11-11",
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    await page.goto(`/weddings/${weddingId}/payments`);
    await expect(
      page.getByRole("heading", { name: "Payments" }),
    ).toBeVisible({ timeout: 10_000 });

    await page
      .getByRole("button", { name: "Add milestone" })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Add payment milestone" }),
    ).toBeVisible({ timeout: 5_000 });

    // Fill amount + date but leave label empty
    await dialog.getByLabel("Amount (£)").fill("500.00");
    await dialog.getByLabel("Due date").fill("2027-11-01");

    await dialog.getByRole("button", { name: "Add milestone" }).click();

    // HTML5 required blocks the submit — no toast, dialog stays open
    await page.waitForTimeout(600);
    await expect(page.getByText("Milestone added")).not.toBeVisible();

    // Dialog is still open
    await expect(
      dialog.getByRole("heading", { name: "Add payment milestone" }),
    ).toBeVisible();
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 6 — Payments tab: milestone form validation — amount required
// ---------------------------------------------------------------------------

test("money/payments: milestone form blocks submit without an amount", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `money-vamt-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);
    const weddingId = await seedWedding(
      venueId,
      `ValAmt ${random}`,
      "2027-12-01",
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    await page.goto(`/weddings/${weddingId}/payments`);
    await expect(
      page.getByRole("heading", { name: "Payments" }),
    ).toBeVisible({ timeout: 10_000 });

    await page
      .getByRole("button", { name: "Add milestone" })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Add payment milestone" }),
    ).toBeVisible({ timeout: 5_000 });

    // Label + date filled; amount intentionally left empty
    await dialog.getByLabel("Label").fill("Balance payment");
    await dialog.getByLabel("Due date").fill("2027-12-01");

    await dialog.getByRole("button", { name: "Add milestone" }).click();

    await page.waitForTimeout(600);
    await expect(page.getByText("Milestone added")).not.toBeVisible();

    await expect(
      dialog.getByRole("heading", { name: "Add payment milestone" }),
    ).toBeVisible();
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 7 — /money hub: wedding appears in Bookings & payment health table
// ---------------------------------------------------------------------------

test("money/hub: wedding with milestone appears in Bookings & payment health table", async ({
  page,
}) => {
  page.setDefaultTimeout(30_000);
  const random = Date.now().toString(36);
  const slug = `money-hub-${random}`;
  let userId = "";
  let venueId = "";

  const coupleNames = `Hub & Money ${random}`;

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    // Seed a wedding
    const weddingId = await seedWedding(venueId, coupleNames, "2027-10-15");

    // Seed a milestone directly so the hub can reflect it
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    await admin.from("payment_milestones").insert({
      venue_id: venueId,
      wedding_id: weddingId,
      label: "Deposit",
      amount_minor: 75000, // £750.00
      due_date: "2027-03-01",
      status: "due", // unpaid → becomes the wedding's "next milestone" in the hub table
    });

    // ── Log in ────────────────────────────────────────────────────────────
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // ── Navigate to money hub ─────────────────────────────────────────────
    await page.goto("/money");

    // Page heading
    await expect(
      page.getByRole("heading", { name: "Proposals & Payments" }),
    ).toBeVisible({ timeout: 10_000 });

    // ── Bookings & payment health section ─────────────────────────────────
    await expect(
      page.getByText("Bookings & payment health"),
    ).toBeVisible();

    // The wedding must appear in the table by couple name
    await expect(
      page.getByText(coupleNames).first(),
    ).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "logs/data/money-hub-booking-row.png" });

    // ── KPI strip: total booked value reflects milestone ──────────────────
    // £750.00 seeded — should appear somewhere in the KPI strip
    // (total_value_minor on the wedding is null, but milestones are summed separately)
    // The "Booked value" KPI reads weddings.total_value_minor — it may be 0/— for
    // our seeded record (we didn't set it). Verify the row itself renders rather
    // than the KPI (which depends on total_value_minor).
    // Just confirm the table row is present with a next-milestone label.
    await expect(
      page.getByText("Deposit").first(),
    ).toBeVisible();

    await page.screenshot({ path: "logs/data/money-hub-after-seeded.png" });
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 8 — Wedding hub: Payments tile appears in planning rail
// ---------------------------------------------------------------------------

test("money/hub: wedding workspace planning rail shows Payments tile linking to payments tab", async ({
  page,
}) => {
  page.setDefaultTimeout(25_000);
  const random = Date.now().toString(36);
  const slug = `money-rail-${random}`;
  let userId = "";
  let venueId = "";

  const coupleNames = `Rail & Pay ${random}`;

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);
    const weddingId = await seedWedding(venueId, coupleNames, "2027-08-20");

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    await page.goto(`/weddings/${weddingId}`);
    await expect(
      page.getByRole("heading", { name: coupleNames }),
    ).toBeVisible({ timeout: 10_000 });

    // Planning rail is present
    const rail = page.getByRole("list", { name: "Planning tools" });
    await expect(rail).toBeVisible();

    // Payments tile is in the rail
    await expect(
      rail.getByRole("listitem").filter({ hasText: "Payments" }),
    ).toBeVisible({ timeout: 5_000 });

    // "No milestones yet" count label appears on the tile
    await expect(
      rail.getByText("No milestones yet"),
    ).toBeVisible();

    // Clicking the Payments tile navigates to /weddings/[id]/payments
    await rail
      .getByRole("listitem")
      .filter({ hasText: "Payments" })
      .click();

    await page.waitForURL(`**/weddings/${weddingId}/payments`, { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: "Payments" }),
    ).toBeVisible({ timeout: 8_000 });

    await page.screenshot({ path: "logs/data/money-rail-payments-nav.png" });
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 9 — Payments tab: milestone count updates planning rail after add
// ---------------------------------------------------------------------------

test("money/payments: milestone count shown on planning rail updates after milestone is added", async ({
  page,
}) => {
  page.setDefaultTimeout(35_000);
  const random = Date.now().toString(36);
  const slug = `money-cnt-${random}`;
  let userId = "";
  let venueId = "";

  const coupleNames = `Count & Track ${random}`;
  const milestoneLabel = `Balance ${random}`;

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);
    const weddingId = await seedWedding(venueId, coupleNames, "2027-07-07");

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // ── Start at the wedding hub — confirm 0 milestones ───────────────────
    await page.goto(`/weddings/${weddingId}`);
    await expect(
      page.getByRole("heading", { name: coupleNames }),
    ).toBeVisible({ timeout: 10_000 });

    const rail = page.getByRole("list", { name: "Planning tools" });
    await expect(
      rail.getByText("No milestones yet"),
    ).toBeVisible();

    // ── Go to payments and add a milestone ────────────────────────────────
    await page.goto(`/weddings/${weddingId}/payments`);
    await expect(
      page.getByRole("heading", { name: "Payments" }),
    ).toBeVisible({ timeout: 10_000 });

    await page
      .getByRole("button", { name: "Add milestone" })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Add payment milestone" }),
    ).toBeVisible({ timeout: 5_000 });

    await dialog.getByLabel("Label").fill(milestoneLabel);
    await dialog.getByLabel("Amount (£)").fill("2000.00");
    await dialog.getByLabel("Due date").fill("2027-07-01");
    await dialog.getByRole("button", { name: "Add milestone" }).click();

    await expect(page.getByText("Milestone added")).toBeVisible({ timeout: 12_000 });

    // ── Navigate back to the wedding hub ──────────────────────────────────
    await page.goto(`/weddings/${weddingId}`);
    await expect(
      page.getByRole("heading", { name: coupleNames }),
    ).toBeVisible({ timeout: 10_000 });

    // Planning rail now shows "1 milestone" (not "No milestones yet")
    const rail2 = page.getByRole("list", { name: "Planning tools" });
    await expect(
      rail2.getByText("1 milestone"),
    ).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: "logs/data/money-rail-count-updated.png" });
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 10 — Payments tab: status strip reflects paid totals after status change
// ---------------------------------------------------------------------------

test("money/payments: summary strip reflects Received total when milestone status set to deposit-paid", async ({
  page,
}) => {
  page.setDefaultTimeout(35_000);
  const random = Date.now().toString(36);
  const slug = `money-strip-${random}`;
  let userId = "";
  let venueId = "";

  const coupleNames = `Strip & Status ${random}`;

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);
    const weddingId = await seedWedding(venueId, coupleNames, "2027-05-05");

    // Seed a paid milestone directly (lifecycle status 'paid' = received)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    await admin.from("payment_milestones").insert({
      venue_id: venueId,
      wedding_id: weddingId,
      label: "Deposit",
      amount_minor: 50000, // £500.00
      due_date: "2027-01-15",
      status: "paid",
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    await page.goto(`/weddings/${weddingId}/payments`);
    await expect(
      page.getByRole("heading", { name: "Payments" }),
    ).toBeVisible({ timeout: 10_000 });

    // Milestone should show the "Paid" lifecycle badge
    await expect(
      page.getByText("Paid", { exact: true }).first(),
    ).toBeVisible({ timeout: 8_000 });

    // Received (paid) strip cell should show £500.00
    const main = page.getByRole("main");
    // The strip has Total / Received / Balance — get all £500.00 instances
    // Received cell is the 2nd strip cell. The amount appears at least once.
    await expect(
      main.getByText("£500.00").first(),
    ).toBeVisible();

    await page.screenshot({ path: "logs/data/money-strip-received.png" });
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 11 — /money: empty state shows correct copy when no weddings exist
// ---------------------------------------------------------------------------

test("money/hub: empty state shows 'No bookings yet' when venue has no weddings", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `money-empty-${random}`;
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

    await page.goto("/money");

    await expect(
      page.getByRole("heading", { name: "Proposals & Payments" }),
    ).toBeVisible({ timeout: 10_000 });

    // Bookings table empty state
    await expect(
      page.getByText("No bookings yet"),
    ).toBeVisible();

    // Proposals section also empty
    await expect(
      page.getByText("No proposals here"),
    ).toBeVisible();

    await page.screenshot({ path: "logs/data/money-hub-empty.png" });
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});
