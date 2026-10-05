#!/usr/bin/env node
/**
 * Mobile release preflight.
 *
 * A web mistake is corrected with a redeploy. A mistake inside a signed
 * binary is corrected with a store review — days on iOS, and every member
 * who already installed it keeps the broken build until they update. So the
 * things that cannot be fixed after upload are checked here, before it.
 *
 * What it verifies:
 *   1. RESERVE_MOBILE_ORIGIN is set, https, and has no trailing slash.
 *   2. The origin baked into the native projects matches it — i.e. someone
 *      actually ran `cap sync` after changing it.
 *   3. The bundle id agrees across capacitor.config.ts, Android and iOS.
 *   4. The OAuth scheme is registered on both platforms. Missing it strands
 *      every Google sign-in in the browser sheet, and the app looks fine
 *      until a member tries to sign in.
 *   5. App icon and splash sources exist.
 *   6. Safety tools are not enabled in a store build (CLAUDE.md: they stay
 *      closed until clinician and counsel sign-off).
 *
 * Exit codes:
 *   0  ready to build
 *   1  at least one blocking problem
 *
 * Usage:
 *   node scripts/check-mobile-release.mjs          # store-build rules
 *   MOBILE_CHANNEL=dev node scripts/check-mobile-release.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** "store" applies the rules an uploaded binary must satisfy. */
const channel = process.env.MOBILE_CHANNEL === "dev" ? "dev" : "store";

const errors = [];
const warnings = [];
const lines = [];

const read = (relative) => {
  const path = join(root, relative);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
};

lines.push(`Reserve Lab — mobile release preflight (channel: ${channel})`);
lines.push("");

/* ── 1. The origin ──────────────────────────────────────────────────── */

const origin = process.env.RESERVE_MOBILE_ORIGIN?.trim();

if (!origin) {
  errors.push("RESERVE_MOBILE_ORIGIN is not set — the shell would host nothing.");
} else {
  if (origin.endsWith("/")) {
    errors.push(`RESERVE_MOBILE_ORIGIN has a trailing slash (${origin}); Capacitor compares it verbatim.`);
  }
  if (channel === "store" && !origin.startsWith("https://")) {
    errors.push(`RESERVE_MOBILE_ORIGIN must be https for a store build (got ${origin}).`);
  }
  if (channel === "store" && /localhost|127\.0\.0\.1|192\.168\.|10\./.test(origin)) {
    errors.push(`RESERVE_MOBILE_ORIGIN points at a local address (${origin}) — members could never reach it.`);
  }
}
lines.push(`  origin                    ${origin ?? "(unset)"}`);

/* Comparing the env var against the baked value catches a forgotten sync,
   but NOT an origin that is simply wrong — both sides agree and both are
   wrong. That nearly shipped once, from a domain copied out of a stale
   deployment doc. So a store build also asks whether the origin answers. */
if (origin && channel === "store" && process.env.MOBILE_SKIP_REACHABILITY !== "true") {
  try {
    const response = await fetch(origin, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    /* Drain the body: an unread response keeps an undici socket alive, and
       on Windows a live handle at exit trips a libuv assertion. */
    await response.arrayBuffer().catch(() => {});
    lines.push(`  origin responds           ${response.status}`);
    if (!response.ok) {
      errors.push(`RESERVE_MOBILE_ORIGIN answered ${response.status}. A store binary cannot be pointed at a broken origin.`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    errors.push(
      `RESERVE_MOBILE_ORIGIN (${origin}) could not be reached: ${reason}. ` +
        "Confirm the domain before building — it cannot be corrected after upload. " +
        "Set MOBILE_SKIP_REACHABILITY=true only if this machine has no network.",
    );
  }
}

/* ── 2/3. What the native projects actually carry ───────────────────── */

const APP_ID = "com.reservelab.app";

const nativeConfigs = [
  ["android", "android/app/src/main/assets/capacitor.config.json"],
  ["ios", "ios/App/App/capacitor.config.json"],
];

for (const [platform, relative] of nativeConfigs) {
  const raw = read(relative);
  if (!raw) {
    errors.push(`${platform}: ${relative} is missing — run \`npm run mobile:sync\`.`);
    continue;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    errors.push(`${platform}: ${relative} is not valid JSON.`);
    continue;
  }

  const bakedOrigin = parsed?.server?.url;
  lines.push(`  ${platform} baked origin`.padEnd(28) + (bakedOrigin ?? "(none)"));

  if (origin && bakedOrigin !== origin) {
    errors.push(
      `${platform}: the native project hosts ${bakedOrigin ?? "nothing"} but RESERVE_MOBILE_ORIGIN is ${origin}. ` +
        "Run `npm run mobile:sync` — the baked value is what ships.",
    );
  }
  if (parsed?.appId !== APP_ID) {
    errors.push(`${platform}: bundle id is ${parsed?.appId ?? "(none)"}, expected ${APP_ID}.`);
  }
}

/* ── 3b. Verified deep links ─────────────────────────────────────────
   Universal Links and App Links only work if the domain serves the
   association file AND the native project asks for it. Half of that is
   worse than neither: the link silently opens a browser and there is no
   error anywhere to explain why. A store build fails on it. */

const manifestForLinks = read("android/app/src/main/AndroidManifest.xml");
const manifestHasAutoVerify = manifestForLinks ? manifestForLinks.includes('android:autoVerify="true"') : null;

const teamId = (process.env.RESERVE_IOS_TEAM_ID ?? "").trim();
const androidFingerprint = (process.env.RESERVE_ANDROID_CERT_SHA256 ?? "").trim();

lines.push(`  ios team id`.padEnd(28) + (teamId || "(unset — iOS deep links will not verify)"));
lines.push(
  `  android cert sha-256`.padEnd(28) +
    (androidFingerprint ? `${androidFingerprint.slice(0, 17)}…` : "(unset — App Links will not verify)"),
);

if (channel === "store") {
  if (!teamId) {
    errors.push(
      "RESERVE_IOS_TEAM_ID is not set, so /.well-known/apple-app-site-association serves 404 and " +
        "Universal Links cannot verify. Apple caches this file — publish the real one BEFORE the build ships.",
    );
  } else if (!/^[A-Z0-9]{10}$/.test(teamId)) {
    errors.push(`RESERVE_IOS_TEAM_ID is "${teamId}" — expected ten alphanumeric characters from the Apple Developer account.`);
  }

  if (!androidFingerprint) {
    errors.push(
      "RESERVE_ANDROID_CERT_SHA256 is not set, so /.well-known/assetlinks.json serves 404 and App Links " +
        "cannot verify. Use the fingerprint of the key that signs the STORE build (Play App Signing), not a debug keystore.",
    );
  } else if (!androidFingerprint.split(",").every((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f.trim().toUpperCase()))) {
    errors.push("RESERVE_ANDROID_CERT_SHA256 is not a colon-separated upper-case SHA-256 fingerprint.");
  }
}

const entitlements = read("ios/App/App/App.entitlements");
if (!entitlements || !entitlements.includes("applinks:")) {
  errors.push("ios: App.entitlements is missing its applinks associated domain — Universal Links cannot work without it.");
}
if (manifestHasAutoVerify === false) {
  errors.push("android: no intent-filter with android:autoVerify=\"true\" — App Links will never be verified.");
}

/* ── 4. The OAuth scheme, on both platforms ─────────────────────────── */

const manifest = read("android/app/src/main/AndroidManifest.xml");
if (!manifest) {
  errors.push("android: AndroidManifest.xml is missing.");
} else {
  if (!manifest.includes('android:scheme="@string/custom_url_scheme"')) {
    errors.push(
      "android: no intent-filter for @string/custom_url_scheme — Google sign-in would never return to the app.",
    );
  }
  if (!manifest.includes("<queries>")) {
    errors.push("android: no <queries> block — Custom Tabs cannot open on Android 11+, breaking the OAuth leg.");
  }
}

const strings = read("android/app/src/main/res/values/strings.xml");
if (strings && !strings.includes(`<string name="custom_url_scheme">${APP_ID}</string>`)) {
  errors.push(`android: custom_url_scheme does not equal ${APP_ID}; the OAuth redirect would not match.`);
}

const plist = read("ios/App/App/Info.plist");
if (!plist) {
  errors.push("ios: Info.plist is missing.");
} else {
  /* Checked structurally, not by substring. `plist.includes("CFBundleURLSchemes")`
     is satisfied by any key that merely STARTS with that name, and the app id
     also appears under CFBundleURLName — so a substring pair reports a healthy
     registration for a plist that registers nothing. The scheme has to be found
     inside the array that belongs to the CFBundleURLSchemes key itself. */
  const schemeArray = /<key>\s*CFBundleURLSchemes\s*<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(plist);
  const registered = schemeArray
    ? new RegExp(`<string>\\s*${APP_ID.replace(/\./g, "\\.")}\\s*</string>`).test(schemeArray[1])
    : false;

  if (!registered) {
    errors.push(
      `ios: ${APP_ID} is not inside the CFBundleURLSchemes array — the OAuth return leg would be dropped.`,
    );
  }
  if (!/<key>\s*ITSAppUsesNonExemptEncryption\s*<\/key>/.test(plist)) {
    warnings.push("ios: ITSAppUsesNonExemptEncryption is absent; every upload will ask the export-compliance question.");
  }

  /* ── HealthKit ────────────────────────────────────────────────────────
     Two independent things have to be true, and each fails differently:
     a missing usage string TERMINATES the app the moment it asks for
     HealthKit access, while an entitlements file the Xcode project never
     references is simply inert and fails at upload instead. */
  if (!/<key>\s*NSHealthShareUsageDescription\s*<\/key>/.test(plist)) {
    errors.push(
      "ios: NSHealthShareUsageDescription is missing. iOS terminates the app when it requests HealthKit access without one.",
    );
  }
  if (/<key>\s*NSHealthUpdateUsageDescription\s*<\/key>/.test(plist)) {
    warnings.push(
      "ios: NSHealthUpdateUsageDescription is present, but Reserve only reads health data. Asking for write access invites an App Review question with no upside.",
    );
  }
}

const pbxproj = read("ios/App/App.xcodeproj/project.pbxproj");

if (!entitlements) {
  errors.push("ios: App.entitlements is missing — the HealthKit entitlement would not be requested.");
} else if (!/<key>\s*com\.apple\.developer\.healthkit\s*<\/key>\s*<true\/>/.test(entitlements)) {
  errors.push("ios: com.apple.developer.healthkit is not enabled in App.entitlements.");
}

if (pbxproj && entitlements) {
  /* An entitlements file the project does not reference is invisible to the
     signer: the build succeeds, and the upload is rejected for a missing
     entitlement that is sitting right there in the repo. */
  const referenced = (pbxproj.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) ?? []).length;
  if (referenced < 2) {
    errors.push(
      `ios: CODE_SIGN_ENTITLEMENTS is set in ${referenced} of the 2 App build configurations. ` +
        "An entitlements file the project does not reference is inert, and the failure only shows at upload.",
    );
  }
}

/* ── Health Connect ───────────────────────────────────────────────────
   Health Connect REJECTS the permission request unless the app declares a
   publicly reachable https privacy policy, which it opens from its own
   permission screen. Declaring the permissions without one ships an Android
   health connection that cannot work and points members at a dead link. */
const healthConfigRaw = read("android/healthfitness.config.json");

/* The plugin's sync hook FAILS OPEN: with no healthfitness.config.json it
   declares read AND write on every health type it knows, including blood
   glucose, blood pressure and body temperature, plus background health
   access. Reserve reads eight types and writes none. This guard exists
   because that regression is one deleted file away and is invisible in a
   diff of our own source. */
if (manifest) {
  const declared = [...new Set(manifest.match(/android\.permission\.health\.[A-Z_]+/g) ?? [])];

  const writes = declared.filter((p) => p.includes(".WRITE_"));
  if (writes.length > 0) {
    errors.push(
      `android: the manifest requests ${writes.length} health WRITE permission(s) — Reserve only reads. ` +
        `First is ${writes[0]}. This is the plugin's fail-open default; check android/healthfitness.config.json.`,
    );
  }

  const clinical = declared.filter((p) =>
    /BLOOD_GLUCOSE|BLOOD_PRESSURE|BODY_TEMPERATURE|BASAL_METABOLIC_RATE/.test(p),
  );
  if (clinical.length > 0) {
    errors.push(
      `android: the manifest requests clinical health data Reserve has no surface for: ${clinical.join(", ")}. ` +
        "Google Play requires a justification for every Health Connect permission, and there is none for these.",
    );
  }

  const background = declared.filter((p) => /IN_BACKGROUND|DATA_HISTORY/.test(p));
  if (background.length > 0) {
    errors.push(
      `android: the manifest requests ${background.join(", ")}. Reserve reads health data only while the member is using it.`,
    );
  }

  if (declared.length > 0) lines.push(`  health permissions        ${declared.length} (all read)`);
}

if (healthConfigRaw) {
  let healthConfig;
  try {
    healthConfig = JSON.parse(healthConfigRaw);
  } catch {
    errors.push("android: healthfitness.config.json is not valid JSON.");
  }

  const policy = typeof healthConfig?.privacyPolicyUrl === "string" ? healthConfig.privacyPolicyUrl.trim() : "";

  /* The same URL exists twice: here for the native build, and as
     PRIVACY_POLICY_URL for the runtime control that refuses to offer a
     connection without it. If they drift, Health Connect opens one page
     while the app reasons about another. */
  const policySource = read("src/lib/legal/privacy-policy.ts") ?? "";
  const declared = /export const PRIVACY_POLICY_URL = "([^"]+)"/.exec(policySource)?.[1];
  if (policy && declared && policy !== declared) {
    errors.push(
      `android: healthfitness.config.json points Health Connect at ${policy}, but PRIVACY_POLICY_URL is ${declared}.`,
    );
  }
  if (!policy.startsWith("https://")) {
    errors.push(
      "android: healthfitness.config.json declares Health Connect variables without a https privacyPolicyUrl. " +
        "Health Connect rejects the permission request without one, and the plugin otherwise derives a URL from " +
        "server.url that does not exist. Publish Reserve's privacy policy first — see docs/mobile/APP_STORE_REQUIREMENTS.md.",
    );
  }
  lines.push(`  health connect policy     ${policy || "(unset)"}`);
} else {
  lines.push("  health connect            not configured (Apple Health only)");
}

/* ── 5. Icon and splash sources ─────────────────────────────────────── */

const assetSources = ["icon.png", "icon-foreground.png", "icon-background.png", "splash.png"];
const missingAssets = assetSources.filter((name) => !existsSync(join(root, "mobile", "assets", name)));

if (missingAssets.length > 0) {
  const message = `mobile/assets is missing ${missingAssets.join(", ")} — see mobile/assets/README.md.`;
  if (channel === "store") errors.push(message);
  else warnings.push(message);
}

/* ── Sign in with Apple ───────────────────────────────────────────────
   App Review guideline 4.8: an app offering a third-party sign-in service
   must also offer an equivalent option limiting data collection to name and
   email. Reserve ships Google, so Apple is required on iOS.

   The entry surface reads the same endpoint at runtime and simply hides the
   button when the provider is off, which is the honest behaviour — and
   exactly why this needs checking here instead: a build with the button
   silently absent looks fine locally and is rejected by review. */
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

if (channel === "store" && process.env.MOBILE_SKIP_REACHABILITY !== "true") {
  if (!supabaseUrl || !supabaseAnonKey) {
    warnings.push(
      "Sign in with Apple could not be verified: NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are not set here. " +
        "Apple requires it wherever Google sign-in is offered (guideline 4.8).",
    );
  } else {
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: supabaseAnonKey },
        signal: AbortSignal.timeout(15_000),
      });
      const settings = await response.json().catch(() => null);
      const external = settings?.external ?? {};
      lines.push(`  apple sign-in             ${external.apple === true ? "enabled" : "OFF"}`);

      if (external.google === true && external.apple !== true) {
        errors.push(
          "Sign in with Apple is not enabled in Supabase, but Google sign-in is. App Review guideline 4.8 " +
            "requires an equivalent option, and the Apple button stays hidden until the provider is on.",
        );
      }
    } catch (error) {
      warnings.push(
        `Sign in with Apple could not be verified: ${error instanceof Error ? error.message : String(error)}.`,
      );
    }
  }
}

/* ── 6. Safety tools stay closed in a store build ───────────────────── */

const safetyFlag = process.env.NEXT_PUBLIC_ENABLE_SAFETY_TOOLS;
lines.push(`  safety tools flag         ${safetyFlag ?? "(unset — closed)"}`);

if (channel === "store" && safetyFlag === "true") {
  errors.push(
    "NEXT_PUBLIC_ENABLE_SAFETY_TOOLS=true in a store build. Cycle & Safety and the compound risk profiles " +
      "await clinician and counsel sign-off (CLAUDE.md), and shipping them is also the largest App Review risk " +
      "in the project. Unset it, or change this rule deliberately.",
  );
}

/* Note, not an error: the flag is read from the ORIGIN's build, not from the
   shell. The shell hosts whatever the deployed origin serves, so this check
   only covers the environment this command runs in. */
lines.push("");
lines.push("  note: the shell hosts the deployed origin, so what members actually see");
lines.push("        is decided by the ORIGIN's build flags, not by this binary.");

/* ── Report ─────────────────────────────────────────────────────────── */

console.log(lines.join("\n"));

if (warnings.length > 0) {
  console.log("\nWarnings:");
  for (const warning of warnings) console.log(`  ! ${warning}`);
}

if (errors.length > 0) {
  console.log("\nBlocking:");
  for (const error of errors) console.log(`  x ${error}`);
  console.log(`\nFAILED — ${errors.length} problem${errors.length === 1 ? "" : "s"} must be fixed before building.`);
  /* exitCode, not process.exit(): exiting while a timer or socket from the
     reachability check is still open aborts the process with a libuv
     assertion on Windows, which reads like a crashed preflight rather than
     a failed one. Letting Node drain gives a clean exit 1. */
  process.exitCode = 1;
} else {
  console.log("\nOK — no blocking problems.");
}
