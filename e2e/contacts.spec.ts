import { test, expect } from "@playwright/test";
import {
  createSmokeUser,
  deleteSmokeUser,
  deleteVenuesForUser,
  createCompletedVenue,
} from "./setup-users";
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

test("contacts: create → list → detail timeline → edit", async ({ page }) => {
  page.setDefaultTimeout(12_000);
  const random = Date.now().toString(36);
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    await createCompletedVenue(userId, `contacts-${random}`);

    // Log in → onboarding complete → lands in app
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Go to contacts → empty state
    await page.goto("/contacts");
    await expect(page.getByText("No contacts yet")).toBeVisible();

    // Create a contact
    await page.getByRole("button", { name: "New contact" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("First name", { exact: true }).fill("Anna");
    await page.getByLabel("Last name", { exact: true }).fill("Smith");
    await page.getByLabel("Email").fill(`anna+${random}@example.com`);
    await page.getByLabel("Guest count").fill("120");
    await page.getByLabel("Budget (£)").fill("18000");
    await page.getByRole("button", { name: "Create contact" }).click();

    // Appears in the list with the opening stage
    const row = page.getByRole("link", { name: /Anna Smith/ });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Inbound enquiry").first()).toBeVisible();
    await expect(page.getByText("120 guests")).toBeVisible();
    await page.screenshot({ path: screenshotPath("m2-contacts-list") });

    // Open detail → timeline shows the creation event
    await row.click();
    await page.waitForURL(/\/contacts\/[0-9a-f-]+$/, { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: "Anna Smith" }),
    ).toBeVisible();
    await expect(
      page.getByText("Enquiry created in Inbound enquiry"),
    ).toBeVisible();
    await expect(page.getByText("£18,000")).toBeVisible();
    await page.screenshot({ path: screenshotPath("m2-contact-detail") });

    // Edit → change last name → persists
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Last name", { exact: true }).fill("Smith-Jones");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByRole("heading", { name: "Anna Smith-Jones" }),
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});
