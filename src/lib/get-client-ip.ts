import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

/**
 * Read the trusted client IP from x-real-ip only.
 *
 * x-real-ip is set by the edge/proxy (Vercel sets it on every request) and
 * cannot be spoofed by the client — unlike x-forwarded-for, which the client
 * can prepend to. We deliberately do NOT fall back to x-forwarded-for: that
 * would reopen the rate-limit bypass the M7 audit flagged.
 *
 * Returns the IP, or null when no trusted IP is available. Callers decide the
 * fallback policy via `rateLimitKey()` below.
 */
export function getClientIp(h: ReadonlyHeaders): string | null {
  const ip = h.get("x-real-ip")?.trim();
  return ip && ip.length > 0 ? ip : null;
}

/**
 * Rate-limit bucket key for a public request.
 *
 * - Trusted IP present → bucket per IP (the normal case; always true on Vercel).
 * - No trusted IP in production → fail CLOSED to a shared anonymous bucket so
 *   the limit still applies (can't be bypassed by stripping headers). Deploy
 *   targets must set x-real-ip (it's on the deployment checklist) so this
 *   shared bucket is effectively never hit in a correctly-configured prod.
 * - No trusted IP in development → return null so the caller skips the limit,
 *   keeping local dev and CI usable without a proxy.
 */
export function rateLimitKey(h: ReadonlyHeaders): string | null {
  const ip = getClientIp(h);
  if (ip) return ip;
  return process.env.NODE_ENV === "production" ? "__no_trusted_ip__" : null;
}
