/**
 * Unit tests for payments/actions.ts
 *
 * Covers:
 *   - upsertMilestone: auth guards, zod validation, amount conversion, success insert
 *   - deleteMilestone: auth guard, success
 *   - updateMilestoneStatus: auth guard, success
 *   - sendGhlInvoice: no-ghl-connection degradation, createInvoice called with correct
 *     args (amount converted to major units), milestone updated with invoice id, send called
 *   - refreshGhlInvoiceStatus: status mapped correctly, no-ghl-connection degradation
 *
 * All tests are DB-free and secret-free:
 *   - "server-only" mocked to no-op
 *   - @/lib/tenant mocked
 *   - @/lib/billing/access mocked to allow mutations by default
 *   - @/lib/supabase/admin mocked with configurable responses
 *   - @/lib/ghl/client mocked
 *   - next/cache revalidatePath mocked to no-op
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── constants ─────────────────────────────────────────────────────────────────

const VENUE_ID = "venue-uuid-test";
const WEDDING_ID = "550e8400-e29b-41d4-a716-446655440001";
const MILESTONE_ID = "550e8400-e29b-41d4-a716-446655440002";
const GHL_CONTACT_ID = "ghl-contact-001";
const GHL_INVOICE_ID = "ghl-invoice-001";

// ── mutable mock state ────────────────────────────────────────────────────────

let mockTenantCtx: Record<string, unknown> = {
  ok: true,
  user: { id: "user-1", email: "owner@example.com" },
  venue: {
    id: VENUE_ID,
    name: "Test Venue",
    slug: "test-venue",
    timezone: "Europe/London",
    onboardingCompletedAt: null,
    trialEndsAt: null, mode: "bundled",
  },
  role: "owner",
  access: "trialing",
  billing: { stripeCustomerId: null, status: null, currentPeriodEnd: null },
};

// What assertWeddingBelongsToVenue returns (via admin.from("weddings"))
let mockWeddingRow: { id: string } | null = { id: WEDDING_ID };

// Insert / update / delete results
let mockInsertResult: { data: Record<string, unknown> | null; error: { message: string } | null } =
  { data: { id: MILESTONE_ID, venue_id: VENUE_ID, wedding_id: WEDDING_ID, label: "Deposit", amount_minor: 100000, due_date: "2026-01-01", status: "upcoming", ghl_invoice_id: null, proposal_id: null, sort_order: 0, paid_on: null, receipt_url: null, reminder_sent: false, reminder_sent_at: null, created_at: "", updated_at: "" }, error: null };
let mockUpdateError: { message: string } | null = null;
let mockDeleteError: { message: string } | null = null;
let lastInsertPayload: unknown = null;
let lastUpdatePayload: unknown = null;

// GHL client state
let mockGhlClientNull = false;
const createInvoiceSpy = vi.fn(async () => ({ id: GHL_INVOICE_ID, status: "sent", dueDate: "2026-01-01", total: 1000, currency: "GBP", contactId: GHL_CONTACT_ID }));
const sendInvoiceSpy = vi.fn(async () => undefined);
const getInvoiceSpy = vi.fn(async () => ({ id: GHL_INVOICE_ID, status: "paid", dueDate: "2026-01-01", total: 1000, currency: "GBP", contactId: GHL_CONTACT_ID }));

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/tenant", () => ({
  getTenantContext: async () => mockTenantCtx,
}));

vi.mock("@/lib/billing/access", () => ({
  assertCanMutate: () => null,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "weddings") {
        return {
          select: (_cols: string) => ({
            eq: (_c1: string, _v1: string) => ({
              eq: (_c2: string, _v2: string) => ({
                maybeSingle: async () => ({ data: mockWeddingRow, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "payment_milestones") {
        return {
          select: (_cols: string) => ({
            eq: (_c1: string, _v1: string) => ({
              eq: (_c2: string, _v2: string) => ({
                order: (_c3: string, _o1?: unknown) => ({
                  order: (_c4: string, _o2?: unknown) => ({
                    data: [],
                    error: null,
                  }),
                }),
              }),
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
              eq: (_c1: string, _v1: string) => ({
                eq: (_c2: string, _v2: string) => ({
                  eq: (_c3: string, _v3: string) => ({
                    select: () => ({
                      single: async () => mockInsertResult,
                    }),
                    // awaitable for plain update (no .select)
                    then: (resolve: (v: { error: { message: string } | null }) => unknown) =>
                      resolve({ error: mockUpdateError }),
                  }),
                  // awaitable (delete/update without 3rd eq)
                  then: (resolve: (v: { error: { message: string } | null }) => unknown) =>
                    resolve({ error: mockUpdateError }),
                }),
              }),
            };
          },
          delete: () => ({
            eq: (_c1: string, _v1: string) => ({
              eq: (_c2: string, _v2: string) => ({
                eq: (_c3: string, _v3: string) => ({
                  then: (resolve: (v: { error: { message: string } | null }) => unknown) =>
                    resolve({ error: mockDeleteError }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      };
    },
  }),
}));

vi.mock("@/lib/ghl/client", () => ({
  ghlClient: async (_venueId: string) => {
    if (mockGhlClientNull) return null;
    return {
      locationId: "loc-test",
      createInvoice: createInvoiceSpy,
      sendInvoice: sendInvoiceSpy,
      getInvoice: getInvoiceSpy,
    };
  },
  mapGhlInvoiceStatus: (status: string) => {
    if (status === "paid") return "paid-in-full";
    if (status === "sent") return "awaiting-deposit";
    return "unknown";
  },
}));

// ── imports under test ────────────────────────────────────────────────────────

import {
  upsertMilestone,
  deleteMilestone,
  updateMilestoneStatus,
  sendGhlInvoice,
  refreshGhlInvoiceStatus,
} from "./actions";

// ── reset before each ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockTenantCtx = {
    ok: true,
    user: { id: "user-1", email: "owner@example.com" },
    venue: {
      id: VENUE_ID,
      name: "Test Venue",
      slug: "test-venue",
      timezone: "Europe/London",
      onboardingCompletedAt: null,
      trialEndsAt: null, mode: "bundled",
    },
    role: "owner",
    access: "trialing",
    billing: { stripeCustomerId: null, status: null, currentPeriodEnd: null },
  };
  mockWeddingRow = { id: WEDDING_ID };
  mockInsertResult = {
    data: {
      id: MILESTONE_ID,
      venue_id: VENUE_ID,
      wedding_id: WEDDING_ID,
      label: "Deposit",
      amount_minor: 100000,
      due_date: "2026-01-01",
      status: "upcoming",
      ghl_invoice_id: null,
      proposal_id: null,
      sort_order: 0,
      paid_on: null,
      receipt_url: null,
      reminder_sent: false,
      reminder_sent_at: null,
      created_at: "",
      updated_at: "",
    },
    error: null,
  };
  mockUpdateError = null;
  mockDeleteError = null;
  mockGhlClientNull = false;
  lastInsertPayload = null;
  lastUpdatePayload = null;
  createInvoiceSpy.mockClear();
  sendInvoiceSpy.mockClear();
  getInvoiceSpy.mockClear();
  createInvoiceSpy.mockResolvedValue({
    id: GHL_INVOICE_ID,
    status: "sent",
    dueDate: "2026-01-01",
    total: 1000,
    currency: "GBP",
    contactId: GHL_CONTACT_ID,
  });
  sendInvoiceSpy.mockResolvedValue(undefined);
  getInvoiceSpy.mockResolvedValue({
    id: GHL_INVOICE_ID,
    status: "paid",
    dueDate: "2026-01-01",
    total: 1000,
    currency: "GBP",
    contactId: GHL_CONTACT_ID,
  });
});

// ── upsertMilestone ───────────────────────────────────────────────────────────

describe("upsertMilestone", () => {
  it("returns err when not authenticated", async () => {
    mockTenantCtx = { ok: false, reason: "unauthenticated" };
    const result = await upsertMilestone({
      weddingId: WEDDING_ID,
      label: "Deposit",
      amountPounds: "1000",
      dueDate: "2026-01-01",
      status: "upcoming",
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/not authenticated/i);
  });

  it("returns err for empty label", async () => {
    const result = await upsertMilestone({
      weddingId: WEDDING_ID,
      label: "",
      amountPounds: "1000",
      dueDate: "2026-01-01",
      status: "upcoming",
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/label/i);
  });

  it("returns err for invalid due date format", async () => {
    const result = await upsertMilestone({
      weddingId: WEDDING_ID,
      label: "Deposit",
      amountPounds: "1000",
      dueDate: "not-a-date",
      status: "upcoming",
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/date/i);
  });

  it("returns err when amount is zero", async () => {
    const result = await upsertMilestone({
      weddingId: WEDDING_ID,
      label: "Deposit",
      amountPounds: "0",
      dueDate: "2026-01-01",
      status: "upcoming",
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/greater than zero/i);
  });

  it("converts pounds to minor units in the insert payload", async () => {
    const result = await upsertMilestone({
      weddingId: WEDDING_ID,
      label: "Deposit",
      amountPounds: "1000.00",
      dueDate: "2026-01-01",
      status: "upcoming",
    });
    expect(result.ok).toBe(true);
    const payload = lastInsertPayload as Record<string, unknown>;
    expect(payload.amount_minor).toBe(100000);
    expect(payload.venue_id).toBe(VENUE_ID);
    expect(payload.wedding_id).toBe(WEDDING_ID);
    expect(payload.label).toBe("Deposit");
  });

  it("returns err when wedding not found", async () => {
    mockWeddingRow = null;
    const result = await upsertMilestone({
      weddingId: WEDDING_ID,
      label: "Deposit",
      amountPounds: "500",
      dueDate: "2026-01-01",
      status: "upcoming",
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/not found/i);
  });
});

// ── deleteMilestone ───────────────────────────────────────────────────────────

describe("deleteMilestone", () => {
  it("returns err when not authenticated", async () => {
    mockTenantCtx = { ok: false, reason: "unauthenticated" };
    const result = await deleteMilestone({ milestoneId: MILESTONE_ID, weddingId: WEDDING_ID });
    expect(result.ok).toBe(false);
  });

  it("returns ok on success", async () => {
    const result = await deleteMilestone({ milestoneId: MILESTONE_ID, weddingId: WEDDING_ID });
    expect(result.ok).toBe(true);
  });

  it("returns err for invalid UUIDs", async () => {
    const result = await deleteMilestone({ milestoneId: "not-a-uuid", weddingId: WEDDING_ID });
    expect(result.ok).toBe(false);
  });
});

// ── updateMilestoneStatus ─────────────────────────────────────────────────────

describe("updateMilestoneStatus", () => {
  it("returns err when not authenticated", async () => {
    mockTenantCtx = { ok: false, reason: "unauthenticated" };
    const result = await updateMilestoneStatus({
      milestoneId: MILESTONE_ID,
      weddingId: WEDDING_ID,
      status: "paid-in-full",
    });
    expect(result.ok).toBe(false);
  });

  it("returns ok for a valid status transition", async () => {
    const result = await updateMilestoneStatus({
      milestoneId: MILESTONE_ID,
      weddingId: WEDDING_ID,
      status: "paid",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an invalid status value", async () => {
    const result = await updateMilestoneStatus({
      milestoneId: MILESTONE_ID,
      weddingId: WEDDING_ID,
      status: "fully-paid-maybe" as "pending",
    });
    expect(result.ok).toBe(false);
  });
});

// ── sendGhlInvoice ────────────────────────────────────────────────────────────

describe("sendGhlInvoice", () => {
  const validInput = {
    milestoneId: MILESTONE_ID,
    weddingId: WEDDING_ID,
    ghlContactId: GHL_CONTACT_ID,
    invoiceName: "Deposit — Smith Wedding",
    amountMinor: 150000, // £1500
    dueDate: "2026-02-01",
  };

  it("returns err('no-ghl-connection') when venue has no GHL credentials", async () => {
    mockGhlClientNull = true;
    const result = await sendGhlInvoice(validInput);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe("no-ghl-connection");
  });

  it("calls createInvoice with amount in major units (£ not pence)", async () => {
    await sendGhlInvoice(validInput);
    expect(createInvoiceSpy).toHaveBeenCalledOnce();
    const calls = createInvoiceSpy.mock.calls as unknown as unknown[][];
    const payload = calls[0]?.[0] as { items: { price: number }[] };
    // 150000 pence → £1500
    expect(payload.items[0].price).toBe(1500);
  });

  it("passes the correct locationId, contactId, dueDate to createInvoice", async () => {
    await sendGhlInvoice(validInput);
    const calls = createInvoiceSpy.mock.calls as unknown as unknown[][];
    const payload = calls[0]?.[0] as Record<string, unknown>;
    expect(payload.locationId).toBe("loc-test");
    expect(payload.contactId).toBe(GHL_CONTACT_ID);
    expect(payload.dueDate).toBe("2026-02-01");
  });

  it("calls sendInvoice with the returned invoice id", async () => {
    await sendGhlInvoice(validInput);
    expect(sendInvoiceSpy).toHaveBeenCalledOnce();
    expect(sendInvoiceSpy).toHaveBeenCalledWith(GHL_INVOICE_ID);
  });

  it("returns the ghlInvoiceId and displayStatus on success", async () => {
    const result = await sendGhlInvoice(validInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ghlInvoiceId).toBe(GHL_INVOICE_ID);
      expect(result.data.displayStatus).toBe("awaiting-deposit");
    }
  });

  it("returns err when not authenticated", async () => {
    mockTenantCtx = { ok: false, reason: "unauthenticated" };
    const result = await sendGhlInvoice(validInput);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/not authenticated/i);
  });

  it("returns err when wedding not found", async () => {
    mockWeddingRow = null;
    const result = await sendGhlInvoice(validInput);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/not found/i);
  });
});

// ── refreshGhlInvoiceStatus ───────────────────────────────────────────────────

describe("refreshGhlInvoiceStatus", () => {
  const validInput = {
    milestoneId: MILESTONE_ID,
    weddingId: WEDDING_ID,
    ghlInvoiceId: GHL_INVOICE_ID,
  };

  it("returns err('no-ghl-connection') when no credentials", async () => {
    mockGhlClientNull = true;
    const result = await refreshGhlInvoiceStatus(validInput);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe("no-ghl-connection");
  });

  it("calls getInvoice with the correct invoice id", async () => {
    await refreshGhlInvoiceStatus(validInput);
    expect(getInvoiceSpy).toHaveBeenCalledWith(GHL_INVOICE_ID);
  });

  it("maps 'paid' GHL status to 'paid-in-full' display status", async () => {
    const result = await refreshGhlInvoiceStatus(validInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("paid-in-full");
    }
  });

  it("returns err for invalid input", async () => {
    const result = await refreshGhlInvoiceStatus({
      milestoneId: "not-a-uuid",
      weddingId: WEDDING_ID,
      ghlInvoiceId: GHL_INVOICE_ID,
    });
    expect(result.ok).toBe(false);
  });
});
