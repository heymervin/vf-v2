"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB (bucket also enforces)

/**
 * Upload a brochure PDF and make it the venue's active brochure. Owner/admin
 * only. Deactivates any prior active brochure first (one active per venue).
 */
export async function uploadBrochure(
  formData: FormData,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage the brochure.");
  }

  const file = formData.get("file");
  const title = ((formData.get("title") as string) || "").trim() || null;
  if (!(file instanceof File) || file.size === 0) {
    return err("Choose a PDF to upload.");
  }
  if (file.type !== "application/pdf") return err("The brochure must be a PDF.");
  if (file.size > MAX_BYTES) return err("The PDF must be 10MB or smaller.");

  const supabase = await createClient();
  const path = `${ctx.venue.id}/brochure-${Date.now()}.pdf`;

  const { error: upErr } = await supabase.storage
    .from("brochures")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (upErr) {
    console.error("brochure upload failed:", upErr.message);
    return err("Could not upload, please try again.");
  }

  // One active brochure per venue: deactivate the old one, then insert the new.
  await supabase
    .from("brochures")
    .update({ is_active: false })
    .eq("venue_id", ctx.venue.id)
    .eq("is_active", true);

  const { error: insErr } = await supabase
    .from("brochures")
    .insert({ venue_id: ctx.venue.id, file_path: path, title, is_active: true });
  if (insErr) {
    console.error("brochure insert failed:", insErr.message);
    return err("Could not save the brochure, please try again.");
  }

  revalidatePath("/settings/brochure");
  return ok(undefined);
}
