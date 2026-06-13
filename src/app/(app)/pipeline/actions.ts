"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import { STAGE_VALUES } from "@/lib/pipeline";

const moveSchema = z.object({
  opportunityId: z.string().uuid(),
  stage: z.enum(STAGE_VALUES as unknown as [string, ...string[]]),
  sortIndex: z.number().finite(),
});

/**
 * Move an opportunity to a stage + in-column position. The stage trigger logs
 * the transition to stage_events automatically. RLS + the explicit venue_id
 * filter both scope the write to the caller's venue.
 *
 * Does NOT revalidate /pipeline — the board updates optimistically and stays
 * authoritative for the session; a hard reload re-fetches from the DB.
 */
export async function moveOpportunity(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return err("Invalid move.");
  const { opportunityId, stage, sortIndex } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .update({ stage: stage as never, sort_index: sortIndex })
    .eq("id", opportunityId)
    .eq("venue_id", ctx.venue.id)
    .select("id, contact_id")
    .maybeSingle();

  if (error) {
    console.error("moveOpportunity failed:", error.message);
    return err("Could not move card, try again.");
  }
  if (!data) return err("Opportunity not found.");

  // Eagerly stop any active nurture enrollment when the opportunity leaves
  // inbound_enquiry. The sequence-run Inngest function rechecks before each
  // send, but this DB write makes the stop immediate and avoids a wasted sleep.
  if (stage !== "inbound_enquiry") {
    const admin = createAdminClient();
    await admin
      .from("sequence_enrollments")
      .update({ status: "stopped", stopped_reason: "stage_moved" })
      .eq("opportunity_id", data.id)
      .eq("venue_id", ctx.venue.id)
      .eq("status", "active");
  }

  // Stage shown on contact surfaces — keep those fresh (board is optimistic).
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${data.contact_id}`);
  return ok({ id: data.id });
}

const stopEnrollmentSchema = z.object({
  opportunityId: z.string().uuid(),
  reason: z.enum(["stage_moved", "replied", "bounced", "disabled", "manual"]),
});

/**
 * Manually stop the active nurture enrollment for an opportunity.
 * Usable from the contact detail UI (e.g. "mark as replied").
 * Scoped to the caller's venue via getTenantContext + explicit venue_id filter.
 */
export async function stopEnrollment(
  input: unknown,
): Promise<ActionResult<{ stopped: boolean }>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = stopEnrollmentSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  const { opportunityId, reason } = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sequence_enrollments")
    .update({ status: "stopped", stopped_reason: reason })
    .eq("opportunity_id", opportunityId)
    .eq("venue_id", ctx.venue.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("stopEnrollment failed:", error.message);
    return err("Could not stop enrollment, try again.");
  }

  return ok({ stopped: data !== null });
}
