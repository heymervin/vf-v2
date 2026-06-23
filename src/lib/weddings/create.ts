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

/** A couple_accounts row inserted alongside a wedding — enough to send an invite. */
export interface CreatedCoupleAccount {
  id: string;
  email: string;
  weddingId: string;
  venueId: string;
}

export interface CreateWeddingResult {
  weddingId: string;
  /** true when the ghl_opportunity_id already had a wedding row — skipped insert */
  alreadyExisted: boolean;
  /**
   * The couple_accounts rows inserted by this call (empty when alreadyExisted,
   * or when the insert failed non-fatally). Callers use these to send each
   * couple a magic-link invite (Slice 8).
   */
  coupleAccounts: CreatedCoupleAccount[];
}

// ── default seeding (tasks + milestones on booking) ──────────────────────────

/** Default checklist seeded into every new wedding. `offsetDays` is relative to the
 *  wedding date (negative = days before); null = no date dependency. */
const DEFAULT_TASKS: { title: string; category: string; offsetDays: number | null }[] = [
  { title: "Send the couple their portal invite", category: "admin", offsetDays: null },
  { title: "Chase the booking deposit", category: "money", offsetDays: null },
  { title: "Book the menu tasting", category: "planning", offsetDays: -120 },
  { title: "Collect final guest numbers", category: "planning", offsetDays: -28 },
  { title: "Collect the final balance", category: "money", offsetDays: -14 },
  { title: "Final run-sheet sign-off", category: "planning", offsetDays: -7 },
];

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Seed a freshly-created wedding with the default task checklist and — when we have
 * enough to compute them — deposit + balance payment milestones. Best-effort: a
 * seeding failure is logged, never fatal (the wedding row already exists).
 */
async function seedWeddingDefaults(
  admin: ReturnType<typeof createAdminClient>,
  p: { venueId: string; weddingId: string; weddingDate?: string; totalValueMinor?: number },
): Promise<void> {
  const tasks = DEFAULT_TASKS.map((t, i) => ({
    venue_id: p.venueId,
    wedding_id: p.weddingId,
    title: t.title,
    category: t.category,
    sort_index: i,
    due_date: t.offsetDays !== null && p.weddingDate ? addDays(p.weddingDate, t.offsetDays) : null,
  }));
  const { error: taskErr } = await admin.from("wedding_tasks").insert(tasks);
  if (taskErr) console.warn(`seedWeddingDefaults: tasks insert failed — ${taskErr.message}`);

  // ponytail: milestones only when we know both the date and the total — payment_milestones.due_date
  // is NOT NULL and amounts are a share of the total, so neither can be fabricated. The manual
  // "Add milestones" flow on the hub covers weddings booked without a value/date.
  if (p.weddingDate && p.totalValueMinor && p.totalValueMinor > 0) {
    const deposit = Math.round(p.totalValueMinor * 0.25);
    const today = new Date().toISOString().slice(0, 10);
    const milestones = [
      { label: "Booking deposit", amount_minor: deposit, due_date: addDays(today, 14), status: "due", sort_order: 1 },
      { label: "Final balance", amount_minor: p.totalValueMinor - deposit, due_date: addDays(p.weddingDate, -30), status: "upcoming", sort_order: 2 },
    ].map((m) => ({ venue_id: p.venueId, wedding_id: p.weddingId, ...m }));
    const { error: msErr } = await admin.from("payment_milestones").insert(milestones);
    if (msErr) console.warn(`seedWeddingDefaults: milestones insert failed — ${msErr.message}`);
  }
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
    return { weddingId: existing.id, alreadyExisted: true, coupleAccounts: [] };
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
  const { data: couple, error: coupleErr } = await admin
    .from("couple_accounts")
    .insert({
      venue_id: input.venueId,
      wedding_id: wedding.id,
      email: input.coupleEmail,
      role: "partner_a",
      status: "invited",
      invited_at: new Date().toISOString(),
    })
    .select("id, email")
    .single();

  const coupleAccounts: CreatedCoupleAccount[] = [];

  if (coupleErr || !couple) {
    // Non-fatal for the calling Inngest step — log and continue. The
    // couple invite can be re-attempted; the wedding row is already created.
    console.warn(
      `createWeddingFromOpportunity: couple_accounts insert failed — ${coupleErr?.message ?? "no data returned"}`,
    );
  } else {
    coupleAccounts.push({
      id: couple.id,
      email: couple.email,
      weddingId: wedding.id,
      venueId: input.venueId,
    });
  }

  await seedWeddingDefaults(admin, {
    venueId: input.venueId,
    weddingId: wedding.id,
    weddingDate: input.weddingDate,
    totalValueMinor: input.totalValueMinor,
  });

  return { weddingId: wedding.id, alreadyExisted: false, coupleAccounts };
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

  await seedWeddingDefaults(admin, {
    venueId: input.venueId,
    weddingId: wedding.id,
    weddingDate: input.weddingDate,
    totalValueMinor: input.totalValueMinor,
  });

  return { weddingId: wedding.id, alreadyExisted: false, coupleAccounts: [] };
}
