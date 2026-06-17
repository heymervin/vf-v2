"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import type { Tables } from "@/lib/supabase/types";
import { computeProposalTotals } from "@/lib/money/proposal";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type ProposalRow = Tables<"proposals">;
export type ProposalLineItemRow = Tables<"proposal_line_items">;
export type PackageRow = Tables<"packages">;
export type PackageLineRow = Tables<"package_lines">;
export type MenuItemRow = Tables<"menu_items">;
export type WeddingRow = Tables<"weddings">;

// ---------------------------------------------------------------------------
// Price library (packages + package_lines + menu_items)
// ---------------------------------------------------------------------------

export interface PriceLibraryPackage extends PackageRow {
  lines: PackageLineRow[];
}

export interface PriceLibraryResult {
  packages: PriceLibraryPackage[];
  menuItems: MenuItemRow[];
}

export async function getPriceLibrary(): Promise<ActionResult<PriceLibraryResult>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const supabase = await createClient();

  const [pkgRes, linesRes, menuRes] = await Promise.all([
    supabase
      .from("packages")
      .select("*")
      .eq("venue_id", ctx.venue.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("package_lines")
      .select("*")
      .eq("venue_id", ctx.venue.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("menu_items")
      .select("*")
      .eq("venue_id", ctx.venue.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (pkgRes.error) return err("Could not load packages.");
  if (linesRes.error) return err("Could not load package lines.");
  if (menuRes.error) return err("Could not load menu items.");

  const linesByPackage = new Map<string, PackageLineRow[]>();
  for (const line of linesRes.data ?? []) {
    const arr = linesByPackage.get(line.package_id) ?? [];
    arr.push(line);
    linesByPackage.set(line.package_id, arr);
  }

  const packages: PriceLibraryPackage[] = (pkgRes.data ?? []).map((pkg) => ({
    ...pkg,
    lines: linesByPackage.get(pkg.id) ?? [],
  }));

  return ok({ packages, menuItems: menuRes.data ?? [] });
}

// ---------------------------------------------------------------------------
// Load proposal with line items + wedding context
// ---------------------------------------------------------------------------

export interface ProposalWithDetails {
  proposal: ProposalRow;
  lineItems: ProposalLineItemRow[];
  wedding: Pick<
    WeddingRow,
    "couple_names" | "wedding_date" | "guest_count_day"
  > | null;
}

export async function getProposalWithDetails(
  proposalId: string,
): Promise<ActionResult<ProposalWithDetails>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const supabase = await createClient();

  const { data: proposal, error: pErr } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (pErr) return err("Could not load proposal.");
  if (!proposal) return err("Proposal not found.");

  const [linesRes, weddingRes] = await Promise.all([
    supabase
      .from("proposal_line_items")
      .select("*")
      .eq("proposal_id", proposalId)
      .eq("venue_id", ctx.venue.id)
      .order("sort_order", { ascending: true }),
    proposal.wedding_id
      ? supabase
          .from("weddings")
          .select("couple_names, wedding_date, guest_count_day")
          .eq("id", proposal.wedding_id)
          .eq("venue_id", ctx.venue.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (linesRes.error) return err("Could not load line items.");

  return ok({
    proposal,
    lineItems: linesRes.data ?? [],
    wedding:
      weddingRes.data && !Array.isArray(weddingRes.data)
        ? weddingRes.data
        : null,
  });
}

// ---------------------------------------------------------------------------
// Upsert line items (replace all on every save — simple, correct)
// ---------------------------------------------------------------------------

export interface LineItemDraft {
  id?: string;
  label: string;
  qty: number;
  unit_minor: number;
  unit_type: string;
  category: string;
  qty_tied_to_guests: boolean;
  discount_pct: number | null;
  package_line_id: string | null;
  sort_order: number;
}

const SaveDraftSchema = z.object({
  proposalId: z.string().uuid(),
  discountType: z.enum(["percentage", "fixed"]).nullable().default(null),
  discountValueMinor: z.number().int().min(0).nullable().default(null),
  depositPct: z.number().int().min(0).max(100).default(25),
  vatPct: z.number().min(0).max(100).nullable().default(null),
  notes: z.string().max(2000).nullable().default(null),
  lineItems: z.array(
    z.object({
      label: z.string().min(1).max(300),
      qty: z.number().int().min(0),
      unit_minor: z.number().int().min(0),
      unit_type: z.string().max(50).default("flat"),
      category: z.string().max(50).default("addon"),
      qty_tied_to_guests: z.boolean().default(false),
      discount_pct: z.number().min(0).max(100).nullable().default(null),
      package_line_id: z.string().uuid().nullable().default(null),
      sort_order: z.number().int().default(0),
    }),
  ),
});

export async function saveProposalDraft(
  input: z.infer<typeof SaveDraftSchema>,
): Promise<ActionResult<ProposalRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = SaveDraftSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input.");

  const supabase = await createClient();

  // Verify the proposal belongs to this venue
  const { data: existing } = await supabase
    .from("proposals")
    .select("id, status")
    .eq("id", parsed.data.proposalId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (!existing) return err("Proposal not found.");
  if (existing.status === "accepted") return err("Cannot edit an accepted proposal.");

  // Compute totals from line items
  const { subtotalMinor, discountMinor, totalMinor } = computeProposalTotals(
    parsed.data.lineItems,
    {
      discount_type: parsed.data.discountType,
      discount_value_minor: parsed.data.discountValueMinor,
    },
  );

  // Update proposal header
  const { data: updatedProposal, error: upErr } = await supabase
    .from("proposals")
    .update({
      discount_type: parsed.data.discountType,
      discount_value_minor: parsed.data.discountValueMinor,
      deposit_pct: parsed.data.depositPct,
      vat_pct: parsed.data.vatPct,
      notes: parsed.data.notes,
      subtotal_minor: subtotalMinor,
      total_minor: totalMinor,
      status: "draft",
    })
    .eq("id", parsed.data.proposalId)
    .eq("venue_id", ctx.venue.id)
    .select()
    .single();

  if (upErr || !updatedProposal) {
    console.error("saveProposalDraft update:", upErr?.message);
    return err("Could not save proposal.");
  }

  // Replace all line items: delete existing, then bulk insert
  const { error: delErr } = await supabase
    .from("proposal_line_items")
    .delete()
    .eq("proposal_id", parsed.data.proposalId)
    .eq("venue_id", ctx.venue.id);

  if (delErr) {
    console.error("saveProposalDraft delete lines:", delErr.message);
    return err("Could not replace line items.");
  }

  if (parsed.data.lineItems.length > 0) {
    const rows = parsed.data.lineItems.map((item) => ({
      proposal_id: parsed.data.proposalId,
      venue_id: ctx.venue.id,
      label: item.label,
      qty: item.qty,
      unit_minor: item.unit_minor,
      unit_type: item.unit_type,
      category: item.category,
      qty_tied_to_guests: item.qty_tied_to_guests,
      discount_pct: item.discount_pct,
      package_line_id: item.package_line_id,
      sort_order: item.sort_order,
    }));

    const { error: insErr } = await supabase
      .from("proposal_line_items")
      .insert(rows);

    if (insErr) {
      console.error("saveProposalDraft insert lines:", insErr.message);
      return err("Could not save line items.");
    }
  }

  revalidatePath(`/money/proposals/${parsed.data.proposalId}/build`);
  revalidatePath("/money");
  return ok(updatedProposal);
}

// ---------------------------------------------------------------------------
// Mark proposal as sent
// ---------------------------------------------------------------------------

const SendProposalSchema = z.object({
  proposalId: z.string().uuid(),
});

export async function sendProposal(
  input: z.infer<typeof SendProposalSchema>,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = SendProposalSchema.safeParse(input);
  if (!parsed.success) return err("Invalid input.");

  const supabase = await createClient();

  const { error } = await supabase
    .from("proposals")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", parsed.data.proposalId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("sendProposal:", error.message);
    return err("Could not mark proposal as sent.");
  }

  revalidatePath(`/money/proposals/${parsed.data.proposalId}/build`);
  revalidatePath("/money");
  return ok(undefined);
}
