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

const SCREENSHOTS_DIR = path.join(__dirname, "../logs/data/screenshots");
const screenshotPath = (name: string) =>
  path.join(SCREENSHOTS_DIR, `${name}.png`);

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

test("team: invite appears in pending list → DB row exists → revoke removes it", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const random = Date.now().toString(36);
  const slug = `team-${random}`;
  let ownerUserId = "";

  try {
    // --- Setup: owner with a completed venue ---
    const owner = await createSmokeUser(random);
    ownerUserId = owner.userId;
    const venueId = await createCompletedVenue(ownerUserId, slug);

    // --- Sign in as owner ---
    await signIn(page, owner);

    // --- Navigate to team settings ---
    await page.goto("/settings/team");
    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();

    // Owner sees themselves in the members list
    await expect(page.getByText(owner.email)).toBeVisible();
    await expect(page.getByText("(you)")).toBeVisible();

    // Invite form is visible to owners
    await expect(
      page.getByRole("heading", { name: /Invite a teammate/i }),
    ).toBeVisible();

    await page.screenshot({ path: screenshotPath("team-settings-initial") });

    // --- Send an invite ---
    const inviteeEmail = `invitee+${random}@example.com`;
    await page.getByLabel("Email").fill(inviteeEmail);

    // Role selector defaults to Member — confirm it shows correctly
    await expect(page.locator("#invite-role")).toContainText("Member");

    await page.getByRole("button", { name: /Send invite/i }).click();

    // Toast: invite created (email send may or may not succeed in test env)
    await expect(
      page.getByText(/Invite (sent|created)/i),
    ).toBeVisible({ timeout: 10_000 });

    // Pending invites section appears
    await expect(
      page.getByRole("heading", { name: /Pending invites/i }),
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(inviteeEmail)).toBeVisible();
    await expect(page.getByText(/Invited as Member · awaiting acceptance/)).toBeVisible();

    await page.screenshot({ path: screenshotPath("team-settings-pending-invite") });

    // --- DB assertion: invitation row was created ---
    const db = admin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inviteRow } = await (db as any)
      .from("invitations")
      .select("id, email, role, token, accepted_at")
      .eq("venue_id", venueId)
      .eq("email", inviteeEmail)
      .is("accepted_at", null)
      .single();

    expect(inviteRow).not.toBeNull();
    expect(inviteRow!.role).toBe("member");
    expect(inviteRow!.accepted_at).toBeNull();

    const inviteToken: string = inviteRow!.token;

    // --- Accept-invite page: unauthenticated visitor sees sign-in prompt ---
    // Use a fresh browser context so there is no active session.
    const inviteUrl = `/accept-invite/${inviteToken}`;
    const anonContext = await page.context().browser()!.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(inviteUrl);
    await expect(
      anonPage.getByRole("heading", { name: /You've been invited to VenueFlow/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(anonPage.getByRole("link", { name: "Sign in" })).toBeVisible();
    await anonPage.screenshot({ path: screenshotPath("team-accept-invite-unauthenticated") });
    await anonContext.close();

    // --- Revoke the pending invite ---
    await page.getByRole("button", {
      name: `Revoke invite for ${inviteeEmail}`,
    }).click();

    await expect(page.getByText("Invite revoked.")).toBeVisible({ timeout: 8_000 });

    // Pending invites section disappears (no more pending invites)
    await expect(
      page.getByRole("heading", { name: /Pending invites/i }),
    ).not.toBeVisible({ timeout: 8_000 });

    await page.screenshot({ path: screenshotPath("team-settings-after-revoke") });

    // --- DB assertion: invitation row was deleted ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: afterRevoke } = await (db as any)
      .from("invitations")
      .select("id")
      .eq("venue_id", venueId)
      .eq("email", inviteeEmail)
      .is("accepted_at", null)
      .maybeSingle();

    expect(afterRevoke).toBeNull();
  } finally {
    if (ownerUserId) {
      await deleteVenuesForUser(ownerUserId);
      await deleteSmokeUser(ownerUserId);
    }
  }
});

test("team: accept invite → membership created in DB → redirects to dashboard", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  const random = `ti${Date.now().toString(36)}`;
  const slug = `team-ai-${random}`;
  let ownerUserId = "";
  let inviteeUserId = "";

  try {
    // --- Setup: owner + venue ---
    const owner = await createSmokeUser(`ow-${random}`);
    ownerUserId = owner.userId;
    const venueId = await createCompletedVenue(ownerUserId, slug);

    // --- Setup: invitee user (pre-created so we know their email) ---
    const invitee = await createSmokeUser(`inv-${random}`);
    inviteeUserId = invitee.userId;

    // --- Owner creates an invitation row directly via admin (bypasses email) ---
    const db = admin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inviteRow, error: insErr } = await (db as any)
      .from("invitations")
      .insert({
        venue_id: venueId,
        email: invitee.email,
        role: "member",
        invited_by: ownerUserId,
      })
      .select("token")
      .single();

    if (insErr || !inviteRow) {
      throw new Error(`Failed to seed invitation: ${insErr?.message}`);
    }
    const token: string = inviteRow.token;

    // --- Invitee signs in ---
    await page.goto("/login");
    await page.getByLabel("Email").fill(invitee.email);
    await page.getByLabel("Password").fill(invitee.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    // Invitee has no venue → lands on /onboarding. Navigate directly to invite URL.
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });

    const inviteUrl = `/accept-invite/${token}`;
    await page.goto(inviteUrl);

    // accept_invitation RPC runs server-side; on success it redirects to /dashboard
    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await page.screenshot({ path: screenshotPath("team-accept-invite-success") });

    // --- DB assertion: membership created for invitee ---
    const { data: membership } = await db
      .from("memberships")
      .select("id, role")
      .eq("venue_id", venueId)
      .eq("user_id", inviteeUserId)
      .single();

    expect(membership).not.toBeNull();
    expect(membership!.role).toBe("member");

    // --- DB assertion: invitation stamped as accepted ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: usedInvite } = await (db as any)
      .from("invitations")
      .select("accepted_at")
      .eq("token", token)
      .single();

    expect(usedInvite!.accepted_at).not.toBeNull();

    // --- Invitee now sees themselves on the team page ---
    await page.goto("/settings/team");
    await expect(page.getByText(invitee.email)).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: screenshotPath("team-settings-after-accept") });
  } finally {
    // Clean up invitee first (their membership cascades from venue delete, but
    // deleteVenuesForUser scopes to owner — delete invitee separately).
    if (inviteeUserId) await deleteSmokeUser(inviteeUserId);
    if (ownerUserId) {
      await deleteVenuesForUser(ownerUserId);
      await deleteSmokeUser(ownerUserId);
    }
  }
});
