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
const screenshotPath = (name: string) =>
  path.join(SCREENSHOTS_DIR, `${name}.png`);

test("spaces: empty state → add → edit → delete, DB assertions via service role", async ({
  page,
}) => {
  page.setDefaultTimeout(12_000);
  const random = Date.now().toString(36);
  const slug = `spaces-${random}`;
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    const venueId = await createCompletedVenue(userId, slug);

    // Sign in and land on the app.
    await signIn(page, user);

    // Navigate to the spaces settings page.
    await page.goto("/settings/spaces");
    await expect(
      page.getByRole("heading", { name: "Spaces" }),
    ).toBeVisible();

    // Empty state.
    await expect(
      page.getByText("No spaces yet. Add your first one to get started."),
    ).toBeVisible();
    await page.screenshot({ path: screenshotPath("spaces-empty") });

    // Open the add form.
    await page.getByRole("button", { name: "Add space" }).click();
    await expect(page.getByText("New space")).toBeVisible();

    // Fill in the new space details.
    await page.getByLabel("Space name").fill("The Main Hall");
    await page.getByLabel("Seated capacity").fill("120");
    await page.getByLabel("Standing capacity").fill("200");
    await page.getByLabel("Description (optional)").fill(
      "A light-filled converted barn with original oak beams.",
    );
    await page.screenshot({ path: screenshotPath("spaces-add-form") });
    await page.getByRole("button", { name: "Add space" }).click();

    // Card appears in the list.
    await expect(page.getByText("The Main Hall")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("120 seated · 200 standing")).toBeVisible();
    await expect(
      page.getByText("A light-filled converted barn with original oak beams."),
    ).toBeVisible();
    await page.screenshot({ path: screenshotPath("spaces-created") });

    // Assert row is in the DB.
    const db = admin();
    const { data: created } = await db
      .from("spaces")
      .select("id, name, capacity_seated, capacity_standing, description")
      .eq("venue_id", venueId)
      .single();
    expect(created).not.toBeNull();
    expect(created!.name).toBe("The Main Hall");
    expect(created!.capacity_seated).toBe(120);
    expect(created!.capacity_standing).toBe(200);
    expect(created!.description).toBe(
      "A light-filled converted barn with original oak beams.",
    );
    const spaceId = created!.id;

    // Edit the space — open the edit form via the pencil icon.
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByText("Edit space")).toBeVisible();

    // Update the name and seated capacity; clear the description.
    await page.getByLabel("Space name").fill("The Garden Pavilion");
    await page.getByLabel("Seated capacity").fill("90");
    await page.getByLabel("Description (optional)").fill("");
    await page.screenshot({ path: screenshotPath("spaces-edit-form") });
    await page.getByRole("button", { name: "Save changes" }).click();

    // Updated card is visible.
    await expect(page.getByText("The Garden Pavilion")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("90 seated · 200 standing")).toBeVisible();
    // Description cleared — original text gone.
    await expect(
      page.getByText("A light-filled converted barn with original oak beams."),
    ).not.toBeVisible();
    await page.screenshot({ path: screenshotPath("spaces-updated") });

    // Assert update persisted to DB.
    const { data: updated } = await db
      .from("spaces")
      .select("name, capacity_seated, capacity_standing, description")
      .eq("id", spaceId)
      .single();
    expect(updated!.name).toBe("The Garden Pavilion");
    expect(updated!.capacity_seated).toBe(90);
    expect(updated!.description).toBeNull();

    // Delete the space — open confirm UI via trash icon.
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(
      page.getByText("This cannot be undone."),
    ).toBeVisible();
    await page.screenshot({ path: screenshotPath("spaces-delete-confirm") });
    await page.getByRole("button", { name: "Confirm delete" }).click();

    // Empty state returns.
    await expect(
      page.getByText("No spaces yet. Add your first one to get started."),
    ).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: screenshotPath("spaces-after-delete") });

    // Assert row gone from DB.
    const { data: gone } = await db
      .from("spaces")
      .select("id")
      .eq("id", spaceId)
      .maybeSingle();
    expect(gone).toBeNull();
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});
