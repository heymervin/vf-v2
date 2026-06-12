import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { NurtureEmail } from "@/lib/email/templates/nurture-email";
import { applyMergeTags } from "@/lib/email/merge-tags";

const STEP_COUNT = 3;

/**
 * sequence/run — drives a single enrollment through its 3 nurture steps.
 *
 * Safety mechanisms (in order):
 *   1. step.sleep — honours the configured delay_hours (or minutes in dev
 *      when SEQUENCE_MINUTE_DELAYS=1, for smoke testing).
 *   2. Re-read before every send — checks enrollment status, step enabled,
 *      opportunity still at inbound_enquiry, email not suppressed.
 *   3. Idempotency key — insert email_messages row first (ON CONFLICT DO
 *      NOTHING); if row exists the send already happened; skip.
 *   4. stage-move stop — written eagerly in pipeline/actions.ts; Inngest
 *      recheck here is the backstop.
 */
export const sequenceRun = inngest.createFunction(
  { id: "sequence-run", triggers: { event: "sequence/enrolled" } },
  async ({ event, step }) => {
    const { enrollmentId } = event.data as { enrollmentId: string };
    const admin = createAdminClient();

    for (let stepNum = 1; stepNum <= STEP_COUNT; stepNum++) {
      // ------------------------------------------------------------------
      // 1. Load step config to get the delay (before we sleep).
      // ------------------------------------------------------------------
      const stepConfig = await step.run(
        `load-step-config-${stepNum}`,
        async () => {
          const { data: enrollment } = await admin
            .from("sequence_enrollments")
            .select(
              "id, venue_id, contact_id, opportunity_id, status, current_step",
            )
            .eq("id", enrollmentId)
            .maybeSingle();

          if (!enrollment || enrollment.status !== "active") return null;

          const { data: seqStep } = await admin
            .from("sequence_steps")
            .select(
              "id, step_number, subject, body, delay_hours, enabled, sequence_id",
            )
            .eq("venue_id", enrollment.venue_id)
            .eq("step_number", stepNum)
            .maybeSingle();

          return { enrollment, seqStep };
        },
      );

      if (!stepConfig || !stepConfig.seqStep || !stepConfig.enrollment) {
        // Enrollment stopped or step config missing — exit.
        return { stopped: true, reason: "enrollment-gone-or-no-step" };
      }

      const { seqStep } = stepConfig;
      const delayHours = seqStep.delay_hours;

      // ------------------------------------------------------------------
      // 2. Sleep for the configured delay (env override for tests).
      // ------------------------------------------------------------------
      const useMinutes =
        process.env.SEQUENCE_MINUTE_DELAYS === "1" && delayHours > 0;
      if (delayHours > 0) {
        const sleepDuration = useMinutes
          ? `${delayHours}m`
          : `${delayHours}h`;
        await step.sleep(`sleep-before-step-${stepNum}`, sleepDuration);
      }

      // ------------------------------------------------------------------
      // 3. Re-read state after sleep — enrollment, sequence, opportunity.
      // ------------------------------------------------------------------
      const sendResult = await step.run(`send-step-${stepNum}`, async () => {
        // Re-fetch enrollment
        const { data: freshEnrollment } = await admin
          .from("sequence_enrollments")
          .select("id, status, venue_id, contact_id, opportunity_id")
          .eq("id", enrollmentId)
          .maybeSingle();

        if (!freshEnrollment || freshEnrollment.status !== "active") {
          return { skipped: true, reason: "enrollment-no-longer-active" };
        }

        // Re-fetch step (owner may have disabled it)
        const { data: freshStep } = await admin
          .from("sequence_steps")
          .select("subject, body, enabled")
          .eq("venue_id", freshEnrollment.venue_id)
          .eq("step_number", stepNum)
          .maybeSingle();

        if (!freshStep || !freshStep.enabled) {
          return { skipped: true, reason: "step-disabled" };
        }

        // Re-fetch sequence (owner may have disabled the whole sequence)
        const { data: seq } = await admin
          .from("sequences")
          .select("enabled")
          .eq("venue_id", freshEnrollment.venue_id)
          .maybeSingle();

        if (!seq?.enabled) {
          // Mark enrollment stopped — the sequence was disabled mid-run.
          await admin
            .from("sequence_enrollments")
            .update({ status: "stopped", stopped_reason: "disabled" })
            .eq("id", enrollmentId);
          return { skipped: true, reason: "sequence-disabled" };
        }

        // Re-fetch opportunity stage
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
          return { skipped: true, reason: "stage-moved" };
        }

        // Load contact for merge tags + email address
        const { data: contact } = await admin
          .from("contacts")
          .select("email, first_name, partner_first_name, email_status")
          .eq("id", freshEnrollment.contact_id)
          .maybeSingle();

        if (!contact?.email || contact.email_status !== "ok") {
          return { skipped: true, reason: "no-email-or-suppressed" };
        }

        // Check suppression table
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
          return { skipped: true, reason: "email-suppressed" };
        }

        // Load venue name + email settings
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

        // Apply merge tags
        const mergeCtx = {
          firstName: contact.first_name,
          venueName,
          partnerName: contact.partner_first_name,
        };
        const resolvedSubject = applyMergeTags(freshStep.subject, mergeCtx);
        const resolvedBody = applyMergeTags(freshStep.body, mergeCtx);

        const idempotencyKey = `seq:${enrollmentId}:step:${stepNum}`;

        // ------------------------------------------------------------------
        // 4. Insert the email_messages row first (idempotency guard).
        //    ON CONFLICT on idempotency_key: if already exists, skip send.
        // ------------------------------------------------------------------
        const { data: msgRow, error: insertErr } = await admin
          .from("email_messages")
          .insert({
            venue_id: freshEnrollment.venue_id,
            contact_id: freshEnrollment.contact_id,
            enrollment_id: enrollmentId,
            step_number: stepNum,
            subject: resolvedSubject,
            status: "skipped",       // will update to sent/failed after send
            idempotency_key: idempotencyKey,
          })
          .select("id")
          .maybeSingle();

        if (insertErr) {
          // unique_violation (23505) means row exists → already sent in a
          // prior run; treat as success (replay-safe).
          if (insertErr.code === "23505") {
            return { skipped: true, reason: "already-sent-idempotency" };
          }
          console.error(
            `[sequence-run] email_messages insert failed step ${stepNum}:`,
            insertErr.message,
          );
          return { skipped: true, reason: "insert-failed" };
        }

        if (!msgRow) {
          // ON CONFLICT DO NOTHING returned null — already sent.
          return { skipped: true, reason: "already-sent-idempotency" };
        }

        // ------------------------------------------------------------------
        // 5. Send the email.
        // ------------------------------------------------------------------
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

        // Bump current_step on the enrollment.
        await admin
          .from("sequence_enrollments")
          .update({ current_step: stepNum })
          .eq("id", enrollmentId);

        return {
          sent: result.ok,
          skipped: !result.ok && result.skipped === true,
          messageId: msgRow.id,
        };
      });

      if (sendResult && "reason" in sendResult && sendResult.reason === "enrollment-no-longer-active") {
        return { stopped: true, reason: sendResult.reason };
      }
    }

    // All 3 steps completed — mark enrollment done.
    await step.run("complete-enrollment", async () => {
      await admin
        .from("sequence_enrollments")
        .update({ status: "completed", current_step: STEP_COUNT })
        .eq("id", enrollmentId)
        .eq("status", "active"); // only if still active (not stopped mid-run)
    });

    return { completed: true };
  },
);
