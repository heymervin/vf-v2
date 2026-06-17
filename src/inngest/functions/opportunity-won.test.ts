/**
 * Unit tests for src/inngest/functions/opportunity-won.ts
 *
 * Covers:
 *   1. Happy path — fetches contact, creates wedding, sends invite email,
 *      tags GHL contact.
 *   2. No GHL credentials for venue → skips with reason "no-ghl-credentials".
 *   3. Contact has no email → skips with reason "contact-has-no-email".
 *   4. Venue not found in DB → skips with reason "venue-not-found".
 *   5. Idempotency — when wedding alreadyExisted, still sends email + tags.
 *   6. GHL tag call failure is non-fatal (wedding + email still complete).
 *
 * All tests are DB-free and secret-free:
 *   - "server-only" is mocked to a no-op.
 *   - @/lib/supabase/admin is mocked.
 *   - @/lib/ghl/client is mocked (ghlClient factory).
 *   - @/lib/weddings/create is mocked.
 *   - @/lib/email/send is mocked.
 *   - @/lib/email/templates/portal-invite-email is mocked.
 *   - @/inngest/client is mocked with a factory helper.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── constants ──────────────────────────────────────────────────────────────────

const FAKE_VENUE_ID = "venue-uuid-0001";
const FAKE_OPP_ID = "opp-ghl-0001";
const FAKE_CONTACT_ID = "contact-ghl-0001";
const FAKE_WEDDING_ID = "wedding-uuid-new";
const FAKE_LOCATION_ID = "loc_test_abc123";

// ── mock state ─────────────────────────────────────────────────────────────────

// GHL contact returned by getContact
let mockContact: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
} = {
  id: FAKE_CONTACT_ID,
  firstName: "Alice",
  lastName: "Smith",
  email: "alice@example.com",
  phone: null,
  tags: [],
};

// Controls whether ghlClient returns a client or null
let mockGhlClientNull = false;

// Captures PUT /contacts/{id}/tags calls
const ghlRequestSpy = vi.fn().mockResolvedValue({});

// Controls createWeddingFromOpportunity return value
let mockCreateWeddingResult = { weddingId: FAKE_WEDDING_ID, alreadyExisted: false };
const createWeddingSpy = vi.fn(async () => mockCreateWeddingResult);

// Controls sendEmail return value
const sendEmailSpy = vi.fn().mockResolvedValue({ ok: true, id: "email-id-001" });

// Venue/settings DB state
let mockVenueData: { name: string } | null = { name: "The Grand Hall" };
let mockEmailSettingsData: { from_name: string; reply_to: string } | null = {
  from_name: "The Grand Hall",
  reply_to: "venue@example.com",
};

// ── mocks ──────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ghl/client", () => ({
  ghlClient: async (_venueId: string) => {
    if (mockGhlClientNull) return null;
    return {
      getContact: async (_id: string) => mockContact,
      request: ghlRequestSpy,
    };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "venues") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: async () => ({ data: mockVenueData, error: null }),
            }),
          }),
        };
      }
      if (table === "venue_email_settings") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: async () => ({ data: mockEmailSettingsData, error: null }),
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

vi.mock("@/lib/weddings/create", () => ({
  createWeddingFromOpportunity: createWeddingSpy,
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: sendEmailSpy,
}));

vi.mock("@/lib/email/templates/portal-invite-email", () => ({
  PortalInviteEmail: (props: unknown) => props, // return props as the "element"
}));

// ── Inngest test harness ───────────────────────────────────────────────────────

/**
 * Minimal step harness that runs each step.run callback immediately
 * (no replay, no memoisation needed for unit tests).
 */
function makeStepHarness() {
  return {
    run: async <T>(name: string, fn: () => Promise<T>): Promise<T> => fn(),
  };
}

/**
 * The Inngest client mock — exposes createFunction so the module can register
 * its handler, and we capture it for direct invocation.
 */
let capturedHandler: ((ctx: { event: unknown; step: ReturnType<typeof makeStepHarness> }) => Promise<unknown>) | null = null;

vi.mock("@/inngest/client", () => ({
  inngest: {
    createFunction: (
      _config: unknown,
      handler: (ctx: { event: unknown; step: ReturnType<typeof makeStepHarness> }) => Promise<unknown>,
    ) => {
      capturedHandler = handler;
      // Return a minimal object so the module compiles without errors.
      return { id: "opportunity-won" };
    },
  },
}));

// ── helper to invoke the handler ──────────────────────────────────────────────

function makeEvent(overrides: Partial<{
  venueId: string;
  locationId: string;
  ghlOpportunityId: string;
  ghlContactId: string;
}> = {}) {
  return {
    name: "ghl/opportunity-won" as const,
    data: {
      venueId: FAKE_VENUE_ID,
      locationId: FAKE_LOCATION_ID,
      ghlOpportunityId: FAKE_OPP_ID,
      ghlContactId: FAKE_CONTACT_ID,
      ...overrides,
    },
  };
}

async function runHandler(event = makeEvent()) {
  if (!capturedHandler) throw new Error("handler not captured — check mock order");
  return capturedHandler({ event, step: makeStepHarness() });
}

// ── import (triggers createFunction + handler capture) ────────────────────────

beforeEach(async () => {
  // Reset state
  mockContact = {
    id: FAKE_CONTACT_ID,
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.com",
    phone: null,
    tags: [],
  };
  mockGhlClientNull = false;
  mockCreateWeddingResult = { weddingId: FAKE_WEDDING_ID, alreadyExisted: false };
  mockVenueData = { name: "The Grand Hall" };
  mockEmailSettingsData = { from_name: "The Grand Hall", reply_to: "venue@example.com" };

  ghlRequestSpy.mockClear();
  createWeddingSpy.mockClear();
  sendEmailSpy.mockClear();
  ghlRequestSpy.mockResolvedValue({});
  sendEmailSpy.mockResolvedValue({ ok: true, id: "email-id-001" });

  vi.resetModules();
  capturedHandler = null;
  await import("./opportunity-won");
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("opportunityWon Inngest function", () => {
  // ── happy path ──────────────────────────────────────────────────────────────

  it("calls createWeddingFromOpportunity with correct arguments", async () => {
    await runHandler();

    expect(createWeddingSpy).toHaveBeenCalledOnce();
    const args = (createWeddingSpy.mock.calls as unknown[][])[0][0] as Record<string, unknown>;
    expect(args.venueId).toBe(FAKE_VENUE_ID);
    expect(args.ghlOpportunityId).toBe(FAKE_OPP_ID);
    expect(args.ghlContactId).toBe(FAKE_CONTACT_ID);
    expect(args.coupleEmail).toBe("alice@example.com");
    expect(args.coupleNames).toBe("Alice Smith");
  });

  it("sends the portal invite email to the contact email", async () => {
    await runHandler();

    expect(sendEmailSpy).toHaveBeenCalledOnce();
    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(args.to).toBe("alice@example.com");
    expect(typeof args.subject).toBe("string");
    expect((args.subject as string).length).toBeGreaterThan(0);
    expect(args.fromName).toBe("The Grand Hall");
    expect(args.replyTo).toBe("venue@example.com");
  });

  it("tags the GHL contact vf2-portal-invited", async () => {
    await runHandler();

    expect(ghlRequestSpy).toHaveBeenCalledOnce();
    const [path, init] = ghlRequestSpy.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/contacts/${FAKE_CONTACT_ID}/tags`);
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string) as { tags: string[] };
    expect(body.tags).toContain("vf2-portal-invited");
  });

  it("returns weddingId and alreadyExisted=false on success", async () => {
    const result = await runHandler() as Record<string, unknown>;
    expect(result.weddingId).toBe(FAKE_WEDDING_ID);
    expect(result.alreadyExisted).toBe(false);
  });

  // ── no GHL credentials ──────────────────────────────────────────────────────

  it("returns skipped=true when the venue has no GHL credentials", async () => {
    mockGhlClientNull = true;

    const result = await runHandler() as Record<string, unknown>;
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no-ghl-credentials");
    expect(createWeddingSpy).not.toHaveBeenCalled();
    expect(sendEmailSpy).not.toHaveBeenCalled();
  });

  // ── contact has no email ────────────────────────────────────────────────────

  it("returns skipped=true when the GHL contact has no email", async () => {
    mockContact = { ...mockContact, email: null };

    const result = await runHandler() as Record<string, unknown>;
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("contact-has-no-email");
    expect(createWeddingSpy).not.toHaveBeenCalled();
    expect(sendEmailSpy).not.toHaveBeenCalled();
  });

  // ── venue not found ─────────────────────────────────────────────────────────

  it("returns skipped=true when venue row is not found", async () => {
    mockVenueData = null;

    const result = await runHandler() as Record<string, unknown>;
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("venue-not-found");
    expect(createWeddingSpy).not.toHaveBeenCalled();
  });

  // ── idempotency ─────────────────────────────────────────────────────────────

  it("still sends email and tags contact even when wedding alreadyExisted", async () => {
    mockCreateWeddingResult = { weddingId: FAKE_WEDDING_ID, alreadyExisted: true };

    const result = await runHandler() as Record<string, unknown>;
    expect(result.alreadyExisted).toBe(true);
    // Email + tag must still fire on replay.
    expect(sendEmailSpy).toHaveBeenCalledOnce();
    expect(ghlRequestSpy).toHaveBeenCalledOnce();
  });

  // ── GHL tag failure is non-fatal ────────────────────────────────────────────

  it("does not throw when the GHL tag call fails", async () => {
    ghlRequestSpy.mockRejectedValueOnce(new Error("GHL API error 500"));

    // Should not throw — tagging is best-effort.
    const result = await runHandler() as Record<string, unknown>;
    expect(result.weddingId).toBe(FAKE_WEDDING_ID);
    expect(sendEmailSpy).toHaveBeenCalledOnce();
  });

  // ── couple name fallback ────────────────────────────────────────────────────

  it("falls back to email as coupleNames when contact has no first/last name", async () => {
    mockContact = { ...mockContact, firstName: null, lastName: null };

    await runHandler();

    const args = (createWeddingSpy.mock.calls as unknown[][])[0][0] as Record<string, unknown>;
    expect(args.coupleNames).toBe("alice@example.com");
  });

  it("builds coupleNames from firstName only when lastName is absent", async () => {
    mockContact = { ...mockContact, lastName: null };

    await runHandler();

    const args = (createWeddingSpy.mock.calls as unknown[][])[0][0] as Record<string, unknown>;
    expect(args.coupleNames).toBe("Alice");
  });
});
