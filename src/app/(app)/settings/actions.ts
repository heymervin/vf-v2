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

  // One active brochure per venue: deactivate the old one and insert the new in
  // a single transaction (RPC) so a failed swap never leaves zero active rows.
  // Function name typed as `never` until `supabase db push` regenerates types.ts
  // with the replace_active_brochure entry (same idiom as pipeline/actions.ts).
  const { error: rpcErr } = await supabase.rpc(
    "replace_active_brochure" as never,
    {
      p_venue_id: ctx.venue.id,
      p_file_path: path,
      p_title: title,
    } as never,
  );
  if (rpcErr) {
    console.error("brochure replace failed:", rpcErr.message);
    // Remove the just-uploaded object so a failed swap leaves no orphan.
    await supabase.storage.from("brochures").remove([path]);
    return err("Could not save the brochure, please try again.");
  }

  revalidatePath("/settings/brochure");
  return ok(undefined);
}
