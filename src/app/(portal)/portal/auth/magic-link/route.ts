import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /portal/auth/magic-link
 *
 * Counterpart to the couple invite (sent by opportunity-won.ts). The invite is
 * created with `supabase.auth.admin.inviteUserByEmail` /
 * `signInWithOtp`, carrying user_metadata { couple_account_id, wedding_id,
 * venue_id } and redirectTo = `${NEXT_PUBLIC_APP_URL}/portal/auth/magic-link`.
 *
 * Flow:
 *   1. Exchange the invite/OTP code for a session (@supabase/ssr PKCE flow).
 *   2. Read couple_account_id from the authenticated user's metadata.
 *   3. Using the service-role admin client, claim the couple_accounts row:
 *      set user_id = this user, status = 'active', activated_at = now().
 *      Only claim when the row is unclaimed (user_id IS NULL) or already ours.
 *   4. Redirect to /portal.
 *
 * Must be reachable unauthenticated (it is what establishes the session) — it
 * lives OUTSIDE the guarded portal data pages.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();

  // ── 1. Establish the session ────────────────────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[portal/auth/magic-link] code exchange error:", error);
      return NextResponse.redirect(
        new URL("/portal/login?error=link_invalid", origin),
      );
    }
  } else if (tokenHash) {
    // Email-OTP / invite hash variant of the @supabase/ssr flow.
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type:
        type === "invite" || type === "signup" || type === "recovery"
          ? type
          : "magiclink",
    });
    if (error) {
      console.error("[portal/auth/magic-link] verifyOtp error:", error);
      return NextResponse.redirect(
        new URL("/portal/login?error=link_invalid", origin),
      );
    }
  } else {
    return NextResponse.redirect(
      new URL("/portal/login?error=missing_code", origin),
    );
  }

  // ── 2. Confirmed identity ───────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/portal/login?error=no_user", origin),
    );
  }

  // ── 3. Claim the couple_accounts row (service-role; bypasses RLS) ───────
  const coupleAccountId =
    (user.user_metadata?.couple_account_id as string | undefined) ?? null;

  if (coupleAccountId) {
    const admin = createAdminClient();
    // Only claim a row that is unclaimed or already linked to this user — an
    // already-active row owned by someone else must never be reassigned.
    const { error: claimError } = await admin
      .from("couple_accounts")
      .update({
        user_id: user.id,
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .eq("id", coupleAccountId)
      .or(`user_id.is.null,user_id.eq.${user.id}`);

    if (claimError) {
      console.error(
        "[portal/auth/magic-link] failed to activate couple account:",
        claimError.message,
      );
    }
  }

  return NextResponse.redirect(new URL("/portal", origin));
}
