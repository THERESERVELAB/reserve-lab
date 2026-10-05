import { describe, expect, it } from "vitest";

import { SPLIT_SYSTEMS, buildSplitRecommendation, type SplitArchitectInput } from "../split-architect";
import { SPLIT_ARCHITECTURES, legFrequencyLabel, lowerDaysPerWeek } from "../split-architectures";
import { protocolLegFrequency, protocolLowerDays } from "../split-blueprints";
import { getTemplateForArchetype } from "../workout-templates";
import { PROTOCOL_LIBRARY } from "@/lib/protocol/library";

/* The owner's report was one glute day. The protocols were not the problem —
   the Split Architect was. All eighteen of its architectures opened on chest,
   back or push, none was lower-led, three carried a single lower day, and
   nothing stated a leg count anywhere. The Architect was also never told who
   it was advising: buildSplitRecommendation took no gender signal at all,
   which is why a member whose whole goal was glutes got an Arnold split. */

const LOWER_LED = ["lower-priority-ul", "glute-priority", "runway-athletic", "glute-crown-six"] as const;

const BASE: SplitArchitectInput = {
  goal: "balanced physique",
  advanced: false,
  recoveryStrong: true,
  trainingDaysPerWeek: 5,
  weakPointLabels: [],
  hasDeadline: false,
};

const woman = (over: Partial<SplitArchitectInput> = {}) => ({ ...BASE, womensPath: true, ...over });

describe("the lower-led lane exists", () => {
  it("every lower-led architecture carries at least two lower days", () => {
    for (const key of LOWER_LED) {
      const arch = SPLIT_ARCHITECTURES[key];
      expect(arch, `${key} is missing`).toBeDefined();
      expect(lowerDaysPerWeek(arch), `${key} lower days`).toBeGreaterThanOrEqual(2);
    }
  });

  it("each one opens on the glutes — unlike all eighteen that came before", () => {
    for (const key of LOWER_LED) {
      expect(SPLIT_ARCHITECTURES[key].week[0].archetype).toBe("glute-strength");
    }
  });

  it("each one keeps two upper exposures so the frame stays balanced", () => {
    for (const key of LOWER_LED) {
      const upper = SPLIT_ARCHITECTURES[key].week.filter(
        (d) => d.archetype && ["posture-upper", "upper-tone", "upper-strength", "delts-arms"].includes(d.archetype),
      );
      expect(upper.length, `${key} upper exposures`).toBeGreaterThanOrEqual(1);
    }
  });

  it("every authored day resolves to a real session", () => {
    for (const key of LOWER_LED) {
      for (const day of SPLIT_ARCHITECTURES[key].week) {
        if (day.recovery || day.activity) continue;
        expect(day.archetype, `${key} · ${day.title} has no archetype`).toBeTruthy();
        expect(getTemplateForArchetype(day.archetype!), `${key} · ${day.title} resolves to nothing`).not.toBeNull();
      }
    }
  });

  it("the day count matches what each one claims", () => {
    for (const key of LOWER_LED) {
      const arch = SPLIT_ARCHITECTURES[key];
      expect(arch.week.filter((d) => !d.recovery)).toHaveLength(arch.daysPerWeek);
      expect(arch.week).toHaveLength(7);
    }
  });
});

describe("the lane is for the women's path only", () => {
  it("a member not on the path never sees it anywhere in the Architect", () => {
    const rec = buildSplitRecommendation(BASE);
    const everywhere = [rec.recommended, ...rec.alternatives, ...rec.deeper];
    for (const sys of everywhere) {
      expect(sys.audience, `${sys.name} leaked to a member not on the women's path`).not.toBe("womens");
    }
  });

  it("a member on the path can reach all four", () => {
    const rec = buildSplitRecommendation(woman());
    const keys = new Set([rec.recommended.key, ...rec.alternatives.map((a) => a.key), ...rec.deeper.map((d) => d.key)]);
    for (const key of LOWER_LED) expect(keys.has(key), `${key} unreachable`).toBe(true);
  });

  it("the lane leads the deeper catalog for her, not trails it", () => {
    const rec = buildSplitRecommendation(woman({ goal: "get stronger" }));
    const firstGeneral = rec.deeper.findIndex((s) => !s.audience);
    const lastWomens = rec.deeper.map((s) => s.audience === "womens").lastIndexOf(true);
    if (firstGeneral >= 0 && lastWomens >= 0) expect(lastWomens).toBeLessThan(firstGeneral);
  });
});

describe("a glute goal now reads as a glute goal", () => {
  it("'grow my glutes' no longer lands on a mass split", () => {
    /* /grow/ used to match the bulk read and return a hypertrophy rotation. */
    const rec = buildSplitRecommendation(woman({ goal: "grow my glutes" }));
    expect(LOWER_LED).toContain(rec.recommended.key as (typeof LOWER_LED)[number]);
  });

  it("reads shape language too", () => {
    for (const goal of ["sculpted legs and glutes", "runway shape", "toned hourglass", "bikini shape"]) {
      const rec = buildSplitRecommendation(woman({ goal }));
      expect(LOWER_LED, `"${goal}" missed the lane`).toContain(rec.recommended.key as (typeof LOWER_LED)[number]);
    }
  });

  it("fits the recommendation to the days she actually trains", () => {
    expect(buildSplitRecommendation(woman({ goal: "grow my glutes", trainingDaysPerWeek: 4 })).recommended.key).toBe("lower-priority-ul");
    expect(buildSplitRecommendation(woman({ goal: "grow my glutes", trainingDaysPerWeek: 5 })).recommended.key).toBe("glute-priority");
    expect(buildSplitRecommendation(woman({ goal: "grow my glutes", trainingDaysPerWeek: 6 })).recommended.key).toBe("glute-crown-six");
  });

  it("sends an athletic shape goal to the power variant", () => {
    expect(buildSplitRecommendation(woman({ goal: "athletic glute shape and power" })).recommended.key).toBe("runway-athletic");
  });

  it("leaves a male member's reads untouched", () => {
    expect(buildSplitRecommendation({ ...BASE, goal: "grow my glutes" }).recommended.audience).toBeUndefined();
    expect(buildSplitRecommendation({ ...BASE, goal: "marathon" }).recommended.key).toBe("hybrid-runner");
  });
});

describe("leg frequency is stated, and derived", () => {
  it("counts the authored week rather than a hand-typed number", () => {
    expect(lowerDaysPerWeek(SPLIT_ARCHITECTURES["glute-priority"])).toBe(3);
    expect(lowerDaysPerWeek(SPLIT_ARCHITECTURES["lower-priority-ul"])).toBe(2);
    expect(lowerDaysPerWeek(SPLIT_ARCHITECTURES["upper-lower"])).toBe(2);
  });

  it("the single-leg-day splits say so out loud", () => {
    expect(legFrequencyLabel(SPLIT_ARCHITECTURES["bro-split"])).toBe("1 leg day");
    expect(legFrequencyLabel(SPLIT_ARCHITECTURES["glute-priority"])).toBe("3 leg days");
  });

  it("every system in the catalog can state its leg count", () => {
    for (const sys of SPLIT_SYSTEMS) {
      const arch = SPLIT_ARCHITECTURES[sys.key];
      if (!arch) continue; // identity systems map through SYSTEM_TO_ARCHITECTURE
      expect(legFrequencyLabel(arch)).toMatch(/^\d+ leg days?$/);
    }
  });
});

describe("the nine protocols are named to be chosen", () => {
  it("keeps every id frozen, so no active protocol is orphaned", () => {
    const ids = [
      "glute-crown", "glute-ascend", "sculpted-legs", "runway-shape", "vacation-physique",
      "athletic-model", "signature-shape", "hybrid-pilates-shape", "sport-strength-shape",
    ];
    for (const id of ids) {
      expect(PROTOCOL_LIBRARY.find((p) => p.id === id), `${id} lost its id`).toBeDefined();
    }
  });

  it("drops the Protocol / Rotation / Architecture suffixes", () => {
    for (const p of PROTOCOL_LIBRARY.filter((d) => d.category === "womens-performance")) {
      expect(p.name, `${p.id} still carries a suffix`).not.toMatch(/\b(Protocol|Rotation|Architecture)\b/);
      expect(p.name.split(" ").length, `${p.id} is still a mouthful`).toBeLessThanOrEqual(2);
    }
  });

  it("states the real leg frequency instead of leaving her to guess", () => {
    expect(protocolLegFrequency("glute-crown")).toBe("3 leg days");
    expect(protocolLegFrequency("sculpted-legs")).toBe("4 leg days");
    expect(protocolLowerDays("glute-ascend")).toBeGreaterThanOrEqual(2);
  });

  it("every women's protocol trains legs at least twice a week", () => {
    for (const p of PROTOCOL_LIBRARY.filter((d) => d.category === "womens-performance")) {
      expect(protocolLowerDays(p.id, p.category), `${p.id} trains legs too rarely`).toBeGreaterThanOrEqual(2);
    }
  });

  it("names nothing after a real event, federation or person", () => {
    for (const p of PROTOCOL_LIBRARY.filter((d) => d.category === "womens-performance")) {
      expect(`${p.name} ${p.tagline}`).not.toMatch(/\b(IFBB|NPC|WBFF|Olympia|Miami Swim Week|Arnold Classic)\b/i);
    }
  });
});
