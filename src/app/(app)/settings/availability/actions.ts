"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import type { Tables } from "@/lib/supabase/types";

export type AvailabilityRuleRow = Tables<"availability_rules">;
export type MeetingTypeRow = Tables<"meeting_types">;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const UpsertAvailabilityRuleSchema = z.object({
  membershipId: z.string().uuid(),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm format"),
});

const DeleteAvailabilityRuleSchema = z.object({
  ruleId: z.string().uuid(),
});

const UpdateMeetingTypeSchema = z.object({
  meetingTypeId: z.string().uuid(),
  durationMinutes: z.number().int().min(5).max(480),
  bufferMinutes: z.number().int().min(0).max(120),
  enabled: z.boolean(),
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Load all availability rules for the active venue, plus its meeting types.
 * Returns everything the availability settings page needs.
 */
export async function getAvailabilitySettings(): Promise<
  ActionResult<{ rules: AvailabilityRuleRow[]; meetingTypes: MeetingTypeRow[] }>
> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const supabase = await createClient();

  const [rulesRes, mtRes] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("*")
      .eq("venue_id", ctx.venue.id)
      .order("weekday", { ascending: true }),
    supabase
      .from("meeting_types")
      .select("*")
      .eq("venue_id", ctx.venue.id)
      .order("kind", { ascending: true }),
  ]);

  if (rulesRes.error) {
    console.error("getAvailabilitySettings rules:", rulesRes.error.message);
    return err("Could not load availability rules.");
  }
  if (mtRes.error) {
    console.error("getAvailabilitySettings meeting_types:", mtRes.error.message);
    return err("Could not load meeting types.");
  }

  return ok({ rules: rulesRes.data, meetingTypes: mtRes.data });
}

// ---------------------------------------------------------------------------
// Availability rule mutations (owner/admin only)
// ---------------------------------------------------------------------------

/**
 * Upsert an availability rule for a staff member.
 * Each (venue, membership, weekday) combination is unique — a second call for
 * the same triple updates the time window.
 */
export async function upsertAvailabilityRule(
  input: unknown,
): Promise<ActionResult<AvailabilityRuleRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage availability.");
  }

  const parsed = UpsertAvailabilityRuleSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { membershipId, weekday, startTime, endTime } = parsed.data;

  if (endTime <= startTime) {
    return err("End time must be after start time.");
  }

  // Verify the membership belongs to this venue
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("id", membershipId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (!membership) return err("Staff member not found in this venue.");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("availability_rules")
    .upsert(
      {
        venue_id: ctx.venue.id,
        membership_id: membershipId,
        weekday,
        start_time: startTime,
        end_time: endTime,
      },
      // On conflict (venue_id, membership_id, weekday) is not a DB constraint —
      // the table allows multiple rules per member/weekday (e.g. morning + afternoon).
      // We use insert here; to update an existing rule, call updateAvailabilityRule.
    )
    .select("*")
    .single();

  if (error) {
    console.error("upsertAvailabilityRule:", error.message);
    return err("Could not save availability rule.");
  }

  revalidatePath("/settings/availability");
  return ok(data);
}

/**
 * Delete an availability rule. Only a rule belonging to the current venue
 * may be deleted; the venue_id filter enforces that.
 */
export async function deleteAvailabilityRule(
  input: unknown,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage availability.");
  }

  const parsed = DeleteAvailabilityRuleSchema.safeParse(input);
  if (!parsed.success) return err("Invalid rule ID.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("availability_rules")
    .delete()
    .eq("id", parsed.data.ruleId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("deleteAvailabilityRule:", error.message);
    return err("Could not delete availability rule.");
  }

  revalidatePath("/settings/availability");
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Meeting type mutations (owner/admin only)
// ---------------------------------------------------------------------------

/**
 * Update duration/buffer/enabled for a meeting type.
 * The two meeting type kinds (viewing, call) are fixed — this only tunes them.
 */
export async function updateMeetingType(
  input: unknown,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can configure meeting types.");
  }

  const parsed = UpdateMeetingTypeSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { meetingTypeId, durationMinutes, bufferMinutes, enabled } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .from("meeting_types")
    .update({ duration_minutes: durationMinutes, buffer_minutes: bufferMinutes, enabled })
    .eq("id", meetingTypeId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("updateMeetingType:", error.message);
    return err("Could not update meeting type.");
  }

  revalidatePath("/settings/availability");
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Staff lifecycle: mark appointment attended / no_show / cancelled
// ---------------------------------------------------------------------------

const UpdateAppointmentStatusSchema = z.object({
  appointmentId: z.string().uuid(),
  status: z.enum(["attended", "no_show", "cancelled"]),
});

/**
 * Staff lifecycle action — mark an appointment as attended, no_show, or
 * cancelled. Scoped to the caller's venue.
 *
 * attended → advance opportunity to 'appointment_attended' (the stage after
 * appointment_booked in the pipeline, representing the viewing happened).
 * This is the stage immediately after appointment_booked in the fixed enum.
 *
 * no_show / cancelled → stage stays where it is; staff decides next steps
 * manually. Cancellation also sets cancelled_at timestamp.
 */
export async function updateAppointmentStatus(
  input: unknown,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const parsed = UpdateAppointmentStatusSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { appointmentId, status } = parsed.data;

  const admin = createAdminClient();

  const { data: appt, error: fetchErr } = await admin
    .from("appointments")
    .select("id, opportunity_id, status")
    .eq("id", appointmentId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (fetchErr || !appt) return err("Appointment not found.");
  if (appt.status === "cancelled") return err("Cannot update a cancelled appointment.");

  const updates: {
    status: "attended" | "no_show" | "cancelled";
    cancelled_at?: string;
  } = { status };
  if (status === "cancelled") {
    updates.cancelled_at = new Date().toISOString();
  }

  const { error: updateErr } = await admin
    .from("appointments")
    .update(updates)
    .eq("id", appointmentId)
    .eq("venue_id", ctx.venue.id);

  if (updateErr) {
    console.error("updateAppointmentStatus:", updateErr.message);
    return err("Could not update appointment.");
  }

  // attended → move opportunity to 'appointment_attended'.
  // Only move forward — don't regress a stage that has already advanced past
  // appointment_attended (e.g. date_on_hold, wedding_booked).
  //
  // Stage order (from pipeline.ts enum):
  //   inbound_enquiry → responded → viewing_interest → appointment_booked
  //   → appointment_attended → date_on_hold → wedding_booked → archived
  //
  // appointment_attended is the natural stage after a viewing/call happens.
  if (status === "attended" && appt.opportunity_id) {
    const { data: opp } = await admin
      .from("opportunities")
      .select("stage")
      .eq("id", appt.opportunity_id)
      .maybeSingle();

    const forwardStages = [
      "inbound_enquiry",
      "responded",
      "viewing_interest",
      "appointment_booked",
    ] as const;

    if (opp && (forwardStages as readonly string[]).includes(opp.stage)) {
      // Also stop any active nurture enrollment (same pattern as moveOpportunity)
      await admin
        .from("sequence_enrollments")
        .update({ status: "stopped", stopped_reason: "stage_moved" })
        .eq("opportunity_id", appt.opportunity_id)
        .eq("venue_id", ctx.venue.id)
        .eq("status", "active");

      await admin
        .from("opportunities")
        .update({ stage: "appointment_attended" })
        .eq("id", appt.opportunity_id)
        .eq("venue_id", ctx.venue.id);
    }
  }

  revalidatePath("/appointments");
  return ok(undefined);
}
