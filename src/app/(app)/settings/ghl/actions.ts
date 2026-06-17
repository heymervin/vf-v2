"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/ghl/crypto";
import { ghlClient } from "@/lib/ghl/client";
import type { GhlPipelineStageCounts } from "@/lib/ghl/types";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface GhlConnectionStatus {
  connected: boolean;
  locationId: string | null;
  authType: string | null;
}

export interface GhlCounts {
  totalContacts: number;
  pipelineStages: GhlPipelineStageCounts[];
}

// ── connectGhl ────────────────────────────────────────────────────────────────

const ConnectGhlSchema = z.object({
  token: z.string().min(1, "Token is required"),
  locationId: z.string().min(1, "Location ID is required"),
});

/**
 * Store a Private Integration Token (PIT) for a venue.
 * Encrypts the token (SD-8), upserts ghl_credentials, sets venues.mode='bundled'.
 * Owner/admin only.
 */
export async function connectGhl(
  input: z.infer<typeof ConnectGhlSchema>,
): Promise<ActionResult<GhlConnectionStatus>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can connect GoHighLevel.");
  }

  const parsed = ConnectGhlSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { token, locationId } = parsed.data;

  // Encrypt before storing (SD-8)
  let ciphertext: string;
  try {
    ciphertext = encryptToken(token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Encryption failed.";
    console.error("connectGhl: encrypt failed:", msg);
    return err("Token encryption failed — ensure GHL_TOKEN_ENCRYPTION_KEY is set.");
  }

  const admin = createAdminClient();

  // Upsert credentials (service-role — SD-8)
  const { error: credErr } = await admin
    .from("ghl_credentials")
    .upsert(
      {
        venue_id: ctx.venue.id,
        location_id: locationId,
        auth_type: "pit",
        access_token: ciphertext,
        refresh_token: null,
        scopes: null,
        token_expires_at: null,
      },
      { onConflict: "venue_id" },
    );

  if (credErr) {
    console.error("connectGhl: upsert failed:", credErr.message);
    return err("Could not save GHL credentials.");
  }

  // Set venue mode to bundled
  const { error: modeErr } = await admin
    .from("venues")
    .update({ mode: "bundled" })
    .eq("id", ctx.venue.id);

  if (modeErr) {
    console.error("connectGhl: mode update failed:", modeErr.message);
    // Non-fatal — credentials saved, mode update is secondary
  }

  revalidatePath("/settings/ghl");
  return ok({ connected: true, locationId, authType: "pit" });
}

// ── disconnectGhl ─────────────────────────────────────────────────────────────

/**
 * Remove GHL credentials and set venues.mode='standalone'.
 * Owner/admin only.
 */
export async function disconnectGhl(): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can disconnect GoHighLevel.");
  }

  const admin = createAdminClient();

  const { error: credErr } = await admin
    .from("ghl_credentials")
    .delete()
    .eq("venue_id", ctx.venue.id);

  if (credErr) {
    console.error("disconnectGhl: delete failed:", credErr.message);
    return err("Could not remove GHL credentials.");
  }

  const { error: modeErr } = await admin
    .from("venues")
    .update({ mode: "standalone" })
    .eq("id", ctx.venue.id);

  if (modeErr) {
    console.error("disconnectGhl: mode update failed:", modeErr.message);
    return err("Credentials removed but could not set standalone mode.");
  }

  revalidatePath("/settings/ghl");
  return ok(undefined);
}

// ── testGhlConnection ─────────────────────────────────────────────────────────

/**
 * Test the stored GHL connection by fetching live counts.
 * Returns totalContacts + pipelineStages on success.
 * Owner/admin only.
 */
export async function testGhlConnection(): Promise<ActionResult<GhlCounts>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can test the GHL connection.");
  }

  let client: Awaited<ReturnType<typeof ghlClient>>;
  try {
    client = await ghlClient(ctx.venue.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    console.error("testGhlConnection: ghlClient threw:", msg);
    return err(`Connection failed: ${msg}`);
  }

  if (!client) {
    return err("No GHL credentials found. Connect GoHighLevel first.");
  }

  try {
    const [contactsResp, pipelineStages] = await Promise.all([
      client.listContacts(1),
      client.getPipelineCounts(),
    ]);

    return ok({
      totalContacts: contactsResp.meta.total,
      pipelineStages,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "GHL API error.";
    console.error("testGhlConnection: API call failed:", msg);
    return err(`GHL API error: ${msg}`);
  }
}
