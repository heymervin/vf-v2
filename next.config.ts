import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Supabase project URL — used for connect-src and img-src. */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * Build the base Content-Security-Policy string.
 * frame-ancestors is intentionally NOT included here — it is set per-route
 * (DENY for app routes, * for the embed route).
 */
function buildCsp(frameAncestors: string): string {
  const directives: string[] = [
    "default-src 'self'",
    // Scripts: self + Stripe.js
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    // Styles: self + inline (required for Tailwind runtime)
    "style-src 'self' 'unsafe-inline'",
    // Images: self + data URIs + Supabase storage
    `img-src 'self' data: ${supabaseUrl} https://*.supabase.co`,
    // Fonts: self only
    "font-src 'self'",
    // Fetch/XHR: self + Supabase API + Stripe API
    `connect-src 'self' ${supabaseUrl} https://*.supabase.co https://api.stripe.com`,
    // Frames: allow Stripe checkout iframe
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    // Objects: none
    "object-src 'none'",
    // Base URI: self only (prevent base-tag injection)
    "base-uri 'self'",
    // Form action: self + Stripe
    "form-action 'self' https://checkout.stripe.com",
    // frame-ancestors is route-specific — set via the per-entry below
    `frame-ancestors ${frameAncestors}`,
  ];
  return directives.join("; ");
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      // -----------------------------------------------------------------------
      // Global security headers — applied to every route.
      // X-Frame-Options + frame-ancestors 'none' for all app routes by default.
      // -----------------------------------------------------------------------
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildCsp("'none'"),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
        ],
      },
      // -----------------------------------------------------------------------
      // Embed route override — the lead-form embed must remain iframeable.
      // Override CSP frame-ancestors to * and remove X-Frame-Options.
      // -----------------------------------------------------------------------
      {
        source: "/f/:venueSlug/embed",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildCsp("*"),
          },
          // Setting X-Frame-Options to ALLOWALL (or omitting it in favour of
          // frame-ancestors * in CSP). Next.js headers cannot remove a header
          // set by a preceding rule, so we override with a permissive value.
          // Modern browsers honour CSP frame-ancestors over X-Frame-Options.
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
