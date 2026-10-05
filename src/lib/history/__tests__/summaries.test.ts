import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { makeChangeEvent, type ChangeAction } from "../change-events";
import { OBSERVATION_EXPLAINER, OBSERVATION_LABEL, changeEventDetails, changeEventTitle, fieldChangeText, observationLines } from "../summaries";

const ACTIONS: ChangeAction[] = ["added", "edited", "paused", "resumed", "activated", "deactivated", "removed", "ended", "reopened", "checkpoint-added", "checkpoint-removed"];
const CAUSE_WORDS = /\b(caus\w*|because|due to|led to|leads to|resulted in|results in|fixed|improv\w*|worsen\w*|helped|hurt|effect of|so that)\b/i;
const at = new Date(2026, 8, 15, 10);

describe("timeline words", () => {
  it("titles every kind of change plainly, without instructions or cause wording", () => {
    for (const action of ACTIONS) {
      const title = changeEventTitle(makeChangeEvent({ at, subject: { kind: "compound", id: "e1", name: "Oxandrolone" }, action }));
      expect(title, action).toContain("Oxandrolone");
      expect(bannedLanguageIn(title), action).toEqual([]);
      expect(title, action).not.toMatch(CAUSE_WORDS);
    }
  });

  it("shows the member's own values, with blanks as not set", () => {
    expect(fieldChangeText({ field: "doseAmount", label: "Amount", from: "20", to: "25" })).toBe("Amount: 20 → 25");
    expect(fieldChangeText({ field: "brand", label: "Product", from: "", to: "Nordic" })).toBe("Product: not set → Nordic");
    const event = makeChangeEvent({ at, subject: { kind: "cycle", id: "c1", name: "Fall cycle" }, action: "edited", changes: [{ field: "plannedWeeks", label: "Planned weeks", from: "12", to: "16" }] });
    expect(changeEventDetails(event)).toEqual(["Planned weeks: 12 → 16"]);
  });

  it("labels observations as timing only and adds nothing of Reserve's own", () => {
    expect(OBSERVATION_LABEL).toBe("Your observation · timing only");
    const lines = observationLines({
      id: "o1",
      date: "2026-09-15",
      changed: { kind: "compound", ref: "e1", label: "Oxandrolone" },
      noticed: { kind: "marker", ref: "hdl", label: "HDL cholesterol" },
      createdAt: "",
    });
    expect(lines).toEqual({ changed: "Changed: Oxandrolone", noticed: "Noticed: HDL cholesterol" });
    for (const text of [OBSERVATION_LABEL, OBSERVATION_EXPLAINER, lines.changed, lines.noticed]) {
      expect(bannedLanguageIn(text), text).toEqual([]);
    }
    expect(`${lines.changed} ${lines.noticed}`).not.toMatch(CAUSE_WORDS);
  });
});
