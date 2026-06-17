"use server";

/**
 * Server actions for the Messages tab.
 *
 * sendMessageAction — sends a message via GHL on behalf of staff.
 * No message is stored in VF2; GHL is the record of truth (D3).
 *
 * Degradation:
 *   - No GHL connection  → err("GHL not connected")
 *   - Wedding not found  → err("Wedding not found")
 *   - No ghl_contact_id → err("No GHL contact linked")
 *
 * References:
 *   specs/ghl-integration.md §7.2 (send endpoint shape)
 *   src/lib/ghl/client.ts (ghlClient + sendMessage)
 */

import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import { ghlClient } from "@/lib/ghl/client";
import { createClient } from "@/lib/supabase/server";
import type { GhlMessage } from "@/lib/ghl/types";

// ── Schema ────────────────────────────────────────────────────────────────────

const SendMessageSchema = z.object({
  weddingId: z.string().uuid("Invalid wedding ID"),
  type: z.enum(["SMS", "Email", "WhatsApp"]),
  message: z.string().min(1, "Message cannot be empty").max(2000),
  subject: z.string().max(200).optional(),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

// ── sendMessageAction ──────────────────────────────────────────────────────────

/**
 * Send a message to the wedding's GHL contact via the GHL Conversations API.
 * Returns the created GhlMessage on success.
 *
 * POST /conversations/messages — contactId in body, not URL (§7.2 correction).
 */
export async function sendMessageAction(
  input: SendMessageInput,
): Promise<ActionResult<GhlMessage>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = SendMessageSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { weddingId, type, message, subject } = parsed.data;

  // Load the wedding to get the GHL contact id — scoped to the current venue.
  const supabase = await createClient();
  const { data: wedding, error: weddingError } = await supabase
    .from("weddings")
    .select("id, ghl_contact_id")
    .eq("id", weddingId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (weddingError) {
    console.error("[sendMessageAction] wedding lookup error:", weddingError.message);
    return err("Could not load wedding.");
  }
  if (!wedding) return err("Wedding not found.");

  const ghlContactId = wedding.ghl_contact_id;
  if (!ghlContactId) {
    return err("No GHL contact linked to this wedding. Connect GHL to send messages.");
  }

  // Resolve the GHL client for this venue.
  const client = await ghlClient(ctx.venue.id);
  if (!client) {
    return err("GHL is not connected for this venue. Connect GHL in Settings.");
  }

  try {
    const created = await client.sendMessage({
      contactId: ghlContactId,
      type,
      message,
      ...(subject ? { subject } : {}),
    });
    return ok(created);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    console.error("[sendMessageAction] sendMessage failed:", msg);
    return err("Failed to send message. Please try again.");
  }
}
