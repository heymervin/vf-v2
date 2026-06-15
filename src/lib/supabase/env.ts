/**
 * Build/runtime-safe Supabase env.
 *
 * Real environment variables ALWAYS take precedence. Placeholders are returned
 * only when the env is unset, so the no-backend `/preview` prototype can build
 * and deploy (e.g. on Vercel) with zero configuration. The moment real
 * NEXT_PUBLIC_SUPABASE_* values are set, auth and the real app (M0–M7) work
 * again with no code change.
 *
 * Without real env: the client instantiates against a placeholder host, every
 * auth check resolves to "logged out", and the real app simply shows /login —
 * while /preview, /, and /portal work fully on mock data.
 */

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_ANON_KEY = "placeholder-anon-key";

let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    "[venueflow] Supabase env is not set — using placeholder credentials. " +
      "Auth/real app are disabled; the /preview prototype runs on mock data. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable.",
  );
}

/** True when real Supabase env is configured. */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (v) return v;
  warnOnce();
  return PLACEHOLDER_URL;
}

export function supabaseAnonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (v) return v;
  warnOnce();
  return PLACEHOLDER_ANON_KEY;
}
