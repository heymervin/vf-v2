import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase/env";

// Protected routes: unauthenticated users are redirected to /login
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/contacts",
  "/pipeline",
  "/appointments",
  "/reports",
  "/settings",
];

// Auth routes: authenticated users are redirected away to /dashboard
const AUTH_PATHS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Build a mutable response so we can thread Set-Cookie headers from Supabase
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Create the Supabase server client wired to the request/response cookie pair.
  // This pattern (createServerClient in proxy) is the canonical @supabase/ssr approach
  // for session refresh on every request.
  const supabase = createServerClient(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Thread cookies onto both the request (for downstream reads) and the response.
          // We harden the options here: add secure + sameSite on every cookie the
          // Supabase SDK sets. httpOnly is intentionally NOT set — the Supabase client-
          // side SDK must be able to read the auth cookies from JavaScript.
          const isProduction = process.env.NODE_ENV === "production";
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, {
              ...options,
              secure: isProduction,
              sameSite: "lax",
            });
          }
        },
      },
    },
  );

  // getUser() — NOT getSession() — revalidates the token with Supabase Auth server.
  // This is required by the @supabase/ssr pattern to prevent stale session exploitation.
  let isAuthenticated = false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthenticated = !!user;
  } catch {
    // No reachable Supabase backend (e.g. placeholder env on a prototype
    // deploy) — treat as logged out so public routes (/, /preview, /portal)
    // still render instead of 500-ing.
    isAuthenticated = false;
  }

  // Helper: build a redirect that carries any Set-Cookie headers token rotation wrote
  // onto `response`. Without this, token-refreshed cookies are dropped on redirects.
  function redirectWithCookies(url: URL): NextResponse {
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  // Gate: unauthenticated user hitting a protected prefix → redirect to /login
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (isProtected && !isAuthenticated) {
    return redirectWithCookies(new URL("/login", request.url));
  }

  // Couple Portal: the /portal data pages require auth, but /portal/login and
  // /portal/auth/* (magic-link callback) must stay public. The couple-account
  // resolution (and the couple-specific redirect target) is enforced by the
  // guarded portal layout; here we only fast-redirect anonymous hits on the
  // data pages so no portal render begins before a session exists (spec §9).
  const isPortalPublic =
    pathname === "/portal/login" || pathname.startsWith("/portal/auth/");
  const isPortalData = pathname.startsWith("/portal") && !isPortalPublic;
  if (isPortalData && !isAuthenticated) {
    return redirectWithCookies(new URL("/portal/login", request.url));
  }

  // Gate: authenticated user hitting /login or /signup → redirect to /dashboard
  const isAuthPage = AUTH_PATHS.includes(pathname);
  if (isAuthPage && isAuthenticated) {
    return redirectWithCookies(new URL("/dashboard", request.url));
  }

  // Venue resolution is intentionally NOT done here — handled in getTenantContext()
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (Next.js static assets)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - public assets (files with extensions in /public)
     * - /api/cron     (Vercel Cron entrypoints — own CRON_SECRET auth)
     * - /api/webhooks (external webhook receivers)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$|api/cron|api/webhooks).*)",
  ],
};
