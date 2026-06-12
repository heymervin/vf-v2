import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { cookies } from "next/headers";

// Row types derived from the generated schema
type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type MembershipRow = Database["public"]["Tables"]["memberships"]["Row"];

type MembershipRole = "owner" | "admin" | "member";

export type TenantContext =
  | { ok: false; reason: "unauthenticated" | "no-venue" }
  | {
      ok: true;
      user: { id: string; email: string | undefined };
      venue: {
        id: string;
        name: string;
        slug: string;
        timezone: string;
        onboardingCompletedAt: string | null;
      };
      role: MembershipRole;
    };

/**
 * Resolves the active tenant context for a Server Component or Server Action.
 *
 * Resolution order:
 * 1. Authenticate via auth.getUser() (NOT getSession — revalidates with Supabase server)
 * 2. Load the user's memberships
 * 3. Pick the active venue: prefer the `vf-venue-id` cookie if it matches a membership,
 *    otherwise fall back to the first membership row
 *
 * Cookie SETTING is intentionally out-of-scope here (Server Component safe).
 * To switch active venue, call setActiveVenue() from a Server Action.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const supabase = await createClient();

  // Step 1: authenticate
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, reason: "unauthenticated" };
  }

  // Step 2: load memberships + venue data in one query
  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select("id, venue_id, role, venues(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (membershipError || !memberships || memberships.length === 0) {
    return { ok: false, reason: "no-venue" };
  }

  // Step 3: pick active venue via cookie preference, or fallback to first
  const cookieStore = await cookies();
  const preferredVenueId = cookieStore.get("vf-venue-id")?.value ?? null;

  type MembershipWithVenue = MembershipRow & { venues: VenueRow | null };

  const matched =
    preferredVenueId !== null
      ? (memberships as MembershipWithVenue[]).find(
          (m) => m.venue_id === preferredVenueId,
        )
      : null;

  const active = (matched ?? memberships[0]) as MembershipWithVenue;
  const venue = active.venues;

  if (!venue) {
    return { ok: false, reason: "no-venue" };
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email },
    venue: {
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      timezone: venue.timezone,
      onboardingCompletedAt: venue.onboarding_completed_at,
    },
    // The DB stores role as string; cast to the known union
    role: active.role as MembershipRole,
  };
}
