/* ════════════════════════════════════════════════════════════════════════
   WHOOP — the protocol, and nothing else.

   This module is the real WHOOP Developer Platform (API v2) contract: the
   OAuth endpoints, the scopes, the token exchange, the paged reads, and the
   translation of WHOOP's records into Reserve's `ConnectedHealthObservation`.

   It holds no secrets and touches no database. Everything it needs is passed
   in, so it can be tested without a network, a server, or a WHOOP account.

   Two rules this file exists to keep:

     1. WHOOP Recovery, WHOOP Strain and WHOOP Sleep Performance are WHOOP's
        own scores on WHOOP's own scales. They are carried as `vendor-score`
        and keyed to WHOOP. They never become Reserve Readiness.
     2. A measured heart rate is not an estimate and not a score. The
        measurement type travels with every value, as `health-sources`
        requires, so the precedence rules can do their job.

   API surface confirmed against developer.whoop.com (v2, September 2026).
   ════════════════════════════════════════════════════════════════════════ */

import { z } from "zod";

import type {
  ConnectedHealthObservation,
  MeasurementType,
  ObservationCategory,
} from "@/lib/devices/health-sources";

/* ─── Endpoints ───────────────────────────────────────────────────────── */

export const WHOOP_AUTHORIZE_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
export const WHOOP_API_BASE = "https://api.prod.whoop.com/developer";

/**
 * The scopes Reserve asks for. `offline` is what makes a refresh token
 * possible — without it the connection dies an hour after it is made, and a
 * sync that cannot renew itself is not a connection.
 *
 * Note WHOOP's own mixed pluralisation: `read:cycles` but `read:workout`.
 */
export const WHOOP_SCOPES = [
  "read:profile",
  "read:body_measurement",
  "read:cycles",
  "read:recovery",
  "read:sleep",
  "read:workout",
  "offline",
] as const;

export type WhoopScope = (typeof WHOOP_SCOPES)[number];

/** WHOOP caps every paged collection endpoint at 25 records per request. */
export const WHOOP_PAGE_LIMIT = 25;

/* ─── Authorization ───────────────────────────────────────────────────── */

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: readonly string[];
}): string {
  if (params.state.length < 8) {
    // WHOOP rejects a state shorter than eight characters outright.
    throw new Error("WHOOP requires an OAuth state of at least eight characters.");
  }
  const url = new URL(WHOOP_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", (params.scopes ?? WHOOP_SCOPES).join(" "));
  url.searchParams.set("state", params.state);
  return url.toString();
}

/* ─── Tokens ──────────────────────────────────────────────────────────── */

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

export type WhoopTokens = {
  accessToken: string;
  /** Absent when WHOOP declines to issue one — the connection is then one hour long. */
  refreshToken?: string;
  /** Absolute ISO instant, computed from `expires_in` at the moment of the exchange. */
  expiresAt: string;
  grantedScopes: string[];
};

export class WhoopApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "WhoopApiError";
  }
}

type Fetcher = typeof fetch;

async function postToken(
  form: Record<string, string>,
  now: Date,
  fetcher: Fetcher,
): Promise<WhoopTokens> {
  const response = await fetcher(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    // The body can carry the client secret back in an error echo; never log it.
    throw new WhoopApiError(`WHOOP token request failed (${response.status}).`, response.status);
  }

  const parsed = tokenResponseSchema.safeParse(JSON.parse(text) as unknown);
  if (!parsed.success) {
    throw new WhoopApiError("WHOOP returned a token response Reserve does not understand.", 502);
  }

  const token = parsed.data;
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(now.getTime() + token.expires_in * 1000).toISOString(),
    grantedScopes: token.scope ? token.scope.split(/\s+/).filter(Boolean) : [],
  };
}

export async function exchangeCodeForTokens(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  now?: Date;
  fetcher?: Fetcher;
}): Promise<WhoopTokens> {
  return postToken(
    {
      grant_type: "authorization_code",
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
    },
    params.now ?? new Date(),
    params.fetcher ?? fetch,
  );
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  now?: Date;
  fetcher?: Fetcher;
}): Promise<WhoopTokens> {
  return postToken(
    {
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      // WHOOP only returns a NEW refresh token when `offline` is asked for again.
      scope: "offline",
    },
    params.now ?? new Date(),
    params.fetcher ?? fetch,
  );
}

/** True when the access token is gone or close enough to gone to renew now. */
export function tokenNeedsRefresh(expiresAt: string, now = new Date(), marginSeconds = 120): boolean {
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) return true;
  return expiry - now.getTime() <= marginSeconds * 1000;
}

/* ─── Reads ───────────────────────────────────────────────────────────── */

const scoreState = z.enum(["SCORED", "PENDING_SCORE", "UNSCORABLE"]);

const recoverySchema = z.object({
  cycle_id: z.number(),
  sleep_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  score_state: scoreState,
  score: z
    .object({
      user_calibrating: z.boolean().optional(),
      recovery_score: z.number().nullish(),
      resting_heart_rate: z.number().nullish(),
      hrv_rmssd_milli: z.number().nullish(),
      spo2_percentage: z.number().nullish(),
      skin_temp_celsius: z.number().nullish(),
    })
    .nullish(),
});

const cycleSchema = z.object({
  id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  start: z.string(),
  end: z.string().nullish(),
  timezone_offset: z.string().nullish(),
  score_state: scoreState,
  score: z
    .object({
      strain: z.number().nullish(),
      kilojoule: z.number().nullish(),
      average_heart_rate: z.number().nullish(),
      max_heart_rate: z.number().nullish(),
    })
    .nullish(),
});

const sleepSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  start: z.string(),
  end: z.string(),
  timezone_offset: z.string().nullish(),
  nap: z.boolean().optional(),
  score_state: scoreState,
  score: z
    .object({
      stage_summary: z
        .object({
          total_in_bed_time_milli: z.number().nullish(),
          total_awake_time_milli: z.number().nullish(),
          total_light_sleep_time_milli: z.number().nullish(),
          total_slow_wave_sleep_time_milli: z.number().nullish(),
          total_rem_sleep_time_milli: z.number().nullish(),
          sleep_cycle_count: z.number().nullish(),
          disturbance_count: z.number().nullish(),
        })
        .nullish(),
      respiratory_rate: z.number().nullish(),
      sleep_performance_percentage: z.number().nullish(),
      sleep_efficiency_percentage: z.number().nullish(),
      sleep_consistency_percentage: z.number().nullish(),
    })
    .nullish(),
});

const workoutSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  start: z.string(),
  end: z.string(),
  timezone_offset: z.string().nullish(),
  sport_name: z.string().nullish(),
  score_state: scoreState,
  score: z
    .object({
      strain: z.number().nullish(),
      average_heart_rate: z.number().nullish(),
      max_heart_rate: z.number().nullish(),
      kilojoule: z.number().nullish(),
      distance_meter: z.number().nullish(),
    })
    .nullish(),
});

export type WhoopRecovery = z.infer<typeof recoverySchema>;
export type WhoopCycle = z.infer<typeof cycleSchema>;
export type WhoopSleep = z.infer<typeof sleepSchema>;
export type WhoopWorkout = z.infer<typeof workoutSchema>;

const COLLECTIONS = {
  recovery: { path: "/v2/recovery", schema: recoverySchema },
  cycle: { path: "/v2/cycle", schema: cycleSchema },
  sleep: { path: "/v2/activity/sleep", schema: sleepSchema },
  workout: { path: "/v2/activity/workout", schema: workoutSchema },
} as const;

export type WhoopCollection = keyof typeof COLLECTIONS;

type PagedResponse = { records?: unknown[]; next_token?: string | null };

/**
 * Read one WHOOP collection from `start` forward, following `next_token` to
 * the end. `maxPages` is a hard stop: a first sync after a long absence must
 * not turn into an unbounded loop inside a serverless request.
 *
 * A record WHOOP has not scored yet is kept — `score_state` travels with it —
 * because it will be re-read and revised on a later sync.
 */
export async function readCollection<C extends WhoopCollection>(
  collection: C,
  params: {
    accessToken: string;
    start?: string;
    end?: string;
    maxPages?: number;
    fetcher?: Fetcher;
  },
): Promise<{ records: Array<z.infer<(typeof COLLECTIONS)[C]["schema"]>>; truncated: boolean }> {
  const { path, schema } = COLLECTIONS[collection];
  const fetcher = params.fetcher ?? fetch;
  const maxPages = params.maxPages ?? 8;

  const records: Array<z.infer<(typeof COLLECTIONS)[C]["schema"]>> = [];
  let nextToken: string | undefined;
  let page = 0;

  do {
    const url = new URL(`${WHOOP_API_BASE}${path}`);
    url.searchParams.set("limit", String(WHOOP_PAGE_LIMIT));
    if (params.start) url.searchParams.set("start", params.start);
    if (params.end) url.searchParams.set("end", params.end);
    if (nextToken) url.searchParams.set("nextToken", nextToken);

    const response = await fetcher(url.toString(), {
      headers: { Authorization: `Bearer ${params.accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new WhoopApiError(`WHOOP ${collection} read failed (${response.status}).`, response.status);
    }

    const body = (await response.json()) as PagedResponse;
    for (const raw of body.records ?? []) {
      const parsed = schema.safeParse(raw);
      // A record Reserve cannot read is skipped, never guessed at.
      if (parsed.success) records.push(parsed.data as z.infer<(typeof COLLECTIONS)[C]["schema"]>);
    }

    nextToken = body.next_token ?? undefined;
    page += 1;
  } while (nextToken && page < maxPages);

  return { records, truncated: Boolean(nextToken) };
}

/** Revoke Reserve's access from WHOOP's side. Called before local rows are dropped. */
export async function revokeAccess(accessToken: string, fetcher: Fetcher = fetch): Promise<boolean> {
  const response = await fetcher(`${WHOOP_API_BASE}/v2/user/access`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return response.ok;
}

/* ─── Translation into Reserve observations ───────────────────────────── */

type Draft = {
  key: string;
  category: ObservationCategory;
  measurementType: MeasurementType;
  value: number | string | boolean;
  unit?: string;
  observedAt: string;
  originalRecordId: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type WhoopObservation = Omit<ConnectedHealthObservation, "id"> & { dedupeKey: string };

const MS_PER_MINUTE = 60_000;

function draftsFromRecovery(record: WhoopRecovery): Draft[] {
  const score = record.score;
  if (record.score_state !== "SCORED" || !score) return [];

  // `created_at`, not `updated_at`: when WHOOP revises a score days later the
  // reading still belongs to the night it came from. An observation time that
  // moved on every revision would quietly reorder the member's history.
  const observedAt = record.created_at;
  const id = record.sleep_id;
  const out: Draft[] = [];

  if (score.recovery_score != null) {
    out.push({
      key: `recovery:${id}:score`,
      category: "custom",
      // WHOOP's own number on WHOOP's own scale. Reserve carries it, never adopts it.
      measurementType: "vendor-score",
      value: score.recovery_score,
      unit: "%",
      observedAt,
      originalRecordId: id,
      metadata: {
        vendorScoreKey: "whoop:recovery",
        cycleId: record.cycle_id,
        userCalibrating: score.user_calibrating ?? null,
      },
    });
  }
  if (score.hrv_rmssd_milli != null) {
    out.push({
      key: `recovery:${id}:hrv`,
      category: "hrv",
      measurementType: "measured",
      value: score.hrv_rmssd_milli,
      unit: "ms",
      observedAt,
      originalRecordId: id,
      metadata: { method: "rmssd" },
    });
  }
  if (score.resting_heart_rate != null) {
    out.push({
      key: `recovery:${id}:rhr`,
      category: "resting-heart-rate",
      measurementType: "measured",
      value: score.resting_heart_rate,
      unit: "bpm",
      observedAt,
      originalRecordId: id,
    });
  }
  if (score.spo2_percentage != null) {
    out.push({
      key: `recovery:${id}:spo2`,
      category: "blood-oxygen",
      measurementType: "measured",
      value: score.spo2_percentage,
      unit: "%",
      observedAt,
      originalRecordId: id,
    });
  }
  if (score.skin_temp_celsius != null) {
    out.push({
      key: `recovery:${id}:skin-temp`,
      category: "custom",
      measurementType: "measured",
      value: score.skin_temp_celsius,
      unit: "°C",
      observedAt,
      originalRecordId: id,
      metadata: { measure: "skin-temperature" },
    });
  }
  return out;
}

function draftsFromCycle(record: WhoopCycle): Draft[] {
  const score = record.score;
  if (record.score_state !== "SCORED" || !score) return [];

  const observedAt = record.start;
  const id = String(record.id);
  const out: Draft[] = [];

  if (score.strain != null) {
    out.push({
      key: `cycle:${id}:strain`,
      category: "custom",
      measurementType: "vendor-score",
      value: score.strain,
      observedAt,
      originalRecordId: id,
      metadata: { vendorScoreKey: "whoop:strain", cycleEnd: record.end ?? null },
    });
  }
  if (score.kilojoule != null) {
    out.push({
      key: `cycle:${id}:energy`,
      category: "active-energy",
      // WHOOP derives burn from heart rate; it is an estimate, not a measurement.
      measurementType: "device-estimated",
      value: Math.round(score.kilojoule * 0.239006),
      unit: "kcal",
      observedAt,
      originalRecordId: id,
      metadata: { kilojoule: score.kilojoule },
    });
  }
  if (score.average_heart_rate != null) {
    out.push({
      key: `cycle:${id}:avg-hr`,
      category: "heart-rate",
      measurementType: "measured",
      value: score.average_heart_rate,
      unit: "bpm",
      observedAt,
      originalRecordId: id,
      metadata: { aggregate: "cycle-average", maxHeartRate: score.max_heart_rate ?? null },
    });
  }
  return out;
}

function draftsFromSleep(record: WhoopSleep): Draft[] {
  const score = record.score;
  if (record.score_state !== "SCORED" || !score) return [];

  const observedAt = record.end;
  const id = record.id;
  const out: Draft[] = [];
  const stages = score.stage_summary;

  if (stages?.total_in_bed_time_milli != null) {
    const asleepMilli =
      stages.total_in_bed_time_milli - (stages.total_awake_time_milli ?? 0);
    out.push({
      key: `sleep:${id}:duration`,
      category: "sleep",
      measurementType: "measured",
      value: Math.round(asleepMilli / MS_PER_MINUTE),
      unit: "min",
      observedAt,
      originalRecordId: id,
      metadata: {
        nap: record.nap ?? false,
        inBedMinutes: Math.round(stages.total_in_bed_time_milli / MS_PER_MINUTE),
        remMinutes: stages.total_rem_sleep_time_milli != null ? Math.round(stages.total_rem_sleep_time_milli / MS_PER_MINUTE) : null,
        deepMinutes:
          stages.total_slow_wave_sleep_time_milli != null
            ? Math.round(stages.total_slow_wave_sleep_time_milli / MS_PER_MINUTE)
            : null,
        lightMinutes:
          stages.total_light_sleep_time_milli != null ? Math.round(stages.total_light_sleep_time_milli / MS_PER_MINUTE) : null,
        disturbances: stages.disturbance_count ?? null,
        sleepStart: record.start,
      },
    });
  }
  if (score.sleep_performance_percentage != null) {
    out.push({
      key: `sleep:${id}:performance`,
      category: "custom",
      measurementType: "vendor-score",
      value: score.sleep_performance_percentage,
      unit: "%",
      observedAt,
      originalRecordId: id,
      metadata: {
        vendorScoreKey: "whoop:sleep-performance",
        efficiency: score.sleep_efficiency_percentage ?? null,
        consistency: score.sleep_consistency_percentage ?? null,
      },
    });
  }
  if (score.respiratory_rate != null) {
    out.push({
      key: `sleep:${id}:respiratory`,
      category: "respiratory-rate",
      measurementType: "device-estimated",
      value: score.respiratory_rate,
      unit: "brpm",
      observedAt,
      originalRecordId: id,
    });
  }
  return out;
}

function draftsFromWorkout(record: WhoopWorkout): Draft[] {
  const startedAt = Date.parse(record.start);
  const endedAt = Date.parse(record.end);
  if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) return [];

  return [
    {
      key: `workout:${record.id}:duration`,
      category: "workout",
      measurementType: "measured",
      value: Math.round((endedAt - startedAt) / MS_PER_MINUTE),
      unit: "min",
      observedAt: record.start,
      originalRecordId: record.id,
      metadata: {
        sport: record.sport_name ?? null,
        strain: record.score?.strain ?? null,
        averageHeartRate: record.score?.average_heart_rate ?? null,
        maxHeartRate: record.score?.max_heart_rate ?? null,
        distanceMeter: record.score?.distance_meter ?? null,
        scoreState: record.score_state,
      },
    },
  ];
}

/**
 * Turn a sync's worth of WHOOP records into Reserve observations.
 *
 * `dedupeKey` is stable across syncs for the same underlying reading, so a
 * record WHOOP later revises updates its row instead of adding a second,
 * contradictory one.
 */
export function toObservations(
  athleteId: string,
  batch: {
    recovery?: WhoopRecovery[];
    cycle?: WhoopCycle[];
    sleep?: WhoopSleep[];
    workout?: WhoopWorkout[];
  },
  options: { importedAt?: string; sourceDevice?: string } = {},
): WhoopObservation[] {
  const importedAt = options.importedAt ?? new Date().toISOString();

  const drafts = [
    ...(batch.recovery ?? []).flatMap(draftsFromRecovery),
    ...(batch.cycle ?? []).flatMap(draftsFromCycle),
    ...(batch.sleep ?? []).flatMap(draftsFromSleep),
    ...(batch.workout ?? []).flatMap(draftsFromWorkout),
  ];

  return drafts.map((draft) => ({
    dedupeKey: draft.key,
    athleteId,
    provider: "whoop" as const,
    sourceDevice: options.sourceDevice ?? "WHOOP",
    originalRecordId: draft.originalRecordId,
    category: draft.category,
    measurementType: draft.measurementType,
    value: draft.value,
    unit: draft.unit,
    observedAt: draft.observedAt,
    importedAt,
    permissionScope: PERMISSION_SCOPE_FOR_KEY(draft.key),
    metadata: { ...(draft.metadata ?? {}), vendor: "whoop" },
  }));
}

/** Which granted scope a value came in under — kept on the row for provenance. */
const PERMISSION_SCOPE_FOR_KEY = (key: string): string => {
  if (key.startsWith("recovery:")) return "read:recovery";
  if (key.startsWith("cycle:")) return "read:cycles";
  if (key.startsWith("sleep:")) return "read:sleep";
  if (key.startsWith("workout:")) return "read:workout";
  return "read:profile";
};

/**
 * The window a sync should ask WHOOP for. From the last successful sync
 * (backed off, because WHOOP revises a record after it first appears) or, on
 * a first connection, a bounded amount of history.
 */
export function syncWindow(
  lastSuccessfulSyncAt: string | null | undefined,
  now = new Date(),
  firstSyncDays = 30,
  overlapHours = 36,
): { start: string; end: string } {
  const end = now.toISOString();
  if (!lastSuccessfulSyncAt) {
    return { start: new Date(now.getTime() - firstSyncDays * 86_400_000).toISOString(), end };
  }
  const last = Date.parse(lastSuccessfulSyncAt);
  if (Number.isNaN(last)) {
    return { start: new Date(now.getTime() - firstSyncDays * 86_400_000).toISOString(), end };
  }
  return { start: new Date(last - overlapHours * 3_600_000).toISOString(), end };
}
