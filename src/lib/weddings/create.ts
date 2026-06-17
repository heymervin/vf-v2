/**
 * Wedding domain service — shared by the Inngest opportunity-won function
 * and the manual createWedding server action.
 *
 * Two entry points:
 *   createWeddingFromOpportunity — source=ghl_webhook, idempotent on ghl_opportunity_id
 *   createWeddingManual          — source=manual, no idempotency guard needed
 *
 * Both insert:
 *   1. A `weddings` row via the service-role admin client (bypasses RLS).
 *   2. One or two `couple_accounts` rows (status=invited, invited_at=now).
 *
 * Returns { weddingId, alreadyExisted }.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ── shared result type ────────────────────────────────────────────────────────

export interface CreateWeddingResult {
  weddingId: string;
  /** true when the ghl_opportunity_id already had a wedding row — skipped insert */
  alreadyExisted: boolean;
}

// ── createWeddingFromOpportunity ──────────────────────────────────────────────

export interface CreateWeddingFromOpportunityInput {
  venueId: string;
  ghlOpportunityId: string;
  ghlContactId: string;
  coupleNames: string;
  coupleEmail: string;
  /** ISO date string e.g. "2027-06-12" */
  weddingDate?: string;
  totalValueMinor?: number;
}

/**
 * Idempotent. If a wedding already exists for `ghlOpportunityId` at this venue,
 * returns the existing id without touching the DB again.
 */
export async function createWeddingFromOpportunity(
  input: CreateWeddingFromOpportunityInput,
): Promise<CreateWeddingResult> {
  const admin = createAdminClient();

  // ── idempotency check ──────────────────────────────────────────────────────
  const { data: existing } = await admin
    .from("weddings")
    .select("id")
    .eq("venue_id", input.venueId)
    .eq("ghl_opportunity_id", input.ghlOpportunityId)
    .maybeSingle();

  if (existing) {
    return { weddingId: existing.id, alreadyExisted: true };
  }

  // ── insert wedding row ─────────────────────────────────────────────────────
  const { data: wedding, error: weddingErr } = await admin
    .from("weddings")
    .insert({
      venue_id: input.venueId,
      ghl_opportunity_id: input.ghlOpportunityId,
      ghl_contact_id: input.ghlContactId,
      couple_names: input.coupleNames,
      source: "ghl_webhook",
      status: "planning",
      ...(input.weddingDate !== undefined && { wedding_date: input.weddingDate }),
      ...(input.totalValueMinor !== undefined && { total_value_minor: input.totalValueMinor }),
    })
    .select("id")
    .single();

  if (weddingErr || !wedding) {
    throw new Error(
      `createWeddingFromOpportunity: failed to insert wedding — ${weddingErr?.message ?? "no data returned"}`,
    );
  }

  // ── insert couple_accounts (partner_a) ────────────────────────────────────
  const { error: coupleErr } = await admin.from("couple_accounts").insert({
    venue_id: input.venueId,
    wedding_id: wedding.id,
    email: input.coupleEmail,
    role: "partner_a",
    status: "invited",
    invited_at: new Date().toISOString(),
  });

  if (coupleErr) {
    // Non-fatal for the calling Inngest step — log and continue. The
    // couple invite can be re-attempted; the wedding row is already created.
    console.warn(
      `createWeddingFromOpportunity: couple_accounts insert failed — ${coupleErr.message}`,
    );
  }

  return { weddingId: wedding.id, alreadyExisted: false };
}

// ── createWeddingManual ───────────────────────────────────────────────────────

export interface CreateWeddingManualInput {
  venueId: string;
  coupleNames: string;
  coupleEmail: string;
  /** Optional second partner email — inserts a partner_b couple_accounts row */
  partnerBEmail?: string;
  /** ISO date string e.g. "2027-06-12" */
  weddingDate?: string;
  totalValueMinor?: number;
}

export async function createWeddingManual(
  input: CreateWeddingManualInput,
): Promise<CreateWeddingResult> {
  const admin = createAdminClient();

  // ── insert wedding row ─────────────────────────────────────────────────────
  const { data: wedding, error: weddingErr } = await admin
    .from("weddings")
    .insert({
      venue_id: input.venueId,
      couple_names: input.coupleNames,
      source: "manual",
      status: "planning",
      ...(input.weddingDate !== undefined && { wedding_date: input.weddingDate }),
      ...(input.totalValueMinor !== undefined && { total_value_minor: input.totalValueMinor }),
    })
    .select("id")
    .single();

  if (weddingErr || !wedding) {
    throw new Error(
      `createWeddingManual: failed to insert wedding — ${weddingErr?.message ?? "no data returned"}`,
    );
  }

  const now = new Date().toISOString();

  // ── insert partner_a couple_accounts ──────────────────────────────────────
  const { error: partnerAErr } = await admin.from("couple_accounts").insert({
    venue_id: input.venueId,
    wedding_id: wedding.id,
    email: input.coupleEmail,
    role: "partner_a",
    status: "invited",
    invited_at: now,
  });

  if (partnerAErr) {
    console.warn(`createWeddingManual: partner_a insert failed — ${partnerAErr.message}`);
  }

  // ── optional partner_b couple_accounts ────────────────────────────────────
  if (input.partnerBEmail) {
    const { error: partnerBErr } = await admin.from("couple_accounts").insert({
      venue_id: input.venueId,
      wedding_id: wedding.id,
      email: input.partnerBEmail,
      role: "partner_b",
      status: "invited",
      invited_at: now,
    });

    if (partnerBErr) {
      console.warn(`createWeddingManual: partner_b insert failed — ${partnerBErr.message}`);
    }
  }

  return { weddingId: wedding.id, alreadyExisted: false };
}
