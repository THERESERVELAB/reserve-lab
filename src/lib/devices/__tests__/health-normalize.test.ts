import { describe, expect, it } from "vitest";

import {
  RESERVE_HEALTH_VARIABLES,
  VARIABLE_SPEC,
  normalizeReadings,
  parseNativeResults,
  type HealthReading,
} from "../health-normalize";

/* The native result shape comes from a binary library, so these tests pin
   the behaviour Reserve guarantees REGARDLESS of that shape: a reading it
   cannot understand is dropped and counted, never guessed. */

const IMPORTED_AT = "2026-09-24T18:00:00.000Z";

describe("what Reserve asks the platform for", () => {
  it("asks for no clinical variable it has no surface for", () => {
    // Requesting a permission the product cannot use is a review liability
    // and a thing a member would be right to refuse.
    for (const clinical of ["BLOOD_PRESSURE", "BLOOD_GLUCOSE", "BODY_TEMPERATURE"]) {
      expect(RESERVE_HEALTH_VARIABLES).not.toContain(clinical);
    }
  });

  it("gives every requested variable a category, a unit and a plausible range", () => {
    for (const variable of RESERVE_HEALTH_VARIABLES) {
      const spec = VARIABLE_SPEC[variable];
      expect(spec, variable).toBeTruthy();
      expect(spec.category.length, variable).toBeGreaterThan(0);
      expect(spec.unit.length, variable).toBeGreaterThan(0);
      expect(typeof spec.plausible, variable).toBe("function");
    }
  });

  it("records platform readings as measured, never as a vendor score", () => {
    // Apple and Google publish no readiness number through these APIs, and
    // Reserve Readiness must stay a separate series (health-sources.ts).
    for (const variable of RESERVE_HEALTH_VARIABLES) {
      expect(VARIABLE_SPEC[variable].measurementType, variable).toBe("measured");
    }
  });
});

describe("parsing whatever the native layer returned", () => {
  it("reads a plain array of blocks", () => {
    const raw = JSON.stringify([
      { Value: 8123, StartDate: "2026-09-23T00:00:00Z" },
      { Value: 9004, StartDate: "2026-09-24T00:00:00Z" },
    ]);
    const { readings, discarded } = parseNativeResults(raw, "STEPS");
    expect(readings).toHaveLength(2);
    expect(discarded).toHaveLength(0);
    expect(readings[0].value).toBe(8123);
  });

  it("reads blocks wrapped in an envelope", () => {
    const raw = JSON.stringify({ results: [{ value: 62, startDate: "2026-09-24T06:00:00Z" }] });
    const { readings } = parseNativeResults(raw, "HEART_RATE");
    expect(readings).toHaveLength(1);
    expect(readings[0].value).toBe(62);
  });

  it("does not care about field casing", () => {
    const raw = JSON.stringify([{ VALUE: 71.5, startdate: "2026-09-24T07:00:00Z" }]);
    const { readings } = parseNativeResults(raw, "WEIGHT");
    expect(readings).toHaveLength(1);
    expect(readings[0].value).toBe(71.5);
  });

  it("accepts a numeric string, because native bridges stringify", () => {
    const raw = JSON.stringify([{ value: "420", startDate: "2026-09-24T00:00:00Z" }]);
    const { readings } = parseNativeResults(raw, "SLEEP");
    expect(readings[0].value).toBe(420);
  });

  it("normalizes the timestamp so observedAt can be compared as a string", () => {
    // preferredObservation() picks the newer reading with `>`, which is only
    // meaningful if every observedAt is the same ISO format.
    const raw = JSON.stringify([{ value: 50, startDate: "2026-09-24T06:00:00+02:00" }]);
    const { readings } = parseNativeResults(raw, "HEART_RATE");
    expect(readings[0].observedAt).toBe("2026-09-24T04:00:00.000Z");
  });

  it("keeps the recording device when the platform names one", () => {
    const raw = JSON.stringify([{ value: 55, startDate: "2026-09-24T06:00:00Z", source: "Apple Watch" }]);
    const { readings } = parseNativeResults(raw, "HEART_RATE");
    expect(readings[0].sourceDevice).toBe("Apple Watch");
  });
});

describe("refusing to invent a health number", () => {
  it("drops a block with no readable value", () => {
    const raw = JSON.stringify([{ StartDate: "2026-09-24T00:00:00Z" }]);
    const { readings, discarded } = parseNativeResults(raw, "STEPS");
    expect(readings).toHaveLength(0);
    expect(discarded[0].reason).toBe("no-numeric-value");
  });

  it("drops a block with no readable timestamp", () => {
    const raw = JSON.stringify([{ Value: 8000, StartDate: "not a date" }]);
    const { readings, discarded } = parseNativeResults(raw, "STEPS");
    expect(readings).toHaveLength(0);
    expect(discarded[0].reason).toBe("no-timestamp");
  });

  it("drops a value the platform could not physically report", () => {
    // 4000 bpm means the field moved or the unit changed. Either way Reserve
    // does not know what it is holding.
    const raw = JSON.stringify([{ Value: 4000, StartDate: "2026-09-24T06:00:00Z" }]);
    const { readings, discarded } = parseNativeResults(raw, "HEART_RATE");
    expect(readings).toHaveLength(0);
    expect(discarded[0].reason).toBe("implausible-value");
  });

  it("rejects NaN and Infinity rather than storing them", () => {
    for (const bad of ["NaN", "Infinity"]) {
      const raw = JSON.stringify([{ Value: bad, StartDate: "2026-09-24T06:00:00Z" }]);
      const { readings } = parseNativeResults(raw, "HEART_RATE");
      expect(readings, bad).toHaveLength(0);
    }
  });

  it("survives a completely unrecognised shape without throwing", () => {
    // A native library version bump must degrade to "no data", never to a
    // crash inside a member's app.
    for (const raw of ["not json at all", "42", '"a string"', "null", "{}"]) {
      expect(() => parseNativeResults(raw, "STEPS")).not.toThrow();
      expect(parseNativeResults(raw, "STEPS").readings).toHaveLength(0);
    }
  });

  it("reports an empty result as empty, not as a failure", () => {
    for (const raw of ["", "  ", "[]", undefined, null]) {
      const { readings, discarded } = parseNativeResults(raw, "STEPS");
      expect(readings).toHaveLength(0);
      expect(discarded).toHaveLength(0);
    }
  });

  it("keeps the good blocks and drops only the bad ones", () => {
    const raw = JSON.stringify([
      { Value: 8000, StartDate: "2026-09-23T00:00:00Z" },
      { Value: "nonsense", StartDate: "2026-09-24T00:00:00Z" },
      { Value: 9000, StartDate: "2026-09-25T00:00:00Z" },
    ]);
    const { readings, discarded } = parseNativeResults(raw, "STEPS");
    expect(readings).toHaveLength(2);
    expect(discarded).toHaveLength(1);
  });
});

describe("readings become observations", () => {
  const reading: HealthReading = {
    variable: "SLEEP",
    value: 431,
    observedAt: "2026-09-24T05:30:00.000Z",
    sourceDevice: "Apple Watch",
  };

  it("produces a complete observation that satisfies the contract", () => {
    const { observations } = normalizeReadings([reading], {
      provider: "apple-health",
      athleteId: "athlete-1",
      importedAt: IMPORTED_AT,
    });

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      athleteId: "athlete-1",
      provider: "apple-health",
      category: "sleep",
      measurementType: "measured",
      value: 431,
      unit: "min",
      observedAt: "2026-09-24T05:30:00.000Z",
      importedAt: IMPORTED_AT,
      sourceDevice: "Apple Watch",
    });
  });

  it("gives the same measurement the same id, so a re-read cannot duplicate it", () => {
    const first = normalizeReadings([reading], {
      provider: "apple-health",
      athleteId: "athlete-1",
      importedAt: IMPORTED_AT,
    });
    const second = normalizeReadings([reading], {
      provider: "apple-health",
      athleteId: "athlete-1",
      importedAt: "2026-09-25T09:00:00.000Z",
    });
    expect(first.observations[0].id).toBe(second.observations[0].id);
  });

  it("keeps the two platforms apart", () => {
    const apple = normalizeReadings([reading], {
      provider: "apple-health",
      athleteId: "a",
      importedAt: IMPORTED_AT,
    });
    const android = normalizeReadings([reading], {
      provider: "health-connect",
      athleteId: "a",
      importedAt: IMPORTED_AT,
    });
    expect(apple.observations[0].id).not.toBe(android.observations[0].id);
    expect(android.observations[0].provider).toBe("health-connect");
  });

  it("never marks a platform reading as synthetic", () => {
    const { observations } = normalizeReadings([reading], {
      provider: "apple-health",
      athleteId: "a",
      importedAt: IMPORTED_AT,
    });
    expect(observations[0].metadata.synthetic).toBeUndefined();
    expect(observations[0].id.startsWith("synthetic-")).toBe(false);
  });
});
