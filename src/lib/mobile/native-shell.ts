/* ════════════════════════════════════════════════════════════════════════
   NATIVE SHELL — what changes when Reserve runs inside the iOS/Android app.

   The same web app serves the browser and the native shell. This module is
   the only place that knows the difference, and every export is safe to
   call on the web, on the server, and during prerender: off the native
   shell they are inert.

   Capacitor packages are imported dynamically on purpose. A static import
   would pull the plugin registry into the web bundle for every member who
   will never run the app, and several plugins touch `window` at import
   time, which breaks the prerender pass.
   ════════════════════════════════════════════════════════════════════════ */

export type NativePlatform = "ios" | "android" | "web";

/** Set once by the shell so synchronous callers (render paths) can branch. */
let resolvedPlatform: NativePlatform | null = null;

/**
 * True only inside the Capacitor host application. Safe during SSR and
 * prerender, where it is always false.
 *
 * This is a capability check, not a screen-size check. A phone browser is
 * not the native shell and must not be treated as one.
 */
export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

/** "ios" | "android" inside the shell, "web" everywhere else. */
export function nativePlatform(): NativePlatform {
  if (resolvedPlatform) return resolvedPlatform;
  if (typeof window === "undefined") return "web";
  const cap = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const platform = cap?.getPlatform?.();
  resolvedPlatform = platform === "ios" || platform === "android" ? platform : "web";
  return resolvedPlatform;
}

/**
 * Open a URL outside the app surface.
 *
 * Anything that is not Reserve's own origin must leave the webview: vendor
 * OAuth pages refuse to render inside an embedded webview, and store review
 * treats an external site rendered as app content as the app's own.
 *
 * On the web this is a normal new tab.
 */
export async function openExternal(url: string): Promise<void> {
  if (!isNativeShell()) {
    /* This module promises every export is safe on the server and during
       prerender, and `window.open` is not — isNativeShell() is false there
       too, so without this guard a server-side call throws instead of
       doing nothing. */
    if (typeof window === "undefined") return;
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover" });
}

/** Close the in-app browser sheet, if one is open. No-op on the web. */
export async function closeExternal(): Promise<void> {
  if (!isNativeShell()) return;
  const { Browser } = await import("@capacitor/browser");
  await Browser.close().catch(() => {
    /* Already closed by the member — not an error. */
  });
}

/**
 * Release the native splash screen.
 *
 * capacitor.config.ts sets `launchAutoHide: false`, so the splash is held
 * until this is called. That is what stops a blank white frame between the
 * launch image and the origin's first paint — the cost is that forgetting
 * to call it leaves the app stuck on the splash, so it runs from the shell
 * provider's mount and again on a hard failure path.
 */
export async function releaseSplash(): Promise<void> {
  if (!isNativeShell()) return;
  const { SplashScreen } = await import("@capacitor/splash-screen");
  await SplashScreen.hide().catch(() => {
    /* Already hidden. */
  });
}

/**
 * Listen for deep links: the OAuth return leg on the custom scheme, and any
 * universal / app link into the hosted origin.
 *
 * Deliberately separate from `installNativeShell` so the module that owns
 * the Supabase client can subscribe without also owning the app chrome.
 * Returns a teardown function; a no-op off the native shell.
 */
export async function addDeepLinkListener(
  handler: (url: URL) => void | Promise<void>,
): Promise<() => void> {
  if (!isNativeShell()) return () => {};

  const { App } = await import("@capacitor/app");

  const listener = await App.addListener("appUrlOpen", (event) => {
    let url: URL;
    try {
      url = new URL(event.url);
    } catch {
      /* A malformed link is not worth taking the app down for. */
      return;
    }
    void Promise.resolve(handler(url)).catch(() => {});
  });

  return () => void listener.remove();
}

/** Handlers the app chrome needs from the React tree. */
export type NativeShellHandlers = {
  /** Android hardware back with nothing left to pop. Return true to keep the app open. */
  onRootBack?: () => boolean;
};

/**
 * Wire the app chrome — status bar, hardware back — to the running app.
 * Returns a teardown function.
 *
 * Off the native shell this resolves to a no-op teardown immediately, so
 * callers never need to branch. Deep links are handled separately by
 * `addDeepLinkListener`.
 */
export async function installNativeShell(handlers: NativeShellHandlers = {}): Promise<() => void> {
  if (!isNativeShell()) return () => {};

  const teardown: Array<() => void> = [];

  const [{ App }, { StatusBar, Style }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/status-bar"),
  ]);

  /* Reserve is dark-only and draws under the status bar; `Style.Dark` means
     light glyphs on a dark surface. */
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  if (nativePlatform() === "android") {
    await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  }

  /* ── Android hardware back ───────────────────────────────────────────
     Without this the system back button closes the app from any screen,
     which reads as a crash. Pop history while there is history; at the
     root, hand the decision to the app before exiting. */
  if (nativePlatform() === "android") {
    const back = await App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }
      if (handlers.onRootBack?.() === true) return;
      void App.exitApp();
    });
    teardown.push(() => void back.remove());
  }

  return () => {
    for (const off of teardown) off();
  };
}
