/**
 * Unit tests for src/lib/ghl/client.ts
 *
 * Tests createGhlClient (the pure fetch wrapper) and ghlClient (the
 * DB-backed factory). All tests are DB-free and secret-free:
 *   - global.fetch is mocked with vi.stubGlobal
 *   - server-only is mocked to a no-op
 *   - @/lib/supabase/admin is mocked to return a fake admin client
 *   - GHL_TOKEN_ENCRYPTION_KEY is set in process.env before importing
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { encryptToken } from "./crypto";

// ── constants ─────────────────────────────────────────────────────────────────

const TEST_ENCRYPTION_KEY = "test-encryption-key-for-client-tests-only";
const FAKE_ACCESS_TOKEN = "ghl_pit_fake_access_token_1234567890";
const FAKE_LOCATION_ID = "loc_test_venue_abc";
const FAKE_VENUE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const FAKE_CONTACT_ID = "contact_xyz_999";
const FAKE_OPP_ID = "opp_abc_111";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

// ── mocks — must be declared before any imports that trigger module load ──────

vi.mock("server-only", () => ({}));

// We'll set up the admin mock per test using a variable we can control.
let mockAdminQueryResult: {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
} = { data: null, error: null };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          single: async () => mockAdminQueryResult,
        }),
      }),
    }),
  }),
}));

// ── module import (after mocks are declared) ──────────────────────────────────

// Imported inside beforeAll so the encryption key is already set.
let createGhlClient: (typeof import("./client"))["createGhlClient"];
let ghlClient: (typeof import("./client"))["ghlClient"];

beforeAll(async () => {
  process.env.GHL_TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  const mod = await import("./client");
  createGhlClient = mod.createGhlClient;
  ghlClient = mod.ghlClient;
});

afterAll(() => {
  delete process.env.GHL_TOKEN_ENCRYPTION_KEY;
});

// ── helper: build a minimal ok JSON response ──────────────────────────────────

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, message = "GHL error"): Response {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── createGhlClient — header assertions ──────────────────────────────────────

describe("createGhlClient — headers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("sends Authorization: Bearer <token> on every request", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(okResponse({ contact: { id: FAKE_CONTACT_ID } }));

    const client = createGhlClient({
      accessToken: FAKE_ACCESS_TOKEN,
      locationId: FAKE_LOCATION_ID,
    });
    await client.getContact(FAKE_CONTACT_ID);

    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe(`Bearer ${FAKE_ACCESS_TOKEN}`);
  });

  it("sends Version: 2021-07-28 on every request", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(okResponse({ contact: { id: FAKE_CONTACT_ID } }));

    const client = createGhlClient({
      accessToken: FAKE_ACCESS_TOKEN,
      locationId: FAKE_LOCATION_ID,
    });
    await client.getContact(FAKE_CONTACT_ID);

    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers as HeadersInit);
    expect(headers.get("Version")).toBe(GHL_VERSION);
  });

  it("sends Accept: application/json on every request", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(okResponse({ contact: { id: FAKE_CONTACT_ID } }));

    const client = createGhlClient({
      accessToken: FAKE_ACCESS_TOKEN,
      locationId: FAKE_LOCATION_ID,
    });
    await client.getContact(FAKE_CONTACT_ID);

    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers as HeadersInit);
    expect(headers.get("Accept")).toBe("application/json");
  });
});

// ── createGhlClient — getContact ─────────────────────────────────────────────

describe("createGhlClient — getContact", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("hits GET /contacts/{id} against the correct base URL", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      okResponse({ contact: { id: FAKE_CONTACT_ID, firstName: "Alice", lastName: "Smith", email: "alice@example.com", phone: null, tags: [] } })
    );

    const client = createGhlClient({
      accessToken: FAKE_ACCESS_TOKEN,
      locationId: FAKE_LOCATION_ID,
    });
    const contact = await client.getContact(FAKE_CONTACT_ID);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${GHL_BASE}/contacts/${FAKE_CONTACT_ID}`);
    expect(contact.id).toBe(FAKE_CONTACT_ID);
    expect(contact.firstName).toBe("Alice");
  });

  it("throws on a non-200 response", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(errorResponse(404, "Contact not found"));

    const client = createGhlClient({
      accessToken: FAKE_ACCESS_TOKEN,
      locationId: FAKE_LOCATION_ID,
    });

    await expect(client.getContact("nonexistent")).rejects.toThrow(/404/);
  });
});

// ── createGhlClient — listContacts ───────────────────────────────────────────

describe("createGhlClient — listContacts", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("hits GET /contacts with locationId as a query param", async () => {
    const mockFetch = vi.mocked(fetch);
    const fakeResponse = {
      contacts: [
        { id: "c1", firstName: "Bob", lastName: "Jones", email: "bob@example.com", phone: null, tags: ["vip"] },
      ],
      meta: { total: 1, nextPageUrl: null, startAfter: null, startAfterId: null },
    };
    mockFetch.mockResolvedValueOnce(okResponse(fakeResponse));

    const client = createGhlClient({
      accessToken: FAKE_ACCESS_TOKEN,
      locationId: FAKE_LOCATION_ID,
    });
    const result = await client.listContacts(10);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain(`${GHL_BASE}/contacts`);
    expect(url).toContain(`locationId=${FAKE_LOCATION_ID}`);
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0].firstName).toBe("Bob");
  });

  it("uses the provided limit in the query", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      okResponse({ contacts: [], meta: { total: 0, nextPageUrl: null, startAfter: null, startAfterId: null } })
    );

    const client = createGhlClient({
      accessToken: FAKE_ACCESS_TOKEN,
      locationId: FAKE_LOCATION_ID,
    });
    await client.listContacts(5);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("limit=5");
  });
});

// ── createGhlClient — listOpportunities ──────────────────────────────────────

describe("createGhlClient — listOpportunities", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("hits GET /opportunities/search with locationId", async () => {
    const mockFetch = vi.mocked(fetch);
    const fakeResponse = {
      opportunities: [
        { id: FAKE_OPP_ID, name: "Wedding 2027", pipelineStageId: "stage_1", status: "open", monetaryValue: 5000, contactId: "c_xyz" },
      ],
      meta: { total: 1, nextPageUrl: null, startAfter: null, startAfterId: null },
    };
    mockFetch.mockResolvedValueOnce(okResponse(fakeResponse));

    const client = createGhlClient({
      accessToken: FAKE_ACCESS_TOKEN,
      locationId: FAKE_LOCATION_ID,
    });
    const result = await client.listOpportunities();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain(`${GHL_BASE}/opportunities/search`);
    expect(url).toContain(`location_id=${FAKE_LOCATION_ID}`);
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].id).toBe(FAKE_OPP_ID);
  });
});

// ── createGhlClient — getPipelineCounts ──────────────────────────────────────

describe("createGhlClient — getPipelineCounts", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("aggregates opportunities by pipelineStageId", async () => {
    const mockFetch = vi.mocked(fetch);
    const fakeResponse = {
      opportunities: [
        { id: "o1", name: "W1", pipelineStageId: "stage_a", status: "open", monetaryValue: 1000, contactId: "c1" },
        { id: "o2", name: "W2", pipelineStageId: "stage_a", status: "open", monetaryValue: 2000, contactId: "c2" },
        { id: "o3", name: "W3", pipelineStageId: "stage_b", status: "open", monetaryValue: 500, contactId: "c3" },
      ],
      meta: { total: 3, nextPageUrl: null, startAfter: null, startAfterId: null },
    };
    mockFetch.mockResolvedValueOnce(okResponse(fakeResponse));

    const client = createGhlClient({
      accessToken: FAKE_ACCESS_TOKEN,
      locationId: FAKE_LOCATION_ID,
    });
    const counts = await client.getPipelineCounts();

    const stageA = counts.find((c) => c.pipelineStageId === "stage_a");
    const stageB = counts.find((c) => c.pipelineStageId === "stage_b");

    expect(stageA).toBeDefined();
    expect(stageA!.count).toBe(2);
    expect(stageA!.totalValue).toBe(3000);

    expect(stageB).toBeDefined();
    expect(stageB!.count).toBe(1);
    expect(stageB!.totalValue).toBe(500);
  });

  it("handles null monetaryValue as 0 in the aggregate", async () => {
    const mockFetch = vi.mocked(fetch);
    const fakeResponse = {
      opportunities: [
        { id: "o1", name: "W1", pipelineStageId: "stage_x", status: "open", monetaryValue: null, contactId: "c1" },
      ],
      meta: { total: 1, nextPageUrl: null, startAfter: null, startAfterId: null },
    };
    mockFetch.mockResolvedValueOnce(okResponse(fakeResponse));

    const client = createGhlClient({
      accessToken: FAKE_ACCESS_TOKEN,
      locationId: FAKE_LOCATION_ID,
    });
    const counts = await client.getPipelineCounts();

    expect(counts[0].totalValue).toBe(0);
  });
});

// ── createGhlClient — error on non-200 ───────────────────────────────────────

describe("createGhlClient — error handling", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("throws a descriptive error on 401 unauthorized", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(errorResponse(401, "Unauthorized"));

    const client = createGhlClient({
      accessToken: "bad-token",
      locationId: FAKE_LOCATION_ID,
    });

    await expect(client.listContacts()).rejects.toThrow(/401/);
  });

  it("throws a descriptive error on 429 rate limit", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(errorResponse(429, "Too Many Requests"));

    const client = createGhlClient({
      accessToken: FAKE_ACCESS_TOKEN,
      locationId: FAKE_LOCATION_ID,
    });

    await expect(client.listContacts()).rejects.toThrow(/429/);
  });

  it("throws a descriptive error on 500 server error", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(errorResponse(500, "Internal Server Error"));

    const client = createGhlClient({
      accessToken: FAKE_ACCESS_TOKEN,
      locationId: FAKE_LOCATION_ID,
    });

    await expect(client.listContacts()).rejects.toThrow(/500/);
  });
});

// ── ghlClient — DB-backed factory ────────────────────────────────────────────

describe("ghlClient — venue credentials lookup", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns null when no ghl_credentials row exists for the venue", async () => {
    // Simulate empty DB result (no creds row).
    mockAdminQueryResult = { data: null, error: null };

    const result = await ghlClient(FAKE_VENUE_ID);
    expect(result).toBeNull();
  });

  it("returns a working client when creds exist and access_token decrypts", async () => {
    // Encrypt a fake token the same way the connect action would.
    const encrypted = encryptToken(FAKE_ACCESS_TOKEN);

    mockAdminQueryResult = {
      data: {
        access_token: encrypted,
        location_id: FAKE_LOCATION_ID,
        auth_type: "pit",
        refresh_token: null,
        token_expires_at: null,
      },
      error: null,
    };

    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      okResponse({ contacts: [], meta: { total: 0, nextPageUrl: null, startAfter: null, startAfterId: null } })
    );

    const client = await ghlClient(FAKE_VENUE_ID);
    expect(client).not.toBeNull();

    // Verify the decrypted token ends up in the Authorization header.
    await client!.listContacts(1);
    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe(`Bearer ${FAKE_ACCESS_TOKEN}`);
  });

  it("returns null when access_token is null (incomplete connection)", async () => {
    mockAdminQueryResult = {
      data: {
        access_token: null,
        location_id: FAKE_LOCATION_ID,
        auth_type: "pit",
        refresh_token: null,
        token_expires_at: null,
      },
      error: null,
    };

    const result = await ghlClient(FAKE_VENUE_ID);
    expect(result).toBeNull();
  });
});
