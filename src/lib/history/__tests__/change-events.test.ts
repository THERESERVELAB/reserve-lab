import { describe, expect, it } from "vitest";

import type { EnhancementEntry } from "@/lib/athlete-store";
import type { CyclePeriod } from "@/lib/cycle/cycle-period";
import type { SupportPlanItem } from "@/lib/cycle-review/types";

import {
  CHANGE_HISTORY_LIMIT,
  appendChangeEvents,
  compoundUpdateEvents,
  cycleUpdateEvents,
  localDateOf,
  makeChangeEvent,
  supportUpdateEvents,
} from "../change-events";

const at = new Date(2026, 8, 15, 10, 30);

const compound = {
  id: "e1",
  name: "Oxandrolone",
  officialName: "Oxandrolone",
  category: "hormone",
  doseAmount: "20",
  doseUnit: "mg",
  frequency: "daily",
  timingPreference: "",
  goalAssociation: [],
  isActive: true,
  createdAt: "",
  updatedAt: "",
} as unknown as EnhancementEntry;

const cycle: CyclePeriod = {
  id: "c1",
  name: "Fall cycle",
  startDate: "2026-07-01",
  plannedWeeks: 12,
  compoundIds: ["e1"],
  clinicianOversight: false,
  checkpoints: [],
  createdAt: "",
  updatedAt: "",
};

const supplement: SupportPlanItem = { id: "s1", optionKey: "fish-oil", addedAt: "" };

describe("change events", () => {
  it("records member-entered field changes as one dated edit", () => {
    const events = compoundUpdateEvents(compound, { ...compound, doseAmount: "25", frequency: "twice daily" }, at);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      date: "2026-09-15",
      action: "edited",
      subject: { kind: "compound", id: "e1", name: "Oxandrolone" },
      changes: [
        { field: "doseAmount", label: "Amount", from: "20", to: "25" },
        { field: "frequency", label: "Frequency", from: "daily", to: "twice daily" },
      ],
    });
  });

  it("records pause, resume, activate and deactivate as their own events", () => {
    expect(compoundUpdateEvents(compound, { ...compound, pausedAt: "2026-09-15" }, at).map((e) => e.action)).toEqual(["paused"]);
    expect(compoundUpdateEvents({ ...compound, pausedAt: "2026-09-10" }, compound, at).map((e) => e.action)).toEqual(["resumed"]);
    expect(compoundUpdateEvents(compound, { ...compound, isActive: false }, at).map((e) => e.action)).toEqual(["deactivated"]);
    expect(compoundUpdateEvents({ ...compound, isActive: false }, compound, at).map((e) => e.action)).toEqual(["activated"]);
  });

  it("ignores bookkeeping and private free text", () => {
    expect(compoundUpdateEvents(compound, { ...compound, updatedAt: "later", notes: "felt fine" }, at)).toEqual([]);
  });

  it("describes cycle and supplement edits in the member's own terms", () => {
    const cycleEvents = cycleUpdateEvents(cycle, { ...cycle, plannedWeeks: 16, compoundIds: ["e1", "e2"], clinicianOversight: true }, at);
    expect(cycleEvents[0]).toMatchObject({
      action: "edited",
      subject: { kind: "cycle", id: "c1", name: "Fall cycle" },
      changes: [
        { label: "Planned weeks", from: "12", to: "16" },
        { label: "Linked compounds", from: "1", to: "2" },
        { label: "Clinician oversight", from: "no", to: "yes" },
      ],
    });

    const supportEvents = supportUpdateEvents(supplement, { ...supplement, amount: "2", unit: "g", brand: "Nordic" }, "Fish oil (omega-3)", at);
    expect(supportEvents[0]).toMatchObject({
      action: "edited",
      subject: { kind: "support-plan", id: "s1", name: "Fish oil (omega-3)" },
      changes: [
        { label: "Amount", from: "", to: "2" },
        { label: "Unit", from: "", to: "g" },
        { label: "Product", from: "", to: "Nordic" },
      ],
    });
    expect(supportUpdateEvents(supplement, { ...supplement, notes: "with dinner" }, "Fish oil (omega-3)", at)).toEqual([]);
  });

  it("keeps the newest events first and never more than the limit", () => {
    const old = Array.from({ length: CHANGE_HISTORY_LIMIT }, (_, i) =>
      makeChangeEvent({ at: new Date(2026, 0, 1, 0, i), subject: { kind: "compound", id: `e${i}`, name: "Old" }, action: "added" }),
    );
    const fresh = makeChangeEvent({ at, subject: { kind: "compound", id: "new", name: "New" }, action: "removed" });
    const history = appendChangeEvents(old, [fresh]);
    expect(history).toHaveLength(CHANGE_HISTORY_LIMIT);
    expect(history[0]).toBe(fresh);
    expect(appendChangeEvents(undefined, [])).toEqual([]);
  });

  it("dates events by the member's local day", () => {
    expect(localDateOf(new Date(2026, 8, 15, 23, 59))).toBe("2026-09-15");
    expect(makeChangeEvent({ at: new Date(2026, 8, 15, 0, 1), subject: { kind: "cycle", id: "c1", name: "x" }, action: "ended" }).date).toBe("2026-09-15");
  });
});
