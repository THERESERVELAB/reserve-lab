import { describe, expect, it } from "vitest";

import {
  adjacentChooserStep,
  chooserStartStep,
  CHOOSER_STEPS,
  profileInputsLine,
  showsWomensArchitecture,
  targetDateLabel,
  weekLine,
} from "../personal-command";

describe("showsWomensArchitecture", () => {
  it("opens for a female member", () => {
    expect(showsWomensArchitecture({ genderIdentity: "female" })).toBe(true);
    expect(showsWomensArchitecture({ sex: "female" })).toBe(true);
  });

  it("stays closed when the profile sets no sex — the women's module alone is not enough", () => {
    expect(showsWomensArchitecture({})).toBe(false);
    expect(showsWomensArchitecture({ genderIdentity: null, sex: null })).toBe(false);
  });

  it("stays closed for a male or other member", () => {
    expect(showsWomensArchitecture({ genderIdentity: "male" })).toBe(false);
    expect(showsWomensArchitecture({ sex: "other" })).toBe(false);
  });
});

describe("the chooser steps", () => {
  it("runs goal → activities → focus → protocol", () => {
    expect(CHOOSER_STEPS.map((s) => s.step)).toEqual(["goal", "activities", "focus", "protocol"]);
    expect(adjacentChooserStep("goal", "next")).toBe("activities");
    expect(adjacentChooserStep("focus", "next")).toBe("protocol");
    expect(adjacentChooserStep("protocol", "next")).toBeNull();
    expect(adjacentChooserStep("goal", "back")).toBeNull();
  });

  it("goes back from the confirmation to the list, and never forward past it", () => {
    expect(adjacentChooserStep("confirm", "back")).toBe("protocol");
    expect(adjacentChooserStep("confirm", "next")).toBeNull();
  });

  it("opens on the confirmation for a named protocol, the list for browsing, the goal otherwise", () => {
    expect(chooserStartStep({ protocolId: "summer-shred" })).toBe("confirm");
    expect(chooserStartStep({ browse: true })).toBe("protocol");
    expect(chooserStartStep({})).toBe("goal");
  });
});

describe("profileInputsLine", () => {
  it("counts the missing inputs in one line, with no second measure beside it", () => {
    // "Profile 80% · 14 inputs missing" set two different measures side by side.
    expect(profileInputsLine({ missingCount: 11 })).toBe("11 inputs missing");
    expect(profileInputsLine({ missingCount: 1 })).toBe("1 input missing");
    expect(profileInputsLine({ missingCount: 0 })).toBe("Nothing missing");
  });
});

describe("targetDateLabel", () => {
  it("reads a stored date the way a member writes it, on the day it was set", () => {
    expect(targetDateLabel("2027-01-04")).toBe("Jan 4, 2027");
    expect(targetDateLabel("2026-12-31")).toBe("Dec 31, 2026");
  });

  it("names the event beside it when there is one", () => {
    expect(targetDateLabel("2027-06-12", "Wedding")).toBe("Wedding · Jun 12, 2027");
  });

  it("says so when nothing is set, and never prints an unreadable date", () => {
    expect(targetDateLabel(null)).toBe("Not set");
    expect(targetDateLabel("soon")).toBe("Not set");
  });
});

describe("weekLine", () => {
  it("names the member's chosen split and its rest day", () => {
    expect(weekLine({ split: { name: "Push / Pull / Legs / Arms / Upper / Lower", restDays: [2] }, trainingDays: 5, cardioDays: 3, mobilityDays: 4, checkInCadence: "Weekly" }))
      .toBe("Push / Pull / Legs / Arms / Upper / Lower · rest Wed");
    expect(weekLine({ split: { name: "Upper / Lower", restDays: [2, 5, 6] }, trainingDays: 4, cardioDays: 2, mobilityDays: 3, checkInCadence: "Weekly" }))
      .toBe("Upper / Lower · rest Wed, Sat, Sun");
  });

  it("describes the program's own week when no split is chosen", () => {
    expect(weekLine({ split: null, trainingDays: 5, cardioDays: 3, mobilityDays: 4, checkInCadence: "Weekly" }))
      .toBe("5 train · 3 cardio · 4 mobility · weekly check-in");
  });
});
