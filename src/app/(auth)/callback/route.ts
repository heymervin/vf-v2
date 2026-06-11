import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /callback
 *
 * Handles the OAuth / magic-link / email-confirmation code exchange.
 * After exchanging the code for a session, checks whether the user has
 * any memberships:
 *   - No membership  → /onboarding (new user, needs to create their venue)
 *   - Has membership → /dashboard
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    // No code in the URL — redirect to login with an error indicator
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
    );
  }

  // Re-fetch user after exchange to get a confirmed identity
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=no_user", origin));
  }

  // Determine post-auth destination: onboarding if no membership exists yet
  const { data: memberships } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  const hasVenue = Array.isArray(memberships) && memberships.length > 0;
  const destination = hasVenue ? "/dashboard" : "/onboarding";

  return NextResponse.redirect(new URL(destination, origin));
}
