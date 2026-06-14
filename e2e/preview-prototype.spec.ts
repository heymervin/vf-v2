/**
 * /preview prototype smoke test — the v2 combined-platform showcase.
 *
 * No auth / no Supabase: every /preview route and the couple /portal render
 * from the in-memory mock layer (src/lib/mock). This spec asserts each surface
 * loads with its seeded content, and that core navigation between them works.
 *
 * Run: pnpm exec playwright test e2e/preview-prototype.spec.ts
 */

import { test, expect } from "@playwright/test";

const ROUTES: { path: string; expect: string[] }[] = [
  { path: "/preview", expect: ["The whole wedding, one platform", "Unified Inbox", "AI Copilot"] },
  { path: "/preview/inbox", expect: ["Henderson", "WhatsApp"] },
  { path: "/preview/pipeline", expect: ["Inbound enquiry", "Wedding booked"] },
  { path: "/preview/contacts", expect: ["Henderson", "Carter"] },
  { path: "/preview/contacts/c1", expect: ["Henderson"] },
  { path: "/preview/money", expect: ["Booking deposit"] },
  { path: "/preview/weddings", expect: ["Henderson & Carter"] },
  { path: "/preview/weddings/w1", expect: ["days to go", "The Long Barn"] },
  { path: "/preview/runsheet", expect: ["Ceremony"] },
  { path: "/preview/floorplan", expect: ["Table", "Seating"] },
  { path: "/preview/guests", expect: ["RSVP"] },
  { path: "/preview/menu", expect: ["Sticky toffee"] },
  { path: "/preview/suppliers", expect: ["Florist"] },
  { path: "/preview/copilot", expect: ["Copilot"] },
  { path: "/preview/reports", expect: ["Conversion rate", "Source ROI"] },
  { path: "/portal", expect: ["The Old Barn", "Pay"] },
];

for (const route of ROUTES) {
  test(`renders ${route.path}`, async ({ page }) => {
    const res = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(res?.status(), `${route.path} HTTP status`).toBeLessThan(400);
    for (const text of route.expect) {
      await expect(page.locator("body"), `${route.path} should contain "${text}"`).toContainText(
        text,
      );
    }
  });
}

test("sidebar navigates between modules", async ({ page }) => {
  await page.goto("/preview");
  await page.getByRole("link", { name: "Unified Inbox" }).first().click();
  await expect(page).toHaveURL(/\/preview\/inbox/);
  await page.getByRole("link", { name: "Weddings" }).first().click();
  await expect(page).toHaveURL(/\/preview\/weddings/);
});

test("wedding card opens the workspace", async ({ page }) => {
  await page.goto("/preview/weddings");
  await page.getByRole("link", { name: /Henderson/ }).first().click();
  await expect(page).toHaveURL(/\/preview\/weddings\/w1/);
  await expect(page.locator("body")).toContainText("days to go");
});
