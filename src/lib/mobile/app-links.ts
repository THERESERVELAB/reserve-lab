/* ════════════════════════════════════════════════════════════════════════
   UNIVERSAL LINKS / APP LINKS — the association files, and the rule that a
   wrong one is worse than a missing one.

   A verified deep link lets https://www.thereservelab.com/... open the
   Reserve app directly instead of the browser. Both platforms verify it by
   fetching a file from the domain:

     iOS      /.well-known/apple-app-site-association   (JSON, no extension)
     Android  /.well-known/assetlinks.json

   ── Why these are routes and not files in public/ ───────────────────────
   The Apple file has NO extension, and Apple requires it served as
   application/json. A static file with no extension is served as
   application/octet-stream by most hosts, and iOS rejects it silently — the
   link simply opens Safari and nobody can tell why. A route handler sets the
   content type explicitly.

   ── Why an unconfigured build serves 404 rather than a placeholder ──────
   Apple fetches this through a CDN and CACHES it. A file containing a
   placeholder team id is not a harmless no-op: it is a wrong answer that
   sticks around after the real one is published, and re-verification is not
   something the app can trigger. Serving nothing is recoverable. Serving
   nonsense is not, for as long as the cache holds it.

   Android is less punishing but the same logic applies: a fingerprint that
   does not match the signing key marks the domain as failing verification.

   So: no ids, no file. `npm run mobile:doctor` fails a store build on it
   rather than letting it ship half-wired.
   ════════════════════════════════════════════════════════════════════════ */

/** The app id Reserve ships under, on both stores. */
export const APP_BUNDLE_ID = "com.reservelab.app";

/**
 * The Apple Developer Team ID that prefixes the app id in the association
 * file. Ten alphanumeric characters, from the Apple Developer account —
 * Membership details. It is not a secret, but it is not guessable either.
 */
export function iosTeamId(): string | null {
  const raw = process.env.RESERVE_IOS_TEAM_ID?.trim();
  return raw && /^[A-Z0-9]{10}$/.test(raw) ? raw : null;
}

/**
 * SHA-256 fingerprint of the certificate the Android build is signed with —
 * upper-case hex, colon-separated. Get it from the key that actually signs
 * the store build (Play App Signing shows it under Setup → App signing), not
 * from a local debug keystore, or verification fails on the released app
 * while passing locally.
 */
export function androidCertFingerprints(): string[] {
  const raw = process.env.RESERVE_ANDROID_CERT_SHA256?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
}

export type AppleAppSiteAssociation = {
  applinks: {
    details: Array<{ appIDs: string[]; components: Array<Record<string, unknown>> }>;
  };
  webcredentials: { apps: string[] };
};

/**
 * The iOS association document, or null when the team id is unset.
 *
 * `components` opens every path EXCEPT the ones that must stay in a browser:
 * the OAuth callback has to complete in the system browser that started it,
 * and forcing it into the app mid-flight breaks the handoff. The legal pages
 * stay on the web so a store reviewer can open the privacy URL without being
 * bounced into an app they have not installed.
 *
 * `webcredentials` lets a password manager offer the saved Reserve login
 * inside the app. It costs nothing to include and is a real convenience.
 */
export function appleAppSiteAssociation(): AppleAppSiteAssociation | null {
  const team = iosTeamId();
  if (!team) return null;
  const appID = `${team}.${APP_BUNDLE_ID}`;
  return {
    applinks: {
      details: [
        {
          appIDs: [appID],
          components: [
            { "/": "/auth/*", exclude: true, comment: "Sign-in must finish in the browser that began it." },
            { "/": "/api/*", exclude: true, comment: "Server endpoints are not screens." },
            { "/": "/privacy", exclude: true, comment: "A reviewer must be able to read this without the app." },
            { "/": "/open-source", exclude: true, comment: "Same: a public legal page stays public." },
            { "/": "/*", comment: "Everything else opens in the Reserve app." },
          ],
        },
      ],
    },
    webcredentials: { apps: [appID] },
  };
}

export type AssetLinksStatement = {
  relation: string[];
  target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
};

/** The Android association document, or null when no fingerprint is set. */
export function androidAssetLinks(): AssetLinksStatement[] | null {
  const fingerprints = androidCertFingerprints();
  if (fingerprints.length === 0) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
      target: {
        namespace: "android_app",
        package_name: APP_BUNDLE_ID,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
