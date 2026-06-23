"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWeddingManual } from "@/lib/weddings/create";
import type { CreateWeddingResult } from "@/lib/weddings/create";

// ── createWedding ──────────────────────────────────────────────────────────────

const CreateWeddingSchema = z.object({
  coupleNames: z
    .string()
    .min(2, "Couple names must be at least 2 characters")
    .max(120, "Couple names must be under 120 characters"),
  coupleEmail: z.string().email("Enter a valid email for Partner A"),
  partnerBEmail: z
    .string()
    .email("Enter a valid email for Partner B")
    .optional()
    .or(z.literal("")),
  weddingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional()
    .or(z.literal("")),
});

export type CreateWeddingInput = z.infer<typeof CreateWeddingSchema>;

/**
 * Manual-create fallback (D6). Any staff member may create a wedding without
 * GHL. Calls the shared domain service from src/lib/weddings/create.ts.
 */
export async function createWedding(
  input: CreateWeddingInput,
): Promise<ActionResult<CreateWeddingResult>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = CreateWeddingSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const { coupleNames, coupleEmail, partnerBEmail, weddingDate } = parsed.data;

  try {
    const result = await createWeddingManual({
      venueId: ctx.venue.id,
      coupleNames,
      coupleEmail,
      partnerBEmail: partnerBEmail || undefined,
      weddingDate: weddingDate || undefined,
    });
    revalidatePath("/weddings");
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    console.error("createWedding action failed:", msg);
    return err("Could not create wedding. Please try again.");
  }
}

// ── updateWeddingStatus ────────────────────────────────────────────────────────

// Matches the DB CHECK on weddings.status (m8 / SD-2).
// ponytail: auto-advance (date-driven planning→completed) deferred — staff set status manually for now.
const VALID_STATUSES = [
  "planning",
  "confirmed",
  "completed",
  "cancelled",
] as const;
type WeddingStatus = (typeof VALID_STATUSES)[number];

const UpdateStatusSchema = z.object({
  weddingId: z.string().uuid("Invalid wedding ID"),
  status: z.enum(VALID_STATUSES),
});

/**
 * Update a wedding's status. Scoped to the current venue via admin delete check
 * — the admin client is used so we can verify venue ownership without RLS.
 */
export async function updateWeddingStatus(input: {
  weddingId: string;
  status: WeddingStatus;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = UpdateStatusSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("weddings")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.weddingId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("updateWeddingStatus failed:", error.message);
    return err("Could not update wedding status.");
  }

  revalidatePath(`/weddings/${parsed.data.weddingId}`);
  revalidatePath("/weddings");
  return ok(undefined);
}

// ── toggleWeddingTask ──────────────────────────────────────────────────────────

const ToggleTaskSchema = z.object({
  taskId: z.string().uuid("Invalid task ID"),
  done: z.boolean(),
});

/** Toggle a wedding_tasks row done/undone. Venue-scoped via the admin client's eq. */
export async function toggleWeddingTask(input: {
  taskId: string;
  done: boolean;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = ToggleTaskSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("wedding_tasks")
    .update({ done: parsed.data.done })
    .eq("id", parsed.data.taskId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("toggleWeddingTask failed:", error.message);
    return err("Could not update task.");
  }
  return ok(undefined);
}
