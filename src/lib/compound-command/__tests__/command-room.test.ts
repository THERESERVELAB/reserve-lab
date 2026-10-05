import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import {
  COMMAND_COPY,
  KEPT_PLACE_NAMES,
  TOOL_LINES,
  TOOL_ORDER,
  byPlannedTime,
  compoundPrimaryAction,
  compoundReadouts,
  compoundStatement,
  compoundSupport,
  countsLine,
  opensDoseMath,
  planLine,
  planViewFor,
  primaryTabFor,
  primaryTabs,
  resolvePlace,
  type CommandSlot,
  type CompoundTabKey,
} from "../command-room";

const slot = (entryId: string, name: string, plannedTime: string, injectable = false): CommandSlot => ({
  entryId,
  name,
  plannedTime,
  plannedTimeLabel: plannedTime === "—" ? "Unscheduled" : plannedTime,
  injectable,
});

describe("compound statement", () => {
  it("says nothing is tracked when the log is empty", () => {
    expect(compoundStatement({ trackedCount: 0, dueNow: 0, missed: 0 })).toBe("Nothing tracked yet");
  });

  it("counts tracked compounds and what is due now", () => {
    expect(compoundStatement({ trackedCount: 3, dueNow: 2, missed: 0 })).toBe("3 compounds tracked · 2 due now");
    expect(compoundStatement({ trackedCount: 1, dueNow: 1, missed: 0 })).toBe("1 compound tracked · 1 due now");
  });

  it("never prints a zero for due now, and adds missed only when there is one", () => {
    expect(compoundStatement({ trackedCount: 1, dueNow: 0, missed: 0 })).toBe("1 compound tracked · nothing due now");
    expect(compoundStatement({ trackedCount: 2, dueNow: 0, missed: 1 })).toBe("2 compounds tracked · nothing due now · 1 missed");
  });

  it("counts main compounds and add-ons separately when the tiers are given", () => {
    expect(compoundStatement({ trackedCount: 15, addOnCount: 11, dueNow: 4, missed: 1 })).toBe("4 compounds · 11 add-ons · 4 due now · 1 missed");
    expect(compoundStatement({ trackedCount: 1, addOnCount: 0, dueNow: 0, missed: 0 })).toBe("1 compound · nothing due now");
    expect(compoundStatement({ trackedCount: 3, addOnCount: 3, dueNow: 1, missed: 0 })).toBe("3 add-ons · 1 due now");
    expect(compoundStatement({ trackedCount: 2, addOnCount: 1, dueNow: 0, missed: 0 })).toBe("1 compound · 1 add-on · nothing due now");
    expect(compoundStatement({ trackedCount: 0, addOnCount: 0, dueNow: 0, missed: 0 })).toBe("Nothing tracked yet");
  });

  it("never says 'logged' about the registry, because the readout beside it means marked today", () => {
    expect(compoundStatement({ trackedCount: 3, dueNow: 1, missed: 1 })).not.toMatch(/logged/i);
  });

  it("offers a support line only to a member with nothing tracked", () => {
    expect(compoundSupport(0)).toBe(COMMAND_COPY.freshSupport);
    expect(compoundSupport(4)).toBeUndefined();
  });
});

describe("the one gold action", () => {
  it("is Add Compound when nothing is due", () => {
    expect(compoundPrimaryAction([])).toEqual({ kind: "add-compound", label: "Add Compound" });
  });

  it("is Log Next Due for the earliest due item", () => {
    const primary = compoundPrimaryAction([slot("b", "Zinc", "09:00"), slot("a", "Creatine", "08:30", true)]);
    expect(primary.kind).toBe("log-next-due");
    expect(primary.label).toBe("Log Next Due");
    if (primary.kind === "log-next-due") {
      expect(primary.slot.entryId).toBe("a");
      expect(primary.slot.injectable).toBe(true);
    }
  });

  it("orders untimed items after timed ones", () => {
    const items = [slot("x", "B", "—"), slot("y", "A", "—"), slot("z", "C", "07:00")];
    expect(items.sort(byPlannedTime).map((item) => item.entryId)).toEqual(["z", "y", "x"]);
  });
});

describe("hero readouts", () => {
  it("leaves out every readout with nothing behind it", () => {
    expect(compoundReadouts({ dueNow: [], laterToday: [], missed: [], loggedToday: 0, scheduledToday: 0 })).toEqual([]);
  });

  it("names what is due now and how many more", () => {
    const reads = compoundReadouts({
      dueNow: [slot("a", "Zinc", "16:00"), slot("b", "Creatine", "15:30")],
      laterToday: [slot("c", "Magnesium", "21:00")],
      missed: [],
      loggedToday: 1,
      scheduledToday: 4,
    });
    expect(reads).toEqual([
      { label: "Due now", value: "2", detail: "Creatine · 1 more" },
      { label: "Logged today", value: "1", unit: "of 4" },
    ]);
  });

  it("shows the next time due when nothing is due now, and names what was missed", () => {
    const reads = compoundReadouts({
      dueNow: [],
      laterToday: [slot("c", "Magnesium", "21:00")],
      missed: [slot("d", "Vitamin B12", "07:00")],
      loggedToday: 0,
      scheduledToday: 2,
    });
    expect(reads).toEqual([
      { label: "Next due", value: "21:00", detail: "Magnesium" },
      { label: "Missed", value: "1", detail: "Vitamin B12" },
      { label: "Logged today", value: "0", unit: "of 2" },
    ]);
  });

  it("never carries the cycle checkpoint — the Cycle Brief below prints it already", () => {
    const reads = compoundReadouts({
      dueNow: [slot("a", "Zinc", "16:00")],
      laterToday: [],
      missed: [slot("d", "B12", "07:00")],
      loggedToday: 1,
      scheduledToday: 3,
    });
    expect(reads.map((read) => read.label)).toEqual(["Due now", "Missed", "Logged today"]);
    expect(reads.some((read) => /checkpoint/i.test(read.label))).toBe(false);
  });
});

describe("navigation", () => {
  const OLD_KEYS: CompoundTabKey[] = [
    "today", "timeline", "research", "cycle", "registry", "schedule",
    "dose-math", "injection-map", "inventory", "support", "labs", "education",
  ];

  it("keeps three primary places plus More, with Cycle & Safety behind the launch switch", () => {
    expect(primaryTabs(true).map((t) => t.label)).toEqual(["Today", "Plan", "Cycle & Safety", "More"]);
    expect(primaryTabs(false).map((t) => t.label)).toEqual(["Today", "Plan", "More"]);
  });

  it("maps every shipped tab key to a place", () => {
    const map = Object.fromEntries(OLD_KEYS.map((key) => [key, primaryTabFor(key)]));
    expect(map).toEqual({
      today: "today",
      registry: "plan",
      schedule: "plan",
      inventory: "plan",
      "injection-map": "plan",
      "dose-math": "plan",
      cycle: "cycle",
      timeline: "more",
      research: "more",
      support: "more",
      labs: "more",
      education: "more",
    });
    for (const key of OLD_KEYS.filter((k) => primaryTabFor(k) === "more")) expect(TOOL_ORDER).toContain(key);
  });

  it("opens Plan for every key that used to be its own list of the same entries", () => {
    for (const key of ["registry", "schedule", "inventory", "injection-map", "dose-math"] as const) {
      expect(resolvePlace(key, true)).toBe("plan");
    }
    expect(planViewFor("schedule")).toBe("week");
    expect(planViewFor("registry")).toBe("compounds");
    expect(planViewFor("inventory")).toBe("compounds");
    expect(opensDoseMath("dose-math")).toBe(true);
    expect(opensDoseMath("registry")).toBe(false);
  });

  it("lands every Cycle Brief key where it always did", () => {
    for (const key of ["cycle", "support", "labs"] as const) expect(resolvePlace(key, true)).toBe(key);
    /* The injection log now lives inside a compound's own sheet, one place away in Plan. */
    expect(resolvePlace("injection-map", true)).toBe("plan");
  });

  it("never opens a hidden Cycle & Safety", () => {
    expect(resolvePlace("cycle", false)).toBe("today");
    expect(resolvePlace("support", false)).toBe("support");
  });

  it("lists five places under More, not eight", () => {
    expect(TOOL_ORDER).toHaveLength(5);
  });
});

describe("summary lines", () => {
  it("drops zero counts and says so when nothing is left", () => {
    expect(countsLine([{ count: 2, label: "due now" }, { count: 0, label: "missed" }, { count: 5, label: "this week" }], "Nothing scheduled")).toBe("2 due now · 5 this week");
    expect(countsLine([{ count: 0, label: "due now" }], "Nothing scheduled")).toBe("Nothing scheduled");
  });

  it("gives Plan two counts a member can add up, and never repeats the hero's due/missed", () => {
    expect(planLine({ trackedCount: 3, scheduledNext7: 16 })).toBe("3 compounds · 16 scheduled in the next 7 days");
    expect(planLine({ trackedCount: 1, scheduledNext7: 0 })).toBe("1 compound · nothing scheduled in the next 7 days");
    expect(planLine({ trackedCount: 0, scheduledNext7: 0 })).toBe("Nothing tracked yet");
    expect(planLine({ trackedCount: 3, scheduledNext7: 16 })).not.toMatch(/due now|missed/);
  });
});

describe("compliance", () => {
  it("new fixed copy passes the banned-language suite", () => {
    const copy = [
      ...(Object.values(COMMAND_COPY).filter((value) => typeof value === "string") as string[]),
      COMMAND_COPY.logged("Zinc", "8:00 AM"),
      ...Object.values(TOOL_LINES),
      compoundStatement({ trackedCount: 3, dueNow: 2, missed: 1 }),
      compoundStatement({ trackedCount: 0, dueNow: 0, missed: 0 }),
      planLine({ trackedCount: 3, scheduledNext7: 16 }),
      planLine({ trackedCount: 0, scheduledNext7: 0 }),
      ...compoundReadouts({
        dueNow: [slot("a", "Zinc", "16:00")],
        laterToday: [],
        missed: [slot("b", "Magnesium", "07:00")],
        loggedToday: 1,
        scheduledToday: 2,
      }).flatMap((read) => [read.label, read.unit ?? "", read.detail ?? ""]),
      /* Place names other than the two kept verbatim. */
      ...Object.entries(KEPT_PLACE_NAMES).filter(([key]) => key !== "dose-math" && key !== "support").map(([, name]) => name),
    ];
    for (const line of copy) expect(bannedLanguageIn(line), line).toEqual([]);
  });

  it("documents exactly which kept place names the suite would reject", () => {
    const rejected = Object.values(KEPT_PLACE_NAMES).filter((name) => bannedLanguageIn(name).length > 0);
    expect(rejected).toEqual(["Dose Math", "Support Stack"]);
  });
});
