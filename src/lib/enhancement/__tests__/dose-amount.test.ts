import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { dailyAmountLabel, timesPerDay } from "../dose-amount";
import { doseAnchorsFrom, doseRuleLabel, resolveDose } from "../dose-timing";

const twice = { doses: [{ anchor: "training" as const, offsetMin: 30 }, { anchor: "bed" as const, offsetMin: 0 }] };

describe("dailyAmountLabel", () => {
  it("adds up the member's own amount across their own times", () => {
    expect(dailyAmountLabel({ doseAmount: "1.5", doseUnit: "IU", scheduleRule: { type: "on_off_cycle", daysOn: 2, daysOff: 1, ...twice } })).toBe("1.5 IU × 2 · 3 IU a day");
  });

  it("reads once a day as the amount alone", () => {
    expect(dailyAmountLabel({ doseAmount: "250", doseUnit: "mg", scheduleRule: undefined })).toBe("250 mg");
  });

  it("leaves anything that is not a plain number alone", () => {
    expect(dailyAmountLabel({ doseAmount: "", doseUnit: "IU", scheduleRule: undefined })).toBeNull();
    expect(dailyAmountLabel({ doseAmount: "1-2", doseUnit: "IU", scheduleRule: undefined })).toBeNull();
  });

  /* The banned-language suite rejects any amount in Reserve's own copy. This
     label is not Reserve's copy: it only echoes the member's entry, times the
     count they set, so it may carry no number and no word they did not give. */
  it("carries only the member's own numbers and unit, and no directive words", () => {
    const label = dailyAmountLabel({ doseAmount: "1.5", doseUnit: "IU", scheduleRule: { type: "daily", ...twice } })!;
    expect(label.match(/\d+(\.\d+)?/g)).toEqual(["1.5", "2", "3"]);
    const words = label.replace(/\d+(\.\d+)?|IU|×|·/g, " ").trim().split(/\s+/);
    expect(words).toEqual(["a", "day"]);
    expect(bannedLanguageIn(label.replace(/\d+(\.\d+)?\s?IU/g, "")).length).toBe(0);
  });

  it("counts at most four times", () => {
    expect(timesPerDay({ scheduleRule: { type: "daily", doses: Array.from({ length: 6 }, () => ({ anchor: "clock" as const, time: "08:00" })) } })).toBe(4);
  });
});

describe("the before-training anchor", () => {
  const anchors = doseAnchorsFrom({ wakeTime: "06:00", sleepTarget: "22:00", preferredTrainingStart: "17:30" }, [], true);

  it("lands the member's minutes before their own training start", () => {
    expect(resolveDose({ anchor: "training", offsetMin: 30 }, anchors).minutes).toBe(17 * 60);
    expect(doseRuleLabel({ anchor: "training", offsetMin: 30 }, anchors)).toBe("30 min before training");
    expect(doseRuleLabel({ anchor: "training", offsetMin: 0 }, anchors)).toBe("At training");
  });

  it("has no time on a day the member does not train, and says so", () => {
    const rest = doseAnchorsFrom({ preferredTrainingStart: "17:30" }, [], false);
    expect(resolveDose({ anchor: "training", offsetMin: 30 }, rest)).toEqual({ minutes: null, unresolved: "No training today" });
  });
});
