import { describe, expect, it } from "vitest";

import type { PersonalizedProtocolExplanation } from "../protocol-explanation";
import { explainWithMemberSplit } from "../member-split-explanation";
import { SPLIT_ARCHITECTURES } from "../split-architectures";

const PROGRAM: PersonalizedProtocolExplanation = {
  headline: "Classic Physique Build · five days · Classic physique",
  summary: "The classic symmetry rotation gives delts, arms, hamstrings two exposures each.",
  athleteContext: ["You are training at an advanced level."],
  whyThisProtocol: ["You selected Classic Physique Build yourself.", "The plan uses five of the six days you said you have."],
  whatThisSplitDoes: ["Build classic proportion.", "Across the week, delts, arms, hamstrings each get at least two exposures."],
  weeklyLogic: ["Place the posterior day away from the lower strength day."],
  bodyCompositionStrategy: ["Composition is tracked through weight trend."],
  recoveryStrategy: ["Recovery capacity reads moderate."],
  nutritionStrategy: ["Nutrition demand reads moderate."],
  whatReserveWillMonitor: ["Weekly body-weight trend."],
  changeConditions: ["A stalled trend for two weeks adjusts calories."],
  confidence: "moderate",
  assumptions: [],
};

const PPLULA_REST_WEDNESDAY = { architecture: SPLIT_ARCHITECTURES.pplula, restDayIndex: 2, musclePriority: [] };

function explain(availableDays = 6) {
  return explainWithMemberSplit(PROGRAM, {
    split: PPLULA_REST_WEDNESDAY,
    programName: "Classic Physique Build",
    availableDays,
    weekNumber: 1,
  });
}

describe("the program explanation, when the member chose the split", () => {
  it("describes the member's split and rest day, and the program's role", () => {
    const out = explain();
    expect(out.summary).toContain("Push / Pull / Legs / Arms / Upper / Lower");
    expect(out.summary).toContain("six training days");
    expect(out.summary).toContain("Wednesday");
    expect(out.summary).toContain("Classic Physique Build keeps setting the phase, weekly volume and progression");
    expect(out.summary).not.toMatch(/classic symmetry rotation/i);
  });

  it("replaces every line about the program's own week", () => {
    const out = explain();
    const splitLines = [...out.whatThisSplitDoes, ...out.weeklyLogic, ...out.whyThisProtocol].join(" ");
    expect(splitLines).not.toMatch(/delts, arms, hamstrings|posterior day|five of the six/i);
    expect(out.whatThisSplitDoes.join(" ")).toMatch(/chest, delts, triceps, back and biceps each get at least two sessions/);
    expect(out.whatThisSplitDoes.join(" ")).toMatch(/Push and Pull days end with abs, cardio and an optional sauna/);
    expect(out.whatThisSplitDoes.join(" ")).toMatch(/Legs changes its lead week to week/);
    expect(out.weeklyLogic.join(" ")).toMatch(/turns around Wednesday/);
    expect(out.whyThisProtocol).toEqual(["The split uses all six of the days you said you have."]);
    expect(out.headline).toBe("Push / Pull / Legs / Arms / Upper / Lower · six days · Classic Physique Build");
  });

  it("says plainly when the split asks for more days than the member has", () => {
    expect(explain(4).whyThisProtocol).toEqual([
      "The split trains six days and you said you have four. Reserve keeps your split as chosen — that gap is the main compromise in running it.",
    ]);
  });

  it("keeps the program's own guidance on nutrition, recovery, monitoring and change", () => {
    const out = explain();
    expect(out.athleteContext).toEqual(PROGRAM.athleteContext);
    expect(out.bodyCompositionStrategy).toEqual(PROGRAM.bodyCompositionStrategy);
    expect(out.recoveryStrategy).toEqual(PROGRAM.recoveryStrategy);
    expect(out.nutritionStrategy).toEqual(PROGRAM.nutritionStrategy);
    expect(out.whatReserveWillMonitor).toEqual(PROGRAM.whatReserveWillMonitor);
    expect(out.changeConditions).toEqual(PROGRAM.changeConditions);
  });
});
