import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  createSmokeUser,
  deleteSmokeUser,
  deleteVenuesForUser,
  createCompletedVenue, signIn } from "./setup-users";
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

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

// Minimal valid PDF bytes.
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

test("settings: upload brochure → active + proxy serves it; embed form submits", async ({
  page,
}) => {
  page.setDefaultTimeout(12_000);
  const random = Date.now().toString(36);
  const slug = `broch-${random}`;
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    const venueId = await createCompletedVenue(userId, slug);

    await signIn(page, user);

    // Upload a brochure.
    await page.goto("/settings/brochure");
    await expect(page.getByText("No brochure yet")).toBeVisible();
    await page.getByLabel("Title (optional)").fill("2027 Brochure");
    await page.locator('input[name="file"]').setInputFiles({
      name: "brochure.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
    await page.getByRole("button", { name: "Upload brochure" }).click();
    await expect(page.getByText("2027 Brochure")).toBeVisible({ timeout: 10_000 });

    // Proxy serves the PDF (follows 302 → signed URL → 200).
    const db = admin();
    const { data: brochure } = await db
      .from("brochures")
      .select("download_token")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .single();
    const res = await page.request.get(`/b/${brochure!.download_token}`);
    expect(res.ok()).toBeTruthy();

    // Open count incremented.
    const { data: after } = await db
      .from("brochures")
      .select("download_count")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .single();
    expect(after!.download_count).toBeGreaterThanOrEqual(1);

    // Embed form renders and submits (transparent variant).
    await page.goto(`/f/${slug}/embed`);
    await page.getByLabel("Your name", { exact: true }).fill("Sam");
    await page.getByLabel("Email", { exact: true }).fill(`sam+${random}@example.com`);
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByText("your brochure is on its way")).toBeVisible();
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});
