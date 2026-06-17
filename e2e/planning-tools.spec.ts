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
// Admin client factory
// ---------------------------------------------------------------------------

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

async function deleteWeddingsForVenue(venueId: string) {
  const admin = adminClient();
  await admin.from("couple_accounts").delete().eq("venue_id", venueId);
  await admin.from("weddings").delete().eq("venue_id", venueId);
}

async function deleteMenuItemsForVenue(venueId: string) {
  const admin = adminClient();
  await admin.from("menu_items").delete().eq("venue_id", venueId);
}

async function deleteSuppliersDirectoryForVenue(venueId: string) {
  const admin = adminClient();
  await admin.from("suppliers").delete().eq("venue_id", venueId);
}

// ---------------------------------------------------------------------------
// Seed helpers (admin bypasses RLS)
// ---------------------------------------------------------------------------

/**
 * Insert a single active menu_item into the venue library.
 * Returns the inserted row id.
 */
async function seedMenuItemForVenue(venueId: string): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("menu_items")
    .insert({
      venue_id: venueId,
      course: "Starter",
      name: "Smoked Salmon Blini",
      description: "House-cured salmon on blini with crème fraîche",
      allergens: ["fish", "dairy", "gluten"],
      dietary_tags: [],
      price_per_head_minor: 1200,
      is_active: true,
      sort_order: 1,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`seedMenuItemForVenue: ${error?.message}`);
  }
  return data.id as string;
}

/**
 * Insert a supplier into the venue directory.
 * Returns the inserted row id.
 */
async function seedDirectorySupplierForVenue(venueId: string): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("suppliers")
    .insert({
      venue_id: venueId,
      name: "Bloom & Wild Co.",
      category: "Florist",
      contact_name: "Jess Allen",
      phone: "+44 7700 900001",
      email: "jess@bloomandwild.test",
      venue_approved: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`seedDirectorySupplierForVenue: ${error?.message}`);
  }
  return data.id as string;
}

// ---------------------------------------------------------------------------
// Login helper — shared across tests that need an authenticated session
// ---------------------------------------------------------------------------

async function loginAs(
  page: import("@playwright/test").Page,
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
// Create-wedding helper — opens the sheet, fills minimum fields, submits,
// waits for the success toast and the hub URL, then returns the wedding UUID
// extracted from the URL.
// ---------------------------------------------------------------------------

async function createWeddingViaUI(
  page: import("@playwright/test").Page,
  coupleNames: string,
  partnerEmail: string,
  weddingDate = "2027-11-22",
): Promise<string> {
  await page.goto("/weddings");

  // Use the header "Create wedding" button (rule 1: header + empty-state share
  // the same name — use .first() to avoid strict-mode error when both visible)
  await page.getByRole("button", { name: "Create wedding" }).first().click();

  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Create wedding" }),
  ).toBeVisible({ timeout: 5_000 });

  await page.getByLabel("Couple names *").fill(coupleNames);
  await page.getByLabel("Partner A email *").fill(partnerEmail);
  await page.getByLabel("Wedding date").fill(weddingDate);

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create wedding" })
    .click();

  await expect(page.getByText("Wedding created")).toBeVisible({
    timeout: 12_000,
  });

  await page.waitForURL("**/weddings/**", { timeout: 12_000 });

  // Extract the UUID from the URL  /weddings/<uuid>
  const url = page.url();
  const match = url.match(/\/weddings\/([\w-]+)/);
  if (!match) throw new Error(`Could not extract wedding id from URL: ${url}`);
  return match[1];
}

// ---------------------------------------------------------------------------
// Test 1 — GUESTS: add a guest, assert it appears + RSVP summary updates
// ---------------------------------------------------------------------------

test("planning-tools/guests: add a guest, assert row + RSVP stat update", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `pt-guests-${random}`;
  let userId = "";
  let venueId = "";

  const coupleNames = `Guests Test ${random}`;
  const partnerEmail = `partner-gt-${random}@smoke.venueflow.io`;
  const guestName = `Alice Smoke-${random}`;

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    await loginAs(page, user.email, user.password);

    const weddingId = await createWeddingViaUI(page, coupleNames, partnerEmail);

    // Navigate to the guests tool
    await page.goto(`/weddings/${weddingId}/guests`);

    // Page heading asserts the tool loaded (not nav link — rule 6: prefer role+name)
    await expect(
      page.getByRole("heading", { name: "Guest list" }),
    ).toBeVisible({ timeout: 8_000 });

    // Empty-state button. Rule 1: header "Add guest" + empty-state "Add guest"
    // share the same name — use .first()
    await page.getByRole("button", { name: "Add guest" }).first().click();

    // Sheet opens (rule 5: assert dialog heading, not background heading)
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Add guest" }),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByLabel("Name *").fill(guestName);

    // Set RSVP to "yes" so the stat card updates visibly
    await page.getByRole("dialog").getByRole("combobox").nth(1).click();
    // The RSVP select options (rule 4: exact match on short labels)
    await page.getByRole("option", { name: "Confirmed" }).click();

    // Submit
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add guest" })
      .click();

    await expect(page.getByText("Guest added")).toBeVisible({ timeout: 8_000 });

    // Guest row appears in the table
    await expect(page.getByText(guestName).first()).toBeVisible({
      timeout: 8_000,
    });

    // "RSVP yes" stat card value should now be 1
    // Rule 2: stat cards may be duplicated — scope to the heading + card area
    await expect(
      page.getByRole("main").getByText("1").first(),
    ).toBeVisible({ timeout: 8_000 });

    // Rule 4: "Confirmed" badge appears in the table row (exact to avoid matching filter chip)
    await expect(
      page.getByRole("main").getByText("Confirmed", { exact: true }).first(),
    ).toBeVisible();

    await page.screenshot({
      path: "logs/data/planning-tools-guests-added.png",
    });
  } finally {
    if (venueId) {
      await deleteWeddingsForVenue(venueId);
      await deleteVenuesForUser(venueId);
    }
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 2 — RUN SHEET: add a timeline event, assert it renders
// ---------------------------------------------------------------------------

test("planning-tools/runsheet: add a timeline event, assert it appears in planning view", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `pt-rs-${random}`;
  let userId = "";
  let venueId = "";

  const coupleNames = `Runsheet Test ${random}`;
  const partnerEmail = `partner-rs-${random}@smoke.venueflow.io`;
  const eventTitle = `Ceremony Begins ${random}`;

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    await loginAs(page, user.email, user.password);

    const weddingId = await createWeddingViaUI(page, coupleNames, partnerEmail);

    await page.goto(`/weddings/${weddingId}/runsheet`);

    await expect(
      page.getByRole("heading", { name: "Run-sheet" }),
    ).toBeVisible({ timeout: 8_000 });

    // Add event button — rule 1: header button and empty-state button both exist
    await page.getByRole("button", { name: "Add event" }).first().click();

    // Sheet opens
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Add event" }),
    ).toBeVisible({ timeout: 5_000 });

    // Fill the title field (labelled "Title" — rule 6: prefer label)
    await page.getByLabel("Title").fill(eventTitle);

    // Time field — set to a specific time
    await page.getByLabel("Time").fill("14:30");

    // Submit with the sheet's own button
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add event" })
      .click();

    await expect(page.getByText("Event added.")).toBeVisible({ timeout: 8_000 });

    // Event appears in the timeline list with its title
    await expect(page.getByText(eventTitle).first()).toBeVisible({
      timeout: 8_000,
    });

    // Time is rendered in the planning view
    await expect(page.getByText("14:30").first()).toBeVisible();

    await page.screenshot({
      path: "logs/data/planning-tools-runsheet-event-added.png",
    });
  } finally {
    if (venueId) {
      await deleteWeddingsForVenue(venueId);
    }
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 3 — MENU (gating): locked when no menu items exist in venue library
// ---------------------------------------------------------------------------

test("planning-tools/menu: locked with empty library — shows lock state + settings link", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `pt-menu-gate-${random}`;
  let userId = "";
  let venueId = "";

  const coupleNames = `Menu Gated ${random}`;
  const partnerEmail = `partner-mg-${random}@smoke.venueflow.io`;

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    await loginAs(page, user.email, user.password);

    const weddingId = await createWeddingViaUI(page, coupleNames, partnerEmail);

    // No menu_items seeded — tool should be locked
    await page.goto(`/weddings/${weddingId}/menu`);

    // Gated state shows lock copy
    await expect(
      page.getByText("Menu library is empty"),
    ).toBeVisible({ timeout: 8_000 });

    // Deep-link to settings present
    await expect(
      page.getByRole("link", { name: /Add menu items in Settings/i }),
    ).toBeVisible();

    await page.screenshot({
      path: "logs/data/planning-tools-menu-locked.png",
    });
  } finally {
    if (venueId) {
      await deleteWeddingsForVenue(venueId);
    }
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 4 — MENU: seed a menu_item via admin, add it to wedding, assert
// ---------------------------------------------------------------------------

test("planning-tools/menu: with library item seeded, item appears and can be added to wedding menu", async ({
  page,
}) => {
  page.setDefaultTimeout(25_000);
  const random = Date.now().toString(36);
  const slug = `pt-menu-add-${random}`;
  let userId = "";
  let venueId = "";

  const coupleNames = `Menu Add ${random}`;
  const partnerEmail = `partner-ma-${random}@smoke.venueflow.io`;

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    // Seed a menu item BEFORE logging in, so gating check passes
    await seedMenuItemForVenue(venueId);

    await loginAs(page, user.email, user.password);

    const weddingId = await createWeddingViaUI(page, coupleNames, partnerEmail);

    await page.goto(`/weddings/${weddingId}/menu`);

    // Tool is now unlocked — heading visible
    await expect(
      page.getByRole("heading", { name: "Menu" }),
    ).toBeVisible({ timeout: 8_000 });

    // Seeded item appears in the list
    await expect(
      page.getByText("Smoked Salmon Blini").first(),
    ).toBeVisible({ timeout: 8_000 });

    // "Add" button for the item
    // Rule 6: prefer aria-label — AddToggle renders aria-label="Add {name} to menu"
    const addBtn = page.getByRole("button", {
      name: "Add Smoked Salmon Blini to menu",
    });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Toast confirms addition — text from addMenuSelection action revalidate cycle
    // The MenuClient does an optimistic toggle with router.refresh(); the button
    // swaps to "Remove" aria-label on success
    const removeBtn = page.getByRole("button", {
      name: "Remove Smoked Salmon Blini from menu",
    });
    await expect(removeBtn).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: "logs/data/planning-tools-menu-item-added.png",
    });
  } finally {
    if (venueId) {
      await deleteMenuItemsForVenue(venueId);
      await deleteWeddingsForVenue(venueId);
    }
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 5 — SUPPLIERS: seed a directory supplier, attach it to the wedding
// ---------------------------------------------------------------------------

test("planning-tools/suppliers: attach a directory supplier to wedding, assert it appears", async ({
  page,
}) => {
  page.setDefaultTimeout(25_000);
  const random = Date.now().toString(36);
  const slug = `pt-sup-${random}`;
  let userId = "";
  let venueId = "";

  const coupleNames = `Suppliers Test ${random}`;
  const partnerEmail = `partner-st-${random}@smoke.venueflow.io`;

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    // Seed a directory supplier BEFORE creating the wedding
    await seedDirectorySupplierForVenue(venueId);

    await loginAs(page, user.email, user.password);

    const weddingId = await createWeddingViaUI(page, coupleNames, partnerEmail);

    await page.goto(`/weddings/${weddingId}/suppliers`);

    // Suppliers page loads — heading scoped to main to avoid nav ambiguity (rule 6)
    await expect(
      page.getByRole("main").getByRole("heading", { name: "Suppliers" }),
    ).toBeVisible({ timeout: 8_000 });

    // Navigate to the "Venue directory" tab to attach the seeded supplier
    await page.getByRole("tab", { name: /Venue directory/i }).click();

    // The seeded supplier card appears
    await expect(
      page.getByText("Bloom & Wild Co.").first(),
    ).toBeVisible({ timeout: 8_000 });

    // "Add to wedding" button on the directory card
    const attachBtn = page.getByRole("button", { name: "Add to wedding" }).first();
    await expect(attachBtn).toBeVisible();
    await attachBtn.click();

    // Success toast
    await expect(
      page.getByText("Bloom & Wild Co. added to wedding"),
    ).toBeVisible({ timeout: 10_000 });

    // Card now shows "On this wedding" badge (rule 4: exact match on short label)
    await expect(
      page.getByText("On this wedding", { exact: true }).first(),
    ).toBeVisible({ timeout: 8_000 });

    // Navigate to Compliance tab — supplier should now appear in the list
    await page.getByRole("tab", { name: /Compliance/i }).click();

    await expect(
      page.getByText("Bloom & Wild Co.").first(),
    ).toBeVisible({ timeout: 8_000 });

    await page.screenshot({
      path: "logs/data/planning-tools-supplier-attached.png",
    });
  } finally {
    if (venueId) {
      await deleteSuppliersDirectoryForVenue(venueId);
      await deleteWeddingsForVenue(venueId);
    }
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 6 — SUPPLIERS: add an ad-hoc supplier (no directory entry required)
// ---------------------------------------------------------------------------

test("planning-tools/suppliers: add an ad-hoc supplier, assert it appears in compliance list", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `pt-adhoc-${random}`;
  let userId = "";
  let venueId = "";

  const coupleNames = `AdHoc Supplier ${random}`;
  const partnerEmail = `partner-ah-${random}@smoke.venueflow.io`;
  const adHocName = `Quick Shots Photography ${random}`;

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    await loginAs(page, user.email, user.password);

    const weddingId = await createWeddingViaUI(page, coupleNames, partnerEmail);

    await page.goto(`/weddings/${weddingId}/suppliers`);

    await expect(
      page.getByRole("main").getByRole("heading", { name: "Suppliers" }),
    ).toBeVisible({ timeout: 8_000 });

    // "Add supplier" header button
    await page.getByRole("button", { name: "Add supplier" }).first().click();

    // Sheet opens (rule 5: assert the dialog heading)
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Add supplier" }),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByLabel("Name *").fill(adHocName);

    // Category is a Select — open it and choose
    await page.getByRole("dialog").getByRole("combobox").click();
    await page.getByRole("option", { name: "Photographer" }).click();

    // Submit inside the dialog (it is a <form> with a submit button)
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add supplier" })
      .click();

    // Toast confirms
    await expect(
      page.getByText(`${adHocName} added to wedding`),
    ).toBeVisible({ timeout: 10_000 });

    // Supplier appears in the compliance list
    await expect(
      page.getByText(adHocName).first(),
    ).toBeVisible({ timeout: 8_000 });

    await page.screenshot({
      path: "logs/data/planning-tools-adhoc-supplier-added.png",
    });
  } finally {
    if (venueId) {
      await deleteWeddingsForVenue(venueId);
    }
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 7 — GUESTS: unauthenticated direct access redirects to login
// ---------------------------------------------------------------------------

test("planning-tools/guests: unauthenticated access redirects to /login", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const fakeId = "00000000-0000-0000-0000-000000000099";
  await page.goto(`/weddings/${fakeId}/guests`);
  await page.waitForURL("**/login", { timeout: 10_000 });
  await expect(page.getByLabel("Email")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 8 — RUN SHEET: unauthenticated direct access redirects to login
// ---------------------------------------------------------------------------

test("planning-tools/runsheet: unauthenticated access redirects to /login", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const fakeId = "00000000-0000-0000-0000-000000000098";
  await page.goto(`/weddings/${fakeId}/runsheet`);
  await page.waitForURL("**/login", { timeout: 10_000 });
  await expect(page.getByLabel("Email")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 9 — MENU: unauthenticated direct access redirects to login
// ---------------------------------------------------------------------------

test("planning-tools/menu: unauthenticated access redirects to /login", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const fakeId = "00000000-0000-0000-0000-000000000097";
  await page.goto(`/weddings/${fakeId}/menu`);
  await page.waitForURL("**/login", { timeout: 10_000 });
  await expect(page.getByLabel("Email")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 10 — SUPPLIERS: unauthenticated direct access redirects to login
// ---------------------------------------------------------------------------

test("planning-tools/suppliers: unauthenticated access redirects to /login", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const fakeId = "00000000-0000-0000-0000-000000000096";
  await page.goto(`/weddings/${fakeId}/suppliers`);
  await page.waitForURL("**/login", { timeout: 10_000 });
  await expect(page.getByLabel("Email")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 11 — GUESTS: wrong venue cannot access another venue's wedding guests
// (404 protection)
// ---------------------------------------------------------------------------

test("planning-tools/guests: non-existent wedding ID returns 404 or not-found UI", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  const slug = `pt-iso-${random}`;
  let userId = "";
  let venueId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    await loginAs(page, user.email, user.password);

    // A valid UUID that does not belong to this venue
    const fakeId = "00000000-0000-0000-0000-000000000095";
    const response = await page.goto(`/weddings/${fakeId}/guests`);

    const status = response?.status() ?? 0;
    if (status !== 404) {
      await expect(
        page.getByText(/not found|404/i),
      ).toBeVisible({ timeout: 8_000 });
    }
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 12 — RUNSHEET: event-day mode toggle renders without crashing
// ---------------------------------------------------------------------------

test("planning-tools/runsheet: switching to Event Day mode renders the count board", async ({
  page,
}) => {
  page.setDefaultTimeout(20_000);
  const random = Date.now().toString(36);
  const slug = `pt-rsed-${random}`;
  let userId = "";
  let venueId = "";

  const coupleNames = `EventDay Test ${random}`;
  const partnerEmail = `partner-ed-${random}@smoke.venueflow.io`;

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    venueId = await createCompletedVenue(userId, slug);

    await loginAs(page, user.email, user.password);

    const weddingId = await createWeddingViaUI(page, coupleNames, partnerEmail);

    await page.goto(`/weddings/${weddingId}/runsheet`);

    await expect(
      page.getByRole("heading", { name: "Run-sheet" }),
    ).toBeVisible({ timeout: 8_000 });

    // Switch to Event Day mode
    await page.getByRole("button", { name: "Event Day" }).click();

    // Count board cells are visible (rule 2: first() to avoid duplicate layout panels)
    await expect(
      page.getByText("Suppliers in", { exact: false }).first(),
    ).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByText("Done", { exact: false }).first(),
    ).toBeVisible();

    await expect(
      page.getByText("Next item", { exact: false }).first(),
    ).toBeVisible();

    await page.screenshot({
      path: "logs/data/planning-tools-runsheet-event-day.png",
    });
  } finally {
    if (venueId) await deleteWeddingsForVenue(venueId);
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});
