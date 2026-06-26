"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import { contactInputSchema, type ContactParsed } from "@/lib/zod-schemas/contact";
import { parseCsv } from "@/lib/csv";
import type { Database } from "@/lib/supabase/types";

type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];

/** Maps validated input → DB columns; clears absent optionals, converts £→pence. */
function toColumns(p: ContactParsed) {
  return {
    first_name: p.first_name,
    last_name: p.last_name ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    partner_first_name: p.partner_first_name ?? null,
    partner_last_name: p.partner_last_name ?? null,
    wedding_date: p.wedding_date ?? null,
    wedding_date_flexible: p.wedding_date_flexible,
    guest_count: p.guest_count ?? null,
    budget_minor: p.budget === undefined ? null : Math.round(p.budget * 100),
    source: p.source ?? null,
  };
}

// ---------------------------------------------------------------------------
// Create — atomic contact + opening opportunity (inbound_enquiry) via RPC
// ---------------------------------------------------------------------------
export async function createContact(
  input: unknown,
): Promise<ActionResult<{ contactId: string }>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Please check the form.");
  }
  const c = toColumns(parsed.data);

  // The RPC's defaulted params are typed `T | undefined` (omit → DB default
  // NULL), so map the column nulls to undefined for this path.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_contact_with_opportunity", {
    p_venue_id: ctx.venue.id,
    p_first_name: c.first_name,
    p_last_name: c.last_name ?? undefined,
    p_email: c.email ?? undefined,
    p_phone: c.phone ?? undefined,
    p_partner_first_name: c.partner_first_name ?? undefined,
    p_partner_last_name: c.partner_last_name ?? undefined,
    p_wedding_date: c.wedding_date ?? undefined,
    p_wedding_date_flexible: c.wedding_date_flexible,
    p_guest_count: c.guest_count ?? undefined,
    p_budget_minor: c.budget_minor ?? undefined,
    p_source: c.source ?? undefined,
  });

  if (error) {
    if (error.message.includes("already exists")) {
      return err("A contact with this email already exists.");
    }
    console.error("createContact RPC failed:", error.message);
    return err("Could not create contact, try again.");
  }

  revalidatePath("/contacts");
  revalidatePath("/pipeline");
  return ok({ contactId: data.id });
}

// ---------------------------------------------------------------------------
// Update — edit contact fields (opportunity stage is moved on the kanban)
// ---------------------------------------------------------------------------
export async function updateContact(
  contactId: string,
  input: unknown,
): Promise<ActionResult<{ contactId: string }>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Please check the form.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .update(toColumns(parsed.data))
    .eq("id", contactId)
    .eq("venue_id", ctx.venue.id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return err("A contact with this email already exists.");
    }
    console.error("updateContact failed:", error.message);
    return err("Could not save changes, try again.");
  }
  if (!data) return err("Contact not found.");

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/pipeline");
  return ok({ contactId });
}

// ---------------------------------------------------------------------------
// Import — bulk CSV → contacts (no opportunity; GHL owns pre-sales stages).
//   Lenient header mapping; dedupes against existing + within-file by email
//   (the (venue_id, email) unique key). Rows need a name or an email.
// ---------------------------------------------------------------------------

// Normalized header (lowercased, non-alpha stripped) → contacts column.
const CSV_HEADER_MAP: Record<string, string> = {
  firstname: "first_name", first: "first_name", name: "first_name",
  lastname: "last_name", last: "last_name", surname: "last_name",
  email: "email", emailaddress: "email",
  phone: "phone", phonenumber: "phone", mobile: "phone", tel: "phone",
  source: "source", leadsource: "source",
  partnerfirstname: "partner_first_name", partnerlastname: "partner_last_name",
  weddingdate: "wedding_date", date: "wedding_date",
  guests: "guest_count", guestcount: "guest_count",
  budget: "budget",
};

const MAX_IMPORT_ROWS = 5000;

export async function importContacts(
  csvText: string,
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const rows = parseCsv(csvText).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) {
    return err("CSV needs a header row and at least one contact.");
  }

  const fields = rows[0]!.map(
    (h) => CSV_HEADER_MAP[h.trim().toLowerCase().replace(/[^a-z]/g, "")] ?? null,
  );
  if (!fields.includes("first_name") && !fields.includes("email")) {
    return err("CSV needs a Name or Email column.");
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return err(`Too many rows (${dataRows.length}). Import up to ${MAX_IMPORT_ROWS} at a time.`);
  }

  const candidates: { insert: ContactInsert; email: string | null }[] = [];
  for (const r of dataRows) {
    const rec: Record<string, string> = {};
    fields.forEach((f, i) => {
      if (f) rec[f] = (r[i] ?? "").trim();
    });

    const email = rec.email || null;
    const first = rec.first_name || email; // first_name is NOT NULL — fall back to email
    if (!first) continue;

    candidates.push({
      email,
      insert: {
        venue_id: ctx.venue.id,
        first_name: first,
        last_name: rec.last_name || null,
        email,
        phone: rec.phone || null,
        partner_first_name: rec.partner_first_name || null,
        partner_last_name: rec.partner_last_name || null,
        wedding_date: /^\d{4}-\d{2}-\d{2}/.test(rec.wedding_date ?? "") ? rec.wedding_date! : null,
        guest_count: /^\d+$/.test(rec.guest_count ?? "") ? Number(rec.guest_count) : null,
        budget_minor: /^\d*\.?\d+$/.test(rec.budget ?? "") ? Math.round(Number(rec.budget) * 100) : null,
        source: rec.source || "import",
      },
    });
  }

  if (!candidates.length) return err("No valid rows found (each needs a name or email).");

  const supabase = await createClient();

  // Dedupe against existing contacts by email (citext (venue_id, email) key).
  const emails = candidates.map((c) => c.email).filter(Boolean) as string[];
  const existing = new Set<string>();
  if (emails.length) {
    const { data } = await supabase
      .from("contacts")
      .select("email")
      .eq("venue_id", ctx.venue.id)
      .in("email", emails);
    for (const row of data ?? []) if (row.email) existing.add(row.email.toLowerCase());
  }

  // Insert new rows; skip duplicate emails (existing or repeated within the file).
  const seen = new Set<string>();
  const toInsert: ContactInsert[] = [];
  for (const c of candidates) {
    const key = c.email?.toLowerCase();
    if (key && (existing.has(key) || seen.has(key))) continue;
    if (key) seen.add(key);
    toInsert.push(c.insert);
  }

  if (toInsert.length) {
    const { error } = await supabase.from("contacts").insert(toInsert);
    if (error) {
      console.error("importContacts insert failed:", error.message);
      return err("Could not import contacts, try again.");
    }
  }

  revalidatePath("/contacts");
  return ok({ imported: toInsert.length, skipped: candidates.length - toInsert.length });
}

// ---------------------------------------------------------------------------
// Delete — cascades to the opportunity and its stage_events
// ---------------------------------------------------------------------------
export async function deleteContact(
  contactId: string,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", contactId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("deleteContact failed:", error.message);
    return err("Could not delete contact, try again.");
  }

  revalidatePath("/contacts");
  revalidatePath("/pipeline");
  return ok(undefined);
}
