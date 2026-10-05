/* Audit the experience-scaling + session-metrics engine: confirms each
   training experience produces a genuinely different session (volume, supersets,
   machine bias, finishers) and that beginners are protected from pro-level work. */
import {
  getWorkoutTemplateForSplit,
  applyProtocolIntensity,
  applyExperienceScaling,
  applyMovementPreferences,
  computeSessionMetrics,
  protocolIntensityTier,
  type TrainingExperience,
  type MovementPreferences,
} from "../src/lib/training/workout-templates";

const EXPS: TrainingExperience[] = ["beginner", "intermediate", "advanced", "full-gym-advanced", "athlete"];

const base = getWorkoutTemplateForSplit("chest / back")!;
const champ = applyProtocolIntensity(base, "championship");
console.log("CHEST/BACK · championship protocol, scaled by experience:");
for (const exp of EXPS) {
  const scaled = applyExperienceScaling(champ, exp);
  const m = computeSessionMetrics(scaled, exp);
  const moves = scaled.phases.flatMap((p) => p.movements).length;
  console.log(
    `  ${exp.padEnd(18)} moves=${moves} sets=${m.totalWorkingSets} int=${m.intensityLevel}/10 ` +
    `diff=${m.sessionDifficultyLabel.padEnd(16)} ss=${m.supersetCount} dur=${m.estimatedDuration}m ` +
    `rec=${m.recoveryDemand.padEnd(9)} fuel=${m.sessionFuelDemand} methods=[${m.advancedMethods.join("; ")}]`,
  );
}

console.log("\nBeginner LEGS machine-bias (no barbell/pull-up-bar leads):");
const begin = applyExperienceScaling(applyProtocolIntensity(getWorkoutTemplateForSplit("legs")!, "hypertrophy"), "beginner");
begin.phases.flatMap((p) => p.movements).forEach((mv) =>
  console.log(`  ${mv.name} [${mv.equipment}] x${mv.sets}${mv.swappedFrom ? ` (was ${mv.swappedFrom})` : ""}`),
);

console.log("\nPreference swap (avoid Hack Squat, sub Leg Press→Pendulum, fav Leg Extension):");
const prefs: MovementPreferences = { avoid: ["Hack Squat"], hardToAccess: [], preferredSubstitutes: { "Leg Press": "Pendulum Squat" }, favorites: ["Leg Extension"] };
const pref = applyMovementPreferences(applyProtocolIntensity(getWorkoutTemplateForSplit("legs")!, "advanced"), prefs);
pref.phases.flatMap((p) => p.movements).filter((mv) => mv.swappedFrom || mv.preferred).forEach((mv) =>
  console.log(`  ${mv.name}${mv.swappedFrom ? ` (was ${mv.swappedFrom})` : ""}${mv.preferred ? " [FAV]" : ""}`),
);

console.log("\nTier mapping:", protocolIntensityTier({ category: "premium-advanced", difficulty: "elite" }), "/", protocolIntensityTier({ category: "lifestyle-reset", difficulty: "accessible" }));
