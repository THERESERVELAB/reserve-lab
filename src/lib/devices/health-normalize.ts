/* ════════════════════════════════════════════════════════════════════════
   NATIVE HEALTH — turning platform readings into Reserve observations.

   This module is pure. It knows nothing about Capacitor, HealthKit or
   Health Connect; it takes whatever the native query returned and produces
   `ConnectedHealthObservation` values that satisfy the contract in
   health-sources.ts. That separation is what makes the risky part testable:
   the plugin call cannot run outside a device, but every decision about
   what a number MEANS is made here, where tests can reach it.

   ── The rule this module exists to enforce ─────────────────────────────
   A reading that does not parse cleanly is DROPPED, never guessed.

   The underlying result shape comes from a binary native library
   (IONHealthFitnessLib on iOS, io.ionic.libs:ionhealthfitness-android),
   so it is not knowable from this repository and is not stable across
   versions. Parsing defensively is therefore not pessimism, it is the only
   honest option — and a health number Reserve invents because a field moved
   is far worse than a gap. `normalizeReadings` reports what it discarded so
   a silent shape change surfaces as a visible count rather than as missing
   days nobody notices.
   ════════════════════════════════════════════════════════════════════════ */

import type {
  ConnectedHealthObservation,
  HealthProvider,
  MeasurementType,
  ObservationCategory,
} from "@/lib/devices/health-sources";

/* ─── The variables Reserve reads ─────────────────────────────────────── */

/**
 * The platform variable names Reserve asks for, and nothing more.
 *
 * Deliberately narrow. The plugin also exposes BLOOD_PRESSURE,
 * BLOOD_GLUCOSE and BODY_TEMPERATURE; Reserve does not read them. They are
 * clinical measurements with no surface in this product, and requesting a
 * permission the app has no use for is both a store-review liability and a
 * thing a member would be right to refuse.
 *
 * HRV and resting heart rate are absent because the plugin does not expose
 * them — not because Reserve does not want them. Both platforms record HRV
 * natively (HealthKit `heartRateVariabilitySDNN`, Health Connect
 * `HeartRateVariabilityRmssdRecord`); reaching them needs native code this
 * plugin does not ship. Until then Reserve Readiness has no HRV input from
 * Apple Health or Health Connect, and nothing here may pretend otherwise.
 */
export const RESERVE_HEALTH_VARIABLES = [
  "SLEEP",
  "HEART_RATE",
  "OXYGEN_SATURATION",
  "WEIGHT",
  "BODY_FAT_PERCENTAGE",
  "STEPS",
  "CALORIES_BURNED",
  "DISTANCE",
] as const;

export type ReserveHealthVariable = (typeof RESERVE_HEALTH_VARIABLES)[number];

type VariableSpec = {
  category: ObservationCategory;
  measurementType: MeasurementType;
  /**
   * The unit Reserve records the value in.
   *
   * These are the canonical units HealthKit and Health Connect use for each
   * type. They are NOT verified against a device in this repository — see
   * the commissioning note in docs/mobile/HEALTH_BRIDGE.md. A unit that
   * turns out to be wrong is a silently wrong number, so this is the first
   * thing to check on a real device.
   */
  unit: string;
  /** Rejects values the platform could never legitimately produce. */
  plausible: (value: number) => boolean;
};

export const VARIABLE_SPEC: Record<ReserveHealthVariable, VariableSpec> = {
  /* Health Connect and HealthKit both express a sleep session as a duration;
     Reserve stores minutes asleep for the bucket. */
  SLEEP: { category: "sleep", measurementType: "measured", unit: "min", plausible: (v) => v >= 0 && v <= 24 * 60 },
  HEART_RATE: { category: "heart-rate", measurementType: "measured", unit: "bpm", plausible: (v) => v > 0 && v < 300 },
  OXYGEN_SATURATION: { category: "blood-oxygen", measurementType: "measured", unit: "%", plausible: (v) => v > 0 && v <= 100 },
  WEIGHT: { category: "body-weight", measurementType: "measured", unit: "kg", plausible: (v) => v > 0 && v < 700 },
  BODY_FAT_PERCENTAGE: { category: "body-composition", measurementType: "measured", unit: "%", plausible: (v) => v > 0 && v <= 100 },
  STEPS: { category: "steps", measurementType: "measured", unit: "count", plausible: (v) => v >= 0 && v < 500_000 },
  CALORIES_BURNED: { category: "active-energy", measurementType: "measured", unit: "kcal", plausible: (v) => v >= 0 && v < 50_000 },
  DISTANCE: { category: "distance", measurementType: "measured", unit: "m", plausible: (v) => v >= 0 && v < 1_000_000 },
};

/* ─── What a native query hands back ──────────────────────────────────── */

/**
 * One reading, after the raw native blob has been coerced into a shape
 * Reserve is willing to reason about.
 */
export type HealthReading = {
  variable: ReserveHealthVariable;
  value: number;
  /** ISO 8601. The instant the measurement describes, not when it was read. */
  observedAt: string;
  /** The device or app that recorded it, when the platform says. */
  sourceDevice?: string;
};

export type NormalizeOutcome = {
  observations: ConnectedHealthObservation[];
  /**
   * Readings that were thrown away, with why. Never empty-and-silent: a
   * caller is expected to surface a non-zero count rather than absorb it.
   */
  discarded: Array<{ reason: string; detail: string }>;
};

/* ─── Defensive parsing ───────────────────────────────────────────────── */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Pull a number out of a field that may be a number or a numeric string.
 * Returns null for anything else, including NaN, Infinity and "".
 */
function readNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Pull an ISO timestamp out of a field, rejecting anything Date cannot read.
 * Normalized to a real ISO string so downstream string comparison of
 * `observedAt` (which preferredObservation relies on) is well defined.
 */
function readTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Case-insensitive field lookup — the native shape's casing is not ours to assume. */
function field(block: Record<string, unknown>, ...names: string[]): unknown {
  const lowered = new Map(Object.entries(block).map(([k, v]) => [k.toLowerCase(), v]));
  for (const name of names) {
    const hit = lowered.get(name.toLowerCase());
    if (hit !== undefined && hit !== null) return hit;
  }
  return undefined;
}

/**
 * Parse the JSON-encoded string `getData()` returns into candidate readings.
 *
 * Accepts either a bare array of blocks or an object wrapping one under a
 * plausible key, because the native library's envelope is not documented and
 * has no stability guarantee. Anything else yields no readings rather than
 * an exception — a shape change must degrade to "no data", never to a crash
 * inside a member's app.
 */
export function parseNativeResults(
  raw: string | undefined | null,
  variable: ReserveHealthVariable,
): { readings: HealthReading[]; discarded: NormalizeOutcome["discarded"] } {
  const discarded: NormalizeOutcome["discarded"] = [];

  if (!raw || raw.trim() === "") return { readings: [], discarded };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    discarded.push({ reason: "unparseable-json", detail: `${variable}: result was not JSON` });
    return { readings: [], discarded };
  }

  let blocks: unknown[];
  if (Array.isArray(parsed)) {
    blocks = parsed;
  } else if (isRecord(parsed)) {
    const nested = field(parsed, "results", "data", "blocks", "values");
    blocks = Array.isArray(nested) ? nested : [parsed];
  } else {
    discarded.push({ reason: "unexpected-envelope", detail: `${variable}: ${typeof parsed}` });
    return { readings: [], discarded };
  }

  const spec = VARIABLE_SPEC[variable];
  const readings: HealthReading[] = [];

  for (const block of blocks) {
    if (!isRecord(block)) {
      discarded.push({ reason: "not-an-object", detail: `${variable}: ${typeof block}` });
      continue;
    }

    const value = readNumber(field(block, "value", "Value", "rawValue", "total", "sum"));
    if (value === null) {
      discarded.push({ reason: "no-numeric-value", detail: `${variable}: no readable value field` });
      continue;
    }

    /* A number outside what the platform can physically report means the
       field moved or the unit changed. Either way Reserve does not know what
       it is holding, so it does not keep it. */
    if (!spec.plausible(value)) {
      discarded.push({ reason: "implausible-value", detail: `${variable}: ${value} ${spec.unit}` });
      continue;
    }

    const observedAt = readTimestamp(field(block, "startDate", "StartDate", "date", "Date", "timestamp"));
    if (!observedAt) {
      discarded.push({ reason: "no-timestamp", detail: `${variable}: no readable date field` });
      continue;
    }

    const rawDevice = field(block, "source", "Source", "sourceName", "device");
    readings.push({
      variable,
      value,
      observedAt,
      sourceDevice: typeof rawDevice === "string" && rawDevice.trim() !== "" ? rawDevice : undefined,
    });
  }

  return { readings, discarded };
}

/* ─── Readings to observations ────────────────────────────────────────── */

/**
 * Turn validated readings into observations for the given provider.
 *
 * `importedAt` is passed rather than read from the clock so the result is a
 * pure function of its inputs and a test can assert the whole record.
 */
export function normalizeReadings(
  readings: HealthReading[],
  context: {
    provider: Extract<HealthProvider, "apple-health" | "health-connect">;
    athleteId: string;
    importedAt: string;
  },
): NormalizeOutcome {
  const observations: ConnectedHealthObservation[] = [];
  const discarded: NormalizeOutcome["discarded"] = [];

  for (const reading of readings) {
    const spec = VARIABLE_SPEC[reading.variable];
    if (!spec) {
      discarded.push({ reason: "unknown-variable", detail: reading.variable });
      continue;
    }

    observations.push({
      /* Stable across re-reads: the same measurement imported twice must not
         become two observations. Provider, variable and instant identify it. */
      id: `${context.provider}:${reading.variable}:${reading.observedAt}`,
      athleteId: context.athleteId,
      provider: context.provider,
      sourceDevice: reading.sourceDevice,
      category: spec.category,
      /* Everything here is a platform measurement, never a vendor score.
         Apple and Google do not publish a readiness number through these
         APIs, and Reserve Readiness stays its own separate series. */
      measurementType: spec.measurementType,
      value: reading.value,
      unit: spec.unit,
      observedAt: reading.observedAt,
      importedAt: context.importedAt,
      permissionScope: `read:${spec.category}`,
      metadata: { variable: reading.variable },
    });
  }

  return { observations, discarded };
}
