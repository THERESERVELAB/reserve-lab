import { describe, expect, it } from "vitest";

import { formatCoverageAudit, runCoverageAudit } from "../audit";

/**
 * The audit is printed so a coverage regression is readable in CI output
 * rather than buried in an assertion diff. Set COVERAGE_AUDIT_SIZE to run the
 * full offline audit (25000) instead of the CI sweep.
 */
const SIZE = Number(process.env.COVERAGE_AUDIT_SIZE ?? 1000);

describe("coverage audit", () => {
  const audit = runCoverageAudit({ personaCount: SIZE });

  it("prints a development-readable report", () => {
    const text = formatCoverageAudit(audit);
    console.log(`\n${text}\n`);
    expect(text).toContain("RESERVE PROTOCOL COVERAGE AUDIT");
  });

  it("never softens a failing gate into a passing statement", () => {
    if (audit.gates.some((g) => !g.passed)) {
      expect(audit.passed).toBe(false);
      expect(audit.statement).toContain("NOT confirmed");
    } else {
      expect(audit.statement).toContain("Coverage confirmed");
    }
  });

  it("reports every cohort failure it found", () => {
    const text = formatCoverageAudit(audit);
    for (const f of audit.report.failuresByGoal) {
      expect(text).toContain(f.value);
    }
  });
});
