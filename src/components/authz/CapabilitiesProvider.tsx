"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { MEMBER_ACCESS, can, parseAccessResponse, type AccessContext, type Capability } from "@/lib/authz/capabilities";
import { SAFETY_TOOLS_ENABLED } from "@/lib/launch/safety-tools";
import { authorizedFetch } from "@/lib/supabase/client-auth";

/* ════════════════════════════════════════════════════════════════════════
   CAPABILITIES PROVIDER — this account's access, from the server.

   Loaded after sign-in, on account switch and sign-out (and once in local
   mode). Held in React memory only: never the persisted store, never cloud
   sync, never localStorage. Loading, errors and a previous account's answer
   all read as member access.
   ════════════════════════════════════════════════════════════════════════ */

const AccessReactContext = createContext<AccessContext>(MEMBER_ACCESS);

const CAPABILITIES_PATH = "/api/account/capabilities";

export function CapabilitiesProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const accountKey = status === "signed-in" && user ? `user:${user.id}` : status === "unconfigured" ? "local" : null;
  const [loaded, setLoaded] = useState<{ key: string; access: AccessContext } | null>(null);

  useEffect(() => {
    if (!accountKey) return;
    let cancelled = false;
    (async () => {
      try {
        const response =
          accountKey === "local"
            ? await fetch(CAPABILITIES_PATH, { cache: "no-store" })
            : await authorizedFetch(CAPABILITIES_PATH, { cache: "no-store" });
        const access = parseAccessResponse(response.ok ? await response.json() : null);
        if (!cancelled) setLoaded({ key: accountKey, access });
      } catch {
        if (!cancelled) setLoaded({ key: accountKey, access: MEMBER_ACCESS });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountKey]);

  // An answer only counts for the account it was loaded for.
  const access = accountKey && loaded?.key === accountKey ? loaded.access : MEMBER_ACCESS;
  return <AccessReactContext.Provider value={access}>{children}</AccessReactContext.Provider>;
}

export function useAccess(): AccessContext {
  return useContext(AccessReactContext);
}

export function useCan(capability: Capability): boolean {
  return can(useAccess(), capability);
}

/** Review-pending safety tools: shown to everyone when the launch switch is on, otherwise only with the capability. */
export function useSafetyToolsVisible(): boolean {
  const ownerAccess = useCan("review-pending-safety-tools");
  return SAFETY_TOOLS_ENABLED || ownerAccess;
}
