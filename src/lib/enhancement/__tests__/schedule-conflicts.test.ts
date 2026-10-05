import { describe, expect, it } from "vitest";

import type { EnhancementEntry } from "@/lib/athlete-store";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import type { EnhancementScheduleSlot } from "../schedule";
import { findScheduleConflicts } from "../schedule-conflicts";

/**
 * The member sets every time. Reserve names clashes a label or public source
 * describes — never a time to use instead.
 */

function slot(name: string, time: string, category: EnhancementEntry["category"] = "supplement", officialName?: string): EnhancementScheduleSlot {
  const entry = { id: name, name, officialName, category, doseAmount: "", doseUnit: "", frequency: "", timingPreference: "", goalAssociation: [], isActive: true, createdAt: "", updatedAt: "" } as EnhancementEntry;
  return { id: `${name}-${time}`, entryId: name, entry, bucket: "custom", bucketLabel: "Custom", plannedTime: time, plannedTimeLabel: time, source: "user-defined timing", status: "planned" };
}

describe("schedule conflicts", () => {
  it("names a mineral set close to an antibiotic or thyroid medicine", () => {
    const conflicts = findScheduleConflicts({ slots: [slot("Doxycycline", "08:00", "medication"), slot("Zinc", "09:00"), slot("Levothyroxine", "06:00", "medication"), slot("Magnesium Glycinate", "09:30", "supplement", "Magnesium Glycinate")] });
    expect(conflicts.map((c) => c.title)).toEqual(expect.arrayContaining(["Minerals near a tetracycline antibiotic", "Minerals near thyroid medicine"]));
    expect(conflicts.find((c) => c.kind === "absorption")!.items.map((i) => i.name)).toEqual(["Doxycycline", "Zinc"]);
  });

  it("leaves minerals alone when they are set outside the label's window", () => {
    expect(findScheduleConflicts({ slots: [slot("Doxycycline", "08:00", "medication"), slot("Zinc", "14:00")] })).toEqual([]);
  });

  it("names a stimulant within 6 hours of the member's bedtime, across midnight", () => {
    const conflicts = findScheduleConflicts({ slots: [slot("Pre-workout", "19:00"), slot("Caffeine", "07:00")], sleepTime: "23:00" });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ kind: "stimulant-bedtime" });
    expect(conflicts[0].items[0].name).toBe("Pre-workout");
    const late = findScheduleConflicts({ slots: [slot("Caffeine", "22:30")], sleepTime: "00:30" });
    expect(late).toHaveLength(1);
  });

  it("names something sedating set shortly before training, not after it", () => {
    expect(findScheduleConflicts({ slots: [slot("Melatonin", "17:00")], trainingTime: "18:00" })[0]?.kind).toBe("sedating-training");
    expect(findScheduleConflicts({ slots: [slot("Melatonin", "21:00")], trainingTime: "18:00" })).toEqual([]);
  });

  it("names a watched nutrient coming from more than one product", () => {
    const conflicts = findScheduleConflicts({ slots: [slot("Multivitamin", "08:00", "vitamin", "Multivitamin"), slot("Zinc", "20:00", "supplement", "Zinc")] });
    expect(conflicts.find((c) => c.kind === "duplicate-nutrient")?.title).toBe("Zinc from more than one product today");
  });

  it("never gives a time, an amount or a directive", () => {
    const conflicts = findScheduleConflicts({
      slots: [slot("Cipro", "08:00", "medication"), slot("Calcium", "08:30"), slot("Levothyroxine", "07:00", "medication"), slot("Iron", "09:00"), slot("Yohimbine", "20:00"), slot("Kava", "16:30"), slot("Valerian", "17:00"), slot("Multivitamin", "08:00", "vitamin", "Multivitamin"), slot("Zinc", "08:00", "supplement", "Zinc")],
      sleepTime: "22:00",
      trainingTime: "17:30",
    });
    expect(new Set(conflicts.map((c) => c.kind))).toEqual(new Set(["absorption", "stimulant-bedtime", "sedating-training", "duplicate-nutrient"]));
    for (const c of conflicts) {
      for (const text of [c.title, c.detail]) {
        expect(bannedLanguageIn(text), text).toEqual([]);
        expect(text, text).not.toMatch(/\b(?:move|take it at|instead|should|stop taking|switch)\b/i);
      }
      expect(c.source.label).toBeTruthy();
    }
  });
});
