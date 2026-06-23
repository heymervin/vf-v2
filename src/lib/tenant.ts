import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { cookies } from "next/headers";

// Row types derived from the generated schema
type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type MembershipRow = Database["public"]["Tables"]["memberships"]["Row"];
type BillingRow = Database["public"]["Tables"]["billing_subscriptions"]["Row"];

type MembershipRole = "owner" | "admin" | "member";

/**
 * Access state for read-only enforcement.
 *
 * - 'trialing'  trial_ends_at is in the future and there is no active subscription
 * - 'active'    subscription status is 'active' (or Stripe 'trialing')
 * - 'past_due'  subscription exists but is past_due or incomplete
 * - 'expired'   trial elapsed AND no active/trialing subscription → read-only
 */
export type AccessState = "trialing" | "active" | "past_due" | "expired";

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
        trialEndsAt: string | null;
        /** 'bundled' = GHL-backed (pre-sales in GHL); 'standalone' = native CRM (D2). */
        mode: "bundled" | "standalone";
      };
      role: MembershipRole;
      access: AccessState;
      billing: {
        stripeCustomerId: string | null;
        status: Database["public"]["Enums"]["subscription_status"] | null;
        currentPeriodEnd: string | null;
      };
    };

/**
 * Compute the access state from venue + billing row in a single place.
 * No extra query — the billing row is loaded alongside the venue.
 */
function computeAccessState(
  trialEndsAt: string | null,
  billing: BillingRow | null,
): AccessState {
  const now = Date.now();

  if (billing) {
    if (billing.status === "active" || billing.status === "trialing") {
      return "active";
    }
    if (billing.status === "past_due" || billing.status === "incomplete") {
      return "past_due";
    }
    // canceled / unknown → fall through to trial check
  }

  // No active subscription — check trial
  if (trialEndsAt && new Date(trialEndsAt).getTime() > now) {
    return "trialing";
  }

  return "expired";
}

/**
 * Resolves the active tenant context for a Server Component or Server Action.
 *
 * Resolution order:
 * 1. Authenticate via auth.getUser() (NOT getSession — revalidates with Supabase server)
 * 2. Load the user's memberships + venue + billing subscription in one pass
 * 3. Pick the active venue: prefer the `vf-venue-id` cookie if it matches a membership,
 *    otherwise fall back to the first membership row
 * 4. Compute access state (trialing / active / past_due / expired) without an extra query
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

  // Step 4: load billing subscription for access state (single row, non-critical)
  const { data: billingRow } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("venue_id", venue.id)
    .maybeSingle();

  const accessState = computeAccessState(venue.trial_ends_at, billingRow ?? null);

  return {
    ok: true,
    user: { id: user.id, email: user.email },
    venue: {
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      timezone: venue.timezone,
      onboardingCompletedAt: venue.onboarding_completed_at,
      trialEndsAt: venue.trial_ends_at,
      mode: (venue.mode ?? "bundled") as "bundled" | "standalone",
    },
    role: active.role as MembershipRole,
    access: accessState,
    billing: {
      stripeCustomerId: billingRow?.stripe_customer_id ?? null,
      status: billingRow?.status ?? null,
      currentPeriodEnd: billingRow?.current_period_end ?? null,
    },
  };
}
