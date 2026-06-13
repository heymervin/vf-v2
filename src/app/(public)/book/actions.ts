"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";
import { ok, err, type ActionResult } from "@/lib/actions";
import { computeAvailableSlots } from "@/lib/booking/engine";
import { getClientIp, rateLimitKey } from "@/lib/get-client-ip";
import type { Database } from "@/lib/supabase/types";

type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

// ---------------------------------------------------------------------------
// Rate limit (mirrors lead-form pattern)
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MIN = 10;
const MAX_SLOT_RANGE_DAYS = 60;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const BookSlotSchema = z.object({
  venueSlug: z.string().min(1),
  meetingTypeKind: z.enum(["viewing", "call"]),
  /** UTC ISO string for the desired slot start */
  slotStartUtc: z.string().refine((s) => !isNaN(Date.parse(s)), {
    message: "Invalid slot start time.",
  }),
  firstName: z.string().trim().min(1, "Please tell us your name.").max(100),
  lastName: z.string().trim().max(100).optional(),
  email: z.email({ error: "Enter a valid email address." }),
  phone: z.string().trim().max(40).optional(),
  /** Honeypot — must be empty. */
  website: z.string().max(200).optional(),
});

const GetAvailableSlotsSchema = z.object({
  venueSlug: z.string().min(1),
  meetingTypeKind: z.enum(["viewing", "call"]),
  /** UTC ISO, start of window to query (capped to 60 days from now) */
  rangeStart: z.string().refine((s) => !isNaN(Date.parse(s)), {
    message: "Invalid range start.",
  }),
  /** UTC ISO, end of window to query */
  rangeEnd: z.string().refine((s) => !isNaN(Date.parse(s)), {
    message: "Invalid range end.",
  }),
});

const ManageTokenSchema = z.object({
  manageToken: z.string().uuid(),
});

const RescheduleSchema = z.object({
  manageToken: z.string().uuid(),
  newSlotStartUtc: z.string().refine((s) => !isNaN(Date.parse(s)), {
    message: "Invalid slot start time.",
  }),
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public: getAvailableSlots
// ---------------------------------------------------------------------------

export interface AvailableSlot {
  membershipId: string;
  meetingTypeId: string;
  startsAtUtc: string;
  endsAtUtc: string;
  displayLabel: string;
}

/**
 * Load available slots for a venue's meeting type over a date range.
 * Called by the public booking calendar UI. Range is capped to 60 days.
 */
export async function getAvailableSlots(
  input: unknown,
): Promise<ActionResult<AvailableSlot[]>> {
  const parsed = GetAvailableSlotsSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { venueSlug, meetingTypeKind, rangeStart, rangeEnd } = parsed.data;

  const admin = createAdminClient();

  const { data: venue } = await admin
    .from("venues")
    .select("id, timezone")
    .eq("slug", venueSlug)
    .maybeSingle();

  if (!venue) return err("Venue not found.");

  // Cap range to 60 days
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);
  const maxEnd = new Date(start.getTime() + MAX_SLOT_RANGE_DAYS * 86400_000);
  const effectiveEnd = end > maxEnd ? maxEnd : end;

  const { data: mt } = await admin
    .from("meeting_types")
    .select("id, duration_minutes, buffer_minutes")
    .eq("venue_id", venue.id)
    .eq("kind", meetingTypeKind)
    .eq("enabled", true)
    .maybeSingle();

  if (!mt) return err("Meeting type not available.");

  const { data: rules } = await admin
    .from("availability_rules")
    .select("membership_id, weekday, start_time, end_time")
    .eq("venue_id", venue.id);

  if (!rules || rules.length === 0) return ok([]);

  const membershipIds = [...new Set(rules.map((r) => r.membership_id))];

  const { data: busyAppts } = await admin
    .from("appointments")
    .select("membership_id, starts_at, ends_at")
    .eq("venue_id", venue.id)
    .in("membership_id", membershipIds)
    .eq("status", "booked")
    .gte("starts_at", rangeStart)
    .lte("ends_at", effectiveEnd.toISOString());

  const engineRules = rules.map((r) => ({
    membershipId: r.membership_id,
    weekday: r.weekday,
    startTime: r.start_time,
    endTime: r.end_time,
  }));

  const busyRanges = (busyAppts ?? []).map((a) => ({
    membershipId: a.membership_id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
  }));

  const slots = computeAvailableSlots({
    rules: engineRules,
    busy: busyRanges,
    meetingType: {
      durationMinutes: mt.duration_minutes,
      bufferMinutes: mt.buffer_minutes,
    },
    venueTimezone: venue.timezone,
    rangeStart,
    rangeEnd: effectiveEnd.toISOString(),
    leadTimeMinutes: 60, // require 60min advance booking
  });

  return ok(
    slots.map((s) => ({
      membershipId: s.membershipId,
      meetingTypeId: mt.id,
      startsAtUtc: s.startsAtUtc,
      endsAtUtc: s.endsAtUtc,
      displayLabel: s.displayLabel,
    })),
  );
}

// ---------------------------------------------------------------------------
// Public: bookSlot
// ---------------------------------------------------------------------------

/**
 * Public booking action. Validates the slot server-side via the engine, then
 * inserts an appointment using the service-role client. The EXCLUDE constraint
 * is the authoritative double-booking guard — on a 23P01 violation (exclusion
 * constraint) we return a friendly "slot just taken" error.
 *
 * Also upserts a contact + opportunity and moves the stage to appointment_booked
 * (only forward — never regress a later stage).
 */
export async function bookSlot(
  input: unknown,
): Promise<ActionResult<{ manageToken: string }>> {
  const parsed = BookSlotSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Please check the form.");
  }
  const d = parsed.data;

  // Honeypot tripped → pretend success
  if (d.website) return ok({ manageToken: "" });

  const admin = createAdminClient();

  const { data: venue } = await admin
    .from("venues")
    .select("id, timezone")
    .eq("slug", d.venueSlug)
    .maybeSingle();

  if (!venue) return err("This venue is not available.");
  const venueId = venue.id;

  // Per-IP rate limit. IP comes from x-real-ip only (edge-set, not
  // client-spoofable). rateLimitKey() fails closed to a shared bucket when no
  // trusted IP is present in production, and skips the limit in dev/CI.
  const h = await headers();
  const ip = getClientIp(h);
  const rlKey = rateLimitKey(h);

  if (rlKey) {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60_000).toISOString();
    const { count } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .eq("ip", rlKey)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return err("Too many booking attempts. Please try again shortly.");
    }
  }

  // Load meeting type
  const { data: mt } = await admin
    .from("meeting_types")
    .select("id, duration_minutes, buffer_minutes")
    .eq("venue_id", venueId)
    .eq("kind", d.meetingTypeKind)
    .eq("enabled", true)
    .maybeSingle();

  if (!mt) return err("This meeting type is not available.");

  // Pick the first available staff member for this slot — in future this can
  // be a preference, for now we take the first rule that covers this slot.
  const { data: rules } = await admin
    .from("availability_rules")
    .select("membership_id, weekday, start_time, end_time")
    .eq("venue_id", venueId);

  if (!rules || rules.length === 0) {
    return err("No availability configured for this venue.");
  }

  // Server-side slot validation: run the engine to confirm this slot is open
  const slotStart = new Date(d.slotStartUtc);
  const slotEnd = new Date(slotStart.getTime() + mt.duration_minutes * 60_000);

  const { data: busyAppts } = await admin
    .from("appointments")
    .select("membership_id, starts_at, ends_at")
    .eq("venue_id", venueId)
    .eq("status", "booked")
    .gte("starts_at", new Date(slotStart.getTime() - 86400_000).toISOString())
    .lte("ends_at", new Date(slotEnd.getTime() + 86400_000).toISOString());

  const engineRules = rules.map((r) => ({
    membershipId: r.membership_id,
    weekday: r.weekday,
    startTime: r.start_time,
    endTime: r.end_time,
  }));

  const busyRanges = (busyAppts ?? []).map((a) => ({
    membershipId: a.membership_id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
  }));

  const validSlots = computeAvailableSlots({
    rules: engineRules,
    busy: busyRanges,
    meetingType: { durationMinutes: mt.duration_minutes, bufferMinutes: mt.buffer_minutes },
    venueTimezone: venue.timezone,
    rangeStart: d.slotStartUtc,
    rangeEnd: slotEnd.toISOString(),
    now: new Date(Date.now() - 60_000).toISOString(),
  });

  const matchedSlot = validSlots.find(
    (s) => Math.abs(new Date(s.startsAtUtc).getTime() - slotStart.getTime()) < 1000,
  );

  if (!matchedSlot) {
    return err("This time slot is no longer available. Please choose another.");
  }

  const assignedMembershipId = matchedSlot.membershipId;

  // Upsert contact by (venue_id, email)
  const { data: existing } = await admin
    .from("contacts")
    .select("id")
    .eq("venue_id", venueId)
    .eq("email", d.email)
    .maybeSingle();

  let contactId: string;
  if (existing) {
    contactId = existing.id;
    const upd: ContactUpdate = {};
    if (d.lastName) upd.last_name = d.lastName;
    if (d.phone) upd.phone = d.phone;
    if (Object.keys(upd).length > 0) {
      await admin.from("contacts").update(upd).eq("id", contactId);
    }
  } else {
    const { data: created, error: cErr } = await admin
      .from("contacts")
      .insert({
        venue_id: venueId,
        first_name: d.firstName,
        last_name: d.lastName ?? null,
        email: d.email,
        phone: d.phone ?? null,
        source: "booking",
      })
      .select("id")
      .single();
    if (cErr || !created) {
      console.error("contact insert:", cErr?.message);
      return err("Could not complete booking. Please try again.");
    }
    contactId = created.id;
  }

  // Ensure an active opportunity exists
  const { data: activeOpp } = await admin
    .from("opportunities")
    .select("id, stage")
    .eq("contact_id", contactId)
    .is("archived_at", null)
    .maybeSingle();

  let opportunityId: string;
  if (activeOpp) {
    opportunityId = activeOpp.id;
  } else {
    const { data: top } = await admin
      .from("opportunities")
      .select("sort_index")
      .eq("venue_id", venueId)
      .eq("stage", "inbound_enquiry")
      .is("archived_at", null)
      .order("sort_index", { ascending: true })
      .limit(1)
      .maybeSingle();
    const sortIndex = (top?.sort_index != null ? Number(top.sort_index) : 1000) - 1000;
    const { data: newOpp, error: oppErr } = await admin
      .from("opportunities")
      .insert({ venue_id: venueId, contact_id: contactId, stage: "inbound_enquiry", sort_index: sortIndex })
      .select("id, stage")
      .single();
    if (oppErr || !newOpp) {
      console.error("opportunity insert:", oppErr?.message);
      return err("Could not complete booking. Please try again.");
    }
    opportunityId = newOpp.id;
  }

  // Advance stage to appointment_booked — only if not already past it.
  // Stage order: inbound_enquiry < responded < viewing_interest < appointment_booked
  // < appointment_attended < date_on_hold < wedding_booked < archived.
  const stagesBeforeBooked = [
    "inbound_enquiry",
    "responded",
    "viewing_interest",
  ] as const;

  const currentStage = activeOpp?.stage ?? "inbound_enquiry";
  if ((stagesBeforeBooked as readonly string[]).includes(currentStage)) {
    // Stop any active nurture enrollment (booking supersedes nurture)
    await admin
      .from("sequence_enrollments")
      .update({ status: "stopped", stopped_reason: "stage_moved" })
      .eq("opportunity_id", opportunityId)
      .eq("venue_id", venueId)
      .eq("status", "active");

    await admin
      .from("opportunities")
      .update({ stage: "appointment_booked" })
      .eq("id", opportunityId);
  }

  // INSERT appointment — the EXCLUDE constraint is the double-booking guard.
  // SQLSTATE 23P01 = exclusion_violation.
  const { data: appt, error: apptErr } = await admin
    .from("appointments")
    .insert({
      venue_id: venueId,
      meeting_type_id: mt.id,
      membership_id: assignedMembershipId,
      contact_id: contactId,
      opportunity_id: opportunityId,
      starts_at: matchedSlot.startsAtUtc,
      ends_at: matchedSlot.endsAtUtc,
      status: "booked",
      source: "public",
      ip,
    })
    .select("id, manage_token")
    .single();

  if (apptErr) {
    // 23P01 = exclusion_violation (double-booking guard fired)
    if (apptErr.code === "23P01") {
      return err("That slot was just taken. Please choose another time.");
    }
    console.error("appointment insert:", apptErr.message);
    return err("Could not complete booking. Please try again.");
  }

  // Fire appointment/booked event for confirmation email + 24h reminder
  try {
    await inngest.send({
      name: "appointment/booked",
      data: {
        appointmentId: appt.id,
        venueId,
        contactId,
        opportunityId,
      },
    });
  } catch (e) {
    console.error("appointment/booked event:", (e as Error).message);
  }

  return ok({ manageToken: appt.manage_token });
}

// ---------------------------------------------------------------------------
// Public: cancelAppointment (by manage token)
// ---------------------------------------------------------------------------

export async function cancelAppointment(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = ManageTokenSchema.safeParse(input);
  if (!parsed.success) return err("Invalid token.");

  const admin = createAdminClient();
  const { data: appt } = await admin
    .from("appointments")
    .select("id, status")
    .eq("manage_token", parsed.data.manageToken)
    .maybeSingle();

  if (!appt) return err("Booking not found.");
  if (appt.status === "cancelled") return err("This booking is already cancelled.");
  if (appt.status !== "booked") {
    return err("Only upcoming bookings can be cancelled.");
  }

  const { error } = await admin
    .from("appointments")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", appt.id);

  if (error) {
    console.error("cancelAppointment:", error.message);
    return err("Could not cancel booking. Please try again.");
  }

  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Public: rescheduleAppointment (by manage token) — atomic via RPC
// ---------------------------------------------------------------------------

/**
 * Reschedule by token. The actual cancel+rebook is delegated to the
 * reschedule_appointment SECURITY DEFINER RPC which runs both mutations
 * inside a single Postgres transaction:
 *   - INSERT new appointment (EXCLUDE constraint fires here if slot taken)
 *   - only on success: UPDATE old appointment to cancelled
 *
 * If the EXCLUDE constraint fires (23P01) the whole transaction rolls back
 * and the customer's original booking is preserved — no data loss.
 *
 * Engine validation still runs server-side before calling the RPC so the
 * vast majority of "slot gone" cases return early without a DB round-trip.
 */
export async function rescheduleAppointment(
  input: unknown,
): Promise<ActionResult<{ manageToken: string }>> {
  const parsed = RescheduleSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { manageToken, newSlotStartUtc } = parsed.data;

  const admin = createAdminClient();

  // Load enough context for engine validation before hitting the RPC.
  const { data: appt } = await admin
    .from("appointments")
    .select(
      "id, venue_id, meeting_type_id, membership_id, contact_id, opportunity_id, status",
    )
    .eq("manage_token", manageToken)
    .maybeSingle();

  if (!appt) return err("Booking not found.");
  if (appt.status !== "booked") return err("Only upcoming bookings can be rescheduled.");

  const { data: venue } = await admin
    .from("venues")
    .select("id, timezone")
    .eq("id", appt.venue_id)
    .maybeSingle();

  if (!venue) return err("Venue not found.");

  const { data: mt } = await admin
    .from("meeting_types")
    .select("id, duration_minutes, buffer_minutes")
    .eq("id", appt.meeting_type_id)
    .maybeSingle();

  if (!mt) return err("Meeting type not found.");

  // Server-side engine validation — excludes the current booking from busy
  // ranges so the existing slot doesn't block the new one.
  const newSlotStart = new Date(newSlotStartUtc);
  const newSlotEnd = new Date(newSlotStart.getTime() + mt.duration_minutes * 60_000);

  const { data: rules } = await admin
    .from("availability_rules")
    .select("membership_id, weekday, start_time, end_time")
    .eq("venue_id", appt.venue_id)
    .eq("membership_id", appt.membership_id);

  if (!rules || rules.length === 0) {
    return err("No availability configured.");
  }

  const { data: busyAppts } = await admin
    .from("appointments")
    .select("membership_id, starts_at, ends_at")
    .eq("venue_id", appt.venue_id)
    .eq("membership_id", appt.membership_id)
    .eq("status", "booked")
    .neq("id", appt.id) // exclude the booking being rescheduled
    .gte("starts_at", new Date(newSlotStart.getTime() - 86400_000).toISOString())
    .lte("ends_at", new Date(newSlotEnd.getTime() + 86400_000).toISOString());

  const engineRules = rules.map((r) => ({
    membershipId: r.membership_id,
    weekday: r.weekday,
    startTime: r.start_time,
    endTime: r.end_time,
  }));

  const busyRanges = (busyAppts ?? []).map((a) => ({
    membershipId: a.membership_id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
  }));

  const validSlots = computeAvailableSlots({
    rules: engineRules,
    busy: busyRanges,
    meetingType: { durationMinutes: mt.duration_minutes, bufferMinutes: mt.buffer_minutes },
    venueTimezone: venue.timezone,
    rangeStart: newSlotStartUtc,
    rangeEnd: newSlotEnd.toISOString(),
    now: new Date(Date.now() - 60_000).toISOString(),
  });

  const matchedSlot = validSlots.find(
    (s) => Math.abs(new Date(s.startsAtUtc).getTime() - newSlotStart.getTime()) < 1000,
  );

  if (!matchedSlot) {
    return err("This time slot is no longer available. Please choose another.");
  }

  // Atomic cancel + rebook via SECURITY DEFINER RPC. The RPC inserts the new
  // row first; if the EXCLUDE constraint fires (23P01) it raises and the whole
  // transaction rolls back — original booking preserved.
  const { data: newToken, error: rpcErr } = await admin.rpc(
    "reschedule_appointment",
    {
      p_manage_token: manageToken,
      p_starts_at: matchedSlot.startsAtUtc,
      p_ends_at: matchedSlot.endsAtUtc,
    },
  );

  if (rpcErr) {
    // 23P01 = exclusion_violation — slot was taken between engine check and RPC
    if (rpcErr.code === "23P01") {
      return err("That slot was just taken. Please choose another time.");
    }
    // P0001 = our own RAISE (token not found / already cancelled)
    if (rpcErr.code === "P0001") {
      return err(rpcErr.message ?? "Booking not found or already cancelled.");
    }
    console.error("reschedule_appointment rpc:", rpcErr.message);
    return err("Could not reschedule. Please try again.");
  }

  if (!newToken) {
    return err("Could not reschedule. Please try again.");
  }

  // Look up the new appointment id for the Inngest event.
  const { data: newAppt } = await admin
    .from("appointments")
    .select("id")
    .eq("manage_token", newToken)
    .maybeSingle();

  if (newAppt) {
    try {
      await inngest.send({
        name: "appointment/booked",
        data: {
          appointmentId: newAppt.id,
          venueId: appt.venue_id,
          contactId: appt.contact_id,
          opportunityId: appt.opportunity_id,
        },
      });
    } catch (e) {
      console.error("appointment/booked (reschedule) event:", (e as Error).message);
    }
  }

  return ok({ manageToken: newToken });
}
