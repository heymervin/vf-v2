"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/actions";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  type Step3Input,
} from "@/lib/zod-schemas/onboarding";
import { DEFAULT_HOURS } from "./hours-defaults";

// ---------------------------------------------------------------------------
// Step 1: Create venue with owner membership + optional logo upload
// ---------------------------------------------------------------------------

export interface Step1Result {
  venueId: string;
  slug: string;
}

export async function createVenueWithProfile(
  formData: FormData,
): Promise<ActionResult<Step1Result>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err("Not authenticated.");
  }

  // Parse + validate text fields
  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone"),
  };

  const parsed = step1Schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Invalid input.");
  }

  const { name, slug, timezone } = parsed.data;

  // Call RPC — handles venue insert + membership insert atomically
  const { data: venue, error: rpcError } = await supabase.rpc(
    "create_venue_with_owner",
    { p_name: name, p_slug: slug },
  );

  if (rpcError) {
    // Slug uniqueness constraint surfaces here
    if (
      rpcError.message.toLowerCase().includes("unique") ||
      rpcError.message.toLowerCase().includes("slug")
    ) {
      return err("SLUG_TAKEN");
    }
    return err(rpcError.message);
  }

  if (!venue) {
    return err("Venue creation failed — no data returned.");
  }

  const venueId = venue.id;

  // Update timezone (RPC only takes name+slug; default is UTC)
  const { error: tzError } = await supabase
    .from("venues")
    .update({ timezone })
    .eq("id", venueId);

  if (tzError) {
    return err(tzError.message);
  }

  // Optional logo upload — must happen AFTER venue creation (storage RLS needs membership)
  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    const uploadResult = await uploadLogo(supabase, venueId, logoFile);
    if (!uploadResult.ok) {
      // Non-fatal: venue is created, just log the error
      // We still advance — the user can re-upload in settings
    } else {
      await supabase
        .from("venues")
        .update({ logo_path: uploadResult.data })
        .eq("id", venueId);
    }
  }

  // Advance onboarding step to 2
  await supabase
    .from("venues")
    .update({ onboarding_step: 2 })
    .eq("id", venueId);

  revalidatePath("/onboarding");

  return ok({ venueId, slug });
}

async function uploadLogo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  file: File,
): Promise<ActionResult<string>> {
  const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    return err("Logo must be PNG, JPG, WebP, or SVG.");
  }
  if (file.size > MAX_SIZE) {
    return err("Logo must be 2 MB or smaller.");
  }

  const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1];
  const path = `${venueId}/logo.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("venue-assets")
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return err(uploadError.message);
  }

  return ok(path);
}

// ---------------------------------------------------------------------------
// Step 2: Save first space (or skip)
// ---------------------------------------------------------------------------

export interface Step2Result {
  spaceId: string | null;
}

export async function saveSpace(
  venueId: string,
  input: FormData | "skip",
): Promise<ActionResult<Step2Result>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err("Not authenticated.");
  }

  let spaceId: string | null = null;

  if (input !== "skip") {
    const raw = {
      name: input.get("name"),
      capacity_seated: input.get("capacity_seated")
        ? Number(input.get("capacity_seated"))
        : null,
      capacity_standing: input.get("capacity_standing")
        ? Number(input.get("capacity_standing"))
        : null,
      description: input.get("description") || undefined,
    };

    const parsed = step2Schema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return err(first?.message ?? "Invalid input.");
    }

    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .insert({
        venue_id: venueId,
        name: parsed.data.name,
        capacity_seated: parsed.data.capacity_seated ?? null,
        capacity_standing: parsed.data.capacity_standing ?? null,
        description: parsed.data.description ?? null,
      })
      .select("id")
      .single();

    if (spaceError) {
      return err(spaceError.message);
    }

    spaceId = space.id;
  }

  // Advance onboarding step to 3
  await supabase
    .from("venues")
    .update({ onboarding_step: 3 })
    .eq("id", venueId);

  revalidatePath("/onboarding");

  return ok({ spaceId });
}

// ---------------------------------------------------------------------------
// Step 3: Save hours (or skip with defaults) + complete onboarding
// ---------------------------------------------------------------------------

export async function finishHours(
  venueId: string,
  rows: Step3Input["rows"] | "skip",
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err("Not authenticated.");
  }

  const hoursToSave = rows === "skip" ? DEFAULT_HOURS : rows;

  const parsed = step3Schema.safeParse({ rows: hoursToSave });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Invalid hours data.");
  }

  // Upsert all 7 rows — open rows get times, closed rows get null times
  const upsertRows = parsed.data.rows.map((row) => ({
    venue_id: venueId,
    weekday: row.weekday,
    open_time: row.open ? row.open_time : null,
    close_time: row.open ? row.close_time : null,
  }));

  const { error: hoursError } = await supabase
    .from("venue_hours")
    .upsert(upsertRows, { onConflict: "venue_id,weekday" });

  if (hoursError) {
    return err(hoursError.message);
  }

  // Mark onboarding complete
  const { error: updateError } = await supabase
    .from("venues")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", venueId);

  if (updateError) {
    return err(updateError.message);
  }

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");

  return ok(undefined);
}
