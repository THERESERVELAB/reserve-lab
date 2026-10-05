/* ════════════════════════════════════════════════════════════════════════
   STRUCTURAL SIGNATURE + COLLISION AUDIT

   Compares what protocols actually GENERATE, not what they are called. The
   signature is derived entirely from Protocol DNA (which itself derives its
   topology from the real blueprint), so two protocols can only score as
   similar when their generated weeks genuinely are.

   Ids and display names are deliberately excluded from the score — renaming
   a protocol must not change its collision result.
   ════════════════════════════════════════════════════════════════════════ */

import {
  CONDITIONING_ARCHETYPES,
  FAMILY_LABEL,
  allProtocolDNA,
  getProtocolDNA,
  type ProtocolDNA,
} from "./protocol-dna";

export type CollisionRisk = "low" | "moderate" | "high";

export type CollisionClass =
  | "UNIQUE"
  | "RELATED BUT DISTINCT"
  | "QUESTIONABLY SIMILAR"
  | "FUNCTIONALLY DUPLICATED"
  | "BROKEN OR UNRESOLVED";

export type StructuralSignature = {
  protocolId: string;
  family: string;
  /** Ordered day archetypes, Mon…Sun ("rest" for recovery). */
  daySequence: string[];
  /** Sorted set of training-day archetypes. */
  dayArchetypes: string[];
  trainingDays: number;
  muscleFrequency: Record<string, number>;
  movementFrequency: Record<string, number>;
  primaryLiftExposure: number;
  conditioningExposures: number;
  outdoorExposures: number;
  progressionModel: string;
  phaseSequence: string[];
  recoveryDemand: string;
  systemicDemand: string;
  impactDemand: string;
  nutritionDemand: string;
  supportedFrequencies: number[];
};

const OUTDOOR_ARCHETYPES = new Set(["outdoor-distance"]);

export function structuralSignature(dna: ProtocolDNA): StructuralSignature {
  const week = dna.topology.canonicalWeek;
  const training = week.filter((d) => !d.recovery);
  const daySequence = week.map((d) => (d.recovery ? "rest" : d.archetype));

  return {
    protocolId: dna.protocolId,
    family: dna.identity.family,
    daySequence,
    dayArchetypes: [...new Set(training.map((d) => d.archetype))].sort(),
    trainingDays: training.length,
    muscleFrequency: dna.stimulus.muscleFrequency,
    movementFrequency: dna.stimulus.movementFrequency,
    primaryLiftExposure: dna.stimulus.primaryLiftPolicy ? training.filter((d) => d.intent === "strength").length : 0,
    conditioningExposures: training.filter((d) => CONDITIONING_ARCHETYPES.has(d.archetype)).length,
    outdoorExposures: training.filter((d) => OUTDOOR_ARCHETYPES.has(d.archetype)).length,
    progressionModel: dna.progression.model,
    phaseSequence: dna.phases.map((p) => p.id),
    recoveryDemand: dna.fatigue.recoveryDemand,
    systemicDemand: dna.fatigue.systemicDemand,
    impactDemand: dna.fatigue.impactDemand ?? "none",
    nutritionDemand: dna.nutrition.demandClass,
    supportedFrequencies: dna.topology.supportedFrequencies,
  };
}

/* ─── Similarity primitives ───────────────────────────────────────────── */

function jaccard(a: readonly string[], b: readonly string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

function sequenceAgreement(a: readonly string[], b: readonly string[]): number {
  const n = Math.max(a.length, b.length);
  if (n === 0) return 1;
  let hits = 0;
  for (let i = 0; i < n; i += 1) if (a[i] === b[i]) hits += 1;
  return hits / n;
}

/** Cosine-style agreement across a frequency map. */
function frequencyAgreement(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  if (keys.size === 0) return 1;
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) {
    const x = a[k] ?? 0;
    const y = b[k] ?? 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  if (na === 0 || nb === 0) return na === nb ? 1 : 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function textAgreement(a: string, b: string): number {
  return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
}

/* ─── The comparison ──────────────────────────────────────────────────── */

export type StructureComparison = {
  similarityScore: number;
  sharedFeatures: string[];
  meaningfulDifferences: string[];
  collisionRisk: CollisionRisk;
  classification: CollisionClass;
};

const WEIGHTS = {
  daySequence: 0.2,
  dayArchetypes: 0.15,
  muscleFrequency: 0.15,
  movementFrequency: 0.12,
  phaseSequence: 0.15,
  progressionModel: 0.08,
  conditioningShape: 0.08,
  demandProfile: 0.07,
} as const;

export function compareProtocolStructures(
  a: ProtocolDNA | string,
  b: ProtocolDNA | string,
): StructureComparison {
  const dnaA = typeof a === "string" ? getProtocolDNA(a) : a;
  const dnaB = typeof b === "string" ? getProtocolDNA(b) : b;
  if (!dnaA || !dnaB) {
    return {
      similarityScore: 0,
      sharedFeatures: [],
      meaningfulDifferences: ["One or both protocols have no DNA record."],
      collisionRisk: "low",
      classification: "BROKEN OR UNRESOLVED",
    };
  }

  const sa = structuralSignature(dnaA);
  const sb = structuralSignature(dnaB);

  const parts = {
    daySequence: sequenceAgreement(sa.daySequence, sb.daySequence),
    dayArchetypes: jaccard(sa.dayArchetypes, sb.dayArchetypes),
    muscleFrequency: frequencyAgreement(sa.muscleFrequency, sb.muscleFrequency),
    movementFrequency: frequencyAgreement(sa.movementFrequency, sb.movementFrequency),
    phaseSequence: sequenceAgreement(sa.phaseSequence, sb.phaseSequence),
    progressionModel: textAgreement(sa.progressionModel, sb.progressionModel),
    conditioningShape:
      sa.conditioningExposures === sb.conditioningExposures && sa.outdoorExposures === sb.outdoorExposures ? 1 : 0,
    demandProfile:
      (sa.recoveryDemand === sb.recoveryDemand ? 0.34 : 0) +
      (sa.systemicDemand === sb.systemicDemand ? 0.33 : 0) +
      (sa.nutritionDemand === sb.nutritionDemand ? 0.33 : 0),
  };

  let score = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) {
    score += (parts[k as keyof typeof parts] ?? 0) * w;
  }
  const similarityScore = Math.round(score * 1000) / 1000;

  const shared: string[] = [];
  const different: string[] = [];

  const note = (cond: boolean, sharedText: string, diffText: string) => {
    if (cond) shared.push(sharedText); else different.push(diffText);
  };

  note(parts.daySequence >= 0.7, "Nearly identical Mon–Sun day sequence",
    `Different weekly order (${Math.round(parts.daySequence * 100)}% day-slot agreement)`);
  note(parts.dayArchetypes >= 0.7, "Largely the same session archetypes",
    `Different session archetypes (${sa.dayArchetypes.length} vs ${sb.dayArchetypes.length} distinct)`);
  note(parts.muscleFrequency >= 0.85, "Comparable weekly muscle frequency",
    "Different weekly muscle exposure distribution");
  note(parts.movementFrequency >= 0.85, "Comparable movement-pattern exposure",
    "Different movement-pattern exposure");
  note(parts.phaseSequence >= 0.8, "The same phase sequence",
    `Different phase sequence (${sa.phaseSequence.join(" → ")} vs ${sb.phaseSequence.join(" → ")})`);
  note(parts.progressionModel === 1, "Identical progression model",
    "Different progression model");
  note(parts.conditioningShape === 1,
    `The same conditioning shape (${sa.conditioningExposures} conditioning, ${sa.outdoorExposures} outdoor)`,
    `Different conditioning shape (${sa.conditioningExposures}/${sa.outdoorExposures} vs ${sb.conditioningExposures}/${sb.outdoorExposures} conditioning/outdoor)`);
  note(sa.trainingDays === sb.trainingDays, `Both author ${sa.trainingDays} training days`,
    `Different authored training days (${sa.trainingDays} vs ${sb.trainingDays})`);
  note(sa.recoveryDemand === sb.recoveryDemand, `Both carry ${sa.recoveryDemand} recovery demand`,
    `Different recovery demand (${sa.recoveryDemand} vs ${sb.recoveryDemand})`);
  note(sa.nutritionDemand === sb.nutritionDemand, `Both carry ${sa.nutritionDemand} nutrition demand`,
    `Different nutrition demand (${sa.nutritionDemand} vs ${sb.nutritionDemand})`);
  if (sa.family !== sb.family) different.push(`Different family (${FAMILY_LABEL[dnaA.identity.family]} vs ${FAMILY_LABEL[dnaB.identity.family]})`);
  else shared.push(`Both in the ${FAMILY_LABEL[dnaA.identity.family]} family`);

  const collisionRisk: CollisionRisk = similarityScore >= 0.85 ? "high" : similarityScore >= 0.7 ? "moderate" : "low";

  const classification: CollisionClass =
    similarityScore >= 0.92 ? "FUNCTIONALLY DUPLICATED"
      : similarityScore >= 0.8 ? "QUESTIONABLY SIMILAR"
        : similarityScore >= 0.55 ? "RELATED BUT DISTINCT"
          : "UNIQUE";

  return { similarityScore, sharedFeatures: shared, meaningfulDifferences: different, collisionRisk, classification };
}

/* ─── Full-catalogue audit ────────────────────────────────────────────── */

export type CollisionPair = {
  a: string;
  b: string;
  similarityScore: number;
  classification: CollisionClass;
  collisionRisk: CollisionRisk;
  meaningfulDifferences: string[];
};

/** Every protocol pair, most similar first. */
export function auditProtocolCollisions(pool?: ProtocolDNA[]): CollisionPair[] {
  const all = pool ?? allProtocolDNA();
  const out: CollisionPair[] = [];
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      const cmp = compareProtocolStructures(all[i], all[j]);
      out.push({
        a: all[i].protocolId,
        b: all[j].protocolId,
        similarityScore: cmp.similarityScore,
        classification: cmp.classification,
        collisionRisk: cmp.collisionRisk,
        meaningfulDifferences: cmp.meaningfulDifferences,
      });
    }
  }
  return out.sort((x, y) => y.similarityScore - x.similarityScore);
}

/** Pairs that are close enough to warrant an explicit justification. */
export function unresolvedCollisions(pool?: ProtocolDNA[]): CollisionPair[] {
  return auditProtocolCollisions(pool).filter(
    (p) => p.classification === "FUNCTIONALLY DUPLICATED" || p.classification === "QUESTIONABLY SIMILAR",
  );
}
