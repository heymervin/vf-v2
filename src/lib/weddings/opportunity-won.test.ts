/**
 * Unit tests for src/lib/weddings/opportunity-won.ts
 *
 * Covers:
 *   DOUBLE-GATE (Slice 2 P1):
 *     1. Confirmed-won opportunity proceeds (creates wedding, invites, tags).
 *     2. Not-won opportunity short-circuits with reason "not-won" — NO wedding.
 *     3. No GHL credentials → confirm is skipped gracefully; the function then
 *        falls through to the contact-fetch step and returns "no-ghl-credentials"
 *        WITHOUT creating a wedding.
 *
 *   MAGIC-LINK INVITE (Slice 8 P0):
 *     4. inviteUserByEmail is called once per inserted couple_accounts row with
 *        the correct metadata + redirectTo.
 *     5. A failed invite is non-fatal — wedding + tag still complete.
 *     6. On replay (alreadyExisted → empty coupleAccounts), no invite is sent.
 *
 *   Plus the pre-existing guards: contact-has-no-email, venue-not-found, and
 *   coupleNames fallbacks.
 *
 * All tests are DB-free and secret-free:
 *   - "server-only" is mocked to a no-op.
 *   - @/lib/supabase/admin is mocked (incl. auth.admin.inviteUserByEmail).
 *   - @/lib/ghl/client is mocked (ghlClient factory).
 *   - @/lib/weddings/create is mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── constants ──────────────────────────────────────────────────────────────────

const FAKE_VENUE_ID = "venue-uuid-0001";
const FAKE_OPP_ID = "opp-ghl-0001";
const FAKE_CONTACT_ID = "contact-ghl-0001";
const FAKE_WEDDING_ID = "wedding-uuid-new";
const FAKE_COUPLE_ID = "couple-uuid-0001";
const APP_URL = "https://app.test.local";

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

// GHL opportunity returned by getOpportunity (the double-gate confirm)
let mockOpportunity: { id: string; status: string } = {
  id: FAKE_OPP_ID,
  status: "won",
};

// Controls whether ghlClient returns a client or null
let mockGhlClientNull = false;

// Spies referenced inside hoisted vi.mock factories must themselves be hoisted.
const { ghlRequestSpy, createWeddingSpy, inviteSpy, upsertContactSpy } = vi.hoisted(() => ({
  ghlRequestSpy: vi.fn().mockResolvedValue({}),
  createWeddingSpy: vi.fn(),
  inviteSpy: vi.fn(),
  upsertContactSpy: vi.fn(),
}));

const FAKE_NATIVE_CONTACT_ID = "contact-native-0001";

// Controls createWeddingFromOpportunity return value
let mockCreateWeddingResult: {
  weddingId: string;
  alreadyExisted: boolean;
  coupleAccounts: Array<{ id: string; email: string; weddingId: string; venueId: string }>;
} = {
  weddingId: FAKE_WEDDING_ID,
  alreadyExisted: false,
  coupleAccounts: [
    {
      id: FAKE_COUPLE_ID,
      email: "alice@example.com",
      weddingId: FAKE_WEDDING_ID,
      venueId: FAKE_VENUE_ID,
    },
  ],
};

// Captures auth.admin.inviteUserByEmail calls
let mockInviteError: { message: string } | null = null;

// Venue DB state
let mockVenueData: { name: string } | null = { name: "The Grand Hall" };

// ── mocks ──────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ghl/client", () => ({
  ghlClient: async (_venueId: string) => {
    if (mockGhlClientNull) return null;
    return {
      getContact: async (_id: string) => mockContact,
      getOpportunity: async (_id: string) => mockOpportunity,
      request: ghlRequestSpy,
    };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        inviteUserByEmail: inviteSpy,
      },
    },
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
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      };
    },
  }),
}));

vi.mock("@/lib/weddings/create", () => ({
  createWeddingFromOpportunity: createWeddingSpy,
}));

vi.mock("@/lib/ghl/upsert-contact", () => ({
  upsertGhlContact: upsertContactSpy,
}));

// ── import under test ──────────────────────────────────────────────────────────

import { handleOpportunityWon } from "./opportunity-won";

function runHandler(
  overrides: Partial<{
    venueId: string;
    ghlOpportunityId: string;
    ghlContactId: string;
  }> = {},
) {
  return handleOpportunityWon({
    venueId: FAKE_VENUE_ID,
    ghlOpportunityId: FAKE_OPP_ID,
    ghlContactId: FAKE_CONTACT_ID,
    ...overrides,
  });
}

// ── setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockContact = {
    id: FAKE_CONTACT_ID,
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.com",
    phone: null,
    tags: [],
  };
  mockOpportunity = { id: FAKE_OPP_ID, status: "won" };
  mockGhlClientNull = false;
  mockCreateWeddingResult = {
    weddingId: FAKE_WEDDING_ID,
    alreadyExisted: false,
    coupleAccounts: [
      {
        id: FAKE_COUPLE_ID,
        email: "alice@example.com",
        weddingId: FAKE_WEDDING_ID,
        venueId: FAKE_VENUE_ID,
      },
    ],
  };
  mockVenueData = { name: "The Grand Hall" };
  mockInviteError = null;

  process.env.NEXT_PUBLIC_APP_URL = APP_URL;

  ghlRequestSpy.mockReset();
  createWeddingSpy.mockReset();
  inviteSpy.mockReset();
  upsertContactSpy.mockReset();
  upsertContactSpy.mockResolvedValue(FAKE_NATIVE_CONTACT_ID);
  ghlRequestSpy.mockResolvedValue({});
  createWeddingSpy.mockImplementation(async () => mockCreateWeddingResult);
  inviteSpy.mockImplementation(
    async (_email: string, _opts: Record<string, unknown>) => ({
      data: {},
      error: mockInviteError,
    }),
  );
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("handleOpportunityWon", () => {
  // ── double-gate: confirmed won ────────────────────────────────────────────────

  it("proceeds and creates a wedding when GHL confirms the opportunity is won", async () => {
    const result = (await runHandler()) as Record<string, unknown>;

    expect(createWeddingSpy).toHaveBeenCalledOnce();
    const args = (createWeddingSpy.mock.calls as unknown[][])[0][0] as Record<string, unknown>;
    expect(args.venueId).toBe(FAKE_VENUE_ID);
    expect(args.ghlOpportunityId).toBe(FAKE_OPP_ID);
    expect(args.ghlContactId).toBe(FAKE_CONTACT_ID);
    expect(args.coupleEmail).toBe("alice@example.com");
    expect(args.coupleNames).toBe("Alice Smith");
    // The upserted native contact id is linked onto the wedding.
    expect(upsertContactSpy).toHaveBeenCalledOnce();
    expect(args.contactId).toBe(FAKE_NATIVE_CONTACT_ID);

    expect(result.weddingId).toBe(FAKE_WEDDING_ID);
    expect(result.alreadyExisted).toBe(false);
  });

  // ── double-gate: not-won short-circuits ──────────────────────────────────────

  it("short-circuits with reason=not-won and creates NO wedding when GHL says the opp is not won", async () => {
    mockOpportunity = { id: FAKE_OPP_ID, status: "open" };

    const result = (await runHandler()) as Record<string, unknown>;
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("not-won");

    // A stray webhook must not create a phantom wedding.
    expect(createWeddingSpy).not.toHaveBeenCalled();
    expect(inviteSpy).not.toHaveBeenCalled();
  });

  it("short-circuits when the opp is lost", async () => {
    mockOpportunity = { id: FAKE_OPP_ID, status: "lost" };

    const result = (await runHandler()) as Record<string, unknown>;
    expect(result.reason).toBe("not-won");
    expect(createWeddingSpy).not.toHaveBeenCalled();
  });

  // ── double-gate: no creds skips confirm gracefully ───────────────────────────

  it("skips the confirm gracefully when the venue has no GHL credentials", async () => {
    mockGhlClientNull = true;

    const result = (await runHandler()) as Record<string, unknown>;
    // Confirm cannot run without a client — it must NOT short-circuit as not-won.
    expect(result.reason).not.toBe("not-won");
    // Falls through to fetch-ghl-contact which returns no-ghl-credentials.
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no-ghl-credentials");
    expect(createWeddingSpy).not.toHaveBeenCalled();
    expect(inviteSpy).not.toHaveBeenCalled();
  });

  // ── magic-link invite ────────────────────────────────────────────────────────

  it("sends a magic-link invite once per couple with the correct metadata + redirect", async () => {
    await runHandler();

    expect(inviteSpy).toHaveBeenCalledOnce();
    const [email, opts] = inviteSpy.mock.calls[0];
    expect(email).toBe("alice@example.com");

    const data = opts.data as Record<string, unknown>;
    expect(data.couple_account_id).toBe(FAKE_COUPLE_ID);
    expect(data.wedding_id).toBe(FAKE_WEDDING_ID);
    expect(data.venue_id).toBe(FAKE_VENUE_ID);

    expect(opts.redirectTo).toBe(`${APP_URL}/portal/auth/magic-link`);
  });

  it("invites every inserted couple account (e.g. two partners)", async () => {
    mockCreateWeddingResult = {
      weddingId: FAKE_WEDDING_ID,
      alreadyExisted: false,
      coupleAccounts: [
        { id: "couple-a", email: "alice@example.com", weddingId: FAKE_WEDDING_ID, venueId: FAKE_VENUE_ID },
        { id: "couple-b", email: "bob@example.com", weddingId: FAKE_WEDDING_ID, venueId: FAKE_VENUE_ID },
      ],
    };

    const result = (await runHandler()) as Record<string, unknown>;

    expect(inviteSpy).toHaveBeenCalledTimes(2);
    const emails = inviteSpy.mock.calls.map((c) => c[0]);
    expect(emails).toContain("alice@example.com");
    expect(emails).toContain("bob@example.com");
    expect(result.invitesSent).toBe(2);
  });

  it("does NOT throw when an invite fails — wedding + tag still complete", async () => {
    mockInviteError = { message: "rate limited" };

    const result = (await runHandler()) as Record<string, unknown>;
    expect(result.weddingId).toBe(FAKE_WEDDING_ID);
    expect(result.invitesSent).toBe(0);
    // Tag still fires.
    expect(ghlRequestSpy).toHaveBeenCalledOnce();
  });

  it("sends no invite when there are no inserted couple accounts (replay / alreadyExisted)", async () => {
    mockCreateWeddingResult = {
      weddingId: FAKE_WEDDING_ID,
      alreadyExisted: true,
      coupleAccounts: [],
    };

    const result = (await runHandler()) as Record<string, unknown>;
    expect(result.alreadyExisted).toBe(true);
    expect(inviteSpy).not.toHaveBeenCalled();
    expect(result.invitesSent).toBe(0);
    // Tag must still fire on replay.
    expect(ghlRequestSpy).toHaveBeenCalledOnce();
  });

  // ── tag GHL contact ──────────────────────────────────────────────────────────

  it("tags the GHL contact vf2-portal-invited", async () => {
    await runHandler();

    expect(ghlRequestSpy).toHaveBeenCalledOnce();
    const [path, init] = ghlRequestSpy.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/contacts/${FAKE_CONTACT_ID}/tags`);
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string) as { tags: string[] };
    expect(body.tags).toContain("vf2-portal-invited");
  });

  it("does not throw when the GHL tag call fails", async () => {
    ghlRequestSpy.mockRejectedValueOnce(new Error("GHL API error 500"));

    const result = (await runHandler()) as Record<string, unknown>;
    expect(result.weddingId).toBe(FAKE_WEDDING_ID);
    expect(inviteSpy).toHaveBeenCalledOnce();
  });

  // ── contact guards ───────────────────────────────────────────────────────────

  it("returns skipped=true when the GHL contact has no email", async () => {
    mockContact = { ...mockContact, email: null };

    const result = (await runHandler()) as Record<string, unknown>;
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("contact-has-no-email");
    expect(createWeddingSpy).not.toHaveBeenCalled();
    expect(inviteSpy).not.toHaveBeenCalled();
  });

  it("returns skipped=true when venue row is not found", async () => {
    mockVenueData = null;

    const result = (await runHandler()) as Record<string, unknown>;
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("venue-not-found");
    expect(createWeddingSpy).not.toHaveBeenCalled();
  });

  // ── couple name fallback ─────────────────────────────────────────────────────

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
