"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { emailSettingsSchema } from "@/lib/zod-schemas/settings-email";

/**
 * Upsert venue_email_settings for the active venue. Owner/admin only.
 * The table has UNIQUE(venue_id) so we use onConflict upsert.
 */
export async function saveEmailSettings(
  formData: FormData,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can update email settings.");
  }

  const parsed = emailSettingsSchema.safeParse({
    from_name: formData.get("from_name"),
    reply_to: formData.get("reply_to"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Invalid input.");
  }

  const supabase = await createClient();

  // venue_email_settings is in the generated types, so no `as never` needed.
  const { error: upsertErr } = await supabase
    .from("venue_email_settings")
    .upsert(
      {
        venue_id: ctx.venue.id,
        from_name: parsed.data.from_name,
        reply_to: parsed.data.reply_to,
      },
      { onConflict: "venue_id" },
    );

  if (upsertErr) {
    console.error("email settings upsert failed:", upsertErr.message);
    return err("Could not save settings, please try again.");
  }

  revalidatePath("/settings/email");
  return ok(undefined);
}
