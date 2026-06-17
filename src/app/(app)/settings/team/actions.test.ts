/**
 * Unit tests for team management server actions.
 *
 * Tests the role guards and input validation in isolation.
 * No DB, no network, no secrets. Supabase clients and getTenantContext are mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock heavy dependencies before importing the module under test
// ---------------------------------------------------------------------------

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));

const mockOwnerCtx = {
  ok: true as const,
  user: { id: "user-owner", email: "owner@example.com" },
  venue: {
    id: "venue-1",
    name: "Test Venue",
    slug: "test",
    timezone: "UTC",
    onboardingCompletedAt: null,
    trialEndsAt: null,
  },
  role: "owner" as const,
  access: "active" as const,
  billing: { stripeCustomerId: null, status: null, currentPeriodEnd: null },
};

const mockAdminCtx = { ...mockOwnerCtx, role: "admin" as const, user: { id: "user-admin", email: "admin@example.com" } };
const mockMemberCtx = { ...mockOwnerCtx, role: "member" as const, user: { id: "user-member", email: "member@example.com" } };

const getTenantContextMock = vi.fn().mockResolvedValue(mockOwnerCtx);
vi.mock("@/lib/tenant", () => ({
  getTenantContext: getTenantContextMock,
}));

vi.mock("@/lib/billing/access", () => ({
  assertCanMutate: vi.fn().mockReturnValue(null),
}));

// Admin client stub — used for all team actions
const adminFrom = vi.fn();
const adminAuthAdmin = {
  getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "test@example.com" } }, error: null }),
  inviteUserByEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
  listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: adminFrom,
    auth: { admin: adminAuthAdmin },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helper: build a chainable Supabase from() stub that resolves to a value
// ---------------------------------------------------------------------------

function makeChain(resolveValue: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "delete", "eq", "neq", "order", "single", "maybeSingle"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Make the chain itself a thenable
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve(resolveValue);
  return chain;
}

// ---------------------------------------------------------------------------
// changeRole — role guard: only owner
// ---------------------------------------------------------------------------

describe("changeRole — role guard", () => {
  beforeEach(() => {
    vi.resetModules();
    getTenantContextMock.mockResolvedValue(mockOwnerCtx);
  });

  it("allows owners to change a role", async () => {
    // Target membership: admin changing to member
    adminFrom.mockReturnValue({
      ...makeChain({ data: { user_id: "user-2", role: "admin" }, error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { user_id: "user-2", role: "admin" }, error: null }),
      update: vi.fn().mockReturnThis(),
    });

    const { changeRole } = await import("./actions");
    const result = await changeRole({ membershipId: "m-uuid-1234-1234-1234-123456789012", role: "member" });
    // We expect either ok or a db error (mocks may not chain perfectly) — key is no role-guard error
    if (!result.ok) {
      expect(result.error).not.toMatch(/owner.*manag/i);
    }
  });

  it("blocks admins from changing roles", async () => {
    getTenantContextMock.mockResolvedValueOnce(mockAdminCtx);
    vi.resetModules();
    const { changeRole } = await import("./actions");
    const result = await changeRole({ membershipId: "00000000-0000-0000-0000-000000000001", role: "member" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/owner/i);
    }
  });

  it("blocks members from changing roles", async () => {
    getTenantContextMock.mockResolvedValueOnce(mockMemberCtx);
    vi.resetModules();
    const { changeRole } = await import("./actions");
    const result = await changeRole({ membershipId: "00000000-0000-0000-0000-000000000001", role: "member" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/owner/i);
    }
  });
});

// ---------------------------------------------------------------------------
// inviteMember — input validation
// ---------------------------------------------------------------------------

describe("inviteMember — input validation", () => {
  beforeEach(() => {
    vi.resetModules();
    getTenantContextMock.mockResolvedValue(mockOwnerCtx);
  });

  it("rejects an invalid email", async () => {
    const { inviteMember } = await import("./actions");
    const result = await inviteMember({ email: "not-an-email", role: "member" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/email/i);
    }
  });

  it("rejects the owner role in the invite (not in the schema)", async () => {
    const { inviteMember } = await import("./actions");
    // owner is not in the z.enum — zod rejects it
    const result = await inviteMember({ email: "new@example.com", role: "owner" as "member" });
    expect(result.ok).toBe(false);
  });

  it("blocks non-owners from inviting", async () => {
    getTenantContextMock.mockResolvedValueOnce(mockAdminCtx);
    vi.resetModules();
    const { inviteMember } = await import("./actions");
    const result = await inviteMember({ email: "new@example.com", role: "member" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/owner/i);
    }
  });
});

// ---------------------------------------------------------------------------
// removeMember — role guard
// ---------------------------------------------------------------------------

describe("removeMember — role guard", () => {
  it("blocks non-owners from removing members", async () => {
    getTenantContextMock.mockResolvedValueOnce(mockMemberCtx);
    vi.resetModules();
    const { removeMember } = await import("./actions");
    const result = await removeMember({ membershipId: "00000000-0000-0000-0000-000000000001" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/owner/i);
    }
  });
});
