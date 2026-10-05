/* ════════════════════════════════════════════════════════════════════════
   RANKED MOVEMENT RECOMMENDATIONS — slot-driven, explainable, member-final.

   A custom workout is built from movement SLOTS (primary horizontal press,
   lat width, hamstring curl…). For each slot Reserve ranks the movement
   library best-fit → avoid-today using the member's real context: equipment,
   training age, pain observations, time available, preference and rejection
   history, and recent exposure. Every rank carries reasons; the member can
   always pick a lower-ranked option and Reserve records the choice.

   Reuses MOVEMENT_LIBRARY + the member's existing preference/feedback
   slices — no parallel exercise database.
   ════════════════════════════════════════════════════════════════════════ */

import {
  MOVEMENT_LIBRARY,
  type MovementLibraryEntry,
} from "@/lib/training/prescription-engine";
import type { MovementPattern } from "@/lib/training/plateau-engine";
import type { UserTrainingProfile } from "@/lib/training/gym-environment";
import type { MovementFeedback, MovementPreferences } from "@/lib/training/workout-templates";
import { rankCandidates, scoreCandidate, type ScoreFactor } from "./scoring";
import type { JointTag } from "./activity-load";
import type { RankedRecommendation } from "./types";

/* ─── Slot catalog ───────────────────────────────────────────────────────── */

export type SlotRole = {
  id: string;
  label: string;
  patterns: MovementPattern[];
  /** Narrow within the pattern ("Upper Chest" vs any chest press). */
  targetMatch?: RegExp;
  muscleGroup: string;
  description: string;
};

export const SLOT_ROLES: SlotRole[] = [
  { id: "primary-horizontal-press", label: "Primary Horizontal Press", patterns: ["Horizontal Press"], muscleGroup: "Chest", description: "The main flat pressing overload of the session." },
  { id: "upper-chest-press", label: "Upper-Chest Press", patterns: ["Incline Press"], targetMatch: /upper chest/i, muscleGroup: "Chest", description: "Incline-angle pressing focused on the upper chest." },
  { id: "primary-vertical-press", label: "Primary Vertical Press", patterns: ["Vertical Press"], muscleGroup: "Delts", description: "Overhead pressing for the delts." },
  { id: "primary-vertical-pull", label: "Primary Vertical Pull", patterns: ["Vertical Pull"], muscleGroup: "Lats", description: "Pulldown/pull-up pattern for lat width." },
  { id: "primary-horizontal-pull", label: "Primary Horizontal Pull", patterns: ["Horizontal Pull"], muscleGroup: "Mid-Back", description: "Rowing pattern for upper-back thickness." },
  { id: "primary-squat", label: "Primary Squat Pattern", patterns: ["Squat Pattern"], muscleGroup: "Quads", description: "The main knee-dominant lower-body overload." },
  { id: "hip-hinge", label: "Hip Hinge", patterns: ["Hip Hinge"], muscleGroup: "Hamstrings", description: "Hip-dominant posterior-chain loading." },
  { id: "hip-extension", label: "Hip Extension / Glute", patterns: ["Hip Extension"], muscleGroup: "Glutes", description: "Direct glute extension work." },
  { id: "hamstring-curl", label: "Hamstring Curl", patterns: ["Knee Flexion"], muscleGroup: "Hamstrings", description: "Knee-flexion hamstring isolation." },
  { id: "lunge-unilateral", label: "Unilateral / Lunge", patterns: ["Lunge Pattern"], muscleGroup: "Quads", description: "Single-leg strength and stability." },
  { id: "calf-raise", label: "Calf Raise", patterns: ["Calf Raise"], muscleGroup: "Calves", description: "Direct calf loading." },
  { id: "lateral-delt", label: "Lateral Delt", patterns: ["Lateral Raise"], muscleGroup: "Side Delts", description: "Side-delt width isolation." },
  { id: "rear-delt", label: "Rear Delt", patterns: ["Rear Delt"], muscleGroup: "Rear Delts", description: "Rear-delt and upper-back detail." },
  { id: "biceps-curl", label: "Biceps Curl", patterns: ["Curl"], muscleGroup: "Biceps", description: "Direct biceps work." },
  { id: "triceps-extension", label: "Triceps Extension", patterns: ["Triceps Extension"], muscleGroup: "Triceps", description: "Direct triceps work." },
  { id: "core-brace", label: "Core Brace", patterns: ["Core Brace"], muscleGroup: "Core", description: "Anti-extension / anti-rotation core work." },
  { id: "conditioning-finisher", label: "Conditioning Finisher", patterns: ["Conditioning"], muscleGroup: "Conditioning", description: "Session-closing conditioning block." },
];

export function slotRoleById(id: string): SlotRole | undefined {
  return SLOT_ROLES.find((s) => s.id === id);
}

/* ─── Joint demand by pattern (pain-aware re-ranking) ────────────────────── */

const PATTERN_JOINTS: Partial<Record<MovementPattern, JointTag[]>> = {
  "Horizontal Press": ["shoulder", "elbow"],
  "Incline Press": ["shoulder", "elbow"],
  "Vertical Press": ["shoulder", "elbow"],
  "Horizontal Pull": ["elbow", "shoulder"],
  "Vertical Pull": ["elbow", "shoulder"],
  "Hip Hinge": ["hip", "spine"],
  "Squat Pattern": ["knee", "hip"],
  "Lunge Pattern": ["knee", "hip"],
  "Knee Flexion": ["knee"],
  "Hip Extension": ["hip"],
  "Calf Raise": ["ankle"],
  "Lateral Raise": ["shoulder"],
  "Rear Delt": ["shoulder"],
  Curl: ["elbow"],
  "Triceps Extension": ["elbow"],
  "Core Brace": ["spine"],
  Conditioning: ["knee", "ankle"],
};

const LEVEL_RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const;

export type MovementRankContext = {
  profile: UserTrainingProfile;
  preferences: MovementPreferences;
  feedback: Record<string, MovementFeedback>;
  /** Joint-area observations for THIS template ("elbow", "knee"…). */
  painObservations: string[];
  timeAvailableMin: number | null;
  /** Movement names seen in recent session history (staleness signal). */
  recentMovementNames: string[];
};

function equipmentAvailable(e: MovementLibraryEntry, profile: UserTrainingProfile): boolean {
  if (e.bodyweight) return true;
  if (e.premiumBrand && !profile.premiumBrands.includes(e.premiumBrand)) return false;
  return profile.equipment.includes(e.equipment);
}

/** Rank the library for one slot. Returns every candidate (best → avoid) so
    the member always sees the full picture, not a curated shortlist. */
export function rankMovementsForSlot(
  slot: SlotRole,
  ctx: MovementRankContext,
): RankedRecommendation<MovementLibraryEntry>[] {
  const pool = MOVEMENT_LIBRARY.filter(
    (e) => slot.patterns.includes(e.pattern) && (!slot.targetMatch || slot.targetMatch.test(e.target)),
  );
  const fallbackPool = pool.length > 0
    ? pool
    : MOVEMENT_LIBRARY.filter((e) => slot.patterns.includes(e.pattern));

  const recentSet = new Set(ctx.recentMovementNames.map((n) => n.toLowerCase()));
  const userLevel = LEVEL_RANK[ctx.profile.trainingLevel] ?? 1;

  const entries = fallbackPool.map((e) => {
    const factors: ScoreFactor[] = [];
    const joints = PATTERN_JOINTS[e.pattern] ?? [];

    /* Objective + target match — the slot itself filtered the pattern, so this
       scores the tightness of the target fit. */
    factors.push({
      label: "objective match",
      weight: 2.5,
      score: slot.targetMatch ? (slot.targetMatch.test(e.target) ? 1 : 0.55) : 0.9,
      reason: `Matches the ${slot.label.toLowerCase()} objective (${e.target})`,
    });

    /* Equipment. */
    const available = equipmentAvailable(e, ctx.profile);
    factors.push({
      label: "equipment",
      weight: 3,
      score: available ? 1 : 0.05,
      reason: available ? "Available with your configured equipment" : undefined,
      tradeoff: available ? undefined : "Not available in your current training environment",
      veto: !available,
    });

    /* Pain compatibility — observational only. */
    const painHits = joints.filter((j) => ctx.painObservations.includes(j));
    const painScore =
      painHits.length === 0 ? 0.8
      : e.jointStress === "low" ? 0.55
      : e.jointStress === "moderate" ? 0.3
      : 0.1;
    factors.push({
      label: "joint compatibility",
      weight: 2.5,
      score: painScore,
      reason: painHits.length === 0 && e.jointStress === "low" ? "Low joint demand" : undefined,
      tradeoff: painHits.length > 0 && painScore <= 0.35
        ? `Loads the ${painHits.join(" / ")} area you've flagged — a lower-stress option protects the session`
        : undefined,
      veto: painHits.length > 0 && e.jointStress === "high",
    });

    /* Skill / training-age fit. */
    const reqLevel = LEVEL_RANK[e.difficulty];
    factors.push({
      label: "skill fit",
      weight: 1.5,
      score: reqLevel <= userLevel ? (reqLevel === userLevel ? 1 : 0.85) : 0.25,
      reason: reqLevel === userLevel ? "Skill demand matches your training age" : undefined,
      tradeoff: reqLevel > userLevel ? "Higher skill requirement than your configured training level" : undefined,
    });

    /* Loading + progression potential. */
    const loadable = e.equipment === "barbell" || e.equipment === "plate-loaded" || e.equipment === "smith"
      || e.equipment === "hack-squat" || e.equipment === "leg-press" || e.equipment === "pendulum-squat";
    factors.push({
      label: "progression potential",
      weight: 1.5,
      score: loadable ? 0.95 : e.bodyweight ? 0.4 : 0.7,
      reason: loadable ? "Strong loading and progression headroom" : undefined,
      tradeoff: e.bodyweight ? "Limited external-load progression as a primary overload" : undefined,
    });

    /* Stability (fatigue-cheap stimulus). */
    factors.push({
      label: "stability",
      weight: 1,
      score: e.jointStress === "low" ? 0.9 : e.jointStress === "moderate" ? 0.65 : 0.4,
      reason: e.jointStress === "low" ? "Stable setup, low systemic cost" : undefined,
      tradeoff: e.jointStress === "high" ? "Higher setup and systemic fatigue cost" : undefined,
    });

    /* Time fit. */
    if (ctx.timeAvailableMin !== null && ctx.timeAvailableMin <= 45) {
      const quick = e.equipment !== "barbell" && e.jointStress !== "high";
      factors.push({
        label: "time fit",
        weight: 1.5,
        score: quick ? 0.95 : 0.3,
        reason: quick ? "Fast setup for the time you have available" : undefined,
        tradeoff: quick ? undefined : "Setup and warm-up cost is heavy for a short session",
      });
    }

    /* Preference + rejection history. */
    const nameLc = e.name.toLowerCase();
    const isFavorite = ctx.preferences.favorites.some((f) => f.toLowerCase() === nameLc);
    const isAvoided = ctx.preferences.avoid.some((a) => a.toLowerCase() === nameLc);
    const hardToAccess = ctx.preferences.hardToAccess.some((h) => h.toLowerCase() === nameLc);
    const fb = ctx.feedback[e.name];
    const doNotSuggest = fb?.kinds.includes("do-not-suggest") ?? false;
    const feltGreat = (fb?.kinds.includes("felt-great") || fb?.kinds.includes("pump-strong")) ?? false;
    const jointFlagged = fb?.kinds.includes("joint-stress") ?? false;
    factors.push({
      label: "your history",
      weight: 2,
      score: isAvoided || doNotSuggest ? 0 : isFavorite || feltGreat ? 1 : hardToAccess ? 0.3 : jointFlagged ? 0.35 : 0.6,
      reason: isFavorite ? "Saved as one of your favorites" : feltGreat ? "You've logged strong feedback on this movement" : undefined,
      tradeoff: isAvoided || doNotSuggest ? "You've told Reserve not to suggest this movement"
        : hardToAccess ? "You've flagged this as hard to access at your gym"
        : jointFlagged ? "You've previously logged joint stress on this movement" : undefined,
      veto: isAvoided || doNotSuggest,
    });

    /* Recent exposure — nudge variety, never a veto. */
    if (recentSet.has(nameLc)) {
      factors.push({
        label: "recent exposure",
        weight: 0.5,
        score: 0.45,
      });
    }

    return { candidate: e, scored: scoreCandidate(factors) };
  });

  return rankCandidates(entries);
}
