import "server-only";
import { Resend } from "resend";
import type { ReactElement } from "react";

/**
 * Resend wrapper. All app email goes through here.
 *
 * Sending domain is shared + verified (mail.venueflow.io); per-venue identity
 * is carried by the display name (fromName) and replyTo, so a couple's reply
 * lands in the venue's own inbox. When RESEND_API_KEY is absent (local dev
 * without email set up) sends are skipped with a log rather than throwing, so
 * the capture pipeline still works end to end.
 */

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? "hello@mail.venueflow.io";

export interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
  /** Venue display name shown as the sender. */
  fromName?: string | null;
  /** Venue inbox replies should go to. */
  replyTo?: string | null;
}

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string; skipped?: boolean };

export async function sendEmail({
  to,
  subject,
  react,
  fromName,
  replyTo,
}: SendEmailInput): Promise<SendEmailResult> {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping send to ${to} ("${subject}")`,
    );
    return { ok: false, error: "Email is not configured.", skipped: true };
  }

  const name = (fromName ?? "VenueFlow").replace(/[<>"]/g, "").trim();
  const from = `${name || "VenueFlow"} <${FROM_ADDRESS}>`;

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    react,
    ...(replyTo ? { replyTo } : {}),
  });

  if (error) {
    console.error("[email] send failed:", error.message ?? error);
    return { ok: false, error: error.message ?? "Send failed." };
  }
  return { ok: true, id: data?.id ?? null };
}
