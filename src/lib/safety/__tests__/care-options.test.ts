import { describe, expect, it } from "vitest";

import { CARE_OPTIONS, NO_CLINICIAN_LINE } from "../care-options";
import { EMERGENCY_COPY, ESCALATION_LABEL } from "../escalation";
import { bannedLanguageIn } from "./compliance-language";

/**
 * Many members run a cycle with no clinician. Every escalation has to name
 * people anyone can reach — and still never a treatment.
 */
describe("care without a clinician", () => {
  it("names people anyone can reach, most urgent first", () => {
    expect(CARE_OPTIONS.map((o) => o.key)).toEqual(["emergency", "urgent", "telehealth", "pharmacist", "own-labs", "regular-care"]);
    expect(CARE_OPTIONS[0].title).toMatch(/911/);
    expect(CARE_OPTIONS[0].title).toMatch(/988/);
  });

  it("does not make a clinician the only route", () => {
    for (const label of Object.values(ESCALATION_LABEL)) expect(label).not.toMatch(/your clinician/i);
    expect(EMERGENCY_COPY.urgent).toMatch(/telehealth/);
    expect(NO_CLINICIAN_LINE).toMatch(/Urgent care, a telehealth visit or a pharmacist/);
  });

  it("names people, never a treatment, and says nothing the compliance rules forbid", () => {
    for (const option of CARE_OPTIONS) {
      for (const text of [option.title, option.forWhat]) {
        expect(bannedLanguageIn(text), text).toEqual([]);
        expect(text, text).not.toMatch(/\b(?:minoxidil|finasteride|anastrozole|clomiphene|tamoxifen|hcg)\b/i);
      }
    }
  });
});
