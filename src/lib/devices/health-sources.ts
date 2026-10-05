/* ════════════════════════════════════════════════════════════════════════
   CONNECTED HEALTH SOURCES — contracts and provenance.

   This is ARCHITECTURE, not an integration. Browser code has no direct access
   to HealthKit or Health Connect; those require native platform work that
   does not exist in this repository. Nothing here opens a real connection,
   and no surface built on it may present one.

   What this module does provide:

     - A source contract with explicit permission and connection states.
     - An observation contract that never loses where a number came from.
     - A hard separation between vendor scores. WHOOP Recovery, Oura
       Readiness, Garmin Body Battery and Reserve Readiness are four different
       measurements on four different scales. Reserve keeps them apart.
     - Synthetic adapters that are unmistakably labelled development-only.
   ════════════════════════════════════════════════════════════════════════ */

/* ─── Source ──────────────────────────────────────────────────────────── */

export type HealthProvider =
  | "apple-health"
  | "health-connect"
  | "whoop"
  | "oura"
  | "garmin"
  | "manual";

export const HEALTH_PROVIDERS: HealthProvider[] = [
  "apple-health",
  "health-connect",
  "whoop",
  "oura",
  "garmin",
  "manual",
];

export const PROVIDER_LABELS: Record<HealthProvider, string> = {
  "apple-health": "Apple Health",
  "health-connect": "Android Health Connect",
  whoop: "WHOOP",
  oura: "Oura",
  garmin: "Garmin",
  manual: "Manual entry",
};

/**
 * How a provider could ever be reached. This is the field that stops the UI
 * from offering a button that cannot work.
 */
export type IntegrationTransport =
  | "native-bridge" // requires a native iOS/Android host application
  | "cloud-oauth" // reachable from a server via the vendor's OAuth API
  | "in-app"; // no integration needed

export const PROVIDER_TRANSPORT: Record<HealthProvider, IntegrationTransport> = {
  "apple-health": "native-bridge",
  "health-connect": "native-bridge",
  whoop: "cloud-oauth",
  oura: "cloud-oauth",
  garmin: "cloud-oauth",
  manual: "in-app",
};

/**
 * The native host this code is running inside, or null in a browser.
 *
 * Passed explicitly so availability stays a pure function of its inputs:
 * tests decide the host rather than inheriting whatever the environment
 * happens to be.
 */
export type NativeHost = { platform: "ios" | "android" } | null;

/** Which host each native-bridge provider can only ever be reached from. */
const NATIVE_BRIDGE_PLATFORM: Partial<Record<HealthProvider, "ios" | "android">> = {
  "apple-health": "ios",
  "health-connect": "android",
};

/**
 * Whether this runtime can actually connect the provider.
 *
 * Two independent things gate it, one per transport, which is why they are
 * named options rather than positions:
 *
 *   - a NATIVE-BRIDGE provider is reachable only from the matching native
 *     host — Apple Health from the iOS app, Health Connect from the Android
 *     app. In a browser, and on the wrong platform, it is not, and the
 *     reason says which.
 *   - a CLOUD-OAUTH provider is reachable only where this deployment holds
 *     the vendor's credentials. `configuredCloudProviders` is what the
 *     server reports (see /api/integrations/whoop/status), never a guess
 *     made in the browser.
 *
 * Both default to the conservative answer — no host, no credentials — so a
 * caller that has not checked cannot accidentally offer a live button.
 * `detectNativeHost()` in `@/lib/devices/native-health` does the sniffing
 * for real call sites.
 *
 * A connect affordance must be disabled with this reason, never shown as
 * live: an honest disabled control is the rule (CLAUDE.md, UI Quality).
 */
export function connectionAvailability(
  provider: HealthProvider,
  options: {
    host?: NativeHost;
    configuredCloudProviders?: readonly HealthProvider[];
  } = {},
): {
  available: boolean;
  reason: string;
} {
  const host = options.host ?? null;
  const configuredCloudProviders = options.configuredCloudProviders ?? [];
  switch (PROVIDER_TRANSPORT[provider]) {
    case "in-app":
      return { available: true, reason: "Manual entry needs no integration." };
    case "native-bridge": {
      const required = NATIVE_BRIDGE_PLATFORM[provider];
      const label = PROVIDER_LABELS[provider];

      if (!host) {
        return {
          available: false,
          reason: `${label} can only be read by the Reserve app. A browser cannot reach it directly.`,
        };
      }
      if (host.platform !== required) {
        return {
          available: false,
          reason: `${label} is only available on ${required === "ios" ? "iPhone" : "Android"}.`,
        };
      }
      return {
        available: true,
        reason: `${label} can be read by the Reserve app on this device, once you grant permission.`,
      };
    }
    case "cloud-oauth":
      return configuredCloudProviders.includes(provider)
        ? {
            available: true,
            reason: `${PROVIDER_LABELS[provider]} is reachable from this deployment. Connecting opens ${PROVIDER_LABELS[provider]}'s own consent screen.`,
          }
        : {
            available: false,
            reason: `${PROVIDER_LABELS[provider]} requires a server-side OAuth integration and vendor credentials, which are not configured in this build.`,
          };
  }
}

export type HealthSourceStatus =
  | "not-connected"
  | "connecting"
  | "connected"
  | "paused"
  | "permission-limited"
  | "expired"
  | "error";

export type ConnectedHealthSource = {
  id: string;
  athleteId: string;
  provider: HealthProvider;
  status: HealthSourceStatus;
  grantedDataTypes: string[];
  lastSuccessfulSyncAt?: string;
  lastCursor?: string;
  /** Per-category precedence when two providers report the same measurement. */
  sourcePriority: Record<string, number>;
  /** True for every source produced by a synthetic adapter. */
  synthetic?: boolean;
  createdAt: string;
  updatedAt: string;
};

/** A source only yields data when connected or explicitly permission-limited. */
export function sourceIsReadable(source: ConnectedHealthSource): boolean {
  return source.status === "connected" || source.status === "permission-limited";
}

/* ─── Observation ─────────────────────────────────────────────────────── */

export type ObservationCategory =
  | "workout"
  | "steps"
  | "active-energy"
  | "heart-rate"
  | "resting-heart-rate"
  | "hrv"
  | "sleep"
  | "respiratory-rate"
  | "blood-oxygen"
  | "body-weight"
  | "body-composition"
  | "distance"
  | "duration"
  | "custom";

/**
 * How the number came to exist. This is the difference between a measured
 * resting heart rate and a vendor's proprietary readiness score, and Reserve
 * must never flatten the two.
 */
export type MeasurementType =
  | "measured"
  | "device-estimated"
  | "vendor-score"
  | "athlete-reported"
  | "reserve-derived";

export type ConnectedHealthObservation = {
  id: string;
  athleteId: string;

  provider: HealthProvider;
  sourceDevice?: string;
  originalRecordId?: string;

  category: ObservationCategory;
  measurementType: MeasurementType;

  value: number | string | boolean;
  unit?: string;

  observedAt: string;
  timezone?: string;

  importedAt: string;
  revisedAt?: string;

  permissionScope: string;

  metadata: Record<string, string | number | boolean | null>;
};

/* ─── Vendor score separation ─────────────────────────────────────────── */

/**
 * A vendor score is only comparable to itself. The key encodes the vendor and
 * the score name so two vendors' "readiness" can never merge into one series.
 */
export type VendorScoreKey =
  | "whoop:recovery"
  | "whoop:strain"
  | "whoop:sleep-performance"
  | "oura:readiness"
  | "garmin:body-battery"
  | "reserve:readiness";

export const VENDOR_SCORE_SCALES: Record<VendorScoreKey, { min: number; max: number; label: string }> = {
  "whoop:recovery": { min: 0, max: 100, label: "WHOOP Recovery" },
  // Strain is 0–21, not 0–100. Rendering it on a percentage bar would be a lie
  // about the reading itself, which is why every scale is declared here.
  "whoop:strain": { min: 0, max: 21, label: "WHOOP Strain" },
  "whoop:sleep-performance": { min: 0, max: 100, label: "WHOOP Sleep Performance" },
  "oura:readiness": { min: 0, max: 100, label: "Oura Readiness" },
  "garmin:body-battery": { min: 0, max: 100, label: "Garmin Body Battery" },
  "reserve:readiness": { min: 0, max: 100, label: "Reserve Readiness" },
};

export function vendorScoreKey(
  provider: HealthProvider,
  scoreName: string,
): VendorScoreKey | null {
  const key = `${provider}:${scoreName}`;
  return key in VENDOR_SCORE_SCALES ? (key as VendorScoreKey) : null;
}

/**
 * Two vendor scores are comparable only when they are the same key. Sharing a
 * 0–100 range does not make them the same measurement.
 */
export function scoresAreComparable(a: VendorScoreKey, b: VendorScoreKey): boolean {
  return a === b;
}

/* ─── Source precedence ───────────────────────────────────────────────── */

/**
 * Which observation wins when several sources report the same category.
 * Measured data outranks an estimate, which outranks a vendor score; ties go
 * to the athlete's configured source priority, then to the newer reading.
 */
const MEASUREMENT_RANK: Record<MeasurementType, number> = {
  measured: 4,
  "athlete-reported": 3,
  "device-estimated": 2,
  "vendor-score": 1,
  "reserve-derived": 0,
};

export function preferredObservation(
  observations: ConnectedHealthObservation[],
  sources: ConnectedHealthSource[],
): ConnectedHealthObservation | null {
  const readable = new Map(
    sources.filter(sourceIsReadable).map((s) => [s.provider, s] as const),
  );

  const eligible = observations.filter((o) => readable.has(o.provider));
  if (eligible.length === 0) return null;

  return eligible.reduce((best, current) => {
    const rankDelta = MEASUREMENT_RANK[current.measurementType] - MEASUREMENT_RANK[best.measurementType];
    if (rankDelta !== 0) return rankDelta > 0 ? current : best;

    const currentPriority = readable.get(current.provider)?.sourcePriority[current.category] ?? 0;
    const bestPriority = readable.get(best.provider)?.sourcePriority[best.category] ?? 0;
    if (currentPriority !== bestPriority) return currentPriority > bestPriority ? current : best;

    return current.observedAt > best.observedAt ? current : best;
  });
}

/* ─── Synthetic adapters (development only) ───────────────────────────── */

export const SYNTHETIC_NOTICE =
  "Development-only synthetic data. This is not a real device connection.";

/**
 * Produces a source that is unmistakably synthetic. `synthetic: true` and the
 * id prefix both mark it, so a fixture can never be mistaken for a live
 * connection in the inspector or in persisted state.
 */
export function syntheticSource(
  provider: HealthProvider,
  athleteId: string,
  over: Partial<ConnectedHealthSource> = {},
): ConnectedHealthSource {
  const now = "2026-07-29T00:00:00.000Z";
  return {
    id: `synthetic-${provider}-${athleteId}`,
    athleteId,
    provider,
    status: "connected",
    grantedDataTypes: ["sleep", "hrv", "resting-heart-rate"],
    lastSuccessfulSyncAt: now,
    sourcePriority: {},
    synthetic: true,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

export function syntheticObservation(
  provider: HealthProvider,
  athleteId: string,
  over: Partial<ConnectedHealthObservation> = {},
): ConnectedHealthObservation {
  const now = "2026-07-29T00:00:00.000Z";
  return {
    id: `synthetic-obs-${provider}-${athleteId}`,
    athleteId,
    provider,
    category: "hrv",
    measurementType: "measured",
    value: 62,
    unit: "ms",
    observedAt: now,
    importedAt: now,
    permissionScope: "read:hrv",
    metadata: { synthetic: true, notice: SYNTHETIC_NOTICE },
    ...over,
  };
}

export function isSynthetic(
  record: ConnectedHealthSource | ConnectedHealthObservation,
): boolean {
  if ("synthetic" in record && record.synthetic) return true;
  if ("metadata" in record && record.metadata?.synthetic === true) return true;
  return record.id.startsWith("synthetic-");
}

/* ─── Native bridge contract (documentation, not implementation) ──────── */

export type NativeBridgeContract = {
  platform: "ios" | "android";
  hostRequirement: string;
  normalizationTarget: string;
  notImplemented: true;
};

/**
 * The shape a native host would have to satisfy. Explicitly marked
 * `notImplemented` so no consumer can mistake it for a working bridge.
 */
export const NATIVE_BRIDGE_CONTRACTS: NativeBridgeContract[] = [
  {
    platform: "ios",
    hostRequirement:
      "A native iOS application requesting HealthKit read authorization and forwarding records to Reserve.",
    normalizationTarget: "ConnectedHealthObservation with provider 'apple-health'.",
    notImplemented: true,
  },
  {
    platform: "android",
    hostRequirement:
      "A native Android application holding Health Connect read permissions and forwarding records to Reserve.",
    normalizationTarget: "ConnectedHealthObservation with provider 'health-connect'.",
    notImplemented: true,
  },
];
