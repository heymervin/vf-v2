"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import type { Tables } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type ProposalRow = Tables<"proposals">;
export type MilestoneRow = Tables<"payment_milestones">;
export type WeddingRow = Tables<"weddings">;

// ---------------------------------------------------------------------------
// Money hub KPIs
// ---------------------------------------------------------------------------

export interface MoneyKpis {
  totalBookedMinor: number;
  totalCollectedMinor: number;
  totalOutstandingMinor: number;
  weddingCount: number;
}

export async function getMoneyKpis(): Promise<ActionResult<MoneyKpis>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const supabase = await createClient();

  // Load all weddings with total_value_minor
  const { data: weddings, error: wErr } = await supabase
    .from("weddings")
    .select("id, total_value_minor")
    .eq("venue_id", ctx.venue.id)
    .neq("status", "cancelled");

  if (wErr) {
    console.error("getMoneyKpis weddings:", wErr.message);
    return err("Could not load wedding data.");
  }

  // Load all paid payment_milestones to derive collected amount
  const { data: milestones, error: mErr } = await supabase
    .from("payment_milestones")
    .select("amount_minor, status, wedding_id")
    .eq("venue_id", ctx.venue.id)
    .in("status", ["paid"]);

  if (mErr) {
    console.error("getMoneyKpis milestones:", mErr.message);
    return err("Could not load payment milestone data.");
  }

  const weddingIds = new Set((weddings ?? []).map((w) => w.id));

  const totalBookedMinor = (weddings ?? []).reduce(
    (sum, w) => sum + (w.total_value_minor ?? 0),
    0,
  );

  const totalCollectedMinor = (milestones ?? [])
    .filter((m) => weddingIds.has(m.wedding_id))
    .reduce((sum, m) => sum + m.amount_minor, 0);

  const totalOutstandingMinor = Math.max(0, totalBookedMinor - totalCollectedMinor);

  return ok({
    totalBookedMinor,
    totalCollectedMinor,
    totalOutstandingMinor,
    weddingCount: (weddings ?? []).length,
  });
}

// ---------------------------------------------------------------------------
// Proposals list (all proposals for the venue)
// ---------------------------------------------------------------------------

export interface ProposalWithWedding extends ProposalRow {
  wedding: Pick<WeddingRow, "couple_names" | "wedding_date"> | null;
}

export async function getProposals(): Promise<ActionResult<ProposalWithWedding[]>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("proposals")
    .select("*, weddings(couple_names, wedding_date)")
    .eq("venue_id", ctx.venue.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getProposals:", error.message);
    return err("Could not load proposals.");
  }

  const proposals: ProposalWithWedding[] = (data ?? []).map((row) => {
    const { weddings, ...rest } = row;
    return {
      ...rest,
      wedding: weddings && !Array.isArray(weddings) ? weddings : null,
    };
  });

  return ok(proposals);
}

// ---------------------------------------------------------------------------
// Bookings payment health (weddings with milestone summary)
// ---------------------------------------------------------------------------

export interface WeddingPaymentHealth {
  id: string;
  couple_names: string;
  wedding_date: string | null;
  total_value_minor: number | null;
  contract_status: string;
  paid_minor: number;
  next_milestone: Pick<MilestoneRow, "label" | "amount_minor" | "due_date" | "status"> | null;
}

export async function getBookingsPaymentHealth(): Promise<
  ActionResult<WeddingPaymentHealth[]>
> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const supabase = await createClient();

  const [weddingsRes, milestonesRes] = await Promise.all([
    supabase
      .from("weddings")
      .select("id, couple_names, wedding_date, total_value_minor, contract_status")
      .eq("venue_id", ctx.venue.id)
      .neq("status", "cancelled")
      .order("wedding_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("payment_milestones")
      .select("wedding_id, label, amount_minor, due_date, status, sort_order")
      .eq("venue_id", ctx.venue.id)
      .order("sort_order", { ascending: true }),
  ]);

  if (weddingsRes.error) {
    console.error("getBookingsPaymentHealth weddings:", weddingsRes.error.message);
    return err("Could not load weddings.");
  }
  if (milestonesRes.error) {
    console.error("getBookingsPaymentHealth milestones:", milestonesRes.error.message);
    return err("Could not load milestones.");
  }

  // Group milestones by wedding_id
  const milestonesByWedding = new Map<string, (typeof milestonesRes.data)[number][]>();
  for (const m of milestonesRes.data ?? []) {
    const arr = milestonesByWedding.get(m.wedding_id) ?? [];
    arr.push(m);
    milestonesByWedding.set(m.wedding_id, arr);
  }

  const result: WeddingPaymentHealth[] = (weddingsRes.data ?? []).map((w) => {
    const wMilestones = milestonesByWedding.get(w.id) ?? [];

    const paid_minor = wMilestones
      .filter((m) => m.status === "paid")
      .reduce((sum, m) => sum + m.amount_minor, 0);

    const PENDING_STATUSES = new Set(["upcoming", "due", "overdue"]);
    const next_milestone =
      wMilestones.find((m) => PENDING_STATUSES.has(m.status)) ?? null;

    return {
      id: w.id,
      couple_names: w.couple_names,
      wedding_date: w.wedding_date,
      total_value_minor: w.total_value_minor,
      contract_status: w.contract_status,
      paid_minor,
      next_milestone: next_milestone
        ? {
            label: next_milestone.label,
            amount_minor: next_milestone.amount_minor,
            due_date: next_milestone.due_date,
            status: next_milestone.status,
          }
        : null,
    };
  });

  return ok(result);
}

// ---------------------------------------------------------------------------
// Create proposal (for a wedding)
// ---------------------------------------------------------------------------

const CreateProposalSchema = z.object({
  weddingId: z.string().uuid(),
});

export async function createProposal(
  input: z.infer<typeof CreateProposalSchema>,
): Promise<ActionResult<ProposalRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = CreateProposalSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input.");

  const supabase = await createClient();

  // Verify the wedding belongs to this venue
  const { data: wedding } = await supabase
    .from("weddings")
    .select("id")
    .eq("id", parsed.data.weddingId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (!wedding) return err("Wedding not found.");

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      venue_id: ctx.venue.id,
      wedding_id: parsed.data.weddingId,
      status: "draft",
      deposit_pct: 25,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createProposal:", error?.message);
    return err("Could not create proposal.");
  }

  revalidatePath("/money");
  return ok(data);
}
