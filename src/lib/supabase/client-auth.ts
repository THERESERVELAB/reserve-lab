"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

/** Build a request with the current verified Supabase access token. */
export async function authorizedRequestInit(init: RequestInit = {}): Promise<RequestInit> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) throw new Error("Reserve authentication is not configured.");

  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Sign in to continue.");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return { ...init, headers };
}

export async function authorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, await authorizedRequestInit(init));
}
