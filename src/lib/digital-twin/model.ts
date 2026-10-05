export type BodyMetricKey =
  | "weight"
  | "bodyFat"
  | "waist"
  | "chest"
  | "shoulders"
  | "arms"
  | "quads"
  | "calves";

export type MuscleGroupScore =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "core"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves";

export type PhysiqueArchetype =
  | "foundation"
  | "lean-athletic"
  | "classic-physique"
  | "mass-focused"
  | "hybrid-performance";

export type DigitalTwinSnapshot = {
  userId: string;
  capturedAt: string;
  archetype: PhysiqueArchetype;
  goalState: string;
  weakPoints: MuscleGroupScore[];
  muscleScores: Partial<Record<MuscleGroupScore, number>>;
  symmetryScore: number | null;
  bodyMetrics: Partial<Record<BodyMetricKey, number>>;
  projectionSummary: string | null;
};

export const BODY_METRIC_LABELS: Record<BodyMetricKey, string> = {
  weight: "Body weight",
  bodyFat: "Body fat",
  waist: "Waist",
  chest: "Chest",
  shoulders: "Shoulders",
  arms: "Arms",
  quads: "Quads",
  calves: "Calves",
};

export const MUSCLE_SCORE_LABELS: Record<MuscleGroupScore, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
};

export function calculateSymmetryScore(scores: Partial<Record<MuscleGroupScore, number>>) {
  const values = Object.values(scores).filter((value): value is number => typeof value === "number");
  if (values.length < 2) return null;

  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + Math.abs(value - average), 0) / values.length;
  return Math.max(0, Math.round(100 - variance));
}
