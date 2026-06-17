/**
 * GET /api/invite/accept
 *
 * Called after a Supabase auth invite link is clicked. Supabase redirects
 * here with the session already established (tokens in the URL fragment
 * are exchanged by the @supabase/ssr client via the auth callback flow).
 *
 * This route reads the invited_role from the auth user metadata and creates
 * the membership row for the invitee.
 *
 * Flow:
 *   1. Supabase sends invite email via auth.admin.inviteUserByEmail with
 *      data: { venue_id, invited_role } in user_metadata.
 *   2. Invitee clicks the link → Supabase exchanges the token and redirects
 *      to this route with an active session.
 *   3. This handler reads the session, extracts venue_id + invited_role,
 *      inserts the memberships row (service-role — bypasses RLS), then
 *      redirects to the dashboard.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/dashboard";

  // The Supabase SSR client picks up the session from the cookies set by the
  // auth helper exchange that happened upstream.
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.error("invite/accept: no authenticated user", error?.message);
    return NextResponse.redirect(`${origin}/login?error=invite_invalid`);
  }

  const venueId = user.user_metadata?.venue_id as string | undefined;
  const invitedRole = (user.user_metadata?.invited_role as string | undefined) ?? "member";

  if (!venueId) {
    // Not an invite callback — just redirect to dashboard
    return NextResponse.redirect(`${origin}${next}`);
  }

  const admin = createAdminClient();

  // Check if membership already exists (idempotent)
  const { data: existing } = await admin
    .from("memberships")
    .select("id")
    .eq("venue_id", venueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error: insertErr } = await admin.from("memberships").insert({
      venue_id: venueId,
      user_id: user.id,
      role: invitedRole,
    });

    if (insertErr) {
      console.error("invite/accept: membership insert failed", insertErr.message);
      return NextResponse.redirect(`${origin}/login?error=invite_failed`);
    }
  }

  // Clear the invite metadata so it doesn't re-fire on subsequent logins
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { venue_id: null, invited_role: null },
  });

  return NextResponse.redirect(`${origin}${next}`);
}
