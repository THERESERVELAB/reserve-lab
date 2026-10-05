/* Audit the protocol ↔ nutrition alignment engine: confirms macros obey the
   mission — no bulk plan in a summer-lean protocol, no aggressive cut when
   glute growth is the driver, and leg/high-output days protect carbs vs rest. */
import {
  resolveProtocolNutritionBias,
  resolveMacroTargets,
  buildMealPlanGuardrails,
  goalToNutritionPhase,
  type NutritionPhase,
} from "../src/lib/nutrition/protocol-alignment";

function show(title: string, r: ReturnType<typeof resolveProtocolNutritionBias>) {
  console.log(`\n${title}`);
  console.log(`  phase=${r.nutritionPhase} (default=${r.defaultPhase}, source=${r.source}) confidence=${r.macroConfidence}`);
  if (r.conflictWarnings.length) r.conflictWarnings.forEach((w) => console.log(`  ⚠ [${w.severity}] ${w.message}`));
}

// 1) Vacation Physique (controlled cut) — must NOT be bulk.
const vac = resolveProtocolNutritionBias({ womensTrack: "lifestyle-shape", goal: "Vacation Physique", activityStack: "gym-only", hasBodyData: true });
show("Vacation Physique Rotation", vac);

// 2) Glute Ascend (lean gain) — must NOT auto-cut.
const glute = resolveProtocolNutritionBias({ womensTrack: "glute-quad", primaryFocus: "glutes", goal: "Grow Glutes", activityStack: "gym-only", hasBodyData: true });
show("Glute Ascend Protocol (grow glutes)", glute);

// 3) Glute growth driver but member forces an aggressive cut → conflict.
const conflict = resolveProtocolNutritionBias({ womensTrack: "glute-quad", primaryFocus: "glutes", goal: "Grow Glutes", currentPhaseOverride: "cut" });
show("Glute Ascend + member forces aggressive CUT", conflict);

// 4) Summer-lean + member forces lean-gain → block bulk.
const summerBulk = resolveProtocolNutritionBias({ goal: "Summer lean waistline", fatLossPriority: true, currentPhaseOverride: "lean-gain" });
show("Summer-lean + member forces LEAN-GAIN", summerBulk);

// 5) Hybrid sport stack → high-output-hybrid.
const hybrid = resolveProtocolNutritionBias({ goal: "Sport + Strength Balance", activityStack: "full-hybrid", hasBodyData: true });
show("Sport + Strength Balance (full hybrid)", hybrid);

// Macro day-type protection: controlled cut, 150 lb.
const m = resolveMacroTargets({ phase: "controlled-cut", bodyweightLb: 150, dietStyle: "standard", hasConfirmedBodyData: true });
console.log(`\nControlled-cut macros @150lb: training=${m.trainingDayMacros!.calories}cal/${m.trainingDayMacros!.carbsG}C · rest=${m.restDayMacros!.calories}cal/${m.restDayMacros!.carbsG}C · lowerBody=${m.lowerBodyDayMacros!.calories}cal/${m.lowerBodyDayMacros!.carbsG}C · highOutput=${m.highOutputDayMacros!.calories}cal/${m.highOutputDayMacros!.carbsG}C`);
console.log(`  leg-day carbs (${m.lowerBodyDayMacros!.carbsG}) > rest-day carbs (${m.restDayMacros!.carbsG})? ${m.lowerBodyDayMacros!.carbsG > m.restDayMacros!.carbsG}`);

// Missing body data → incomplete.
const missing = resolveMacroTargets({ phase: "recomp", bodyweightLb: null, dietStyle: "standard" });
console.log(`\nNo bodyweight → incomplete=${missing.incomplete} flags=[${missing.missingDataFlags.join(", ")}] calories=${missing.caloriesTarget}`);

// Lean-gain vs controlled-cut calories differ (no bulk == cut collision).
const lg = resolveMacroTargets({ phase: "lean-gain", bodyweightLb: 150, dietStyle: "standard", hasConfirmedBodyData: true });
console.log(`\nlean-gain training cal (${lg.trainingDayMacros!.calories}) > controlled-cut training cal (${m.trainingDayMacros!.calories})? ${lg.trainingDayMacros!.calories > m.trainingDayMacros!.calories}`);

// Guardrails object.
const guards = buildMealPlanGuardrails(glute);
console.log(`\nGlute guardrails: summerLeanGuard=${guards.summerLeanGuard} gluteGrowthFuelGuard=${guards.gluteGrowthFuelGuard} highOutputHybridGuard=${guards.highOutputHybridGuard}`);

// Goal mapping sweep.
const goals = ["Lean Summer Physique", "Vacation Physique", "Runway Shape", "Grow Glutes", "Build Lower Body Shape", "Shape Quads + Hamstrings", "Athletic + Feminine", "Improve Conditioning", "Sport + Strength Balance"];
console.log("\nGoal → phase:");
goals.forEach((g) => console.log(`  ${g.padEnd(26)} → ${goalToNutritionPhase(g)}`));
void (null as unknown as NutritionPhase);
