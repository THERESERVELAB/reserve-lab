import { describe, expect, it } from "vitest";

import { buildArchitectureResolvedWeek, toApexWeekDays } from "../daily-context";
import { SPLIT_ARCHITECTURES } from "../split-architectures";
import { getSessionProtocol } from "../weekly-split";

/* The support stack around the lift used to be keyed by weekday, so Monday
   always carried the old Chest / Back stack whatever the split put there.
   It now follows the session: Push and Pull finish with abs, cardio and an
   optional sauna; every other training day ends with a cooldown and mobility. */

const WED = new Date(2026, 8, 16, 12);
const NO_CHEST = { active: false, upperChest: false };
const WEEKDAY = /\b(mon|tues|wednes|thurs|fri|satur|sun)day\b|\bweekend\b/i;

/* Rest on Wednesday: Upper, Lower, Rest, Push, Pull, Legs, Arm Day. */
const week = buildArchitectureResolvedWeek(SPLIT_ARCHITECTURES.pplula, NO_CHEST, 1, { restDayIndex: 2 });
const protocolFor = (title: string) => {
  const i = week.findIndex((d) => d.title === title);
  return getSessionProtocol(week[i], week[(i + 1) % week.length]);
};

describe("the support stack follows the session, not the weekday", () => {
  it("Push and Pull finish with abs, cardio and an optional sauna", () => {
    for (const title of ["Push", "Pull"]) {
      const p = protocolFor(title);
      expect(p.abs, title).toBeTruthy();
      expect(p.cardio, title).toBeTruthy();
      expect(p.sauna, title).toMatch(/optional/i);
      expect(p.sauna, title).toMatch(/if hydrated/i);
    }
  });

  it("Legs, Arms, Upper and Lower end with a cooldown and mobility — no abs or sauna block", () => {
    for (const title of ["Legs", "Arm Day", "Upper", "Lower"]) {
      const p = protocolFor(title);
      expect(p.abs, title).toBeNull();
      expect(p.sauna, title).toBeNull();
      expect(p.cardio, title).toBeTruthy();
      expect(p.mobility, title).toBeTruthy();
    }
  });

  it("the week rail carries the same stack: Thursday's Push has the sauna, Monday's Upper does not", () => {
    const rail = toApexWeekDays(week, WED);
    expect(rail[3].sessionName).toBe("Push");
    expect(rail[3].protocol.sauna).toMatch(/if hydrated/i);
    expect(rail[0].sessionName).toBe("Upper");
    expect(rail[0].protocol.sauna).toBeNull();
  });

  it("never names a weekday in its notes", () => {
    week.forEach((day, i) => {
      const p = getSessionProtocol(day, week[(i + 1) % week.length]);
      const text = [p.cardio, p.abs, p.sauna, p.mobility, p.posing, p.nutritionFocus, p.recoveryNote, p.afterSession].join(" · ");
      expect(text, day.title).not.toMatch(WEEKDAY);
    });
  });
});
