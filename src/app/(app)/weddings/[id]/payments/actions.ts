"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { ghlClient, mapGhlInvoiceStatus } from "@/lib/ghl/client";
import type { Tables } from "@/lib/supabase/types";
import type { GhlInvoiceDisplayStatus } from "@/lib/ghl/types";

// ── Lifecycle status helpers ──────────────────────────────────────────────────

/** The four DB-stored lifecycle values for payment_milestones.status. */
export type MilestoneLifecycleStatus = "upcoming" | "due" | "paid" | "overdue";

/**
 * Map a GHL display status to the nearest milestone lifecycle status for DB
 * writes. The GHL display status lives outside the DB; only lifecycle values
 * are stored in payment_milestones.status.
 */
function ghlDisplayToLifecycle(
  displayStatus: GhlInvoiceDisplayStatus,
): MilestoneLifecycleStatus {
  switch (displayStatus) {
    case "awaiting-deposit":
      return "due"; // invoice sent, awaiting payment
    case "deposit-paid":
      return "due"; // partial payment — still outstanding
    case "balance-due":
      return "overdue";
    case "paid-in-full":
      return "paid";
    default:
      return "upcoming"; // unknown — leave as not-yet-due
  }
}
import { majorStringToMinor } from "@/app/(app)/settings/packages/money";

// ── Public re-exports ─────────────────────────────────────────────────────────

export type MilestoneRow = Tables<"payment_milestones">;

export type MilestoneWithStatus = MilestoneRow & {
  displayStatus: GhlInvoiceDisplayStatus | null;
};

// ── Schemas ───────────────────────────────────────────────────────────────────

const WeddingIdSchema = z.object({
  weddingId: z.string().uuid("Invalid wedding ID"),
});

const UpsertMilestoneSchema = z.object({
  id: z.string().uuid().optional(),
  weddingId: z.string().uuid("Invalid wedding ID"),
  label: z.string().min(1, "Label is required").max(200),
  amountPounds: z.string().min(1, "Amount is required"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  status: z.enum(["upcoming", "due", "paid", "overdue"]).default("upcoming"),
});

export type UpsertMilestoneInput = z.infer<typeof UpsertMilestoneSchema>;

const MilestoneIdSchema = z.object({
  milestoneId: z.string().uuid("Invalid milestone ID"),
  weddingId: z.string().uuid("Invalid wedding ID"),
});

const UpdateMilestoneStatusSchema = z.object({
  milestoneId: z.string().uuid("Invalid milestone ID"),
  weddingId: z.string().uuid("Invalid wedding ID"),
  status: z.enum(["upcoming", "due", "paid", "overdue"]),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Verify the wedding belongs to this venue. Returns true if it does. */
async function assertWeddingBelongsToVenue(
  weddingId: string,
  venueId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("weddings")
    .select("id")
    .eq("id", weddingId)
    .eq("venue_id", venueId)
    .maybeSingle();
  return !!data;
}

// ── loadMilestones ─────────────────────────────────────────────────────────────

/**
 * Load all milestones for a wedding, enriched with a GHL display status
 * derived from the stored ghl_invoice_id status.
 *
 * The display status is computed from the milestone's own status column —
 * we do NOT make a live GHL API call on every page load (too slow, and the
 * status is refreshed explicitly by the staff via "refresh" or on send).
 */
export async function loadMilestones(
  weddingId: string,
): Promise<ActionResult<MilestoneWithStatus[]>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const parsed = WeddingIdSchema.safeParse({ weddingId });
  if (!parsed.success) return err("Invalid wedding ID.");

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("payment_milestones")
    .select("*")
    .eq("wedding_id", weddingId)
    .eq("venue_id", ctx.venue.id)
    .order("due_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("loadMilestones failed:", error.message);
    return err("Could not load milestones.");
  }

  const rows: MilestoneWithStatus[] = (data ?? []).map((m) => ({
    ...m,
    displayStatus: m.ghl_invoice_id
      ? (m.status as GhlInvoiceDisplayStatus)
      : null,
  }));

  return ok(rows);
}

// ── upsertMilestone ────────────────────────────────────────────────────────────

/**
 * Create or update a payment milestone for a wedding.
 * amount is passed as a £ string and converted to minor units here.
 */
export async function upsertMilestone(
  input: UpsertMilestoneInput,
): Promise<ActionResult<MilestoneRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = UpsertMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { id, weddingId, label, amountPounds, dueDate, status } = parsed.data;
  const amount_minor = majorStringToMinor(amountPounds);
  if (amount_minor <= 0) return err("Amount must be greater than zero.");

  const belongs = await assertWeddingBelongsToVenue(weddingId, ctx.venue.id);
  if (!belongs) return err("Wedding not found.");

  const admin = createAdminClient();

  if (id) {
    const { data, error } = await admin
      .from("payment_milestones")
      .update({ label, amount_minor, due_date: dueDate, status })
      .eq("id", id)
      .eq("wedding_id", weddingId)
      .eq("venue_id", ctx.venue.id)
      .select()
      .single();

    if (error || !data) {
      console.error("upsertMilestone update failed:", error?.message);
      return err("Could not update milestone.");
    }

    revalidatePath(`/weddings/${weddingId}/payments`);
    revalidatePath(`/weddings/${weddingId}`);
    return ok(data as MilestoneRow);
  }

  const { data, error } = await admin
    .from("payment_milestones")
    .insert({
      venue_id: ctx.venue.id,
      wedding_id: weddingId,
      label,
      amount_minor,
      due_date: dueDate,
      status,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("upsertMilestone insert failed:", error?.message);
    return err("Could not add milestone.");
  }

  revalidatePath(`/weddings/${weddingId}/payments`);
  revalidatePath(`/weddings/${weddingId}`);
  return ok(data as MilestoneRow);
}

// ── deleteMilestone ───────────────────────────────────────────────────────────

export async function deleteMilestone(input: {
  milestoneId: string;
  weddingId: string;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = MilestoneIdSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { milestoneId, weddingId } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("wedding_id", weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("deleteMilestone failed:", error.message);
    return err("Could not delete milestone.");
  }

  revalidatePath(`/weddings/${weddingId}/payments`);
  revalidatePath(`/weddings/${weddingId}`);
  return ok(undefined);
}

// ── updateMilestoneStatus ─────────────────────────────────────────────────────

/** Manually update the status of a milestone (no GHL call). */
export async function updateMilestoneStatus(input: {
  milestoneId: string;
  weddingId: string;
  status: string;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = UpdateMilestoneStatusSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { milestoneId, weddingId, status } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_milestones")
    .update({ status })
    .eq("id", milestoneId)
    .eq("wedding_id", weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("updateMilestoneStatus failed:", error.message);
    return err("Could not update status.");
  }

  revalidatePath(`/weddings/${weddingId}/payments`);
  return ok(undefined);
}

// ── sendGhlInvoice ────────────────────────────────────────────────────────────

export type SendInvoiceInput = {
  milestoneId: string;
  weddingId: string;
  /** GHL contact id — stored on weddings.ghl_contact_id */
  ghlContactId: string;
  /** Label used as the invoice name in GHL */
  invoiceName: string;
  /** Amount in minor units */
  amountMinor: number;
  dueDate: string;
};

export type SendInvoiceResult = {
  ghlInvoiceId: string;
  displayStatus: GhlInvoiceDisplayStatus;
};

/**
 * Create a GHL invoice for a milestone and send it to the couple.
 *
 * Degrades gracefully when the venue has no GHL credentials:
 *   returns err("no-ghl-connection") — callers show a connect prompt.
 *
 * On success: stores the ghl_invoice_id on the milestone and sets status
 * to "due" (invoice sent, awaiting payment).
 */
export async function sendGhlInvoice(
  input: SendInvoiceInput,
): Promise<ActionResult<SendInvoiceResult>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const milestoneSchema = z.object({
    milestoneId: z.string().uuid(),
    weddingId: z.string().uuid(),
    ghlContactId: z.string().min(1),
    invoiceName: z.string().min(1),
    amountMinor: z.number().int().positive(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });

  const parsed = milestoneSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { milestoneId, weddingId, ghlContactId, invoiceName, amountMinor, dueDate } =
    parsed.data;

  const belongs = await assertWeddingBelongsToVenue(weddingId, ctx.venue.id);
  if (!belongs) return err("Wedding not found.");

  // ── GHL client — null means no credentials (standalone mode) ─────────────
  const client = await ghlClient(ctx.venue.id);
  if (!client) return err("no-ghl-connection");

  // ── Create the invoice in GHL ──────────────────────────────────────────────
  let ghlInvoiceId: string;
  try {
    const invoice = await client.createInvoice({
      locationId: client.locationId,
      contactId: ghlContactId,
      name: invoiceName,
      dueDate,
      items: [
        {
          name: invoiceName,
          quantity: 1,
          price: amountMinor / 100, // GHL expects major units (£)
          currency: "GBP",
        },
      ],
    });
    ghlInvoiceId = invoice.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("createInvoice GHL call failed:", msg);
    return err(`Could not create GHL invoice: ${msg}`);
  }

  // ── Send the invoice ───────────────────────────────────────────────────────
  try {
    await client.sendInvoice(ghlInvoiceId);
  } catch (e) {
    // Invoice was created but send failed — still store the id, log the issue.
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("sendInvoice GHL call failed:", msg);
    // Continue — we'll store the invoice id even if the send failed.
  }

  // ── Store ghl_invoice_id on the milestone + update status ─────────────────
  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_milestones")
    .update({
      ghl_invoice_id: ghlInvoiceId,
      // Lifecycle value: invoice sent → milestone is now "due" until paid
      status: "due" satisfies MilestoneLifecycleStatus,
    })
    .eq("id", milestoneId)
    .eq("wedding_id", weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("sendGhlInvoice milestone update failed:", error.message);
    return err("Invoice sent but could not save the invoice ID. Check GHL directly.");
  }

  revalidatePath(`/weddings/${weddingId}/payments`);

  // displayStatus is the GHL-side display concept (returned for UI only, not stored)
  return ok({
    ghlInvoiceId,
    displayStatus: "awaiting-deposit" as GhlInvoiceDisplayStatus,
  });
}

// ── refreshGhlInvoiceStatus ───────────────────────────────────────────────────

/**
 * Fetch the current GHL invoice status for a milestone and update the DB.
 * Degrades gracefully when no GHL credentials.
 */
export async function refreshGhlInvoiceStatus(input: {
  milestoneId: string;
  weddingId: string;
  ghlInvoiceId: string;
}): Promise<ActionResult<GhlInvoiceDisplayStatus>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const parsed = z
    .object({
      milestoneId: z.string().uuid(),
      weddingId: z.string().uuid(),
      ghlInvoiceId: z.string().min(1),
    })
    .safeParse(input);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { milestoneId, weddingId, ghlInvoiceId } = parsed.data;

  const client = await ghlClient(ctx.venue.id);
  if (!client) return err("no-ghl-connection");

  let displayStatus: GhlInvoiceDisplayStatus;
  try {
    const invoice = await client.getInvoice(ghlInvoiceId);
    displayStatus = mapGhlInvoiceStatus(invoice.status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("getInvoice GHL call failed:", msg);
    return err(`Could not fetch invoice status: ${msg}`);
  }

  // Map GHL display status → lifecycle status for the DB write
  const lifecycleStatus = ghlDisplayToLifecycle(displayStatus);
  const admin = createAdminClient();
  await admin
    .from("payment_milestones")
    .update({ status: lifecycleStatus })
    .eq("id", milestoneId)
    .eq("wedding_id", weddingId)
    .eq("venue_id", ctx.venue.id);

  revalidatePath(`/weddings/${weddingId}/payments`);
  return ok(displayStatus);
}
