import { describe, expect, it } from "vitest";

import { formatAffectedWeeks, formatLogDay, localizeWeightRate } from "../event-log-format";

/** The same key domains.ts writes for a date-only observation. */
const epochWeek = (date: string) => Math.floor(Date.parse(`${date}T00:00:00.000Z`) / (7 * 86_400_000));

describe("formatAffectedWeeks", () => {
  it("never prints a raw calendar week key (the audited 'Weeks 2949–2958')", () => {
    const weeks = [epochWeek("2026-07-11"), epochWeek("2026-09-12")];
    const label = formatAffectedWeeks(weeks);
    expect(label).not.toMatch(/\d{4}–\d{4}/);
    expect(label).not.toContain(String(weeks[0]));
    expect(label).toBe("Weeks of Jul 9 – Sep 16, 2026");
  });

  it("covers the whole last week, and names a single week", () => {
    expect(formatAffectedWeeks([epochWeek("2026-09-12")])).toBe("Week of Sep 10 – Sep 16, 2026");
  });

  it("spells both years when the range crosses one", () => {
    expect(formatAffectedWeeks([epochWeek("2025-12-20"), epochWeek("2026-01-05")])).toBe(
      "Weeks of Dec 18, 2025 – Jan 7, 2026",
    );
  });

  it("keeps program weeks as program weeks", () => {
    expect(formatAffectedWeeks([3])).toBe("Program week 3");
    expect(formatAffectedWeeks([5, 3, 4, 3])).toBe("Program weeks 3–5");
  });

  it("returns null with no weeks", () => {
    expect(formatAffectedWeeks([])).toBeNull();
  });
});

describe("localizeWeightRate", () => {
  const finding = "Body weight has been declining at about -0.22 kg per week.";

  it("speaks lb to an imperial member", () => {
    expect(localizeWeightRate(finding, "imperial")).toBe("Body weight has been declining at about -0.49 lb per week.");
  });

  it("leaves a metric member's kg alone", () => {
    expect(localizeWeightRate(finding, "metric")).toBe(finding);
  });

  it("converts every rate in the text and the /week form", () => {
    expect(localizeWeightRate("2 weigh-ins at about 0.5 kg per week; 1 kg/week before.", "imperial")).toBe(
      "2 weigh-ins at about 1.1 lb per week; 2.2 lb per week before.",
    );
  });

  it("leaves text without a rate untouched", () => {
    expect(localizeWeightRate("Body weight has held stable.", "imperial")).toBe("Body weight has held stable.");
  });
});

describe("formatLogDay", () => {
  it("formats a local day without a locale", () => {
    expect(formatLogDay(new Date(2026, 8, 15, 23, 30))).toBe("Sep 15, 2026");
  });
});
