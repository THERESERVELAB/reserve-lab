/* ════════════════════════════════════════════════════════════════════════
   NATIVE SIGN-IN — why Google cannot use the web path inside the shell.

   Google refuses to render its sign-in page in an embedded webview and
   answers `disallowed_useragent`. So on the native shell the provider leg
   runs in the system browser (SFSafariViewController / Chrome Custom Tabs)
   and returns to the app through a custom scheme.

   PKCE makes the hand-back safe. `signInWithOAuth` writes the code verifier
   into the webview's storage before the system browser opens; the shell
   brings the `?code=` back to that same webview, so the exchange happens
   where the verifier already is. The session lands in the Reserve origin's
   storage — the same place the web flow puts it — and everything
   downstream (RLS queries, sync, onAuthStateChange) is unchanged.

   Email/password sign-in needs none of this: it never leaves the origin.

   ── What this needs outside the repo ───────────────────────────────────
   1. Supabase → Authentication → URL Configuration → Redirect URLs must
      allow `com.reservelab.app://auth/callback`. Without it Supabase
      rejects the redirect and the member is stranded in the browser sheet.
   2. The scheme is registered in the native projects by `npx cap sync`
      from `capacitor.config.ts`'s appId.

   ── iOS submission gate ────────────────────────────────────────────────
   App Review guideline 4.8: an app offering a third-party sign-in service
   must also offer an equivalent option that limits data collection to name
   and email. Google sign-in therefore requires Sign in with Apple on iOS
   before the first submission. See docs/mobile/APP_STORE_REQUIREMENTS.md.
   ════════════════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database/types";
import { closeExternal, isNativeShell, openExternal } from "@/lib/mobile/native-shell";

/** The shared browser client, as getBrowserSupabaseClient() returns it. */
type ReserveSupabaseClient = SupabaseClient<Database>;

/**
 * Where the provider returns to inside the shell. Must stay in sync with
 * `appId` in capacitor.config.ts — Capacitor registers the scheme from it.
 */
export const NATIVE_OAUTH_REDIRECT = "com.reservelab.app://auth/callback";

/** The path half of the redirect, used to recognize the deep link. */
const OAUTH_CALLBACK_PATH = "/auth/callback";

export type NativeAuthResult = { ok: true } | { ok: false; message: string };

/** The third-party providers Reserve offers. */
export type NativeOAuthProvider = "google" | "apple";

/**
 * Start a third-party sign-in from the native shell.
 *
 * Returns once the system browser is open — the session arrives later,
 * through `completeNativeOAuth` on the deep link. Callers should leave
 * their UI in a resolving state rather than treating this as success.
 *
 * Both providers take this path for the same reason: the provider page is
 * not ours to render. Google refuses an embedded webview outright, and
 * Apple's sign-in expects a real browser with its own cookie jar so a
 * member already signed in to their Apple ID is not asked again.
 */
export async function signInWithProviderNative(
  supabase: ReserveSupabaseClient,
  provider: NativeOAuthProvider,
): Promise<NativeAuthResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: NATIVE_OAUTH_REDIRECT,
      /* Hand back the URL instead of navigating the webview — the webview
         is exactly where the provider will not render. */
      skipBrowserRedirect: true,
    },
  });

  if (error) return { ok: false, message: error.message };
  if (!data?.url) {
    return { ok: false, message: "Sign-in could not be started. Please try again." };
  }

  await openExternal(data.url);
  return { ok: true };
}

/** Start Google sign-in from the native shell. */
export function signInWithGoogleNative(
  supabase: ReserveSupabaseClient,
): Promise<NativeAuthResult> {
  return signInWithProviderNative(supabase, "google");
}

/**
 * Start Sign in with Apple from the native shell.
 *
 * App Review guideline 4.8 requires this wherever Google sign-in is
 * offered, so on iOS it is not optional.
 */
export function signInWithAppleNative(
  supabase: ReserveSupabaseClient,
): Promise<NativeAuthResult> {
  return signInWithProviderNative(supabase, "apple");
}

/** True when a deep link is the OAuth return leg rather than a content link. */
export function isOAuthCallbackLink(url: URL): boolean {
  if (!url.protocol.startsWith("com.reservelab.app")) {
    /* A universal link into the hosted origin also lands on this path. */
    return url.pathname === OAUTH_CALLBACK_PATH;
  }
  /* Custom-scheme URLs parse as `com.reservelab.app://auth/callback`, where
     the host is "auth" and the path is "/callback". Accept either shape so
     a platform difference in parsing cannot strand a sign-in. */
  return url.host === "auth" || url.pathname.includes("callback");
}

/**
 * Finish the sign-in a deep link brought back.
 *
 * Closes the browser sheet first so the member is looking at Reserve while
 * the exchange runs, then trades the `?code=` for a session. Provider
 * errors arrive on this same URL as `?error=` and are surfaced, not
 * swallowed — a silent failure here looks like the app ignoring a tap.
 */
export async function completeNativeOAuth(
  supabase: ReserveSupabaseClient,
  url: URL,
): Promise<NativeAuthResult> {
  await closeExternal();

  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) return { ok: false, message: providerError };

  const code = url.searchParams.get("code");
  if (!code) {
    return { ok: false, message: "Sign-in returned without a code. Please try again." };
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { ok: false, message: error.message };

  return { ok: true };
}

/**
 * Whether this runtime should take the native sign-in path.
 * Kept here so call sites read as intent rather than a platform check.
 */
export function usesNativeOAuth(): boolean {
  return isNativeShell();
}
