"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { venueProfileSchema, venueHoursSchema, type VenueHourRow } from "@/lib/zod-schemas/settings-venue";

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Save venue name, slug, timezone, and optional logo. Owner/admin only.
 * Returns { logoError } when the venue was saved but logo upload failed (non-fatal).
 */
export async function saveVenueProfile(
  formData: FormData,
): Promise<ActionResult<{ logoError?: string }>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can update the venue profile.");
  }

  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone"),
  };

  const parsed = venueProfileSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Invalid input.");
  }

  const { name, slug, timezone } = parsed.data;
  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from("venues")
    .update({ name, slug, timezone })
    .eq("id", ctx.venue.id);

  if (updateError) {
    const code = (updateError as { code?: string }).code;
    const msg = updateError.message.toLowerCase();
    if (code === "23505" || msg.includes("already taken")) {
      return err("SLUG_TAKEN");
    }
    if (code === "23514" || msg.includes("invalid slug")) {
      return err("SLUG_FORMAT");
    }
    console.error("[saveVenueProfile] update error:", updateError);
    return err("Could not save, please try again.");
  }

  // Optional logo upload — non-fatal if it fails
  let logoError: string | undefined;
  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    const result = await uploadVenueLogo(supabase, ctx.venue.id, logoFile);
    if (!result.ok) {
      logoError = result.error;
    } else {
      await supabase
        .from("venues")
        .update({ logo_path: result.data })
        .eq("id", ctx.venue.id);
    }
  }

  revalidatePath("/settings/venue");
  revalidatePath("/dashboard");

  return ok({ logoError });
}

/**
 * Remove the current logo (sets logo_path to null). Owner/admin only.
 */
export async function removeVenueLogo(): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can update the venue profile.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("venues")
    .update({ logo_path: null })
    .eq("id", ctx.venue.id);

  if (error) {
    console.error("[removeVenueLogo] error:", error);
    return err("Could not remove logo, please try again.");
  }

  revalidatePath("/settings/venue");
  return ok(undefined);
}

/**
 * Save all 7 venue_hours rows. Owner/admin only.
 * Upserts on conflict (venue_id, weekday).
 */
export async function saveVenueHours(
  rows: VenueHourRow[],
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can update opening hours.");
  }

  const parsed = venueHoursSchema.safeParse({ rows });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Invalid hours data.");
  }

  const upsertRows = parsed.data.rows.map((row) => ({
    venue_id: ctx.venue.id,
    weekday: row.weekday,
    open_time: row.open ? row.open_time : null,
    close_time: row.open ? row.close_time : null,
  }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_hours")
    .upsert(upsertRows, { onConflict: "venue_id,weekday" });

  if (error) {
    console.error("[saveVenueHours] upsert error:", error);
    return err("Could not save hours, please try again.");
  }

  revalidatePath("/settings/venue");
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

async function uploadVenueLogo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  file: File,
): Promise<ActionResult<string>> {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return err("Logo must be PNG, JPG, or WebP.");
  }
  if (file.size > MAX_LOGO_SIZE) {
    return err("Logo must be 2 MB or smaller.");
  }

  const ext = file.type.split("/")[1];
  const path = `${venueId}/logo.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("venue-assets")
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("[uploadVenueLogo] error:", uploadError);
    return err("Could not upload logo.");
  }

  return ok(path);
}
