import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { NurtureEmail } from "@/lib/email/templates/nurture-email";
import { applyMergeTags } from "@/lib/email/merge-tags";

const STEP_COUNT = 3;

/**
 * runDueSequenceSteps — the nurture-sequence cron processor.
 *
 * Driven by Vercel Cron (see vercel.json: /api/cron/sequences every 15 min).
 * Instead of one long-lived job per enrollment that sleeps between steps, the
 * cron polls all active enrollments each tick and sends whichever step has
 * become due.
 *
 * Due-time is anchored on the enrollment's created_at plus the cumulative
 * delay_hours of steps 1..nextStep (no migration / no next_run_at column).
 *
 * Per-step send logic mirrors the old `send-step` step.run exactly:
 *   - re-read enrollment active / step enabled / sequence enabled
 *   - re-read opportunity stage must be inbound_enquiry (else stop: stage_moved)
 *   - contact email + email_status==="ok"; suppression check (stop: bounced)
 *   - insert email_messages first as the idempotency guard, then send.
 *
 * Best-effort per enrollment: one bad row must not abort the batch.
 *
 * Note: this scans all active enrollments each tick (O(n)); fine at current
 * scale. If it grows, add a next_run_at column + index and query on it.
 */
export async function runDueSequenceSteps(): Promise<{ processed: number }> {
  const admin = createAdminClient();

  const { data: enrollments } = await admin
    .from("sequence_enrollments")
    .select("id, venue_id, contact_id, opportunity_id, current_step, created_at")
    .eq("status", "active");

  let processed = 0;

  for (const enrollment of enrollments ?? []) {
    try {
      const nextStep = enrollment.current_step + 1;

      // Already past the last step — mark completed and move on.
      if (nextStep > STEP_COUNT) {
        await admin
          .from("sequence_enrollments")
          .update({ status: "completed", current_step: STEP_COUNT })
          .eq("id", enrollment.id)
          .eq("status", "active");
        continue;
      }

      // Load this venue's step config to compute the cumulative delay.
      const { data: steps } = await admin
        .from("sequence_steps")
        .select("step_number, delay_hours, subject, body, enabled")
        .eq("venue_id", enrollment.venue_id)
        .order("step_number", { ascending: true });

      const stepRows = steps ?? [];

      // dueAt = created_at + SUM(delay_hours of steps 1..nextStep) hours.
      const delayHoursTotal = stepRows
        .filter((s) => s.step_number >= 1 && s.step_number <= nextStep)
        .reduce((sum, s) => sum + s.delay_hours, 0);

      const dueAt = new Date(
        new Date(enrollment.created_at).getTime() + delayHoursTotal * 3_600_000,
      );

      if (dueAt > new Date()) {
        // Not due yet — leave it for a later tick.
        continue;
      }

      const sent = await sendStep(admin, enrollment.id, nextStep);

      if (sent) {
        // Successful or skipped send → advance the step pointer.
        const update: { current_step: number; status?: "completed" } = {
          current_step: nextStep,
        };
        if (nextStep === STEP_COUNT) update.status = "completed";
        await admin
          .from("sequence_enrollments")
          .update(update)
          .eq("id", enrollment.id);
        processed += 1;
      }
    } catch (err) {
      // Best-effort — one bad enrollment must not abort the batch.
      console.warn(
        `[sequences-cron] enrollment ${enrollment.id} failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return { processed };
}

/**
 * Send a single nurture step for an enrollment. Mirrors the original per-step
 * send logic exactly (re-read gates → idempotent insert → send).
 *
 * Returns true when the step was sent or skipped (the step pointer should
 * advance); false when the enrollment is no longer active/sendable and the
 * pointer should NOT advance (e.g. it was stopped here).
 */
async function sendStep(
  admin: ReturnType<typeof createAdminClient>,
  enrollmentId: string,
  stepNum: number,
): Promise<boolean> {
  // Re-fetch enrollment.
  const { data: freshEnrollment } = await admin
    .from("sequence_enrollments")
    .select("id, status, venue_id, contact_id, opportunity_id")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!freshEnrollment || freshEnrollment.status !== "active") {
    return false;
  }

  // Re-fetch step (owner may have disabled it).
  const { data: freshStep } = await admin
    .from("sequence_steps")
    .select("subject, body, enabled")
    .eq("venue_id", freshEnrollment.venue_id)
    .eq("step_number", stepNum)
    .maybeSingle();

  if (!freshStep || !freshStep.enabled) {
    // Step disabled — skip the send but advance past it.
    return true;
  }

  // Re-fetch sequence (owner may have disabled the whole sequence).
  const { data: seq } = await admin
    .from("sequences")
    .select("enabled")
    .eq("venue_id", freshEnrollment.venue_id)
    .maybeSingle();

  if (!seq?.enabled) {
    // The sequence was disabled mid-run — stop the enrollment.
    await admin
      .from("sequence_enrollments")
      .update({ status: "stopped", stopped_reason: "disabled" })
      .eq("id", enrollmentId);
    return false;
  }

  // Re-fetch opportunity stage.
  const { data: opp } = await admin
    .from("opportunities")
    .select("stage")
    .eq("id", freshEnrollment.opportunity_id)
    .maybeSingle();

  if (!opp || opp.stage !== "inbound_enquiry") {
    await admin
      .from("sequence_enrollments")
      .update({ status: "stopped", stopped_reason: "stage_moved" })
      .eq("id", enrollmentId);
    return false;
  }

  // Load contact for merge tags + email address.
  const { data: contact } = await admin
    .from("contacts")
    .select("email, first_name, partner_first_name, email_status")
    .eq("id", freshEnrollment.contact_id)
    .maybeSingle();

  if (!contact?.email || contact.email_status !== "ok") {
    // Unsendable contact — skip the send but advance past it.
    return true;
  }

  // Check suppression table.
  const { data: suppressed } = await admin
    .from("email_suppressions")
    .select("id")
    .eq("email", contact.email)
    .maybeSingle();

  if (suppressed) {
    await admin
      .from("sequence_enrollments")
      .update({ status: "stopped", stopped_reason: "bounced" })
      .eq("id", enrollmentId);
    return false;
  }

  // Load venue name + email settings.
  const { data: venue } = await admin
    .from("venues")
    .select("name")
    .eq("id", freshEnrollment.venue_id)
    .maybeSingle();

  const { data: emailSettings } = await admin
    .from("venue_email_settings")
    .select("from_name, reply_to")
    .eq("venue_id", freshEnrollment.venue_id)
    .maybeSingle();

  const venueName = venue?.name ?? "The Venue";

  // Apply merge tags.
  const mergeCtx = {
    firstName: contact.first_name,
    venueName,
    partnerName: contact.partner_first_name,
  };
  const resolvedSubject = applyMergeTags(freshStep.subject, mergeCtx);
  const resolvedBody = applyMergeTags(freshStep.body, mergeCtx);

  const idempotencyKey = `seq:${enrollmentId}:step:${stepNum}`;

  // Insert the email_messages row first (idempotency guard).
  // ON CONFLICT on idempotency_key: if already exists, skip send.
  const { data: msgRow, error: insertErr } = await admin
    .from("email_messages")
    .insert({
      venue_id: freshEnrollment.venue_id,
      contact_id: freshEnrollment.contact_id,
      enrollment_id: enrollmentId,
      step_number: stepNum,
      subject: resolvedSubject,
      status: "skipped", // will update to sent/failed after send
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .maybeSingle();

  if (insertErr) {
    // unique_violation (23505) means row exists → already sent in a prior
    // run; treat as success (replay-safe).
    if (insertErr.code === "23505") {
      return true;
    }
    console.error(
      `[sequences-cron] email_messages insert failed step ${stepNum}:`,
      insertErr.message,
    );
    return true;
  }

  if (!msgRow) {
    // ON CONFLICT DO NOTHING returned null — already sent.
    return true;
  }

  // Send the email.
  const result = await sendEmail({
    to: contact.email,
    subject: resolvedSubject,
    react: NurtureEmail({
      venueName,
      body: resolvedBody,
      subject: resolvedSubject,
    }),
    fromName: emailSettings?.from_name ?? venueName,
    replyTo: emailSettings?.reply_to ?? null,
  });

  // Update the message row with outcome.
  const newStatus: "sent" | "skipped" | "failed" = result.ok
    ? "sent"
    : result.skipped === true
      ? "skipped"
      : "failed";
  await admin
    .from("email_messages")
    .update({
      status: newStatus,
      provider_id: result.ok ? result.id : null,
    })
    .eq("id", msgRow.id);

  return true;
}
