import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { supabaseUrl } from "./env";

/**
 * Service-role admin client — bypasses RLS.
 * Only safe to use in server-side contexts (enforced by the "server-only" import).
 * Sessions are not persisted and tokens are not auto-refreshed.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    supabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
