/**
 * Unit tests for src/lib/weddings/create.ts
 *
 * Covers:
 *   - createWeddingFromOpportunity inserts a weddings row (source=ghl_webhook)
 *     and a couple_accounts row (status=invited).
 *   - createWeddingManual inserts a weddings row (source=manual) and
 *     a couple_accounts row (status=invited).
 *   - Idempotency: if a wedding row already exists for a given
 *     ghl_opportunity_id, createWeddingFromOpportunity returns the existing
 *     id without inserting a duplicate.
 *
 * All tests are DB-free and secret-free:
 *   - "server-only" is mocked to a no-op.
 *   - @/lib/supabase/admin is mocked with a stateful chainable builder so
 *     we can assert the exact shape of each insert call.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── constants ──────────────────────────────────────────────────────────────────

const FAKE_VENUE_ID = "venue-uuid-0001";
const FAKE_OPP_ID = "opp-ghl-0001";
const FAKE_CONTACT_ID = "contact-ghl-0001";
const FAKE_WEDDING_ID = "wedding-uuid-generated";
const FAKE_EXISTING_WEDDING_ID = "wedding-uuid-existing";

// ── mock state ─────────────────────────────────────────────────────────────────

/**
 * Controls what the idempotency check (maybeSingle on ghl_opportunity_id)
 * returns. Set to a row to simulate an existing wedding; null to simulate none.
 */
let existingWeddingRow: { id: string } | null = null;

/** Captures every `.insert()` call for assertion. */
const insertCalls: Array<{ table: string; payload: unknown }> = [];

/** Controls what `.insert().select().single()` returns for weddings. */
let weddingInsertResult: { data: { id: string } | null; error: { message: string } | null } = {
  data: { id: FAKE_WEDDING_ID },
  error: null,
};

/** Controls what `.insert()` returns for couple_accounts (no .single needed). */
let coupleInsertError: { message: string } | null = null;

// ── mocks ──────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    return {
      from: (table: string) => {
        // For the idempotency check on weddings (maybeSingle)
        if (table === "weddings") {
          return {
            // idempotency check path: .select().eq().eq().maybeSingle()
            select: (_cols: string) => ({
              eq: (_col: string, _val: unknown) => ({
                eq: (_col2: string, _val2: unknown) => ({
                  maybeSingle: async () => ({
                    data: existingWeddingRow,
                    error: null,
                  }),
                }),
              }),
            }),
            // insert path: .insert().select().single()
            insert: (payload: unknown) => {
              insertCalls.push({ table, payload });
              return {
                select: (_cols: string) => ({
                  single: async () => weddingInsertResult,
                }),
              };
            },
          };
        }

        // couple_accounts: .insert() only (no select chained)
        if (table === "couple_accounts") {
          return {
            insert: (payload: unknown) => {
              insertCalls.push({ table, payload });
              return Promise.resolve({ data: null, error: coupleInsertError });
            },
          };
        }

        // Fallback for any unexpected table
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
          insert: (payload: unknown) => {
            insertCalls.push({ table, payload });
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    };
  },
}));

// ── module import (after mocks) ───────────────────────────────────────────────

let createWeddingFromOpportunity: (typeof import("./create"))["createWeddingFromOpportunity"];
let createWeddingManual: (typeof import("./create"))["createWeddingManual"];

beforeEach(async () => {
  // Reset state before each test.
  existingWeddingRow = null;
  insertCalls.length = 0;
  weddingInsertResult = { data: { id: FAKE_WEDDING_ID }, error: null };
  coupleInsertError = null;

  // Fresh module import so mocks take effect cleanly.
  vi.resetModules();
  const mod = await import("./create");
  createWeddingFromOpportunity = mod.createWeddingFromOpportunity;
  createWeddingManual = mod.createWeddingManual;
});

// ── createWeddingFromOpportunity ──────────────────────────────────────────────

describe("createWeddingFromOpportunity", () => {
  it("inserts a weddings row with source=ghl_webhook", async () => {
    const result = await createWeddingFromOpportunity({
      venueId: FAKE_VENUE_ID,
      ghlOpportunityId: FAKE_OPP_ID,
      ghlContactId: FAKE_CONTACT_ID,
      coupleNames: "Alice & Bob",
      coupleEmail: "alice@example.com",
    });

    expect(result.weddingId).toBe(FAKE_WEDDING_ID);

    const weddingInsert = insertCalls.find((c) => c.table === "weddings");
    expect(weddingInsert).toBeDefined();

    const payload = weddingInsert!.payload as Record<string, unknown>;
    expect(payload.venue_id).toBe(FAKE_VENUE_ID);
    expect(payload.ghl_opportunity_id).toBe(FAKE_OPP_ID);
    expect(payload.ghl_contact_id).toBe(FAKE_CONTACT_ID);
    expect(payload.source).toBe("ghl_webhook");
    expect(payload.couple_names).toBe("Alice & Bob");
    expect(payload.status).toBe("planning");
  });

  it("inserts a couple_accounts row with status=invited", async () => {
    await createWeddingFromOpportunity({
      venueId: FAKE_VENUE_ID,
      ghlOpportunityId: FAKE_OPP_ID,
      ghlContactId: FAKE_CONTACT_ID,
      coupleNames: "Alice & Bob",
      coupleEmail: "alice@example.com",
    });

    const coupleInsert = insertCalls.find((c) => c.table === "couple_accounts");
    expect(coupleInsert).toBeDefined();

    const payload = coupleInsert!.payload as Record<string, unknown>;
    expect(payload.venue_id).toBe(FAKE_VENUE_ID);
    expect(payload.wedding_id).toBe(FAKE_WEDDING_ID);
    expect(payload.email).toBe("alice@example.com");
    expect(payload.status).toBe("invited");
  });

  it("sets invited_at on the couple_accounts row", async () => {
    const before = Date.now();
    await createWeddingFromOpportunity({
      venueId: FAKE_VENUE_ID,
      ghlOpportunityId: FAKE_OPP_ID,
      ghlContactId: FAKE_CONTACT_ID,
      coupleNames: "Alice & Bob",
      coupleEmail: "alice@example.com",
    });

    const coupleInsert = insertCalls.find((c) => c.table === "couple_accounts");
    const payload = coupleInsert!.payload as Record<string, unknown>;
    const invitedAt = new Date(payload.invited_at as string).getTime();
    expect(invitedAt).toBeGreaterThanOrEqual(before);
  });

  it("is idempotent: returns existing id without inserting when ghl_opportunity_id already exists", async () => {
    existingWeddingRow = { id: FAKE_EXISTING_WEDDING_ID };

    const result = await createWeddingFromOpportunity({
      venueId: FAKE_VENUE_ID,
      ghlOpportunityId: FAKE_OPP_ID,
      ghlContactId: FAKE_CONTACT_ID,
      coupleNames: "Alice & Bob",
      coupleEmail: "alice@example.com",
    });

    // Returns the existing id, not the generated one.
    expect(result.weddingId).toBe(FAKE_EXISTING_WEDDING_ID);
    expect(result.alreadyExisted).toBe(true);

    // No insert must have been made.
    expect(insertCalls).toHaveLength(0);
  });

  it("forwards optional weddingDate and totalValueMinor to the weddings row", async () => {
    await createWeddingFromOpportunity({
      venueId: FAKE_VENUE_ID,
      ghlOpportunityId: FAKE_OPP_ID,
      ghlContactId: FAKE_CONTACT_ID,
      coupleNames: "Carol & Dan",
      coupleEmail: "carol@example.com",
      weddingDate: "2027-06-12",
      totalValueMinor: 1500000,
    });

    const weddingInsert = insertCalls.find((c) => c.table === "weddings");
    const payload = weddingInsert!.payload as Record<string, unknown>;
    expect(payload.wedding_date).toBe("2027-06-12");
    expect(payload.total_value_minor).toBe(1500000);
  });
});

// ── createWeddingManual ───────────────────────────────────────────────────────

describe("createWeddingManual", () => {
  it("inserts a weddings row with source=manual", async () => {
    const result = await createWeddingManual({
      venueId: FAKE_VENUE_ID,
      coupleNames: "Eve & Frank",
      coupleEmail: "eve@example.com",
    });

    expect(result.weddingId).toBe(FAKE_WEDDING_ID);

    const weddingInsert = insertCalls.find((c) => c.table === "weddings");
    expect(weddingInsert).toBeDefined();

    const payload = weddingInsert!.payload as Record<string, unknown>;
    expect(payload.venue_id).toBe(FAKE_VENUE_ID);
    expect(payload.source).toBe("manual");
    expect(payload.couple_names).toBe("Eve & Frank");
    expect(payload.status).toBe("planning");
    // Manual weddings must NOT carry a ghl_opportunity_id.
    expect(payload.ghl_opportunity_id).toBeUndefined();
  });

  it("inserts a couple_accounts row with status=invited for manual weddings", async () => {
    await createWeddingManual({
      venueId: FAKE_VENUE_ID,
      coupleNames: "Eve & Frank",
      coupleEmail: "eve@example.com",
    });

    const coupleInsert = insertCalls.find((c) => c.table === "couple_accounts");
    expect(coupleInsert).toBeDefined();

    const payload = coupleInsert!.payload as Record<string, unknown>;
    expect(payload.venue_id).toBe(FAKE_VENUE_ID);
    expect(payload.wedding_id).toBe(FAKE_WEDDING_ID);
    expect(payload.email).toBe("eve@example.com");
    expect(payload.status).toBe("invited");
  });

  it("forwards optional weddingDate to the weddings row", async () => {
    await createWeddingManual({
      venueId: FAKE_VENUE_ID,
      coupleNames: "Grace & Hank",
      coupleEmail: "grace@example.com",
      weddingDate: "2028-08-20",
    });

    const weddingInsert = insertCalls.find((c) => c.table === "weddings");
    const payload = weddingInsert!.payload as Record<string, unknown>;
    expect(payload.wedding_date).toBe("2028-08-20");
  });

  it("returns alreadyExisted=false for a fresh manual wedding", async () => {
    const result = await createWeddingManual({
      venueId: FAKE_VENUE_ID,
      coupleNames: "Ivy & Jake",
      coupleEmail: "ivy@example.com",
    });

    expect(result.alreadyExisted).toBe(false);
  });

  it("inserts an optional partnerB couple_accounts row when partnerBEmail is provided", async () => {
    await createWeddingManual({
      venueId: FAKE_VENUE_ID,
      coupleNames: "Kai & Lee",
      coupleEmail: "kai@example.com",
      partnerBEmail: "lee@example.com",
    });

    const coupleInserts = insertCalls.filter((c) => c.table === "couple_accounts");
    // Two partner rows — partner_a and partner_b
    expect(coupleInserts).toHaveLength(2);

    const emails = coupleInserts.map((c) => (c.payload as Record<string, unknown>).email);
    expect(emails).toContain("kai@example.com");
    expect(emails).toContain("lee@example.com");

    const roles = coupleInserts.map((c) => (c.payload as Record<string, unknown>).role);
    expect(roles).toContain("partner_a");
    expect(roles).toContain("partner_b");
  });
});
