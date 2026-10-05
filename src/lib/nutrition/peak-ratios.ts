/* ════════════════════════════════════════════════════════════════════════
   PEAK RATIOS — how fatty a meat is, picked for the member.

   Ground beef, ground bison and ground turkey are different meats, each sold
   at several lean-to-fat ratios. Steaks and salmon have no ratio, but some
   cuts carry far more fat than others. Each is a ladder, leanest first, and
   Reserve picks the step from:

     · the look — a deficit leaves little room for fat, a surplus a little more
     · the member's compounds — when they affect cholesterol, the leanest step
     · the member's own labs — when the latest LDL, ApoB or total cholesterol is
       above the range printed on their report, the leanest step

   Compounds and labs only move meats whose fat is largely saturated (beef,
   bison, turkey, steak). Salmon's fat is mostly unsaturated and the American
   Heart Association encourages fatty fish, so for salmon only the look
   decides — and the plate says so.

   This is food guidance, never a claim that a ratio or cut changes a lab
   result, and a flagged result always routes to a clinician. The member can
   pick any step.
   ════════════════════════════════════════════════════════════════════════ */

import type { ProfileSource } from "@/lib/compound-intelligence/risk-profiles";

import type { PeakLook } from "./peak-mode";
import { PEAK_FOODS, type PeakFood } from "./peak-signatures";

export type GroundFamily = "beef" | "bison" | "turkey" | "steak" | "salmon" | "chicken" | "pork" | "egg";
/** The same families, named for what they are now: ground meats, steak cuts and salmon cuts. */
export type MeatFamily = GroundFamily;

type FamilyMeta = {
  label: string;
  /** "ratio" for ground meats (96/4), "cut" for steaks and salmon (Eye of round). */
  kind: "ratio" | "cut";
  /** Whether cholesterol flags move the pick. False where the fat is mostly unsaturated. */
  lipidSensitive: boolean;
  /** Share of total fat that is saturated, from USDA FoodData Central cooked values (rounded). */
  satFatShare: number;
  /** Where each look starts on the ladder before compounds and labs are counted. */
  lookStep: Record<PeakLook, number>;
  /** Steps that stay as authored when a plate already uses them — egg whites are never traded for yolks. */
  fixedSteps?: PeakFood[];
  sources: ProfileSource[];
};

const AHA_SAT_FAT: ProfileSource = { label: "American Heart Association: Saturated fat", url: "https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats/saturated-fats" };
const DGA: ProfileSource = { label: "U.S. Departments of Agriculture and Health and Human Services: Dietary Guidelines for Americans, 2020–2025", url: "https://www.dietaryguidelines.gov" };
const AHA_FISH: ProfileSource = { label: "American Heart Association: Fish and omega-3 fatty acids", url: "https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats/fish-and-omega-3-fatty-acids" };
const AHA_EGGS: ProfileSource = { label: "American Heart Association: Are eggs good for you or not?", url: "https://www.heart.org/en/news/2018/08/15/are-eggs-good-for-you-or-not" };

export const FAMILY: Record<GroundFamily, FamilyMeta> = {
  beef: { label: "Ground beef", kind: "ratio", lipidSensitive: true, satFatShare: 0.4, lookStep: { "lean-hard": 0, recomp: 1, "full-hard": 2 }, sources: [AHA_SAT_FAT, DGA] },
  bison: { label: "Ground bison", kind: "ratio", lipidSensitive: true, satFatShare: 0.4, lookStep: { "lean-hard": 0, recomp: 1, "full-hard": 1 }, sources: [AHA_SAT_FAT, DGA] },
  turkey: { label: "Ground turkey", kind: "ratio", lipidSensitive: true, satFatShare: 0.28, lookStep: { "lean-hard": 0, recomp: 1, "full-hard": 1 }, sources: [AHA_SAT_FAT, DGA] },
  steak: { label: "Steak", kind: "cut", lipidSensitive: true, satFatShare: 0.4, lookStep: { "lean-hard": 0, recomp: 2, "full-hard": 4 }, sources: [AHA_SAT_FAT, DGA] },
  salmon: { label: "Salmon", kind: "cut", lipidSensitive: false, satFatShare: 0.2, lookStep: { "lean-hard": 0, recomp: 1, "full-hard": 2 }, sources: [AHA_FISH, DGA] },
  chicken: { label: "Chicken", kind: "cut", lipidSensitive: true, satFatShare: 0.28, lookStep: { "lean-hard": 0, recomp: 0, "full-hard": 2 }, sources: [AHA_SAT_FAT, DGA] },
  pork: { label: "Pork", kind: "cut", lipidSensitive: true, satFatShare: 0.36, lookStep: { "lean-hard": 0, recomp: 0, "full-hard": 1 }, sources: [AHA_SAT_FAT, DGA] },
  egg: { label: "Eggs", kind: "cut", lipidSensitive: true, satFatShare: 0.33, lookStep: { "lean-hard": 1, recomp: 1, "full-hard": 1 }, fixedSteps: ["egg whites"], sources: [AHA_EGGS, AHA_SAT_FAT] },
};

export const GROUND_FAMILY_LABEL: Record<GroundFamily, string> = Object.fromEntries(
  (Object.keys(FAMILY) as GroundFamily[]).map((f) => [f, FAMILY[f].label]),
) as Record<GroundFamily, string>;

/** Each family's steps, leanest first. `ratio` is the step's short label: a ratio or a cut name. */
export const RATIO_LADDER: Record<GroundFamily, Array<{ food: PeakFood; ratio: string }>> = {
  beef: [
    { food: "96/4 ground beef", ratio: "96/4" },
    { food: "93% lean ground beef", ratio: "93/7" },
    { food: "90/10 ground beef", ratio: "90/10" },
    { food: "85/15 ground beef", ratio: "85/15" },
    { food: "80/20 ground beef", ratio: "80/20" },
  ],
  bison: [
    { food: "90/10 ground bison", ratio: "90/10" },
    { food: "85/15 ground bison", ratio: "85/15" },
  ],
  turkey: [
    { food: "99% lean ground turkey", ratio: "99/1" },
    { food: "93/7 ground turkey", ratio: "93/7" },
  ],
  steak: [
    { food: "eye of round steak", ratio: "Eye of round" },
    { food: "top round steak", ratio: "Top round" },
    { food: "top sirloin, trimmed", ratio: "Top sirloin" },
    { food: "flank steak", ratio: "Flank" },
    { food: "tenderloin filet", ratio: "Filet" },
    { food: "strip steak", ratio: "NY strip" },
    { food: "ribeye steak", ratio: "Ribeye" },
  ],
  salmon: [
    { food: "wild pink salmon", ratio: "Wild pink" },
    { food: "wild salmon", ratio: "Wild coho" },
    { food: "farmed Atlantic salmon", ratio: "Farmed Atlantic" },
  ],
  chicken: [
    { food: "chicken breast", ratio: "Breast" },
    { food: "chicken drumsticks, skinless", ratio: "Drumstick" },
    { food: "chicken thighs, skinless", ratio: "Thigh, skinless" },
    { food: "chicken thighs, skin on", ratio: "Thigh, skin on" },
  ],
  pork: [
    { food: "pork tenderloin", ratio: "Tenderloin" },
    { food: "pork loin chop", ratio: "Loin chop" },
    { food: "ground pork", ratio: "Ground" },
  ],
  egg: [
    { food: "egg whites", ratio: "Whites" },
    { food: "whole eggs", ratio: "Whole eggs" },
  ],
};

export const RATIO_SOURCES: ProfileSource[] = [AHA_SAT_FAT, DGA];

const LOOK_LABEL: Record<PeakLook, string> = { "lean-hard": "Lean · dry · hard", recomp: "Recomp", "full-hard": "Full · hard" };

function lookReason(look: PeakLook, noun: string): string {
  if (look === "lean-hard") return `Lean · dry · hard runs a calorie deficit, so the leanest ${noun} leaves the most room for protein and carbs.`;
  if (look === "recomp") return `Recomp sits near maintenance, so a moderate ${noun} fits.`;
  return `Full · hard runs a small surplus, which leaves room for a little more fat.`;
}

/** Lipid markers where a result above the report's range puts the leanest step first. */
export const RATIO_LAB_MARKERS = ["ldl", "apob", "total-cholesterol"] as const;

export type RatioContext = {
  look: PeakLook;
  /** The member's compounds affect cholesterol. */
  compoundLipids: boolean;
  /** Lipid results above the range on the member's own latest report, by label. */
  labLipidsAbove: string[];
  /** Steps the member picked themselves. */
  overrides?: Partial<Record<GroundFamily, PeakFood>>;
  /** Foods the member does not eat. A step is never picked for them, even by Reserve. */
  avoid?: ReadonlySet<PeakFood>;
};

/** What the look alone would have served, when cholesterol moved Reserve's pick. */
export type CholesterolChange = {
  /** The step the look alone would have picked. */
  fromRatio: string;
  /** The step Reserve picked instead. */
  toRatio: string;
  /** Saturated fat this took off the portion, in grams. */
  satFatSavedG: number;
  /** What flagged it: the member's compounds, their own lab results, or both. */
  because: { compounds: boolean; labs: string[] };
};

export type RatioPick = {
  family: GroundFamily;
  kind: "ratio" | "cut";
  food: PeakFood;
  ratio: string;
  /** Reserve's pick for this family and context. */
  reserveFood: PeakFood;
  reserveRatio: string;
  /** The member chose this step themselves. */
  chosen: boolean;
  reasons: string[];
  /** Fat and saturated fat in this portion, and saturated fat at the family's fattiest step, in grams. */
  fatG: number;
  satFatG: number;
  fattiestSatFatG: number;
  fattiestRatio: string;
  /** Set when cholesterol moved Reserve's pick away from the look's own step. */
  changedForCholesterol: CholesterolChange | null;
  sources: ProfileSource[];
};

export function familyOf(food: PeakFood): GroundFamily | null {
  for (const family of Object.keys(RATIO_LADDER) as GroundFamily[]) {
    if (RATIO_LADDER[family].some((r) => r.food === food)) return family;
  }
  return null;
}

export function fatG(food: PeakFood, grams: number): number {
  return Math.round(((PEAK_FOODS[food].f * grams) / 100) * 10) / 10;
}

export function satFatG(food: PeakFood, grams: number): number {
  const family = familyOf(food);
  if (!family) return 0;
  return Math.round(((PEAK_FOODS[food].f * grams) / 100) * FAMILY[family].satFatShare * 10) / 10;
}

/** The steps a member eats: their "foods I don't eat" answers never appear, not even as Reserve's pick. */
export function allowedSteps(family: GroundFamily, avoid?: ReadonlySet<PeakFood>): Array<{ food: PeakFood; ratio: string }> {
  const ladder = RATIO_LADDER[family];
  const allowed = avoid ? ladder.filter((step) => !avoid.has(step.food)) : ladder;
  return allowed.length > 0 ? allowed : ladder;
}

/** Reserve's step for a family, and why. */
export function reserveRatio(family: GroundFamily, ctx: RatioContext): { food: PeakFood; ratio: string; reasons: string[]; lookRatio: string; movedByCholesterol: boolean } {
  const meta = FAMILY[family];
  const ladder = allowedSteps(family, ctx.avoid);
  const noun = meta.kind === "ratio" ? "ratio" : "cut";
  const cholesterolFlag = ctx.compoundLipids || ctx.labLipidsAbove.length > 0;
  const flagged = meta.lipidSensitive && cholesterolFlag;
  const lookStep = Math.min(meta.lookStep[ctx.look], ladder.length - 1);
  const eggsToWhites = family === "egg" && flagged;
  const step = flagged ? 0 : lookStep;
  /* When cholesterol moves the pick, say where the look alone would have started, so the reasons never disagree. */
  const reasons = [step === lookStep ? lookReason(ctx.look, noun) : `${LOOK_LABEL[ctx.look]} alone would start at ${ladder[lookStep].ratio}.`];
  if (meta.lipidSensitive) {
    if (ctx.compoundLipids) reasons.push(`Your compounds affect cholesterol, and leaner ${noun}s carry less saturated fat.`);
    if (ctx.labLipidsAbove.length > 0) {
      reasons.push(`Your latest ${joinList(ctx.labLipidsAbove)} ${ctx.labLipidsAbove.length === 1 ? "is" : "are"} above the range on your report, so the leanest ${noun} comes first. Review the result with a clinician.`);
    }
  } else if (cholesterolFlag) {
    reasons.push("Salmon's fat is mostly unsaturated, and the American Heart Association encourages fatty fish, so cholesterol flags don't move this pick — the look does.");
  }
  if (eggsToWhites) reasons.push("Whites carry the protein without the yolk's fat. The American Heart Association reads about an egg a day as reasonable for most healthy adults.");
  return { ...ladder[step], reasons, lookRatio: ladder[lookStep].ratio, movedByCholesterol: flagged && step !== lookStep };
}

/** The step a portion uses: the member's own pick when they made one, otherwise Reserve's. */
export function resolveRatio(food: PeakFood, grams: number, ctx: RatioContext): RatioPick | null {
  const family = familyOf(food);
  if (!family) return null;
  const meta = FAMILY[family];
  if (meta.fixedSteps?.includes(food)) return null;
  const ladder = allowedSteps(family, ctx.avoid);
  const reserve = reserveRatio(family, ctx);
  const override = ctx.overrides?.[family];
  const chosenStep = override && !ctx.avoid?.has(override) ? ladder.find((r) => r.food === override) : undefined;
  const pick = chosenStep ?? reserve;
  const fattiest = ladder[ladder.length - 1];
  const reasons = [...reserve.reasons];
  const lookStepFood = ladder.find((r) => r.ratio === reserve.lookRatio)?.food;
  const changedForCholesterol: CholesterolChange | null =
    reserve.movedByCholesterol && lookStepFood
      ? {
          fromRatio: reserve.lookRatio,
          toRatio: reserve.ratio,
          satFatSavedG: Math.round((satFatG(lookStepFood, grams) - satFatG(reserve.food, grams)) * 10) / 10,
          because: { compounds: ctx.compoundLipids, labs: ctx.labLipidsAbove },
        }
      : null;
  if (chosenStep && chosenStep.food !== reserve.food) {
    const leaner = ladder.findIndex((r) => r.food === chosenStep.food) < ladder.findIndex((r) => r.food === reserve.food);
    reasons.push(`You picked ${chosenStep.ratio}; Reserve's pick is ${reserve.ratio}, which is ${leaner ? "fattier" : "leaner"}.`);
  }
  return {
    family,
    kind: meta.kind,
    food: pick.food,
    ratio: pick.ratio,
    reserveFood: reserve.food,
    reserveRatio: reserve.ratio,
    chosen: Boolean(chosenStep),
    reasons,
    fatG: fatG(pick.food, grams),
    satFatG: satFatG(pick.food, grams),
    fattiestSatFatG: satFatG(fattiest.food, grams),
    fattiestRatio: fattiest.ratio,
    changedForCholesterol,
    sources: meta.sources,
  };
}

function joinList(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
