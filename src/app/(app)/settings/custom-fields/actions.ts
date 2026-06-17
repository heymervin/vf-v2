"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import type { Tables } from "@/lib/supabase/types";
import { FIELD_CAP, deriveKey } from "./constants";

// ── Public re-export ──────────────────────────────────────────────────────────

export type CustomFieldRow = Tables<"custom_fields">;

// ── Role guard ────────────────────────────────────────────────────────────────

function requireOwnerOrAdmin(role: string): ActionResult<never> | null {
  if (role !== "owner" && role !== "admin") {
    return err("Only owners and admins can manage custom fields.");
  }
  return null;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const FieldTypeEnum = z.enum(["text", "number", "select", "date"]);
const AppliesToEnum = z.enum(["contact", "wedding"]);

const CreateCustomFieldSchema = z.object({
  label: z.string().min(1, "Field label is required"),
  type: FieldTypeEnum,
  options: z.array(z.string()).optional().default([]),
  applies_to: AppliesToEnum,
});

const UpdateCustomFieldSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1, "Field label is required"),
  type: FieldTypeEnum,
  options: z.array(z.string()).optional().default([]),
  applies_to: AppliesToEnum,
});

const ArchiveCustomFieldSchema = z.object({
  id: z.string().uuid(),
  is_archived: z.boolean(),
});

// ── listCustomFields ──────────────────────────────────────────────────────────

/**
 * Load all custom fields for the current venue (active + archived).
 */
export async function listCustomFields(): Promise<
  ActionResult<CustomFieldRow[]>
> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_fields")
    .select("*")
    .eq("venue_id", ctx.venue.id)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("listCustomFields failed:", error.message);
    return err("Could not load custom fields.");
  }

  return ok(data ?? []);
}

// ── createCustomField ─────────────────────────────────────────────────────────

/**
 * Create a new custom field, enforcing the 12-active-field cap.
 * Owner/admin only.
 */
export async function createCustomField(
  input: z.infer<typeof CreateCustomFieldSchema>,
): Promise<ActionResult<CustomFieldRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  const roleGuard = requireOwnerOrAdmin(ctx.role);
  if (roleGuard) return roleGuard;

  const parsed = CreateCustomFieldSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const { label, type, options, applies_to } = parsed.data;

  const supabase = await createClient();

  // Enforce the 12-active-field cap
  const { data: activeFields, error: countErr } = await supabase
    .from("custom_fields")
    .select("id")
    .eq("venue_id", ctx.venue.id)
    .eq("is_archived", false);

  if (countErr) {
    console.error("createCustomField count failed:", countErr.message);
    return err("Could not verify field count.");
  }

  if ((activeFields ?? []).length >= FIELD_CAP) {
    return err(
      `You have reached the cap of ${FIELD_CAP} active custom fields. Archive a field before adding a new one.`,
    );
  }

  const key = deriveKey(label);
  const sort_order = (activeFields ?? []).length;

  const { data, error } = await supabase
    .from("custom_fields")
    .insert({
      venue_id: ctx.venue.id,
      key,
      label,
      type,
      options: type === "select" ? options : null,
      applies_to,
      sort_order,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return err(
        "A field with a similar name already exists. Choose a different label.",
      );
    }
    console.error("createCustomField insert failed:", error.message);
    return err("Could not create custom field.");
  }

  revalidatePath("/settings/custom-fields");
  return ok(data);
}

// ── updateCustomField ─────────────────────────────────────────────────────────

/**
 * Update a custom field's label, type, options, or applies_to.
 * Owner/admin only.
 */
export async function updateCustomField(
  input: z.infer<typeof UpdateCustomFieldSchema>,
): Promise<ActionResult<CustomFieldRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  const roleGuard = requireOwnerOrAdmin(ctx.role);
  if (roleGuard) return roleGuard;

  const parsed = UpdateCustomFieldSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const { id, label, type, options, applies_to } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_fields")
    .update({
      label,
      type,
      options: type === "select" ? options : null,
      applies_to,
    })
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .select("*")
    .single();

  if (error) {
    console.error("updateCustomField failed:", error.message);
    return err("Could not update custom field.");
  }

  revalidatePath("/settings/custom-fields");
  return ok(data);
}

// ── setCustomFieldArchived ────────────────────────────────────────────────────

/**
 * Archive or restore a custom field.
 * Owner/admin only.
 */
export async function setCustomFieldArchived(
  input: z.infer<typeof ArchiveCustomFieldSchema>,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  const roleGuard = requireOwnerOrAdmin(ctx.role);
  if (roleGuard) return roleGuard;

  const parsed = ArchiveCustomFieldSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const { id, is_archived } = parsed.data;

  // If restoring, check we won't breach the cap
  if (!is_archived) {
    const supabase = await createClient();
    const { data: active, error: countErr } = await supabase
      .from("custom_fields")
      .select("id")
      .eq("venue_id", ctx.venue.id)
      .eq("is_archived", false);

    if (countErr) {
      return err("Could not verify field count.");
    }
    if ((active ?? []).length >= FIELD_CAP) {
      return err(
        `You are at the cap of ${FIELD_CAP} active fields. Archive another field before restoring this one.`,
      );
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("custom_fields")
    .update({ is_archived })
    .eq("id", id)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("setCustomFieldArchived failed:", error.message);
    return err("Could not update field.");
  }

  revalidatePath("/settings/custom-fields");
  return ok(undefined);
}
