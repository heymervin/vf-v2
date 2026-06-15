import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { supabaseUrl, supabaseAnonKey } from "./env";

/**
 * Cookie-based Supabase server client.
 * Must be called inside a Server Component, Server Action, or Route Handler.
 * cookies() is async in Next.js 15+.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // cookies().set() throws during Server Component rendering.
            // Safe to ignore: proxy.ts (middleware) refreshes sessions.
          }
        },
      },
    },
  );
}
