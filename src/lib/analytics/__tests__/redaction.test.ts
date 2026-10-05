import { describe, expect, it } from "vitest";

import { REDACTED, redactAnalyticsLabel, redactAnalyticsMetadata } from "@/lib/analytics/redaction";

describe("analytics metadata redaction", () => {
  it("keeps the operational fields real call sites actually send", () => {
    expect(
      redactAnalyticsMetadata({
        tier: "elite",
        persona: "advanced",
        persisted: true,
        source: "landing",
        leadId: "lead_123",
        durationMs: 412,
      }),
    ).toEqual({
      tier: "elite",
      persona: "advanced",
      persisted: true,
      source: "landing",
      leadId: "lead_123",
      durationMs: 412,
    });
  });

  it("drops health and enhanced-athlete context", () => {
    const out = redactAnalyticsMetadata({
      bloodworkValue: 640,
      compoundName: "redacted-compound",
      dosage: "200mg",
      symptomNote: "felt unwell",
      biomarkerTrend: "rising",
      surface: "bloodwork",
    });
    expect(out.bloodworkValue).toBe(REDACTED);
    expect(out.compoundName).toBe(REDACTED);
    expect(out.dosage).toBe(REDACTED);
    expect(out.symptomNote).toBe(REDACTED);
    expect(out.biomarkerTrend).toBe(REDACTED);
    // The surface being viewed is operational, not health content.
    expect(out.surface).toBe("bloodwork");
  });

  it("drops body measurements and progress photo references", () => {
    const out = redactAnalyticsMetadata({ weightKg: 92.4, bodyFat: 11, photoPath: "u/1.png" });
    expect(Object.values(out)).toEqual([REDACTED, REDACTED, REDACTED]);
  });

  it("drops free-text and direct identifiers", () => {
    const out = redactAnalyticsMetadata({
      messageBody: "private note to my coach",
      email: "member@example.com",
      journalEntry: "how I felt today",
    });
    expect(Object.values(out)).toEqual([REDACTED, REDACTED, REDACTED]);
  });

  it("drops credential-shaped values whatever the key is called", () => {
    const out = redactAnalyticsMetadata({
      harmless: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      other: "sb_secret_abc123",
      third: "service_role",
    });
    expect(Object.values(out)).toEqual([REDACTED, REDACTED, REDACTED]);
  });

  it("redacts a credential even under an allow-listed key", () => {
    expect(redactAnalyticsMetadata({ tier: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" }).tier).toBe(REDACTED);
  });

  it("drops oversized strings that could smuggle a payload", () => {
    expect(redactAnalyticsMetadata({ blob: "x".repeat(201) }).blob).toBe(REDACTED);
    expect(redactAnalyticsMetadata({ blob: "x".repeat(200) }).blob).toBe("x".repeat(200));
  });

  it("passes through unknown but harmless operational keys", () => {
    expect(redactAnalyticsMetadata({ retries: 2, ok: false })).toEqual({ retries: 2, ok: false });
  });

  it("redacts credential-shaped event labels and caps their length", () => {
    expect(redactAnalyticsLabel("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")).toBe(REDACTED);
    expect(redactAnalyticsLabel("page_viewed")).toBe("page_viewed");
    expect(redactAnalyticsLabel("a".repeat(300))).toHaveLength(120);
  });
});
