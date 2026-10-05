"use client";

/**
 * OAuth landing pad. Google redirects here with a PKCE `?code=`; the shared
 * browser client (detectSessionInUrl) exchanges it for a session. This page
 * just holds the restoration screen until the session materializes, then
 * returns the member to the command center. Provider errors land here too
 * (`?error=` / `?error_description=`).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { ReserveRestoring, ReserveThreshold } from "@/components/auth/ReserveEntry";
import { ReserveButton } from "@/components/ui/reserve/ReserveButton";
import { ReserveNotice } from "@/components/ui/reserve/ReserveSurfaces";

const WAIT_FOR_SESSION_MS = 12_000;

export default function AuthCallbackPage() {
  const router = useRouter();
  // Provider errors (`?error=`) are read synchronously at mount; the page is
  // client-only so the prerender pass just sees null.
  const [failure, setFailure] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const providerError = params.get("error_description") ?? params.get("error");
    if (providerError) return providerError;
    if (!getBrowserSupabaseClient()) {
      return "Cloud sign-in is not configured for this deployment.";
    }
    return null;
  });

  useEffect(() => {
    if (failure) return;

    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      router.replace("/");
    };

    // detectSessionInUrl performs the code exchange on client init; we just
    // wait for the session to land (or already be present on a revisit).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });

    const timeout = setTimeout(() => {
      if (!done) {
        setFailure("Sign-in timed out before a session arrived. Please try again.");
      }
    }, WAIT_FOR_SESSION_MS);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router, failure]);

  if (failure) {
    return (
      <ReserveThreshold>
        <div className="flex flex-col gap-4">
          <ReserveNotice tone="error" title="Sign-in didn’t complete">
            <p className="text-white/80">Go back to sign-in and choose your sign-in option again.</p>
            <p className="mt-1 text-white/55">{failure}</p>
          </ReserveNotice>
          <ReserveButton tier="primary" size="lg" fullWidth onClick={() => router.replace("/")}>
            Back to sign-in
          </ReserveButton>
        </div>
      </ReserveThreshold>
    );
  }

  return <ReserveRestoring label="Securing your session" />;
}
