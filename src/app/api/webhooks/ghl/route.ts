/**
 * GHL webhook ingress handler.
 *
 * Security (PIT/Workflow mode — §4.5 of specs/ghl-integration.md):
 *   The GHL Workflow POSTs to this endpoint with an HMAC-SHA256 hex digest
 *   of the raw body in the `x-vf-webhook-secret` header, keyed by
 *   GHL_WEBHOOK_SHARED_SECRET. verifyGhlSignature handles timing-safe
 *   comparison. RSA verification (marketplace mode) is added when the OAuth
 *   app ships; the route will support both auth paths at that point.
 *
 * Flow (per request):
 *   1. Read raw body (before any JSON parse — signature is over wire bytes).
 *   2. Verify HMAC → 401 on failure.
 *   3. Parse payload; extract locationId + webhookId.
 *   4. Resolve venueId from ghl_credentials.location_id → 200 {ignored} if unknown.
 *   5. Dedup via ghl_webhook_events upsert → 200 {duplicate} if seen before.
 *   6. Route by event type:
 *      - OpportunityStatusUpdate / OpportunityStageUpdate → emit ghl/opportunity-won.
 *      - InboundMessage → resolve wedding from ghl_contact_id + venue_id, broadcast
 *        on Supabase Realtime channel "wedding:{weddingId}:messages" (best-effort).
 *      - Everything else → silent 200 ack.
 *   7. Return 200 fast (all business logic is async/Inngest).
 *
 * References:
 *   specs/ghl-integration.md §4 (webhook ingress), §7.3 (realtime inbound)
 *   src/lib/ghl/webhooks.ts   (verifyGhlSignature)
 *   src/inngest/client.ts     (inngest.send)
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyGhlSignature } from "@/lib/ghl/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";

// ── GHL event payload types ───────────────────────────────────────────────────

interface GhlBasePayload {
  webhookId?: string;
  type: string;
  locationId: string;
}

interface GhlOpportunityStatusPayload extends GhlBasePayload {
  type: "OpportunityStatusUpdate";
  id: string;
  contactId: string;
  status: string;
}

interface GhlOpportunityStagePayload extends GhlBasePayload {
  type: "OpportunityStageUpdate";
  id: string;
  contactId: string;
  pipelineStageId?: string;
  stageName?: string;
}

interface GhlInboundMessagePayload extends GhlBasePayload {
  type: "InboundMessage";
  /** GHL contact id — used to resolve the VF2 wedding. */
  contactId: string;
  /** GHL conversation id the message belongs to. */
  conversationId?: string;
  /** GHL message id (for dedup + UI refetch). */
  messageId?: string;
  /** Channel type: SMS | Email | WhatsApp etc. */
  messageType?: string;
}

type GhlPayload =
  | GhlOpportunityStatusPayload
  | GhlOpportunityStagePayload
  | GhlInboundMessagePayload
  | (GhlBasePayload & Record<string, unknown>);

// ── Stage names that signal a booking win ─────────────────────────────────────
// OQ-2: confirm with Mando whether the test sub-account uses status=won or a
// stage name. We treat both paths; adjust BOOKED_STAGE_NAMES as needed.
const BOOKED_STAGE_NAMES = new Set(["Booked", "booked", "Won"]);

// ── handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sharedSecret = process.env.GHL_WEBHOOK_SHARED_SECRET;
  if (!sharedSecret) {
    console.error("[ghl-webhook] GHL_WEBHOOK_SHARED_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  // 1. Raw body — must be read before any JSON parse (sig covers wire bytes).
  const rawBody = await req.text();

  // 2. Verify HMAC signature.
  const signature = req.headers.get("x-vf-webhook-secret") ?? "";
  if (!signature || !verifyGhlSignature(rawBody, signature, sharedSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  // 3. Parse payload.
  let payload: GhlPayload;
  try {
    payload = JSON.parse(rawBody) as GhlPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { locationId, type } = payload;
  const webhookId = payload.webhookId ?? `${type}:${locationId}:${Date.now()}`;

  if (!locationId) {
    return NextResponse.json({ error: "Missing locationId in payload." }, { status: 400 });
  }

  const admin = createAdminClient();

  // 4. Resolve venueId from locationId.
  const { data: creds } = await admin
    .from("ghl_credentials")
    .select("venue_id")
    .eq("location_id", locationId)
    .maybeSingle();

  if (!creds) {
    // Unknown location — not a venue we manage. Ack so GHL stops retrying.
    return NextResponse.json({ received: true, ignored: true });
  }

  const venueId: string = creds.venue_id;

  // 5. Idempotency / dedup via ghl_webhook_events.
  //    upsert with ignoreDuplicates=true → ON CONFLICT DO NOTHING.
  //    If no rows returned, this webhookId was already processed.
  const { data: dedupRows, error: dedupError } = await admin
    .from("ghl_webhook_events")
    .upsert(
      { webhook_id: webhookId, type, venue_id: venueId },
      { onConflict: "webhook_id", ignoreDuplicates: true },
    )
    .select("webhook_id");

  if (dedupError) {
    console.error("[ghl-webhook] dedup insert failed:", dedupError.message);
    return NextResponse.json({ error: "DB error." }, { status: 500 });
  }

  if (!dedupRows || dedupRows.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // 6. Route by event type.
  const isWon = isOpportunityWon(payload);

  if (isWon) {
    const opp = payload as GhlOpportunityStatusPayload | GhlOpportunityStagePayload;
    await inngest.send({
      name: "ghl/opportunity-won",
      data: {
        venueId,
        locationId,
        ghlOpportunityId: opp.id,
        ghlContactId: opp.contactId,
      },
    });
  } else if (payload.type === "InboundMessage") {
    // specs/ghl-integration.md §7.3 — broadcast a Realtime ping so the
    // Messages tab client can refetch. No message body is stored in VF2.
    // Best-effort: failures are logged but never fail the webhook response.
    await broadcastInboundMessage(
      admin,
      venueId,
      payload as GhlInboundMessagePayload,
    );
  }
  // InvoicePaid, ContactUpdate, etc. are handled in later slices; ack silently.

  return NextResponse.json({ received: true });
}

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Return true when the payload represents a booking win — either:
 *   - OpportunityStatusUpdate with status === "won"
 *   - OpportunityStageUpdate with stageName in BOOKED_STAGE_NAMES
 *
 * Double-gated per §4.4 of ghl-integration.md: the Inngest function re-confirms
 * via the GHL API before creating a wedding.
 */
function isOpportunityWon(payload: GhlPayload): boolean {
  if (payload.type === "OpportunityStatusUpdate") {
    const p = payload as GhlOpportunityStatusPayload;
    return p.status === "won";
  }

  if (payload.type === "OpportunityStageUpdate") {
    const p = payload as GhlOpportunityStagePayload;
    return p.stageName != null && BOOKED_STAGE_NAMES.has(p.stageName);
  }

  return false;
}

/**
 * Handle an InboundMessage GHL event (specs/ghl-integration.md §7.3).
 *
 * Resolves the VF2 wedding from the GHL contact id + venue id, then publishes
 * a lightweight "new-message" ping on a Supabase Realtime channel keyed by
 * the wedding id. The client subscribes to this channel and re-fetches the
 * GHL thread — no message body is stored in VF2.
 *
 * This is intentionally best-effort: a failed lookup or broadcast is logged
 * but never causes the webhook to return an error status (we always ack GHL).
 */
async function broadcastInboundMessage(
  admin: ReturnType<typeof createAdminClient>,
  venueId: string,
  payload: GhlInboundMessagePayload,
): Promise<void> {
  try {
    const { contactId, conversationId, messageId, messageType } = payload;

    if (!contactId) {
      console.warn("[ghl-webhook] InboundMessage missing contactId — cannot resolve wedding");
      return;
    }

    // Resolve the wedding via ghl_contact_id scoped to the venue.
    const { data: wedding } = await admin
      .from("weddings")
      .select("id")
      .eq("venue_id", venueId)
      .eq("ghl_contact_id", contactId)
      .maybeSingle();

    if (!wedding) {
      // No wedding linked to this contact yet — nothing to broadcast to.
      console.info(
        `[ghl-webhook] InboundMessage: no wedding found for contactId=${contactId} venueId=${venueId}`,
      );
      return;
    }

    const weddingId = wedding.id;
    const channelName = `wedding:${weddingId}:messages`;

    // Broadcast via REST (no WebSocket needed server-side).
    // The Messages tab client subscribes to this channel and refetches on ping.
    const channel = admin.channel(channelName);
    const result = await channel.send({
      type: "broadcast",
      event: "new-message",
      payload: {
        weddingId,
        contactId,
        conversationId: conversationId ?? null,
        messageId: messageId ?? null,
        messageType: messageType ?? null,
      },
    });

    if (result !== "ok") {
      console.warn(`[ghl-webhook] Realtime broadcast to ${channelName} returned: ${result}`);
    }
  } catch (err) {
    // Best-effort — log and continue so the webhook always returns 200.
    console.error("[ghl-webhook] broadcastInboundMessage error:", err);
  }
}
