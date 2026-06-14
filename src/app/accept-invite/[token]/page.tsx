import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Accept invitation" };

// Lives OUTSIDE the (app) route group on purpose: a logged-in user who does not
// yet belong to any venue must be able to reach this page. The (app) layout
// would otherwise bounce a no-venue user to /onboarding before they could
// redeem the invite.
//
// Flow:
//   - not logged in     → ask them to sign in / create an account, then return
//   - logged in + valid → accept_invitation RPC creates the membership, then we
//                         redirect to /dashboard
//   - invalid / used / wrong email → friendly error (RPC raises P0001)
export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Basic shape guard before we hit the DB (token is a uuid).
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      token,
    );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated → invite them to sign in / sign up first.
  // Pass the current invite URL as `next` so both auth routes can return
  // the user here after they authenticate rather than going to /dashboard
  // or /onboarding.
  if (!user) {
    const returnTo = `/accept-invite/${token}`;
    const loginHref = `/login?next=${encodeURIComponent(returnTo)}`;
    const signupHref = `/signup?next=${encodeURIComponent(returnTo)}`;
    return (
      <Shell
        title="You've been invited to VenueFlow"
        body="Sign in (or create an account) with the email address this invite was sent to. You'll be brought right back here to join the team."
      >
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href={loginHref}>Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={signupHref}>Create an account</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  if (!isUuid) {
    return (
      <Shell
        title="This invite link isn't valid"
        body="The link may be incomplete or out of date. Ask whoever invited you to send a fresh link."
      >
        <DashboardButton />
      </Shell>
    );
  }

  // Logged in → redeem. The RPC validates the token, confirms it matches this
  // user's email, creates the membership, and stamps accepted_at — all server
  // side. It returns the venue_id on success.
  // accept_invitation is not in the generated types yet (added by
  // 20260614130000_invitations.sql); cast past the typing — same idiom as the
  // other post-migration RPC calls in this codebase.
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const { error } = await (supabase as any).rpc("accept_invitation", {
    p_token: token,
  });

  if (error) {
    // RPC raises descriptive P0001 messages for the known cases; surface them.
    return (
      <Shell title="We couldn't accept this invite" body={inviteError(error)}>
        <DashboardButton />
      </Shell>
    );
  }

  redirect("/dashboard");
}

// Map the RPC's raised message to clean user-facing copy. Falls back to a
// generic message for anything unexpected.
function inviteError(error: { message?: string }): string {
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("already been used")) {
    return "This invite has already been used. If you still need access, ask for a new invite.";
  }
  if (msg.includes("different email")) {
    return "This invite was sent to a different email address. Sign in with the address it was sent to, then try again.";
  }
  if (msg.includes("not valid")) {
    return "This invite link isn't valid. Ask whoever invited you to send a fresh link.";
  }
  return "Something went wrong accepting this invite. Please try again or ask for a new link.";
}

function Shell({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 text-center">
      <div className="w-full max-w-[480px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          VenueFlow
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.022em] text-foreground">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
        {children}
      </div>
    </main>
  );
}

function DashboardButton() {
  return (
    <div className="mt-6">
      <Button asChild variant="outline">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  );
}
