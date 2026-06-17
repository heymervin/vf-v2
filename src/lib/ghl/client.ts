/**
 * GHL API client — server-only.
 *
 * Two exports:
 *   createGhlClient(creds) — pure fetch wrapper; accepts token + locationId
 *                            directly. Used in unit tests and by ghlClient().
 *   ghlClient(venueId)     — DB-backed factory; reads ghl_credentials via the
 *                            service-role admin client, decrypts the token, and
 *                            returns createGhlClient(...) — or null if the venue
 *                            has no connected credentials (standalone mode).
 *
 * Auth boundary (specs/ghl-integration.md §12.3): this module is server-only.
 * No token or response secret ever reaches the browser.
 *
 * SD-8: access_token / refresh_token are AES-256-GCM ciphertext in the DB;
 * decryptToken() unwraps them here before use.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "./crypto";
import { ghlApiBase, ghlApiVersion } from "./env";
import type {
  GhlContact,
  GhlContactsResponse,
  GhlOpportunitiesResponse,
  GhlPipelineStageCounts,
  GhlCreateInvoicePayload,
  GhlInvoice,
  GhlInvoiceDisplayStatus,
  GhlConversation,
  GhlMessage,
  GhlSendMessagePayload,
} from "./types";

// ── internal types ────────────────────────────────────────────────────────────

interface GhlClientCreds {
  accessToken: string;
  locationId: string;
}

interface GhlClientInstance {
  locationId: string;
  /** Generic request helper — path must start with "/" e.g. "/contacts/abc". */
  request<T>(path: string, init?: RequestInit): Promise<T>;
  getContact(id: string): Promise<GhlContact>;
  listContacts(limit?: number): Promise<GhlContactsResponse>;
  listOpportunities(limit?: number): Promise<GhlOpportunitiesResponse>;
  getPipelineCounts(): Promise<GhlPipelineStageCounts[]>;
  // ── Integration Point 4 — Invoices (specs/ghl-integration.md §8) ──────────
  createInvoice(payload: GhlCreateInvoicePayload): Promise<GhlInvoice>;
  getInvoice(invoiceId: string): Promise<GhlInvoice>;
  /** Send the invoice to the couple. Resolves void on success. */
  sendInvoice(invoiceId: string): Promise<void>;
  // ── Integration Point 3 — Messaging Mirror (specs/ghl-integration.md §7) ──
  /**
   * List conversation threads for a GHL contact.
   * GET /conversations/search?locationId=&contactId=
   */
  listConversations(params: { contactId: string }): Promise<GhlConversation[]>;
  /**
   * Fetch the message history for a single conversation thread.
   * GET /conversations/{conversationId}/messages
   */
  getMessages(conversationId: string): Promise<GhlMessage[]>;
  /**
   * Send a message from VF2 via GHL.
   * POST /conversations/messages — contactId lives in the body, not the URL.
   * Returns the created GhlMessage.
   */
  sendMessage(payload: GhlSendMessagePayload): Promise<GhlMessage>;
}

// ── createGhlClient ───────────────────────────────────────────────────────────

/**
 * Build a GHL API client from explicit credentials.
 * This is the pure layer — no DB reads, no decryption. Suitable for unit tests.
 */
export function createGhlClient(creds: GhlClientCreds): GhlClientInstance {
  const { accessToken, locationId } = creds;
  const base = ghlApiBase();
  const version = ghlApiVersion();

  /** Shared headers required on every GHL request (§2.2 of ghl-integration.md). */
  function buildHeaders(extra?: Record<string, string>): Headers {
    const h = new Headers({
      Authorization: `Bearer ${accessToken}`,
      Version: version,
      Accept: "application/json",
      ...extra,
    });
    return h;
  }

  /**
   * Generic fetch wrapper. Throws a descriptive error on any non-2xx response
   * so callers don't have to inspect status codes.
   */
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${base}${path}`;
    const headers = buildHeaders(
      init.method === "POST" || init.method === "PUT"
        ? { "Content-Type": "application/json" }
        : undefined
    );

    const res = await fetch(url, { ...init, headers });

    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { message?: string };
        detail = body.message ? ` — ${body.message}` : "";
      } catch {
        // Response body wasn't JSON; ignore.
      }
      throw new Error(`GHL API error ${res.status}${detail} [${init.method ?? "GET"} ${path}]`);
    }

    return res.json() as Promise<T>;
  }

  /** Fetch a single GHL contact by id. */
  async function getContact(id: string): Promise<GhlContact> {
    const data = await request<{ contact: GhlContact }>(`/contacts/${id}`);
    return data.contact;
  }

  /**
   * List contacts for the connected location.
   * GHL requires locationId as a query param for list endpoints.
   */
  async function listContacts(limit = 20): Promise<GhlContactsResponse> {
    const params = new URLSearchParams({
      locationId,
      limit: String(limit),
    });
    return request<GhlContactsResponse>(`/contacts?${params.toString()}`);
  }

  /**
   * Search opportunities for the connected location.
   * GHL's search endpoint uses `location_id` (snake_case) as the filter key.
   */
  async function listOpportunities(limit = 100): Promise<GhlOpportunitiesResponse> {
    const params = new URLSearchParams({
      location_id: locationId,
      limit: String(limit),
    });
    return request<GhlOpportunitiesResponse>(`/opportunities/search?${params.toString()}`);
  }

  /**
   * Aggregate open opportunities by pipeline stage.
   *
   * GHL has no aggregate API (specs/ghl-integration.md §9.1) — we fetch all
   * opportunities and group client-side. Suitable for the daily brief (once/day);
   * do not call on every page load.
   */
  async function getPipelineCounts(): Promise<GhlPipelineStageCounts[]> {
    const result = await listOpportunities(100);
    const map = new Map<string, GhlPipelineStageCounts>();

    for (const opp of result.opportunities) {
      const existing = map.get(opp.pipelineStageId);
      if (existing) {
        existing.count += 1;
        existing.totalValue += opp.monetaryValue ?? 0;
      } else {
        map.set(opp.pipelineStageId, {
          pipelineStageId: opp.pipelineStageId,
          count: 1,
          totalValue: opp.monetaryValue ?? 0,
        });
      }
    }

    return Array.from(map.values());
  }

  // ── Integration Point 4 — Invoices ────────────────────────────────────────

  /**
   * Create a GHL invoice for a contact.
   * POST /invoices — specs/ghl-integration.md §8.
   */
  async function createInvoice(payload: GhlCreateInvoicePayload): Promise<GhlInvoice> {
    const data = await request<{ invoice: GhlInvoice }>("/invoices", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.invoice;
  }

  /**
   * Fetch the current state of a GHL invoice by id.
   * GET /invoices/{invoiceId} — used to refresh payment_milestones.ghl_invoice_id status.
   */
  async function getInvoice(invoiceId: string): Promise<GhlInvoice> {
    const data = await request<{ invoice: GhlInvoice }>(`/invoices/${invoiceId}`);
    return data.invoice;
  }

  /**
   * Send an existing GHL invoice to the contact (triggers a GHL email/notification).
   * POST /invoices/{invoiceId}/send.
   * Returns void — callers only need to know it succeeded or threw.
   */
  async function sendInvoice(invoiceId: string): Promise<void> {
    await request<unknown>(`/invoices/${invoiceId}/send`, { method: "POST" });
  }

  // ── Integration Point 3 — Messaging Mirror ───────────────────────────────

  /**
   * List conversation threads for a given GHL contact.
   * GET /conversations/search?locationId={loc}&contactId={id}
   * Returns an empty array if the response carries no conversations key.
   */
  async function listConversations(params: { contactId: string }): Promise<GhlConversation[]> {
    const qs = new URLSearchParams({
      locationId,
      contactId: params.contactId,
    });
    const data = await request<{ conversations?: GhlConversation[] }>(
      `/conversations/search?${qs.toString()}`
    );
    return data.conversations ?? [];
  }

  /**
   * Fetch the message history for a single conversation thread.
   * GET /conversations/{conversationId}/messages
   *
   * GHL wraps the array under data.messages.messages (a nested object).
   * Returns an empty array when the inner list is absent.
   */
  async function getMessages(conversationId: string): Promise<GhlMessage[]> {
    const data = await request<{ messages?: { messages?: GhlMessage[] } }>(
      `/conversations/${conversationId}/messages`
    );
    return data.messages?.messages ?? [];
  }

  /**
   * Send a message from VF2 via GHL.
   * POST /conversations/messages — contactId in the body, not the URL path
   * (specs/ghl-integration.md §7.2 — corrects the /v2/conversations/{id}/messages path
   * in the original plan).
   */
  async function sendMessage(payload: GhlSendMessagePayload): Promise<GhlMessage> {
    const data = await request<{ message: GhlMessage }>(
      "/conversations/messages",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    return data.message;
  }

  return {
    locationId,
    request,
    getContact,
    listContacts,
    listOpportunities,
    getPipelineCounts,
    createInvoice,
    getInvoice,
    sendInvoice,
    listConversations,
    getMessages,
    sendMessage,
  };
}

// ── ghlClient — DB-backed factory ────────────────────────────────────────────

/**
 * Load a venue's GHL credentials from the database and return a ready-to-use
 * GHL client instance — or null if the venue has no connected credentials
 * (i.e. it is in standalone mode).
 *
 * SD-8: ghl_credentials is SERVICE-ROLE-ONLY. We bypass RLS via createAdminClient()
 * after the caller's own auth/owner check in the server action.
 */
export async function ghlClient(venueId: string): Promise<GhlClientInstance | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ghl_credentials")
    .select("access_token, location_id, auth_type, refresh_token, token_expires_at")
    .eq("venue_id", venueId)
    .single();

  if (error || !data) {
    // No credentials row — venue is in standalone mode.
    return null;
  }

  const { access_token, location_id } = data;

  if (!access_token || !location_id) {
    // Credentials row exists but is incomplete (e.g. connect action partially ran).
    return null;
  }

  // Decrypt the stored ciphertext (SD-8). A corrupt token or a wrong/rotated key
  // must NOT crash callers — treat an undecryptable credential as "not connected".
  let plainToken: string;
  try {
    plainToken = decryptToken(access_token);
  } catch (e) {
    console.error(
      "ghlClient: failed to decrypt GHL token for venue",
      venueId,
      e instanceof Error ? e.message : e,
    );
    return null;
  }

  return createGhlClient({ accessToken: plainToken, locationId: location_id });
}

// ── mapGhlInvoiceStatus ───────────────────────────────────────────────────────

/**
 * Map a raw GHL invoice status string to one of VF2's four display states.
 *
 * GHL status values observed in the API (not exhaustive; unknown values → "unknown"):
 *   draft            — created but not yet sent
 *   sent             — emailed to contact; awaiting payment
 *   partially_paid   — deposit received; balance outstanding
 *   payment_processing — payment in flight
 *   overdue          — past due date, unpaid
 *   paid             — fully settled
 *
 * Display mapping (specs/ghl-integration.md §8):
 *   awaiting-deposit  ← draft | sent
 *   deposit-paid      ← partially_paid | payment_processing
 *   balance-due       ← overdue
 *   paid-in-full      ← paid
 *
 * Pure function — no I/O, no imports. Safe to call in server components and actions.
 */
export function mapGhlInvoiceStatus(ghlStatus: string): GhlInvoiceDisplayStatus {
  switch (ghlStatus) {
    case "draft":
    case "sent":
      return "awaiting-deposit";
    case "partially_paid":
    case "payment_processing":
      return "deposit-paid";
    case "overdue":
      return "balance-due";
    case "paid":
      return "paid-in-full";
    default:
      return "unknown";
  }
}
