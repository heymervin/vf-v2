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
 *
 * A `next` query param (allowlisted to /accept-invite/*) overrides the
 * default destination so invite links survive email-confirmation flows.
 */

// Allowlist: only /accept-invite/<uuid> paths are permitted as a post-auth
// redirect target. This prevents open-redirect attacks via the `next` param.
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (/^\/accept-invite\/[0-9a-f-]+$/i.test(decoded)) return decoded;
  } catch {
    // ignore malformed %xx sequences
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

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

  // If a validated return path was requested (e.g. an invite link), honour it
  // directly — skip the membership check entirely for this case.
  if (next) {
    return NextResponse.redirect(new URL(next, origin));
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
