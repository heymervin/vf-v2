import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard, type WizardInitialState } from "./wizard";
import type { HourRow } from "@/lib/zod-schemas/onboarding";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set up your venue | VenueFlow",
};

/**
 * Onboarding page — server component.
 *
 * Lives at /onboarding (NOT inside (app) — that layout redirects here).
 *
 * Resolution logic:
 * 1. Authenticate; null user → /login
 * 2. If venue exists and onboarding complete → /dashboard
 * 3. If venue exists → resume from onboarding_step with preloaded data
 * 4. No venue → step 1
 */
export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Look for an existing venue via membership
  const { data: memberships } = await supabase
    .from("memberships")
    .select("venue_id, venues(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  type VenueRow = {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    onboarding_step: number;
    onboarding_completed_at: string | null;
  };

  const venue = memberships?.[0]?.venues as VenueRow | null | undefined;

  // Already completed → dashboard
  if (venue?.onboarding_completed_at) {
    redirect("/dashboard");
  }

  // No venue yet → step 1
  if (!venue) {
    const initial: WizardInitialState = { step: 1 };
    return <OnboardingWizard initial={initial} />;
  }

  // Venue exists but incomplete — load saved state for the saved step
  const savedStep = (venue.onboarding_step ?? 1) as 1 | 2 | 3;

  let existingHours: HourRow[] | undefined;
  if (savedStep === 3) {
    const { data: hoursRows } = await supabase
      .from("venue_hours")
      .select("weekday, open_time, close_time")
      .eq("venue_id", venue.id);

    if (hoursRows && hoursRows.length > 0) {
      existingHours = hoursRows.map((r) => ({
        weekday: r.weekday,
        open: r.open_time !== null,
        open_time: r.open_time,
        close_time: r.close_time,
      }));
    }
  }

  const initial: WizardInitialState = {
    step: savedStep,
    venueId: venue.id,
    venueName: venue.name,
    venueSlug: venue.slug,
    venueTimezone: venue.timezone,
    existingHours,
  };

  return <OnboardingWizard initial={initial} />;
}
