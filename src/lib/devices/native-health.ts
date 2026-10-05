/* ════════════════════════════════════════════════════════════════════════
   NATIVE HEALTH BRIDGE — Apple Health and Health Connect, through the shell.

   Everything that can be decided without a device lives in
   health-normalize.ts and is covered by tests. This module is the part that
   only a device can exercise: asking for permission and running the query.
   It is kept deliberately thin for that reason.

   ── What this cannot do, and must never imply ──────────────────────────
   The plugin exposes no HRV and no resting heart rate. Both platforms
   record HRV natively — HealthKit `heartRateVariabilitySDNN`, Health
   Connect `HeartRateVariabilityRmssdRecord` — but reaching them needs
   native code @capacitor/health-fitness does not ship. Reserve Readiness
   therefore gets no HRV from this bridge, and no surface built on it may
   suggest otherwise. Average heart rate is reported as `heart-rate`, never
   as `resting-heart-rate`: taking a daily minimum and calling it "resting"
   would be Reserve inventing a measurement the platform never made.

   ── Android is blocked on a privacy policy ─────────────────────────────
   Health Connect REJECTS the permission request outright unless the app
   declares a publicly reachable https privacy policy URL, which it then
   opens from its own permission screen. Reserve has no privacy policy yet
   (docs/mobile/APP_STORE_REQUIREMENTS.md §1.1), so the Android half of this
   bridge cannot function until that page exists. `healthAccessBlocker()`
   reports that as a reason rather than letting a member tap a control that
   will fail.
   ════════════════════════════════════════════════════════════════════════ */

import {
  connectionAvailability,
  type HealthProvider,
  type NativeHost,
} from "@/lib/devices/health-sources";
import {
  RESERVE_HEALTH_VARIABLES,
  normalizeReadings,
  parseNativeResults,
  type NormalizeOutcome,
  type ReserveHealthVariable,
} from "@/lib/devices/health-normalize";
import { PRIVACY_POLICY_URL } from "@/lib/legal/privacy-policy";
import { isNativeShell, nativePlatform } from "@/lib/mobile/native-shell";

/** The host this code is running in, for `connectionAvailability`. */
export function detectNativeHost(): NativeHost {
  if (!isNativeShell()) return null;
  const platform = nativePlatform();
  return platform === "ios" || platform === "android" ? { platform } : null;
}

/** Which provider this device's health store is, or null off a device. */
export function nativeHealthProvider(
  host: NativeHost = detectNativeHost(),
): Extract<HealthProvider, "apple-health" | "health-connect"> | null {
  if (!host) return null;
  return host.platform === "ios" ? "apple-health" : "health-connect";
}

/**
 * Whether the app is configured to ask for health access at all.
 *
 * Returns null when nothing blocks it, or a member-readable reason. This is
 * what a connect control must disable itself with — never a dead button
 * (CLAUDE.md, UI Quality).
 *
 * `privacyPolicyUrl` is what `android/healthfitness.config.json` carries
 * into the build; it is passed in rather than read here so this stays
 * testable and so a caller cannot forget it exists.
 */
export function healthAccessBlocker(options: {
  host?: NativeHost;
  /** Defaults to the published policy; passed explicitly only by tests. */
  privacyPolicyUrl?: string | null;
} = {}): string | null {
  const host = options.host ?? detectNativeHost();
  const privacyPolicyUrl =
    options.privacyPolicyUrl === undefined ? PRIVACY_POLICY_URL : options.privacyPolicyUrl;
  const provider = nativeHealthProvider(host);

  if (!provider) {
    return "Connecting a health app needs the Reserve app on your phone.";
  }

  const availability = connectionAvailability(provider, { host });
  if (!availability.available) return availability.reason;

  if (provider === "health-connect") {
    const url = privacyPolicyUrl?.trim();
    if (!url || !url.startsWith("https://")) {
      /* Not a nicety: Health Connect refuses the permission request without
         it, so offering the control would guarantee a failure. */
      return "Health Connect needs Reserve's privacy policy to be published before it can be connected.";
    }
  }

  return null;
}

/* ─── Permission ──────────────────────────────────────────────────────── */

/**
 * Ask for read access to the variables in RESERVE_HEALTH_VARIABLES.
 *
 * Read-only, and only the variables Reserve actually uses. The plugin's
 * `allVariables` shortcut would also request blood pressure, blood glucose
 * and body temperature, which Reserve has no surface for — asking for them
 * is a store-review liability and a thing a member would be right to refuse.
 *
 * iOS note: HealthKit deliberately does not tell an app which read
 * permissions were granted, so a resolved call means "the sheet was shown",
 * not "access was granted". The only honest way to know is to read and see
 * whether anything comes back.
 */
export async function requestHealthAccess(): Promise<{ ok: boolean; message?: string }> {
  if (!isNativeShell()) {
    return { ok: false, message: "Health access is only available in the Reserve app." };
  }

  try {
    const { HealthFitness } = await import("@capacitor/health-fitness");

    await HealthFitness.requestHealthPermissions({
      customPermissions: JSON.stringify(
        RESERVE_HEALTH_VARIABLES.map((variable) => ({ Variable: variable, AccessType: "READ" })),
      ),
      allVariables: JSON.stringify({ IsActive: false, AccessType: "READ" }),
      fitnessVariables: JSON.stringify({ IsActive: false, AccessType: "READ" }),
      healthVariables: JSON.stringify({ IsActive: false, AccessType: "READ" }),
      profileVariables: JSON.stringify({ IsActive: false, AccessType: "READ" }),
      workoutVariables: JSON.stringify({ IsActive: false, AccessType: "READ" }),
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Health access could not be requested." };
  }
}

/* ─── Reading ─────────────────────────────────────────────────────────── */

/**
 * How each variable is bucketed and aggregated per day.
 *
 * SUM for the cumulative ones, AVERAGE for the instantaneous ones. Summing
 * a body weight or a heart rate would produce a number that means nothing.
 *
 * The operation names are the plugin's documented vocabulary; only `SUM`
 * appears in its README, so the others are unverified against a device.
 * `readHealthWindow` therefore isolates each variable — a rejected
 * operation loses that one series, not the whole read.
 */
const DAILY_OPERATION: Record<ReserveHealthVariable, "SUM" | "AVERAGE"> = {
  SLEEP: "SUM",
  STEPS: "SUM",
  CALORIES_BURNED: "SUM",
  DISTANCE: "SUM",
  HEART_RATE: "AVERAGE",
  OXYGEN_SATURATION: "AVERAGE",
  WEIGHT: "AVERAGE",
  BODY_FAT_PERCENTAGE: "AVERAGE",
};

/**
 * The plugin's native date parser accepts only "yyyy-MM-dd'T'HH:mm:ssZ",
 * so toISOString()'s fractional seconds have to come off or the query is
 * rejected.
 */
export function pluginDate(date: Date): string {
  return `${date.toISOString().split(".")[0]}Z`;
}

export type HealthWindowResult = NormalizeOutcome & {
  /** Variables whose query failed outright, with the platform's reason. */
  failed: Array<{ variable: ReserveHealthVariable; message: string }>;
};

/**
 * Read every Reserve variable over a window and return observations.
 *
 * Each variable is queried independently so one unsupported operation or
 * ungranted permission cannot take the whole sync down with it. Nothing is
 * inferred for a variable that returned nothing: a gap stays a gap.
 */
export async function readHealthWindow(options: {
  athleteId: string;
  from: Date;
  to: Date;
  now?: Date;
}): Promise<HealthWindowResult> {
  const provider = nativeHealthProvider();
  if (!provider) {
    return { observations: [], discarded: [], failed: [] };
  }

  const { HealthFitness } = await import("@capacitor/health-fitness");
  const importedAt = (options.now ?? new Date()).toISOString();

  const allReadings: HealthWindowResult["observations"] = [];
  const discarded: NormalizeOutcome["discarded"] = [];
  const failed: HealthWindowResult["failed"] = [];

  for (const variable of RESERVE_HEALTH_VARIABLES) {
    try {
      const { results } = await HealthFitness.getData({
        parameters: JSON.stringify({
          Variable: variable,
          StartDate: pluginDate(options.from),
          EndDate: pluginDate(options.to),
          TimeUnit: "DAY",
          TimeUnitLength: 1,
          OperationType: DAILY_OPERATION[variable],
          AdvancedQueryReturnType: "ALL_DATA",
          AdvancedQueryResultType: "RAW_DATA",
        }),
      });

      const parsed = parseNativeResults(results, variable);
      discarded.push(...parsed.discarded);

      const normalized = normalizeReadings(parsed.readings, {
        provider,
        athleteId: options.athleteId,
        importedAt,
      });
      allReadings.push(...normalized.observations);
      discarded.push(...normalized.discarded);
    } catch (error) {
      failed.push({
        variable,
        message: error instanceof Error ? error.message : "query rejected",
      });
    }
  }

  return { observations: allReadings, discarded, failed };
}
