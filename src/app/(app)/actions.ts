"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/actions";

const uuidSchema = z.string().uuid();

/**
 * Switches the active venue for the current user session.
 * Validates the venueId is a UUID, verifies the user has a membership for it,
 * then sets the vf-venue-id cookie so getTenantContext() picks it up.
 */
export async function setActiveVenue(
  venueId: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(venueId);
  if (!parsed.success) {
    return err("Invalid venue ID.");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err("Not authenticated.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("venue_id", parsed.data)
    .maybeSingle();

  if (membershipError || !membership) {
    return err("You do not have access to that venue.");
  }

  const cookieStore = await cookies();
  cookieStore.set("vf-venue-id", parsed.data, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });

  return ok(undefined);
}

/**
 * Signs the current user out and redirects to /login.
 * Called from the sidebar user menu.
 */
export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
