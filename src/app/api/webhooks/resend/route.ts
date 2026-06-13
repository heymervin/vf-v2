import { type NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resend bounce / complaint webhook.
 *
 * Resend uses svix to sign webhook payloads. We verify the signature with
 * RESEND_WEBHOOK_SECRET before processing. Missing secret → 500 at config
 * time (never accept unsigned payloads in prod).
 *
 * On email.bounced or email.complained:
 *   1. Upsert the email into email_suppressions (global — venue_id NULL).
 *   2. Stop any active nurture enrollments for that email address across
 *      all venues.
 *   3. Update contacts.email_status to 'bounced' or 'complained'.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured." },
      { status: 500 },
    );
  }

  // Collect svix signature headers.
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing svix signature headers." },
      { status: 400 },
    );
  }

  const body = await req.text();

  const wh = new Webhook(secret);
  let payload: Record<string, unknown>;
  try {
    payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as Record<string, unknown>;
  } catch (e) {
    console.warn("[resend-webhook] signature verification failed:", (e as Error).message);
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const eventType = payload.type as string | undefined;

  // Only handle bounce and complaint events.
  if (eventType !== "email.bounced" && eventType !== "email.complained") {
    return NextResponse.json({ ignored: true });
  }

  // Resend payload shape: { type, data: { email_id, from, to, created_at, ... } }
  const data = payload.data as Record<string, unknown> | undefined;
  const toField = data?.to;

  // `to` may be a string or an array of strings.
  const emails: string[] = Array.isArray(toField)
    ? (toField as string[])
    : typeof toField === "string"
    ? [toField]
    : [];

  if (emails.length === 0) {
    return NextResponse.json({ ignored: true, reason: "no-to-address" });
  }

  const reason: "bounce" | "complaint" =
    eventType === "email.bounced" ? "bounce" : "complaint";
  const contactEmailStatus: "bounced" | "complained" =
    reason === "bounce" ? "bounced" : "complained";

  const admin = createAdminClient();

  for (const email of emails) {
    const normalised = email.trim().toLowerCase();
    if (!normalised) continue;

    // 1. Upsert suppression (global: venue_id NULL).
    await admin
      .from("email_suppressions")
      .upsert(
        { email: normalised, reason, venue_id: null },
        { onConflict: "email", ignoreDuplicates: false },
      );

    // 2. Stop all active enrollments for this email across all venues.
    //    We join through contacts to resolve the email → enrollment.
    const { data: contacts } = await admin
      .from("contacts")
      .select("id")
      .eq("email", normalised);

    if (contacts && contacts.length > 0) {
      const contactIds = contacts.map((c) => c.id);

      await admin
        .from("sequence_enrollments")
        .update({ status: "stopped", stopped_reason: "bounced" })
        .in("contact_id", contactIds)
        .eq("status", "active");

      // 3. Mark the contact's email_status.
      await admin
        .from("contacts")
        .update({ email_status: contactEmailStatus })
        .in("id", contactIds);
    }
  }

  return NextResponse.json({ processed: emails.length });
}
