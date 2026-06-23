import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolved couple session context, shared by the guarded portal layout (for the
 * auth gate + venue branding chrome) and the portal data page (for the RLS
 * session client + wedding/venue ids).
 *
 * Resolution order:
 *   1. supabase.auth.getUser() — the RLS-bound session identity.
 *   2. couple_accounts row for this user (service-role, by user_id) — the only
 *      place wedding_id + venue_id come from. status must be 'active'.
 *   3. Safe venue branding columns ONLY (never ghl/billing columns).
 *
 * Returns null when there is no authenticated couple — callers redirect to
 * /portal/login. No portal data is fetched before this resolves.
 */
export interface CoupleContext {
  userId: string;
  coupleAccountId: string;
  weddingId: string;
  venueId: string;
  firstName: string | null;
  venue: {
    name: string;
    slug: string;
    accentSeed: string;
    logoUrl: string | null;
  };
}

export async function resolveCoupleContext(): Promise<CoupleContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();

  const { data: account } = await admin
    .from("couple_accounts")
    .select("id, wedding_id, venue_id, first_name, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!account) return null;

  // Safe branding columns ONLY — never select ghl_*/billing columns.
  const { data: venue } = await admin
    .from("venues")
    .select("name, slug, accent_seed, logo_path")
    .eq("id", account.venue_id)
    .maybeSingle();

  if (!venue) return null;

  let logoUrl: string | null = null;
  if (venue.logo_path) {
    const { data: signed } = await admin.storage
      .from("venue-assets")
      .createSignedUrl(venue.logo_path, 60 * 60);
    logoUrl = signed?.signedUrl ?? null;
  }

  return {
    userId: user.id,
    coupleAccountId: account.id,
    weddingId: account.wedding_id,
    venueId: account.venue_id,
    firstName: account.first_name,
    venue: {
      name: venue.name,
      slug: venue.slug,
      accentSeed: venue.accent_seed,
      logoUrl,
    },
  };
}
