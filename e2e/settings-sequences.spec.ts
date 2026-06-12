import { test, expect } from "@playwright/test";
import {
  createSmokeUser,
  deleteSmokeUser,
  deleteVenuesForUser,
  createCompletedVenue,
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

test("settings/sequences: toggle on, edit step 1 subject, save, reload, assert persisted", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  const slug = `seq-${random}`;
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    await createCompletedVenue(userId, slug);

    // Log in
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Navigate to sequences settings
    await page.goto("/settings/sequences");
    await expect(page.getByRole("heading", { name: "Nurture sequence" })).toBeVisible();

    // Enable the master sequence switch (it starts disabled)
    const masterSwitch = page.getByLabel("Enable nurture sequence");
    await expect(masterSwitch).toBeVisible();
    if (!(await masterSwitch.isChecked())) {
      await masterSwitch.click();
    }
    // Toast confirming enable
    await expect(page.getByText("Nurture sequence enabled.")).toBeVisible({ timeout: 8_000 });

    // Edit Step 1 subject
    const subjectInput = page.getByLabel("Subject").first();
    await subjectInput.clear();
    await subjectInput.fill("Test subject for step 1");

    // Save Step 1
    await page.getByRole("button", { name: "Save step" }).first().click();
    await expect(page.getByText("Step 1 saved.")).toBeVisible({ timeout: 8_000 });

    // Take screenshot before reload
    await page.screenshot({ path: "logs/data/sequences-settings-before-reload.png" });

    // Reload and assert persistence
    await page.reload();
    await expect(page.getByLabel("Subject").first()).toHaveValue("Test subject for step 1");
    await expect(page.getByLabel("Enable nurture sequence")).toBeChecked();

    // Screenshot after reload for visual confirmation
    await page.screenshot({ path: "logs/data/sequences-settings-after-reload.png" });
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});
