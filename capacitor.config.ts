/* ════════════════════════════════════════════════════════════════════════
   CAPACITOR — the native iOS/Android host for Reserve Lab.

   Reserve is a Next.js app with 40 server routes, Supabase auth and
   OCR that must run from Reserve's own origin (CLAUDE.md: lab files are
   read on-device and never uploaded). None of that survives a static
   export, so the native app does NOT bundle the web build. It hosts the
   deployed origin in a native shell and adds the capabilities a browser
   cannot reach: Apple Health / Health Connect, push, biometric lock.

   That split is deliberate. The webview renders Reserve's own HTTPS
   origin, so cookies, Supabase sessions and the on-device OCR pipeline
   behave exactly as they do on the web — no second implementation to
   keep compliant.

   ── The origin is never hardcoded ──────────────────────────────────────
   RESERVE_MOBILE_ORIGIN must be set when syncing or building a native
   app. There is no default: a wrong origin baked into a signed binary
   ships members at the wrong server, and store binaries cannot be
   silently corrected.

     Production build   RESERVE_MOBILE_ORIGIN=https://www.thereservelab.com
     Device against dev RESERVE_MOBILE_ORIGIN=http://192.168.x.x:3000
                        RESERVE_MOBILE_ALLOW_CLEARTEXT=true

   webDir holds only the offline fallback page (mobile/www). It is what
   the shell shows when the origin cannot be reached; it is not the app.
   ════════════════════════════════════════════════════════════════════════ */

import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Bundle identifier. Permanent once the first build is uploaded to either
 * store — App Store Connect and Google Play both refuse to change it, and
 * it cannot be reused after deletion. Confirm before the first upload.
 */
const APP_ID = "com.reservelab.app";

const origin = process.env.RESERVE_MOBILE_ORIGIN?.trim();
const allowCleartext = process.env.RESERVE_MOBILE_ALLOW_CLEARTEXT === "true";

/* `cap sync` / `cap build` without an origin would produce a shell pointed
   at nothing. Fail loudly here rather than at first launch on a device. */
if (!origin) {
  throw new Error(
    "RESERVE_MOBILE_ORIGIN is not set. Set it to the origin this build should host, " +
      "e.g. RESERVE_MOBILE_ORIGIN=https://www.thereservelab.com npx cap sync",
  );
}

if (!allowCleartext && !origin.startsWith("https://")) {
  throw new Error(
    `RESERVE_MOBILE_ORIGIN must be https for a store build (got ${origin}). ` +
      "For a device pointed at a local dev server, set RESERVE_MOBILE_ALLOW_CLEARTEXT=true.",
  );
}

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: "Reserve Lab",
  webDir: "mobile/www",

  server: {
    url: origin,
    /* Reserve's origin is the only one the shell will load as the app.
       Anything else (a vendor OAuth page, an outbound link) opens in the
       system browser instead — see src/lib/mobile/native-shell.ts. */
    allowNavigation: [],
    androidScheme: "https",
    iosScheme: "https",
    cleartext: allowCleartext,
    /* Shown when the origin is unreachable, instead of a webview error. */
    errorPath: "offline.html",
  },

  ios: {
    /* The surface already flows under the Dynamic Island and home
       indicator (src/app/layout.tsx viewportFit: "cover"), so the webview
       must not inset it a second time. */
    contentInset: "never",
    backgroundColor: "#07080c",
    /* Reserve is dark-only; stop iOS from flashing a white scroll gutter. */
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
  },

  android: {
    backgroundColor: "#07080c",
    /* Store builds ship release-signed and must never allow a mixed or
       cleartext load; the dev override above is the only exception. */
    allowMixedContent: allowCleartext,
    captureInput: true,
    webContentsDebuggingEnabled: allowCleartext,
  },

  plugins: {
    SplashScreen: {
      /* Held until the webview reports the app has painted, so members
         never see a blank frame while the origin loads. Released by
         hideNativeSplash() in src/lib/mobile/native-shell.ts. */
      launchAutoHide: false,
      backgroundColor: "#07080cff",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#07080c",
      overlaysWebView: true,
    },
    Keyboard: {
      /* The layout owns its own safe-area math; resizing the native view
         would double-apply it against the bottom shell. */
      resize: "none",
      style: "DARK",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
