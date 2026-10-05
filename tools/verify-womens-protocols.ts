/* Hard regression guard for the women's protocol data, weekly engine, nutrition
   alignment, and shared source-of-truth wiring. Run with:
   node tools/run-ts-audit.cjs tools/verify-womens-protocols.ts */
import fs from "node:fs";
import path from "node:path";

import {
  PROTOCOL_LIBRARY,
  activateProtocol,
  protocolProduct,
  type ProtocolDefinition,
} from "../src/lib/protocol/library";
import { WOMENS_TRACKS } from "../src/lib/protocol/architecture";
import { buildWomensTrackWeek, type ResolvedDay } from "../src/lib/training/daily-context";
import {
  allTemplateMovements,
  applyProtocolIntensity,
  applyWomensSession,
  getWorkoutTemplateForSplit,
  type WomensSessionKind,
} from "../src/lib/training/workout-templates";
import { ACTIVITY_STACKS } from "../src/lib/training/activity-stack";
import { resolveMacroTargets, resolveProtocolNutritionBias } from "../src/lib/nutrition/protocol-alignment";

type Frequency = {
  glutes: number;
  hamstrings: number;
  quads: number;
  calves: number;
  coreWaist: number;
  upperFrame: number;
  conditioningCardio: number;
  recoveryMobility: number;
  pilatesYogaSports: number;
};

const failures: string[] = [];
function check(condition: unknown, message: string): asserts condition {
  if (!condition) failures.push(message);
}

function dayGroups(day: ResolvedDay): Set<keyof Omit<Frequency, "recoveryMobility" | "pilatesYogaSports">> {
  const groups = new Set<keyof Omit<Frequency, "recoveryMobility" | "pilatesYogaSports">>();
  const base = day.splitKey ? getWorkoutTemplateForSplit(day.splitKey) : null;
  if (!base) return groups;
  let template = applyProtocolIntensity(base, "standard");
  if (day.transform !== "none" && day.transform !== "chest" && !day.transform.startsWith("glute-") && day.transform !== "quad-volume") {
    template = applyWomensSession(template, day.transform as WomensSessionKind, "strong");
  } else if (["glute-strength-waist", "quad-shape-glute-support", "back-line-delts-conditioning", "glute-hamstring-shape", "upper-sculpt-posture"].includes(day.transform)) {
    template = applyWomensSession(template, day.transform as WomensSessionKind, "strong");
  }

  for (const movement of allTemplateMovements(template)) {
    const muscle = movement.targetMuscle.toLowerCase();
    if (/glute/.test(muscle)) groups.add("glutes");
    if (/hamstring/.test(muscle)) groups.add("hamstrings");
    if (/quad/.test(muscle)) groups.add("quads");
    if (/calf|calves|soleus|gastro/.test(muscle)) groups.add("calves");
    if (/core|\bab|oblique|waist/.test(muscle)) groups.add("coreWaist");
    if (/lat|back|trap|delt|shoulder|chest|pec|bicep|tricep|\barm|forearm/.test(muscle)) groups.add("upperFrame");
    if (/condition|cardio/.test(muscle)) groups.add("conditioningCardio");
  }
  return groups;
}

function frequencyFor(def: ProtocolDefinition): Frequency {
  const frequency: Frequency = { glutes: 0, hamstrings: 0, quads: 0, calves: 0, coreWaist: 0, upperFrame: 0, conditioningCardio: 0, recoveryMobility: 0, pilatesYogaSports: 0 };
  const week = buildWomensTrackWeek(def.womensTrack!);
  for (const day of week) {
    const activityLayer = /pilates|yoga|sport/i.test(day.displayTitle);
    const recoveryLayer = day.recovery || /recovery|reset|mobility|pilates|yoga|sport/i.test(day.displayTitle);
    if (activityLayer) frequency.pilatesYogaSports += 1;
    if (recoveryLayer) frequency.recoveryMobility += 1;
    if (day.recovery) {
      if (/sport/i.test(day.displayTitle)) frequency.conditioningCardio += 1;
      continue;
    }
    for (const group of dayGroups(day)) frequency[group] += 1;
  }
  return frequency;
}

const women = PROTOCOL_LIBRARY.filter((protocol) => protocol.category === "womens-performance");
check(women.length >= 9, `Expected at least 9 women protocols; found ${women.length}.`);
check(new Set(women.map((protocol) => protocol.id)).size === women.length, "Women protocol ids must be unique.");
check(new Set(women.map((protocol) => protocol.name)).size === women.length, "Women protocol names must be unique.");
check(new Set(women.map((protocol) => protocol.womensTrack)).size === women.length, "Women protocols must map to unique architecture tracks.");
check(ACTIVITY_STACKS.length >= 8, `Expected at least 8 activity stacks; found ${ACTIVITY_STACKS.length}.`);

const banned = /pink version|pink fitness|bikini body|booty|tone up|watered-down|guaranteed|you will lose fat|you will gain muscle|batman split|reserve selected|today · recommended|recommended split|women['’]s performance protocol|6x champion/i;
const frequencies = new Map<string, Frequency>();

for (const def of women) {
  const product = protocolProduct(def.id);
  check(Boolean(def.womensTrack && WOMENS_TRACKS[def.womensTrack]), `${def.name} has no architecture mapping.`);
  check(Boolean(product), `${def.name} has no product identity data.`);
  check(Boolean(product?.weeklyStructure.length), `${def.name} has an empty weekly structure.`);
  check(Boolean(product?.nutritionBias.summary && product.nutritionBias.points.length), `${def.name} has no nutrition alignment.`);
  check(Boolean(product?.activityCompatibility), `${def.name} has no activity fit.`);
  check(Boolean(product?.desireHook && product.outcomeVision), `${def.name} has incomplete desire/outcome copy.`);
  check(!banned.test(JSON.stringify({ def, product })), `${def.name} contains banned public card copy.`);

  const active = activateProtocol(def, { now: new Date("2026-06-17T12:00:00Z") });
  check(active.protocolId === def.id && active.protocolName === def.name, `${def.name} activation did not preserve canonical identity.`);

  const nutrition = resolveProtocolNutritionBias({ protocolId: def.id, protocolCategory: def.category, goal: def.primaryGoal, womensTrack: def.womensTrack, activityStack: "gym-only" });
  check(Boolean(nutrition.outcomeLanguage && nutrition.trainingDayStrategy), `${def.name} nutrition resolver returned incomplete alignment.`);
  if (def.id === "vacation-physique") check(nutrition.nutritionPhase !== "lean-gain", "Vacation Physique must not resolve to lean gain.");
  if (def.id === "glute-ascend" || def.id === "glute-crown") check(nutrition.nutritionPhase !== "cut", `${def.name} must not default to an aggressive cut.`);

  const frequency = frequencyFor(def);
  frequencies.set(def.name, frequency);
  if (def.id === "glute-ascend" || def.id === "glute-crown") check(frequency.glutes >= 3, `${def.name} has ${frequency.glutes} glute exposures; expected at least 3.`);
  if (def.id === "sculpted-legs") {
    check(frequency.quads >= 2, `${def.name} has ${frequency.quads} quad exposures; expected at least 2.`);
    check(frequency.hamstrings >= 2, `${def.name} has ${frequency.hamstrings} hamstring exposures; expected at least 2.`);
    check(frequency.calves >= 2, `${def.name} has ${frequency.calves} calf exposures; expected at least 2.`);
  }
  if (def.id === "vacation-physique") {
    check(frequency.hamstrings >= 2 && frequency.calves >= 2, `${def.name} must train hamstrings and calves at least twice.`);
    check(frequency.recoveryMobility >= 2, `${def.name} must preserve at least two recovery/mobility layers.`);
  }
  if (def.id === "hybrid-pilates-shape") {
    check(frequency.upperFrame >= 2 && frequency.conditioningCardio >= 2, `${def.name} must include two upper-frame and conditioning exposures.`);
    check(frequency.recoveryMobility >= 3 && frequency.pilatesYogaSports >= 2, `${def.name} must preserve three recovery/mobility layers and two hybrid exposures.`);
  }
  if (def.id === "sport-strength-shape") {
    check(frequency.upperFrame >= 2, `${def.name} must include two upper-frame exposures.`);
    check(frequency.conditioningCardio >= 3 && frequency.recoveryMobility >= 3 && frequency.pilatesYogaSports >= 2, `${def.name} must preserve sport, conditioning, and recovery layers.`);
  }
}

const macros = resolveMacroTargets({ phase: "controlled-cut", bodyweightLb: 150, dietStyle: "standard", hasConfirmedBodyData: true });
check(Boolean(macros.lowerBodyDayMacros && macros.restDayMacros && macros.lowerBodyDayMacros.carbsG > macros.restDayMacros.carbsG), "Lower-body day carbs must exceed rest-day carbs.");
const incomplete = resolveMacroTargets({ phase: "recomp", bodyweightLb: null, dietStyle: "standard" });
check(incomplete.incomplete && incomplete.caloriesTarget === null, "Missing body data must not produce exact macro targets.");
const summerLean = resolveProtocolNutritionBias({ goal: "Summer lean waistline", fatLossPriority: true, currentPhaseOverride: "lean-gain" });
check(summerLean.nutritionPhase === "controlled-cut", "Summer-lean direction must block lean-gain as the effective phase.");

const root = path.resolve(__dirname, "..");
const protocolView = fs.readFileSync(path.join(root, "src/components/views/ProtocolCommandView.tsx"), "utf8");
const store = fs.readFileSync(path.join(root, "src/lib/athlete-store.ts"), "utf8");
const apex = fs.readFileSync(path.join(root, "src/components/apex/ApexCommandV2.tsx"), "utf8");
const training = fs.readFileSync(path.join(root, "src/components/views/TrainingView.tsx"), "utf8");
check(/c === "womens-performance"/.test(protocolView), "Women tab filter is not category-driven.");
check(/track: definition\.womensTrack \?\? null/.test(store), "Protocol activation does not update the focus/architecture source.");
check(/resolveDailyTrainingContext/.test(apex), "Apex does not read the shared daily training context.");
check(/resolveDailyTrainingContext/.test(training) && /resolveActiveSession\(selectedSplitRow/.test(training), "Training/cockpit does not read the shared daily training context.");

console.log(`Women protocols: ${women.length}`);
for (const def of women) {
  const f = frequencies.get(def.name)!;
  console.log(`${def.name} [${def.id} -> ${def.womensTrack}] :: glutes ${f.glutes} | hamstrings ${f.hamstrings} | quads ${f.quads} | calves ${f.calves} | core/waist ${f.coreWaist} | upper frame ${f.upperFrame} | conditioning/cardio ${f.conditioningCardio} | recovery/mobility ${f.recoveryMobility} | Pilates/Yoga/Sports ${f.pilatesYogaSports}`);
}

if (failures.length) {
  console.error("\nREGRESSION GUARD FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("\nREGRESSION GUARD PASSED");
}
