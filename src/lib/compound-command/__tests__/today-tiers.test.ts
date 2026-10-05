import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { byTierThenTime, compoundPrimaryAction, compoundReadouts, type CommandSlot } from "../command-room";
import { TIER_COPY, byTime, daypartOf, defaultTodayTier, groupByDaypart, nextDaypart, progressLine, splitByTier, todayTierFor, type MarkState } from "../today-tiers";

describe("the default tier", () => {
  it("leads with hormones, peptides, AAS, GH, ancillaries and medications", () => {
    for (const compoundClass of ["hormones_testosterone", "aas", "peptides_glp1", "peptides_healing", "growth_hormone", "ancillaries", "medications", "sarms", "thyroid", "insulin"]) {
      expect(defaultTodayTier({ compoundClass }), compoundClass).toBe("hero");
    }
  });

  it("puts supplements, vitamins, nootropics and recovery items with the add-ons", () => {
    for (const compoundClass of ["supplements", "vitamins", "nootropics", "recovery"]) {
      expect(defaultTodayTier({ compoundClass }), compoundClass).toBe("add-on");
    }
  });

  it("falls back to the category when the class is missing or custom", () => {
    expect(defaultTodayTier({ category: "hormone" })).toBe("hero");
    expect(defaultTodayTier({ category: "peptide" })).toBe("hero");
    expect(defaultTodayTier({ category: "medication" })).toBe("hero");
    expect(defaultTodayTier({ category: "supplement" })).toBe("add-on");
    expect(defaultTodayTier({ compoundClass: "other", category: "vitamin" })).toBe("add-on");
  });

  it("reads an unclassified entry by its route: injectable leads, anything else is an add-on", () => {
    expect(defaultTodayTier({ category: "other", route: "injectable" })).toBe("hero");
    expect(defaultTodayTier({ category: "other", route: "oral" })).toBe("add-on");
    expect(defaultTodayTier({})).toBe("add-on");
  });
});

describe("the member's choice", () => {
  it("always wins over the default, either way", () => {
    expect(todayTierFor({ compoundClass: "supplements", todayTier: "hero" })).toBe("hero");
    expect(todayTierFor({ compoundClass: "hormones_testosterone", todayTier: "add-on" })).toBe("add-on");
  });

  it("ignores a stored value that is not a tier", () => {
    expect(todayTierFor({ compoundClass: "aas", todayTier: "main" as never })).toBe("hero");
  });
});

describe("order is time, and only time, inside a tier", () => {
  const item = (name: string, plannedTime: string, tier: "hero" | "add-on" = "add-on") => ({ name, plannedTime, tier });

  it("sorts by planned time, untimed last, then by name", () => {
    const sorted = [item("Zinc", "21:30"), item("Fish Oil", "08:00"), item("Untimed", "—"), item("Creatine", "08:00")].sort(byTime);
    expect(sorted.map((i) => i.name)).toEqual(["Creatine", "Fish Oil", "Zinc", "Untimed"]);
  });

  it("keeps a small-hours entry at the end of the day it belongs to", () => {
    const sorted = [item("Late", "01:30"), item("Night", "23:00"), item("Morning", "07:00")].sort(byTime);
    expect(sorted.map((i) => i.name)).toEqual(["Morning", "Night", "Late"]);
  });

  it("splits into the two tiers without reordering either by anything but time", () => {
    const { heroes, addOns } = splitByTier([
      item("Tirzepatide", "21:00", "hero"),
      item("Creatine", "16:00"),
      item("Testosterone", "08:00", "hero"),
      item("Fish Oil", "08:00"),
    ]);
    expect(heroes.map((i) => i.name)).toEqual(["Testosterone", "Tirzepatide"]);
    expect(addOns.map((i) => i.name)).toEqual(["Fish Oil", "Creatine"]);
  });
});

describe("the progress line", () => {
  it("counts logged over scheduled; skipped never counts as logged", () => {
    expect(progressLine(["logged", "logged", "skipped", "due", "upcoming"])).toEqual({ logged: 2, total: 5, line: "2 of 5 logged · 1 skipped" });
    expect(progressLine(["logged", "due"])?.line).toBe("1 of 2 logged");
    expect(progressLine([])).toBeNull();
  });
});

describe("the gold action and the Up next marker agree", () => {
  const slot = (entryId: string, plannedTime: string, tier: "hero" | "add-on"): CommandSlot => ({
    entryId, name: entryId, plannedTime, plannedTimeLabel: plannedTime, injectable: false, tier,
  });

  it("logs a due main compound before a due add-on, then the earliest time", () => {
    const due = [slot("Creatine", "15:30", "add-on"), slot("BPC-157", "16:00", "hero"), slot("Oxandrolone", "16:30", "hero")];
    const primary = compoundPrimaryAction(due);
    expect(primary.kind === "log-next-due" && primary.slot.entryId).toBe("BPC-157");
    expect([...due].sort(byTierThenTime).map((s) => s.entryId)).toEqual(["BPC-157", "Oxandrolone", "Creatine"]);
  });

  it("falls back to time alone when nothing carries a tier", () => {
    const due: CommandSlot[] = [
      { entryId: "b", name: "B", plannedTime: "16:00", plannedTimeLabel: "4:00 PM", injectable: false },
      { entryId: "a", name: "A", plannedTime: "15:00", plannedTimeLabel: "3:00 PM", injectable: false },
    ];
    const primary = compoundPrimaryAction(due);
    expect(primary.kind === "log-next-due" && primary.slot.entryId).toBe("a");
  });

  it("names the same entry in the Due now readout", () => {
    const due = [slot("Creatine", "15:30", "add-on"), slot("BPC-157", "16:00", "hero")];
    const reads = compoundReadouts({ dueNow: due, laterToday: [], missed: [], loggedToday: 0, scheduledToday: 2 });
    expect(reads[0].detail).toBe("BPC-157 · 1 more");
  });
});

describe("tier copy", () => {
  it("is organisational and passes the banned-language suite", () => {
    const text = Object.values(TIER_COPY).join(" \n ");
    expect(bannedLanguageIn(text)).toEqual([]);
    expect(text).not.toMatch(/\b(important|priority|primary|essential|best|must|critical|key)\b/i);
  });
});

describe("add-ons by daypart", () => {
  const item = (name: string, plannedTime: string, state: MarkState) => ({ name, plannedTime, state });

  it("places times in Morning, Midday, Evening, Night, and untimed on its own row", () => {
    expect(["04:00", "11:59", "12:00", "16:59", "17:00", "20:59", "21:00", "03:59", "—"].map(daypartOf)).toEqual([
      "morning", "morning", "midday", "midday", "evening", "evening", "night", "night", "anytime",
    ]);
  });

  it("groups in day order, time order inside, and leaves empty dayparts out", () => {
    const groups = groupByDaypart([
      item("Zinc", "21:30", "upcoming"),
      item("Fish Oil", "08:00", "logged"),
      item("Magnesium", "21:00", "upcoming"),
      item("D3", "08:00", "logged"),
    ]);
    expect(groups.map((g) => g.daypart)).toEqual(["morning", "night"]);
    expect(groups[0].items.map((i) => i.name)).toEqual(["D3", "Fish Oil"]);
    expect(groups[1].items.map((i) => i.name)).toEqual(["Magnesium", "Zinc"]);
  });

  it("summarises a daypart in one line and opens the next one with anything to mark", () => {
    const groups = groupByDaypart([
      item("Fish Oil", "08:00", "logged"),
      item("D3", "08:00", "logged"),
      item("Electrolytes", "13:00", "skipped"),
      item("Creatine", "16:00", "due"),
      item("Magnesium", "21:00", "upcoming"),
    ]);
    expect(groups.map((g) => [g.daypart, g.line, g.settled])).toEqual([
      ["morning", "2 of 2 logged", true],
      ["midday", "0 of 2 logged · 1 skipped", false],
      ["night", "0 of 1 logged", false],
    ]);
    expect(nextDaypart(groups)).toBe("midday");
    expect(nextDaypart(groupByDaypart([item("Fish Oil", "08:00", "logged")]))).toBeNull();
  });
});
