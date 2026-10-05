import { describe, expect, it } from "vitest";

import {
  HEALTH_PROVIDERS,
  NATIVE_BRIDGE_CONTRACTS,
  PROVIDER_TRANSPORT,
  connectionAvailability,
  isSynthetic,
  preferredObservation,
  scoresAreComparable,
  sourceIsReadable,
  syntheticObservation,
  syntheticSource,
  vendorScoreKey,
  type ConnectedHealthObservation,
  type HealthSourceStatus,
} from "../health-sources";

/* ═══ Honesty about what can connect ═════════════════════════════════════ */

describe("connection availability", () => {
  // No host argument means a browser, which is what the web build is.
  it("refuses to claim a browser can reach HealthKit", () => {
    const apple = connectionAvailability("apple-health");
    expect(apple.available).toBe(false);
    expect(apple.reason).toMatch(/browser/i);
    expect(apple.reason).toMatch(/Reserve app/i);
  });

  it("refuses to claim a browser can reach Health Connect", () => {
    const android = connectionAvailability("health-connect");
    expect(android.available).toBe(false);
    expect(android.reason).toMatch(/browser/i);
    expect(android.reason).toMatch(/Reserve app/i);
  });

  it("marks cloud providers unavailable while credentials are absent", () => {
    for (const p of ["whoop", "oura", "garmin"] as const) {
      const a = connectionAvailability(p);
      expect(a.available).toBe(false);
      expect(a.reason).toMatch(/OAuth|credentials/i);
    }
  });

  it("allows manual entry, which needs no integration", () => {
    expect(connectionAvailability("manual").available).toBe(true);
  });

  it("gives every provider a transport and a reason", () => {
    for (const p of HEALTH_PROVIDERS) {
      expect(PROVIDER_TRANSPORT[p]).toBeTruthy();
      expect(connectionAvailability(p).reason.length).toBeGreaterThan(0);
    }
  });

  it("offers Apple Health only inside the iOS app", () => {
    const inApp = connectionAvailability("apple-health", { host: { platform: "ios" } });
    expect(inApp.available).toBe(true);
    expect(inApp.reason).toMatch(/permission/i);
  });

  it("offers Health Connect only inside the Android app", () => {
    const inApp = connectionAvailability("health-connect", { host: { platform: "android" } });
    expect(inApp.available).toBe(true);
    expect(inApp.reason).toMatch(/permission/i);
  });

  it("never offers a provider on the platform it cannot exist on", () => {
    // HealthKit has no Android build, and Health Connect has no iOS build.
    // Offering either across platforms would be a control that cannot work.
    const appleOnAndroid = connectionAvailability("apple-health", { host: { platform: "android" } });
    expect(appleOnAndroid.available).toBe(false);
    expect(appleOnAndroid.reason).toMatch(/iPhone/i);

    const connectOnIos = connectionAvailability("health-connect", { host: { platform: "ios" } });
    expect(connectOnIos.available).toBe(false);
    expect(connectOnIos.reason).toMatch(/Android/i);
  });

  it("documents native bridges as explicitly not implemented", () => {
    expect(NATIVE_BRIDGE_CONTRACTS).toHaveLength(2);
    for (const c of NATIVE_BRIDGE_CONTRACTS) {
      expect(c.notImplemented).toBe(true);
    }
  });
});

/* ═══ Vendor score separation ════════════════════════════════════════════ */

describe("vendor scores stay vendor-specific", () => {
  it("keys a score by vendor and name", () => {
    expect(vendorScoreKey("whoop", "recovery")).toBe("whoop:recovery");
    expect(vendorScoreKey("oura", "readiness")).toBe("oura:readiness");
    expect(vendorScoreKey("garmin", "body-battery")).toBe("garmin:body-battery");
  });

  it("returns null for a score a vendor does not publish", () => {
    expect(vendorScoreKey("whoop", "readiness")).toBeNull();
    expect(vendorScoreKey("manual", "recovery")).toBeNull();
  });

  it("never treats two different vendor scores as the same measurement", () => {
    expect(scoresAreComparable("whoop:recovery", "oura:readiness")).toBe(false);
    expect(scoresAreComparable("garmin:body-battery", "reserve:readiness")).toBe(false);
    expect(scoresAreComparable("oura:readiness", "reserve:readiness")).toBe(false);
  });

  it("compares a score only with itself", () => {
    expect(scoresAreComparable("whoop:recovery", "whoop:recovery")).toBe(true);
  });
});

/* ═══ Provenance and precedence ══════════════════════════════════════════ */

describe("observation precedence", () => {
  const athleteId = "athlete-1";

  function obs(over: Partial<ConnectedHealthObservation>): ConnectedHealthObservation {
    return syntheticObservation("whoop", athleteId, over);
  }

  it("prefers a measured value over a vendor score", () => {
    const sources = [syntheticSource("whoop", athleteId), syntheticSource("oura", athleteId)];
    const best = preferredObservation(
      [
        obs({ id: "a", provider: "whoop", measurementType: "vendor-score", value: 80 }),
        obs({ id: "b", provider: "oura", measurementType: "measured", value: 61 }),
      ],
      sources,
    );
    expect(best?.id).toBe("b");
  });

  it("prefers an athlete-reported value over a device estimate", () => {
    const sources = [syntheticSource("manual", athleteId), syntheticSource("garmin", athleteId)];
    const best = preferredObservation(
      [
        obs({ id: "a", provider: "garmin", measurementType: "device-estimated" }),
        obs({ id: "b", provider: "manual", measurementType: "athlete-reported" }),
      ],
      sources,
    );
    expect(best?.id).toBe("b");
  });

  it("ignores observations from a source that is not readable", () => {
    const sources = [
      syntheticSource("whoop", athleteId, { status: "paused" }),
      syntheticSource("oura", athleteId),
    ];
    const best = preferredObservation(
      [
        obs({ id: "a", provider: "whoop", measurementType: "measured" }),
        obs({ id: "b", provider: "oura", measurementType: "vendor-score" }),
      ],
      sources,
    );
    expect(best?.id).toBe("b");
  });

  it("returns null when no source is readable", () => {
    const sources = [syntheticSource("whoop", athleteId, { status: "expired" })];
    expect(preferredObservation([obs({ id: "a", provider: "whoop" })], sources)).toBeNull();
  });

  it("breaks a tie on the athlete's configured priority", () => {
    const sources = [
      syntheticSource("whoop", athleteId, { sourcePriority: { hrv: 1 } }),
      syntheticSource("oura", athleteId, { sourcePriority: { hrv: 9 } }),
    ];
    const best = preferredObservation(
      [
        obs({ id: "a", provider: "whoop", measurementType: "measured" }),
        obs({ id: "b", provider: "oura", measurementType: "measured" }),
      ],
      sources,
    );
    expect(best?.id).toBe("b");
  });

  it("keeps provenance on every observation", () => {
    const o = syntheticObservation("oura", athleteId, { sourceDevice: "Oura Ring Gen3" });
    expect(o.provider).toBe("oura");
    expect(o.measurementType).toBeTruthy();
    expect(o.permissionScope).toBeTruthy();
    expect(o.importedAt).toBeTruthy();
    expect(o.sourceDevice).toBe("Oura Ring Gen3");
  });
});

/* ═══ Source states ══════════════════════════════════════════════════════ */

describe("source states", () => {
  it("reads only connected and permission-limited sources", () => {
    const states: HealthSourceStatus[] = [
      "not-connected",
      "connecting",
      "connected",
      "paused",
      "permission-limited",
      "expired",
      "error",
    ];
    const readable = states.filter((status) =>
      sourceIsReadable(syntheticSource("whoop", "a", { status })),
    );
    expect(readable).toEqual(["connected", "permission-limited"]);
  });
});

/* ═══ Synthetic labelling ════════════════════════════════════════════════ */

describe("synthetic data is unmistakable", () => {
  it("flags a synthetic source", () => {
    expect(isSynthetic(syntheticSource("whoop", "a"))).toBe(true);
  });

  it("flags a synthetic observation", () => {
    expect(isSynthetic(syntheticObservation("whoop", "a"))).toBe(true);
  });

  it("carries the development-only notice in observation metadata", () => {
    expect(syntheticObservation("oura", "a").metadata.notice).toMatch(/not a real device/i);
  });

  it("does not flag a record that is genuinely not synthetic", () => {
    const real = { ...syntheticSource("whoop", "a"), id: "src-real", synthetic: false };
    expect(isSynthetic(real)).toBe(false);
  });
});
