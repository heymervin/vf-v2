import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
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

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

test("public form: incognito submit creates contact + opportunity with UTM, dedupes", async ({
  page,
}) => {
  page.setDefaultTimeout(12_000);
  const random = Date.now().toString(36);
  const slug = `form-${random}`;
  const email = `couple+${random}@example.com`;
  let userId = "";

  try {
    const user = await createSmokeUser(random);
    userId = user.userId;
    const venueId = await createCompletedVenue(userId, slug);

    // Visit the public form with UTM params (no auth / no app chrome).
    await page.goto(`/f/${slug}?utm_source=instagram&utm_campaign=spring-open-day`);
    await expect(page.getByRole("button", { name: "Send enquiry" })).toBeVisible();

    await page.getByLabel("Your name", { exact: true }).fill("Jordan");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Approx. guests").fill("100");
    await page.getByRole("button", { name: "Send enquiry" }).click();

    await expect(
      page.getByText("your brochure is on its way"),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(__dirname, "../logs/data/screenshots/m3-public-form-success.png"),
    });

    // Verify the data landed (service role).
    const db = admin();
    const { data: contacts } = await db
      .from("contacts")
      .select("id, source")
      .eq("venue_id", venueId)
      .eq("email", email);
    expect(contacts?.length).toBe(1);
    expect(contacts![0].source).toBe("instagram");

    const { data: opps } = await db
      .from("opportunities")
      .select("stage")
      .eq("contact_id", contacts![0].id);
    expect(opps?.length).toBe(1);
    expect(opps![0].stage).toBe("inbound_enquiry");

    const { data: subs } = await db
      .from("form_submissions")
      .select("utm, contact_id")
      .eq("venue_id", venueId);
    expect(subs?.length).toBe(1);
    expect((subs![0].utm as { utm_campaign?: string })?.utm_campaign).toBe(
      "spring-open-day",
    );
    expect(subs![0].contact_id).toBe(contacts![0].id);

    // Dedupe: submit again with the same email.
    await page.goto(`/f/${slug}`);
    await page.getByLabel("Your name", { exact: true }).fill("Jordan");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByText("your brochure is on its way")).toBeVisible();

    const { data: contacts2 } = await db
      .from("contacts")
      .select("id")
      .eq("venue_id", venueId)
      .eq("email", email);
    expect(contacts2?.length).toBe(1); // still one contact
    const { data: subs2 } = await db
      .from("form_submissions")
      .select("id")
      .eq("venue_id", venueId);
    expect(subs2?.length).toBe(2); // two raw submissions
  } finally {
    if (userId) {
      await deleteVenuesForUser(userId);
      await deleteSmokeUser(userId);
    }
  }
});
