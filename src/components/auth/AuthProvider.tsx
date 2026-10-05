"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { resetMemberStateToDefaults, useAthleteDashboardStore } from "@/lib/athlete-store";
import { clearPrivateDeviceState } from "@/lib/auth/device-isolation";
import { resetCoachingForAccountBoundary } from "@/lib/coaching/store";
import {
  completeNativeOAuth,
  isOAuthCallbackLink,
  signInWithProviderNative,
  type NativeOAuthProvider,
  usesNativeOAuth,
} from "@/lib/mobile/native-auth";
import { addDeepLinkListener } from "@/lib/mobile/native-shell";
import { getBrowserSupabaseClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { authorizedFetch } from "@/lib/supabase/client-auth";
import { startMemberSync, stopMemberSync } from "@/lib/sync/sync-engine";
import { useSyncStatusStore } from "@/lib/sync/sync-status";

export type AuthStatus =
  /** Waiting for the initial getSession() to resolve. */
  | "resolving"
  /** Supabase env vars absent — cloud features off. */
  | "unconfigured"
  | "signed-out"
  | "signed-in"
  | "signing-out"
  /** Auth subsystem failed (network/config) — shown with retry. */
  | "error";

export type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  /** Present in every state so screens can show what went wrong. */
  errorMessage: string | null;
  noticeMessage: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  exportAccount: () => Promise<void>;
  deleteAccount: (confirmation: string) => Promise<void>;
  signOut: () => Promise<void>;
};

/** Where a Supabase recovery link returns the member to set a new password. */
export const PASSWORD_RESET_PATH = "/auth/reset";

const AuthContext = createContext<AuthContextValue>({
  status: "unconfigured",
  user: null,
  errorMessage: null,
  noticeMessage: null,
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  requestPasswordReset: async () => {},
  exportAccount: async () => {},
  deleteAccount: async () => {},
  signOut: async () => {},
});

function clearAccountState(): void {
  resetMemberStateToDefaults();
  resetCoachingForAccountBoundary();
  clearPrivateDeviceState();
}

async function bootstrapAuthenticatedSession(session: Session): Promise<void> {
  const displayName =
    (session.user.user_metadata?.full_name as string | undefined) ??
    (session.user.user_metadata?.name as string | undefined);
  const response = await fetch("/api/auth/bootstrap", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: session.user.id,
      email: session.user.email,
      displayName,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Your Reserve identity could not be restored.");
  }

  /* ADOPT THE SERVER'S TIER. This is the inbound half of billing and it was
     missing entirely: the bootstrap response was discarded, so a member who
     paid — with the Stripe webhook correctly writing `profiles.current_tier`
     — never received their entitlement in the app.

     `profiles.current_tier` is the only authority. It is written exclusively
     by the verified billing lifecycle (`upsertSubscriptionFromStripe`) and by
     admin assignment; `ensureUserProfile` explicitly refuses to touch it. The
     local store value is a cache of that, never a source of truth, which is
     why nothing in the UI may set it any more. */
  const body = (await response.json().catch(() => null)) as
    | { profile?: { current_tier?: string | null } | null }
    | null;

  const serverTier = body?.profile?.current_tier;
  if (serverTier === "core" || serverTier === "pro" || serverTier === "elite") {
    useAthleteDashboardStore.getState().setSubscriptionTier(serverTier);
  }
}

/** Authenticated member identity, available throughout the app. */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    isSupabaseBrowserConfigured() ? "resolving" : "unconfigured",
  );
  const [user, setUser] = useState<User | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const syncStartedFor = useRef<string | null>(null);
  const activeUserId = useRef<string | null>(null);
  const sessionGeneration = useRef(0);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      // status is already "unconfigured" from the useState initializer.
      useSyncStatusStore.getState().setStatus("local-only");
      return;
    }

    let cancelled = false;

    const applySession = async (session: Session | null) => {
      if (cancelled) return;
      const generation = ++sessionGeneration.current;
      if (session?.user) {
        if (
          activeUserId.current === session.user.id &&
          syncStartedFor.current === session.user.id
        ) {
          setUser(session.user);
          setStatus("signed-in");
          setErrorMessage(null);
          return;
        }
        const previousUserId = activeUserId.current;
        if (previousUserId && previousUserId !== session.user.id) {
          await stopMemberSync({ flush: false });
          clearAccountState();
          syncStartedFor.current = null;
        } else if (!previousUserId) {
          // Coaching relationships are not part of the approved local-to-cloud
          // migration. Never hydrate a device-local coach database as identity.
          resetCoachingForAccountBoundary();
        }

        setUser(session.user);
        setStatus("resolving");
        setErrorMessage(null);
        setNoticeMessage(null);

        try {
          await bootstrapAuthenticatedSession(session);
          if (cancelled || generation !== sessionGeneration.current) return;
          activeUserId.current = session.user.id;
          if (syncStartedFor.current !== session.user.id) {
            syncStartedFor.current = session.user.id;
            await startMemberSync(session.user.id);
          }
          if (cancelled || generation !== sessionGeneration.current) return;
          setStatus("signed-in");
        } catch (err) {
          if (cancelled || generation !== sessionGeneration.current) return;
          setStatus("error");
          setErrorMessage(
            err instanceof Error ? err.message : "Your Reserve identity could not be restored.",
          );
        }
      } else {
        if (syncStartedFor.current) {
          syncStartedFor.current = null;
          await stopMemberSync({ flush: false });
        }
        if (activeUserId.current) clearAccountState();
        activeUserId.current = null;
        if (cancelled || generation !== sessionGeneration.current) return;
        setUser(null);
        setStatus("signed-out");
      }
    };

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setStatus("error");
          setErrorMessage(error.message);
          return;
        }
        void applySession(data.session);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Could not reach the authentication service.");
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  /* Google and Apple differ only in the provider name. Keeping one body
     means a fix to the native hand-back, the error surface or the redirect
     cannot land on one provider and miss the other. */
  const signInWithProvider = useCallback(async (provider: NativeOAuthProvider) => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      setStatus("unconfigured");
      return;
    }
    setErrorMessage(null);
    setNoticeMessage(null);

    // Inside the native shell the provider page is not ours to render, so the
    // provider leg runs in the system browser and returns on a deep link,
    // handled by the effect below. See src/lib/mobile/native-auth.ts.
    if (usesNativeOAuth()) {
      const result = await signInWithProviderNative(supabase, provider);
      if (!result.ok) {
        setStatus("error");
        setErrorMessage(result.message);
      }
      // On success the session arrives later, via completeNativeOAuth.
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    }
    // On success the browser navigates away to the provider.
  }, []);

  const signInWithGoogle = useCallback(() => signInWithProvider("google"), [signInWithProvider]);

  /* App Review guideline 4.8: an app offering a third-party sign-in must
     also offer one that limits data collection to name and email. Reserve
     ships Google, so on iOS this is required, not optional. */
  const signInWithApple = useCallback(() => signInWithProvider("apple"), [signInWithProvider]);

  /* ── Native OAuth return ───────────────────────────────────────────────
     The deep link carries the PKCE `?code=` back to this webview, which is
     where signInWithOAuth left the verifier. Exchanging it here lands the
     session in the same storage the web flow uses, so onAuthStateChange
     above picks it up and nothing downstream needs to know. */
  useEffect(() => {
    if (!usesNativeOAuth()) return;

    let disposed = false;
    let teardown: (() => void) | null = null;

    void addDeepLinkListener(async (url) => {
      if (!isOAuthCallbackLink(url)) return;

      const supabase = getBrowserSupabaseClient();
      if (!supabase) {
        setStatus("unconfigured");
        return;
      }

      setStatus("resolving");
      const result = await completeNativeOAuth(supabase, url);
      if (!result.ok) {
        setStatus("error");
        setErrorMessage(result.message);
      }
    }).then((off) => {
      if (disposed) {
        off();
        return;
      }
      teardown = off;
    });

    return () => {
      disposed = true;
      teardown?.();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      setStatus("unconfigured");
      return;
    }
    setErrorMessage(null);
    setNoticeMessage(null);
    setStatus("resolving");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      setStatus("unconfigured");
      return;
    }
    setErrorMessage(null);
    setNoticeMessage(null);
    setStatus("resolving");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    if (!data.session) {
      setStatus("signed-out");
      setNoticeMessage("Check your email to confirm your Reserve Lab account.");
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      setStatus("unconfigured");
      return;
    }
    setErrorMessage(null);
    setNoticeMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${PASSWORD_RESET_PATH}`,
    });
    // Never disclose whether an address has a Reserve account. The same
    // message is shown either way; only a transport failure surfaces.
    if (error && error.status !== 400 && error.status !== 422) {
      setErrorMessage(error.message);
      return;
    }
    setNoticeMessage(
      "If that address has a Reserve account, a recovery email is on its way.",
    );
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;

    setStatus("signing-out");
    try {
      // Give the final cloud write a bounded chance to land, then detach.
      await stopMemberSync({ flush: true });
    } finally {
      syncStartedFor.current = null;
    }

    // Leave no recoverable member or coaching data for the next account.
    clearAccountState();

    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    activeUserId.current = null;
    setUser(null);
    setStatus("signed-out");
  }, []);

  const exportAccount = useCallback(async () => {
    setErrorMessage(null);
    const response = await authorizedFetch("/api/account/export", { cache: "no-store" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Account export could not be completed.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "reserve-lab-export.json";
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const deleteAccount = useCallback(async (confirmation: string) => {
    setErrorMessage(null);
    const response = await authorizedFetch("/api/account/delete", {
      method: "DELETE",
      body: JSON.stringify({ confirmation }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Account deletion could not be completed.");
    }

    await stopMemberSync({ flush: false });
    syncStartedFor.current = null;
    activeUserId.current = null;
    clearAccountState();
    const supabase = getBrowserSupabaseClient();
    await supabase?.auth.signOut().catch(() => undefined);
    setUser(null);
    setStatus("signed-out");
  }, []);

  // Keep the store's greeting honest for brand-new Google accounts: if the
  // member has no local name yet, prefill from the Google identity.
  useEffect(() => {
    if (status !== "signed-in" || !user) return;
    const state = useAthleteDashboardStore.getState();
    const googleName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined);
    if (!state.profile.name.trim() && googleName) {
      state.updateProfile({ name: googleName.split(" ")[0] ?? googleName });
    }
  }, [status, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      errorMessage,
      noticeMessage,
      signInWithGoogle,
      signInWithApple,
      signInWithEmail,
      signUpWithEmail,
      requestPasswordReset,
      exportAccount,
      deleteAccount,
      signOut,
    }),
    [
      status,
      user,
      errorMessage,
      noticeMessage,
      signInWithGoogle,
      signInWithApple,
      signInWithEmail,
      signUpWithEmail,
      requestPasswordReset,
      exportAccount,
      deleteAccount,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
