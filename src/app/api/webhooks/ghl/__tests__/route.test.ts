/**
 * Unit tests for src/app/api/webhooks/ghl/route.ts
 *
 * These tests are DB-free and secret-free:
 *   - @/lib/supabase/admin is mocked (controls venue lookup + dedup insert +
 *     wedding resolution + Realtime channel.send)
 *   - @/lib/weddings/opportunity-won is mocked (asserts handleOpportunityWon calls)
 *   - next/server's `after` is mocked to run its callback synchronously
 *   - server-only is mocked to a no-op
 *   - GHL_WEBHOOK_SHARED_SECRET is set in process.env before import
 *
 * Scenarios:
 *   1. Bad HMAC → 401 (shared-secret path, PIT mode)
 *   2. Missing signature header → 401
 *   3. Unknown locationId → 200 {ignored: true}, no handleOpportunityWon
 *   4. Duplicate webhookId (already in ghl_webhook_events) → 200 {duplicate: true}
 *   5. OpportunityStatusUpdate with status=won → handleOpportunityWon invoked
 *   6. OpportunityStatusUpdate with status≠won → 200, no handleOpportunityWon
 *   7. OpportunityStageUpdate (Booked stage) → handleOpportunityWon invoked
 *   8. Unrecognised event type → 200, no handleOpportunityWon, no broadcast
 *   9. InboundMessage (known contact) → 200, broadcast invoked on correct channel
 *  10. InboundMessage (no wedding for contact) → 200, no broadcast (graceful)
 *  11. Bad HMAC on InboundMessage → 401, no broadcast
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

// ── constants ──────────────────────────────────────────────────────────────────

const TEST_SECRET = "test-shared-webhook-secret-for-unit-tests";
const FAKE_VENUE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const FAKE_LOCATION_ID = "loc_test_abc123";
const FAKE_WEBHOOK_ID = "wh_event_unique_001";
const FAKE_OPP_ID = "opp_xyz_999";
const FAKE_CONTACT_ID = "contact_abc_111";

// ── helpers ────────────────────────────────────────────────────────────────────

/** Compute the HMAC-SHA256 hex signature the GHL Workflow sender would produce. */
function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Build a Next.js-compatible Request from a body string + headers. */
function makeRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://app.venueflow.io/api/webhooks/ghl", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

// ── mock state — controlled per test ──────────────────────────────────────────

/**
 * Controls what createAdminClient().from("ghl_credentials").select().eq().maybeSingle()
 * returns for the venue-resolution lookup.
 */
let mockVenueResult: { data: { venue_id: string } | null; error: null } = {
  data: null,
  error: null,
};

/**
 * Controls what createAdminClient().from("ghl_webhook_events").upsert().select()
 * returns for the dedup check.
 */
let mockDedupResult: {
  data: Array<{ webhook_id: string }> | null;
  error: null | { message: string };
} = { data: [{ webhook_id: FAKE_WEBHOOK_ID }], error: null };

// Captured handleOpportunityWon calls for assertion.
const handleOpportunityWonSpy = vi.fn().mockResolvedValue({ weddingId: "w1" });

// Captured Realtime broadcast calls for assertion.
const channelSendSpy = vi.fn().mockResolvedValue("ok");
// Captured channel names passed to admin.channel(name).
const channelNameSpy = vi.fn();

// ── vi.mock declarations (hoisted before imports) ─────────────────────────────

vi.mock("server-only", () => ({}));

// Run `after` callbacks synchronously so we can assert the scheduled work.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (cb: () => unknown) => {
      void cb();
    },
  };
});

vi.mock("@/lib/weddings/opportunity-won", () => ({
  handleOpportunityWon: handleOpportunityWonSpy,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "ghl_credentials") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: async () => mockVenueResult,
            }),
          }),
        };
      }
      if (table === "ghl_webhook_events") {
        return {
          upsert: (_row: unknown, _opts: unknown) => ({
            select: (_cols: string) => mockDedupResult,
          }),
        };
      }
      // Fallback for any other table — return empty.
      return {
        upsert: () => ({ select: () => ({ data: [], error: null }) }),
      };
    },
    // Supabase Realtime channel — used by broadcastInboundMessage.
    channel: (name: string) => {
      channelNameSpy(name);
      return { send: channelSendSpy };
    },
  }),
}));

// ── module import (after mocks are declared) ──────────────────────────────────

// The route handler accepts NextRequest; we cast to the wider Request type so
// tests can pass plain `new Request(...)` without importing NextRequest.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  process.env.GHL_WEBHOOK_SHARED_SECRET = TEST_SECRET;
  const mod = await import("../route");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  POST = mod.POST as unknown as (req: Request) => Promise<Response>;
});

afterAll(() => {
  delete process.env.GHL_WEBHOOK_SHARED_SECRET;
});

beforeEach(() => {
  handleOpportunityWonSpy.mockClear();
  handleOpportunityWonSpy.mockResolvedValue({ weddingId: "w1" });
  channelSendSpy.mockClear();
  channelSendSpy.mockResolvedValue("ok");
  channelNameSpy.mockClear();
  // Default: a valid venue row exists and dedup sees it as new (non-duplicate).
  mockVenueResult = { data: { venue_id: FAKE_VENUE_ID }, error: null };
  mockDedupResult = { data: [{ webhook_id: FAKE_WEBHOOK_ID }], error: null };
});

// ── helpers: payload builders ─────────────────────────────────────────────────

function opportunityWonPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    webhookId: FAKE_WEBHOOK_ID,
    type: "OpportunityStatusUpdate",
    locationId: FAKE_LOCATION_ID,
    id: FAKE_OPP_ID,
    contactId: FAKE_CONTACT_ID,
    status: "won",
    ...overrides,
  });
}

function opportunityStagePayload(stage = "Booked"): string {
  return JSON.stringify({
    webhookId: FAKE_WEBHOOK_ID,
    type: "OpportunityStageUpdate",
    locationId: FAKE_LOCATION_ID,
    id: FAKE_OPP_ID,
    contactId: FAKE_CONTACT_ID,
    pipelineStageId: "stage_booked_001",
    stageName: stage,
  });
}

function inboundMessagePayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    webhookId: FAKE_WEBHOOK_ID,
    type: "InboundMessage",
    locationId: FAKE_LOCATION_ID,
    contactId: FAKE_CONTACT_ID,
    conversationId: "conv_abc_001",
    messageId: "msg_xyz_001",
    messageType: "SMS",
    ...overrides,
  });
}

function unknownEventPayload(): string {
  return JSON.stringify({
    webhookId: FAKE_WEBHOOK_ID,
    type: "ContactTagUpdate",
    locationId: FAKE_LOCATION_ID,
  });
}

// ── test suite ────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/ghl", () => {
  // ── auth guard ──────────────────────────────────────────────────────────────

  it("returns 401 when the x-vf-webhook-secret header is missing", async () => {
    const body = opportunityWonPayload();
    const req = makeRequest(body); // no secret header

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(handleOpportunityWonSpy).not.toHaveBeenCalled();
  });

  it("returns 401 when the HMAC signature is wrong (bad secret)", async () => {
    const body = opportunityWonPayload();
    const badSig = sign(body, "totally-wrong-secret");
    const req = makeRequest(body, { "x-vf-webhook-secret": badSig });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(handleOpportunityWonSpy).not.toHaveBeenCalled();
  });

  it("returns 401 when the body was tampered after signing", async () => {
    const originalBody = opportunityWonPayload();
    const sig = sign(originalBody, TEST_SECRET);

    // Tampered body — signature no longer matches
    const tamperedBody = opportunityWonPayload({ status: "open" });
    const req = makeRequest(tamperedBody, { "x-vf-webhook-secret": sig });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(handleOpportunityWonSpy).not.toHaveBeenCalled();
  });

  // ── venue resolution ────────────────────────────────────────────────────────

  it("returns 200 with ignored=true when locationId maps to no known venue", async () => {
    mockVenueResult = { data: null, error: null };

    const body = opportunityWonPayload();
    const sig = sign(body, TEST_SECRET);
    const req = makeRequest(body, { "x-vf-webhook-secret": sig });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.ignored).toBe(true);
    expect(handleOpportunityWonSpy).not.toHaveBeenCalled();
  });

  // ── dedup ───────────────────────────────────────────────────────────────────

  it("returns 200 with duplicate=true when the webhookId was already processed", async () => {
    // Simulate ON CONFLICT DO NOTHING → no rows returned (already inserted)
    mockDedupResult = { data: [], error: null };

    const body = opportunityWonPayload();
    const sig = sign(body, TEST_SECRET);
    const req = makeRequest(body, { "x-vf-webhook-secret": sig });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.duplicate).toBe(true);
    expect(handleOpportunityWonSpy).not.toHaveBeenCalled();
  });

  // ── opportunity won ─────────────────────────────────────────────────────────

  it("invokes handleOpportunityWon when OpportunityStatusUpdate has status=won", async () => {
    const body = opportunityWonPayload({ status: "won" });
    const sig = sign(body, TEST_SECRET);
    const req = makeRequest(body, { "x-vf-webhook-secret": sig });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(handleOpportunityWonSpy).toHaveBeenCalledOnce();
    const [input] = handleOpportunityWonSpy.mock.calls[0] as [Record<string, unknown>];
    expect(input.venueId).toBe(FAKE_VENUE_ID);
    expect(input.ghlOpportunityId).toBe(FAKE_OPP_ID);
    expect(input.ghlContactId).toBe(FAKE_CONTACT_ID);
  });

  it("does NOT emit an event when OpportunityStatusUpdate has status=open", async () => {
    const body = opportunityWonPayload({ status: "open" });
    const sig = sign(body, TEST_SECRET);
    const req = makeRequest(body, { "x-vf-webhook-secret": sig });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(handleOpportunityWonSpy).not.toHaveBeenCalled();
  });

  it("does NOT emit an event when OpportunityStatusUpdate has status=lost", async () => {
    const body = opportunityWonPayload({ status: "lost" });
    const sig = sign(body, TEST_SECRET);
    const req = makeRequest(body, { "x-vf-webhook-secret": sig });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(handleOpportunityWonSpy).not.toHaveBeenCalled();
  });

  // ── booked stage (alternative win signal) ───────────────────────────────────

  it("invokes handleOpportunityWon when OpportunityStageUpdate has stageName=Booked", async () => {
    const body = opportunityStagePayload("Booked");
    const sig = sign(body, TEST_SECRET);
    const req = makeRequest(body, { "x-vf-webhook-secret": sig });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(handleOpportunityWonSpy).toHaveBeenCalledOnce();
    const [input] = handleOpportunityWonSpy.mock.calls[0] as [Record<string, unknown>];
    expect(input.venueId).toBe(FAKE_VENUE_ID);
  });

  it("does NOT emit an event when OpportunityStageUpdate has a non-Booked stage", async () => {
    const body = opportunityStagePayload("In Progress");
    const sig = sign(body, TEST_SECRET);
    const req = makeRequest(body, { "x-vf-webhook-secret": sig });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(handleOpportunityWonSpy).not.toHaveBeenCalled();
  });

  // ── unrecognised event type ─────────────────────────────────────────────────

  it("returns 200 and ignores an unrecognised event type without broadcasting", async () => {
    const body = unknownEventPayload();
    const sig = sign(body, TEST_SECRET);
    const req = makeRequest(body, { "x-vf-webhook-secret": sig });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.received).toBe(true);
    expect(handleOpportunityWonSpy).not.toHaveBeenCalled();
    expect(channelSendSpy).not.toHaveBeenCalled();
  });

  // ── fast response guarantee ─────────────────────────────────────────────────

  it("returns 200 with received=true on a successful won event", async () => {
    const body = opportunityWonPayload({ status: "won" });
    const sig = sign(body, TEST_SECRET);
    const req = makeRequest(body, { "x-vf-webhook-secret": sig });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.received).toBe(true);
  });

  // ── InboundMessage → Realtime broadcast ────────────────────────────────────

  it("InboundMessage broadcasts on the contact + venue inbox channels", async () => {
    const body = inboundMessagePayload();
    const sig = sign(body, TEST_SECRET);
    const req = makeRequest(body, { "x-vf-webhook-secret": sig });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.received).toBe(true);

    // handleOpportunityWon must NOT be called — this is not an opportunity event.
    expect(handleOpportunityWonSpy).not.toHaveBeenCalled();

    // Broadcast once per channel: the contact thread + the venue inbox.
    expect(channelNameSpy).toHaveBeenCalledWith(`contact:${FAKE_CONTACT_ID}:messages`);
    expect(channelNameSpy).toHaveBeenCalledWith(`venue:${FAKE_VENUE_ID}:inbox`);
    expect(channelSendSpy).toHaveBeenCalledTimes(2);

    const [broadcastArgs] = channelSendSpy.mock.calls[0] as [Record<string, unknown>];
    expect(broadcastArgs.type).toBe("broadcast");
    expect(broadcastArgs.event).toBe("new-message");
    const broadcastPayload = broadcastArgs.payload as Record<string, unknown>;
    expect(broadcastPayload.contactId).toBe(FAKE_CONTACT_ID);
    expect(broadcastPayload.conversationId).toBe("conv_abc_001");
    expect(broadcastPayload.messageId).toBe("msg_xyz_001");
  });

  it("InboundMessage missing contactId returns 200 without broadcasting", async () => {
    const body = inboundMessagePayload({ contactId: "" });
    const sig = sign(body, TEST_SECRET);
    const req = makeRequest(body, { "x-vf-webhook-secret": sig });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.received).toBe(true);
    expect(channelSendSpy).not.toHaveBeenCalled();
    expect(handleOpportunityWonSpy).not.toHaveBeenCalled();
  });

  it("InboundMessage with bad signature returns 401 without broadcasting", async () => {
    const body = inboundMessagePayload();
    const badSig = sign(body, "wrong-secret");
    const req = makeRequest(body, { "x-vf-webhook-secret": badSig });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(channelSendSpy).not.toHaveBeenCalled();
    expect(handleOpportunityWonSpy).not.toHaveBeenCalled();
  });

  it("InboundMessage broadcast failure is non-fatal — still returns 200", async () => {
    // Simulate the Realtime send throwing an error.
    channelSendSpy.mockRejectedValueOnce(new Error("Realtime unavailable"));

    const body = inboundMessagePayload();
    const sig = sign(body, TEST_SECRET);
    const req = makeRequest(body, { "x-vf-webhook-secret": sig });

    // Must not throw and must still ack GHL.
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.received).toBe(true);
  });
});
