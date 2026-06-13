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

// Onboarding actions are intentionally NOT gated by assertCanMutate: the venue
// must be created and set up before its trial/access state is meaningful.
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

  // Check if an existing venueId was threaded from the wizard (back-from-step-2 resume)
  const existingVenueId = formData.get("venueId");

  let venueId: string;

  if (existingVenueId && typeof existingVenueId === "string") {
    // UPDATE path: user already owns this venue — patch name/slug/timezone.
    // RLS policy ensures the user can only update venues they own/admin.
    const { error: updateError } = await supabase
      .from("venues")
      .update({ name, slug, timezone, onboarding_step: 2 })
      .eq("id", existingVenueId);

    if (updateError) {
      if (
        updateError.message.toLowerCase().includes("unique") ||
        updateError.message.toLowerCase().includes("slug")
      ) {
        return err("SLUG_TAKEN");
      }
      console.error("[createVenueWithProfile] update error:", updateError);
      return err("Could not save, try again.");
    }

    venueId = existingVenueId;
  } else {
    // CREATE path: check for stale incomplete venue before calling RPC
    // (guards against stale-resume where the client lost its venueId)
    const { data: staleMembership } = await supabase
      .from("memberships")
      .select("venue_id, venues!inner(id, onboarding_completed_at)")
      .eq("user_id", user.id)
      .is("venues.onboarding_completed_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    type MembershipWithVenue = {
      venue_id: string;
      venues: { id: string; onboarding_completed_at: string | null };
    };

    const stale = staleMembership as MembershipWithVenue | null;

    if (stale?.venue_id) {
      // Reuse the stale venue instead of creating a duplicate
      const { error: updateError } = await supabase
        .from("venues")
        .update({ name, slug, timezone, onboarding_step: 2 })
        .eq("id", stale.venue_id);

      if (updateError) {
        if (
          updateError.message.toLowerCase().includes("unique") ||
          updateError.message.toLowerCase().includes("slug")
        ) {
          return err("SLUG_TAKEN");
        }
        console.error("[createVenueWithProfile] stale-update error:", updateError);
        return err("Could not save, try again.");
      }

      venueId = stale.venue_id;
    } else {
      // No existing incomplete venue — call RPC to create
      const { data: venue, error: rpcError } = await supabase.rpc(
        "create_venue_with_owner",
        { p_name: name, p_slug: slug },
      );

      if (rpcError) {
        if (
          rpcError.message.toLowerCase().includes("unique") ||
          rpcError.message.toLowerCase().includes("slug")
        ) {
          return err("SLUG_TAKEN");
        }
        console.error("[createVenueWithProfile] rpc error:", rpcError);
        return err("Could not save, try again.");
      }

      if (!venue) {
        return err("Could not save, try again.");
      }

      venueId = venue.id;

      // Update timezone (RPC only takes name+slug; default is UTC)
      const { error: tzError } = await supabase
        .from("venues")
        .update({ timezone })
        .eq("id", venueId);

      if (tzError) {
        console.error("[createVenueWithProfile] tz update error:", tzError);
        return err("Could not save, try again.");
      }
    }
  }

  // Optional logo upload — must happen AFTER venue exists (storage RLS needs membership)
  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    const uploadResult = await uploadLogo(supabase, venueId, logoFile);
    if (!uploadResult.ok) {
      // Non-fatal: venue is created/updated, just log the error
      console.error("[createVenueWithProfile] logo upload failed:", uploadResult.error);
    } else {
      await supabase
        .from("venues")
        .update({ logo_path: uploadResult.data })
        .eq("id", venueId);
    }
  }

  // Ensure onboarding_step is 2 (already set above in update paths, set here for the RPC path)
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
  const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
  const MAX_SIZE = 2 * 1024 * 1024; // 2 MB — matches bucket allowed_mime_types

  if (!ALLOWED_TYPES.includes(file.type)) {
    return err("Logo must be PNG, JPG, or WebP.");
  }
  if (file.size > MAX_SIZE) {
    return err("Logo must be 2 MB or smaller.");
  }

  const ext = file.type.split("/")[1];
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
    console.error("[uploadLogo] storage upload error:", uploadError);
    return err("Could not upload logo.");
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
      console.error("[saveSpace] space insert error:", spaceError);
      return err("Could not save, try again.");
    }

    spaceId = space.id;
  }

  // Advance onboarding step to 3
  const { error: stepError } = await supabase
    .from("venues")
    .update({ onboarding_step: 3 })
    .eq("id", venueId)
    .select("id")
    .single();

  if (stepError) {
    console.error("[saveSpace] onboarding_step update error:", stepError);
    return err("Could not save, try again.");
  }

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
    console.error("[finishHours] hours upsert error:", hoursError);
    return err("Could not save, try again.");
  }

  // Mark onboarding complete
  const { error: updateError } = await supabase
    .from("venues")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", venueId)
    .select("id")
    .single();

  if (updateError) {
    console.error("[finishHours] complete update error:", updateError);
    return err("Could not save, try again.");
  }

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");

  return ok(undefined);
}
