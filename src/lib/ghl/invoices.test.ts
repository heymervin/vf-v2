/**
 * Unit tests for the GHL invoice methods on createGhlClient.
 *
 * Covers:
 *   1. createInvoice — POST /invoices: correct method, path, headers, body;
 *      happy path returns mapped GhlInvoice.
 *   2. getInvoice   — GET /invoices/{id}: correct method, path, headers;
 *      happy path returns mapped GhlInvoice.
 *   3. sendInvoice  — POST /invoices/{id}/send: correct method, path, headers;
 *      happy path returns void.
 *   4. Non-200 response → createGhlClient throws a descriptive error for every
 *      invoice method.
 *   5. mapGhlInvoiceStatus — pure status-string → display-status mapping.
 *
 * All tests are DB-free and secret-free:
 *   - "server-only" is mocked to a no-op.
 *   - @/lib/supabase/admin is mocked (imported transitively by client.ts).
 *   - @/lib/ghl/crypto is mocked (imported transitively by client.ts).
 *   - global.fetch is replaced with a vi.fn() per test.
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

const FAKE_TOKEN = "pit_test_token_abc123";
const FAKE_LOCATION_ID = "loc_test_abc123";
const FAKE_INVOICE_ID = "inv_ghl_0001";
const FAKE_CONTACT_ID = "contact_ghl_0001";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

// ── helpers ────────────────────────────────────────────────────────────────────

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

/** A realistic GHL invoice object as returned by the API. */
function makeGhlInvoiceResponse(overrides: Partial<{ id: string; status: string }> = {}) {
  return {
    invoice: {
      id: FAKE_INVOICE_ID,
      status: "sent",
      dueDate: "2026-09-01",
      total: 150000,
      currency: "GBP",
      contactId: FAKE_CONTACT_ID,
      ...overrides,
    },
  };
}

// ── module under test (imported after mocks) ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let createGhlClient: typeof import("./client").createGhlClient;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let mapGhlInvoiceStatus: typeof import("./client").mapGhlInvoiceStatus;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("./client");
  createGhlClient = mod.createGhlClient;
  mapGhlInvoiceStatus = mod.mapGhlInvoiceStatus;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── shared fetch spy ──────────────────────────────────────────────────────────

function stubFetch(response: Response) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce(response);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("createGhlClient — createInvoice", () => {
  it("sends POST to /invoices with Bearer + Version headers", async () => {
    const fetchSpy = stubFetch(makeResponse(makeGhlInvoiceResponse()));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.createInvoice({
      locationId: FAKE_LOCATION_ID,
      contactId: FAKE_CONTACT_ID,
      name: "Deposit — Henderson & Carter",
      dueDate: "2026-09-01",
      items: [{ name: "Venue hire", quantity: 1, price: 150000, currency: "GBP" }],
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`${GHL_BASE}/invoices`);
    expect(init.method).toBe("POST");

    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(headers.get("Version")).toBe(GHL_VERSION);
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("sends the correct body shape", async () => {
    stubFetch(makeResponse(makeGhlInvoiceResponse()));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    const payload = {
      locationId: FAKE_LOCATION_ID,
      contactId: FAKE_CONTACT_ID,
      name: "Deposit — Henderson & Carter",
      dueDate: "2026-09-01",
      items: [
        { name: "Venue hire", description: "Full day", quantity: 1, price: 150000, currency: "GBP" },
      ],
      termsNotes: "Bank transfer only.",
    };

    await client.createInvoice(payload);

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as typeof payload;

    expect(body.locationId).toBe(FAKE_LOCATION_ID);
    expect(body.contactId).toBe(FAKE_CONTACT_ID);
    expect(body.name).toBe("Deposit — Henderson & Carter");
    expect(body.dueDate).toBe("2026-09-01");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Venue hire");
    expect(body.items[0].price).toBe(150000);
    expect(body.termsNotes).toBe("Bank transfer only.");
  });

  it("returns a mapped GhlInvoice on success", async () => {
    stubFetch(makeResponse(makeGhlInvoiceResponse({ id: FAKE_INVOICE_ID, status: "sent" })));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    const invoice = await client.createInvoice({
      locationId: FAKE_LOCATION_ID,
      contactId: FAKE_CONTACT_ID,
      name: "Test invoice",
      dueDate: "2026-09-01",
      items: [{ name: "Venue hire", quantity: 1, price: 150000, currency: "GBP" }],
    });

    expect(invoice.id).toBe(FAKE_INVOICE_ID);
    expect(invoice.status).toBe("sent");
    expect(invoice.contactId).toBe(FAKE_CONTACT_ID);
    expect(invoice.total).toBe(150000);
    expect(invoice.currency).toBe("GBP");
  });

  it("throws a descriptive error on non-200", async () => {
    stubFetch(makeResponse({ message: "Invalid payload" }, 422));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await expect(
      client.createInvoice({
        locationId: FAKE_LOCATION_ID,
        contactId: FAKE_CONTACT_ID,
        name: "Test",
        dueDate: "2026-09-01",
        items: [],
      })
    ).rejects.toThrow(/GHL API error 422/);
  });

  it("includes the GHL error message in the thrown error", async () => {
    stubFetch(makeResponse({ message: "contactId is required" }, 400));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await expect(
      client.createInvoice({
        locationId: FAKE_LOCATION_ID,
        contactId: "",
        name: "Test",
        dueDate: "2026-09-01",
        items: [],
      })
    ).rejects.toThrow(/contactId is required/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe("createGhlClient — getInvoice", () => {
  it("sends GET to /invoices/{id} with Bearer + Version headers", async () => {
    const fetchSpy = stubFetch(makeResponse(makeGhlInvoiceResponse()));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.getInvoice(FAKE_INVOICE_ID);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`${GHL_BASE}/invoices/${FAKE_INVOICE_ID}`);
    expect(init.method ?? "GET").toBe("GET");

    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(headers.get("Version")).toBe(GHL_VERSION);
  });

  it("does NOT send a Content-Type header on GET", async () => {
    stubFetch(makeResponse(makeGhlInvoiceResponse()));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.getInvoice(FAKE_INVOICE_ID);

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("returns a mapped GhlInvoice on success", async () => {
    stubFetch(makeResponse(makeGhlInvoiceResponse({ id: FAKE_INVOICE_ID, status: "paid" })));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    const invoice = await client.getInvoice(FAKE_INVOICE_ID);

    expect(invoice.id).toBe(FAKE_INVOICE_ID);
    expect(invoice.status).toBe("paid");
    expect(invoice.dueDate).toBe("2026-09-01");
  });

  it("throws a descriptive error on non-200", async () => {
    stubFetch(makeResponse({ message: "Invoice not found" }, 404));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await expect(client.getInvoice("inv_missing")).rejects.toThrow(/GHL API error 404/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe("createGhlClient — sendInvoice", () => {
  it("sends POST to /invoices/{id}/send with Bearer + Version headers", async () => {
    const fetchSpy = stubFetch(makeResponse({ success: true }));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await client.sendInvoice(FAKE_INVOICE_ID);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`${GHL_BASE}/invoices/${FAKE_INVOICE_ID}/send`);
    expect(init.method).toBe("POST");

    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(headers.get("Version")).toBe(GHL_VERSION);
  });

  it("returns void (undefined) on success", async () => {
    stubFetch(makeResponse({ success: true }));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    const result = await client.sendInvoice(FAKE_INVOICE_ID);

    expect(result).toBeUndefined();
  });

  it("throws a descriptive error on non-200", async () => {
    stubFetch(makeResponse({ message: "Invoice already sent" }, 409));
    const client = createGhlClient({ accessToken: FAKE_TOKEN, locationId: FAKE_LOCATION_ID });

    await expect(client.sendInvoice(FAKE_INVOICE_ID)).rejects.toThrow(/GHL API error 409/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe("mapGhlInvoiceStatus", () => {
  it("maps 'draft' → awaiting-deposit", () => {
    expect(mapGhlInvoiceStatus("draft")).toBe("awaiting-deposit");
  });

  it("maps 'sent' → awaiting-deposit", () => {
    expect(mapGhlInvoiceStatus("sent")).toBe("awaiting-deposit");
  });

  it("maps 'partially_paid' → deposit-paid", () => {
    expect(mapGhlInvoiceStatus("partially_paid")).toBe("deposit-paid");
  });

  it("maps 'payment_processing' → deposit-paid", () => {
    expect(mapGhlInvoiceStatus("payment_processing")).toBe("deposit-paid");
  });

  it("maps 'overdue' → balance-due", () => {
    expect(mapGhlInvoiceStatus("overdue")).toBe("balance-due");
  });

  it("maps 'paid' → paid-in-full", () => {
    expect(mapGhlInvoiceStatus("paid")).toBe("paid-in-full");
  });

  it("maps an unknown status → unknown", () => {
    expect(mapGhlInvoiceStatus("voided")).toBe("unknown");
    expect(mapGhlInvoiceStatus("")).toBe("unknown");
  });
});
