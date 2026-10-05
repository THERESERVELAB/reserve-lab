/* ════════════════════════════════════════════════════════════════════════
   PROTOCOL SUITABILITY — scoring every architecture against the athlete.

   Not a goal-keyword matcher. Each protocol's DNA is evaluated against the
   derived programming profile: capacity, recovery, schedule, impact
   tolerance, composition context, training age, and existing activity load.

   Two athletes with the same stated goal can and should land on different
   protocols and different frequencies. Body weight alone never selects
   anything — it is always read alongside height, composition, training age,
   conditioning history, and goal.

   Protocols are RANKED, not hidden. The only reason a protocol disappears is
   a real eligibility gate (log-only, lifestyle-gated). Everything else is
   surfaced with an honest classification the athlete can override.
   ════════════════════════════════════════════════════════════════════════ */

import {
  bandRank,
  goalSignalStrength,
  readGoalSignals,
  type AthleteProgrammingProfile,
  type CapacityBand,
} from "@/lib/athlete/programming-profile";
import { bmi, type AthleteContextSnapshot, type ExperienceBand } from "@/lib/athlete/snapshot";
import {
  FAMILY_LABEL,
  getProtocolDNA,
  isConditioningDay,
  recommendableProtocolDNA,
  type ProtocolDNA,
  type ProtocolDNAFamily,
} from "./protocol-dna";

export type SuitabilityClass =
  | "excellent-fit"
  | "strong-fit"
  | "conditional-fit"
  | "poor-fit"
  | "not-recommended";

export const SUITABILITY_LABEL: Record<SuitabilityClass, string> = {
  "excellent-fit": "Recommended",
  "strong-fit": "Good alternative",
  "conditional-fit": "Conditional",
  "poor-fit": "Not currently appropriate",
  "not-recommended": "Not currently appropriate",
};

export type ProtocolSuitability = {
  protocolId: string;
  athleteSnapshotVersion: string;

  score: number;
  classification: SuitabilityClass;

  recommendedFrequency: number;
  recommendedDurationWeeks: number;

  whyItFits: string[];
  whatTheSplitWillDo: string[];
  expectedBenefits: string[];
  compromises: string[];
  recoveryRequirements: string[];
  nutritionRequirements: string[];
  risks: string[];
  contraindications: string[];

  personalizationFactors: {
    weightContext?: string;
    bodyCompositionContext?: string;
    goalContext: string;
    trainingAgeContext: string;
    scheduleContext: string;
    recoveryContext: string;
    activityContext: string;
  };

  adaptationTriggers: string[];
  missingInformation: string[];
  assumptions: string[];
};

/* ─── Goal → family affinity ──────────────────────────────────────────── */

const EXPERIENCE_RANK: Record<ExperienceBand, number> = {
  beginner: 0, novice: 1, intermediate: 2, advanced: 3, elite: 4,
};

type GoalKey = keyof ReturnType<typeof readGoalSignals>;

/** How strongly each family serves each goal signal. Positive = serves it. */
const FAMILY_GOAL_AFFINITY: Record<ProtocolDNAFamily, Partial<Record<GoalKey, number>>> = {
  "classic-physique": { physique: 14, leanGain: 6, recomp: 4, contest: 4 },
  "balanced-hypertrophy": { physique: 8, leanGain: 8, recomp: 8, general: 6, strength: 2 },
  "weak-point-specialization": { physique: 10, leanGain: 6 },
  "contest-preparation": { contest: 16, physique: 8, fatLoss: 5 },
  powerbuilding: { strength: 14, leanGain: 10, physique: 4, performance: 4 },
  strength: { strength: 16, performance: 4 },
  "performance-hybrid": { performance: 12, physique: 6, leanGain: 4, endurance: 3, hybrid: 8 },
  "tactical-hybrid": { performance: 12, endurance: 6, general: 3, hybrid: 6 },
  "grand-touring": { hybrid: 16, endurance: 10, physique: 8, performance: 8, recomp: 4 },
  "endurance-physique": { endurance: 16, performance: 6, recomp: 3, hybrid: 4 },
  "fat-loss": { fatLoss: 16, recomp: 6, general: 3 },
  "lean-mass": { leanGain: 16, strength: 6, physique: 5 },
  recomposition: { recomp: 16, fatLoss: 6, leanGain: 5, physique: 3 },
  // A foundation block genuinely serves a muscle, strength, or composition
  // goal at an early training age — it is the route to them, not an
  // alternative to them. Claiming no affinity made Reserve push beginners
  // onto more aggressive architectures the moment they said "build muscle".
  beginner: { general: 12, leanGain: 6, physique: 4, strength: 4, fatLoss: 3, recomp: 3 },
  "recovery-constrained": { general: 6, leanGain: 4, physique: 3, strength: 3, recomp: 3, fatLoss: 3 },
  "home-gym": { physique: 4, leanGain: 4, general: 5, recomp: 4 },
  "womens-performance": { physique: 8, recomp: 6, leanGain: 5, performance: 4 },
  lifestyle: { general: 12, fatLoss: 3 },
  "log-only": {},
};

/** Families whose whole point is a primary-lift progression. */
const PRIMARY_LIFT_FAMILIES: ReadonlySet<ProtocolDNAFamily> = new Set(["powerbuilding", "strength"]);

/** Robust defaults — the right bet when Reserve does not know the athlete yet. */
const ROBUST_DEFAULT_FAMILIES: ReadonlySet<ProtocolDNAFamily> = new Set([
  "balanced-hypertrophy", "lifestyle", "beginner", "recomposition",
]);

/** Families that make a specific, expensive bet about the athlete. */
const SPECIALIZED_BET_FAMILIES: ReadonlySet<ProtocolDNAFamily> = new Set([
  "weak-point-specialization", "contest-preparation", "grand-touring",
  "endurance-physique", "tactical-hybrid", "strength", "classic-physique",
]);

/* ─── Frequency selection ─────────────────────────────────────────────── */

/**
 * The frequency Reserve would actually run this protocol at for this athlete:
 * the overlap between what the protocol supports and what the athlete's
 * capacity profile allows. Never above the athlete's stated availability.
 */
export function recommendFrequency(dna: ProtocolDNA, profile: AthleteProgrammingProfile, snapshot: AthleteContextSnapshot): number {
  const [capMin, capMax] = profile.preferredFrequencyRange;
  const supported = [...dna.topology.supportedFrequencies].sort((a, b) => a - b);
  const available = snapshot.training.availableDays;

  // Candidates the protocol supports that the athlete can actually reach.
  const inRange = supported.filter((f) => f <= Math.min(capMax, available) && f >= Math.min(capMin, available));
  if (inRange.length > 0) return inRange[inRange.length - 1];

  // Otherwise take the highest supported frequency at or below the ceiling.
  const ceiling = Math.min(capMax, available);
  const below = supported.filter((f) => f <= ceiling);
  if (below.length > 0) return below[below.length - 1];

  // The protocol's minimum exceeds the athlete's ceiling — report the minimum
  // honestly so the compromise is visible rather than hidden.
  return supported[0] ?? available;
}

function recommendDuration(dna: ProtocolDNA, snapshot: AthleteContextSnapshot): number {
  // An event date, when present, sets the block length.
  if (snapshot.objectives.eventDate) {
    const days = (Date.parse(snapshot.objectives.eventDate) - Date.parse(snapshot.capturedAt)) / 86_400_000;
    if (Number.isFinite(days) && days > 20) return Math.max(4, Math.min(24, Math.round(days / 7)));
  }
  const phaseWeightTotal = dna.phases.reduce((s, p) => s + (p.fixedWeeks ?? p.weight), 0);
  // A sensible default block: enough weeks for every phase to be at least one.
  const minimum = Math.max(8, dna.phases.length + 2);
  return Math.max(minimum, Math.min(16, Math.round(phaseWeightTotal * 1.4)));
}

/* ─── Scoring ─────────────────────────────────────────────────────────── */

type ScoredTerm = { label: string; delta: number; kind: "fit" | "risk" | "compromise" };

const DEMAND_RANK = { low: 0, moderate: 1, high: 2, "very-high": 3 } as const;

function capacityToRank(b: CapacityBand): number {
  // very-low..very-high → 0..3 on the demand scale.
  return Math.max(0, Math.min(3, Math.round((bandRank(b) / 4) * 3)));
}

export function scoreProtocolSuitability(
  dna: ProtocolDNA,
  snapshot: AthleteContextSnapshot,
  profile: AthleteProgrammingProfile,
): ProtocolSuitability {
  const goals = readGoalSignals(snapshot);
  // Signal STRENGTH, not just presence — the athlete's stated primary goal
  // must outrank a signal inferred from their current nutrition phase.
  const goalStrength = goalSignalStrength(snapshot);
  const terms: ScoredTerm[] = [];
  const push = (label: string, delta: number, kind: ScoredTerm["kind"] = "fit") => {
    if (delta !== 0 || kind !== "fit") terms.push({ label, delta, kind });
  };

  const risks: string[] = [];
  const compromises: string[] = [];
  const contraindications: string[] = [];
  const whyItFits: string[] = [];

  const exp = snapshot.training.experienceLevel;
  const expRank = EXPERIENCE_RANK[exp];
  const available = snapshot.training.availableDays;
  const freq = recommendFrequency(dna, profile, snapshot);

  /* ── Goal affinity ─────────────────────────────────────────────────── */
  const affinity = FAMILY_GOAL_AFFINITY[dna.identity.family] ?? {};
  let goalScore = 0;
  const matchedGoals: string[] = [];
  for (const [key, weight] of Object.entries(affinity)) {
    const strength = goalStrength[key as GoalKey] ?? 0;
    if (strength > 0) {
      goalScore += (weight ?? 0) * strength;
      // Only signals the athlete actually stated are read back to them.
      if (strength >= 0.6) matchedGoals.push(key);
    }
  }
  goalScore = Math.round(goalScore * 10) / 10;
  if (goalScore > 0) {
    push(`Serves the stated goal`, goalScore);
    whyItFits.push(
      `Your stated objective — ${snapshot.objectives.primaryGoal.toLowerCase()} — is what the ${FAMILY_LABEL[dna.identity.family]} architecture is built to produce.`,
    );
  } else {
    push("Does not directly serve the stated goal", -8);
    compromises.push(`This architecture is not built primarily for ${snapshot.objectives.primaryGoal.toLowerCase()}.`);
  }

  /* ── Capacity-driven affinity ──────────────────────────────────────────
     Some architectures exist to serve a CONSTRAINT rather than a goal. A
     recovery-limited athlete asking to "build muscle" will not type the word
     that matches the architecture built for them, so goal keywords alone
     would route them to a beginner plan instead.

     But a recovery ceiling must ADAPT a goal architecture, not ERASE it. An
     unconditional bonus here outranked every goal affinity in the catalogue,
     so a low-recovery powerlifter, runner and contest athlete all collapsed
     onto the single recovery-constrained protocol and received identical
     programming. Recovery is a dose problem; it is not a new goal.

     So the bonus is conditional on whether the athlete actually named an
     architecture-defining objective. When they did, their architecture wins
     and the ceiling is honoured through frequency and volume — see
     recommendFrequency, which already caps against the capacity band — while
     this protocol stays positively scored and therefore still selectable. */
  const recoveryLimited = profile.recoveryCapacity === "low" || profile.recoveryCapacity === "very-low";

  /* `general` is excluded deliberately: "general fitness" is the absence of a
     specific architecture request, not a request for one. The nutrition phase
     contributes only 0.45, below this threshold, so an athlete's current diet
     phase can never masquerade as a stated training goal. */
  const SPECIFIC_GOAL_KEYS: GoalKey[] = [
    "fatLoss", "leanGain", "strength", "endurance",
    "hybrid", "physique", "contest", "recomp", "performance",
  ];
  const STATED_GOAL_THRESHOLD = 0.6;
  const strongestSpecificGoal = Math.max(
    0,
    ...SPECIFIC_GOAL_KEYS.map((k) => goalStrength[k] ?? 0),
  );
  const hasStatedArchitectureGoal = strongestSpecificGoal >= STATED_GOAL_THRESHOLD;

  /* SEVERITY decides whether recovery is a dose problem or the whole problem.
     At `very-low` capacity, restoring the ability to train IS the objective
     and this architecture should win even against a stated goal. At `low`,
     the athlete can still train toward what they asked for — the ceiling is
     handled by reducing frequency and volume, not by changing the goal. */
  const recoverySeverelyLimited = profile.recoveryCapacity === "very-low";

  if (dna.identity.family === "recovery-constrained") {
    if (recoverySeverelyLimited || (recoveryLimited && !hasStatedArchitectureGoal)) {
      push("Built for the constraint that is actually limiting you", 16);
      whyItFits.push(
        `Recovery is the limiting factor in your week right now, not motivation or availability. This architecture is built for exactly that, which is why it outranks a conventional split here.`,
      );
      if (recoverySeverelyLimited && hasStatedArchitectureGoal) {
        compromises.push(
          `Progress toward ${snapshot.objectives.primaryGoal.toLowerCase()} is deliberately paused while capacity is rebuilt. This is a temporary priority, not a change of objective.`,
        );
      }
    } else if (recoveryLimited) {
      /* A mirror of the -4 that every high-demand architecture pays below.
         Without this the two tie, and a tie resolves arbitrarily — which is
         how a stated goal quietly lost. This keeps the protocol positively
         scored and selectable while the architecture built for the athlete's
         objective wins on the objective. */
      push("Serves the recovery ceiling, but not the stated objective", -4, "compromise");
      whyItFits.push(
        "Recovery is genuinely limiting your week, so this remains a sound option. Reserve's default is to keep the architecture built for your stated goal and reduce its dose instead, rather than replace the goal.",
      );
      compromises.push(
        `This architecture is built around restoring capacity rather than around ${snapshot.objectives.primaryGoal.toLowerCase()}, so progress toward that objective would be slower.`,
      );
    } else {
      push("Recovery is not the current limiter", -8, "compromise");
      compromises.push("Your recovery capacity does not currently require a reduced-demand architecture — a conventional split would progress faster.");
    }
  } else if (recoveryLimited && DEMAND_RANK[dna.fatigue.systemicDemand] >= 2) {
    push("High systemic demand against a real recovery ceiling", -4, "compromise");
    compromises.push(
      "Your recovery ceiling is real, so this architecture runs at a reduced frequency and volume rather than at its full prescription.",
    );
  }

  // A foundation architecture is what an early training age needs, and a poor
  // use of an established base. Same principle as the recovery ceiling: the
  // constraint decides, not the words the athlete typed.
  if (dna.identity.family === "beginner") {
    if (exp === "beginner") {
      push("Matches an early training age", 14);
      whyItFits.push(
        "At your training age the highest-return work is learning the patterns and building the habit. This architecture is built for that, which is why it outranks a more aggressive plan here.",
      );
    } else if (expRank >= EXPERIENCE_RANK.intermediate) {
      const over = expRank - EXPERIENCE_RANK.novice;
      push("Training age already past what this architecture teaches", -5 * over, "compromise");
      compromises.push(
        `At ${exp} level you already own the patterns this architecture exists to teach, so it would under-stimulate.`,
      );
    }
  } else if (exp === "beginner" && SPECIALIZED_BET_FAMILIES.has(dna.identity.family)) {
    push("Specialized architecture at an early training age", -8, "compromise");
    compromises.push("At an early training age a specialized architecture spends effort on refinements the base has not earned yet.");
  }

  /* A habit-rebuilding architecture answers a CONSISTENCY problem, not a
     general-fitness goal. Without this guard an athlete with an established
     base who says "general fitness" outscores everything else into a
     two-to-three-day full-body reset, because the lifestyle family carries the
     joint-highest `general` affinity. The protocol's own DNA names established
     athletes unsuitable, so the scoring has to agree with it.

     The legitimate cases stay legitimate: an athlete restarting after a layoff
     and an athlete whose recovery is genuinely limited both still fit. */
  if (dna.identity.family === "lifestyle" && expRank >= EXPERIENCE_RANK.intermediate) {
    const restarting = (snapshot.training.currentSplit ?? "").toLowerCase().includes("none");
    /* A recovery ceiling is NOT a consistency problem, so it does not exempt an
       established athlete from this guard. Previously it did, which routed a
       low-recovery elite athlete to a habit-rebuilding block; the architecture
       built for a recovery ceiling is the recovery-constrained family. */
    if (!restarting) {
      const over = expRank - EXPERIENCE_RANK.novice;
      push("Established base against a habit-rebuilding architecture", -6 * over, "compromise");
      compromises.push(
        `At ${exp} level consistency is not the limiting factor this architecture exists to solve, so it would under-stimulate the base you already have.`,
      );
    }
  }

  // Logged primary-lift numbers plus a strength objective is the clearest
  // signal that primary-lift progression is what the athlete actually wants.
  const markerCount = Object.keys(snapshot.training.strengthMarkers ?? {}).length;
  if (markerCount >= 2 && goalStrength.strength >= 0.6 && PRIMARY_LIFT_FAMILIES.has(dna.identity.family)) {
    push("Logged strength markers with a stated strength objective", 8);
    whyItFits.push(
      `You have logged ${markerCount} primary-lift markers and named strength as an objective, so progression here is measured on those lifts rather than on how a session felt.`,
    );
  }

  // Low confidence is a reason to take the robust option, not a specific bet.
  if (snapshot.evidence.confidence === "low") {
    if (ROBUST_DEFAULT_FAMILIES.has(dna.identity.family)) {
      push("Robust choice while Reserve still has limited information", 5);
      whyItFits.push("Reserve does not know enough about you yet to make a specific bet, so it is starting with a broadly effective architecture and will sharpen it as data arrives.");
    } else if (SPECIALIZED_BET_FAMILIES.has(dna.identity.family)) {
      push("Specific bet on an athlete Reserve barely knows", -7, "compromise");
      compromises.push("Reserve has limited information about you, and this architecture makes specific assumptions. Completing your profile would confirm or replace this recommendation.");
    }
  }

  /* ── Frequency fit ─────────────────────────────────────────────────── */
  const supported = dna.topology.supportedFrequencies;
  const idealFreq = Math.max(...supported);
  if (freq >= Math.min(...supported) && freq <= idealFreq && freq <= available) {
    push("Runs at your available frequency", 8);
    whyItFits.push(
      `You have ${available} training day${available === 1 ? "" : "s"} available, and this architecture runs properly at ${freq}. Nothing has to be forced.`,
    );
  } else if (freq > available) {
    push("Needs more days than are available", -12, "risk");
    compromises.push(
      `This architecture needs at least ${Math.min(...supported)} days and you have ${available}. Running it below its minimum removes the structure that makes it work.`,
    );
    risks.push("Compressed below its supported frequency, this protocol loses the identity it was designed around.");
  } else {
    push("Frequency slightly off its ideal", -3, "compromise");
    compromises.push(`This architecture reads best at ${idealFreq} days; you would run it at ${freq}.`);
  }
  if (freq < idealFreq && freq >= Math.min(...supported)) {
    compromises.push(
      `At ${freq} days rather than ${idealFreq}, ${dna.topology.compressionRules[0]?.toLowerCase() ?? "the lowest-priority days are converted to recovery"}`,
    );
  }

  /* ── Recovery fit — demand vs capacity ─────────────────────────────── */
  const demandRank = DEMAND_RANK[dna.fatigue.recoveryDemand];
  const capRank = capacityToRank(profile.recoveryCapacity);
  const recoveryGap = demandRank - capRank;
  if (recoveryGap >= 2) {
    push("Recovery demand well beyond current capacity", -14, "risk");
    risks.push(
      `This architecture carries ${dna.fatigue.recoveryDemand} recovery demand and your current recovery capacity reads ${profile.recoveryCapacity}. Running it as authored would accumulate fatigue faster than you clear it.`,
    );
  } else if (recoveryGap === 1) {
    push("Recovery demand above capacity", -5, "compromise");
    compromises.push(`Recovery demand sits one level above your current capacity — the plan runs at reduced volume to compensate.`);
  } else if (recoveryGap <= -1) {
    push("Recovery headroom carries it comfortably", 4);
    whyItFits.push("Your recovery capacity comfortably covers what this architecture asks for.");
  } else {
    push("Recovery demand matches capacity", 5);
    whyItFits.push(`Recovery demand and your current recovery capacity are matched.`);
  }

  /* ── Session duration ──────────────────────────────────────────────── */
  const duration = snapshot.training.sessionDurationMinutes;
  if (duration != null) {
    const dense = duration < 45;
    if (dense && freq <= 4 && dna.fatigue.systemicDemand !== "low") {
      push("Sessions may run past the available window", -4, "compromise");
      compromises.push(`With ${duration}-minute sessions at ${freq} days, some sessions run dense — accessory work is what gets trimmed.`);
    } else {
      push("Session length fits the window", 3);
    }
  }

  /* ── Training age / eligibility ────────────────────────────────────── */
  const minExp = dna.eligibility.minExperience;
  if (minExp && expRank < EXPERIENCE_RANK[minExp]) {
    const gap = EXPERIENCE_RANK[minExp] - expRank;
    push("Training age below what this architecture assumes", gap >= 2 ? -18 : -8, "risk");
    if (gap >= 2) {
      contraindications.push(
        `This architecture assumes an ${minExp} training base. At a ${exp} training age it would prescribe work that produces fatigue rather than adaptation — a foundation block reaches the same destination faster.`,
      );
    } else {
      risks.push(`This architecture assumes an ${minExp} base; at ${exp} it is workable but the specialization phases are deferred.`);
    }
  }
  if (dna.eligibility.minTrainingAgeYears != null) {
    const age = snapshot.training.trainingAgeYears;
    if (age != null && age < dna.eligibility.minTrainingAgeYears) {
      push("Below the minimum training age for this architecture", -14, "risk");
      contraindications.push(`This architecture expects at least ${dna.eligibility.minTrainingAgeYears} years of consistent training; you have logged ${age}.`);
    }
  }
  if (dna.eligibility.requiresWeakPointSelection && !(snapshot.training.weakPoints?.length)) {
    push("No priority region selected", -10, "risk");
    contraindications.push("A specialization block needs a named priority region. Without one there is nothing to specialize.");
  }

  /* ── Impact / conditioning tolerance ───────────────────────────────── */
  const impactDemand = dna.fatigue.impactDemand ?? "none";
  const impactRank = impactDemand === "high" ? 3 : impactDemand === "moderate" ? 2 : impactDemand === "low" ? 1 : 0;
  const tolRank = capacityToRank(profile.impactTolerance);
  if (impactRank >= 2 && tolRank <= 1) {
    push("Impact demand above current tolerance", -6, "compromise");
    compromises.push(
      "The conditioning in this architecture is impact-heavy as authored. Reserve keeps the goal and changes the modality — cycling, incline walking, or rowing carry the early expenditure instead.",
    );
    risks.push("Progressing impact work too quickly is the most common way this architecture goes wrong.");
  } else if (impactRank >= 2 && tolRank >= 2) {
    push("Impact tolerance supports the conditioning", 4);
    whyItFits.push("Your conditioning background supports the impact work this architecture programs.");
  }

  /* ── Pain / restrictions ───────────────────────────────────────────── */
  const pain = snapshot.recovery.currentPain ?? [];
  if (pain.length > 0 && (dna.fatigue.systemicDemand === "very-high" || impactRank >= 3)) {
    push("High-demand structure alongside reported discomfort", -6, "risk");
    risks.push(
      `You have reported discomfort in ${pain.map((p) => p.region).join(", ")}. Reserve records that and routes exercise selection around it; it does not assess or treat it. Anything persistent is a clinician conversation.`,
    );
  }

  /* ── Existing activity load ────────────────────────────────────────── */
  const activities = snapshot.environment.recurringActivities;
  const lowerActivities = activities.filter((a) =>
    /leg|lower|squat|glute|quad|hamstring|run|cycle|spin/i.test([a.title, ...a.focusAreas].join(" ")),
  );
  if (lowerActivities.length > 0 && dna.fatigue.lowerBodyInterference === "high") {
    push("Existing lower-body activity competes with this structure", -4, "compromise");
    compromises.push(
      `${lowerActivities.length} recurring lower-body activit${lowerActivities.length === 1 ? "y" : "ies"} already load your legs each week. Reserve plans the lower work around ${lowerActivities.length === 1 ? "it" : "them"} rather than on top.`,
    );
  }

  /* ── Body composition — never weight alone ─────────────────────────── */
  const weightKg = snapshot.profile.weightKg;
  const bodyMassIndex = bmi(weightKg, snapshot.profile.heightCm);
  const bf = snapshot.profile.bodyFatPercent;
  if (goals.fatLoss && dna.identity.family === "lean-mass") {
    push("Nutrition direction opposes the stated goal", -10, "risk");
    compromises.push("A gain phase and a fat-loss goal pull in opposite directions.");
  }
  if (goals.leanGain && dna.identity.family === "fat-loss") {
    push("Nutrition direction opposes the stated goal", -10, "risk");
    compromises.push("A deficit architecture and a size goal pull in opposite directions.");
  }
  if (bf != null && bf >= 28 && dna.identity.family === "contest-preparation") {
    push("Starting composition is not where a preparation block starts", -10, "risk");
    compromises.push("A preparation block starts from an established base. From your current starting point a fat-loss block produces more, faster.");
  }
  if (bf != null && bf <= 12 && dna.identity.family === "fat-loss" && expRank >= EXPERIENCE_RANK.advanced) {
    push("Already lean — retention structure matters more here", -3, "compromise");
    compromises.push("At your leanness, muscle-retention structure matters more than further expenditure.");
  }

  /* ── Weight-trend interaction ──────────────────────────────────────── */
  if (snapshot.nutrition.weightTrend === "falling-fast" && DEMAND_RANK[dna.fatigue.systemicDemand] >= 2) {
    push("High systemic demand while weight is falling quickly", -5, "risk");
    risks.push("Your weight is falling quickly. A high-demand architecture on top of that reduces training quality before it reduces body fat.");
  }

  /* ── Equipment ─────────────────────────────────────────────────────── */
  const equipment = snapshot.environment.equipment.map((e) => e.toLowerCase());
  const homeOnly = equipment.length > 0 && equipment.every((e) => /dumbbell|band|bodyweight|home|kettlebell/.test(e));
  if (homeOnly && dna.identity.family !== "home-gym" && dna.stimulus.primaryLiftPolicy) {
    push("Requires equipment that is not available", -12, "risk");
    contraindications.push("This architecture is built around barbell primary lifts, which your listed equipment does not cover.");
  }
  if (homeOnly && dna.identity.family === "home-gym") {
    push("Built for the available equipment", 8);
    whyItFits.push("This architecture is built specifically around the equipment you actually have.");
  }

  /* ── Score → classification ────────────────────────────────────────── */
  const score = Math.round(terms.reduce((s, t) => s + t.delta, 0) * 10) / 10;
  const hasContraindication = contraindications.length > 0;
  const classification: SuitabilityClass =
    hasContraindication ? "not-recommended"
      : score >= 24 ? "excellent-fit"
        : score >= 14 ? "strong-fit"
          : score >= 2 ? "conditional-fit"
            : "poor-fit";

  /* ── What the split will do ────────────────────────────────────────── */
  const muscleFreq = dna.stimulus.muscleFrequency;
  const twicePlus = Object.entries(muscleFreq).filter(([, n]) => n >= 2).map(([m]) => m);
  const whatTheSplitWillDo: string[] = [
    dna.identity.primaryObjective,
    twicePlus.length > 0
      ? `Gives ${twicePlus.slice(0, 6).join(", ")} at least two exposures a week, which is where most of the development comes from.`
      : `Covers every region once a week at the frequency this structure can genuinely recover from.`,
    dna.stimulus.intensityDistribution,
  ];
  const conditioningDays = dna.topology.canonicalWeek.filter(isConditioningDay).length;
  if (conditioningDays > 0) {
    whatTheSplitWillDo.push(
      `Uses ${conditioningDays} conditioning exposure${conditioningDays === 1 ? "" : "s"} a week, placed so ${dna.topology.schedulingPriorities[0]?.toLowerCase() ?? "recovery for the lifting days is protected"}.`,
    );
  }
  if (dna.stimulus.primaryLiftPolicy) whatTheSplitWillDo.push(dna.stimulus.primaryLiftPolicy);

  /* ── Requirements ──────────────────────────────────────────────────── */
  const recoveryRequirements = [
    `Carries ${dna.fatigue.recoveryDemand} recovery demand and ${dna.fatigue.systemicDemand} systemic demand.`,
    dna.fatigue.localFatiguePattern,
    ...(dna.fatigue.lowerBodyInterference === "high"
      ? ["Lower-body interference is high — the placement of leg work and conditioning is doing real work here."]
      : []),
  ];
  const nutritionRequirements = [
    `Nutrition demand: ${dna.nutrition.demandClass}.`,
    dna.nutrition.trainingDayPattern,
    dna.nutrition.bodyCompositionSupport,
  ];

  /* ── Personalization factors ───────────────────────────────────────── */
  const activityContext = activities.length
    ? `${activities.length} recurring activit${activities.length === 1 ? "y is" : "ies are"} already in your week and the plan is built around ${activities.length === 1 ? "it" : "them"}.`
    : "No recurring outside activities are on file, so the full week is Reserve's to plan.";

  return {
    protocolId: dna.protocolId,
    athleteSnapshotVersion: snapshot.snapshotVersion,
    score,
    classification,
    recommendedFrequency: freq,
    recommendedDurationWeeks: recommendDuration(dna, snapshot),
    whyItFits,
    whatTheSplitWillDo,
    expectedBenefits: [dna.identity.primaryObjective, ...dna.identity.secondaryObjectives],
    compromises,
    recoveryRequirements,
    nutritionRequirements,
    risks,
    contraindications,
    personalizationFactors: {
      weightContext: weightKg
        ? `${Math.round(weightKg)} kg${bodyMassIndex ? ` (BMI ${bodyMassIndex}, read as context alongside composition and training age — never on its own)` : ""}.`
        : undefined,
      bodyCompositionContext: profile.bodyCompositionContext,
      goalContext: `Primary goal: ${snapshot.objectives.primaryGoal}${matchedGoals.length ? ` — read as ${matchedGoals.join(", ")}.` : "."}`,
      trainingAgeContext: `${exp} training age${snapshot.training.trainingAgeYears != null ? ` (${snapshot.training.trainingAgeYears} years logged)` : " (estimated from your experience level)"}.`,
      scheduleContext: `${available} available day${available === 1 ? "" : "s"}${duration != null ? `, about ${duration} minutes per session` : ""}; schedule capacity reads ${profile.scheduleCapacity}.`,
      recoveryContext: `Recovery capacity reads ${profile.recoveryCapacity}${snapshot.recovery.averageSleepHours != null ? ` on about ${snapshot.recovery.averageSleepHours} hours of sleep` : ""}.`,
      activityContext,
    },
    adaptationTriggers: [
      ...dna.adaptation.readinessRules.slice(0, 2),
      ...dna.adaptation.bodyWeightTrendRules.slice(0, 2),
      ...dna.adaptation.performanceTrendRules.slice(0, 1),
    ],
    missingInformation: snapshot.evidence.missingFields,
    assumptions: profile.assumptions,
  };
}

/* ─── Ranking ─────────────────────────────────────────────────────────── */

export type SuitabilityRanking = {
  recommended: ProtocolSuitability;
  alternatives: ProtocolSuitability[];
  conditional: ProtocolSuitability[];
  notRecommended: ProtocolSuitability[];
  all: ProtocolSuitability[];
};

export function rankProtocolSuitability(
  snapshot: AthleteContextSnapshot,
  profile: AthleteProgrammingProfile,
  opts: { pool?: ProtocolDNA[] } = {},
): SuitabilityRanking {
  const pool = opts.pool ?? recommendableProtocolDNA();
  const scored = pool
    .map((d) => scoreProtocolSuitability(d, snapshot, profile))
    .sort((a, b) => b.score - a.score);

  const eligible = scored.filter((s) => s.classification !== "not-recommended");
  const recommended = eligible[0] ?? scored[0];

  return {
    recommended,
    alternatives: eligible.filter((s) => s !== recommended).slice(0, 2),
    conditional: scored.filter((s) => s.classification === "conditional-fit" || s.classification === "poor-fit"),
    notRecommended: scored.filter((s) => s.classification === "not-recommended"),
    all: scored,
  };
}

/** Suitability for one protocol the athlete chose manually. */
export function suitabilityFor(
  protocolId: string,
  snapshot: AthleteContextSnapshot,
  profile: AthleteProgrammingProfile,
): ProtocolSuitability | null {
  const dna = getProtocolDNA(protocolId);
  if (!dna) return null;
  return scoreProtocolSuitability(dna, snapshot, profile);
}
