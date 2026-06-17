/**
 * Unit tests for src/app/(app)/settings/profile/actions.ts
 *
 * All tests are DB-free and secret-free:
 * - getTenantContext is mocked
 * - createClient (server Supabase) is mocked
 * - assertCanMutate is mocked to allow writes by default
 * - revalidatePath is mocked
 * - server-only is mocked to a no-op
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── mocks — declared before any import that triggers module load ─────────────

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Tenant context mock — default to an authenticated owner
let mockTenantCtx: Record<string, unknown> = {
  ok: true,
  user: { id: "user-1", email: "owner@venue.com" },
  venue: {
    id: "venue-uuid-1234",
    name: "The Old Barn",
    slug: "old-barn",
    timezone: "Europe/London",
    onboardingCompletedAt: null,
    trialEndsAt: null,
  },
  role: "owner",
  access: "trialing",
  billing: { stripeCustomerId: null, status: null, currentPeriodEnd: null },
};
vi.mock("@/lib/tenant", () => ({
  getTenantContext: () => Promise.resolve(mockTenantCtx),
}));

// assertCanMutate mock — allow by default, return error when access is "expired"
vi.mock("@/lib/billing/access", () => ({
  assertCanMutate: (ctx: { access: string }) => {
    if (ctx.access === "expired") {
      return { ok: false, error: "Trial expired." };
    }
    return null;
  },
}));

// Supabase client mock — wired per test via closures
let mockUpdateResult: { error: { message: string } | null } = { error: null };
let mockUpsertResult: { error: { message: string } | null } = { error: null };

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      from: (table: string) => ({
        update: (_data: unknown) => ({
          eq: (_col: string, _val: string) => {
            if (table === "venues") return Promise.resolve(mockUpdateResult);
            return Promise.resolve(mockUpsertResult);
          },
        }),
        upsert: (_data: unknown) => ({
          eq: () => Promise.resolve(mockUpsertResult),
        }),
      }),
    }),
}));

// ── module import (after mocks) ───────────────────────────────────────────────

import { updateVenueProfile, upsertVenueHours } from "./actions";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeValidProfile() {
  return {
    name: "The Old Barn",
    legalName: "Old Barn Events Ltd",
    tagline: "A restored barn in the Cotswolds",
    address: "Burford Road, Chipping Norton, OX7 3AB",
    phone: "+44 1451 000000",
    accentSeed: "pink" as const,
    timezone: "Europe/London",
  };
}

// ── updateVenueProfile ────────────────────────────────────────────────────────

describe("updateVenueProfile", () => {
  beforeEach(() => {
    mockTenantCtx = {
      ok: true,
      user: { id: "user-1", email: "owner@venue.com" },
      venue: {
        id: "venue-uuid-1234",
        name: "The Old Barn",
        slug: "old-barn",
        timezone: "Europe/London",
        onboardingCompletedAt: null,
        trialEndsAt: null,
      },
      role: "owner",
      access: "trialing",
      billing: { stripeCustomerId: null, status: null, currentPeriodEnd: null },
    };
    mockUpdateResult = { error: null };
  });

  it("returns ok when all valid fields are supplied", async () => {
    const result = await updateVenueProfile(makeValidProfile());
    expect(result.ok).toBe(true);
  });

  it("returns an error when unauthenticated", async () => {
    mockTenantCtx = { ok: false, reason: "unauthenticated" };
    const result = await updateVenueProfile(makeValidProfile());
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/authenticated/i);
  });

  it("returns an error when caller is a member (not owner/admin)", async () => {
    mockTenantCtx = { ...mockTenantCtx, role: "member" };
    const result = await updateVenueProfile(makeValidProfile());
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/owner|admin/i);
  });

  it("returns an error when billing is expired", async () => {
    mockTenantCtx = { ...mockTenantCtx, access: "expired" };
    const result = await updateVenueProfile(makeValidProfile());
    expect(result.ok).toBe(false);
  });

  it("returns an error when name is empty", async () => {
    const result = await updateVenueProfile({ ...makeValidProfile(), name: "" });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/name/i);
  });

  it("rejects an invalid accent_seed value", async () => {
    const result = await updateVenueProfile({
      ...makeValidProfile(),
      accentSeed: "crimson" as "pink",
    });
    expect(result.ok).toBe(false);
  });

  it("returns an error when the DB update fails", async () => {
    mockUpdateResult = { error: { message: "connection refused" } };
    const result = await updateVenueProfile(makeValidProfile());
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBeTruthy();
  });

  it("allows admin role to save", async () => {
    mockTenantCtx = { ...mockTenantCtx, role: "admin" };
    const result = await updateVenueProfile(makeValidProfile());
    expect(result.ok).toBe(true);
  });

  it("accepts null/empty optional fields", async () => {
    const result = await updateVenueProfile({
      ...makeValidProfile(),
      legalName: "",
      tagline: "",
      address: "",
      phone: "",
    });
    expect(result.ok).toBe(true);
  });
});

// ── upsertVenueHours ──────────────────────────────────────────────────────────

describe("upsertVenueHours", () => {
  const validHours = [
    { weekday: 0, openTime: "09:00", closeTime: "17:00", closed: false },
    { weekday: 1, openTime: "09:00", closeTime: "17:00", closed: false },
    { weekday: 2, openTime: "09:00", closeTime: "17:00", closed: false },
    { weekday: 3, openTime: "09:00", closeTime: "17:00", closed: false },
    { weekday: 4, openTime: "09:00", closeTime: "18:00", closed: false },
    { weekday: 5, openTime: "10:00", closeTime: "17:00", closed: false },
    { weekday: 6, openTime: null, closeTime: null, closed: true },
  ];

  beforeEach(() => {
    mockTenantCtx = {
      ok: true,
      user: { id: "user-1", email: "owner@venue.com" },
      venue: {
        id: "venue-uuid-1234",
        name: "The Old Barn",
        slug: "old-barn",
        timezone: "Europe/London",
        onboardingCompletedAt: null,
        trialEndsAt: null,
      },
      role: "owner",
      access: "trialing",
      billing: { stripeCustomerId: null, status: null, currentPeriodEnd: null },
    };
    mockUpsertResult = { error: null };
  });

  it("returns ok with 7 valid day entries", async () => {
    const result = await upsertVenueHours(validHours);
    expect(result.ok).toBe(true);
  });

  it("returns an error when unauthenticated", async () => {
    mockTenantCtx = { ok: false, reason: "unauthenticated" };
    const result = await upsertVenueHours(validHours);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/authenticated/i);
  });

  it("returns an error when caller is a member", async () => {
    mockTenantCtx = { ...mockTenantCtx, role: "member" };
    const result = await upsertVenueHours(validHours);
    expect(result.ok).toBe(false);
  });

  it("rejects if fewer than 7 entries are supplied", async () => {
    const result = await upsertVenueHours(validHours.slice(0, 5));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/7/);
  });

  it("rejects an invalid weekday number (> 6)", async () => {
    const bad = validHours.map((h, i) =>
      i === 0 ? { ...h, weekday: 7 } : h,
    );
    const result = await upsertVenueHours(bad);
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed time string", async () => {
    const bad = validHours.map((h, i) =>
      i === 0 ? { ...h, openTime: "9am", closed: false } : h,
    );
    const result = await upsertVenueHours(bad);
    expect(result.ok).toBe(false);
  });

  it("returns an error when the DB upsert fails", async () => {
    mockUpsertResult = { error: { message: "unique constraint" } };
    const result = await upsertVenueHours(validHours);
    expect(result.ok).toBe(false);
  });

  it("allows closed days with null times", async () => {
    // Sunday closed
    const result = await upsertVenueHours(validHours);
    expect(result.ok).toBe(true);
  });
});
