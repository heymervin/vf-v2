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
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
const screenshotPath = (name: string) =>
  path.join(SCREENSHOTS_DIR, `${name}.png`);

/**
 * Seed three contacts with deterministic created_at timestamps so we can
 * assert ordering without relying on wall-clock sequencing.
 *
 * Alphabetical order by last name: Adams < Martinez < Whitfield
 * Insertion order (newest first):  Whitfield, Martinez, Adams
 * Wedding date order (ascending):  Adams (2027-03), Martinez (2027-06), Whitfield (2027-09)
 */
async function seedContacts(venueId: string) {
  const db = admin();

  const rows = [
    {
      first_name: "Charles",
      last_name: "Whitfield",
      email: "charles.whitfield@example.com",
      guest_count: 90,
      wedding_date: "2027-09-20",
      source: "Website",
      created_at: new Date(Date.now() - 1_000).toISOString(), // inserted last → newest
    },
    {
      first_name: "Isabel",
      last_name: "Martinez",
      email: "isabel.martinez@example.com",
      guest_count: 140,
      wedding_date: "2027-06-12",
      source: "Referral",
      created_at: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
    },
    {
      first_name: "Grace",
      last_name: "Adams",
      email: "grace.adams@example.com",
      guest_count: 60,
      wedding_date: "2027-03-05",
      source: "Website",
      created_at: new Date(Date.now() - 120_000).toISOString(), // oldest
    },
  ];

  const { data, error } = await db
    .from("contacts")
    .insert(rows.map((r) => ({ ...r, venue_id: venueId })))
    .select("id, last_name, created_at");

  if (error || !data) throw new Error(`seed contacts: ${error?.message}`);
  return data as { id: string; last_name: string; created_at: string }[];
}

test("contacts-sort: default newest → oldest → name A–Z → wedding date → clear resets to newest", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    const venueId = await createCompletedVenue(userId, `sort-${random}`);

    await seedContacts(venueId);

    // Sign in.
    await signIn(page, user);

    // Navigate to contacts.
    await page.goto("/contacts");

    // ── Default: "Newest" ──────────────────────────────────────────────────
    // Newest = Whitfield first, Adams last.
    const rows = page.locator("ul li");
    await expect(rows).toHaveCount(3, { timeout: 10_000 });

    const firstRowNewest = rows.first().getByRole("link");
    await expect(firstRowNewest).toContainText("Whitfield");
    const lastRowNewest = rows.last().getByRole("link");
    await expect(lastRowNewest).toContainText("Adams");

    await page.screenshot({ path: screenshotPath("contacts-sort-newest") });

    // ── Sort: "Oldest" ─────────────────────────────────────────────────────
    // aria-label on the sort trigger is "Sort contacts"
    await page
      .getByRole("combobox", { name: "Sort contacts" })
      .click();
    await page.getByRole("option", { name: "Oldest" }).click();

    await page.waitForURL(/sort=oldest/, { timeout: 8_000 });
    await expect(rows.first().getByRole("link")).toContainText("Adams");
    await expect(rows.last().getByRole("link")).toContainText("Whitfield");

    await page.screenshot({ path: screenshotPath("contacts-sort-oldest") });

    // Verify ?sort=oldest is reflected in the URL (DB-driven SSR, not just UI).
    expect(page.url()).toContain("sort=oldest");

    // ── Sort: "Name A–Z" ───────────────────────────────────────────────────
    await page
      .getByRole("combobox", { name: "Sort contacts" })
      .click();
    await page.getByRole("option", { name: "Name A–Z" }).click();

    await page.waitForURL(/sort=name/, { timeout: 8_000 });
    // Adams < Martinez < Whitfield
    const names = await rows.locator("p.font-medium").allInnerTexts();
    expect(names[0]).toContain("Adams");
    expect(names[1]).toContain("Martinez");
    expect(names[2]).toContain("Whitfield");

    await page.screenshot({ path: screenshotPath("contacts-sort-name") });

    // ── Sort: "Wedding date" ───────────────────────────────────────────────
    await page
      .getByRole("combobox", { name: "Sort contacts" })
      .click();
    await page.getByRole("option", { name: "Wedding date" }).click();

    await page.waitForURL(/sort=wedding_date/, { timeout: 8_000 });
    // Earliest wedding: Adams (Mar), Martinez (Jun), Whitfield (Sep)
    const wdNames = await rows.locator("p.font-medium").allInnerTexts();
    expect(wdNames[0]).toContain("Adams");
    expect(wdNames[1]).toContain("Martinez");
    expect(wdNames[2]).toContain("Whitfield");

    await page.screenshot({ path: screenshotPath("contacts-sort-wedding-date") });

    // ── "Clear" button resets all params (back to newest) ─────────────────
    await expect(page.getByRole("button", { name: "Clear" })).toBeVisible();
    await page.getByRole("button", { name: "Clear" }).click();

    // URL should have no sort param after clearing.
    await page.waitForURL((url) => !url.href.includes("sort="), {
      timeout: 8_000,
    });
    expect(page.url()).not.toContain("sort=");

    // Back to newest: Whitfield first.
    await expect(rows.first().getByRole("link")).toContainText("Whitfield", {
      timeout: 8_000,
    });

    await page.screenshot({ path: screenshotPath("contacts-sort-cleared") });

    // ── DB-side assertion: contacts exist in Supabase ──────────────────────
    const db = admin();
    const { data: dbContacts, error } = await db
      .from("contacts")
      .select("last_name, created_at")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false });

    expect(error).toBeNull();
    expect(dbContacts).toHaveLength(3);
    // Newest row first.
    expect(dbContacts![0].last_name).toBe("Whitfield");
    expect(dbContacts![2].last_name).toBe("Adams");
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});
