import { MOVEMENT_LIBRARY, type MovementLibraryEntry } from "@/lib/training/prescription-engine";
import type { MovementExecutionRecord, SessionExecutionRecord } from "@/lib/training/session-execution";

import type { ExerciseExposureProfile, MovementPattern } from "./types";

/** Bookkeeping coefficients only. They preserve direct and indirect exposure
 * as separate facts and do not represent an optimal-volume claim. */
export const EXPOSURE_COEFFICIENTS = {
  direct: 1,
  indirect: 0.5,
} as const;

const SECONDARY_BY_PATTERN: Partial<Record<MovementLibraryEntry["pattern"], string[]>> = {
  "Horizontal Press": ["Triceps", "Front Delts"],
  "Incline Press": ["Triceps", "Front Delts"],
  "Vertical Press": ["Triceps"],
  "Horizontal Pull": ["Biceps", "Rear Delts"],
  "Vertical Pull": ["Biceps", "Mid-Back"],
  "Hip Hinge": ["Glutes", "Spinal Erectors"],
  "Squat Pattern": ["Glutes"],
  "Lunge Pattern": ["Glutes"],
  "Knee Flexion": ["Calves"],
  "Hip Extension": ["Hamstrings"],
  "Core Brace": ["Obliques"],
};

function clean(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function mappedPattern(entry: MovementLibraryEntry): MovementPattern[] {
  const name = entry.name.toLowerCase();
  switch (entry.pattern) {
    case "Horizontal Press":
    case "Incline Press": return ["horizontal-push"];
    case "Vertical Press": return ["vertical-push"];
    case "Horizontal Pull": return ["horizontal-pull"];
    case "Vertical Pull": return ["vertical-pull"];
    case "Hip Hinge": return ["hinge"];
    case "Squat Pattern": return ["squat"];
    case "Lunge Pattern": return ["lunge"];
    case "Knee Flexion": return ["knee-flexion"];
    case "Hip Extension": return ["hip-extension"];
    case "Calf Raise": return ["calf-and-ankle"];
    case "Core Brace":
      if (name.includes("pallof")) return ["anti-rotation"];
      if (name.includes("crunch") || name.includes("knee raise")) return ["trunk-flexion"];
      return ["anti-rotation"];
    case "Conditioning": return ["aerobic"];
    default: return ["isolation"];
  }
}

function resistanceEligible(entry: MovementLibraryEntry): boolean {
  return entry.pattern !== "Conditioning";
}

function profileFromLibrary(entry: MovementLibraryEntry): ExerciseExposureProfile {
  const patterns = mappedPattern(entry);
  const isolation = ["Lateral Raise", "Rear Delt", "Curl", "Triceps Extension", "Calf Raise", "Isolation"].includes(entry.pattern);
  const unilateral = /single-arm|single-leg|split squat|lunge/i.test(entry.name);
  const axialLoad = /back squat|barbell row|romanian deadlift/i.test(entry.name)
    ? "high" as const
    : ["Squat Pattern", "Hip Hinge"].includes(entry.pattern)
      ? "moderate" as const
      : "low" as const;
  const impact = entry.pattern === "Conditioning" && /treadmill|stair/i.test(entry.name) ? "low" as const : "none" as const;
  const systemicDemand = ["Squat Pattern", "Hip Hinge", "Lunge Pattern", "Conditioning"].includes(entry.pattern)
    ? "high" as const
    : isolation ? "low" as const : "moderate" as const;
  return {
    exerciseId: entry.id,
    movementPatterns: patterns,
    primaryMuscles: [entry.target],
    secondaryMuscles: SECONDARY_BY_PATTERN[entry.pattern] ?? [],
    directExposureWeight: EXPOSURE_COEFFICIENTS.direct,
    indirectExposureWeight: EXPOSURE_COEFFICIENTS.indirect,
    resistanceVolumeEligible: resistanceEligible(entry),
    characteristics: {
      compound: !isolation && entry.pattern !== "Conditioning",
      unilateral,
      axialLoad: entry.pattern === "Conditioning" ? "none" : axialLoad,
      impact,
      stabilityDemand: unilateral || entry.bodyweight ? "high" : isolation ? "low" : "moderate",
      eccentricDemand: entry.pattern === "Conditioning" ? "low" : entry.jointStress === "high" ? "high" : "moderate",
      systemicDemand,
    },
    provenance: "movement-library",
    limitations: [],
  };
}

const PROFILE_OVERRIDES: Array<ExerciseExposureProfile & { names: string[] }> = [
  {
    names: ["Belt Squat"], exerciseId: "belt-squat", movementPatterns: ["squat"], primaryMuscles: ["Quads"], secondaryMuscles: ["Glutes"],
    directExposureWeight: 1, indirectExposureWeight: 0.5, resistanceVolumeEligible: true,
    characteristics: { compound: true, unilateral: false, axialLoad: "low", impact: "none", stabilityDemand: "low", eccentricDemand: "moderate", systemicDemand: "moderate" },
    provenance: "movement-library", limitations: ["Exposure-only metadata overlay; this entry does not prescribe the movement."],
  },
  {
    names: ["Suitcase Carry"], exerciseId: "suitcase-carry", movementPatterns: ["carry", "anti-rotation"], primaryMuscles: ["Obliques", "Grip"], secondaryMuscles: ["Traps"],
    directExposureWeight: 1, indirectExposureWeight: 0.5, resistanceVolumeEligible: true,
    characteristics: { compound: true, unilateral: true, axialLoad: "moderate", impact: "low", stabilityDemand: "high", eccentricDemand: "low", systemicDemand: "moderate" },
    provenance: "movement-library", limitations: ["Carry exposure is retained as carry work and is not converted to tonnage."],
  },
  {
    names: ["Farmer Carry", "Farmer's Carry"], exerciseId: "farmer-carry", movementPatterns: ["carry"], primaryMuscles: ["Grip", "Traps"], secondaryMuscles: ["Core"],
    directExposureWeight: 1, indirectExposureWeight: 0.5, resistanceVolumeEligible: true,
    characteristics: { compound: true, unilateral: false, axialLoad: "moderate", impact: "low", stabilityDemand: "moderate", eccentricDemand: "low", systemicDemand: "high" },
    provenance: "movement-library", limitations: ["Carry exposure is retained as carry work and is not converted to tonnage."],
  },
];

const LIBRARY_PROFILES = MOVEMENT_LIBRARY.map((entry) => ({
  entry,
  profile: profileFromLibrary(entry),
  names: [clean(entry.name)],
}));

export function findExerciseExposureProfile(exerciseId: string, performedName?: string): ExerciseExposureProfile | null {
  const normalizedName = performedName ? clean(performedName) : "";
  const override = PROFILE_OVERRIDES.find((candidate) =>
    candidate.exerciseId === exerciseId || candidate.names.some((name) => clean(name) === normalizedName)
  );
  if (override) {
    return {
      exerciseId: override.exerciseId,
      movementPatterns: [...override.movementPatterns],
      primaryMuscles: [...override.primaryMuscles],
      secondaryMuscles: [...override.secondaryMuscles],
      directExposureWeight: override.directExposureWeight,
      indirectExposureWeight: override.indirectExposureWeight,
      resistanceVolumeEligible: override.resistanceVolumeEligible,
      characteristics: { ...override.characteristics },
      provenance: override.provenance,
      limitations: [...override.limitations],
    };
  }
  const match = LIBRARY_PROFILES.find(({ entry, names }) => entry.id === exerciseId || names.includes(normalizedName));
  return match ? { ...match.profile, primaryMuscles: [...match.profile.primaryMuscles], secondaryMuscles: [...match.profile.secondaryMuscles], movementPatterns: [...match.profile.movementPatterns] } : null;
}

function snapshotMovement(record: SessionExecutionRecord, movementId: string): Record<string, unknown> | null {
  const movements = record.startedSnapshot?.movements ?? record.adjustedSnapshot?.movements ?? record.plannedSnapshot?.movements ?? [];
  const movement = movements.find((candidate) =>
    Boolean(candidate) && typeof candidate === "object" && (candidate as Record<string, unknown>).id === movementId
  );
  return movement && typeof movement === "object" ? movement as Record<string, unknown> : null;
}

/** Performed identity wins for substitutions. Falling back to the original ID
 * would silently attribute the replacement to the wrong exercise. */
export function resolvePerformedExposureProfile(
  record: SessionExecutionRecord,
  movement: MovementExecutionRecord,
): ExerciseExposureProfile | null {
  const profile = movement.source === "substitution"
    ? findExerciseExposureProfile("", movement.performedName)
    : findExerciseExposureProfile(movement.exerciseId, movement.performedName);
  if (profile) return profile;
  const frozen = snapshotMovement(record, movement.id);
  const primary = Array.isArray(frozen?.primaryMuscles) ? frozen.primaryMuscles.filter((value): value is string => typeof value === "string") : [];
  const secondary = Array.isArray(frozen?.secondaryMuscles) ? frozen.secondaryMuscles.filter((value): value is string => typeof value === "string") : [];
  if (movement.source === "substitution" || (primary.length === 0 && secondary.length === 0)) return null;
  return {
    exerciseId: movement.exerciseId,
    movementPatterns: [],
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    directExposureWeight: EXPOSURE_COEFFICIENTS.direct,
    indirectExposureWeight: EXPOSURE_COEFFICIENTS.indirect,
    resistanceVolumeEligible: true,
    characteristics: {
      compound: false,
      unilateral: false,
      axialLoad: "none",
      impact: "none",
      stabilityDemand: "low",
      eccentricDemand: "low",
      systemicDemand: "low",
    },
    provenance: "frozen-session-metadata",
    limitations: ["Muscles came from the frozen session; movement pattern and demand characteristics remain unclassified."],
  };
}

export function resolvePlannedExposureProfile(
  record: SessionExecutionRecord,
  movement: MovementExecutionRecord,
): ExerciseExposureProfile | null {
  const profile = findExerciseExposureProfile(movement.exerciseId, movement.plannedName);
  if (profile) return profile;
  const frozen = snapshotMovement(record, movement.id);
  const primary = Array.isArray(frozen?.primaryMuscles) ? frozen.primaryMuscles.filter((value): value is string => typeof value === "string") : [];
  if (!primary.length) return null;
  return resolvePerformedExposureProfile(record, { ...movement, source: "planned", performedName: movement.plannedName });
}
