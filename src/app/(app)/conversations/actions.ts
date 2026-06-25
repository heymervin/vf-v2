"use server";

/**
 * Server actions for the Conversations module (contact view + global inbox).
 *
 * Both surfaces send and read through the venue's GHL client. Security boundary:
 * a venue's PIT is scoped to its own GHL location, so a staffer can only ever
 * reach contacts/threads in their own location — the `ghlContactId` /
 * `conversationId` are routing keys within that location, not a trust boundary.
 *
 * No message is stored in VF2; GHL is the record of truth (D3).
 *
 * References: specs/conversations-module.md, specs/ghl-integration.md §7.
 */

import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import { ghlClient } from "@/lib/ghl/client";
import type { GhlMessage } from "@/lib/ghl/types";

// ── sendMessageByContactAction ─────────────────────────────────────────────────

const SendSchema = z.object({
  ghlContactId: z.string().min(1, "Missing contact."),
  type: z.enum(["SMS", "Email", "WhatsApp"]),
  message: z.string().min(1, "Message cannot be empty.").max(2000),
  subject: z.string().max(200).optional(),
});

export type SendByContactInput = z.infer<typeof SendSchema>;

/**
 * Send a message to a GHL contact via the venue's GHL client.
 * Returns the created GhlMessage on success.
 */
export async function sendMessageByContactAction(
  input: SendByContactInput,
): Promise<ActionResult<GhlMessage>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = SendSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { ghlContactId, type, message, subject } = parsed.data;

  const client = await ghlClient(ctx.venue.id);
  if (!client) return err("GHL is not connected for this venue. Connect GHL in Settings.");

  try {
    const created = await client.sendMessage({
      contactId: ghlContactId,
      type,
      message,
      ...(subject ? { subject } : {}),
    });
    return ok(created);
  } catch (e) {
    console.error("[sendMessageByContactAction] failed:", e instanceof Error ? e.message : e);
    return err("Failed to send message. Please try again.");
  }
}

// ── getThreadMessagesAction ────────────────────────────────────────────────────

const ThreadSchema = z.object({
  conversationId: z.string().min(1, "Missing conversation."),
});

/**
 * Load a thread's message history on demand (called when a thread is selected).
 * The venue's PIT can only read its own location's threads.
 */
export async function getThreadMessagesAction(
  input: z.infer<typeof ThreadSchema>,
): Promise<ActionResult<GhlMessage[]>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const parsed = ThreadSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const client = await ghlClient(ctx.venue.id);
  if (!client) return err("GHL is not connected for this venue.");

  try {
    const messages = await client.getMessages(parsed.data.conversationId);
    return ok(messages);
  } catch (e) {
    console.error("[getThreadMessagesAction] failed:", e instanceof Error ? e.message : e);
    return err("Could not load this conversation.");
  }
}
