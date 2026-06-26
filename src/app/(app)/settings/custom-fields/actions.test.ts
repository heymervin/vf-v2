/**
 * Unit tests for custom-fields server actions.
 *
 * Tests the business logic in isolation — no DB, no network, no secrets.
 * The Supabase clients and getTenantContext are mocked so this runs
 * in plain Node (vitest environment: node).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock heavy server-only dependencies before importing the module under test
// ---------------------------------------------------------------------------

// next/cache: revalidatePath is a no-op in tests
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// server-only: Next.js sentinel that throws when imported outside RSC
vi.mock("server-only", () => ({}));

// getTenantContext: returns a controllable owner context by default
const mockCtx = {
  ok: true as const,
  user: { id: "user-1", email: "owner@example.com" },
  venue: { id: "venue-1", name: "Test Venue", slug: "test", timezone: "UTC", onboardingCompletedAt: null, trialEndsAt: null, mode: "bundled" as const },
  venues: [{ id: "venue-1", name: "Test Venue" }],
  role: "owner" as const,
  access: "active" as const,
  billing: { stripeCustomerId: null, status: null, currentPeriodEnd: null },
};

vi.mock("@/lib/tenant", () => ({
  getTenantContext: vi.fn().mockResolvedValue(mockCtx),
}));

// assertCanMutate: returns null (no block) by default
vi.mock("@/lib/billing/access", () => ({
  assertCanMutate: vi.fn().mockReturnValue(null),
}));

// Supabase client mock — we build a chainable stub
const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockNeq = vi.fn();

// The from() stub returns an object; each method returns itself for chaining.
// Individual tests override .mockResolvedValue on terminal nodes.
function makeFromStub() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  // By default every terminal resolves with no data and no error
  Object.defineProperty(chain, "then", {
    get: () => {
      // Make the chain itself thenable so `await supabase.from(...).select()` works.
      // We need the last call in the chain to be awaitable.
      return (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
    },
  });
  return chain;
}

let fromStub: ReturnType<typeof makeFromStub>;

// Top-level mock — vitest hoists all vi.mock calls before tests run.
// The createClient implementation is overridden per-test via vi.resetModules()
// and re-importing; this default just needs to exist at module level.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    from: vi.fn().mockImplementation(() => fromStub),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers to re-import actions fresh per test (avoids module-level binding issues)
// ---------------------------------------------------------------------------

async function getActions() {
  // Clear module cache so mocks are re-applied cleanly
  const mod = await import("./actions");
  return mod;
}

// ---------------------------------------------------------------------------
// deriveKey helper — tests the slug derivation logic directly
// ---------------------------------------------------------------------------

import { deriveKey } from "./constants";

describe("deriveKey", () => {
  it("converts a label to a valid key slug", () => {
    expect(deriveKey("How did you hear about us?")).toBe("how_did_you_hear_about_us");
    expect(deriveKey("Budget Band")).toBe("budget_band");
    expect(deriveKey("  Preferred Space  ")).toBe("preferred_space");
  });

  it("strips non-alphanumeric characters except underscores", () => {
    expect(deriveKey("Partner's Name & Details")).toBe("partners_name_details");
  });
});

// ---------------------------------------------------------------------------
// createCustomField — cap enforcement
// ---------------------------------------------------------------------------

describe("createCustomField — cap enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromStub = makeFromStub();
  });

  it("returns an error when 12 active fields already exist", async () => {
    // Override the createClient mock to return 12 active fields on count query
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: Array.from({ length: 12 }, (_, i) => ({ id: `cf-${i}` })), error: null }),
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    vi.resetModules();
    const { createCustomField } = await import("./actions");

    const result = await createCustomField({
      label: "New Field",
      type: "text",
      options: [],
      applies_to: "contact",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/cap|12|limit/i);
    }
  });
});

// ---------------------------------------------------------------------------
// createCustomField — input validation
// ---------------------------------------------------------------------------

describe("createCustomField — input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromStub = makeFromStub();
  });

  it("returns an error when label is empty", async () => {
    vi.resetModules();
    const { createCustomField } = await import("./actions");

    const result = await createCustomField({
      label: "",
      type: "text",
      options: [],
      applies_to: "contact",
    });

    expect(result.ok).toBe(false);
  });

  it("returns an error for an invalid field type", async () => {
    vi.resetModules();
    const { createCustomField } = await import("./actions");

    const result = await createCustomField({
      label: "Valid Label",
      type: "unknown" as "text",
      options: [],
      applies_to: "contact",
    });

    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateCustomField — role guard
// ---------------------------------------------------------------------------

describe("updateCustomField — role guard", () => {
  it("returns an error when the user is a plain member", async () => {
    vi.resetModules();

    const { getTenantContext } = await import("@/lib/tenant");
    vi.mocked(getTenantContext).mockResolvedValueOnce({
      ...mockCtx,
      role: "member",
    });

    const { updateCustomField } = await import("./actions");

    const result = await updateCustomField({
      id: "cf-1",
      label: "Updated",
      type: "text",
      options: [],
      applies_to: "contact",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/owner|admin/i);
    }
  });
});
