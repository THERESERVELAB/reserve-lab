import { describe, expect, it } from "vitest";

import { VENDOR_SCORE_SCALES, connectionAvailability, scoresAreComparable } from "../health-sources";
import {
  WHOOP_AUTHORIZE_URL,
  WHOOP_SCOPES,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  readCollection,
  syncWindow,
  toObservations,
  tokenNeedsRefresh,
  type WhoopRecovery,
  type WhoopSleep,
} from "../whoop";

/* ─── Authorization ───────────────────────────────────────────────────── */

describe("buildAuthorizeUrl", () => {
  const base = { clientId: "abc", redirectUri: "https://reserve.test/api/integrations/whoop/callback", state: "state-value-long" };

  it("sends the member to WHOOP with every parameter the flow needs", () => {
    const url = new URL(buildAuthorizeUrl(base));
    expect(`${url.origin}${url.pathname}`).toBe(WHOOP_AUTHORIZE_URL);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("abc");
    expect(url.searchParams.get("redirect_uri")).toBe(base.redirectUri);
    expect(url.searchParams.get("state")).toBe(base.state);
  });

  it("asks for offline, without which the connection dies in an hour", () => {
    const url = new URL(buildAuthorizeUrl(base));
    expect(url.searchParams.get("scope")?.split(" ")).toContain("offline");
    expect(WHOOP_SCOPES).toContain("read:recovery");
  });

  it("refuses a state WHOOP would reject", () => {
    expect(() => buildAuthorizeUrl({ ...base, state: "short" })).toThrow(/eight characters/);
  });
});

/* ─── Tokens ──────────────────────────────────────────────────────────── */

describe("exchangeCodeForTokens", () => {
  it("posts form-encoded credentials and turns expires_in into an instant", async () => {
    let seenBody = "";
    let seenType = "";
    const now = new Date("2026-09-24T12:00:00.000Z");

    const tokens = await exchangeCodeForTokens({
      code: "the-code",
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "https://reserve.test/cb",
      now,
      fetcher: (async (_url: string, init: RequestInit) => {
        seenBody = String(init.body);
        seenType = new Headers(init.headers).get("Content-Type") ?? "";
        return new Response(
          JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "read:recovery offline" }),
          { status: 200 },
        );
      }) as unknown as typeof fetch,
    });

    expect(seenType).toBe("application/x-www-form-urlencoded");
    expect(seenBody).toContain("grant_type=authorization_code");
    expect(seenBody).toContain("code=the-code");
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
    expect(tokens.expiresAt).toBe("2026-09-24T13:00:00.000Z");
    expect(tokens.grantedScopes).toEqual(["read:recovery", "offline"]);
  });

  it("does not put the client secret in the thrown message", async () => {
    await expect(
      exchangeCodeForTokens({
        code: "c",
        clientId: "id",
        clientSecret: "super-secret-value",
        redirectUri: "https://reserve.test/cb",
        fetcher: (async () => new Response("client_secret=super-secret-value", { status: 401 })) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/^(?!.*super-secret-value).*$/);
  });
});

describe("tokenNeedsRefresh", () => {
  const now = new Date("2026-09-24T12:00:00.000Z");

  it("is false while the token has real life left", () => {
    expect(tokenNeedsRefresh("2026-09-24T12:30:00.000Z", now)).toBe(false);
  });

  it("is true inside the safety margin, before the token actually expires", () => {
    expect(tokenNeedsRefresh("2026-09-24T12:01:00.000Z", now)).toBe(true);
  });

  it("treats an unreadable expiry as spent rather than assuming it is fine", () => {
    expect(tokenNeedsRefresh("not-a-date", now)).toBe(true);
  });
});

/* ─── Paging ──────────────────────────────────────────────────────────── */

describe("readCollection", () => {
  const page = (records: unknown[], next?: string) =>
    new Response(JSON.stringify({ records, next_token: next ?? null }), { status: 200 });

  const recovery = (sleepId: string): unknown => ({
    cycle_id: 1,
    sleep_id: sleepId,
    created_at: "2026-09-23T10:00:00.000Z",
    updated_at: "2026-09-23T10:00:00.000Z",
    score_state: "SCORED",
    score: { recovery_score: 71, resting_heart_rate: 48, hrv_rmssd_milli: 92.4 },
  });

  it("follows next_token to the end", async () => {
    const urls: string[] = [];
    const result = await readCollection("recovery", {
      accessToken: "at",
      fetcher: (async (url: string) => {
        urls.push(url);
        return urls.length === 1 ? page([recovery("a")], "TOKEN-2") : page([recovery("b")]);
      }) as unknown as typeof fetch,
    });

    expect(result.records).toHaveLength(2);
    expect(result.truncated).toBe(false);
    expect(urls[1]).toContain("nextToken=TOKEN-2");
  });

  it("reports truncation instead of looping forever", async () => {
    const result = await readCollection("recovery", {
      accessToken: "at",
      maxPages: 2,
      fetcher: (async () => page([recovery("a")], "ALWAYS-MORE")) as unknown as typeof fetch,
    });

    expect(result.truncated).toBe(true);
    expect(result.records).toHaveLength(2);
  });

  it("skips a record it cannot read rather than guessing at it", async () => {
    const result = await readCollection("recovery", {
      accessToken: "at",
      fetcher: (async () => page([recovery("a"), { nonsense: true }])) as unknown as typeof fetch,
    });
    expect(result.records).toHaveLength(1);
  });

  it("raises the status when WHOOP refuses", async () => {
    await expect(
      readCollection("recovery", {
        accessToken: "at",
        fetcher: (async () => new Response("", { status: 401 })) as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

/* ─── Translation ─────────────────────────────────────────────────────── */

const scoredRecovery: WhoopRecovery = {
  cycle_id: 93845,
  sleep_id: "ec5b1a0f-1111-4222-8333-444455556666",
  created_at: "2026-09-23T10:00:00.000Z",
  updated_at: "2026-09-23T11:00:00.000Z",
  score_state: "SCORED",
  score: {
    user_calibrating: false,
    recovery_score: 71,
    resting_heart_rate: 48,
    hrv_rmssd_milli: 92.4,
    spo2_percentage: 96.5,
    skin_temp_celsius: 33.1,
  },
};

const scoredSleep: WhoopSleep = {
  id: "aaaa1111-2222-4333-8444-555566667777",
  created_at: "2026-09-23T06:00:00.000Z",
  updated_at: "2026-09-23T06:30:00.000Z",
  start: "2026-09-22T22:00:00.000Z",
  end: "2026-09-23T06:00:00.000Z",
  nap: false,
  score_state: "SCORED",
  score: {
    stage_summary: {
      total_in_bed_time_milli: 28_800_000, // 8h
      total_awake_time_milli: 1_800_000, // 30m
      total_rem_sleep_time_milli: 5_400_000,
      total_slow_wave_sleep_time_milli: 5_400_000,
      disturbance_count: 4,
    },
    respiratory_rate: 14.2,
    sleep_performance_percentage: 88,
  },
};

describe("toObservations", () => {
  it("carries a WHOOP score as a vendor score, never as a Reserve number", () => {
    const observations = toObservations("athlete-1", { recovery: [scoredRecovery] });
    const score = observations.find((o) => o.dedupeKey.endsWith(":score"));

    expect(score?.measurementType).toBe("vendor-score");
    expect(score?.metadata.vendorScoreKey).toBe("whoop:recovery");
    expect(score?.value).toBe(71);
  });

  it("keeps a measured reading measured", () => {
    const observations = toObservations("athlete-1", { recovery: [scoredRecovery] });
    const hrv = observations.find((o) => o.category === "hrv");
    const rhr = observations.find((o) => o.category === "resting-heart-rate");

    expect(hrv?.measurementType).toBe("measured");
    expect(hrv?.unit).toBe("ms");
    expect(rhr?.measurementType).toBe("measured");
    expect(rhr?.value).toBe(48);
  });

  it("marks a heart-rate-derived burn as an estimate, not a measurement", () => {
    const observations = toObservations("athlete-1", {
      cycle: [
        {
          id: 555,
          created_at: "2026-09-23T00:00:00.000Z",
          updated_at: "2026-09-23T00:00:00.000Z",
          start: "2026-09-23T00:00:00.000Z",
          end: null,
          score_state: "SCORED",
          score: { strain: 12.4, kilojoule: 8000, average_heart_rate: 62, max_heart_rate: 171 },
        },
      ],
    });

    expect(observations.find((o) => o.category === "active-energy")?.measurementType).toBe("device-estimated");
    const strain = observations.find((o) => o.metadata.vendorScoreKey === "whoop:strain");
    expect(strain?.measurementType).toBe("vendor-score");
    expect(strain?.value).toBe(12.4);
  });

  it("reports time asleep, not time in bed", () => {
    const observations = toObservations("athlete-1", { sleep: [scoredSleep] });
    const sleep = observations.find((o) => o.category === "sleep");

    // 8h in bed less 30m awake.
    expect(sleep?.value).toBe(450);
    expect(sleep?.unit).toBe("min");
    expect(sleep?.metadata.inBedMinutes).toBe(480);
  });

  it("drops a record WHOOP has not scored, rather than inventing a zero", () => {
    const pending: WhoopRecovery = { ...scoredRecovery, score_state: "PENDING_SCORE", score: null };
    expect(toObservations("athlete-1", { recovery: [pending] })).toHaveLength(0);
  });

  it("gives the same reading the same dedupe key across syncs, so a revision replaces it", () => {
    const first = toObservations("athlete-1", { recovery: [scoredRecovery] }, { importedAt: "2026-09-23T12:00:00.000Z" });
    const revised = toObservations(
      "athlete-1",
      { recovery: [{ ...scoredRecovery, score: { ...scoredRecovery.score!, recovery_score: 64 } }] },
      { importedAt: "2026-09-24T12:00:00.000Z" },
    );

    const before = first.find((o) => o.dedupeKey.endsWith(":score"));
    const after = revised.find((o) => o.dedupeKey.endsWith(":score"));

    expect(after?.dedupeKey).toBe(before?.dedupeKey);
    expect(after?.value).toBe(64);
  });

  it("pins a reading to the night it came from, not to when WHOOP last revised it", () => {
    const revised: WhoopRecovery = { ...scoredRecovery, updated_at: "2026-09-26T09:00:00.000Z" };
    const observations = toObservations("athlete-1", { recovery: [revised] });
    expect(observations.every((o) => o.observedAt === scoredRecovery.created_at)).toBe(true);
  });

  it("records the scope each value arrived under", () => {
    const observations = toObservations("athlete-1", { recovery: [scoredRecovery], sleep: [scoredSleep] });
    expect(observations.find((o) => o.category === "hrv")?.permissionScope).toBe("read:recovery");
    expect(observations.find((o) => o.category === "sleep")?.permissionScope).toBe("read:sleep");
  });
});

/* ─── The sync window ─────────────────────────────────────────────────── */

describe("syncWindow", () => {
  const now = new Date("2026-09-24T12:00:00.000Z");

  it("takes a bounded slice of history on a first connection", () => {
    const { start, end } = syncWindow(null, now, 30);
    expect(start).toBe("2026-08-25T12:00:00.000Z");
    expect(end).toBe(now.toISOString());
  });

  it("overlaps the previous window, because WHOOP revises records after the fact", () => {
    const { start } = syncWindow("2026-09-24T06:00:00.000Z", now, 30, 36);
    expect(Date.parse(start)).toBeLessThan(Date.parse("2026-09-24T06:00:00.000Z"));
  });

  it("falls back to full history when the stored mark is unreadable", () => {
    expect(syncWindow("nonsense", now, 30).start).toBe("2026-08-25T12:00:00.000Z");
  });
});

/* ─── Separation of vendor scores ─────────────────────────────────────── */

describe("vendor score separation", () => {
  it("keeps WHOOP Strain on its own scale", () => {
    expect(VENDOR_SCORE_SCALES["whoop:strain"].max).toBe(21);
    expect(VENDOR_SCORE_SCALES["whoop:recovery"].max).toBe(100);
  });

  it("never makes a WHOOP score comparable to Reserve Readiness", () => {
    expect(scoresAreComparable("whoop:recovery", "reserve:readiness")).toBe(false);
    expect(scoresAreComparable("whoop:recovery", "whoop:strain")).toBe(false);
  });
});

describe("connectionAvailability for a cloud provider", () => {
  it("stays unavailable until the deployment is known to be configured", () => {
    expect(connectionAvailability("whoop").available).toBe(false);
    expect(connectionAvailability("whoop", { configuredCloudProviders: [] }).available).toBe(false);
  });

  it("becomes available only for the provider the server reported", () => {
    expect(connectionAvailability("whoop", { configuredCloudProviders: ["whoop"] }).available).toBe(true);
    expect(connectionAvailability("oura", { configuredCloudProviders: ["whoop"] }).available).toBe(false);
  });

  it("never turns a native-bridge provider on, whatever it is told", () => {
    expect(connectionAvailability("apple-health", { configuredCloudProviders: ["apple-health"] }).available).toBe(false);
  });
});
