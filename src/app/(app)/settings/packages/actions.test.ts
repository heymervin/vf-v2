/**
 * Unit tests for packages/actions.ts
 *
 * All tests are DB-free and secret-free:
 *   - server-only is mocked to a no-op
 *   - @/lib/tenant is mocked to return a fixed owner context
 *   - @/lib/supabase/server is mocked with per-test configurable responses
 *   - @/lib/billing/access is mocked to allow mutations
 *   - next/cache revalidatePath is mocked to a no-op
 *
 * Only logic the actions own is tested:
 *   - minor/major unit conversion helpers
 *   - role guard (non-owner/admin gets rejected)
 *   - zod validation (bad input gets rejected with a meaningful message)
 *   - success path: correct payload passed to supabase insert/update
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── mocks (declared before imports that trigger module load) ─────────────────

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Configurable tenant context — default: owner context, can be overridden per test
let mockTenantCtx: Record<string, unknown> = {
  ok: true,
  user: { id: "user-1", email: "owner@example.com" },
  venue: { id: "venue-uuid-1234", name: "Test Venue", slug: "test-venue", timezone: "Europe/London", onboardingCompletedAt: null, trialEndsAt: null },
  role: "owner",
  access: "trialing",
  billing: { stripeCustomerId: null, status: null, currentPeriodEnd: null },
};

vi.mock("@/lib/tenant", () => ({
  getTenantContext: async () => mockTenantCtx,
}));

vi.mock("@/lib/billing/access", () => ({
  assertCanMutate: () => null, // allow mutations by default
}));

// Configurable supabase mock — captures what was inserted/updated
let mockInsertResult: { data: Record<string, unknown> | null; error: { message: string } | null } =
  { data: null, error: null };
let mockUpdateResult: { error: { message: string } | null } = { error: null };
let mockSelectResult: { data: Record<string, unknown>[] | null; error: { message: string } | null } =
  { data: [], error: null };
let mockMaybeSingleResult: { data: Record<string, unknown> | null; error: { message: string } | null } =
  { data: null, error: null };

// Records the last insert payload so tests can assert on it
let lastInsertPayload: unknown = null;
let lastUpdatePayload: unknown = null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          in: (_col2: string, _vals: string[]) => ({
            order: () => mockSelectResult,
          }),
          order: (_col3: string, _opts?: unknown) => ({
            order: (_col4: string, _opts2?: unknown) => mockSelectResult,
          }),
          maybeSingle: async () => mockMaybeSingleResult,
        }),
        order: (_col: string, _opts?: unknown) => ({
          order: (_col2: string, _opts2?: unknown) => mockSelectResult,
        }),
      }),
      insert: (payload: unknown) => {
        lastInsertPayload = payload;
        return {
          select: () => ({
            single: async () => mockInsertResult,
          }),
        };
      },
      update: (payload: unknown) => {
        lastUpdatePayload = payload;
        return {
          eq: (_col: string, _val: string) => ({
            eq: (_col2: string, _val2: string) => ({
              select: () => ({
                single: async () => mockInsertResult,
              }),
              ...mockUpdateResult,
              // Expose error for the final .eq chain
              then: undefined,
            }),
            // direct awaitable for the update path (no .select)
            error: mockUpdateResult.error,
          }),
        };
      },
    }),
  }),
}));

// ── import under test (after mocks) ─────────────────────────────────────────

import {
  createPackage,
  updatePackage,
  togglePackageActive,
  createPackageLine,
  updatePackageLine,
} from "./actions";
import { minorToMajor, majorStringToMinor } from "./money";

// ── Helper: reset mocks before each test ─────────────────────────────────────

beforeEach(() => {
  mockTenantCtx = {
    ok: true,
    user: { id: "user-1", email: "owner@example.com" },
    venue: { id: "venue-uuid-1234", name: "Test Venue", slug: "test-venue", timezone: "Europe/London", onboardingCompletedAt: null, trialEndsAt: null },
    role: "owner",
    access: "trialing",
    billing: { stripeCustomerId: null, status: null, currentPeriodEnd: null },
  };
  mockInsertResult = {
    data: { id: "pkg-id-abc", name: "Summer Package", season: "Summer", description: "", from_price_minor: 500000, is_active: true, venue_id: "venue-uuid-1234", sort_order: 0, created_at: "", updated_at: "" },
    error: null,
  };
  mockUpdateResult = { error: null };
  mockSelectResult = { data: [], error: null };
  mockMaybeSingleResult = { data: { id: "pkg-id-abc" }, error: null };
  lastInsertPayload = null;
  lastUpdatePayload = null;
});

// ── Money conversion ──────────────────────────────────────────────────────────

describe("minorToMajor", () => {
  it("converts pence to pounds", () => {
    expect(minorToMajor(500000)).toBe(5000);
    expect(minorToMajor(199)).toBe(1.99);
    expect(minorToMajor(0)).toBe(0);
  });

  it("treats null as zero", () => {
    expect(minorToMajor(null)).toBe(0);
  });
});

describe("majorStringToMinor", () => {
  it("converts pound string to pence", () => {
    expect(majorStringToMinor("5000")).toBe(500000);
    expect(majorStringToMinor("1.99")).toBe(199);
    expect(majorStringToMinor("0")).toBe(0);
  });

  it("treats empty/invalid string as zero", () => {
    expect(majorStringToMinor("")).toBe(0);
    expect(majorStringToMinor("abc")).toBe(0);
    expect(majorStringToMinor("-10")).toBe(0);
  });

  it("rounds half-pence correctly", () => {
    // £1.995 → 199.5 pence → rounds to 200
    expect(majorStringToMinor("1.995")).toBe(200);
  });
});

// ── Auth / role guard ─────────────────────────────────────────────────────────

describe("createPackage — auth guards", () => {
  it("returns err when not authenticated", async () => {
    mockTenantCtx = { ok: false, reason: "unauthenticated" };
    const result = await createPackage({ name: "Pkg", season: "Summer", description: "", fromPricePounds: "1000" });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/not authenticated/i);
  });

  it("returns err when role is member", async () => {
    mockTenantCtx = { ...mockTenantCtx, role: "member" };
    const result = await createPackage({ name: "Pkg", season: "Summer", description: "", fromPricePounds: "1000" });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/owner|admin/i);
  });
});

// ── Zod validation ────────────────────────────────────────────────────────────

describe("createPackage — validation", () => {
  it("rejects empty name", async () => {
    const result = await createPackage({ name: "", season: "Summer", description: "", fromPricePounds: "1000" });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/name/i);
  });

  it("rejects invalid season", async () => {
    const result = await createPackage({
      name: "Pkg",
      // @ts-expect-error intentionally bad value
      season: "Monsoon",
      description: "",
      fromPricePounds: "1000",
    });
    expect(result.ok).toBe(false);
  });
});

describe("createPackageLine — validation", () => {
  it("rejects empty label", async () => {
    const result = await createPackageLine({
      packageId: "550e8400-e29b-41d4-a716-446655440000",
      label: "",
      unitPounds: "100",
      unitType: "flat",
      qtyTiedToGuests: false,
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/label/i);
  });

  it("rejects invalid unit_type", async () => {
    const result = await createPackageLine({
      packageId: "550e8400-e29b-41d4-a716-446655440000",
      label: "Drinks",
      unitPounds: "100",
      // @ts-expect-error intentionally bad value
      unitType: "per_decade",
      qtyTiedToGuests: false,
    });
    expect(result.ok).toBe(false);
  });
});

// ── Success paths — payload assertions ───────────────────────────────────────

describe("createPackage — success path", () => {
  it("converts pounds to minor units in insert payload", async () => {
    const result = await createPackage({
      name: "Summer Delight",
      season: "Summer",
      description: "A lovely summer package",
      fromPricePounds: "5000",
    });
    expect(result.ok).toBe(true);
    const payload = lastInsertPayload as Record<string, unknown>;
    expect(payload.from_price_minor).toBe(500000);
    expect(payload.name).toBe("Summer Delight");
    expect(payload.venue_id).toBe("venue-uuid-1234");
    expect(payload.is_active).toBe(true);
  });
});

describe("updatePackage — auth guard", () => {
  it("returns err when role is member", async () => {
    mockTenantCtx = { ...mockTenantCtx, role: "member" };
    const result = await updatePackage({
      packageId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Pkg",
      season: "Summer",
      description: "",
      fromPricePounds: "1000",
    });
    expect(result.ok).toBe(false);
  });
});

describe("togglePackageActive", () => {
  it("returns err when not authenticated", async () => {
    mockTenantCtx = { ok: false, reason: "unauthenticated" };
    const result = await togglePackageActive({
      packageId: "550e8400-e29b-41d4-a716-446655440000",
      isActive: false,
    });
    expect(result.ok).toBe(false);
  });

  it("returns err when role is member", async () => {
    mockTenantCtx = { ...mockTenantCtx, role: "member" };
    const result = await togglePackageActive({
      packageId: "550e8400-e29b-41d4-a716-446655440000",
      isActive: false,
    });
    expect(result.ok).toBe(false);
  });
});

describe("updatePackageLine — validation", () => {
  it("rejects non-uuid lineId", async () => {
    const result = await updatePackageLine({
      lineId: "not-a-uuid",
      label: "Drinks",
      unitPounds: "100",
      unitType: "per_head",
      qtyTiedToGuests: true,
    });
    expect(result.ok).toBe(false);
  });
});
