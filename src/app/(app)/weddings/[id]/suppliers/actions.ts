"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables, Database } from "@/lib/supabase/types";

type WeddingSupplierUpdate =
  Database["public"]["Tables"]["wedding_suppliers"]["Update"];

// ── Exported row types ─────────────────────────────────────────────────────────

export type WeddingSupplierRow = Tables<"wedding_suppliers">;
export type DirectorySupplierRow = Tables<"suppliers">;
export type WeddingDocumentRow = Tables<"wedding_documents">;

// ── Shared revalidation helper ─────────────────────────────────────────────────

function revalidateSuppliers(weddingId: string) {
  revalidatePath(`/weddings/${weddingId}/suppliers`);
}

// ── attachSupplierFromDirectory ────────────────────────────────────────────────

const AttachFromDirectorySchema = z.object({
  weddingId: z.string().uuid("Invalid wedding ID"),
  supplierId: z.string().uuid("Invalid supplier ID"),
});

/**
 * Attach a venue-directory supplier to this wedding.
 * Copies snapshot fields (name, category, contact_name, phone, email, website)
 * but keeps directory_supplier_id for traceability.
 * RLS guards venue_id; admin client used to cross-check ownership.
 */
export async function attachSupplierFromDirectory(input: {
  weddingId: string;
  supplierId: string;
}): Promise<ActionResult<WeddingSupplierRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = AttachFromDirectorySchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  // Verify the directory supplier belongs to this venue
  const { data: dir, error: dirErr } = await admin
    .from("suppliers")
    .select("id, name, category, contact_name, phone, email, website")
    .eq("id", parsed.data.supplierId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (dirErr || !dir) {
    return err("Supplier not found in your directory.");
  }

  // Verify the wedding belongs to this venue
  const { data: wedding, error: wErr } = await admin
    .from("weddings")
    .select("id")
    .eq("id", parsed.data.weddingId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (wErr || !wedding) return err("Wedding not found.");

  const { data: inserted, error: insErr } = await admin
    .from("wedding_suppliers")
    .insert({
      venue_id: ctx.venue.id,
      wedding_id: parsed.data.weddingId,
      supplier_id: parsed.data.supplierId,
      name: dir.name,
      category: dir.category,
      contact_name: dir.contact_name ?? null,
      phone: dir.phone ?? null,
      email: dir.email ?? null,
      status: "enquired",
    })
    .select()
    .single();

  if (insErr || !inserted) {
    console.error("attachSupplierFromDirectory failed:", insErr?.message);
    return err("Could not attach supplier. They may already be on this wedding.");
  }

  revalidateSuppliers(parsed.data.weddingId);
  return ok(inserted as WeddingSupplierRow);
}

// ── attachAdHocSupplier ────────────────────────────────────────────────────────

const AttachAdHocSchema = z.object({
  weddingId: z.string().uuid("Invalid wedding ID"),
  name: z.string().min(1, "Name is required").max(120, "Name too long"),
  category: z.string().min(1, "Category is required").max(80, "Category too long"),
  contactName: z.string().max(120, "Contact name too long").optional().or(z.literal("")),
  phone: z.string().max(40, "Phone too long").optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  notes: z.string().max(1000, "Notes too long").optional().or(z.literal("")),
});

export type AttachAdHocInput = z.infer<typeof AttachAdHocSchema>;

/**
 * Attach an ad-hoc supplier (not in the venue directory) to this wedding.
 * supplier_id is null; all details provided directly.
 */
export async function attachAdHocSupplier(
  input: AttachAdHocInput,
): Promise<ActionResult<WeddingSupplierRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = AttachAdHocSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  // Verify the wedding belongs to this venue
  const { data: wedding, error: wErr } = await admin
    .from("weddings")
    .select("id")
    .eq("id", parsed.data.weddingId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (wErr || !wedding) return err("Wedding not found.");

  const { data: inserted, error: insErr } = await admin
    .from("wedding_suppliers")
    .insert({
      venue_id: ctx.venue.id,
      wedding_id: parsed.data.weddingId,
      supplier_id: null,
      name: parsed.data.name,
      category: parsed.data.category,
      contact_name: parsed.data.contactName || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
      status: "enquired",
    })
    .select()
    .single();

  if (insErr || !inserted) {
    console.error("attachAdHocSupplier failed:", insErr?.message);
    return err("Could not add supplier. Please try again.");
  }

  revalidateSuppliers(parsed.data.weddingId);
  return ok(inserted as WeddingSupplierRow);
}

// ── updateWeddingSupplier ──────────────────────────────────────────────────────

const VALID_STATUSES = ["confirmed", "pending", "enquired", "declined"] as const;

const UpdateWeddingSupplierSchema = z.object({
  weddingId: z.string().uuid("Invalid wedding ID"),
  weddingSupplierRowId: z.string().uuid("Invalid row ID"),
  status: z.enum(VALID_STATUSES).optional(),
  notes: z.string().max(2000, "Notes too long").optional().nullable(),
  arrivalTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Arrival time must be HH:MM")
    .optional()
    .nullable(),
});

export type UpdateWeddingSupplierInput = z.infer<typeof UpdateWeddingSupplierSchema>;

/**
 * Update a wedding supplier's status, notes, or arrival time.
 * Scoped to venue_id AND wedding_id to prevent cross-wedding writes.
 */
export async function updateWeddingSupplier(
  input: UpdateWeddingSupplierInput,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = UpdateWeddingSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  const patch: WeddingSupplierUpdate = {};
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (parsed.data.arrivalTime !== undefined)
    patch.arrival_time = parsed.data.arrivalTime;

  if (Object.keys(patch).length === 0) return ok(undefined);

  const { error } = await admin
    .from("wedding_suppliers")
    .update(patch)
    .eq("id", parsed.data.weddingSupplierRowId)
    .eq("wedding_id", parsed.data.weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("updateWeddingSupplier failed:", error.message);
    return err("Could not update supplier.");
  }

  revalidateSuppliers(parsed.data.weddingId);
  return ok(undefined);
}

// ── checkInWeddingSupplier ────────────────────────────────────────────────────

const CheckInSchema = z.object({
  weddingId: z.string().uuid("Invalid wedding ID"),
  weddingSupplierRowId: z.string().uuid("Invalid row ID"),
});

/**
 * Mark a supplier as checked in on event day by stamping checked_in_at = now().
 * Idempotent: re-calling sets the timestamp again (fine — event-day behaviour).
 */
export async function checkInWeddingSupplier(input: {
  weddingId: string;
  weddingSupplierRowId: string;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = CheckInSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("wedding_suppliers")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("id", parsed.data.weddingSupplierRowId)
    .eq("wedding_id", parsed.data.weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("checkInWeddingSupplier failed:", error.message);
    return err("Could not record check-in.");
  }

  revalidateSuppliers(parsed.data.weddingId);
  return ok(undefined);
}

// ── removeWeddingSupplier ─────────────────────────────────────────────────────

const RemoveSchema = z.object({
  weddingId: z.string().uuid("Invalid wedding ID"),
  weddingSupplierRowId: z.string().uuid("Invalid row ID"),
});

/**
 * Remove a supplier from the wedding (hard delete of the wedding_suppliers row).
 * Any linked wedding_documents have supplier_id set to null via FK (or cascade).
 */
export async function removeWeddingSupplier(input: {
  weddingId: string;
  weddingSupplierRowId: string;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = RemoveSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("wedding_suppliers")
    .delete()
    .eq("id", parsed.data.weddingSupplierRowId)
    .eq("wedding_id", parsed.data.weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("removeWeddingSupplier failed:", error.message);
    return err("Could not remove supplier.");
  }

  revalidateSuppliers(parsed.data.weddingId);
  return ok(undefined);
}

// ── chaseMissingDoc ───────────────────────────────────────────────────────────

const ChaseDocSchema = z.object({
  weddingId: z.string().uuid("Invalid wedding ID"),
  documentId: z.string().uuid("Invalid document ID"),
});

/**
 * Stamp last_chased_at = now() on a wedding_documents row to record a chase.
 * The document is scoped to the venue and wedding.
 */
export async function chaseMissingDoc(input: {
  weddingId: string;
  documentId: string;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = ChaseDocSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("wedding_documents")
    .update({ last_chased_at: new Date().toISOString() })
    .eq("id", parsed.data.documentId)
    .eq("wedding_id", parsed.data.weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("chaseMissingDoc failed:", error.message);
    return err("Could not record chase.");
  }

  revalidateSuppliers(parsed.data.weddingId);
  return ok(undefined);
}
