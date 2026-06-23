import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import * as path from "path";
import * as fs from "fs";

/**
 * Couple Portal (Slice 8) — magic-link auth + real Supabase data + couple writes.
 *
 * Roadmap testable row: a couple lands in their portal, sees their wedding,
 * edits their guest list, and RLS proves they cannot see any other wedding.
 *
 * Magic-link OTP is impractical in CI, so the couple's auth.users row is created
 * with a password and the session is established programmatically via the SAME
 * @supabase/ssr cookie flow the app uses — the resulting cookies are injected
 * into the browser context so /portal loads authenticated. couple_accounts.user_id
 * is set to that auth user and status='active', exactly as the magic-link callback
 * would leave it.
 */

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Cookie helper — sign a couple in via the real @supabase/ssr flow and capture
// the exact auth cookies, so we can inject them into the Playwright context.
// ---------------------------------------------------------------------------

interface SsrCookie {
  name: string;
  value: string;
}

async function signInAsCouple(
  email: string,
  password: string,
): Promise<SsrCookie[]> {
  const jar = new Map<string, string>();
  const supabase = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() {
        return [...jar.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) jar.set(name, value);
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`couple sign-in failed: ${error.message}`);

  return [...jar.entries()].map(([name, value]) => ({ name, value }));
}

// ---------------------------------------------------------------------------
// Seed: a venue + wedding + active couple account (auth user) + a guest + a
// couple-visible task. Returns ids + the couple's sign-in credentials.
// ---------------------------------------------------------------------------

interface Seeded {
  venueId: string;
  weddingId: string;
  coupleAccountId: string;
  authUserId: string;
  email: string;
  password: string;
  // A second, UNRELATED venue/wedding for the RLS isolation proof.
  otherVenueId: string;
  otherWeddingId: string;
}

async function seedCouple(suffix: string): Promise<Seeded> {
  const db = admin();

  const { data: venue, error: vErr } = await db
    .from("venues")
    .insert({
      name: `Portal Venue ${suffix}`,
      slug: `portal-venue-${suffix}`,
      timezone: "Europe/London",
      onboarding_step: 3,
      onboarding_completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (vErr || !venue) throw new Error(`seed venue: ${vErr?.message}`);

  const { data: wedding, error: wErr } = await db
    .from("weddings")
    .insert({
      venue_id: venue.id,
      couple_names: `Emma Henderson & James Carter ${suffix}`,
      wedding_date: "2027-09-18",
      contract_status: "signed",
      guest_count_day: 80,
      total_value_minor: 1_500_000,
      source: "manual",
      status: "planning",
    })
    .select("id")
    .single();
  if (wErr || !wedding) throw new Error(`seed wedding: ${wErr?.message}`);

  // Auth user for the couple (password set so CI can sign in deterministically).
  const email = `couple-portal+${suffix}@venueflow.io`;
  const password = `Test${Math.random().toString(36).slice(2, 10)}Aa1!`;
  const { data: userRes, error: uErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { couple_account_id: null },
  });
  if (uErr || !userRes.user) throw new Error(`seed auth user: ${uErr?.message}`);
  const authUserId = userRes.user.id;

  // couple_accounts row — active + linked to the auth user (post-magic-link state).
  const { data: account, error: aErr } = await db
    .from("couple_accounts")
    .insert({
      venue_id: venue.id,
      wedding_id: wedding.id,
      email,
      first_name: "Emma",
      role: "partner_a",
      status: "active",
      user_id: authUserId,
      activated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (aErr || !account) throw new Error(`seed couple account: ${aErr?.message}`);

  // A seeded guest the couple should see on the Guests tab.
  const { error: gErr } = await db.from("wedding_guests").insert({
    venue_id: venue.id,
    wedding_id: wedding.id,
    name: `Aunt Margaret ${suffix}`,
    rsvp: "yes",
    dietary: [],
    plus_one: false,
    side: "partner1",
  });
  if (gErr) throw new Error(`seed guest: ${gErr.message}`);

  // A couple-visible task (visible_to_couple = true).
  const { error: tErr } = await db.from("wedding_tasks").insert({
    venue_id: venue.id,
    wedding_id: wedding.id,
    title: `Confirm final guest numbers ${suffix}`,
    category: "planning",
    done: false,
    visible_to_couple: true,
  });
  if (tErr) throw new Error(`seed task: ${tErr.message}`);

  // A SECOND, unrelated venue + wedding the couple must never be able to read.
  const { data: otherVenue, error: ovErr } = await db
    .from("venues")
    .insert({
      name: `Other Venue ${suffix}`,
      slug: `other-venue-${suffix}`,
      timezone: "Europe/London",
      onboarding_step: 3,
      onboarding_completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (ovErr || !otherVenue) throw new Error(`seed other venue: ${ovErr?.message}`);

  const { data: otherWedding, error: owErr } = await db
    .from("weddings")
    .insert({
      venue_id: otherVenue.id,
      couple_names: `Secret Couple ${suffix}`,
      wedding_date: "2027-12-31",
      source: "manual",
      status: "planning",
    })
    .select("id")
    .single();
  if (owErr || !otherWedding) throw new Error(`seed other wedding: ${owErr?.message}`);

  return {
    venueId: venue.id,
    weddingId: wedding.id,
    coupleAccountId: account.id,
    authUserId,
    email,
    password,
    otherVenueId: otherVenue.id,
    otherWeddingId: otherWedding.id,
  };
}

async function cleanup(seed: Seeded) {
  const db = admin();
  // couple_accounts → wedding_guests → wedding_tasks cascade with the wedding,
  // but delete explicitly to be safe across FK orderings.
  await db.from("couple_accounts").delete().eq("venue_id", seed.venueId);
  await db.from("wedding_guests").delete().eq("venue_id", seed.venueId);
  await db.from("wedding_tasks").delete().eq("venue_id", seed.venueId);
  await db.from("weddings").delete().eq("venue_id", seed.venueId);
  await db.from("venues").delete().eq("id", seed.venueId);
  await db.from("weddings").delete().eq("venue_id", seed.otherVenueId);
  await db.from("venues").delete().eq("id", seed.otherVenueId);
  await db.auth.admin.deleteUser(seed.authUserId);
}

// ---------------------------------------------------------------------------
// Test 1 — unauthenticated /portal redirects to /portal/login
// ---------------------------------------------------------------------------

test("portal: unauthenticated access redirects to /portal/login", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000);
  await page.goto("/portal");
  await page.waitForURL("**/portal/login", { timeout: 10_000 });
  await expect(
    page.getByRole("button", { name: /sign-in link/i }),
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2 — full couple flow: lands in portal, sees wedding + guest, adds a
// guest that persists, and RLS proves no cross-wedding access.
// ---------------------------------------------------------------------------

test("portal: couple sees their wedding, sees + adds a guest, RLS blocks other weddings", async ({
  page,
  context,
}) => {
  page.setDefaultTimeout(20_000);
  const suffix = Date.now().toString(36);
  let seed: Seeded | null = null;

  try {
    seed = await seedCouple(suffix);

    // ── Establish the couple session (cookie injection) ───────────────────
    const cookies = await signInAsCouple(seed.email, seed.password);
    // Use the Playwright baseURL host for the cookie domain.
    const baseHost = new URL(
      (test.info().project.use.baseURL as string) ?? "http://localhost:3103",
    ).hostname;
    await context.addCookies(
      cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: baseHost,
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      })),
    );

    // ── Land in the portal ────────────────────────────────────────────────
    await page.goto("/portal");

    // The wedding identity: partner first names in the hero greeting.
    await expect(
      page.getByRole("heading", { name: /Hi Emma & James/i }),
    ).toBeVisible({ timeout: 15_000 });

    // The wedding date (formatted "18 September 2027").
    await expect(page.getByText("18 September 2027")).toBeVisible();

    // ── Guests tab shows the seeded guest ─────────────────────────────────
    await page.getByRole("tab", { name: /Guests/i }).click();
    await expect(
      page.getByText(`Aunt Margaret ${suffix}`),
    ).toBeVisible({ timeout: 10_000 });

    // ── Couple ADDS a guest; it persists ──────────────────────────────────
    const newGuestName = `Cousin Theo ${suffix}`;
    await page.getByRole("button", { name: /Add guest/i }).click();
    await page.getByLabel(/Full name/i).fill(newGuestName);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Add guest/i })
      .click();

    // Appears in the list optimistically + after the server action resolves.
    await expect(page.getByText(newGuestName)).toBeVisible({ timeout: 10_000 });

    // Persisted in the DB (service-role read).
    await expect
      .poll(
        async () => {
          const { data } = await admin()
            .from("wedding_guests")
            .select("name")
            .eq("wedding_id", seed!.weddingId)
            .eq("name", newGuestName);
          return data?.length ?? 0;
        },
        { timeout: 10_000 },
      )
      .toBe(1);

    // ── RLS PROOF: the couple's session cannot read another wedding ───────
    // Build an RLS-bound session client from the couple's tokens and query a
    // DIFFERENT venue's wedding — it must return zero rows.
    const sessionClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: signInErr } =
      await sessionClient.auth.signInWithPassword({
        email: seed.email,
        password: seed.password,
      });
    expect(signInErr).toBeNull();
    expect(signIn.session).not.toBeNull();

    const { data: otherRows, error: otherErr } = await sessionClient
      .from("weddings")
      .select("id")
      .eq("id", seed.otherWeddingId);
    expect(otherErr).toBeNull();
    expect(otherRows ?? []).toHaveLength(0);

    // And the couple CAN read their own wedding via the same session.
    const { data: ownRows } = await sessionClient
      .from("weddings")
      .select("id")
      .eq("id", seed.weddingId);
    expect(ownRows ?? []).toHaveLength(1);
  } finally {
    if (seed) await cleanup(seed);
  }
});
