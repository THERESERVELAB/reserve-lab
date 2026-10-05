import { describe, expect, it } from "vitest";

import type { EquipmentKind } from "@/lib/training/session-movement";
import {
  OLYMPIC_BAR_LB,
  classifyPattern,
  estimateStartingLoad,
  repsFromTargetRange,
  type LoadProfile,
} from "@/lib/training/load-estimator";

const ADVANCED_MALE: LoadProfile = {
  bodyweightLb: 190,
  heightIn: 70,
  sex: "male",
  experience: "advanced",
};

const bb = (name: string, targetMuscle: string, reps = "8-10") =>
  ({ name, targetMuscle, equipment: "Olympic Barbell", equipmentKind: "barbell" as const, reps });
const db = (name: string, targetMuscle: string, reps = "10-12") =>
  ({ name, targetMuscle, equipment: "Dumbbells", equipmentKind: "dumbbell" as const, reps });
const mach = (name: string, targetMuscle: string, reps = "10-12") =>
  ({ name, targetMuscle, equipment: "Machine", equipmentKind: "machine" as const, reps });

describe("classifyPattern", () => {
  it("reads the common barbell lifts", () => {
    expect(classifyPattern({ name: "Back Squat", targetMuscle: "Quads" })).toBe("squat");
    expect(classifyPattern({ name: "Romanian Deadlift", targetMuscle: "Hamstrings" })).toBe("hinge");
    expect(classifyPattern({ name: "Low Incline Barbell Press", targetMuscle: "Upper Chest" })).toBe("incline-press");
    expect(classifyPattern({ name: "Barbell Overhead Press", targetMuscle: "Front Delts" })).toBe("overhead-press");
    expect(classifyPattern({ name: "Bench Press", targetMuscle: "Mid Chest" })).toBe("horizontal-press");
    expect(classifyPattern({ name: "Chest-Supported T-Bar Row", targetMuscle: "Mid Back" })).toBe("row");
  });

  it("separates leg machines that look alike", () => {
    expect(classifyPattern({ name: "Leg Press", targetMuscle: "Quads" })).toBe("leg-press");
    expect(classifyPattern({ name: "Hack Squat", targetMuscle: "Quads" })).toBe("leg-press");
    expect(classifyPattern({ name: "Seated Leg Curl", targetMuscle: "Hamstrings" })).toBe("leg-curl");
    expect(classifyPattern({ name: "Leg Extension", targetMuscle: "Quads" })).toBe("leg-extension");
  });

  it("does not read a leg curl as a biceps curl", () => {
    expect(classifyPattern({ name: "Lying Leg Curl", targetMuscle: "Hamstrings" })).toBe("leg-curl");
    expect(classifyPattern({ name: "EZ-Bar Curl", targetMuscle: "Biceps" })).toBe("biceps");
  });

  it("treats bodyweight and assisted work as loadless", () => {
    expect(classifyPattern({ name: "Push-Up", targetMuscle: "Chest" })).toBe("loadless");
    expect(classifyPattern({ name: "Assisted Pull-Up", targetMuscle: "Lats" })).toBe("loadless");
    expect(classifyPattern({ name: "Plank", targetMuscle: "Core" })).toBe("loadless");
    expect(classifyPattern({ name: "Hanging Leg Raise", targetMuscle: "Abs" })).toBe("loadless");
  });

  it("does not read a loaded lunge as cardio just because it says walk", () => {
    /* "Walking Lunge" contains "walk", which put a dumbbell lunge in the
       conditioning bucket and left it with no load to estimate. */
    expect(classifyPattern({ name: "Walking Lunge", targetMuscle: "Quads" })).toBe("lunge");
    expect(classifyPattern({ name: "Dumbbell Walking Lunge", targetMuscle: "Quads" })).toBe("lunge");
    expect(classifyPattern({ name: "Farmer Carry", targetMuscle: "Traps" })).toBe("carry");
  });

  it("still treats real ambulatory conditioning as loadless", () => {
    for (const name of ["Incline Treadmill Walk", "Sled Push", "Jump Rope", "Zone 2 Bike", "Stair Climber"]) {
      expect(`${name}:${classifyPattern({ name, targetMuscle: "Conditioning" })}`).toBe(`${name}:loadless`);
    }
  });

  it("keeps a weighted pull-up loadable", () => {
    expect(classifyPattern({ name: "Weighted Pull-Up", targetMuscle: "Lats" })).toBe("row");
  });
});

describe("repsFromTargetRange", () => {
  it("takes the midpoint of a range", () => {
    expect(repsFromTargetRange("8-10")).toBe(9);
    expect(repsFromTargetRange("12-15")).toBe(14);
    expect(repsFromTargetRange("15-20")).toBe(18);
  });
  it("reads a single number", () => {
    expect(repsFromTargetRange("12")).toBe(12);
  });
  it("returns null for work that is not rep-based", () => {
    expect(repsFromTargetRange("AMRAP")).toBeNull();
    expect(repsFromTargetRange("45 sec")).toBeNull();
    expect(repsFromTargetRange("6-10 min")).toBeNull();
    expect(repsFromTargetRange(null)).toBeNull();
  });
});

describe("estimateStartingLoad", () => {
  it("returns null with no bodyweight on file — never invents one", () => {
    expect(estimateStartingLoad(bb("Back Squat", "Quads"), { ...ADVANCED_MALE, bodyweightLb: null })).toBeNull();
    expect(estimateStartingLoad(bb("Back Squat", "Quads"), { ...ADVANCED_MALE, bodyweightLb: 0 })).toBeNull();
  });

  it("puts an advanced 190 lb male in a believable range on the main lifts", () => {
    const squat = estimateStartingLoad(bb("Back Squat", "Quads"), ADVANCED_MALE)!;
    const bench = estimateStartingLoad(bb("Bench Press", "Mid Chest"), ADVANCED_MALE)!;
    const rdl = estimateStartingLoad(bb("Romanian Deadlift", "Hamstrings"), ADVANCED_MALE)!;
    const ohp = estimateStartingLoad(bb("Barbell Overhead Press", "Front Delts"), ADVANCED_MALE)!;

    expect(squat.load).toBeGreaterThanOrEqual(205);
    expect(squat.load).toBeLessThanOrEqual(260);
    expect(bench.load).toBeGreaterThanOrEqual(155);
    expect(bench.load).toBeLessThanOrEqual(200);
    expect(rdl.load).toBeGreaterThanOrEqual(230);
    expect(rdl.load).toBeLessThanOrEqual(290);
    expect(ohp.load).toBeGreaterThanOrEqual(90);
    expect(ohp.load).toBeLessThanOrEqual(130);
  });

  it("keeps isolation work light and sane", () => {
    const lateral = estimateStartingLoad(db("Dumbbell Lateral Raise", "Side Delts", "12-15"), ADVANCED_MALE)!;
    const curl = estimateStartingLoad(db("Dumbbell Curl", "Biceps", "10-12"), ADVANCED_MALE)!;
    const legCurl = estimateStartingLoad(mach("Seated Leg Curl", "Hamstrings"), ADVANCED_MALE)!;

    expect(lateral.load).toBeGreaterThanOrEqual(10);
    expect(lateral.load).toBeLessThanOrEqual(30);
    expect(curl.load).toBeGreaterThanOrEqual(20);
    expect(curl.load).toBeLessThanOrEqual(45);
    expect(legCurl.load).toBeGreaterThanOrEqual(55);
    expect(legCurl.load).toBeLessThanOrEqual(110);
  });

  it("scales down by training experience", () => {
    const lift = bb("Bench Press", "Mid Chest");
    const beginner = estimateStartingLoad(lift, { ...ADVANCED_MALE, experience: "beginner" })!;
    const intermediate = estimateStartingLoad(lift, { ...ADVANCED_MALE, experience: "intermediate" })!;
    const advanced = estimateStartingLoad(lift, ADVANCED_MALE)!;

    expect(beginner.load).toBeLessThan(intermediate.load);
    expect(intermediate.load).toBeLessThan(advanced.load);
  });

  it("scales with the member's own bodyweight", () => {
    const lift = bb("Back Squat", "Quads");
    const light = estimateStartingLoad(lift, { ...ADVANCED_MALE, bodyweightLb: 140 })!;
    const heavy = estimateStartingLoad(lift, { ...ADVANCED_MALE, bodyweightLb: 240 })!;
    expect(light.load).toBeLessThan(heavy.load);
  });

  it("gives a taller lifter slightly less on leverage lifts, and the same on isolation", () => {
    const squat = bb("Back Squat", "Quads");
    const short = estimateStartingLoad(squat, { ...ADVANCED_MALE, heightIn: 65 })!;
    const tall = estimateStartingLoad(squat, { ...ADVANCED_MALE, heightIn: 77 })!;
    expect(tall.load).toBeLessThan(short.load);

    const raise = db("Dumbbell Lateral Raise", "Side Delts", "12-15");
    expect(estimateStartingLoad(raise, { ...ADVANCED_MALE, heightIn: 65 })!.load)
      .toBe(estimateStartingLoad(raise, { ...ADVANCED_MALE, heightIn: 77 })!.load);
  });

  it("applies a lower load for a female member without assuming when sex is unstated", () => {
    const lift = bb("Bench Press", "Mid Chest");
    const male = estimateStartingLoad(lift, ADVANCED_MALE)!;
    const female = estimateStartingLoad(lift, { ...ADVANCED_MALE, sex: "female", heightIn: 65 })!;
    const unstated = estimateStartingLoad(lift, { ...ADVANCED_MALE, sex: null, heightIn: 68 })!;

    expect(female.load).toBeLessThan(male.load);
    expect(unstated.load).toBeLessThan(male.load);
    expect(unstated.load).toBeGreaterThan(female.load);
  });

  it("drops load as the rep target climbs", () => {
    const heavy = estimateStartingLoad(bb("Bench Press", "Mid Chest", "4-6"), ADVANCED_MALE)!;
    const moderate = estimateStartingLoad(bb("Bench Press", "Mid Chest", "8-10"), ADVANCED_MALE)!;
    const light = estimateStartingLoad(bb("Bench Press", "Mid Chest", "15-20"), ADVANCED_MALE)!;
    expect(heavy.load).toBeGreaterThan(moderate.load);
    expect(moderate.load).toBeGreaterThan(light.load);
  });

  it("reports dumbbells per hand, well under the barbell total", () => {
    const barbell = estimateStartingLoad(bb("Bench Press", "Mid Chest"), ADVANCED_MALE)!;
    const dumbbell = estimateStartingLoad(
      { name: "Dumbbell Bench Press", targetMuscle: "Mid Chest", equipment: "Dumbbells", equipmentKind: "dumbbell", reps: "8-10" },
      ADVANCED_MALE,
    )!;
    expect(dumbbell.load).toBeLessThan(barbell.load * 0.6);
    expect(dumbbell.load).toBeGreaterThan(barbell.load * 0.3);
  });

  it("never puts a barbell below the empty bar", () => {
    const tiny = estimateStartingLoad(bb("Barbell Overhead Press", "Front Delts", "15-20"), {
      bodyweightLb: 105,
      heightIn: 62,
      sex: "female",
      experience: "beginner",
    })!;
    expect(tiny.load).toBe(OLYMPIC_BAR_LB);
    expect(tiny.barOnly).toBe(true);
  });

  it("says so honestly for bodyweight and timed work instead of printing a number", () => {
    const pullUp = estimateStartingLoad(
      { name: "Assisted Pull-Up", targetMuscle: "Lats", equipment: "Assisted Pull-Up Machine", equipmentKind: "machine", reps: "8-10" },
      ADVANCED_MALE,
    )!;
    expect(pullUp.loadless).toBe(true);
    expect(pullUp.load).toBe(0);

    const conditioning = estimateStartingLoad(
      { name: "Conditioning Finisher", targetMuscle: "Conditioning", equipment: "Bike / Rower / Sled", equipmentKind: "machine", reps: "6-10 min" },
      ADVANCED_MALE,
    )!;
    expect(conditioning.loadless).toBe(true);
  });

  it("rounds to increments a real gym actually has", () => {
    for (const experience of ["beginner", "intermediate", "advanced", "athlete"] as const) {
      for (const bodyweightLb of [120, 155, 190, 225, 270]) {
        const est = estimateStartingLoad(bb("Back Squat", "Quads"), { ...ADVANCED_MALE, bodyweightLb, experience })!;
        expect(est.load % 5).toBe(0);
      }
    }
  });

  it("floors an EZ bar at the EZ bar, not an Olympic bar", () => {
    const ez = estimateStartingLoad(
      { name: "EZ-Bar Curl", targetMuscle: "Biceps", equipment: "EZ Bar", equipmentKind: "barbell", reps: "10-12" },
      { bodyweightLb: 135, heightIn: 64, sex: "female", experience: "intermediate" },
    )!;
    expect(ez.load).toBe(25);
  });

  it("does not read a single-arm cable raise as a two-handed stack", () => {
    const cable = estimateStartingLoad(
      { name: "Cable Lateral Raise", targetMuscle: "Side Delts", equipment: "Cable Stack", equipmentKind: "cable", reps: "12-15" },
      ADVANCED_MALE,
    )!;
    /* A 35 lb pin on a single-arm lateral raise is not a real working set. */
    expect(cable.load).toBeLessThanOrEqual(25);
  });

  /* Tuned reference numbers. A change here should be a deliberate retune, not
     a silent drift — these are what a real member sees on their first session. */
  it("holds the tuned reference session for a 190 lb advanced male", () => {
    const expected: Array<[string, string, EquipmentKind, string, number]> = [
      ["Bench Press", "Mid Chest", "barbell", "8-10", 180],
      ["Back Squat", "Quads", "barbell", "6-8", 250],
      ["Romanian Deadlift", "Hamstrings", "barbell", "8-10", 265],
      ["Chest-Supported T-Bar Row", "Mid Back", "barbell", "8-10", 170],
      ["Lat Pulldown", "Lats", "machine", "10-12", 140],
      ["Leg Press", "Quads", "machine", "10-12", 360],
      ["Seated Leg Curl", "Hamstrings", "machine", "10-12", 75],
      ["Dumbbell Shoulder Press", "Front Delts", "dumbbell", "8-10", 45],
      ["Rope Pushdown", "Triceps", "cable", "12-15", 65],
      ["Pec Deck", "Mid Chest", "machine", "12-15", 70],
    ];
    for (const [name, targetMuscle, equipmentKind, reps, load] of expected) {
      const est = estimateStartingLoad({ name, targetMuscle, equipmentKind, reps }, ADVANCED_MALE)!;
      expect(`${name}=${est.load}`).toBe(`${name}=${load}`);
    }
  });

  it("always labels the number an estimate, never the member's own lift", () => {
    const est = estimateStartingLoad(bb("Back Squat", "Quads"), ADVANCED_MALE)!;
    expect(est.basis.toLowerCase()).toContain("estimate");
    expect(est.basis).toContain("190 lb");
  });
});
