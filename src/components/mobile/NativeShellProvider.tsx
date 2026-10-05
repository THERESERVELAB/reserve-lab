"use client";

/**
 * Installs the native app chrome when Reserve is running inside the iOS or
 * Android shell, and renders nothing anywhere.
 *
 * Mounted once from the root layout. On the web every call inside is inert,
 * so this costs a mounted effect and no bundle weight — the Capacitor
 * packages are dynamically imported and never fetched in a browser.
 *
 * Deep links are NOT handled here. The OAuth return leg needs the Supabase
 * client, so AuthProvider owns that listener (src/lib/mobile/native-auth.ts).
 */

import { useEffect } from "react";

import { installNativeShell, isNativeShell, nativePlatform, releaseSplash } from "@/lib/mobile/native-shell";

export function NativeShellProvider() {
  useEffect(() => {
    if (!isNativeShell()) return;

    /* Lets CSS target the shell — e.g. suppressing web-only affordances —
       without every component reaching for a platform check. */
    document.documentElement.dataset.nativeShell = nativePlatform();

    let disposed = false;
    let teardown: (() => void) | null = null;

    void installNativeShell({
      /* Returning false lets the shell exit the app from the root screen,
         which is the platform-expected Android behaviour. */
      onRootBack: () => false,
    }).then((off) => {
      if (disposed) {
        off();
        return;
      }
      teardown = off;
    });

    /* capacitor.config.ts holds the splash (launchAutoHide: false) so the
       member never sees a blank frame while the origin paints. This mount
       is the signal that React is live, so it is safe to release. */
    void releaseSplash();

    return () => {
      disposed = true;
      teardown?.();
      delete document.documentElement.dataset.nativeShell;
    };
  }, []);

  return null;
}
