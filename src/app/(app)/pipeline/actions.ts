"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
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

  // Stage shown on contact surfaces — keep those fresh (board is optimistic).
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${data.contact_id}`);
  return ok({ id: data.id });
}
