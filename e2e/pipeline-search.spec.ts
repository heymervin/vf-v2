import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  createSmokeUser,
  deleteSmokeUser,
  deleteVenuesForUser,
  createCompletedVenue,
  seedOpportunity, signIn } from "./setup-users";
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

const col = (page: Page, label: string) =>
  page.getByRole("region", { name: label });

async function login(page: Page, email: string, password: string) {
  await signIn(page, user);
}

test("pipeline-search: name match shows only matching cards and hides others", async ({
  page,
}) => {
  page.setDefaultTimeout(12_000);
  const random = Date.now().toString(36);
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    const venueId = await createCompletedVenue(userId, `psearch-${random}`);

    // Seed three contacts in the same stage so we can confirm filtering.
    await seedOpportunity(venueId, "Alice", "Harper", "inbound_enquiry", 1000);
    await seedOpportunity(venueId, "Bob", "Weston", "inbound_enquiry", 2000);
    await seedOpportunity(venueId, "Clara", "Weston", "responded", 3000);

    // Confirm all three are in the DB.
    const db = admin();
    const { data: opps } = await db
      .from("opportunities")
      .select("id, contacts(first_name, last_name)")
      .eq("venue_id", venueId)
      .is("archived_at", null);
    expect(opps?.length).toBe(3);

    await login(page, user.email, user.password);
    await page.goto("/pipeline");

    // All three cards are visible before search.
    await expect(col(page, "Inbound enquiry").getByText("Alice Harper")).toBeVisible();
    await expect(col(page, "Inbound enquiry").getByText("Bob Weston")).toBeVisible();
    await expect(col(page, "Responded").getByText("Clara Weston")).toBeVisible();

    // Type a name query that matches only the two Westons.
    const searchInput = page.getByRole("textbox", { name: "Search pipeline" });
    await searchInput.fill("Weston");
    await page.screenshot({ path: screenshotPath("pipeline-search-name-match") });

    // Bob Weston visible in Inbound enquiry; Clara Weston visible in Responded.
    await expect(col(page, "Inbound enquiry").getByText("Bob Weston")).toBeVisible();
    await expect(col(page, "Responded").getByText("Clara Weston")).toBeVisible();

    // Alice Harper is NOT visible — she does not match "Weston".
    await expect(col(page, "Inbound enquiry").getByText("Alice Harper")).toHaveCount(0);

    // "x of y" filtered count shown in the Inbound enquiry column header.
    await expect(col(page, "Inbound enquiry").getByText("1 of 2")).toBeVisible();

    // Clear the search via the X button.
    await page.getByLabel("Clear search").click();
    await expect(searchInput).toHaveValue("");

    // All three cards are visible again after clearing.
    await expect(col(page, "Inbound enquiry").getByText("Alice Harper")).toBeVisible();
    await expect(col(page, "Inbound enquiry").getByText("Bob Weston")).toBeVisible();
    await expect(col(page, "Responded").getByText("Clara Weston")).toBeVisible();

    await page.screenshot({ path: screenshotPath("pipeline-search-cleared") });
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

test("pipeline-search: no-match query shows empty columns with 'No matches'", async ({
  page,
}) => {
  page.setDefaultTimeout(12_000);
  const random = Date.now().toString(36) + "b";
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    const venueId = await createCompletedVenue(userId, `psearch2-${random}`);

    await seedOpportunity(venueId, "David", "Kim", "inbound_enquiry", 1000);

    await login(page, user.email, user.password);
    await page.goto("/pipeline");

    await expect(col(page, "Inbound enquiry").getByText("David Kim")).toBeVisible();

    // Type a query that matches nothing.
    const searchInput = page.getByRole("textbox", { name: "Search pipeline" });
    await searchInput.fill("zzznomatch999");

    // Every column shows "No matches" empty state.
    const noMatches = page.getByText("No matches");
    await expect(noMatches.first()).toBeVisible();

    // David Kim card is hidden.
    await expect(col(page, "Inbound enquiry").getByText("David Kim")).toHaveCount(0);

    // "Clear filters" button is visible while a filter is active.
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();

    await page.screenshot({ path: screenshotPath("pipeline-search-no-match") });

    // "Clear filters" button resets the board.
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(col(page, "Inbound enquiry").getByText("David Kim")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Clear filters" }),
    ).toHaveCount(0);
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

test("pipeline-search: source filter shows only cards from that source", async ({
  page,
}) => {
  page.setDefaultTimeout(12_000);
  const random = Date.now().toString(36) + "c";
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    const venueId = await createCompletedVenue(userId, `psearch3-${random}`);

    // seedOpportunity uses "Website" as the source. Seed two from Website.
    await seedOpportunity(venueId, "Emma", "Hall", "inbound_enquiry", 1000);
    await seedOpportunity(venueId, "Fiona", "Cox", "inbound_enquiry", 2000);

    // Seed one more via the DB with a different source so the dropdown appears.
    const db = admin();
    const { data: contact } = await db
      .from("contacts")
      .insert({
        venue_id: venueId,
        first_name: "George",
        last_name: "Price",
        email: `george.price+${random}@example.com`,
        wedding_date: "2027-09-01",
        guest_count: 90,
        source: "Referral",
      })
      .select("id")
      .single();
    if (contact) {
      await db.from("opportunities").insert({
        venue_id: venueId,
        contact_id: contact.id,
        stage: "inbound_enquiry",
        sort_index: 3000,
      });
    }

    await login(page, user.email, user.password);
    await page.goto("/pipeline");

    // All three visible.
    await expect(col(page, "Inbound enquiry").getByText("Emma Hall")).toBeVisible();
    await expect(col(page, "Inbound enquiry").getByText("Fiona Cox")).toBeVisible();
    await expect(col(page, "Inbound enquiry").getByText("George Price")).toBeVisible();

    // The source filter dropdown is visible (sources exist on cards).
    const sourceTrigger = page.getByRole("combobox").first();
    await sourceTrigger.click();
    await page.getByRole("option", { name: "Website" }).click();

    // Only Website cards visible; George Price (Referral) is hidden.
    await expect(col(page, "Inbound enquiry").getByText("Emma Hall")).toBeVisible();
    await expect(col(page, "Inbound enquiry").getByText("Fiona Cox")).toBeVisible();
    await expect(col(page, "Inbound enquiry").getByText("George Price")).toHaveCount(0);

    await page.screenshot({ path: screenshotPath("pipeline-search-source-filter") });

    // Confirm "1 of 3" count is replaced by "2 of 3" for the Inbound column.
    await expect(col(page, "Inbound enquiry").getByText("2 of 3")).toBeVisible();

    // Switch to Referral source.
    await sourceTrigger.click();
    await page.getByRole("option", { name: "Referral" }).click();

    await expect(col(page, "Inbound enquiry").getByText("George Price")).toBeVisible();
    await expect(col(page, "Inbound enquiry").getByText("Emma Hall")).toHaveCount(0);
    await expect(col(page, "Inbound enquiry").getByText("Fiona Cox")).toHaveCount(0);
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});
