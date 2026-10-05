import { describe, expect, it } from "vitest";

import { buildArchitectureResolvedWeek, resolveDailyTrainingContext, type DailyContextInput } from "../daily-context";
import { SPLIT_SYSTEMS, buildSplitRecommendation } from "../split-architect";
import { SPLIT_ARCHITECTURES, arrangeWeekAroundRest, getArchitectureForSystem } from "../split-architectures";
import { PROTOCOL_BLUEPRINTS, getBlueprintForProtocol, resolveWeeklyBlueprint } from "../split-blueprints";
import { RESERVE_WEEK_SPLIT, buildProtocolWeek } from "../weekly-split";
import { ARCHETYPE_TO_SPLIT, WORKOUT_TEMPLATES, allTemplateMovements, splitDayLabel } from "../workout-templates";

/* Members reported that every split showed Chest / Back days. These tests pin
   the week they asked for instead: Push → Pull → Legs → Arms → Upper → Lower,
   wrapped around a rest day the member chooses, and no default that pairs
   chest with back. */

/* Wednesday 16 September 2026, noon. */
const WED = new Date(2026, 8, 16, 12);
const NO_CHEST = { active: false, upperChest: false };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ROTATION = ["Push", "Pull", "Legs", "Arm Day", "Upper", "Lower", "Recovery"];

const BASE: DailyContextInput = {
  now: WED,
  focus: undefined,
  weakPoints: [],
  protocolName: null,
  protocolArchitectureName: "",
  womensActive: false,
};

const titles = (week: Array<{ title: string }>) => week.map((d) => d.title);

/** A day whose identity pairs chest with back. */
function pairsChestWithBack(day: { title: string; archetype?: string; recovery?: boolean }): boolean {
  if (day.recovery) return false;
  if (day.archetype?.startsWith("chest-back")) return true;
  return /\bchest\b/i.test(day.title) && /\bback\b/i.test(day.title);
}

describe("the Push / Pull / Legs / Arms / Upper / Lower rotation", () => {
  it("runs Push → Pull → Legs → Arms → Upper → Lower, then rest", () => {
    expect(titles(SPLIT_ARCHITECTURES.pplula.week)).toEqual(ROTATION);
  });

  it("wraps around a Wednesday rest day: Upper, Lower, Rest, Push, Pull, Legs, Arms", () => {
    const week = buildArchitectureResolvedWeek(SPLIT_ARCHITECTURES.pplula, NO_CHEST, 1, { restDayIndex: 2 });
    expect(week.map((d) => d.day)).toEqual(DAYS);
    expect(titles(week)).toEqual(["Upper", "Lower", "Recovery", "Push", "Pull", "Legs", "Arm Day"]);
    expect(week[2].recovery).toBe(true);
  });

  it("starts on Monday with a Sunday rest day, and on Tuesday with a Monday rest day", () => {
    const sunday = buildArchitectureResolvedWeek(SPLIT_ARCHITECTURES.pplula, NO_CHEST, 1, { restDayIndex: 6 });
    const monday = buildArchitectureResolvedWeek(SPLIT_ARCHITECTURES.pplula, NO_CHEST, 1, { restDayIndex: 0 });
    expect(titles(sunday)).toEqual(ROTATION);
    expect(titles(monday)).toEqual(["Recovery", "Push", "Pull", "Legs", "Arm Day", "Upper", "Lower"]);
  });
});

describe("choosing a rest day works for every split", () => {
  it("keeps each split's order and spacing, and lands its main rest day on the chosen day", () => {
    for (const arch of Object.values(SPLIT_ARCHITECTURES)) {
      const authored = titles(arch.week);
      const anchor = arch.week.map((d) => Boolean(d.recovery)).lastIndexOf(true);
      for (let rest = 0; rest < 7; rest += 1) {
        const moved = titles(arrangeWeekAroundRest(arch.week, rest));
        const start = (anchor - rest + 7) % 7;
        expect(moved[rest], `${arch.key}, rest on ${DAYS[rest]}`).toBe(authored[anchor]);
        expect(moved, `${arch.key}, rest on ${DAYS[rest]}`).toEqual([...authored.slice(start), ...authored.slice(0, start)]);
      }
    }
  });

  it("keeps the authored week when no rest day has been chosen", () => {
    expect(titles(arrangeWeekAroundRest(SPLIT_ARCHITECTURES.pplula.week, null))).toEqual(ROTATION);
  });

  it("never names a weekday in day copy, because the days move", () => {
    const weekday = /\b(mon|tues|wednes|thurs|fri|satur|sun)day\b|\bweekend\b|\bmid-?week\b/i;
    for (const arch of Object.values(SPLIT_ARCHITECTURES)) {
      for (const d of arch.week) {
        expect(`${d.goal} · ${d.reason}`, `${arch.key}: ${d.title}`).not.toMatch(weekday);
      }
    }
  });

  it("the daily context follows the chosen rest day", () => {
    const ctx = resolveDailyTrainingContext({ ...BASE, splitSystemChosen: true, splitSystemKey: "pplula", splitRestDayIndex: 2 });
    expect(ctx.weeklyPlan.map((d) => d.displayTitle)).toEqual(["Upper", "Lower", "Recovery", "Push", "Pull", "Legs", "Arm Day"]);
    expect(ctx.isRecoveryDay).toBe(true);
  });
});

describe("the engine decides what Legs leads with", () => {
  const legs = (week: ReturnType<typeof buildArchitectureResolvedWeek>) => week.find((d) => d.title === "Legs")!;

  it("alternates front and posterior legs week to week when Lower also trains the legs", () => {
    expect(legs(buildArchitectureResolvedWeek(SPLIT_ARCHITECTURES.pplula, NO_CHEST, 1)).archetype).toBe("quad-focus");
    expect(legs(buildArchitectureResolvedWeek(SPLIT_ARCHITECTURES.pplula, NO_CHEST, 2)).archetype).toBe("hamstring-glute");
  });

  it("leads with the member's lower-body weak point", () => {
    const glutes = legs(buildArchitectureResolvedWeek(SPLIT_ARCHITECTURES.pplula, NO_CHEST, 1, { musclePriority: ["Glutes"] }));
    const quads = legs(buildArchitectureResolvedWeek(SPLIT_ARCHITECTURES.pplula, NO_CHEST, 2, { musclePriority: ["Quads"] }));
    expect(glutes.archetype).toBe("hamstring-glute");
    expect(quads.archetype).toBe("quad-focus");
  });

  it("trains complete legs when Legs is the week's only lower day", () => {
    const day = legs(buildArchitectureResolvedWeek(SPLIT_ARCHITECTURES["bro-split"], NO_CHEST, 1));
    expect(day.archetype).toBeUndefined();
    expect(day.splitKey).toBe("legs");
  });
});

describe("each day trains what its name says", () => {
  const muscles = (key: keyof typeof WORKOUT_TEMPLATES) =>
    allTemplateMovements(WORKOUT_TEMPLATES[key]).map((m) => m.targetMuscle.toLowerCase()).join(" | ");

  it("Push trains chest, shoulders and triceps", () => {
    const m = muscles("push");
    expect(m).toMatch(/chest/);
    expect(m).toMatch(/delt/);
    expect(m).toMatch(/tricep/);
  });

  it("Pull trains back, biceps, forearms and traps", () => {
    const m = muscles("pull");
    expect(m).toMatch(/lat|back/);
    expect(m).toMatch(/bicep/);
    expect(m).toMatch(/forearm/);
    expect(m).toMatch(/trap/);
  });
});

describe("no default week pairs chest with back", () => {
  it("the fallback week is the rotation, with Sunday rest", () => {
    expect(RESERVE_WEEK_SPLIT.map((r) => r.title)).toEqual(ROTATION);
    expect([1, 2, 3, 4, 5, 6, 7].map(splitDayLabel)).toEqual(ROTATION);
    expect(buildProtocolWeek({})[0].sessionName).toBe("Push");
  });

  it("the default program blueprint is the rotation", () => {
    const { week } = resolveWeeklyBlueprint({});
    expect(titles(week)).toEqual(ROTATION);
    expect(["quad-focus", "hamstring-glute", "legs"]).toContain(week[2].archetype);
  });

  it("no program blueprint pairs chest with back", () => {
    for (const bp of [getBlueprintForProtocol(null, null, null), ...Object.values(PROTOCOL_BLUEPRINTS)]) {
      for (const d of bp.week) {
        expect(pairsChestWithBack(d), `${bp.id}: "${d.title}"`).toBe(false);
      }
    }
  });

  it("labels a chest-led push day as chest, not chest and back", () => {
    expect(ARCHETYPE_TO_SPLIT["chest-hypertrophy"]).toBe("chest");
  });
});

describe("split recommendations never land on chest/back", () => {
  const GOALS = [
    "",
    "complete physique",
    "build maximum muscle size",
    "classic symmetry and proportion",
    "photoshoot in ten weeks",
    "recomp and get leaner",
    "get stronger",
    "bodybuilding",
    "hybrid track athlete",
    "marathon runner",
  ];

  it("no recommended or alternative split pairs chest with back", () => {
    for (const goal of GOALS) {
      for (const days of [3, 4, 5, 6]) {
        for (const advanced of [true, false]) {
          const rec = buildSplitRecommendation({
            goal,
            trainingDaysPerWeek: days,
            advanced,
            recoveryStrong: advanced,
            weakPointLabels: [],
            hasDeadline: goal.includes("photoshoot"),
          });
          for (const system of [rec.recommended, ...rec.alternatives]) {
            const arch = getArchitectureForSystem(system.key, { trainingDaysPerWeek: days });
            expect(arch, `"${goal}" ${days}d → ${system.key}`).not.toBeNull();
            for (const d of arch!.week) {
              expect(pairsChestWithBack(d), `"${goal}" ${days}d → ${system.key}: ${d.title}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it("gives six-day physique members the rotation", () => {
    const rec = buildSplitRecommendation({
      goal: "complete physique",
      trainingDaysPerWeek: 6,
      advanced: false,
      recoveryStrong: false,
      weakPointLabels: [],
      hasDeadline: false,
    });
    expect(getArchitectureForSystem(rec.recommended.key, { trainingDaysPerWeek: 6 })?.key).toBe("pplula");
  });

  it("fits the default split to the days a member trains", () => {
    const archFor = (days: number) => getArchitectureForSystem("reserve-physique", { trainingDaysPerWeek: days })?.key;
    expect([archFor(6), archFor(5), archFor(4), archFor(3)]).toEqual(["pplula", "ppl-ul", "upper-lower", "full-body-3"]);
  });

  it("keeps the chest/back splits selectable by name", () => {
    for (const key of ["arnold", "elite-six", "contest-prep"]) {
      expect(SPLIT_SYSTEMS.some((s) => s.key === key), key).toBe(true);
    }
  });
});
