import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientEnv } from "@/lib/env/client";
import type { Database } from "@/lib/database/types";

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(clientEnv.NEXT_PUBLIC_SUPABASE_URL && clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createBrowserSupabaseClient() {
  if (!isSupabaseBrowserConfigured()) {
    return null;
  }

  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL!,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    },
  );
}

let browserClient: SupabaseClient<Database> | null | undefined;

/**
 * Shared browser client. Auth and sync must use the SAME instance so the
 * OAuth code exchange, session persistence, and RLS-scoped queries agree.
 * Returns null when Supabase is not configured (local mode).
 */
export function getBrowserSupabaseClient(): SupabaseClient<Database> | null {
  if (typeof window === "undefined") return null;
  if (browserClient === undefined) {
    browserClient = createBrowserSupabaseClient();
  }
  return browserClient;
}
