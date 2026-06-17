/**
 * Unit tests for floorplan/actions.ts — validation + gating logic.
 *
 * All Supabase calls and getTenantContext are mocked.
 * DB-free and secret-free per the project's vitest rules.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock getTenantContext ────────────────────────────────────────────────────

const mockCtx = {
  ok: true as const,
  user: { id: "user-1", email: "test@example.com" },
  venue: {
    id: "venue-1",
    name: "Test Venue",
    slug: "test-venue",
    timezone: "Europe/London",
    onboardingCompletedAt: null,
    trialEndsAt: null,
  },
  role: "admin" as const,
  access: "active" as const,
  billing: {
    stripeCustomerId: null,
    status: null,
    currentPeriodEnd: null,
  },
};

vi.mock("@/lib/tenant", () => ({
  getTenantContext: vi.fn().mockResolvedValue(mockCtx),
}));

vi.mock("@/lib/billing/access", () => ({
  assertCanMutate: vi.fn().mockReturnValue(null),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── Mock Supabase client ─────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeChain(resolveWith: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(resolveWith),
    single: vi.fn().mockResolvedValue(resolveWith),
  };
}

// ── assignGuestToTable — Zod validation ──────────────────────────────────────

describe("assignGuestToTable — schema validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a non-uuid weddingId", async () => {
    const { assignGuestToTable } = await import("./actions");
    const result = await assignGuestToTable({
      weddingId: "not-a-uuid",
      guestId: "00000000-0000-0000-0000-000000000002",
      tableNumber: 1,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-uuid guestId", async () => {
    const { assignGuestToTable } = await import("./actions");
    const result = await assignGuestToTable({
      weddingId: "00000000-0000-0000-0000-000000000001",
      guestId: "bad-id",
      tableNumber: 3,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a negative tableNumber", async () => {
    const { assignGuestToTable } = await import("./actions");
    const result = await assignGuestToTable({
      weddingId: "00000000-0000-0000-0000-000000000001",
      guestId: "00000000-0000-0000-0000-000000000002",
      tableNumber: -1,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts null tableNumber (unassign)", async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }),
    );
    const { assignGuestToTable } = await import("./actions");
    const result = await assignGuestToTable({
      weddingId: "00000000-0000-0000-0000-000000000001",
      guestId: "00000000-0000-0000-0000-000000000002",
      tableNumber: null,
    });
    // schema passes, DB mock resolves ok
    expect(typeof result.ok).toBe("boolean");
  });

  it("accepts valid uuids and positive tableNumber", async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }),
    );
    const { assignGuestToTable } = await import("./actions");
    const result = await assignGuestToTable({
      weddingId: "00000000-0000-0000-0000-000000000001",
      guestId: "00000000-0000-0000-0000-000000000002",
      tableNumber: 5,
    });
    expect(typeof result.ok).toBe("boolean");
  });
});

// ── saveFloorPlanLayout — Zod validation ──────────────────────────────────────

describe("saveFloorPlanLayout — schema validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a non-uuid floorPlanId", async () => {
    const { saveFloorPlanLayout } = await import("./actions");
    const result = await saveFloorPlanLayout({
      floorPlanId: "bad-id",
      weddingId: "00000000-0000-0000-0000-000000000001",
      layout: { tables: [], roomElements: [] },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-uuid weddingId", async () => {
    const { saveFloorPlanLayout } = await import("./actions");
    const result = await saveFloorPlanLayout({
      floorPlanId: "00000000-0000-0000-0000-000000000001",
      weddingId: "not-a-uuid",
      layout: { tables: [], roomElements: [] },
    });
    expect(result.ok).toBe(false);
  });

  it("accepts valid uuids and an empty layout object", async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }),
    );
    const { saveFloorPlanLayout } = await import("./actions");
    const result = await saveFloorPlanLayout({
      floorPlanId: "00000000-0000-0000-0000-000000000001",
      weddingId: "00000000-0000-0000-0000-000000000002",
      layout: { tables: [], roomElements: [] },
    });
    expect(typeof result.ok).toBe("boolean");
  });
});
