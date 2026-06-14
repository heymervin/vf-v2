"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { spaceSchema } from "@/lib/zod-schemas/settings-spaces";
import type { Database } from "@/lib/supabase/types";

type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];

function canManage(role: string): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Create a new space for the authenticated user's venue.
 * Owner/admin only.
 */
export async function createSpace(
  formData: FormData,
): Promise<ActionResult<SpaceRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (!canManage(ctx.role)) return err("Only owners and admins can manage spaces.");

  const raw = {
    name: formData.get("name") as string,
    capacity_seated: formData.get("capacity_seated")
      ? Number(formData.get("capacity_seated"))
      : null,
    capacity_standing: formData.get("capacity_standing")
      ? Number(formData.get("capacity_standing"))
      : null,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = spaceSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Invalid input.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("spaces")
    .insert({
      venue_id: ctx.venue.id,
      name: parsed.data.name,
      capacity_seated: parsed.data.capacity_seated ?? null,
      capacity_standing: parsed.data.capacity_standing ?? null,
      description: parsed.data.description ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createSpace failed:", error?.message);
    return err("Could not create space, please try again.");
  }

  revalidatePath("/settings/spaces");
  return ok(data);
}

/**
 * Update an existing space. Owner/admin only. The space must belong to the
 * authenticated user's venue (RLS enforces this too).
 */
export async function updateSpace(
  spaceId: string,
  formData: FormData,
): Promise<ActionResult<SpaceRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (!canManage(ctx.role)) return err("Only owners and admins can manage spaces.");

  const raw = {
    name: formData.get("name") as string,
    capacity_seated: formData.get("capacity_seated")
      ? Number(formData.get("capacity_seated"))
      : null,
    capacity_standing: formData.get("capacity_standing")
      ? Number(formData.get("capacity_standing"))
      : null,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = spaceSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Invalid input.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("spaces")
    .update({
      name: parsed.data.name,
      capacity_seated: parsed.data.capacity_seated ?? null,
      capacity_standing: parsed.data.capacity_standing ?? null,
      description: parsed.data.description ?? null,
    })
    .eq("id", spaceId)
    .eq("venue_id", ctx.venue.id)
    .select()
    .single();

  if (error || !data) {
    console.error("updateSpace failed:", error?.message);
    return err("Could not update space, please try again.");
  }

  revalidatePath("/settings/spaces");
  return ok(data);
}

/**
 * Delete a space. Owner/admin only. The space must belong to the authenticated
 * user's venue (RLS enforces this too).
 */
export async function deleteSpace(
  spaceId: string,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (!canManage(ctx.role)) return err("Only owners and admins can manage spaces.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("spaces")
    .delete()
    .eq("id", spaceId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("deleteSpace failed:", error.message);
    return err("Could not delete space, please try again.");
  }

  revalidatePath("/settings/spaces");
  return ok(undefined);
}
