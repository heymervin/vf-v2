"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Constants ─────────────────────────────────────────────────────────────────
// NOTE: Non-async values cannot be exported from "use server" files.
// Keep all constants/helpers in this file only or move to a sibling module.

const VALID_CATEGORIES = [
  "ceremony",
  "reception",
  "catering",
  "supplier",
  "logistics",
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

// ── Schema ───────────────────────────────────────────────────────────────────

const EventSchema = z.object({
  weddingId: z.string().uuid("Invalid wedding ID"),
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  starts_at_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  duration_min: z.number().int().min(0).max(1440).default(30),
  category: z.enum(VALID_CATEGORIES).default("ceremony"),
  owner: z.string().max(100).default(""),
  notes: z.string().max(1000).optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
});

const UpdateEventSchema = EventSchema.extend({
  eventId: z.string().uuid("Invalid event ID"),
}).omit({ weddingId: true });

const DeleteEventSchema = z.object({
  eventId: z.string().uuid("Invalid event ID"),
  weddingId: z.string().uuid("Invalid wedding ID"),
});

const ToggleDoneSchema = z.object({
  eventId: z.string().uuid("Invalid event ID"),
  weddingId: z.string().uuid("Invalid wedding ID"),
  done: z.boolean(),
});

const ReorderEventSchema = z.object({
  eventId: z.string().uuid("Invalid event ID"),
  weddingId: z.string().uuid("Invalid wedding ID"),
  sort_order: z.number(),
});

// ── addEvent ─────────────────────────────────────────────────────────────────

export type AddEventInput = {
  weddingId: string;
  title: string;
  starts_at_time: string;
  duration_min?: number;
  category?: Category;
  owner?: string;
  notes?: string | null;
  supplier_id?: string | null;
};

export async function addEvent(
  input: AddEventInput,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = EventSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  // Verify the wedding belongs to this venue
  const { data: wedding } = await admin
    .from("weddings")
    .select("id")
    .eq("id", parsed.data.weddingId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (!wedding) return err("Wedding not found.");

  // Compute sort_order: one more than the current max
  const { data: existing } = await admin
    .from("timeline_events")
    .select("sort_order")
    .eq("wedding_id", parsed.data.weddingId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = (existing?.sort_order ?? 0) + 1;

  const { data, error } = await admin
    .from("timeline_events")
    .insert({
      venue_id: ctx.venue.id,
      wedding_id: parsed.data.weddingId,
      title: parsed.data.title,
      starts_at_time: parsed.data.starts_at_time,
      duration_min: parsed.data.duration_min,
      category: parsed.data.category,
      owner: parsed.data.owner || null,
      notes: parsed.data.notes ?? null,
      supplier_id: parsed.data.supplier_id ?? null,
      done: false,
      sort_order,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("addEvent failed:", error?.message);
    return err("Could not add event. Please try again.");
  }

  revalidatePath(`/weddings/${parsed.data.weddingId}/runsheet`);
  revalidatePath(`/weddings/${parsed.data.weddingId}`);
  return ok({ id: data.id });
}

// ── updateEvent ───────────────────────────────────────────────────────────────

export type UpdateEventInput = {
  eventId: string;
  title: string;
  starts_at_time: string;
  duration_min?: number;
  category?: Category;
  owner?: string;
  notes?: string | null;
  supplier_id?: string | null;
};

export async function updateEvent(
  eventId: string,
  weddingId: string,
  input: UpdateEventInput,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = UpdateEventSchema.safeParse({ ...input, eventId });
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  // Verify ownership — event must belong to this venue AND this wedding
  const { data: existing } = await admin
    .from("timeline_events")
    .select("id")
    .eq("id", parsed.data.eventId)
    .eq("venue_id", ctx.venue.id)
    .eq("wedding_id", weddingId)
    .maybeSingle();

  if (!existing) return err("Event not found.");

  const { error } = await admin
    .from("timeline_events")
    .update({
      title: parsed.data.title,
      starts_at_time: parsed.data.starts_at_time,
      duration_min: parsed.data.duration_min,
      category: parsed.data.category,
      owner: parsed.data.owner || null,
      notes: parsed.data.notes ?? null,
      supplier_id: parsed.data.supplier_id ?? null,
    })
    .eq("id", parsed.data.eventId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("updateEvent failed:", error.message);
    return err("Could not update event.");
  }

  revalidatePath(`/weddings/${weddingId}/runsheet`);
  return ok(undefined);
}

// ── deleteEvent ───────────────────────────────────────────────────────────────

export async function deleteEvent(input: {
  eventId: string;
  weddingId: string;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = DeleteEventSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("timeline_events")
    .delete()
    .eq("id", parsed.data.eventId)
    .eq("venue_id", ctx.venue.id)
    .eq("wedding_id", parsed.data.weddingId);

  if (error) {
    console.error("deleteEvent failed:", error.message);
    return err("Could not delete event.");
  }

  revalidatePath(`/weddings/${parsed.data.weddingId}/runsheet`);
  revalidatePath(`/weddings/${parsed.data.weddingId}`);
  return ok(undefined);
}

// ── toggleDone ────────────────────────────────────────────────────────────────

export async function toggleDone(input: {
  eventId: string;
  weddingId: string;
  done: boolean;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = ToggleDoneSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("timeline_events")
    .update({ done: parsed.data.done })
    .eq("id", parsed.data.eventId)
    .eq("venue_id", ctx.venue.id)
    .eq("wedding_id", parsed.data.weddingId);

  if (error) {
    console.error("toggleDone failed:", error.message);
    return err("Could not update event.");
  }

  revalidatePath(`/weddings/${parsed.data.weddingId}/runsheet`);
  return ok(undefined);
}

// ── reorderEvent ──────────────────────────────────────────────────────────────

export async function reorderEvent(input: {
  eventId: string;
  weddingId: string;
  sort_order: number;
}): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = ReorderEventSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("timeline_events")
    .update({ sort_order: parsed.data.sort_order })
    .eq("id", parsed.data.eventId)
    .eq("venue_id", ctx.venue.id)
    .eq("wedding_id", parsed.data.weddingId);

  if (error) {
    console.error("reorderEvent failed:", error.message);
    return err("Could not reorder event.");
  }

  revalidatePath(`/weddings/${parsed.data.weddingId}/runsheet`);
  return ok(undefined);
}
