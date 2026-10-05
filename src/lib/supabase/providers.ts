"use client";

import { clientEnv } from "@/lib/env/client";
import { isSupabaseBrowserConfigured } from "@/lib/supabase/client";

/**
 * Which sign-in providers the Supabase project actually has enabled.
 *
 * Offering a provider the project has not enabled sends the member to a raw
 * Supabase error page with no way back, so the entry surface asks first and
 * disables anything unavailable with an honest reason. `/auth/v1/settings` is
 * a public, non-secret endpoint that reports only which providers are on.
 */
export type AuthProviderAvailability = {
  /** Null until the answer is known — render the control as pending, not broken. */
  google: boolean | null;
  /**
   * Sign in with Apple. App Review guideline 4.8 requires it wherever a
   * third-party sign-in like Google is offered, so on iOS this being false
   * is a submission blocker, not a styling choice.
   */
  apple: boolean | null;
  email: boolean | null;
};

export const UNKNOWN_PROVIDER_AVAILABILITY: AuthProviderAvailability = {
  google: null,
  apple: null,
  email: null,
};

let cached: Promise<AuthProviderAvailability> | null = null;

export function fetchAuthProviderAvailability(): Promise<AuthProviderAvailability> {
  if (cached) return cached;

  if (!isSupabaseBrowserConfigured()) {
    cached = Promise.resolve({ google: false, apple: false, email: false });
    return cached;
  }

  const url = clientEnv.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  cached = fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`settings ${response.status}`);
      return response.json();
    })
    .then((settings: { external?: Record<string, boolean> }) => ({
      google: settings.external?.google === true,
      apple: settings.external?.apple === true,
      email: settings.external?.email === true,
    }))
    .catch(() => {
      // Unreachable settings must not disable a provider that may work — leave
      // it unknown so the control stays enabled and reports any real error.
      cached = null;
      return UNKNOWN_PROVIDER_AVAILABILITY;
    });

  return cached;
}
