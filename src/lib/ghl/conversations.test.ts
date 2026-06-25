/**
 * Unit tests for GHL conversations methods on createGhlClient.
 *
 * Covers:
 *   1. listConversations — GET /conversations/search?locationId=&contactId=:
 *      correct method, path, headers (Bearer + Version), query params, and
 *      response mapping to GhlConversation[].
 *   2. getMessages — GET /conversations/{id}/messages:
 *      correct method, path, headers; response mapping to GhlMessage[].
 *   3. sendMessage — POST /conversations/messages:
 *      correct method, path, headers (Bearer + Version + Content-Type),
 *      body shape (contactId + type + message), response mapping.
 *   4. Non-200 response → throws a descriptive error for every method.
 *
 * All tests are DB-free and secret-free:
 *   - "server-only" is mocked to a no-op.
 *   - @/lib/supabase/admin is mocked (imported transitively by client.ts).
 *   - @/lib/ghl/crypto is mocked (imported transitively by client.ts).
 *   - global.fetch is replaced with vi.spyOn per test group.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── mock server-only + transitive deps ────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/ghl/crypto", () => ({
  decryptToken: (s: string) => s,
}));

// ── constants ──────────────────────────────────────────────────────────────────

const FAKE_TOKEN = "pit_test_token_conv_abc123";
const FAKE_LOCATION_ID = "loc_conv_test_abc";
const FAKE_CONTACT_ID = "contact_conv_0001";
const FAKE_CONVERSATION_ID = "conv_ghl_0001";
const FAKE_MESSAGE_ID = "msg_ghl_0001";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

// ── response factories ─────────────────────────────────────────────────────────

/**
 * Build a minimal Response-like object that fetch would return.
 * `ok` is true when status is 200–299.
 */
function makeResponse(body: unknown, status = 200): Response {
  const json = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(json) as unknown,
    text: async () => json,
  } as unknown as Response;
}

/** A single GHL conversation as returned inside the search response. */
function makeConversation(overrides: Partial<{
  id: string;
  contactId: string;
  type: string;
  unreadCount: number;
  lastMessageBody: string;
  lastMessageDate: string;
}> = {}) {
  return {
    id: FAKE_CONVERSATION_ID,
    contactId: FAKE_CONTACT_ID,
    type: "SMS",
    unreadCount: 0,
    lastMessageBody: "Hello, we look forward to your wedding!",
    lastMessageDate: "2026-06-17T10:00:00.000Z",
    ...overrides,
  };
}

/** A single GHL message as returned inside the messages response. */
function makeMessage(overrides: Partial<{
  id: string;
  conversationId: string;
  body: string;
  type: string;
  direction: string;
  dateAdded: string;
}> = {}) {
  return {
    id: FAKE_MESSAGE_ID,
    conversationId: FAKE_CONVERSATION_ID,
    body: "Congratulations on your engagement!",
    type: "SMS",
    direction: "outbound",
    dateAdded: "2026-06-17T09:00:00.000Z",
    ...overrides,
  };
}

// ── module under test (imported after mocks, reset per test group) ─────────────

let createGhlClient: typeof import("./client").createGhlClient;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("./client");
  createGhlClient = mod.createGhlClient;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── shared fetch spy helper ───────────────────────────────────────────────────

function stubFetch(response: Response) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce(response);
}

// ── listConversations ─────────────────────────────────────────────────────────

describe("createGhlClient — listConversations", () => {
  it("sends GET to /conversations/search with Bearer + Version headers", async () => {
    const fetchSpy = stubFetch(
      makeResponse({ conversations: [makeConversation()], meta: { total: 1, nextPageUrl: null } })
    );
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.listConversations({ contactId: FAKE_CONTACT_ID });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toContain(`${GHL_BASE}/conversations/search`);
    expect(init.method ?? "GET").toBe("GET");

    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(headers.get("Version")).toBe(GHL_VERSION);
  });

  it("includes locationId in the query string", async () => {
    stubFetch(
      makeResponse({ conversations: [], meta: { total: 0, nextPageUrl: null } })
    );
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.listConversations({ contactId: FAKE_CONTACT_ID });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain(`locationId=${FAKE_LOCATION_ID}`);
  });

  it("includes contactId in the query string", async () => {
    stubFetch(
      makeResponse({ conversations: [], meta: { total: 0, nextPageUrl: null } })
    );
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.listConversations({ contactId: FAKE_CONTACT_ID });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain(`contactId=${FAKE_CONTACT_ID}`);
  });

  it("does NOT send a Content-Type header on GET", async () => {
    stubFetch(
      makeResponse({ conversations: [], meta: { total: 0, nextPageUrl: null } })
    );
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.listConversations({ contactId: FAKE_CONTACT_ID });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("maps the response to GhlConversation[]", async () => {
    const conv = makeConversation({ id: "conv_x", type: "Email", unreadCount: 2 });
    stubFetch(makeResponse({ conversations: [conv], meta: { total: 1, nextPageUrl: null } }));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    const result = await client.listConversations({ contactId: FAKE_CONTACT_ID });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("conv_x");
    expect(result[0].contactId).toBe(FAKE_CONTACT_ID);
    expect(result[0].type).toBe("Email");
    expect(result[0].unreadCount).toBe(2);
    expect(result[0].lastMessageBody).toBe("Hello, we look forward to your wedding!");
  });

  it("returns an empty array when conversations is absent from the response", async () => {
    stubFetch(makeResponse({ meta: { total: 0, nextPageUrl: null } }));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    const result = await client.listConversations({ contactId: FAKE_CONTACT_ID });

    expect(result).toEqual([]);
  });

  it("throws a descriptive error on non-200", async () => {
    stubFetch(makeResponse({ message: "Location not found" }, 404));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await expect(
      client.listConversations({ contactId: FAKE_CONTACT_ID })
    ).rejects.toThrow(/GHL API error 404/);
  });

  it("includes the GHL error message in the thrown error on 401", async () => {
    stubFetch(makeResponse({ message: "Unauthorized" }, 401));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await expect(
      client.listConversations({ contactId: FAKE_CONTACT_ID })
    ).rejects.toThrow(/Unauthorized/);
  });
});

// ── getMessages ───────────────────────────────────────────────────────────────

describe("createGhlClient — getMessages", () => {
  it("sends GET to /conversations/{id}/messages with Bearer + Version headers", async () => {
    const fetchSpy = stubFetch(
      makeResponse({ messages: { messages: [makeMessage()] }, meta: { total: 1, nextPageUrl: null } })
    );
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.getMessages(FAKE_CONVERSATION_ID);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`${GHL_BASE}/conversations/${FAKE_CONVERSATION_ID}/messages`);
    expect(init.method ?? "GET").toBe("GET");

    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(headers.get("Version")).toBe(GHL_VERSION);
  });

  it("does NOT send a Content-Type header on GET", async () => {
    stubFetch(
      makeResponse({ messages: { messages: [] }, meta: { total: 0, nextPageUrl: null } })
    );
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.getMessages(FAKE_CONVERSATION_ID);

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("maps the response to GhlMessage[]", async () => {
    const msg = makeMessage({
      id: "msg_y",
      body: "See you on the day!",
      direction: "inbound",
      type: "WhatsApp",
    });
    stubFetch(
      makeResponse({ messages: { messages: [msg] }, meta: { total: 1, nextPageUrl: null } })
    );
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    const result = await client.getMessages(FAKE_CONVERSATION_ID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("msg_y");
    expect(result[0].body).toBe("See you on the day!");
    expect(result[0].direction).toBe("inbound");
    expect(result[0].type).toBe("WhatsApp");
    expect(result[0].conversationId).toBe(FAKE_CONVERSATION_ID);
  });

  it("returns an empty array when the messages list is empty", async () => {
    stubFetch(
      makeResponse({ messages: { messages: [] }, meta: { total: 0, nextPageUrl: null } })
    );
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    const result = await client.getMessages(FAKE_CONVERSATION_ID);

    expect(result).toEqual([]);
  });

  it("throws a descriptive error on non-200", async () => {
    stubFetch(makeResponse({ message: "Conversation not found" }, 404));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await expect(client.getMessages("conv_missing")).rejects.toThrow(/GHL API error 404/);
  });

  it("includes the GHL error message in the thrown error on 422", async () => {
    stubFetch(makeResponse({ message: "Invalid conversation id" }, 422));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await expect(client.getMessages("bad_id")).rejects.toThrow(/Invalid conversation id/);
  });
});

// ── sendMessage ───────────────────────────────────────────────────────────────

describe("createGhlClient — sendMessage", () => {
  it("sends POST to /conversations/messages with Bearer + Version + Content-Type headers", async () => {
    const fetchSpy = stubFetch(
      makeResponse({ message: makeMessage(), conversationId: FAKE_CONVERSATION_ID })
    );
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.sendMessage({
      contactId: FAKE_CONTACT_ID,
      type: "SMS",
      message: "Your venue is confirmed!",
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`${GHL_BASE}/conversations/messages`);
    expect(init.method).toBe("POST");

    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(headers.get("Version")).toBe(GHL_VERSION);
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("sends contactId, type, and message in the request body", async () => {
    stubFetch(
      makeResponse({ message: makeMessage(), conversationId: FAKE_CONVERSATION_ID })
    );
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.sendMessage({
      contactId: FAKE_CONTACT_ID,
      type: "SMS",
      message: "Your venue is confirmed!",
    });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      contactId: string;
      type: string;
      message: string;
    };

    expect(body.contactId).toBe(FAKE_CONTACT_ID);
    expect(body.type).toBe("SMS");
    expect(body.message).toBe("Your venue is confirmed!");
  });

  it("sends Email type with optional subject and html fields", async () => {
    stubFetch(
      makeResponse({ message: makeMessage({ type: "Email" }), conversationId: FAKE_CONVERSATION_ID })
    );
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.sendMessage({
      contactId: FAKE_CONTACT_ID,
      type: "Email",
      message: "Your venue is confirmed!",
      subject: "Venue Confirmation",
      html: "<p>Your venue is confirmed!</p>",
    });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      contactId: string;
      type: string;
      message: string;
      subject?: string;
      html?: string;
    };

    expect(body.type).toBe("Email");
    expect(body.subject).toBe("Venue Confirmation");
    expect(body.html).toBe("<p>Your venue is confirmed!</p>");
  });

  it("returns the sent GhlMessage on success", async () => {
    const sentMsg = makeMessage({ id: "msg_sent_001", body: "Your venue is confirmed!", direction: "outbound" });
    stubFetch(
      makeResponse({ message: sentMsg, conversationId: FAKE_CONVERSATION_ID })
    );
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    const result = await client.sendMessage({
      contactId: FAKE_CONTACT_ID,
      type: "SMS",
      message: "Your venue is confirmed!",
    });

    expect(result.id).toBe("msg_sent_001");
    expect(result.body).toBe("Your venue is confirmed!");
    expect(result.direction).toBe("outbound");
  });

  it("throws a descriptive error on non-200", async () => {
    stubFetch(makeResponse({ message: "Contact not found" }, 404));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await expect(
      client.sendMessage({
        contactId: "contact_missing",
        type: "SMS",
        message: "Hello",
      })
    ).rejects.toThrow(/GHL API error 404/);
  });

  it("includes the GHL error message in the thrown error on 400", async () => {
    stubFetch(makeResponse({ message: "type is required" }, 400));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await expect(
      client.sendMessage({
        contactId: FAKE_CONTACT_ID,
        type: "SMS",
        message: "",
      })
    ).rejects.toThrow(/type is required/);
  });

  it("throws on 500 server error with method context", async () => {
    stubFetch(makeResponse({ message: "Internal Server Error" }, 500));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await expect(
      client.sendMessage({
        contactId: FAKE_CONTACT_ID,
        type: "WhatsApp",
        message: "Hello!",
      })
    ).rejects.toThrow(/GHL API error 500/);
  });
});

// ── searchConversations (location-wide inbox) ───────────────────────────────────

describe("createGhlClient — searchConversations", () => {
  it("sends GET to /conversations/search with locationId, status and sort — no contactId", async () => {
    const fetchSpy = stubFetch(makeResponse({ conversations: [] }));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.searchConversations({ status: "unread" });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`${GHL_BASE}/conversations/search`);
    expect(url).toContain(`locationId=${FAKE_LOCATION_ID}`);
    expect(url).toContain("status=unread");
    expect(url).toContain("sortBy=last_message_date");
    expect(url).not.toContain("contactId=");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("defaults status to 'all' when omitted", async () => {
    const fetchSpy = stubFetch(makeResponse({ conversations: [] }));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.searchConversations();

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("status=all");
  });

  it("maps contactName from fullName and normalises the channel type", async () => {
    stubFetch(
      makeResponse({
        conversations: [
          {
            ...makeConversation({ id: "c1" }),
            type: "TYPE_PHONE",
            lastMessageType: "TYPE_PHONE",
            fullName: "Jane & John",
            contactName: null,
          },
        ],
      }),
    );
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    const result = await client.searchConversations({ status: "all" });

    expect(result).toHaveLength(1);
    expect(result[0].contactName).toBe("Jane & John");
    expect(result[0].type).toBe("SMS"); // TYPE_PHONE → SMS
  });

  it("returns an empty array when conversations is absent", async () => {
    stubFetch(makeResponse({ meta: { total: 0 } }));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    const result = await client.searchConversations();
    expect(result).toEqual([]);
  });

  it("throws a descriptive error on non-200", async () => {
    stubFetch(makeResponse({ message: "Location not found" }, 404));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await expect(client.searchConversations()).rejects.toThrow(/GHL API error 404/);
  });
});
