"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";
import { ok, err, type ActionResult } from "@/lib/actions";
import { leadFormSchema } from "@/lib/zod-schemas/lead";
import type { Database } from "@/lib/supabase/types";

type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

const RATE_LIMIT_MAX = 5; // submissions per IP per venue
const RATE_LIMIT_WINDOW_MIN = 10;

/**
 * Public enquiry capture. Runs with the service-role (admin) client after Zod
 * validation, honeypot, and a per-IP rate limit — there is no anon RLS policy
 * on form_submissions, so this is the only write path. A raw submission is
 * ALWAYS saved first (never lose a lead), then upserted into a contact +
 * opportunity, then `lead/captured` fires (brochure email, future nurture).
 */
export async function submitLeadForm(
  slug: string,
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = leadFormSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Please check the form.");
  }
  const d = parsed.data;

  // Honeypot tripped → pretend success, drop silently.
  if (d.website) return ok(undefined);

  const admin = createAdminClient();

  const { data: venue } = await admin
    .from("venues")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!venue) return err("This venue is not available.");
  const venueId = venue.id;

  const h = await headers();
  const ip =
    (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() ||
    null;

  // Per-IP rate limit (simple recent-count check; no captcha for MVP).
  if (ip) {
    const since = new Date(
      Date.now() - RATE_LIMIT_WINDOW_MIN * 60_000,
    ).toISOString();
    const { count } = await admin
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .eq("ip", ip)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return err("Too many submissions. Please try again shortly.");
    }
  }

  // 1. Always save the raw submission.
  const payload = {
    first_name: d.first_name,
    last_name: d.last_name ?? null,
    email: d.email,
    phone: d.phone ?? null,
    partner_first_name: d.partner_first_name ?? null,
    partner_last_name: d.partner_last_name ?? null,
    wedding_date: d.wedding_date ?? null,
    wedding_date_flexible: d.wedding_date_flexible,
    guest_count: d.guest_count ?? null,
    message: d.message ?? null,
  };
  const utm = {
    utm_source: d.utm_source ?? null,
    utm_medium: d.utm_medium ?? null,
    utm_campaign: d.utm_campaign ?? null,
    source: d.source ?? null,
  };
  const { data: submission, error: subErr } = await admin
    .from("form_submissions")
    .insert({ venue_id: venueId, payload, utm, ip, referrer: d.referrer ?? null })
    .select("id")
    .single();
  if (subErr || !submission) {
    console.error("form_submission insert failed:", subErr?.message);
    return err("Could not submit right now, please try again.");
  }

  // 2. Upsert contact by (venue_id, email). email is citext → case-insensitive.
  const source = d.source ?? d.utm_source ?? null;
  const { data: existing } = await admin
    .from("contacts")
    .select("id")
    .eq("venue_id", venueId)
    .eq("email", d.email)
    .maybeSingle();

  let contactId: string;
  if (existing) {
    contactId = existing.id;
    // Fill gaps only — never blank out data the venue already has.
    const upd: ContactUpdate = {};
    if (d.last_name) upd.last_name = d.last_name;
    if (d.phone) upd.phone = d.phone;
    if (d.partner_first_name) upd.partner_first_name = d.partner_first_name;
    if (d.partner_last_name) upd.partner_last_name = d.partner_last_name;
    if (d.wedding_date) upd.wedding_date = d.wedding_date;
    if (d.guest_count != null) upd.guest_count = d.guest_count;
    if (Object.keys(upd).length > 0) {
      await admin.from("contacts").update(upd).eq("id", contactId);
    }
  } else {
    const { data: created, error: cErr } = await admin
      .from("contacts")
      .insert({
        venue_id: venueId,
        first_name: d.first_name,
        last_name: d.last_name ?? null,
        email: d.email,
        phone: d.phone ?? null,
        partner_first_name: d.partner_first_name ?? null,
        partner_last_name: d.partner_last_name ?? null,
        wedding_date: d.wedding_date ?? null,
        wedding_date_flexible: d.wedding_date_flexible,
        guest_count: d.guest_count ?? null,
        source,
      })
      .select("id")
      .single();
    if (cErr || !created) {
      console.error("contact insert failed:", cErr?.message);
      return err("Could not submit right now, please try again.");
    }
    contactId = created.id;
  }

  // 3. Ensure an active opportunity exists (top of Inbound enquiry).
  const { data: activeOpp } = await admin
    .from("opportunities")
    .select("id")
    .eq("contact_id", contactId)
    .is("archived_at", null)
    .maybeSingle();
  if (!activeOpp) {
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
    await admin.from("opportunities").insert({
      venue_id: venueId,
      contact_id: contactId,
      stage: "inbound_enquiry",
      sort_index: sortIndex,
    });
  }

  // 4. Link submission → contact.
  await admin
    .from("form_submissions")
    .update({ contact_id: contactId, processed_at: new Date().toISOString() })
    .eq("id", submission.id);

  // 5. Downstream: brochure delivery (and future nurture enrollment).
  await inngest.send({
    name: "lead/captured",
    data: { venueId, contactId, submissionId: submission.id },
  });

  return ok(undefined);
}
