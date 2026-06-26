import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless per-venue feed token via HMAC — no DB column needed (Project B has
// no migration path). ponytail: reuse the service-role key as the HMAC secret so
// no new env var is required; override with ICAL_FEED_SECRET to rotate.
const SECRET = process.env.ICAL_FEED_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Deterministic, unguessable token for a venue's read-only calendar feed. */
export function feedToken(venueId: string): string {
  return createHmac("sha256", SECRET).update(venueId).digest("hex").slice(0, 32);
}

/** Constant-time verification of a feed token. */
export function verifyFeedToken(venueId: string, token: string): boolean {
  if (!SECRET || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(feedToken(venueId));
  return a.length === b.length && timingSafeEqual(a, b);
}
