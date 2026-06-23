/**
 * GET /api/portal/auth/callback
 *
 * Magic-link callback for couple portal auth.
 *
 * Flow:
 *   1. Couple requests a magic link from /portal/login.
 *   2. Supabase sends OTP link with redirect to this route.
 *   3. This handler exchanges the code for a session.
 *   4. Looks up couple_accounts by user_id — if found, redirect to /portal.
 *   5. Falls back to email lookup: if found, activates the account and redirects.
 *   6. If still not found, redirects to /portal/login?error=not_invited.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/portal/login?error=auth_failed`);
  }

  const supabase = await createClient();

  const { data: sessionData, error: sessionError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (sessionError || !sessionData.user) {
    console.error("portal/auth/callback: code exchange failed", sessionError?.message);
    return NextResponse.redirect(`${origin}/portal/login?error=auth_failed`);
  }

  const user = sessionData.user;
  const admin = createAdminClient();

  // 1. Look up by user_id (already activated)
  const { data: byUserId } = await admin
    .from("couple_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (byUserId) {
    // Update last_login_at
    await admin
      .from("couple_accounts")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", byUserId.id);
    return NextResponse.redirect(`${origin}/portal`);
  }

  // 2. Fall back to email lookup — first-time activation
  const email = user.email;
  if (!email) {
    return NextResponse.redirect(`${origin}/portal/login?error=not_invited`);
  }

  const { data: byEmail } = await admin
    .from("couple_accounts")
    .select("id")
    .eq("email", email)
    .neq("status", "disabled")
    .maybeSingle();

  if (!byEmail) {
    return NextResponse.redirect(`${origin}/portal/login?error=not_invited`);
  }

  // Activate the account
  const now = new Date().toISOString();
  const { error: activateError } = await admin
    .from("couple_accounts")
    .update({
      user_id: user.id,
      status: "active",
      activated_at: now,
      last_login_at: now,
    })
    .eq("id", byEmail.id);

  if (activateError) {
    console.error("portal/auth/callback: activation failed", activateError.message);
    return NextResponse.redirect(`${origin}/portal/login?error=auth_failed`);
  }

  return NextResponse.redirect(`${origin}/portal`);
}
