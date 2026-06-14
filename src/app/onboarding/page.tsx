import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { OnboardingWizard, type WizardInitialState } from "./wizard";
import type { HourRow } from "@/lib/zod-schemas/onboarding";
import type { Metadata } from "next";
import { MemberWaitingScreen } from "./member-waiting-screen";

export const metadata: Metadata = {
  title: "Set up your venue | VenueFlow",
};

/**
 * Onboarding page — server component.
 *
 * Lives at /onboarding (NOT inside (app) — that layout redirects here).
 *
 * Resolution logic (uses getTenantContext for cookie-aware active-venue selection):
 * 1. Unauthenticated → /login
 * 2. No venue at all (reason: 'no-venue') → fresh step 1
 * 3. Venue exists + onboarding complete → /dashboard
 * 4. Role is 'member' + onboarding incomplete → waiting state (member can't write)
 * 5. Venue exists, incomplete + owner/admin → resume from onboarding_step
 */
export default async function OnboardingPage() {
  const ctx = await getTenantContext();

  if (!ctx.ok) {
    if (ctx.reason === "unauthenticated") {
      redirect("/login");
    }
    // reason === 'no-venue': fresh start
    const initial: WizardInitialState = { step: 1 };
    return <OnboardingWizard initial={initial} />;
  }

  // Venue exists + completed → dashboard
  if (ctx.venue.onboardingCompletedAt !== null) {
    redirect("/dashboard");
  }

  // Plain member whose venue is still being set up — they cannot write via RLS
  if (ctx.role === "member") {
    return <MemberWaitingScreen />;
  }

  // Owner or admin — look up current onboarding_step from raw DB row
  // (getTenantContext intentionally omits it)
  const supabase = await createClient();
  const { data: venueRow } = await supabase
    .from("venues")
    .select("onboarding_step")
    .eq("id", ctx.venue.id)
    .single();

  const step = (venueRow?.onboarding_step ?? 1) as 1 | 2 | 3;

  let existingHours: HourRow[] | undefined;
  if (step === 3) {
    const { data: hoursRows } = await supabase
      .from("venue_hours")
      .select("weekday, open_time, close_time")
      .eq("venue_id", ctx.venue.id);

    if (hoursRows && hoursRows.length > 0) {
      existingHours = hoursRows.map((r) => ({
        weekday: r.weekday,
        open: r.open_time !== null,
        // PostgREST returns "HH:MM:SS" — normalise to "HH:MM" before passing to client
        open_time: r.open_time ? r.open_time.slice(0, 5) : null,
        close_time: r.close_time ? r.close_time.slice(0, 5) : null,
      }));
    }
  }

  const initial: WizardInitialState = {
    step,
    venueId: ctx.venue.id,
    venueName: ctx.venue.name,
    venueSlug: ctx.venue.slug,
    venueTimezone: ctx.venue.timezone,
    existingHours,
  };

  return <OnboardingWizard initial={initial} />;
}
