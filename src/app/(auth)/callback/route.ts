import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";

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
    console.error("[auth/callback] code exchange error:", error);
    return NextResponse.redirect(
      new URL("/login?error=callback_failed", origin),
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
    .select("id, venue_id")
    .eq("user_id", user.id)
    .limit(1);

  const hasVenue = Array.isArray(memberships) && memberships.length > 0;
  const destination = hasVenue ? "/dashboard" : "/onboarding";

  // Fire GHL contacts sync in the background — non-blocking, no await.
  // Pulls any won opportunities not yet in the weddings table.
  if (hasVenue && memberships?.[0]?.venue_id) {
    void inngest
      .send({ name: "ghl/contacts-sync", data: { venueId: memberships[0].venue_id } })
      .catch((err) => console.warn("[auth/callback] ghl-contacts-sync fire failed:", err));
  }

  return NextResponse.redirect(new URL(destination, origin));
}
