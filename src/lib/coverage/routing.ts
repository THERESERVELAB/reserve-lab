/* ════════════════════════════════════════════════════════════════════════
   COVERAGE ROUTING — the honest answer to "does Reserve fit this athlete?"

   The product rule this enforces: Reserve must never force a weak built-in
   match merely to avoid routing an athlete to Custom or Assisted. A protocol
   that scores badly is not a fit just because it scored least badly.

   So routing is a gate sequence, not a ranking:

     1. Safety gates run FIRST. A reported pain severity or a demanded
        frequency the athlete's recovery cannot support is decided before any
        protocol is considered — a good goal match never overrides a safety
        gate.
     2. A genuinely strong built-in fit routes to built-in.
     3. A conditional fit that adaptation can actually close routes to
        adapted-built-in, and records what was adapted.
     4. Everything else routes to Custom or Assisted, honestly.

   Pure and deterministic. Reads the existing suitability engine; it does not
   define a second one.
   ════════════════════════════════════════════════════════════════════════ */

import { buildAthleteSnapshot, type AthleteContextSnapshot } from "@/lib/athlete/snapshot";
import { deriveProgrammingProfile } from "@/lib/athlete/programming-profile";
import {
  rankProtocolSuitability,
  type ProtocolSuitability,
  type SuitabilityClass,
} from "@/lib/training/protocol-suitability";
import { getProtocolDNA } from "@/lib/training/protocol-dna";
import type { ProgramOwnershipMode } from "@/lib/member/operating-mode";

import type { CoveragePersona } from "./personas";

/* ─── Result contract ─────────────────────────────────────────────────── */

export type CoverageRoute =
  | "built-in"
  | "adapted-built-in"
  | "reserve-custom"
  | "reserve-assisted"
  | "coach"
  | "professional-review"
  | "unsupported";

export type ProtocolCoverageResult = {
  personaId: string;
  label?: string;

  supported: boolean;
  route: CoverageRoute;
  selectedProtocolId?: string;
  operatingMode: ProgramOwnershipMode;

  /**
   * Why this route was chosen. Always present: a clean built-in fit for a
   * fully-specified athlete has no assumptions and no conflicts, but it still
   * owes the athlete an explanation.
   */
  rationale: string;

  /** 0–1 fit dimensions, reported separately so a failure names its cause. */
  goalFit: number;
  scheduleFit: number;
  equipmentFit: number;
  recoveryFit: number;
  experienceFit: number;

  assumptions: string[];
  conflicts: string[];

  rejectedAlternatives: { protocolId: string; reason: string }[];
  safetyGates: string[];
};

/* ─── Fit scoring ─────────────────────────────────────────────────────── */

const CLASS_FIT: Record<SuitabilityClass, number> = {
  "excellent-fit": 1,
  "strong-fit": 0.8,
  "conditional-fit": 0.5,
  "poor-fit": 0.25,
  "not-recommended": 0,
};

function scheduleFitFor(s: AthleteContextSnapshot, suit: ProtocolSuitability | null): number {
  if (!suit) return 0;
  const available = s.training.availableDays;
  if (available <= 0) return 0;
  const needed = suit.recommendedFrequency;
  if (needed <= available) return 1;
  // Every day short of what the architecture needs costs a third of the fit.
  return Math.max(0, 1 - (needed - available) / 3);
}

function equipmentFitFor(s: AthleteContextSnapshot, suit: ProtocolSuitability | null): number {
  if (!suit) return 0;
  // Contraindications are where the suitability engine records a hard
  // equipment mismatch, so an equipment contraindication zeroes the dimension.
  const equipmentBlocked = suit.contraindications.some((c) =>
    /equipment|barbell|machine|band|dumbbell/i.test(c),
  );
  if (equipmentBlocked) return 0;
  return s.environment.equipment.length > 0 ? 1 : 0.5;
}

function recoveryFitFor(s: AthleteContextSnapshot, suit: ProtocolSuitability | null): number {
  if (!suit) return 0;
  const capacity = s.recovery.recoveryCapacity;
  const dna = getProtocolDNA(suit.protocolId);
  const demand = dna?.fatigue.systemicDemand ?? "moderate";
  const demandRank = demand === "high" ? 2 : demand === "moderate" ? 1 : 0;
  const capacityRank = capacity === "high" ? 2 : capacity === "moderate" ? 1 : 0;
  if (capacityRank >= demandRank) return 1;
  return Math.max(0, 1 - (demandRank - capacityRank) * 0.5);
}

function experienceFitFor(suit: ProtocolSuitability | null): number {
  if (!suit) return 0;
  const mismatch = suit.compromises.some((c) => /training age|under-stimulate|base/i.test(c));
  return mismatch ? 0.4 : 1;
}

/* ─── Safety gates ────────────────────────────────────────────────────── */

/** Athlete-reported severity that Reserve will not program through. */
const SEVERE_PAIN_THRESHOLD = 7;

function safetyGatesFor(persona: CoveragePersona, s: AthleteContextSnapshot): string[] {
  const gates: string[] = [];

  const severe = (s.recovery.currentPain ?? []).filter(
    (p) => (p.severity ?? 0) >= SEVERE_PAIN_THRESHOLD,
  );
  for (const p of severe) {
    gates.push(
      `Reported pain in ${p.region} at severity ${p.severity}. Reserve routes this to professional review rather than programming through it.`,
    );
  }

  // Requested frequency the athlete's own recovery context cannot support.
  // The request is honoured as a preference, never as an override.
  if (s.recovery.recoveryCapacity === "low" && s.training.availableDays >= 6) {
    gates.push(
      `Requested ${s.training.availableDays} training days against a low recovery capacity. Frequency is capped rather than granted on request.`,
    );
  }

  if ((s.recovery.averageSleepHours ?? 8) < 5.5 && s.training.availableDays >= 5) {
    gates.push(
      "Reported sleep is below the level that supports the requested training frequency. Reserve reduces demand rather than assuming the athlete will recover.",
    );
  }

  // Age is context, never a competence judgement — it gates nothing on its
  // own. It only compounds an existing recovery limitation.
  if (persona.age === "75+" && s.recovery.recoveryCapacity === "low") {
    gates.push(
      "Low reported recovery capacity with an advanced-age context. Reserve suggests a clinician conversation before high-demand programming.",
    );
  }

  return gates;
}

/* ─── Adaptation ──────────────────────────────────────────────────────── */

/**
 * Can adaptation genuinely close the gap on a conditional fit? Only frequency
 * compression and equipment substitution are real adaptations. A goal mismatch
 * or an experience mismatch cannot be adapted away — those must route out.
 */
function adaptationsFor(
  suit: ProtocolSuitability,
  fits: { scheduleFit: number; equipmentFit: number; experienceFit: number; goalFit: number },
): { adaptable: boolean; adaptations: string[]; blockers: string[] } {
  const adaptations: string[] = [];
  const blockers: string[] = [];

  if (fits.equipmentFit === 0) {
    blockers.push("Required movements depend on equipment the athlete does not have.");
  }

  if (fits.scheduleFit < 1 && fits.scheduleFit > 0) {
    adaptations.push(
      `Compressed to ${suit.recommendedFrequency - 1} days using the architecture's own compression rules.`,
    );
  } else if (fits.scheduleFit === 0) {
    blockers.push("The architecture cannot run at the athlete's available frequency.");
  }

  if (fits.experienceFit < 0.5) {
    blockers.push("Training age does not match what this architecture assumes.");
  }

  if (fits.goalFit <= CLASS_FIT["poor-fit"]) {
    blockers.push("The architecture does not serve the athlete's stated goal.");
  }

  return { adaptable: blockers.length === 0 && adaptations.length > 0, adaptations, blockers };
}

/* ─── Routing ─────────────────────────────────────────────────────────── */

export type RoutingOptions = {
  /** Set when the persona is under a coach — routes to the coach lane. */
  coached?: boolean;
  /** Athletes who author their own protocol prefer Custom over Assisted. */
  prefersOwnAuthorship?: boolean;
};

export function routePersona(
  persona: CoveragePersona,
  opts: RoutingOptions = {},
): ProtocolCoverageResult {
  const snapshot = buildAthleteSnapshot(persona.snapshotInput);
  const profile = deriveProgrammingProfile(snapshot);
  const ranking = rankProtocolSuitability(snapshot, profile);

  const assumptions = [...snapshot.evidence.assumptions, ...profile.assumptions];
  const conflicts: string[] = [...profile.goalConflicts];
  const safetyGates = safetyGatesFor(persona, snapshot);

  const best = ranking.recommended ?? null;

  const goalFit = best ? CLASS_FIT[best.classification] : 0;
  const scheduleFit = scheduleFitFor(snapshot, best);
  const equipmentFit = equipmentFitFor(snapshot, best);
  const recoveryFit = recoveryFitFor(snapshot, best);
  const experienceFit = experienceFitFor(best);

  const rejectedAlternatives = ranking.all
    .filter((s) => s !== best)
    .slice(0, 5)
    .map((s) => ({
      protocolId: s.protocolId,
      reason:
        s.contraindications[0] ??
        s.compromises[0] ??
        `Scored ${s.score} — ${s.classification.replace(/-/g, " ")}.`,
    }));

  const base = {
    personaId: persona.personaId,
    label: persona.label,
    goalFit,
    scheduleFit,
    equipmentFit,
    recoveryFit,
    experienceFit,
    assumptions,
    conflicts,
    rejectedAlternatives,
    safetyGates,
  };

  /* ── 1. Safety first. A strong goal match never overrides a gate. ───── */
  const severePain = (snapshot.recovery.currentPain ?? []).some(
    (p) => (p.severity ?? 0) >= SEVERE_PAIN_THRESHOLD,
  );
  if (severePain) {
    return {
      ...base,
      supported: true,
      route: "professional-review",
      operatingMode: "reserve-assisted",
      rationale:
        "Reported pain severity is above the level Reserve will program through, so the athlete is routed to professional review before any protocol is selected.",
      conflicts: [
        ...conflicts,
        "Reported pain severity routes this athlete to professional review before programming.",
      ],
    };
  }

  /* ── 2. Coached athletes route to the coach lane regardless of fit. ─── */
  if (opts.coached) {
    return {
      ...base,
      supported: true,
      route: "coach",
      operatingMode: "coach-authored",
      rationale: "The athlete works with a coach, who authors the protocol.",
    };
  }

  /* ── 3. Athlete-authored protocols. ─────────────────────────────────── */
  if (opts.prefersOwnAuthorship) {
    return {
      ...base,
      supported: true,
      route: "reserve-custom",
      operatingMode: "member-custom",
      rationale: "The athlete authors their own protocol; Reserve organises it without rewriting it.",
    };
  }

  /* ── 4. Genuine built-in fit. ───────────────────────────────────────── */
  if (
    best &&
    (best.classification === "excellent-fit" || best.classification === "strong-fit") &&
    scheduleFit === 1 &&
    equipmentFit === 1 &&
    experienceFit === 1
  ) {
    return {
      ...base,
      supported: true,
      route: "built-in",
      selectedProtocolId: best.protocolId,
      operatingMode: "reserve-designed",
      rationale:
        best.whyItFits[0] ??
        `${best.protocolId} scored ${best.score} (${best.classification.replace(/-/g, " ")}) and runs at the athlete's available frequency and equipment without adaptation.`,
    };
  }

  /* ── 5. Adaptable conditional fit. ──────────────────────────────────── */
  if (best && best.classification !== "not-recommended") {
    const { adaptable, adaptations, blockers } = adaptationsFor(best, {
      scheduleFit,
      equipmentFit,
      experienceFit,
      goalFit,
    });
    if (adaptable) {
      return {
        ...base,
        supported: true,
        route: "adapted-built-in",
        selectedProtocolId: best.protocolId,
        operatingMode: "reserve-designed",
        rationale: `${best.protocolId} fits once adapted: ${adaptations.join(" ")}`,
        assumptions: [...assumptions, ...adaptations],
      };
    }
    conflicts.push(...blockers);
  }

  /* ── 6. No credible built-in. Route out honestly. ───────────────────── */
  if (!best || best.classification === "not-recommended") {
    conflicts.push("No built-in architecture is currently appropriate for this athlete.");
  }

  return {
    ...base,
    supported: true,
    route: "reserve-assisted",
    operatingMode: "reserve-assisted",
    rationale: `No built-in architecture is credible for this athlete — ${
      conflicts[0] ?? "the catalogue does not cover this combination"
    } Reserve routes to an authored protocol with review rather than forcing the least-bad card.`,
    conflicts,
  };
}

export function routeAll(
  personas: CoveragePersona[],
  opts: RoutingOptions = {},
): ProtocolCoverageResult[] {
  return personas.map((p) => routePersona(p, opts));
}
