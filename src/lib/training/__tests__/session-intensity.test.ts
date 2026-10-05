import { describe, expect, it } from "vitest";

import {
  EXPERIENCE_SPECS,
  allTemplateMovements,
  applyExperienceScaling,
  getWorkoutTemplateForSplit,
  muscleGroup,
  type TemplateMovement,
  type TrainingExperience,
} from "../workout-templates";

/* Sessions used to run almost flat: one superset for an intermediate member,
   three at the very top, and no set-level intensity anywhere. These cover the
   density pass — more pairing, a named partner, and drop-set / rest-pause
   finishes — without letting it reach a heavy free-weight compound. */

const SPLITS = ["push", "pull", "legs", "chest", "back", "shoulders", "arm day", "upper", "lower"] as const;
const LEVELS: TrainingExperience[] = ["beginner", "intermediate", "advanced", "full-gym-advanced", "athlete"];

function scaled(split: string, experience: TrainingExperience) {
  const base = getWorkoutTemplateForSplit(split);
  if (!base) throw new Error(`no template for ${split}`);
  return applyExperienceScaling(base, experience);
}

function pairs(movements: TemplateMovement[]): Map<string, TemplateMovement[]> {
  const groups = new Map<string, TemplateMovement[]>();
  for (const m of movements) {
    if (!m.superset) continue;
    const g = m.superset.replace(/\d+$/, "");
    groups.set(g, [...(groups.get(g) ?? []), m]);
  }
  return groups;
}

const isHeavyIron = (m: TemplateMovement) =>
  /barbell|trap bar|t-bar/i.test(m.equipment) && (m.role === "primary" || m.role === "secondary");

describe("superset density", () => {
  it("every training level now gets at least one pair on a full split", () => {
    for (const level of LEVELS) {
      const paired = SPLITS.map((s) => pairs(allTemplateMovements(scaled(s, level))).size);
      expect(`${level}:${paired.some((n) => n > 0)}`).toBe(`${level}:true`);
    }
  });

  it("pairs more as the training level climbs", () => {
    const count = (level: TrainingExperience) =>
      SPLITS.reduce((sum, s) => sum + pairs(allTemplateMovements(scaled(s, level))).size, 0);
    expect(count("beginner")).toBeLessThan(count("intermediate"));
    expect(count("intermediate")).toBeLessThan(count("advanced"));
    expect(count("advanced")).toBeLessThanOrEqual(count("athlete"));
  });

  it("never exceeds the level's own cap", () => {
    for (const level of LEVELS) {
      for (const split of SPLITS) {
        const n = pairs(allTemplateMovements(scaled(split, level))).size;
        expect(n).toBeLessThanOrEqual(EXPERIENCE_SPECS[level].maxSupersets);
      }
    }
  });

  it("keeps a first training level on stable machines and cables only", () => {
    for (const split of SPLITS) {
      for (const m of allTemplateMovements(scaled(split, "beginner"))) {
        if (!m.superset) continue;
        expect(`${m.name}:${m.equipment}`).toMatch(/machine|cable|pec deck|pulldown|stack|smith/i);
      }
    }
  });

  it("never supersets a heavy free-weight compound or the primary lead", () => {
    for (const level of LEVELS) {
      for (const split of SPLITS) {
        for (const m of allTemplateMovements(scaled(split, level))) {
          if (!m.superset) continue;
          expect(`${m.name}:heavy=${isHeavyIron(m)}`).toBe(`${m.name}:heavy=false`);
          expect(`${m.name}:${m.phase}`).not.toBe(`${m.name}:primary-output`);
        }
      }
    }
  });

  it("labels both halves of a pair and names each partner", () => {
    for (const level of LEVELS) {
      for (const split of SPLITS) {
        const movements = allTemplateMovements(scaled(split, level));
        for (const [group, members] of pairs(movements)) {
          expect(`${split}/${group}:${members.length}`).toBe(`${split}/${group}:2`);
          const [a, b] = members;
          expect(a.supersetPartner).toBe(b.name);
          expect(b.supersetPartner).toBe(a.name);
        }
      }
    }
  });

  it("never pairs two movements that hit the same tissue outside a pump finish", () => {
    for (const level of LEVELS) {
      for (const split of SPLITS) {
        for (const members of pairs(allTemplateMovements(scaled(split, level))).values()) {
          const [a, b] = members;
          if (a.role === "finisher" && b.role === "finisher") continue;
          /* Compared by GROUP, not label: "Triceps" and "Long-Head Triceps" are
             the same tissue, and pairing them read as complementary. */
          expect(`${a.name}+${b.name}:${muscleGroup(a.targetMuscle)}`)
            .not.toBe(`${a.name}+${b.name}:${muscleGroup(b.targetMuscle)}`);
        }
      }
    }
  });

  it("keeps the delt heads pairable — front, side and rear do different jobs", () => {
    expect(muscleGroup("Side Delts")).not.toBe(muscleGroup("Rear Delts"));
    expect(muscleGroup("Front Delts")).not.toBe(muscleGroup("Side Delts"));
  });

  it("reads triceps and chest variants as one group each", () => {
    expect(muscleGroup("Long-Head Triceps")).toBe(muscleGroup("Triceps"));
    expect(muscleGroup("Upper Chest")).toBe(muscleGroup("Mid Chest"));
  });
});

describe("set-level intensity techniques", () => {
  const techniques = (split: string, level: TrainingExperience) =>
    allTemplateMovements(scaled(split, level)).filter((m) => m.finishingTechnique);

  it("gives no drop sets or rest-pause to a first training level", () => {
    for (const split of SPLITS) expect(techniques(split, "beginner")).toHaveLength(0);
  });

  it("puts real techniques on advanced sessions", () => {
    const total = SPLITS.reduce((sum, s) => sum + techniques(s, "advanced").length, 0);
    expect(total).toBeGreaterThan(0);
  });

  it("stays inside the level's cap", () => {
    for (const level of LEVELS) {
      for (const split of SPLITS) {
        expect(techniques(split, level).length).toBeLessThanOrEqual(EXPERIENCE_SPECS[level].maxIntensityTechniques);
      }
    }
  });

  it("only ever lands on safe machine / cable isolation, never a heavy compound", () => {
    for (const level of LEVELS) {
      for (const split of SPLITS) {
        for (const m of techniques(split, level)) {
          expect(`${m.name}:heavy=${isHeavyIron(m)}`).toBe(`${m.name}:heavy=false`);
          expect(`${m.name}:${m.equipment}`).toMatch(/machine|cable|pec deck|pulldown|stack|smith|leg curl|leg extension/i);
          expect(["volume", "stretch", "finisher"]).toContain(m.role);
          expect(m.sets).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });


  it("never puts a technique on the first half of a superset", () => {
    for (const level of LEVELS) {
      for (const split of SPLITS) {
        for (const m of techniques(split, level)) {
          expect(`${m.name}:${m.superset ?? "solo"}`).not.toMatch(/1$/);
        }
      }
    }
  });

  it("carries a label and an instruction the member can actually follow", () => {
    for (const split of SPLITS) {
      for (const m of techniques(split, "athlete")) {
        expect(m.finishingTechnique!.label.length).toBeGreaterThan(0);
        expect(m.finishingTechnique!.instruction).toMatch(/last set/i);
      }
    }
  });

  it("carries no medical, dosing or guaranteed-outcome language", () => {
    const banned = /\b(dose|dosage|mg\b|cycle|compound|prescrib|diagnos|treat|cure|guarantee|safe to)\b/i;
    for (const level of LEVELS) {
      for (const split of SPLITS) {
        for (const m of techniques(split, level)) {
          expect(`${m.finishingTechnique!.label} ${m.finishingTechnique!.instruction}`).not.toMatch(banned);
        }
      }
    }
  });
});
