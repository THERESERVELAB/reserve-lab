/* ════════════════════════════════════════════════════════════════════════
   FIELD MANUAL — the everyday side of a cycle: how to eat, the daily habits
   with evidence behind them, and the kit for watching your own numbers.

   Every line comes from a public guideline or published research, with its
   source. Each item names the body areas it touches, and the member's own
   compounds light up the ones that matter for them. Order is fixed, never
   ranked by the member's data.

   Food and habit guidance here is general public-health guidance, the same
   for anyone. It never says what compound or supplement to take, how much or
   when, and never claims a habit offsets or reverses a compound's effects.
   ════════════════════════════════════════════════════════════════════════ */

import type { CompoundRiskBrief, ProfileSource } from "@/lib/compound-intelligence/risk-profiles";
import { SUPPORT_AREA_LABEL, supportAreasForBrief, type SupportArea } from "@/lib/compound-intelligence/support-options";

export const FIELD_MANUAL_VERSION = "2026.09.16";

export type ManualKind = "do" | "limit" | "swap" | "know";

export const MANUAL_KIND_LABEL: Record<ManualKind, string> = {
  do: "Do",
  limit: "Limit",
  swap: "Swap",
  know: "Know",
};

export type ManualSectionKey = "eat" | "habits" | "kit";

export const MANUAL_SECTION_LABEL: Record<ManualSectionKey, string> = {
  eat: "Eat",
  habits: "Daily habits",
  kit: "Kit",
};

export type ManualItem = {
  key: string;
  section: ManualSectionKey;
  kind: ManualKind;
  title: string;
  text: string;
  /** Body areas this touches — matched against the member's compounds. */
  areas: SupportArea[];
  sources: ProfileSource[];
};

const SRC = {
  dga: { label: "U.S. Departments of Agriculture and Health and Human Services: Dietary Guidelines for Americans, 2020–2025", url: "https://www.dietaryguidelines.gov" },
  amdr: { label: "National Academies: Dietary Reference Intakes for energy, carbohydrate, fiber, fat, fatty acids, cholesterol, protein and amino acids (acceptable macronutrient distribution ranges)" },
  issnProtein: { label: "Jäger R, et al. International Society of Sports Nutrition position stand: protein and exercise, 2017", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/" },
  acsmNutrition: { label: "Thomas DT, et al. American College of Sports Medicine joint position statement: Nutrition and athletic performance, 2016" },
  ahaSatFat: { label: "American Heart Association: Saturated fat", url: "https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats/saturated-fats" },
  ahaSodium: { label: "American Heart Association: How much sodium should I eat per day?", url: "https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/sodium/how-much-sodium-should-i-eat-per-day" },
  nhlbiDash: { label: "NIH National Heart, Lung, and Blood Institute: DASH eating plan", url: "https://www.nhlbi.nih.gov/education/dash-eating-plan" },
  fdaSweeteners: { label: "FDA: Aspartame and other sweeteners in food (high-intensity sweeteners, including steviol glycosides and monk fruit extract)", url: "https://www.fda.gov/food/food-additives-petitions/aspartame-and-other-sweeteners-food" },
  whoSweeteners: { label: "World Health Organization guideline: Use of non-sugar sweeteners, 2023", url: "https://www.who.int/publications/i/item/9789240073616" },
  aadDiet: { label: "American Academy of Dermatology: Can the right diet get rid of acne?", url: "https://www.aad.org/public/diseases/acne/causes/diet" },
  fdaGrapefruit: { label: "FDA: Grapefruit juice and some drugs don't mix", url: "https://www.fda.gov/consumers/consumer-updates/grapefruit-juice-and-some-drugs-dont-mix" },
  acsmFluid: { label: "American College of Sports Medicine position stand: Exercise and fluid replacement, 2007" },
  medlineHematocrit: { label: "MedlinePlus: Hematocrit test, U.S. National Library of Medicine", url: "https://medlineplus.gov/lab-tests/hematocrit-test/" },
  hhsActivity: { label: "U.S. Department of Health and Human Services: Physical Activity Guidelines for Americans, 2nd edition", url: "https://health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines" },
  ahaExerciseBp: { label: "American Heart Association: Getting active to control high blood pressure", url: "https://www.heart.org/en/health-topics/high-blood-pressure/changes-you-can-make-to-manage-high-blood-pressure/getting-active-to-control-high-blood-pressure" },
  saunaCohort: { label: "Laukkanen T, et al. Association between sauna bathing and fatal cardiovascular and all-cause mortality events. JAMA Internal Medicine, 2015." },
  saunaReview: { label: "Laukkanen JA, et al. Cardiovascular and other health benefits of sauna bathing: a review of the evidence. Mayo Clinic Proceedings, 2018." },
  cdcSleep: { label: "CDC: About sleep — how much sleep do I need?", url: "https://www.cdc.gov/sleep/about/index.html" },
  nhlbiApnea: { label: "NIH National Heart, Lung, and Blood Institute: Sleep Apnea", url: "https://www.nhlbi.nih.gov/health/sleep-apnea" },
  fdaCaffeine: { label: "FDA: Spilling the beans — how much caffeine is too much?", url: "https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much" },
  fdaNsaid: { label: "FDA Drug Safety Communication: strengthened warning that non-aspirin NSAIDs can cause heart attacks or strokes, 2015", url: "https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-strengthens-existing-label-warning-non-aspirin-nonsteroidal-anti-inflammatory" },
  ahaOtc: { label: "American Heart Association: High blood pressure and cold remedies", url: "https://www.heart.org/en/health-topics/high-blood-pressure/changes-you-can-make-to-manage-high-blood-pressure/high-blood-pressure-and-cold-remedies-which-are-safe" },
  ahaNicotine: { label: "American Heart Association: Smoking, vaping and high blood pressure", url: "https://www.heart.org/en/health-topics/high-blood-pressure/changes-you-can-make-to-manage-high-blood-pressure/smoking-and-high-blood-pressure" },
  ahaHomeBp: { label: "American Heart Association: Monitoring your blood pressure at home", url: "https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/monitoring-your-blood-pressure-at-home" },
  validateBp: { label: "American Medical Association: US Blood Pressure Validated Device Listing", url: "https://www.validatebp.org" },
  endocrine: { label: "Pope HG Jr, et al. Adverse health consequences of performance-enhancing drugs: an Endocrine Society scientific statement. Endocrine Reviews, 2014." },
  fdaSharps: { label: "FDA: Safely using sharps (needles and syringes) at home, at work and on travel", url: "https://www.fda.gov/medical-devices/consumer-products/safely-using-sharps-needles-and-syringes-home-work-and-travel" },
} satisfies Record<string, ProfileSource>;

export const FIELD_MANUAL_ITEMS: readonly ManualItem[] = [
  /* ── Eat ── */
  {
    key: "protein", section: "eat", kind: "do", title: "Protein across the day",
    text: "The International Society of Sports Nutrition puts most people who train at 1.4–2.0 grams of protein per kilogram of body weight a day, spread over meals. Your own daily targets are in Nutrition.",
    areas: ["general"], sources: [SRC.issnProtein],
  },
  {
    key: "carbs", section: "eat", kind: "do", title: "Carbohydrate for training",
    text: "Carbohydrate fuels hard sessions. The Dietary Guidelines ask for at least half of grains to be whole grains; oats, rice, potatoes, fruit and beans carry fiber and nutrients that sweets do not.",
    areas: ["general", "metabolic"], sources: [SRC.dga, SRC.acsmNutrition],
  },
  {
    key: "fats", section: "eat", kind: "do", title: "The kind of fat",
    text: "Fat is 20–35% of daily calories in the national ranges. Olive oil, nuts, seeds, avocado and fish lean unsaturated. Anabolic steroids push HDL cholesterol down and LDL up, so the kind of fat matters more during a cycle.",
    areas: ["lipids", "cardiovascular"], sources: [SRC.amdr, SRC.dga],
  },
  {
    key: "saturated-fat", section: "eat", kind: "limit", title: "Saturated fat",
    text: "The Dietary Guidelines keep saturated fat under 10% of daily calories, and the American Heart Association's target is lower. Butter, fatty red meat, full-fat cheese, fried food and pastries carry the most.",
    areas: ["lipids", "cardiovascular"], sources: [SRC.dga, SRC.ahaSatFat],
  },
  {
    key: "fiber", section: "eat", kind: "do", title: "Fiber",
    text: "The Dietary Guidelines set fiber at about 14 grams for every 1,000 calories eaten. Oats, beans, lentils, berries and vegetables carry soluble fiber, which lowers LDL cholesterol.",
    areas: ["lipids", "metabolic", "digestive"], sources: [SRC.dga],
  },
  {
    key: "added-sugar", section: "eat", kind: "limit", title: "Added sugar",
    text: "Under 10% of daily calories, per the Dietary Guidelines. Brown sugar, raw sugar, honey, agave and maple syrup all count as added sugar — trading one for another does not change that. Sweetened drinks are the largest source.",
    areas: ["metabolic", "lipids"], sources: [SRC.dga],
  },
  {
    key: "sweeteners", section: "eat", kind: "swap", title: "Monk fruit and stevia",
    text: "Monk fruit extract and purified stevia add sweetness without sugar, and the FDA has not objected to either as generally recognized as safe. The World Health Organization notes long-term studies do not show they help with weight control.",
    areas: ["metabolic"], sources: [SRC.fdaSweeteners, SRC.whoSweeteners],
  },
  {
    key: "sodium", section: "eat", kind: "limit", title: "Sodium",
    text: "The Dietary Guidelines cap sodium at about a teaspoon of salt a day in total, and the American Heart Association's ideal is lower for blood pressure. Most comes from packaged and restaurant food. Electrolyte drinks and some pre-workouts add more.",
    areas: ["cardiovascular", "kidney"], sources: [SRC.dga, SRC.ahaSodium],
  },
  {
    key: "dash", section: "eat", kind: "do", title: "The DASH pattern",
    text: "Vegetables, fruit, low-fat dairy, whole grains, beans, nuts and fish, with less salt and sugar. In controlled trials the DASH pattern lowered blood pressure within weeks.",
    areas: ["cardiovascular"], sources: [SRC.nhlbiDash],
  },
  {
    key: "milk", section: "eat", kind: "know", title: "Milk",
    text: "The Dietary Guidelines count low-fat or fat-free dairy toward daily needs; whole milk adds saturated fat. Some studies link milk, skim milk in particular, to acne — worth knowing when androgens already bring breakouts.",
    areas: ["skin", "lipids"], sources: [SRC.dga, SRC.aadDiet],
  },
  {
    key: "plant-milk", section: "eat", kind: "swap", title: "Almond and oat milk",
    text: "Not harmful, just different: most almond milk has little protein, and sweetened versions add sugar. Unsweetened is the version without added sugar. The Dietary Guidelines count only fortified soy milk as a dairy alternative.",
    areas: ["general", "metabolic"], sources: [SRC.dga],
  },
  {
    key: "alcohol", section: "eat", kind: "limit", title: "Alcohol",
    text: "Alcohol adds liver load and raises blood pressure and triglycerides. The Dietary Guidelines: if you drink, two drinks or fewer in a day for men and one or fewer for women — drinking less is better for health than drinking more.",
    areas: ["liver", "cardiovascular", "lipids"], sources: [SRC.dga],
  },
  {
    key: "grapefruit", section: "eat", kind: "know", title: "Grapefruit",
    text: "Grapefruit and its juice change how the body handles some medicines, including some statins and blood pressure medicines. The label or a pharmacist can say whether yours is one.",
    areas: ["cardiovascular", "lipids"], sources: [SRC.fdaGrapefruit],
  },
  {
    key: "fluids", section: "eat", kind: "do", title: "Fluids",
    text: "Dehydration concentrates the blood and can make hematocrit read higher on a lab. Drinking normally before a blood draw gives a truer number; pale-yellow urine is a simple check during training.",
    areas: ["blood", "kidney"], sources: [SRC.acsmFluid, SRC.medlineHematocrit],
  },

  /* ── Daily habits ── */
  {
    key: "cardio", section: "habits", kind: "do", title: "Cardio, every week",
    text: "Regular aerobic exercise lowers blood pressure and improves triglycerides and HDL cholesterol. The guideline is at least 150 minutes a week of moderate activity. Field Op in Schedule lays it out day by day, with a heart-rate range.",
    areas: ["cardiovascular", "lipids", "metabolic"], sources: [SRC.hhsActivity, SRC.ahaExerciseBp],
  },
  {
    key: "sauna", section: "habits", kind: "know", title: "Sauna",
    text: "In a long-running Finnish cohort, men who used a sauna more often had fewer fatal heart events — an association, not proof it caused them. Heat lowers blood pressure and dehydrates: fluids in, alcohol out, and leave if dizzy.",
    areas: ["cardiovascular"], sources: [SRC.saunaCohort, SRC.saunaReview],
  },
  {
    key: "sauna-caution", section: "habits", kind: "limit", title: "When to skip the sauna",
    text: "Chest pain, fainting, a blood pressure reading in the crisis range, or a day you are already dehydrated. Heat on top of a high hematocrit concentrates the blood further.",
    areas: ["cardiovascular", "blood"], sources: [SRC.saunaReview, SRC.medlineHematocrit],
  },
  {
    key: "sleep", section: "habits", kind: "do", title: "Seven hours or more",
    text: "Adults need seven or more hours a night. Loud snoring, gasping or pauses in breathing can be sleep apnea, which testosterone can worsen and which raises blood pressure. A sleep study diagnoses it.",
    areas: ["cardiovascular", "mood"], sources: [SRC.cdcSleep, SRC.nhlbiApnea],
  },
  {
    key: "stimulants", section: "habits", kind: "limit", title: "Pre-workouts and energy drinks",
    text: "Stimulants raise heart rate and blood pressure. The FDA's general ceiling for caffeine in healthy adults is about four or five cups of coffee a day, and a single pre-workout scoop can hold a large share of it.",
    areas: ["cardiovascular"], sources: [SRC.fdaCaffeine],
  },
  {
    key: "nsaids", section: "habits", kind: "limit", title: "Ibuprofen and naproxen",
    text: "Regular use raises blood pressure and strains the kidneys, and the FDA warns of a higher risk of heart attack and stroke. Worth knowing before reaching for them for every training ache.",
    areas: ["cardiovascular", "kidney"], sources: [SRC.fdaNsaid],
  },
  {
    key: "decongestants", section: "habits", kind: "limit", title: "Cold medicines with decongestants",
    text: "Pseudoephedrine and phenylephrine raise blood pressure. The American Heart Association flags them for anyone whose pressure runs high; the pharmacist can point to versions without them.",
    areas: ["cardiovascular"], sources: [SRC.ahaOtc],
  },
  {
    key: "nicotine", section: "habits", kind: "limit", title: "Smoking and vaping",
    text: "Nicotine raises blood pressure and heart rate with every use, and smoking damages blood vessels on top of what anabolic steroids already do to cholesterol.",
    areas: ["cardiovascular", "lipids"], sources: [SRC.ahaNicotine],
  },

  /* ── Kit ── */
  {
    key: "bp-cuff", section: "kit", kind: "do", title: "An upper-arm blood pressure cuff",
    text: "An automatic upper-arm cuff that has been checked for accuracy — the American Medical Association keeps a list at validatebp.org. Wrist and finger devices are less reliable, and the cuff has to fit the size of your arm.",
    areas: ["cardiovascular"], sources: [SRC.validateBp, SRC.ahaHomeBp],
  },
  {
    key: "bp-how", section: "kit", kind: "do", title: "How to take a reading",
    text: "Sit quietly for five minutes, back supported, feet flat, arm resting at heart level, with no caffeine, exercise or smoking in the half hour before. Take two readings a minute apart and log them in a check-in.",
    areas: ["cardiovascular"], sources: [SRC.ahaHomeBp],
  },
  {
    key: "scale", section: "kit", kind: "do", title: "A scale and a tape measure",
    text: "Anabolic steroids can cause fluid retention. Fast weight gain with swelling in the ankles or legs shows up first on a morning weight — shortness of breath with it needs care the same day.",
    areas: ["cardiovascular"], sources: [SRC.endocrine],
  },
  {
    key: "sharps", section: "kit", kind: "do", title: "A sharps container",
    text: "Used needles go straight into an FDA-cleared sharps container, never loose in household trash. Disposal rules vary by state; many pharmacies and health departments take full containers.",
    areas: [], sources: [SRC.fdaSharps],
  },
];

export type FieldManualEntry = ManualItem & {
  /** The member's compounds that affect an area this item touches. */
  forYou: { areaLabels: string[]; compoundNames: string[] } | null;
};

export type FieldManual = {
  sections: Array<{ key: ManualSectionKey; label: string; items: FieldManualEntry[] }>;
  /** How many items touch an area the member's compounds affect. */
  forYouCount: number;
};

/** Areas every member's compounds touch in practice — never used to personalize. */
const GENERIC_AREAS: ReadonlySet<SupportArea> = new Set(["general"]);

export function buildFieldManual(brief: CompoundRiskBrief | null): FieldManual {
  const loaded = brief ? supportAreasForBrief(brief).filter((entry) => !GENERIC_AREAS.has(entry.area)) : [];
  const byArea = new Map(loaded.map((entry) => [entry.area, entry.compoundNames]));

  const entries: FieldManualEntry[] = FIELD_MANUAL_ITEMS.map((item) => {
    const hits = item.areas.filter((area) => byArea.has(area));
    if (hits.length === 0) return { ...item, forYou: null };
    const names = [...new Set(hits.flatMap((area) => byArea.get(area) ?? []))].sort((a, b) => a.localeCompare(b));
    return { ...item, forYou: { areaLabels: hits.map((area) => SUPPORT_AREA_LABEL[area]), compoundNames: names } };
  });

  return {
    sections: (Object.keys(MANUAL_SECTION_LABEL) as ManualSectionKey[]).map((key) => ({
      key,
      label: MANUAL_SECTION_LABEL[key],
      items: entries.filter((entry) => entry.section === key),
    })),
    forYouCount: entries.filter((entry) => entry.forYou).length,
  };
}
