import { describe, expect, it } from "vitest";

import { selectArchitecture } from "../architecture-select";
import { architectureFingerprint, type RecoveryDemand } from "../architecture-profile";
import { getProtocol, type ProtocolRecoInput } from "@/lib/protocol/library";

const DEMAND_RANK: Record<RecoveryDemand, number> = { low: 0, moderate: 1, high: 2 };

/** A complete synthetic athlete. Only the fields selection reads. */
function athlete(over: Partial<ProtocolRecoInput> & Pick<ProtocolRecoInput, "goal">): ProtocolRecoInput {
  return {
    daysToDeadline: null,
    gymEnvironment: "commercial-standard",
    trainingLevel: "intermediate",
    hasWeakPoints: false,
    womensPath: false,
    trainingDaysPerWeek: 4,
    sessionDurationMin: 60,
    recoveryCapacity: "moderate",
    occupationLoad: "sedentary",
    ...over,
  };
}

/* ─── Ten clearly-different athletes must not converge ─────────────────── */

const SYNTHETIC: Record<string, ProtocolRecoInput> = {
  advancedHypertrophy: athlete({
    goal: "build maximum muscle size and mass", trainingLevel: "advanced",
    gymEnvironment: "luxury-premium", trainingDaysPerWeek: 6, sessionDurationMin: 75,
    recoveryCapacity: "high", occupationLoad: "sedentary",
  }),
  beginnerFatLoss: athlete({
    goal: "lose fat and get lean", trainingLevel: "beginner",
    gymEnvironment: "commercial-standard", trainingDaysPerWeek: 3, sessionDurationMin: 45,
    recoveryCapacity: "moderate",
  }),
  tactical: athlete({
    goal: "tactical athletic performance, conditioning and work capacity", trainingLevel: "advanced",
    gymEnvironment: "commercial-performance", trainingDaysPerWeek: 5, sessionDurationMin: 60,
    recoveryCapacity: "high", occupationLoad: "physical",
  }),
  powerbuilding: athlete({
    goal: "build strength and size, powerbuilding", trainingLevel: "advanced",
    gymEnvironment: "commercial-performance", trainingDaysPerWeek: 4, sessionDurationMin: 75,
    recoveryCapacity: "high",
  }),
  busyExecutive: athlete({
    goal: "stay lean and healthy with a busy schedule", trainingLevel: "intermediate",
    gymEnvironment: "commercial-standard", trainingDaysPerWeek: 3, sessionDurationMin: 40,
    recoveryCapacity: "moderate", occupationLoad: "sedentary",
  }),
  homeGym: athlete({
    goal: "build muscle training at home", trainingLevel: "intermediate",
    gymEnvironment: "dumbbell-home", trainingDaysPerWeek: 4, sessionDurationMin: 50,
    recoveryCapacity: "moderate",
  }),
  commercialBodybuilder: athlete({
    goal: "classic physique proportion and symmetry", trainingLevel: "advanced",
    gymEnvironment: "commercial-performance", trainingDaysPerWeek: 5, sessionDurationMin: 70,
    recoveryCapacity: "high", hasWeakPoints: true, weakPointFocus: true,
  }),
  femalePostpartum: athlete({
    goal: "return to training and rebuild strength gently", trainingLevel: "beginner",
    gymEnvironment: "commercial-standard", trainingDaysPerWeek: 3, sessionDurationMin: 40,
    recoveryCapacity: "low", occupationLoad: "physical", womensPath: true,
  }),
  masters: athlete({
    goal: "stay strong and healthy for the long term", trainingLevel: "intermediate",
    gymEnvironment: "commercial-standard", trainingDaysPerWeek: 4, sessionDurationMin: 50,
    recoveryCapacity: "low", injuryRegions: ["knee", "shoulder"],
  }),
  weakPointSpecialist: athlete({
    goal: "bring up weak points and refine classic proportion", trainingLevel: "advanced",
    gymEnvironment: "luxury-premium", trainingDaysPerWeek: 5, sessionDurationMin: 70,
    recoveryCapacity: "high", hasWeakPoints: true, weakPointFocus: true,
  }),
};

describe("architecture selection — synthetic athletes diverge", () => {
  const chosen = Object.fromEntries(
    Object.entries(SYNTHETIC).map(([k, v]) => [k, selectArchitecture(v).chosen.id]),
  );

  it("spreads across the library rather than converging", () => {
    const ids = Object.values(chosen);
    const distinct = new Set(ids);
    expect(distinct.size).toBeGreaterThanOrEqual(6);
    const counts = ids.reduce<Record<string, number>>((m, id) => ((m[id] = (m[id] ?? 0) + 1), m), {});
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(3);
  });

  it("never selects a chest/back generic default — every pick is a real library architecture", () => {
    for (const [, id] of Object.entries(chosen)) {
      expect(getProtocol(id)).toBeTruthy();
      expect(id).not.toBe("reserve-physique"); // the chest/back default lives only in the fallback path
    }
  });

  it("routes the home-gym athlete to a home-runnable architecture", () => {
    const fit = getProtocol(chosen.homeGym)!.gymFit;
    expect(["home", "any"]).toContain(fit);
  });

  it("routes the female member to a women's-performance architecture", () => {
    expect(getProtocol(chosen.femalePostpartum)!.category).toBe("womens-performance");
  });

  it("gives the weak-point specialist a specialization-capable architecture", () => {
    const fp = architectureFingerprint(getProtocol(chosen.weakPointSpecialist)!);
    expect(fp.weakPointCapable).toBe(true);
  });

  it("the 6-day advanced athlete and the 3-day executive get different architectures", () => {
    expect(chosen.advancedHypertrophy).not.toBe(chosen.busyExecutive);
  });
});

/* ─── Isolated capacity levers ────────────────────────────────────────── */

describe("capacity drives selection", () => {
  it("recovery capacity is monotonic with the chosen architecture's recovery demand", () => {
    const base = athlete({ goal: "build muscle and size", trainingLevel: "advanced", trainingDaysPerWeek: 5, gymEnvironment: "commercial-performance" });
    const high = selectArchitecture({ ...base, recoveryCapacity: "high", occupationLoad: "sedentary" });
    const low = selectArchitecture({ ...base, recoveryCapacity: "low", occupationLoad: "physical" });
    expect(DEMAND_RANK[low.fingerprint.recoveryDemand]).toBeLessThanOrEqual(DEMAND_RANK[high.fingerprint.recoveryDemand]);
  });

  it("weak-point focus flips selection to a specialization-capable architecture", () => {
    const base = athlete({ goal: "classic physique proportion", trainingLevel: "advanced", trainingDaysPerWeek: 5, gymEnvironment: "commercial-performance" });
    const withFocus = selectArchitecture({ ...base, hasWeakPoints: true, weakPointFocus: true });
    expect(withFocus.fingerprint.weakPointCapable).toBe(true);
  });

  it("a short session window avoids long-session architectures", () => {
    const base = athlete({ goal: "build muscle", trainingLevel: "advanced", trainingDaysPerWeek: 4 });
    const short = selectArchitecture({ ...base, sessionDurationMin: 35 });
    expect(short.fingerprint.sessionLoad).not.toBe("long");
  });

  it("training frequency selects a compatible architecture at both extremes", () => {
    const base = athlete({ goal: "build muscle and size", trainingLevel: "advanced", gymEnvironment: "commercial-performance", recoveryCapacity: "high" });
    const threeDay = selectArchitecture({ ...base, trainingDaysPerWeek: 3 });
    const sixDay = selectArchitecture({ ...base, trainingDaysPerWeek: 6 });
    expect(threeDay.fingerprint.idealFrequency.min).toBeLessThanOrEqual(4);
    expect(sixDay.fingerprint.idealFrequency.max).toBeGreaterThanOrEqual(5);
    expect(threeDay.chosen.id).not.toBe(sixDay.chosen.id);
  });

  it("exposes an explainable rationale with drivers and rejected alternatives", () => {
    const sel = selectArchitecture(SYNTHETIC.advancedHypertrophy);
    expect(sel.drivers.length).toBeGreaterThan(0);
    expect(sel.rejected.length).toBeGreaterThan(0);
    expect(sel.rejected[0].reason.length).toBeGreaterThan(0);
    expect(sel.rationale).toContain(sel.chosen.name);
  });
});
