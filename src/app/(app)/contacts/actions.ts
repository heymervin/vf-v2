"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import { contactInputSchema, type ContactParsed } from "@/lib/zod-schemas/contact";
import { syncAllGhlContacts } from "@/lib/ghl/contacts-sync";

// ---------------------------------------------------------------------------
// GHL import — pull all contacts from the connected GHL location
// ---------------------------------------------------------------------------
export async function importGhlContactsAction(): Promise<
  ActionResult<{ imported: number }>
> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  try {
    const { imported } = await syncAllGhlContacts(ctx.venue.id);
    revalidatePath("/contacts");
    return ok({ imported });
  } catch (e) {
    console.error("[importGhlContacts]", e);
    return err("GHL sync failed — check your connection in Settings.");
  }
}

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
