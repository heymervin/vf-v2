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
 * Revalidates /pipeline so the next navigation/refresh re-fetches from the DB
 * (picking up another staffer's moves). The board still updates optimistically
 * for the acting user and reconciles from the fresh prop on re-render.
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

  // Keep the board fresh for other staffers (the acting user is optimistic) and
  // the stage shown on contact surfaces in sync.
  revalidatePath("/pipeline");
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${data.contact_id}`);
  return ok({ id: data.id });
}
