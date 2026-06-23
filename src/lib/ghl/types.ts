/**
 * Minimal GHL API types for VenueFlow v2.
 *
 * These represent the subset of GHL API response shapes that VF2 reads.
 * GHL is the record of truth; VF2 stores only link keys and a few
 * denormalised display fields (SD-1, D2/D3 in specs/SCHEMA-DECISIONS.md).
 *
 * All GHL API calls use:
 *   Base: https://services.leadconnectorhq.com  (no /v2 segment)
 *   Version: 2021-07-28
 */

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export interface GhlContact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
}

export interface GhlContactsResponse {
  contacts: GhlContact[];
  meta: {
    total: number;
    nextPageUrl: string | null;
    startAfter: number | null;
    startAfterId: string | null;
  };
}

// ---------------------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------------------

/** GHL opportunity status values relevant to VF2. */
export type GhlOpportunityStatus = "open" | "won" | "lost" | "abandoned";

export interface GhlOpportunity {
  id: string;
  name: string;
  /** References a stage in the pipeline; used for aggregation in daily brief. */
  pipelineStageId: string;
  status: GhlOpportunityStatus;
  /** Monetary value in the opportunity's currency (minor units — displayed as-is). */
  monetaryValue: number | null;
  /** GHL contact linked to this opportunity. */
  contactId: string | null;
}

export interface GhlOpportunitiesResponse {
  opportunities: GhlOpportunity[];
  meta: {
    total: number;
    nextPageUrl: string | null;
    startAfter: number | null;
    startAfterId: string | null;
  };
}

// ---------------------------------------------------------------------------
// Pipeline stage aggregate (computed client-side — GHL has no aggregate API)
// See specs/ghl-integration.md §9.1
// ---------------------------------------------------------------------------

export interface GhlPipelineStageCounts {
  pipelineStageId: string;
  count: number;
  totalValue: number;
}

// ---------------------------------------------------------------------------
// Invoices  (specs/ghl-integration.md §8 — Integration Point 4)
//
// Paths (no /v2 prefix):
//   POST   /invoices                  — create
//   GET    /invoices/{invoiceId}      — fetch status
//   POST   /invoices/{invoiceId}/send — send to contact
//
// VF2 maps GHL status → four display values:
//   "awaiting-deposit" | "deposit-paid" | "balance-due" | "paid-in-full"
// ---------------------------------------------------------------------------

/** VF2 display status derived from the raw GHL invoice status string. */
export type GhlInvoiceDisplayStatus =
  | "awaiting-deposit"
  | "deposit-paid"
  | "balance-due"
  | "paid-in-full"
  | "unknown";

/** One line item sent when creating a GHL invoice. */
export interface GhlInvoiceItem {
  name: string;
  description?: string;
  /** Integer quantity. */
  quantity: number;
  /**
   * Unit price in major units (e.g. pounds), as expected by the GHL invoices API.
   * GHL stores this as a float in its own system; we pass the value we hold.
   */
  price: number;
  currency: string;
}

/** Payload for POST /invoices (specs/ghl-integration.md §8). */
export interface GhlCreateInvoicePayload {
  locationId: string;
  /** GHL contact id linked to the wedding. */
  contactId: string;
  /** Human-readable invoice name shown in GHL and emailed to the couple. */
  name: string;
  /** ISO 8601 date string (YYYY-MM-DD). */
  dueDate: string;
  items: GhlInvoiceItem[];
  /** Optional terms / bank details rendered in the invoice body. */
  termsNotes?: string;
}

/** Minimal shape of a GHL invoice object returned by GET /invoices/{id}. */
export interface GhlInvoice {
  id: string;
  /** Raw GHL status string — use `mapGhlInvoiceStatus()` for display. */
  status: string;
  /** ISO 8601 due date. */
  dueDate: string | null;
  /** Total amount in the invoice currency (as returned by GHL — may be a float). */
  total: number;
  currency: string;
  /** Contact linked to this invoice. */
  contactId: string;
}

// ---------------------------------------------------------------------------
// Conversations + Messages  (specs/ghl-integration.md §7 — Integration Point 3)
//
// Paths (no /v2 prefix):
//   GET  /conversations/search?locationId=&contactId=  — list threads
//   GET  /conversations/{id}/messages                  — fetch thread history
//   POST /conversations/messages                       — send a message
//       body: { contactId, type, message[, subject, html] }
//
// VF2 stores NO messages — GHL is the record of truth (locked, D3).
// These types model only the subset VF2 reads and renders.
// ---------------------------------------------------------------------------

/** Channel type for a GHL conversation. */
export type GhlConversationType = "SMS" | "Email" | "WhatsApp" | string;

/** Direction of a GHL message. */
export type GhlMessageDirection = "inbound" | "outbound" | string;

/**
 * A GHL conversation thread as returned inside GET /conversations/search.
 * Minimal shape — VF2 renders thread listing and routes into messages.
 */
export interface GhlConversation {
  id: string;
  contactId: string;
  /** Channel: SMS | Email | WhatsApp (or other GHL-native values). */
  type: GhlConversationType;
  /** Count of messages the staff member has not yet read. */
  unreadCount: number;
  /** Preview text of the most recent message in the thread. */
  lastMessageBody: string | null;
  /** ISO 8601 timestamp of the most recent message. */
  lastMessageDate: string | null;
}

/**
 * A single GHL message as returned inside GET /conversations/{id}/messages.
 * VF2 renders these in the Messages tab — no storage.
 */
export interface GhlMessage {
  id: string;
  conversationId: string;
  /** Message body text (or HTML for Email). */
  body: string;
  /** Channel type matching the parent conversation. */
  type: GhlConversationType;
  /** "inbound" = from the contact; "outbound" = sent by staff. */
  direction: GhlMessageDirection;
  /** ISO 8601 timestamp when the message was added. */
  dateAdded: string;
}

/**
 * Payload for POST /conversations/messages (specs/ghl-integration.md §7.2).
 * The send endpoint takes contactId in the body — not in the URL path.
 */
export interface GhlSendMessagePayload {
  /** GHL contact id (the link key carried by weddings.contact_id → contacts.ghl_contact_id). */
  contactId: string;
  /** Channel — must match the contact's connected channel; SMS is the safest fallback. */
  type: "SMS" | "Email" | "WhatsApp";
  /** Plain-text message body (or text part for Email). */
  message: string;
  /** Email only — subject line. */
  subject?: string;
  /** Email only — HTML body; falls back to message if absent. */
  html?: string;
}

/**
 * Shape of the POST /conversations/messages response body.
 * GHL wraps the created message under a `message` key.
 */
export interface GhlSendMessageResponse {
  message: GhlMessage;
  conversationId: string;
}
