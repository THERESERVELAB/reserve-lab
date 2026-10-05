import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { buildFieldOp, heartRateStatus, type FieldOpInput } from "../field-op";

const base: FieldOpInput = {
  today: "2026-09-16",
  age: 34,
  wakeTime: "06:00",
  sleepTime: "22:30",
  trainingTime: "17:30",
  isTrainingDay: false,
  cardioDaysPerWeek: 4,
  latestCheckIn: { date: "2026-09-14", systolic: 124, diastolic: 78, restingHr: 62 },
  hematocritFlagged: false,
  warningSignsReported: false,
  walkedMinutesToday: 0,
};

describe("field op", () => {
  it("builds a rest-day walk from the weekly guideline, with distance and a heart-rate reserve range", () => {
    const op = buildFieldOp(base);
    expect(op.gate).toBe("clear");
    expect(op.walk).toMatchObject({ startTime: "06:30", minutes: 40, miles: 2, heartRate: { method: "heart-rate-reserve" } });
    /* max 208 − 0.7×34 = 184; reserve 122 → 40–59% */
    expect(op.walk!.heartRate).toMatchObject({ low: 111, high: 134 });
    expect(op.daylight.startTime).toBe("06:30");
    expect(op.windDown.time).toBe("21:30");
  });

  it("is shorter on a training day and falls back to age-predicted without a resting heart rate", () => {
    const op = buildFieldOp({ ...base, isTrainingDay: true, latestCheckIn: null });
    expect(op.walk!.minutes).toBe(25);
    expect(op.walk!.heartRate).toMatchObject({ method: "age-predicted", low: 92, high: 129 });
  });

  it("moves the walk clear of a morning training slot", () => {
    expect(buildFieldOp({ ...base, trainingTime: "07:00" }).walk!.startTime).toBe("09:00");
  });

  it("takes the intensity away for a stage 2 blood pressure or a flagged hematocrit, and routes it", () => {
    const bp = buildFieldOp({ ...base, latestCheckIn: { date: "2026-09-15", systolic: 146, diastolic: 88, restingHr: 70 } });
    expect(bp.gate).toBe("easy-only");
    expect(bp.walk!.heartRate).toBeNull();
    expect(bp.walk!.minutes).toBeLessThanOrEqual(30);
    expect(bp.gateReason).toMatch(/146\/88.*stage 2.*telehealth/);
    expect(buildFieldOp({ ...base, hematocritFlagged: true }).gate).toBe("easy-only");
  });

  it("replaces the op with care today for a crisis-range reading or a warning sign", () => {
    const crisis = buildFieldOp({ ...base, latestCheckIn: { date: "2026-09-15", systolic: 184, diastolic: 110 } });
    expect(crisis.gate).toBe("care-today");
    expect(crisis.walk).toBeNull();
    expect(buildFieldOp({ ...base, warningSignsReported: true }).gateReason).toMatch(/911/);
  });

  it("marks the op done from logged walking minutes, and reads a heart rate against the range", () => {
    expect(buildFieldOp({ ...base, walkedMinutesToday: 40 }).done).toBe(true);
    expect(heartRateStatus(120, { low: 111, high: 134 })).toBe("in-range");
    expect(heartRateStatus(140, { low: 111, high: 134 })).toBe("above");
  });

  it("sets a step range by age, counts the walk in, and drops it on a care-today day", () => {
    const op = buildFieldOp({ ...base, stepsToday: 3500 });
    expect(op.steps).toMatchObject({ target: { low: 8000, high: 10000 }, today: 3500, walkAdds: 4000 });
    expect(op.steps.text).toMatch(/under 60/);
    expect(buildFieldOp({ ...base, age: 64 }).steps.target).toEqual({ low: 6000, high: 8000 });
    expect(buildFieldOp(base).steps.today).toBeNull();
    const care = buildFieldOp({ ...base, warningSignsReported: true });
    expect(care.steps.target).toBeNull();
    expect(care.steps.walkAdds).toBeNull();
  });

  it("says nothing the compliance rules forbid and cites its sources", () => {
    for (const input of [base, { ...base, hematocritFlagged: true }, { ...base, warningSignsReported: true }]) {
      const op = buildFieldOp(input);
      for (const text of [op.gateReason ?? "", op.walk?.why ?? "", op.daylight.text, op.windDown.text, op.steps.text]) {
        expect(bannedLanguageIn(text), text).toEqual([]);
        expect(text.length, text).toBeLessThan(240);
      }
      expect(op.sources.length).toBeGreaterThan(0);
    }
  });
});
