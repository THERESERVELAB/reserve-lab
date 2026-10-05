/* ════════════════════════════════════════════════════════════════════════
   COVERAGE AUDIT — the development-readable report.

   Renders a certification into text a human can read in a terminal or in the
   development inspector. It prints what the gates actually found, including
   failures. It must never soften a failing gate into a passing sentence.
   ════════════════════════════════════════════════════════════════════════ */

import { recommendableProtocolDNA } from "@/lib/training/protocol-dna";

import {
  edgeCasePersonas,
  generateCoveragePersonas,
  pairwiseCoverage,
  type CoveragePersona,
} from "./personas";
import { routeAll } from "./routing";
import { certifyCoverage, type CoverageCertification } from "./report";

export type CoverageAuditOptions = {
  /** CI default is 1,000. The offline audit runs 25,000. */
  personaCount?: number;
  edgeCaseCount?: number;
  seed?: number;
};

export type CoverageAudit = CoverageCertification & {
  personas: CoveragePersona[];
  pairwise: ReturnType<typeof pairwiseCoverage>;
};

export function runCoverageAudit(opts: CoverageAuditOptions = {}): CoverageAudit {
  const generated = generateCoveragePersonas(opts.personaCount ?? 1000, opts.seed);
  const edges = edgeCasePersonas(opts.edgeCaseCount ?? 150);
  const personas = [...generated, ...edges];
  const results = routeAll(personas);
  const certification = certifyCoverage(personas, results, {
    knownProtocolIds: recommendableProtocolDNA().map((d) => d.protocolId),
  });

  return { ...certification, personas, pairwise: pairwiseCoverage(personas) };
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function formatCoverageAudit(audit: CoverageAudit): string {
  const lines: string[] = [];
  const r = audit.report;

  lines.push("═══ RESERVE PROTOCOL COVERAGE AUDIT ═══");
  lines.push(`Personas:        ${r.personaCount}`);
  lines.push(`Supported:       ${r.supportedCount} (${pct(r.supportedRate)})`);
  lines.push(
    `Pairwise spread: ${audit.pairwise.reached}/${audit.pairwise.possible} (${pct(audit.pairwise.rate)})`,
  );
  lines.push("");

  lines.push("── Routes ──");
  for (const [route, count] of Object.entries(r.routeCounts)) {
    if (count === 0) continue;
    lines.push(`  ${route.padEnd(20)} ${String(count).padStart(6)}  ${pct(r.routeRates[route as keyof typeof r.routeRates])}`);
  }
  lines.push("");

  lines.push("── Protocol usage (with the dimension each one respects) ──");
  for (const u of r.protocolUsage.slice(0, 12)) {
    const sel = u.mostSelectiveDimension;
    const selectivity = sel ? `${sel.dimension} ${pct(sel.breadth)}` : "—";
    lines.push(
      `  ${u.protocolId.padEnd(30)} ${String(u.count).padStart(5)}  ${pct(u.share).padStart(6)}  selective on ${selectivity}${u.indiscriminate ? "  ⚠ INDISCRIMINATE" : ""}`,
    );
  }
  if (r.unusedProtocols.length > 0) {
    lines.push(`  UNUSED: ${r.unusedProtocols.join(", ")}`);
  }
  if (r.overusedProtocols.length > 0) {
    lines.push(`  OVERUSED: ${r.overusedProtocols.join(", ")}`);
  }
  lines.push("");

  const cohorts: [string, typeof r.failuresByAge][] = [
    ["age", r.failuresByAge],
    ["goal", r.failuresByGoal],
    ["schedule", r.failuresBySchedule],
    ["equipment", r.failuresByEquipment],
    ["constraint", r.failuresByConstraint],
  ];
  const anyFailures = cohorts.some(([, f]) => f.length > 0);
  lines.push("── Unsupported cohorts ──");
  if (!anyFailures) {
    lines.push("  none");
  } else {
    for (const [name, failures] of cohorts) {
      for (const f of failures) {
        lines.push(`  ${name}/${f.value}: ${f.unsupported}/${f.total} (${pct(f.rate)})`);
      }
    }
  }
  lines.push("");

  lines.push("── Gates ──");
  for (const g of audit.gates) {
    lines.push(`  ${g.passed ? "PASS" : "FAIL"}  ${g.id}`);
    if (!g.passed) {
      for (const f of g.failures.slice(0, 5)) lines.push(`        ${f}`);
      if (g.failures.length > 5) lines.push(`        …and ${g.failures.length - 5} more`);
    }
  }
  lines.push("");
  lines.push(audit.statement);

  return lines.join("\n");
}
