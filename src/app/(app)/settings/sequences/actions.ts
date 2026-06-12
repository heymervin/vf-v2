"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import type { Tables } from "@/lib/supabase/types";

export type SequenceRow = Tables<"sequences">;
export type SequenceStepRow = Tables<"sequence_steps">;

export interface SequenceData {
  sequence: SequenceRow;
  steps: SequenceStepRow[];
}

/**
 * Load (or lazily create) the venue's nurture sequence via the RPC.
 * Returns the sequence row + its 3 steps sorted by step_number.
 */
export async function getOrCreateSequence(): Promise<ActionResult<SequenceData>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const supabase = await createClient();

  const { data: sequence, error: rpcErr } = await supabase.rpc(
    "get_or_create_sequence",
    { p_venue_id: ctx.venue.id },
  );

  if (rpcErr || !sequence) {
    console.error("get_or_create_sequence failed:", rpcErr?.message);
    return err("Could not load sequence settings.");
  }

  const { data: steps, error: stepsErr } = await supabase
    .from("sequence_steps")
    .select("*")
    .eq("venue_id", ctx.venue.id)
    .eq("sequence_id", sequence.id)
    .order("step_number", { ascending: true });

  if (stepsErr || !steps) {
    console.error("sequence_steps load failed:", stepsErr?.message);
    return err("Could not load sequence steps.");
  }

  return ok({ sequence, steps });
}

const UpdateSequenceSchema = z.object({
  sequenceId: z.string().uuid(),
  enabled: z.boolean(),
});

/**
 * Toggle the sequence on or off. Owner/admin only.
 */
export async function updateSequence(
  input: z.infer<typeof UpdateSequenceSchema>,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can change sequence settings.");
  }

  const parsed = UpdateSequenceSchema.safeParse(input);
  if (!parsed.success) return err("Invalid input.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("sequences")
    .update({ enabled: parsed.data.enabled })
    .eq("id", parsed.data.sequenceId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("updateSequence failed:", error.message);
    return err("Could not update sequence.");
  }

  revalidatePath("/settings/sequences");
  return ok(undefined);
}

const UpdateSequenceStepSchema = z.object({
  stepId: z.string().uuid(),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  delay_hours: z.number().int().min(0).max(720),
  enabled: z.boolean(),
});

/**
 * Update a single step's content. Owner/admin only.
 */
export async function updateSequenceStep(
  input: z.infer<typeof UpdateSequenceStepSchema>,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can edit sequence steps.");
  }

  const parsed = UpdateSequenceStepSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return err(firstIssue?.message ?? "Invalid input.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("sequence_steps")
    .update({
      subject: parsed.data.subject,
      body: parsed.data.body,
      delay_hours: parsed.data.delay_hours,
      enabled: parsed.data.enabled,
    })
    .eq("id", parsed.data.stepId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("updateSequenceStep failed:", error.message);
    return err("Could not save step.");
  }

  revalidatePath("/settings/sequences");
  return ok(undefined);
}
