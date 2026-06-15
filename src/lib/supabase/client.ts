import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { supabaseUrl, supabaseAnonKey } from "./env";

/**
 * Singleton browser client for use in Client Components.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
