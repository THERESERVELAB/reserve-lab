import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getIntegrationStatus, serverEnv } from "@/lib/env/server";
import type { Database } from "@/lib/database/types";

export function getSupabasePublicStatus() {
  return getIntegrationStatus(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
}

export function getSupabaseAdminStatus() {
  return getIntegrationStatus(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
}

export function createServerSupabaseClient() {
  const status = getSupabasePublicStatus();
  if (!status.configured || !serverEnv.NEXT_PUBLIC_SUPABASE_URL || !serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  return createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export function createSupabaseAdminClient() {
  const status = getSupabaseAdminStatus();
  if (!status.configured || !serverEnv.NEXT_PUBLIC_SUPABASE_URL || !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
