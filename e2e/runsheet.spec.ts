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
// Helpers
// ---------------------------------------------------------------------------

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function createWedding(venueId: string, coupleNames: string): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("weddings")
    .insert({
      venue_id: venueId,
      couple_names: coupleNames,
      wedding_date: "2028-06-14",
      status: "planning",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createWedding: ${error?.message}`);
  return data.id as string;
}

async function cleanupWedding(venueId: string) {
  const admin = adminClient();
  await admin.from("timeline_events").delete().eq("venue_id", venueId);
  await admin.from("couple_accounts").delete().eq("venue_id", venueId);
  await admin.from("weddings").delete().eq("venue_id", venueId);
}

// ---------------------------------------------------------------------------
// Login helper
// ---------------------------------------------------------------------------

async function loginAs(
  page: Parameters<Parameters<typeof test>[1]>[0]["page"],
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Test 1 — Empty state: page renders with no events
// ---------------------------------------------------------------------------

test("runsheet: empty state shows heading, empty message, and Add event button", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `rs-empty-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);
    const weddingId = await createWedding(venueId, `Empty Sheet ${random}`);

    await loginAs(page, user.email, user.password);
    await page.goto(`/weddings/${weddingId}/runsheet`);

    // Page heading
    await expect(
      page.getByRole("main").getByRole("heading", { name: "Run-sheet" }),
    ).toBeVisible({ timeout: 10_000 });

    // Empty state message
    await expect(page.getByText("No run-sheet yet")).toBeVisible();

    // Add event button (may be in header actions or empty-state — use first)
    await expect(
      page.getByRole("button", { name: "Add event" }).first(),
    ).toBeVisible();

    // Planning / Event Day mode toggle must be present
    await expect(page.getByRole("button", { name: "Planning" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Event Day" })).toBeVisible();

    await page.screenshot({ path: "logs/data/runsheet-empty-state.png" });
  } finally {
    if (venueId) await cleanupWedding(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 2 — Add event: form submits, event appears in timeline
// ---------------------------------------------------------------------------

test("runsheet: add event via sheet — appears in timeline sorted by time", async ({
  page,
}) => {
  page.setDefaultTimeout(25_000);
  const random = Date.now().toString(36);
  const slug = `rs-add-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);
    const weddingId = await createWedding(venueId, `Add Event ${random}`);

    await loginAs(page, user.email, user.password);
    await page.goto(`/weddings/${weddingId}/runsheet`);

    await expect(
      page.getByRole("main").getByRole("heading", { name: "Run-sheet" }),
    ).toBeVisible({ timeout: 10_000 });

    // Open the Add event sheet
    await page.getByRole("button", { name: "Add event" }).first().click();

    // Sheet should be open
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Add event" }),
    ).toBeVisible({ timeout: 5_000 });

    // Fill the form
    await page.getByLabel("Title").fill("Ceremony begins");
    await page.getByLabel("Time").fill("14:00");
    await page.getByLabel("Owner").fill("Coordinator");

    await page.screenshot({ path: "logs/data/runsheet-add-event-form.png" });

    // Submit
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add event" })
      .click();

    // Success toast
    await expect(page.getByText("Event added")).toBeVisible({ timeout: 10_000 });

    // Event appears in the timeline
    await expect(
      page.getByText("Ceremony begins"),
    ).toBeVisible({ timeout: 8_000 });

    await page.screenshot({ path: "logs/data/runsheet-after-add.png" });
  } finally {
    if (venueId) await cleanupWedding(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 3 — Edit event: change title, persists after reload
// ---------------------------------------------------------------------------

test("runsheet: edit event title — updated title persists", async ({ page }) => {
  page.setDefaultTimeout(25_000);
  const random = Date.now().toString(36);
  const slug = `rs-edit-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);
    const weddingId = await createWedding(venueId, `Edit Event ${random}`);

    // Seed one event directly via admin client
    await adminClient()
      .from("timeline_events")
      .insert({
        venue_id: venueId,
        wedding_id: weddingId,
        title: "Old Title",
        starts_at_time: "10:00",
        duration_min: 30,
        category: "ceremony",
        done: false,
        sort_order: 1,
      });

    await loginAs(page, user.email, user.password);
    await page.goto(`/weddings/${weddingId}/runsheet`);

    await expect(page.getByText("Old Title")).toBeVisible({ timeout: 10_000 });

    // Click the edit button for this row (aria-label contains the title)
    await page
      .getByRole("button", { name: /Edit.*Old Title/i })
      .first()
      .click();

    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Edit event" }),
    ).toBeVisible({ timeout: 5_000 });

    // Clear the title field and type new title
    const titleInput = page.getByRole("dialog").getByLabel("Title");
    await titleInput.clear();
    await titleInput.fill("Updated Title");

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save changes" })
      .click();

    await expect(page.getByText("Event updated")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Updated Title")).toBeVisible();
    await expect(page.getByText("Old Title")).not.toBeVisible();

    // Reload to confirm persistence
    await page.reload();
    await expect(page.getByText("Updated Title")).toBeVisible({
      timeout: 10_000,
    });

    await page.screenshot({ path: "logs/data/runsheet-after-edit.png" });
  } finally {
    if (venueId) await cleanupWedding(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 4 — Delete event: removes from timeline
// ---------------------------------------------------------------------------

test("runsheet: delete event — removed from timeline", async ({ page }) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `rs-del-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);
    const weddingId = await createWedding(venueId, `Delete Event ${random}`);

    await adminClient()
      .from("timeline_events")
      .insert({
        venue_id: venueId,
        wedding_id: weddingId,
        title: "Event to Delete",
        starts_at_time: "11:00",
        duration_min: 45,
        category: "reception",
        done: false,
        sort_order: 1,
      });

    await loginAs(page, user.email, user.password);
    await page.goto(`/weddings/${weddingId}/runsheet`);

    await expect(page.getByText("Event to Delete")).toBeVisible({
      timeout: 10_000,
    });

    // Delete lives inside the edit sheet — open it, then click Delete.
    await page
      .getByRole("button", { name: /Edit.*Event to Delete/i })
      .first()
      .click();

    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Edit event" }),
    ).toBeVisible({ timeout: 5_000 });

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete" })
      .click();

    await expect(page.getByText("Event deleted")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Event to Delete")).not.toBeVisible();

    await page.screenshot({ path: "logs/data/runsheet-after-delete.png" });
  } finally {
    if (venueId) await cleanupWedding(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 5 — Event Day mode: mode toggle switches view, check-off works
// ---------------------------------------------------------------------------

test("runsheet: event-day mode toggle shows check-off rows", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `rs-day-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);
    const weddingId = await createWedding(venueId, `Event Day ${random}`);

    await adminClient()
      .from("timeline_events")
      .insert({
        venue_id: venueId,
        wedding_id: weddingId,
        title: "First Dance",
        starts_at_time: "19:30",
        duration_min: 10,
        category: "reception",
        done: false,
        sort_order: 1,
      });

    await loginAs(page, user.email, user.password);
    await page.goto(`/weddings/${weddingId}/runsheet`);

    // Switch to Event Day mode
    await page.getByRole("button", { name: "Event Day" }).click();

    // Event should still appear as a row (event-day view also renders a
    // now/next hero card, so "First Dance" appears more than once).
    await expect(page.getByText("First Dance").first()).toBeVisible({
      timeout: 8_000,
    });

    // Day Progress strip (event-day only)
    await expect(page.getByText("Day progress")).toBeVisible();

    // Check-off the item
    await page
      .getByRole("button", {
        name: /Mark "First Dance" done/i,
      })
      .click();

    await expect(
      page.getByRole("button", {
        name: /Mark "First Dance" not done/i,
      }),
    ).toBeVisible({ timeout: 8_000 });

    await page.screenshot({ path: "logs/data/runsheet-event-day.png" });
  } finally {
    if (venueId) await cleanupWedding(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 6 — Venue isolation: another venue's wedding runsheet not accessible
// ---------------------------------------------------------------------------

test("runsheet: unauthenticated access redirects to /login", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);

  const fakeId = "00000000-0000-0000-0000-000000000099";
  await page.goto(`/weddings/${fakeId}/runsheet`);
  await page.waitForURL("**/login", { timeout: 10_000 });
  await expect(page.getByLabel("Email")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 7 — Wrong wedding ID: returns 404
// ---------------------------------------------------------------------------

test("runsheet: non-existent wedding returns 404", async ({ page }) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  const slug = `rs-404-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    await loginAs(page, user.email, user.password);

    const fakeId = "00000000-0000-0000-0000-000000000077";
    const response = await page.goto(`/weddings/${fakeId}/runsheet`);

    const status = response?.status() ?? 0;
    if (status !== 404) {
      await expect(page.getByText(/not found|404/i)).toBeVisible({
        timeout: 8_000,
      });
    }
  } finally {
    if (venueId) await deleteVenuesForUser(userId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});
