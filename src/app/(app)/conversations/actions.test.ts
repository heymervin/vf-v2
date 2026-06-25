/**
 * Unit tests for conversations/actions.ts — auth + delegation logic.
 *
 * DB-free and secret-free: getTenantContext, billing, and ghlClient are mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCtx = {
  ok: true as const,
  user: { id: "user-1", email: "staff@venue.io" },
  venue: { id: "venue-1", name: "Test Venue", slug: "test", timezone: "Europe/London" },
  role: "admin" as const,
  access: "active" as const,
};

const getTenantContext = vi.fn().mockResolvedValue(mockCtx);
vi.mock("@/lib/tenant", () => ({ getTenantContext: () => getTenantContext() }));

const assertCanMutate = vi.fn().mockReturnValue(null);
vi.mock("@/lib/billing/access", () => ({ assertCanMutate: () => assertCanMutate() }));

const sendMessage = vi.fn();
const getMessages = vi.fn();
const ghlClient = vi.fn();
vi.mock("@/lib/ghl/client", () => ({ ghlClient: () => ghlClient() }));

let actions: typeof import("./actions");

beforeEach(async () => {
  vi.clearAllMocks();
  getTenantContext.mockResolvedValue(mockCtx);
  assertCanMutate.mockReturnValue(null);
  ghlClient.mockResolvedValue({ sendMessage, getMessages });
  actions = await import("./actions");
});

// ── sendMessageByContactAction ─────────────────────────────────────────────────

describe("sendMessageByContactAction", () => {
  const valid = { ghlContactId: "ghl_1", type: "SMS" as const, message: "Hi there" };

  it("sends via the venue's GHL client and returns the created message", async () => {
    sendMessage.mockResolvedValue({ id: "m1", body: "Hi there", type: "SMS", direction: "outbound" });
    const res = await actions.sendMessageByContactAction(valid);

    expect(res.ok).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({ contactId: "ghl_1", type: "SMS", message: "Hi there" });
  });

  it("rejects an empty message before hitting GHL", async () => {
    const res = await actions.sendMessageByContactAction({ ...valid, message: "" });
    expect(res.ok).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("errors when the venue has no GHL connection", async () => {
    ghlClient.mockResolvedValue(null);
    const res = await actions.sendMessageByContactAction(valid);
    expect(res.ok).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("errors when not authenticated", async () => {
    getTenantContext.mockResolvedValue({ ok: false });
    const res = await actions.sendMessageByContactAction(valid);
    expect(res.ok).toBe(false);
  });

  it("returns an error (not a throw) when GHL send fails", async () => {
    sendMessage.mockRejectedValue(new Error("GHL API error 404"));
    const res = await actions.sendMessageByContactAction(valid);
    expect(res.ok).toBe(false);
  });
});

// ── getThreadMessagesAction ─────────────────────────────────────────────────────

describe("getThreadMessagesAction", () => {
  it("returns the thread's messages on success", async () => {
    getMessages.mockResolvedValue([{ id: "m1", body: "hello" }]);
    const res = await actions.getThreadMessagesAction({ conversationId: "conv_1" });
    expect(res.ok).toBe(true);
    expect(getMessages).toHaveBeenCalledWith("conv_1");
  });

  it("errors when not authenticated", async () => {
    getTenantContext.mockResolvedValue({ ok: false });
    const res = await actions.getThreadMessagesAction({ conversationId: "conv_1" });
    expect(res.ok).toBe(false);
    expect(getMessages).not.toHaveBeenCalled();
  });

  it("errors (not throws) when GHL read fails", async () => {
    getMessages.mockRejectedValue(new Error("boom"));
    const res = await actions.getThreadMessagesAction({ conversationId: "conv_1" });
    expect(res.ok).toBe(false);
  });
});
