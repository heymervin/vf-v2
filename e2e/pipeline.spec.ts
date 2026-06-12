import { test, expect, type Page } from "@playwright/test";
import {
  createSmokeUser,
  deleteSmokeUser,
  deleteVenuesForUser,
  createCompletedVenue,
  seedOpportunity,
} from "./setup-users";
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

const SCREENSHOTS_DIR = path.join(__dirname, "../logs/data/screenshots");
const screenshotPath = (name: string) =>
  path.join(SCREENSHOTS_DIR, `${name}.png`);

// Raw pointer-drag simulation against dnd-kit is timing-sensitive; allow a
// couple of retries. (The menu-move test is the deterministic persistence proof.)
test.describe.configure({ retries: 2 });

const col = (page: Page, label: string) =>
  page.getByRole("region", { name: label });

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

test("pipeline: drag across stages persists across reload", async ({ page }) => {
  page.setDefaultTimeout(12_000);
  const random = Date.now().toString(36);
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    const venueId = await createCompletedVenue(userId, `pipe-${random}`);
    await seedOpportunity(venueId, "Olivia", "Bennett", "inbound_enquiry", 1000);
    await seedOpportunity(venueId, "Sophie", "Turner", "inbound_enquiry", 2000);

    await login(page, user.email, user.password);
    await page.goto("/pipeline");

    // Olivia starts in Inbound enquiry. Wait for the sortable to hydrate
    // (useSortable sets aria-roledescription) before simulating the drag —
    // dragging before listeners attach was the flake.
    const card = page.locator(
      '[aria-label="Olivia Bennett"][aria-roledescription="sortable"]',
    );
    await expect(card).toBeVisible();
    await expect(
      col(page, "Responded").getByText("Olivia Bennett"),
    ).toHaveCount(0);

    // Paced pointer drag from Inbound enquiry → Responded (adjacent column).
    const target = col(page, "Responded");
    const from = await card.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error("missing bounding boxes");
    const cx = from.x + from.width / 2;
    const cy = from.y + from.height / 2;
    const tx = to.x + to.width / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.move(cx + 4, cy + 12, { steps: 5 }); // cross 6px activation
    await page.waitForTimeout(120);
    await page.mouse.move(tx, to.y + 120, { steps: 18 });
    await page.waitForTimeout(150);
    await page.mouse.move(tx, to.y + 130, { steps: 4 });
    await page.waitForTimeout(150);
    await page.mouse.up();

    // Optimistic: Olivia now in Responded.
    await expect(
      col(page, "Responded").getByText("Olivia Bennett"),
    ).toBeVisible();
    await page.screenshot({ path: screenshotPath("m2-pipeline-board") });

    // Persisted: reload and confirm she's still in Responded.
    await page.reload();
    await expect(
      col(page, "Responded").getByText("Olivia Bennett"),
    ).toBeVisible();
    await expect(
      col(page, "Inbound enquiry").getByText("Olivia Bennett"),
    ).toHaveCount(0);
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});

test("pipeline: menu move + card peek", async ({ page }) => {
  page.setDefaultTimeout(12_000);
  const random = Date.now().toString(36) + "b";
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    const venueId = await createCompletedVenue(userId, `pipe-${random}`);
    await seedOpportunity(venueId, "Grace", "Mitchell", "inbound_enquiry", 1000);

    await login(page, user.email, user.password);
    await page.goto("/pipeline");

    const card = page.locator('[aria-label="Grace Mitchell"]').first();
    await expect(card).toBeVisible();

    // Keyboard/mobile path: ⋯ menu → Move to stage → Appointment booked.
    await card.getByLabel("Card actions").click();
    await page.getByRole("menuitem", { name: "Move to stage" }).click();
    await page.getByRole("menuitem", { name: "Appointment booked" }).click();
    await expect(
      col(page, "Appointment booked").getByText("Grace Mitchell"),
    ).toBeVisible();

    await page.reload();
    await expect(
      col(page, "Appointment booked").getByText("Grace Mitchell"),
    ).toBeVisible();

    // Peek sheet opens on card click.
    await page.locator('[aria-label="Grace Mitchell"]').first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("grace.mitchell@example.com")).toBeVisible();
    await expect(
      sheet.getByRole("link", { name: "Open full contact" }),
    ).toBeVisible();
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});
