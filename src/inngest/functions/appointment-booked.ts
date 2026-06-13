import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { BookingConfirmationEmail } from "@/lib/email/templates/booking-confirmation-email";
import { toZonedTime, format as formatTZ } from "date-fns-tz";

const MEETING_TYPE_LABELS: Record<string, string> = {
  viewing: "Venue viewing",
  call: "Discovery call",
};

function formatAppointmentDisplay(startsAt: string, venueTimezone: string): string {
  const local = toZonedTime(new Date(startsAt), venueTimezone);
  return formatTZ(local, "EEEE d MMMM · HH:mm", { timeZone: venueTimezone });
}

/**
 * appointment/booked — fires when a new appointment is created (public or staff).
 *
 * Flow:
 *   1. Send booking confirmation email immediately.
 *   2. step.sleepUntil 24h before starts_at.
 *   3. Re-read appointment — if still 'booked' (not cancelled/rescheduled),
 *      send a 24h reminder email.
 *
 * Both emails go through src/lib/email/send.ts with venue from_name/reply_to.
 * The manage link lets the couple cancel or reschedule without logging in.
 */
export const appointmentBooked = inngest.createFunction(
  { id: "appointment-booked", triggers: { event: "appointment/booked" } },
  async ({ event, step }) => {
    const { appointmentId, venueId, contactId } = event.data as {
      appointmentId: string;
      venueId: string;
      contactId: string;
      opportunityId: string | null;
    };

    const admin = createAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.venueflow.io";

    // ------------------------------------------------------------------
    // 1. Load everything we need for the confirmation email
    // ------------------------------------------------------------------
    const ctx = await step.run("load-booking-context", async () => {
      const [apptRes, contactRes, venueRes, settingsRes] = await Promise.all([
        admin
          .from("appointments")
          .select("id, starts_at, ends_at, manage_token, status, meeting_type_id")
          .eq("id", appointmentId)
          .maybeSingle(),
        admin
          .from("contacts")
          .select("first_name, email, email_status")
          .eq("id", contactId)
          .maybeSingle(),
        admin
          .from("venues")
          .select("name, timezone")
          .eq("id", venueId)
          .maybeSingle(),
        admin
          .from("venue_email_settings")
          .select("from_name, reply_to")
          .eq("venue_id", venueId)
          .maybeSingle(),
      ]);

      if (!apptRes.data || !contactRes.data || !venueRes.data) return null;
      if (apptRes.data.status !== "booked") return null;

      const mtRes = await admin
        .from("meeting_types")
        .select("kind")
        .eq("id", apptRes.data.meeting_type_id)
        .maybeSingle();

      return {
        appointment: apptRes.data,
        contact: contactRes.data,
        venue: venueRes.data,
        settings: settingsRes.data,
        meetingTypeKind: mtRes.data?.kind ?? "viewing",
      };
    });

    if (!ctx) {
      return { skipped: true, reason: "appointment-gone-or-cancelled" };
    }

    const { appointment, contact, venue, settings, meetingTypeKind } = ctx;

    if (!contact.email || contact.email_status !== "ok") {
      return { skipped: true, reason: "no-email-or-suppressed" };
    }

    // ------------------------------------------------------------------
    // 2. Send confirmation email
    // ------------------------------------------------------------------
    await step.run("send-confirmation", async () => {
      const manageUrl = `${appUrl}/book/manage/${appointment.manage_token}`;
      const displayLabel = formatAppointmentDisplay(
        appointment.starts_at,
        venue.timezone,
      );
      const meetingTypeLabel =
        MEETING_TYPE_LABELS[meetingTypeKind] ?? "Appointment";

      return sendEmail({
        to: contact.email!,
        subject: `Your ${meetingTypeLabel.toLowerCase()} is confirmed — ${displayLabel}`,
        react: BookingConfirmationEmail({
          venueName: venue.name,
          recipientName: contact.first_name,
          appointmentDisplay: displayLabel,
          meetingTypeLabel,
          manageUrl,
          isReminder: false,
        }),
        fromName: settings?.from_name ?? venue.name,
        replyTo: settings?.reply_to ?? null,
      });
    });

    // ------------------------------------------------------------------
    // 3. Sleep until 24h before the appointment
    // ------------------------------------------------------------------
    const reminderAt = new Date(
      new Date(appointment.starts_at).getTime() - 24 * 60 * 60_000,
    );

    // Only schedule reminder if it's in the future
    if (reminderAt > new Date()) {
      await step.sleepUntil("sleep-until-reminder", reminderAt);

      // ------------------------------------------------------------------
      // 4. Re-check: only send reminder if still booked
      // ------------------------------------------------------------------
      await step.run("send-reminder", async () => {
        const { data: freshAppt } = await admin
          .from("appointments")
          .select("id, starts_at, manage_token, status, meeting_type_id")
          .eq("id", appointmentId)
          .maybeSingle();

        if (!freshAppt || freshAppt.status !== "booked") {
          return { skipped: true, reason: "appointment-no-longer-booked" };
        }

        // Re-fetch contact (email status may have changed)
        const { data: freshContact } = await admin
          .from("contacts")
          .select("first_name, email, email_status")
          .eq("id", contactId)
          .maybeSingle();

        if (!freshContact?.email || freshContact.email_status !== "ok") {
          return { skipped: true, reason: "contact-unsendable" };
        }

        const { data: suppressed } = await admin
          .from("email_suppressions")
          .select("id")
          .eq("email", freshContact.email)
          .maybeSingle();

        if (suppressed) {
          return { skipped: true, reason: "email-suppressed" };
        }

        const mtRes = await admin
          .from("meeting_types")
          .select("kind")
          .eq("id", freshAppt.meeting_type_id)
          .maybeSingle();

        const kind = mtRes.data?.kind ?? "viewing";
        const meetingTypeLabel = MEETING_TYPE_LABELS[kind] ?? "Appointment";
        const manageUrl = `${appUrl}/book/manage/${freshAppt.manage_token}`;
        const displayLabel = formatAppointmentDisplay(
          freshAppt.starts_at,
          venue.timezone,
        );

        return sendEmail({
          to: freshContact.email,
          subject: `Reminder: your ${meetingTypeLabel.toLowerCase()} is tomorrow`,
          react: BookingConfirmationEmail({
            venueName: venue.name,
            recipientName: freshContact.first_name,
            appointmentDisplay: displayLabel,
            meetingTypeLabel,
            manageUrl,
            isReminder: true,
          }),
          fromName: settings?.from_name ?? venue.name,
          replyTo: settings?.reply_to ?? null,
        });
      });
    }

    return { confirmed: true };
  },
);
