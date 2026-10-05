/* ════════════════════════════════════════════════════════════════════════
   COVERAGE REPORT + PASS GATES.

   The report aggregates routing results. The gates decide whether Reserve is
   allowed to say "coverage confirmed" at all.

   A gate failure is a product finding, not a test bug. When a cohort fails,
   the honest response is to report it — never to widen a threshold or assign
   a generic protocol so the number looks better.
   ════════════════════════════════════════════════════════════════════════ */

import type { CoveragePersona } from "./personas";
import type { CoverageRoute, ProtocolCoverageResult } from "./routing";

/* ─── Report ──────────────────────────────────────────────────────────── */

export type CohortFailure = {
  cohort: string;
  value: string;
  total: number;
  unsupported: number;
  rate: number;
};

export type CoverageReport = {
  personaCount: number;
  supportedCount: number;
  supportedRate: number;

  routeCounts: Record<CoverageRoute, number>;
  routeRates: Record<CoverageRoute, number>;

  failuresByAge: CohortFailure[];
  failuresByGoal: CohortFailure[];
  failuresBySchedule: CohortFailure[];
  failuresByEquipment: CohortFailure[];
  failuresByConstraint: CohortFailure[];

  /** Protocols selected far more often than an even spread would predict. */
  protocolUsage: ProtocolUsage[];
  overusedProtocols: string[];
  unusedProtocols: string[];
};

export type ProtocolUsage = {
  protocolId: string;
  count: number;
  share: number;
  /**
   * For each persona dimension, the fraction of that dimension's values this
   * protocol absorbed. 1 means it took every value — it discriminated on
   * nothing along that axis.
   */
  dimensionBreadth: Record<string, number>;
  /** The dimension this protocol is most selective on, and how selective. */
  mostSelectiveDimension: { dimension: string; breadth: number } | null;
  /**
   * True when the protocol absorbs nearly every value of EVERY dimension —
   * it is not serving a structural cohort, it is simply swallowing athletes.
   */
  indiscriminate: boolean;
};

const ALL_ROUTES: CoverageRoute[] = [
  "built-in",
  "adapted-built-in",
  "reserve-custom",
  "reserve-assisted",
  "coach",
  "professional-review",
  "unsupported",
];

function cohortFailures(
  personas: CoveragePersona[],
  results: ProtocolCoverageResult[],
  key: keyof CoveragePersona,
): CohortFailure[] {
  const byValue = new Map<string, { total: number; unsupported: number }>();
  personas.forEach((p, i) => {
    const value = String(p[key]);
    const entry = byValue.get(value) ?? { total: 0, unsupported: 0 };
    entry.total += 1;
    if (!results[i].supported || results[i].route === "unsupported") entry.unsupported += 1;
    byValue.set(value, entry);
  });

  return [...byValue.entries()]
    .map(([value, e]) => ({
      cohort: String(key),
      value,
      total: e.total,
      unsupported: e.unsupported,
      rate: e.total === 0 ? 0 : e.unsupported / e.total,
    }))
    .filter((f) => f.unsupported > 0)
    .sort((a, b) => b.rate - a.rate);
}

export function buildCoverageReport(
  personas: CoveragePersona[],
  results: ProtocolCoverageResult[],
  opts: {
    knownProtocolIds?: string[];
    overuseThreshold?: number;
    /** Breadth at or above which a protocol counts as discriminating on nothing. */
    selectivityBound?: number;
  } = {},
): CoverageReport {
  const personaCount = results.length;
  const supportedCount = results.filter((r) => r.supported && r.route !== "unsupported").length;

  const routeCounts = Object.fromEntries(ALL_ROUTES.map((r) => [r, 0])) as Record<
    CoverageRoute,
    number
  >;
  for (const r of results) routeCounts[r.route] += 1;

  const routeRates = Object.fromEntries(
    ALL_ROUTES.map((r) => [r, personaCount === 0 ? 0 : routeCounts[r] / personaCount]),
  ) as Record<CoverageRoute, number>;

  /* Usage, plus how selective each protocol actually is.

     Raw share alone is the wrong measure. A uniformly-sampled stress sweep
     gives every training age and every constraint equal weight, so a protocol
     gated on a legitimately large cohort (a foundation block serving early
     training ages) shows a high share while behaving correctly. What
     distinguishes real overuse is whether the protocol DISCRIMINATES: a
     protocol that absorbs every value of every dimension is not serving a
     cohort, it is swallowing athletes that belong elsewhere. */
  const usage = new Map<string, number>();
  const personasFor = new Map<string, CoveragePersona[]>();
  results.forEach((r, i) => {
    const id = r.selectedProtocolId;
    if (!id) return;
    usage.set(id, (usage.get(id) ?? 0) + 1);
    personasFor.set(id, [...(personasFor.get(id) ?? []), personas[i]]);
  });

  const dimensions = [
    "sex", "age", "size", "trainingAge",
    "goal", "availability", "equipment", "constraint",
  ] as const;

  /** How many distinct values of each dimension the whole sweep contains. */
  const sweepBreadth: Record<string, number> = {};
  for (const d of dimensions) {
    sweepBreadth[d] = new Set(personas.map((p) => String(p[d as keyof CoveragePersona]))).size;
  }

  const selectedTotal = [...usage.values()].reduce((a, b) => a + b, 0);
  const indiscriminateBound = opts.selectivityBound ?? 0.9;

  const protocolUsage: ProtocolUsage[] = [...usage.entries()]
    .map(([protocolId, count]) => {
      const got = personasFor.get(protocolId) ?? [];
      const dimensionBreadth: Record<string, number> = {};
      for (const d of dimensions) {
        const absorbed = new Set(got.map((p) => String(p[d as keyof CoveragePersona]))).size;
        dimensionBreadth[d] = sweepBreadth[d] === 0 ? 0 : absorbed / sweepBreadth[d];
      }
      const entries = Object.entries(dimensionBreadth);
      const mostSelective = entries.reduce<{ dimension: string; breadth: number } | null>(
        (best, [dimension, breadth]) =>
          best === null || breadth < best.breadth ? { dimension, breadth } : best,
        null,
      );
      return {
        protocolId,
        count,
        share: selectedTotal === 0 ? 0 : count / selectedTotal,
        dimensionBreadth,
        mostSelectiveDimension: mostSelective,
        indiscriminate: (mostSelective?.breadth ?? 1) >= indiscriminateBound,
      };
    })
    .sort((a, b) => b.count - a.count);

  /* Overused = a large share AND no dimension it respects. A protocol may
     dominate a cohort it structurally serves; it may not dominate by
     discriminating on nothing. */
  const overuseThreshold = opts.overuseThreshold ?? 0.35;
  const overusedProtocols = protocolUsage
    .filter((p) => p.share > overuseThreshold && p.indiscriminate)
    .map((p) => p.protocolId);

  const known = opts.knownProtocolIds ?? [];
  const unusedProtocols = known.filter((id) => !usage.has(id));

  return {
    personaCount,
    supportedCount,
    supportedRate: personaCount === 0 ? 0 : supportedCount / personaCount,
    routeCounts,
    routeRates,
    failuresByAge: cohortFailures(personas, results, "age"),
    failuresByGoal: cohortFailures(personas, results, "goal"),
    failuresBySchedule: cohortFailures(personas, results, "availability"),
    failuresByEquipment: cohortFailures(personas, results, "equipment"),
    failuresByConstraint: cohortFailures(personas, results, "constraint"),
    protocolUsage,
    overusedProtocols,
    unusedProtocols,
  };
}

/* ─── Pass gates ──────────────────────────────────────────────────────── */

export type GateResult = {
  id: string;
  description: string;
  passed: boolean;
  failures: string[];
};

/**
 * The fifteen gates that must all pass before Reserve may state that coverage
 * is confirmed. Each returns the specific personas that failed it, so a
 * failure is actionable rather than a bare boolean.
 */
export function evaluateCoverageGates(
  personas: CoveragePersona[],
  results: ProtocolCoverageResult[],
  report: CoverageReport,
): GateResult[] {
  const byId = new Map(personas.map((p, i) => [p.personaId, { persona: p, result: results[i] }]));
  const gates: GateResult[] = [];

  const gate = (id: string, description: string, failures: string[]) =>
    gates.push({ id, description, passed: failures.length === 0, failures });

  /* 1 — every persona receives a valid route */
  gate(
    "every-persona-routed",
    "Every supported persona receives a valid route.",
    results.filter((r) => !ALL_ROUTES.includes(r.route)).map((r) => r.personaId),
  );

  /* 2 — no structurally incompatible protocol is forced */
  gate(
    "no-forced-incompatible-protocol",
    "No athlete is forced into a structurally incompatible protocol.",
    results
      .filter((r) => r.selectedProtocolId && (r.goalFit <= 0.25 || r.experienceFit < 0.5))
      .map((r) => `${r.personaId} → ${r.selectedProtocolId}`),
  );

  /* 3 — no required exercise depends on unavailable equipment */
  gate(
    "no-unavailable-equipment",
    "No selected protocol depends on equipment the athlete does not have.",
    results.filter((r) => r.selectedProtocolId && r.equipmentFit === 0).map((r) => r.personaId),
  );

  /* 4 — no beginner receives elite contest volume */
  gate(
    "no-beginner-contest-volume",
    "No beginner receives elite contest-level volume.",
    [...byId.values()]
      .filter(
        ({ persona, result }) =>
          (persona.trainingAge === "never-trained" || persona.trainingAge === "beginner") &&
          result.selectedProtocolId != null &&
          /contest|championship|specialization/.test(result.selectedProtocolId),
      )
      .map(({ persona, result }) => `${persona.personaId} → ${result.selectedProtocolId}`),
  );

  /* 5 — no advanced athlete receives token programming */
  gate(
    "no-advanced-token-programming",
    "No advanced or elite athlete receives a foundation-level program as a built-in fit.",
    [...byId.values()]
      .filter(
        ({ persona, result }) =>
          (persona.trainingAge === "advanced" || persona.trainingAge === "elite") &&
          result.route === "built-in" &&
          /foundation|lifestyle-reset/.test(result.selectedProtocolId ?? ""),
      )
      .map(({ persona, result }) => `${persona.personaId} → ${result.selectedProtocolId}`),
  );

  /* 6 — recovery-constrained athletes are not granted unsafe frequency */
  gate(
    "recovery-constrained-frequency-capped",
    "No recovery-constrained athlete is given unsafe frequency merely because they requested it.",
    [...byId.values()]
      .filter(
        ({ persona, result }) =>
          persona.constraint === "recovery-constrained" &&
          persona.availableDays >= 6 &&
          result.safetyGates.length === 0,
      )
      .map(({ persona }) => persona.personaId),
  );

  /* 7 — body weight alone never determines the route */
  const weightOnlyCohorts = ["higher-body-weight", "lower-body-weight"];
  const weightRouteSpread = new Set(
    [...byId.values()]
      .filter(({ persona }) => weightOnlyCohorts.includes(persona.size))
      .map(({ result }) => result.route),
  );
  gate(
    "weight-alone-does-not-route",
    "Body weight alone does not determine the route.",
    weightRouteSpread.size <= 1 && weightRouteSpread.size > 0
      ? [`All weight-cohort personas collapsed to a single route: ${[...weightRouteSpread][0]}`]
      : [],
  );

  /* 8 — age modifies context without stereotyping */
  const olderBuiltIn = [...byId.values()].filter(
    ({ persona, result }) =>
      (persona.age === "65-74" || persona.age === "75+") &&
      (result.route === "built-in" || result.route === "adapted-built-in"),
  );
  gate(
    "age-does-not-stereotype",
    "Age modifies context without becoming a crude capability stereotype.",
    olderBuiltIn.length === 0
      ? ["No older-adult persona reached a built-in or adapted route."]
      : [],
  );

  /* 9 — missing data produces assumptions, not invented values */
  gate(
    "missing-data-becomes-assumption",
    "Missing information produces explicit assumptions rather than invented values.",
    [...byId.values()]
      .filter(
        ({ persona, result }) =>
          persona.size === "unknown-composition" && result.assumptions.length === 0,
      )
      .map(({ persona }) => persona.personaId),
  );

  /* 10 — custom/assisted is selected when no built-in is credible */
  gate(
    "no-credible-fit-routes-out",
    "An athlete with no credible built-in fit routes to Custom or Assisted.",
    results
      .filter(
        (r) =>
          (r.route === "built-in" || r.route === "adapted-built-in") &&
          r.goalFit <= 0.25 &&
          r.selectedProtocolId != null,
      )
      .map((r) => r.personaId),
  );

  /* 11 — professional-review route remains reachable */
  gate(
    "professional-review-reachable",
    "The professional-review route remains available and reachable.",
    report.routeCounts["professional-review"] === 0
      ? ["No persona reached the professional-review route."]
      : [],
  );

  /* 12 — every result carries a route */
  gate(
    "result-carries-route",
    "Every coverage result contains a route.",
    results.filter((r) => !r.route).map((r) => r.personaId),
  );

  /* 13 — rejected alternatives include reasons */
  gate(
    "rejected-alternatives-explained",
    "Every rejected alternative carries a reason.",
    results
      .filter((r) => r.rejectedAlternatives.some((a) => !a.reason || a.reason.trim() === ""))
      .map((r) => r.personaId),
  );

  /* 14 — protocol overuse.
     Fails only when a protocol holds a large share AND respects no dimension.
     A protocol gated on a genuinely large cohort (a foundation block serving
     early training ages) is not overuse; a protocol absorbing every goal AND
     every training age AND every constraint is. */
  gate(
    "no-protocol-overuse",
    "No single protocol absorbs a large share of selections while discriminating on nothing.",
    report.overusedProtocols.map((id) => {
      const u = report.protocolUsage.find((p) => p.protocolId === id);
      const sel = u?.mostSelectiveDimension;
      return `${id} holds ${Math.round((u?.share ?? 0) * 100)}% of selections and respects no dimension (most selective: ${sel?.dimension ?? "none"} at ${Math.round((sel?.breadth ?? 1) * 100)}% breadth)`;
    }),
  );

  /* 15 — every recommendation is explainable.
     Checks the rationale, not assumptions/conflicts: a clean built-in fit for
     a fully-specified athlete legitimately has nothing to assume and nothing
     to flag, but it still owes the athlete a reason. */
  gate(
    "every-route-explainable",
    "Every routed athlete carries a rationale explaining the decision.",
    results.filter((r) => !r.rationale || r.rationale.trim().length === 0).map((r) => r.personaId),
  );

  return gates;
}

export type CoverageCertification = {
  report: CoverageReport;
  gates: GateResult[];
  passed: boolean;
  failedGateIds: string[];
  /** The single honest sentence a report may print. */
  statement: string;
};

export function certifyCoverage(
  personas: CoveragePersona[],
  results: ProtocolCoverageResult[],
  opts: { knownProtocolIds?: string[] } = {},
): CoverageCertification {
  const report = buildCoverageReport(personas, results, opts);
  const gates = evaluateCoverageGates(personas, results, report);
  const failed = gates.filter((g) => !g.passed);

  return {
    report,
    gates,
    passed: failed.length === 0,
    failedGateIds: failed.map((g) => g.id),
    statement:
      failed.length === 0
        ? `Coverage confirmed across ${report.personaCount} personas — all ${gates.length} gates passed.`
        : `Coverage NOT confirmed — ${failed.length} of ${gates.length} gates failed: ${failed
            .map((g) => g.id)
            .join(", ")}.`,
  };
}
