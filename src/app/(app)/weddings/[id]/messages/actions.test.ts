/**
 * Unit tests for src/app/(app)/weddings/[id]/messages/actions.ts
 *
 * sendMessageAction — server action that sends a message via GHL.
 *
 * Covers:
 *   1. Happy path — resolves wedding, calls ghlClient.sendMessage, returns ok+message.
 *   2. Unauthenticated — returns err when getTenantContext returns ok:false.
 *   3. Wedding not found — returns err when wedding row is missing.
 *   4. No ghl_contact_id — returns err "No GHL contact linked".
 *   5. No GHL client (standalone mode) — returns err "GHL is not connected".
 *   6. GHL sendMessage throws — returns err "Failed to send message".
 *   7. Invalid input — short weddingId returns validation error.
 *
 * All tests are DB-free and secret-free:
 *   - "server-only" is mocked to a no-op.
 *   - @/lib/tenant is mocked (getTenantContext).
 *   - @/lib/supabase/server is mocked (createClient).
 *   - @/lib/ghl/client is mocked (ghlClient).
 *   - @/lib/billing/access is mocked (assertCanMutate → null).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Constants ─────────────────────────────────────────────────────────────────

const FAKE_VENUE_ID = "00000000-0000-4000-8000-000000000001";
const FAKE_WEDDING_ID = "00000000-0000-4000-8000-000000000002";
const FAKE_CONTACT_ID = "ghl-contact-xyz";
const FAKE_MESSAGE_ID = "msg-001";

// ── Mock state ────────────────────────────────────────────────────────────────

let mockTenantOk = true;
let mockWeddingData: { id: string; ghl_contact_id: string | null } | null = {
  id: FAKE_WEDDING_ID,
  ghl_contact_id: FAKE_CONTACT_ID,
};
let mockGhlClientNull = false;

const sendMessageSpy = vi.fn().mockResolvedValue({
  id: FAKE_MESSAGE_ID,
  conversationId: "conv-001",
  body: "Test reply",
  type: "SMS",
  direction: "outbound",
  dateAdded: new Date().toISOString(),
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/tenant", () => ({
  getTenantContext: async () => {
    if (!mockTenantOk) return { ok: false, reason: "unauthenticated" };
    return {
      ok: true,
      user: { id: "user-001", email: "staff@example.com" },
      venue: { id: FAKE_VENUE_ID, name: "Grand Hall", slug: "grand-hall", timezone: "Europe/London", onboardingCompletedAt: null, trialEndsAt: null },
      role: "admin",
      access: "active",
      billing: { stripeCustomerId: null, status: null, currentPeriodEnd: null },
    };
  },
}));

vi.mock("@/lib/billing/access", () => ({
  assertCanMutate: () => null, // always allow in tests
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          eq: (_col2: string, _val2: string) => ({
            maybeSingle: async () => ({
              data: mockWeddingData,
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/ghl/client", () => ({
  ghlClient: async (_venueId: string) => {
    if (mockGhlClientNull) return null;
    return { sendMessage: sendMessageSpy };
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function validInput() {
  return {
    weddingId: FAKE_WEDDING_ID,
    type: "SMS" as const,
    message: "Hello from VF2!",
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// Import once — mocks are registered at module-scope and persist across tests.
// No vi.resetModules() needed here (unlike the Inngest handler test which must
// re-capture createFunction on each run).
import { sendMessageAction } from "./actions";

describe("sendMessageAction", () => {
  beforeEach(() => {
    mockTenantOk = true;
    mockWeddingData = { id: FAKE_WEDDING_ID, ghl_contact_id: FAKE_CONTACT_ID };
    mockGhlClientNull = false;
    sendMessageSpy.mockClear();
    sendMessageSpy.mockResolvedValue({
      id: FAKE_MESSAGE_ID,
      conversationId: "conv-001",
      body: "Test reply",
      type: "SMS",
      direction: "outbound",
      dateAdded: new Date().toISOString(),
    });
  });

  it("returns ok + GhlMessage on happy path", async () => {
    const result = await sendMessageAction(validInput());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.id).toBe(FAKE_MESSAGE_ID);
    expect(sendMessageSpy).toHaveBeenCalledOnce();
    const [payload] = sendMessageSpy.mock.calls[0] as [Record<string, unknown>];
    expect(payload.contactId).toBe(FAKE_CONTACT_ID);
    expect(payload.type).toBe("SMS");
    expect(payload.message).toBe("Hello from VF2!");
  });

  it("returns err when unauthenticated", async () => {
    mockTenantOk = false;
    // sendMessageAction imported at top of file
    const result = await sendMessageAction(validInput());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected err");
    expect(result.error).toMatch(/not authenticated/i);
  });

  it("returns err when wedding is not found", async () => {
    mockWeddingData = null;
    // sendMessageAction imported at top of file
    const result = await sendMessageAction(validInput());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected err");
    expect(result.error).toMatch(/wedding not found/i);
  });

  it("returns err when wedding has no ghl_contact_id", async () => {
    mockWeddingData = { id: FAKE_WEDDING_ID, ghl_contact_id: null };
    // sendMessageAction imported at top of file
    const result = await sendMessageAction(validInput());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected err");
    expect(result.error).toMatch(/no ghl contact/i);
  });

  it("returns err when GHL client is null (standalone mode)", async () => {
    mockGhlClientNull = true;
    // sendMessageAction imported at top of file
    const result = await sendMessageAction(validInput());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected err");
    expect(result.error).toMatch(/ghl is not connected/i);
  });

  it("returns err when GHL sendMessage throws", async () => {
    sendMessageSpy.mockRejectedValueOnce(new Error("GHL API error 500"));
    // sendMessageAction imported at top of file
    const result = await sendMessageAction(validInput());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected err");
    expect(result.error).toMatch(/failed to send/i);
  });

  it("returns validation err for empty message", async () => {
    // sendMessageAction imported at top of file
    const result = await sendMessageAction({ ...validInput(), message: "" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected err");
    expect(result.error).toMatch(/empty/i);
  });

  it("passes subject to GHL when provided (Email type)", async () => {
    // sendMessageAction imported at top of file
    await sendMessageAction({
      weddingId: FAKE_WEDDING_ID,
      type: "Email",
      message: "Email body",
      subject: "Your wedding details",
    });
    const [payload] = sendMessageSpy.mock.calls[0] as [Record<string, unknown>];
    expect(payload.subject).toBe("Your wedding details");
    expect(payload.type).toBe("Email");
  });
});
