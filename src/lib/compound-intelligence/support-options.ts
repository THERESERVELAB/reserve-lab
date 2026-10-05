/* ════════════════════════════════════════════════════════════════════════
   SUPPORT OPTIONS — what exists for an area the member's data touches, and
   what the research honestly shows about it.

   This is the ONE supplement library. The Cycle & Safety support sheets and
   the Cycle Review support plan both read it; there is no second database.

   For every option it holds:
     · findings by purpose area, each with an evidence grade — including
       "not shown in trials"
     · what the option does NOT address, so no member reads it as protection
     · the nutrients it contains, for duplicate-intake checks
     · a plain note for areas where no supplement has evidence at all

   The member decides. Options are listed alphabetically — never ranked, never
   "best". There are NO amounts, timing, schedules or combinations, and
   nothing here claims an option protects against or reverses harm. Only
   dietary supplements belong here: prescription medicines never do.

   REVIEW: every option ships as "pending-clinician-review", like the risk
   profiles. The version string moves whenever any option's content changes.
   ════════════════════════════════════════════════════════════════════════ */

import { findCatalogEntry } from "@/lib/enhancement/catalog";
import type { MarkerKey } from "@/lib/labs/markers";

import type { EvidenceGrade } from "./evidence";
import {
  RISK_SYSTEM_LABEL,
  profilesForCompound,
  type CompoundIdentity,
  type CompoundRiskBrief,
  type ProfileReview,
  type ProfileSource,
  type RiskSystem,
} from "./risk-profiles";

export { EVIDENCE_GRADE_DETAIL, EVIDENCE_GRADE_LABEL, type EvidenceGrade } from "./evidence";

export const SUPPORT_OPTIONS_VERSION = "2026.09.29";

/* ─── Vocabulary ──────────────────────────────────────────────────────── */

export type SupportArea = RiskSystem | "general" | "sleep" | "hydration" | "recovery";

export const SUPPORT_AREA_LABEL: Record<SupportArea, string> = {
  ...RISK_SYSTEM_LABEL,
  general: "General nutrition",
  sleep: "Sleep",
  hydration: "Hydration",
  recovery: "Recovery",
};

/** Areas that describe how a product is handled, not what it affects in the body. */
const NON_BODY_AREAS: ReadonlySet<RiskSystem> = new Set(["sourcing", "injection"]);

/** How the library is organized for the member: by purpose, never by folklore. */
export type PurposeGroupKey =
  | "cardiovascular"
  | "liver"
  | "kidney"
  | "glucose"
  | "hormonal"
  | "prostate"
  | "skin"
  | "blood"
  | "mood"
  | "thyroid"
  | "general"
  | "recovery"
  | "sleep"
  | "hydration"
  | "bone"
  | "gi";

export const PURPOSE_GROUPS: Array<{ key: PurposeGroupKey; label: string; areas: SupportArea[] }> = [
  { key: "cardiovascular", label: "Cardiovascular & lipids", areas: ["cardiovascular", "lipids"] },
  { key: "liver", label: "Liver", areas: ["liver"] },
  { key: "kidney", label: "Kidney", areas: ["kidney"] },
  { key: "glucose", label: "Glucose & metabolic", areas: ["metabolic"] },
  { key: "hormonal", label: "Hormones & fertility", areas: ["hormonal", "fertility"] },
  { key: "prostate", label: "Prostate", areas: ["prostate"] },
  { key: "skin", label: "Skin & hair", areas: ["skin"] },
  { key: "blood", label: "Blood", areas: ["blood"] },
  { key: "mood", label: "Mood", areas: ["mood"] },
  { key: "thyroid", label: "Thyroid", areas: ["thyroid"] },
  { key: "general", label: "General nutrition", areas: ["general"] },
  { key: "recovery", label: "Recovery", areas: ["recovery"] },
  { key: "sleep", label: "Sleep", areas: ["sleep"] },
  { key: "hydration", label: "Hydration & electrolytes", areas: ["hydration"] },
  { key: "bone", label: "Bone health", areas: ["bone"] },
  { key: "gi", label: "GI health", areas: ["digestive"] },
];

export type NutrientKey =
  | "vitamin-a"
  | "vitamin-b6"
  | "niacin"
  | "vitamin-d"
  | "vitamin-k"
  | "calcium"
  | "magnesium"
  | "zinc"
  | "iron"
  | "sodium"
  | "potassium"
  | "omega-3"
  | "soluble-fiber";

export const NUTRIENT_LABEL: Record<NutrientKey, string> = {
  "vitamin-a": "Vitamin A",
  "vitamin-b6": "Vitamin B6",
  niacin: "Niacin",
  "vitamin-d": "Vitamin D",
  "vitamin-k": "Vitamin K",
  calcium: "Calcium",
  magnesium: "Magnesium",
  zinc: "Zinc",
  iron: "Iron",
  sodium: "Sodium",
  potassium: "Potassium",
  "omega-3": "Omega-3",
  "soluble-fiber": "Soluble fiber",
};

/** Nutrients where intake from several products can add up to a problem. */
export const DUPLICATE_WATCH: ReadonlySet<NutrientKey> = new Set([
  "vitamin-a", "vitamin-b6", "niacin", "vitamin-d", "calcium", "magnesium", "zinc", "iron", "sodium", "potassium",
]);

/** "contains" = the product is that nutrient; "commonly" = most products include it — check the label. */
export type Ingredient = { nutrient: NutrientKey; certainty: "contains" | "commonly" };

/** Ingredients for catalog supplements, including ones the member may log outside the library. */
export const CATALOG_INGREDIENTS: Record<string, Ingredient[]> = {
  Multivitamin: [
    { nutrient: "vitamin-a", certainty: "commonly" },
    { nutrient: "vitamin-b6", certainty: "commonly" },
    { nutrient: "niacin", certainty: "commonly" },
    { nutrient: "vitamin-d", certainty: "commonly" },
    { nutrient: "vitamin-k", certainty: "commonly" },
    { nutrient: "calcium", certainty: "commonly" },
    { nutrient: "magnesium", certainty: "commonly" },
    { nutrient: "zinc", certainty: "commonly" },
    { nutrient: "iron", certainty: "commonly" },
  ],
  "Vitamin D3": [{ nutrient: "vitamin-d", certainty: "contains" }],
  "Magnesium Glycinate": [{ nutrient: "magnesium", certainty: "contains" }],
  Zinc: [{ nutrient: "zinc", certainty: "contains" }],
  Ashwagandha: [],
  HMB: [],
  "Sodium Bicarbonate": [{ nutrient: "sodium", certainty: "contains" }],
  "Tart Cherry": [],
  "Beta-Alanine": [],
  Caffeine: [],
  "L-Theanine": [],
  Iron: [{ nutrient: "iron", certainty: "contains" }],
  Electrolytes: [
    { nutrient: "sodium", certainty: "contains" },
    { nutrient: "potassium", certainty: "commonly" },
    { nutrient: "magnesium", certainty: "commonly" },
  ],
  "Fish Oil": [{ nutrient: "omega-3", certainty: "contains" }],
  "Psyllium Husk": [{ nutrient: "soluble-fiber", certainty: "contains" }],
};

export type SupportFinding = {
  area: SupportArea;
  grade: EvidenceGrade;
  finding: string;
  /** Markers on the member's own reports that show this area. */
  markers: MarkerKey[];
};

export type SupportOption = {
  key: string;
  title: string;
  /** Official catalog name — what the member selects. */
  catalogName: string;
  findings: SupportFinding[];
  /** What it does not address — shown on every card so no one reads it as protection. */
  doesNotAddress: string;
  /** For an option no lab marker shows: where a member would see it instead. */
  whereYouSeeIt?: string;
  /** Short phrase for "your support plan covers". */
  coverageLabel: string;
  sources: ProfileSource[];
  review: ProfileReview;
};

/* ─── Sources ─────────────────────────────────────────────────────────── */

const SRC = {
  odsOmega3: { label: "NIH Office of Dietary Supplements: Omega-3 fatty acids fact sheet", url: "https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/" },
  odsMultivitamin: { label: "NIH Office of Dietary Supplements: Multivitamin/mineral supplements fact sheet", url: "https://ods.od.nih.gov/factsheets/MVMS-HealthProfessional/" },
  odsVitaminD: { label: "NIH Office of Dietary Supplements: Vitamin D fact sheet", url: "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/" },
  odsMagnesium: { label: "NIH Office of Dietary Supplements: Magnesium fact sheet", url: "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/" },
  nccih: { label: "NIH National Center for Complementary and Integrative Health", url: "https://www.nccih.nih.gov" },
  nccihMelatonin: { label: "NIH National Center for Complementary and Integrative Health: Melatonin", url: "https://www.nccih.nih.gov/health/melatonin-what-you-need-to-know" },
  nccihCoq10: { label: "NIH National Center for Complementary and Integrative Health: Coenzyme Q10", url: "https://www.nccih.nih.gov/health/coenzyme-q10" },
  nccihBerberine: { label: "NIH National Center for Complementary and Integrative Health: In the News — Berberine", url: "https://www.nccih.nih.gov/health/in-the-news-berberine" },
  livertoxBerberine: { label: "LiverTox: Berberine, NIH", url: "https://www.ncbi.nlm.nih.gov/books/NBK564659/" },
  livertox: { label: "LiverTox: Clinical and Research Information on Drug-Induced Liver Injury, NIH" },
  fdaFiberClaim: { label: "FDA authorized health claim for soluble fiber from certain foods, including psyllium husk (21 CFR 101.81)" },
  fdaNac: { label: "FDA guidance: Policy regarding N-acetyl-L-cysteine, 2022" },
  dailymed: { label: "FDA prescribing information (DailyMed, U.S. National Library of Medicine)", url: "https://dailymed.nlm.nih.gov" },
  acsmFluid: { label: "American College of Sports Medicine position stand: Exercise and fluid replacement, 2007" },
  nitrateBp: { label: "Plasma nitrate, dietary nitrate, blood pressure and vascular health: GRADE-assessed systematic review and dose-response meta-analysis, Nutrition Journal 2025", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11931885/" },
  garlicBp: { label: "Ried K, et al. Effect of garlic on blood pressure: systematic review and meta-analysis, BMC Cardiovascular Disorders 2008", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2442048/" },
  nccihGarlic: { label: "NIH National Center for Complementary and Integrative Health: Garlic", url: "https://www.nccih.nih.gov/health/garlic" },
  taurineCv: { label: "Insights into the cardiovascular benefits of taurine: systematic review and meta-analysis, Nutrition Journal 2024", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11325608/" },
  citrullineBp: { label: "Barkhidarian B, et al. Effects of L-citrulline supplementation on blood pressure: systematic review and meta-analysis, Avicenna Journal of Phytomedicine 2019", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6369322/" },
  potassiumBp: { label: "Magnesium and potassium supplementation for systolic blood pressure reduction in the general normotensive population, Nutrients 2024", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11547496/" },
  statpearlsHyperkalemia: { label: "Hyperkalemia, StatPearls, NIH National Library of Medicine", url: "https://www.ncbi.nlm.nih.gov/books/NBK470284/" },
  boswelliaOa: { label: "Effectiveness of Boswellia and Boswellia extract for osteoarthritis patients: systematic review and meta-analysis, BMC Complementary Medicine and Therapies 2020", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7368679/" },
  collagenJoint: { label: "Analgesic efficacy of collagen peptide in knee osteoarthritis: meta-analysis of randomized controlled trials, Journal of Orthopaedic Surgery and Research 2023", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10505327/" },
  collagenActive: { label: "Effects of collagen peptide supplementation on body composition, collagen synthesis and recovery from joint injury and exercise: systematic review, Amino Acids 2021", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8521576/" },
  collagenSkin: { label: "Oral collagen peptides and skin rejuvenation: systematic review and updated meta-analysis of randomized controlled trials, Journal of Cosmetic Dermatology 2026", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC13370842/" },
  zincAcne: { label: "Safety and effectiveness of oral nutraceuticals for treating acne: a systematic review, JAMA Dermatology 2023", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11015159/" },
  zincToxin: { label: "The essential toxin: impact of zinc on human health, International Journal of Environmental Research and Public Health 2010", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2872358/" },
  sawPalmetto: { label: "Tacklind J, et al. Serenoa repens for benign prostatic hyperplasia, Cochrane Database of Systematic Reviews 2012", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7084061/" },
  nccihSawPalmetto: { label: "NIH National Center for Complementary and Integrative Health: Saw Palmetto", url: "https://www.nccih.nih.gov/health/saw-palmetto" },
  nccihAshwagandha: { label: "NIH National Center for Complementary and Integrative Health: Ashwagandha", url: "https://www.nccih.nih.gov/health/ashwagandha" },
  fdaCaffeine: { label: "FDA: Pure and highly concentrated caffeine products", url: "https://www.fda.gov" },
  odsExercise: { label: "NIH Office of Dietary Supplements: Dietary supplements for exercise and athletic performance fact sheet", url: "https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-HealthProfessional/" },
  issnCreatine: { label: "Kreider RB, et al. International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation, Journal of the International Society of Sports Nutrition 2017", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5469049/" },
  nccihRedYeastRice: { label: "NIH National Center for Complementary and Integrative Health: Red Yeast Rice", url: "https://www.nccih.nih.gov/health/red-yeast-rice" },
  livertoxRedYeastRice: { label: "LiverTox: Red Yeast Rice, NIH", url: "https://www.ncbi.nlm.nih.gov/books/NBK548168/" },
  issnProtein: { label: "Jäger R, et al. International Society of Sports Nutrition position stand: protein and exercise, Journal of the International Society of Sports Nutrition 2017", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/" },
  eaaMuscle: { label: "Effects of essential amino acid supplementation on muscle protein synthesis: systematic review and meta-analysis, Frontiers in Nutrition 2024", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11239320/" },
  glycineSleep: { label: "Bannai M, et al. The effects of glycine on subjective daytime performance in partially sleep-restricted healthy volunteers, Frontiers in Neurology 2012", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3328957/" },
} satisfies Record<string, ProfileSource>;

const PENDING: ProfileReview = { status: "pending-clinician-review", version: SUPPORT_OPTIONS_VERSION };

/* ─── Area notes — the honest line for each area ──────────────────────── */

export const SUPPORT_AREA_NOTES: Partial<Record<SupportArea, string>> = {
  liver: "No supplement has been shown to prevent liver injury from oral anabolic steroids. Liver enzymes on your own lab reports are the direct way to see this area.",
  lipids: "None of these has been shown to reverse the drop in HDL cholesterol seen with anabolic steroids.",
  cardiovascular: "No supplement has been shown to offset the heart and blood pressure effects of anabolic steroids. Blood pressure readings are the direct way to see this area.",
  metabolic: "These can add to glucose-lowering medicines, including insulin and GLP-1 medicines. Low blood sugar is an emergency.",
  hormonal: "No supplement has been shown to restore natural testosterone production after anabolic steroid use. Hormone recovery is a conversation for a clinician or a telehealth visit.",
  fertility: "No supplement has been shown to restore sperm production after anabolic steroid use. Fertility questions belong with a clinician or a telehealth visit, and a semen analysis can be ordered to check.",
  blood: "No supplement is known to lower hematocrit or hemoglobin.",
  kidney: "No supplement has been shown to protect kidney function. Creatinine and eGFR on your own lab reports are the direct way to see this area.",
  recovery: "Nothing here has been studied in people using anabolic steroids. Joint pain that follows an injury, or that does not settle, is worth having seen at urgent care, a telehealth visit or a clinician.",
  sleep: "Loud snoring or pauses in breathing during sleep need clinician review. No supplement addresses them.",
  general: "Covering basic nutrition does not offset the risks of any compound.",
  mood: "No supplement in Reserve's library has reviewed evidence for mood changes. Mood changes are worth raising with a clinician or a telehealth visit, and if you are having thoughts of harming yourself, call or text 988 now.",
  thyroid: "No supplement in Reserve's library has reviewed evidence for thyroid results. TSH, Free T4 and Free T3 on your own reports are worth reviewing with a clinician or a telehealth visit.",
  prostate: "No supplement has been shown to change prostate symptoms or a PSA result. A PSA result on your own report is worth reviewing with a clinician or a telehealth visit.",
  skin: "Nothing here has been shown to address skin or hair changes driven by androgens. Acne and hair loss from androgens do have prescription and over-the-counter treatments; a dermatologist, a telehealth visit or a pharmacist can go through them with you, including how they affect blood pressure and the heart.",
};

/* ─── Library ─────────────────────────────────────────────────────────── */

const LIVER_LIMIT = "It does not prevent liver injury from oral anabolic steroids, and it does not replace liver enzyme testing.";

const LIBRARY: SupportOption[] = [
  {
    key: "beetroot",
    title: "Beetroot (dietary nitrate)",
    catalogName: "Beetroot Extract",
    findings: [
      { area: "cardiovascular", grade: "some", finding: "Pooled across 75 trials in about 1,800 people, nitrate lowered systolic blood pressure by a small amount that grew with intake. The reviewers graded the short-term systolic result moderate quality and the longer-term results low.", markers: [] },
    ],
    doesNotAddress: "It does not change cholesterol, heart muscle thickening or any lab marker. It does not offset the blood pressure or heart effects of anabolic steroids: no nutritional treatment has ever been studied in people using them.",
    whereYouSeeIt: "No lab marker shows this. Blood pressure readings in your check-in are where you would see it.",
    coverageLabel: "Blood pressure (evidence: supported)",
    sources: [SRC.nitrateBp],
    review: PENDING,
  },
  {
    key: "boswellia",
    title: "Boswellia",
    catalogName: "Boswellia",
    findings: [
      { area: "recovery", grade: "limited", finding: "Seven trials in 545 people with osteoarthritis reported less pain and stiffness. The reviewers rated the evidence medium to low quality, with small samples and incomplete reporting of side effects.", markers: [] },
    ],
    doesNotAddress: "It does not address tendon or ligament injury, and joint pain that follows an injury or does not settle is worth having seen at urgent care, a telehealth visit or a clinician.",
    whereYouSeeIt: "No lab marker shows this. How your joints feel over weeks is where you would see it.",
    coverageLabel: "Joint comfort (evidence: limited)",
    sources: [SRC.boswelliaOa],
    review: PENDING,
  },
  {
    key: "collagen-peptides",
    title: "Collagen peptides",
    catalogName: "Collagen Peptides",
    findings: [
      { area: "recovery", grade: "some", finding: "Four trials in 507 people with knee osteoarthritis reported less pain over three to six months, graded moderate quality, though all four carried a high risk of bias. In active people, 15 trials reported less functional joint pain after more than three months, and 13 of those 15 were funded commercially.", markers: [] },
      { area: "skin", grade: "some", finding: "Across 35 trials in about 2,500 people, skin hydration and elasticity improved after twelve weeks or more. The same analysis found the reported improvements in wrinkles and skin density were artifacts of a few outlying studies rather than a real effect.", markers: [] },
    ],
    doesNotAddress: "Collagen is a poor-quality protein on its own and is not a substitute for your protein intake. It does not address skin or hair changes driven by androgens.",
    whereYouSeeIt: "No lab marker shows this.",
    coverageLabel: "Joints and skin (evidence: supported)",
    sources: [SRC.collagenJoint, SRC.collagenActive, SRC.collagenSkin],
    review: PENDING,
  },
  {
    key: "garlic",
    title: "Garlic",
    catalogName: "Garlic Extract",
    findings: [
      { area: "cardiovascular", grade: "some", finding: "Across 11 trials in 503 people, blood pressure fell in those who started with high blood pressure and did not change in those who did not. NCCIH separately calls the blood pressure evidence limited.", markers: [] },
      { area: "lipids", grade: "limited", finding: "NCCIH describes the effect on cholesterol as small.", markers: ["total-cholesterol", "ldl"] },
    ],
    doesNotAddress: "NCCIH states garlic supplements may increase the risk of bleeding, which matters alongside anything else that thins the blood and before surgery or dental work. It does not offset the blood pressure or heart effects of anabolic steroids: no nutritional treatment has ever been studied in people using them.",
    coverageLabel: "Blood pressure (evidence: supported)",
    sources: [SRC.garlicBp, SRC.nccihGarlic],
    review: PENDING,
  },
  {
    key: "glycine",
    title: "Glycine",
    catalogName: "Glycine",
    findings: [
      { area: "sleep", grade: "limited", finding: "The often-quoted human trial ran in seven men across three nights of shortened sleep and reported less next-day fatigue on the first day only. Every author worked for a supplement manufacturer.", markers: [] },
    ],
    doesNotAddress: "It does not address loud snoring or pauses in breathing during sleep, which need clinician review.",
    whereYouSeeIt: "No lab marker shows this. Your own sleep log is where you would see it.",
    coverageLabel: "Sleep (evidence: limited)",
    sources: [SRC.glycineSleep],
    review: PENDING,
  },
  {
    key: "l-citrulline",
    title: "L-citrulline",
    catalogName: "L-Citrulline",
    findings: [
      { area: "cardiovascular", grade: "limited", finding: "Eight trials, most with fewer than 35 people, reported a small fall in systolic blood pressure. Diastolic blood pressure did not change, and the trials disagreed with each other considerably.", markers: [] },
    ],
    doesNotAddress: "It does not change cholesterol or any lab marker. It does not offset the blood pressure or heart effects of anabolic steroids: no nutritional treatment has ever been studied in people using them.",
    whereYouSeeIt: "No lab marker shows this. Blood pressure readings in your check-in are where you would see it.",
    coverageLabel: "Blood pressure (evidence: limited)",
    sources: [SRC.citrullineBp],
    review: PENDING,
  },
  {
    key: "potassium",
    title: "Potassium",
    catalogName: "Potassium",
    findings: [
      { area: "cardiovascular", grade: "limited", finding: "Twelve trials in about 1,000 people with ordinary blood pressure reported a small fall in systolic blood pressure. The reviewers noted smaller intakes looked both safer and more effective than larger ones.", markers: ["potassium"] },
    ],
    doesNotAddress: "Too much potassium in the blood is a medical emergency that can cause a life-threatening heart rhythm. Potassium supplements are a listed cause of it, alongside ACE inhibitors, ARBs, potassium-sparing diuretics and NSAIDs, and reduced kidney filtering raises the risk. Your potassium, creatinine and eGFR results are worth reviewing with a clinician, a telehealth visit or a pharmacist.",
    coverageLabel: "Blood pressure (evidence: limited)",
    sources: [SRC.potassiumBp, SRC.statpearlsHyperkalemia],
    review: PENDING,
  },
  {
    key: "saw-palmetto",
    title: "Saw palmetto",
    catalogName: "Saw Palmetto",
    findings: [
      { area: "prostate", grade: "not-shown", finding: "Across 32 trials in 5,666 men, urinary symptoms, urine flow and prostate size were no different from placebo, including at two and three times the usual amount. NCCIH adds that it does not appear to change a PSA result, so it does not hide one either.", markers: ["psa"] },
      { area: "skin", grade: "limited", finding: "NCCIH describes only a few small studies in male-pattern hair loss, too few to draw a conclusion from.", markers: [] },
    ],
    doesNotAddress: "It has not been shown to change urinary symptoms or prostate size. A PSA result on your own report is worth reviewing with a clinician or a telehealth visit.",
    coverageLabel: "Prostate (evidence: not shown in trials)",
    sources: [SRC.sawPalmetto, SRC.nccihSawPalmetto],
    review: PENDING,
  },
  {
    key: "taurine",
    title: "Taurine",
    catalogName: "Taurine",
    findings: [
      { area: "cardiovascular", grade: "some", finding: "Across 20 trials in 808 people, systolic and diastolic blood pressure and resting heart rate were lower than placebo. Seven in ten of those trials carried some risk of bias, and the populations were mixed.", markers: [] },
    ],
    doesNotAddress: "It does not change cholesterol or any lab marker. It does not offset the blood pressure or heart effects of anabolic steroids: no nutritional treatment has ever been studied in people using them.",
    whereYouSeeIt: "No lab marker shows this. Blood pressure and resting heart rate in your check-in are where you would see it.",
    coverageLabel: "Blood pressure (evidence: supported)",
    sources: [SRC.taurineCv],
    review: PENDING,
  },
  {
    key: "zinc",
    title: "Zinc",
    catalogName: "Zinc",
    findings: [
      { area: "skin", grade: "some", finding: "Fifteen trials looked at zinc for acne; of the fair-quality ones, four of six reported improvement. The reviewers rated overall study quality poor to fair, and zinc was not among the interventions with good-quality evidence.", markers: ["zinc"] },
    ],
    doesNotAddress: "High intake lowers HDL cholesterol, the same direction anabolic steroids push it, and long-term high intake causes copper deficiency with anemia and low white cells. It does not address hair loss or skin changes driven by androgens.",
    coverageLabel: "Skin (evidence: supported)",
    sources: [SRC.zincAcne, SRC.zincToxin],
    review: PENDING,
  },
  {
    key: "berberine",
    title: "Berberine",
    catalogName: "Berberine",
    findings: [
      { area: "metabolic", grade: "some", finding: "Pooled trials show reductions in fasting glucose and A1c. Most studies are small and short.", markers: ["glucose", "hba1c"] },
      { area: "lipids", grade: "some", finding: "Pooled trials show reductions in LDL cholesterol and triglycerides. Most studies are small and short.", markers: ["ldl", "triglycerides"] },
    ],
    doesNotAddress: "It does not replace glucose or A1c testing, and it does not offset blood sugar effects of growth hormone or insulin use.",
    coverageLabel: "Blood sugar and cholesterol (evidence: supported)",
    sources: [SRC.nccihBerberine, SRC.livertoxBerberine],
    review: PENDING,
  },
  {
    key: "coq10",
    title: "Coenzyme Q10",
    catalogName: "CoQ10",
    findings: [
      { area: "cardiovascular", grade: "limited", finding: "Trials on blood pressure are small and their results are inconsistent.", markers: [] },
    ],
    doesNotAddress: "It does not offset blood pressure or heart effects of your overall plan.",
    whereYouSeeIt: "No lab marker shows this. Blood pressure readings in your check-in are where you would see it.",
    coverageLabel: "Coenzyme Q10 (evidence: limited)",
    sources: [SRC.nccihCoq10],
    review: PENDING,
  },
  {
    key: "electrolytes",
    title: "Electrolytes",
    catalogName: "Electrolytes",
    findings: [
      { area: "hydration", grade: "some", finding: "Replaces sodium and potassium lost in heavy sweat. Most relevant for long or hot training sessions.", markers: ["sodium", "potassium"] },
    ],
    doesNotAddress: "It does not replace drinking enough fluid, and it does not address blood pressure changes.",
    coverageLabel: "Electrolyte replacement",
    sources: [SRC.acsmFluid],
    review: PENDING,
  },
  {
    key: "fish-oil",
    title: "Fish oil (omega-3)",
    catalogName: "Fish Oil",
    findings: [
      { area: "lipids", grade: "well-studied", finding: "Well studied for lowering triglycerides. It does not reliably raise HDL or lower LDL cholesterol, and can raise LDL in some people.", markers: ["triglycerides", "hdl", "ldl"] },
      { area: "cardiovascular", grade: "limited", finding: "Large trials of fish oil supplements on heart events have mixed results, and some found more irregular heart rhythms.", markers: [] },
    ],
    doesNotAddress: "It does not offset higher ApoB or LDL cholesterol, blood pressure changes, rising hematocrit, or other cardiovascular effects of your overall plan.",
    coverageLabel: "Omega-3 intake",
    sources: [SRC.odsOmega3, SRC.nccih],
    review: PENDING,
  },
  {
    key: "magnesium",
    title: "Magnesium",
    catalogName: "Magnesium Glycinate",
    findings: [
      { area: "cardiovascular", grade: "some", finding: "Pooled trials show small average drops in blood pressure.", markers: [] },
      { area: "metabolic", grade: "some", finding: "Pooled trials show small improvements in fasting glucose, mainly in people with low magnesium or high blood sugar.", markers: ["glucose", "magnesium"] },
      { area: "sleep", grade: "limited", finding: "Small trials on sleep quality are mixed, mostly in older adults.", markers: [] },
    ],
    doesNotAddress: "It does not replace blood pressure readings, and it does not address loud snoring or pauses in breathing during sleep.",
    coverageLabel: "Magnesium intake",
    sources: [SRC.odsMagnesium],
    review: PENDING,
  },
  {
    key: "melatonin",
    title: "Melatonin",
    catalogName: "Melatonin",
    findings: [
      { area: "sleep", grade: "some", finding: "Pooled trials show people fall asleep a little faster. Effects on total sleep time are small.", markers: [] },
    ],
    doesNotAddress: "It does not address loud snoring or pauses in breathing during sleep, or sleep disruption from compounds in your plan.",
    whereYouSeeIt: "No lab marker shows this. Your own sleep logs and how you feel in the morning are where you would see it.",
    coverageLabel: "Sleep onset",
    sources: [SRC.nccihMelatonin],
    review: PENDING,
  },
  {
    key: "milk-thistle",
    title: "Milk thistle",
    catalogName: "Milk Thistle",
    findings: [
      { area: "liver", grade: "not-shown", finding: "Trials in people with liver problems have not shown consistent improvements in liver enzymes or outcomes.", markers: ["alt", "ast"] },
    ],
    doesNotAddress: LIVER_LIMIT,
    coverageLabel: "Milk thistle (evidence: not shown in trials)",
    sources: [SRC.nccih, SRC.livertox],
    review: PENDING,
  },
  {
    key: "multivitamin",
    title: "Multivitamin",
    catalogName: "Multivitamin",
    findings: [
      { area: "general", grade: "limited", finding: "Large trials in well-nourished adults have not shown long-term health protection. It can help cover gaps when a diet is restricted, such as during a hard cut.", markers: [] },
    ],
    doesNotAddress: "It does not offset the risks of any compound, and many products contain iron or vitamin A that add to other sources.",
    whereYouSeeIt: "No single lab marker shows this. Nutrient results on your own reports — ferritin, vitamin D, B12 and zinc — are where a gap would show.",
    coverageLabel: "Basic micronutrients",
    sources: [SRC.odsMultivitamin],
    review: PENDING,
  },
  {
    key: "n-acetyl-cysteine",
    title: "N-acetyl cysteine (NAC)",
    catalogName: "N-Acetyl Cysteine",
    findings: [
      { area: "liver", grade: "limited", finding: "Its established liver use is as a hospital drug given by clinicians. Evidence that supplements protect the liver in healthy people is limited.", markers: ["alt", "ast"] },
    ],
    doesNotAddress: LIVER_LIMIT,
    coverageLabel: "NAC (evidence: limited)",
    sources: [SRC.fdaNac, SRC.dailymed],
    review: PENDING,
  },
  {
    key: "psyllium",
    title: "Psyllium husk",
    catalogName: "Psyllium Husk",
    findings: [
      { area: "lipids", grade: "well-studied", finding: "Well studied for lowering LDL cholesterol. The FDA allows a heart-health label claim for psyllium soluble fiber as part of a diet low in saturated fat.", markers: ["apob", "ldl", "total-cholesterol"] },
      { area: "metabolic", grade: "some", finding: "Trials show modest reductions in fasting glucose and A1c, mostly in people whose levels were already high.", markers: ["glucose", "hba1c"] },
      { area: "digestive", grade: "well-studied", finding: "Well studied for improving stool regularity.", markers: [] },
    ],
    doesNotAddress: "It does not offset the drop in HDL cholesterol seen with anabolic steroids, blood pressure changes, or rising hematocrit.",
    coverageLabel: "Soluble fiber intake",
    sources: [SRC.fdaFiberClaim, SRC.nccih],
    review: PENDING,
  },
  {
    key: "creatine",
    title: "Creatine",
    catalogName: "Creatine Monohydrate",
    findings: [
      { area: "recovery", grade: "well-studied", finding: "One of the most studied supplements. Well studied for strength and lean mass gains alongside resistance training, with a long safety record in healthy adults.", markers: [] },
      { area: "kidney", grade: "not-shown", finding: "It does not harm healthy kidneys in trials, but it raises blood creatinine and can lower a calculated eGFR, which can read like a kidney problem. Cystatin C is not affected by it.", markers: ["creatinine", "egfr", "cystatin-c"] },
    ],
    doesNotAddress: "It does not address any health effect of anabolic steroids. Tell whoever reads your kidney labs that you take it.",
    whereYouSeeIt: "In training logs and body measurements, not in a lab marker.",
    coverageLabel: "Creatine",
    sources: [SRC.issnCreatine, SRC.odsExercise],
    review: PENDING,
  },
  {
    key: "red-yeast-rice",
    title: "Red yeast rice",
    catalogName: "Red Yeast Rice",
    findings: [
      { area: "lipids", grade: "well-studied", finding: "Lowers LDL cholesterol in trials because it contains monacolin K, the same molecule as the prescription statin lovastatin. How much a product contains varies widely, and some have almost none.", markers: ["ldl", "apob", "total-cholesterol"] },
      { area: "liver", grade: "not-shown", finding: "It adds liver load rather than easing it: liver injury like that seen with statins has been reported. Taken together with a prescription statin, it doubles the same drug.", markers: ["alt", "ast"] },
    ],
    doesNotAddress: "It does not raise the HDL cholesterol that anabolic steroids lower, and it carries the muscle and liver concerns of a statin. Some tested products contained citrinin, which affects the kidneys.",
    coverageLabel: "Red yeast rice",
    sources: [SRC.nccihRedYeastRice, SRC.livertoxRedYeastRice],
    review: PENDING,
  },
  {
    key: "whey-protein",
    title: "Whey protein",
    catalogName: "Whey Protein Isolate",
    findings: [
      { area: "general", grade: "well-studied", finding: "A convenient way to reach daily protein from food. Total daily protein matters more than the source for muscle gain with training.", markers: [] },
    ],
    doesNotAddress: "It does not address any health effect of anabolic steroids. Check the label for added sugar, and look for third-party testing, since protein powders are not tested by the FDA before sale.",
    whereYouSeeIt: "In your daily protein total in Nutrition.",
    coverageLabel: "Protein intake",
    sources: [SRC.issnProtein],
    review: PENDING,
  },
  {
    key: "eaa",
    title: "Essential amino acids (EAAs)",
    catalogName: "Essential Amino Acids (EAAs)",
    findings: [
      { area: "general", grade: "some", finding: "Trials show essential amino acids raise muscle protein synthesis in the hours after taking them. Against a diet that already reaches its daily protein, the added effect on muscle gained over months is much less clear.", markers: [] },
    ],
    doesNotAddress: "It does not address any health effect of anabolic steroids, and it does not replace total daily protein. Amino acid powders are not tested by the FDA before sale — look for third-party testing.",
    whereYouSeeIt: "In your daily protein total in Nutrition, not in a lab marker.",
    coverageLabel: "Amino acids",
    sources: [SRC.eaaMuscle, SRC.issnProtein],
    review: PENDING,
  },
  {
    key: "tudca",
    title: "TUDCA",
    catalogName: "TUDCA",
    findings: [
      { area: "liver", grade: "limited", finding: "Evidence in people using anabolic steroids is limited to case reports and small studies. Its close relative ursodiol is a prescription drug used by clinicians.", markers: ["alt", "ast", "bilirubin"] },
    ],
    doesNotAddress: LIVER_LIMIT,
    coverageLabel: "TUDCA (evidence: limited)",
    sources: [SRC.livertox],
    review: PENDING,
  },
  {
    key: "vitamin-d3",
    title: "Vitamin D3",
    catalogName: "Vitamin D3",
    findings: [
      { area: "bone", grade: "some", finding: "Raises blood vitamin D. Bone benefits in trials are seen mainly in people whose levels were low.", markers: ["vitamin-d", "calcium"] },
      { area: "general", grade: "some", finding: "Raises blood vitamin D, which matters most when levels are low. A vitamin D result on your labs shows where yours is.", markers: ["vitamin-d"] },
    ],
    doesNotAddress: "It does not replace a vitamin D or calcium result on your labs.",
    coverageLabel: "Vitamin D intake",
    sources: [SRC.odsVitaminD],
    review: PENDING,
  },
  {
    key: "ashwagandha",
    title: "Ashwagandha",
    catalogName: "Ashwagandha",
    findings: [
      { area: "sleep", grade: "limited", finding: "Small, short trials report better-rated sleep and lower stress scores. Products differ widely in what they contain.", markers: [] },
    ],
    doesNotAddress: "It does not restore natural testosterone production, and it does not protect the liver — rare cases of liver injury have been reported with it, some serious.",
    whereYouSeeIt: "In your own sleep and stress check-ins, not in a lab marker.",
    coverageLabel: "Ashwagandha (evidence: limited)",
    sources: [SRC.nccihAshwagandha, SRC.livertox],
    review: PENDING,
  },
  {
    key: "beta-alanine",
    title: "Beta-alanine",
    catalogName: "Beta-Alanine",
    findings: [
      { area: "recovery", grade: "some", finding: "Pooled trials show small gains in hard efforts lasting roughly one to four minutes. Skin tingling for a while after taking it is common and harmless.", markers: [] },
    ],
    doesNotAddress: "It does not address any health effect of anabolic steroids, and it does little for low-rep strength work.",
    whereYouSeeIt: "In training logs on longer, harder sets, not in a lab marker.",
    coverageLabel: "Beta-alanine",
    sources: [SRC.odsExercise],
    review: PENDING,
  },
  {
    key: "caffeine",
    title: "Caffeine",
    catalogName: "Caffeine",
    findings: [
      { area: "recovery", grade: "well-studied", finding: "Well studied for endurance, alertness and how hard a session feels.", markers: [] },
    ],
    doesNotAddress: "It raises heart rate and blood pressure for a few hours, and later in the day it delays and shortens sleep even when it does not feel that way. It does not address any health effect of anabolic steroids, it adds to the strain on the heart alongside other stimulants, and pure or highly concentrated powders and liquids have caused deaths.",
    whereYouSeeIt: "In your own blood pressure readings and sleep logs.",
    coverageLabel: "Caffeine",
    sources: [SRC.odsExercise, SRC.fdaCaffeine],
    review: PENDING,
  },
  {
    key: "l-theanine",
    title: "L-theanine",
    catalogName: "L-Theanine",
    findings: [
      { area: "sleep", grade: "limited", finding: "Small trials report calmer ratings and better-rated sleep. The evidence is early and the studies are small.", markers: [] },
    ],
    doesNotAddress: "It does not address loud snoring or pauses in breathing during sleep, and it does not offset what a stimulant does to the heart.",
    whereYouSeeIt: "In your own sleep and stress check-ins, not in a lab marker.",
    coverageLabel: "L-theanine (evidence: limited)",
    sources: [SRC.nccih],
    review: PENDING,
  },
  {
    key: "hmb",
    title: "HMB",
    catalogName: "HMB",
    findings: [
      { area: "recovery", grade: "limited", finding: "Trials in people new to lifting report less muscle soreness and damage. In trained lifters the results are mixed and mostly show no effect.", markers: [] },
    ],
    doesNotAddress: "It does not address any health effect of anabolic steroids, and it has not been shown to add to what training and daily protein already do in trained lifters.",
    whereYouSeeIt: "In training logs and how sessions feel afterwards, not in a lab marker.",
    coverageLabel: "HMB (evidence: limited)",
    sources: [SRC.odsExercise],
    review: PENDING,
  },
  {
    key: "sodium-bicarbonate",
    title: "Sodium bicarbonate",
    catalogName: "Sodium Bicarbonate",
    findings: [
      { area: "recovery", grade: "some", finding: "Pooled trials show small gains in all-out efforts of roughly one to ten minutes, where the burn is the limit.", markers: [] },
    ],
    doesNotAddress: "It carries a large sodium load, which matters if you are watching blood pressure, and stomach upset, cramping and diarrhoea are common with it. It does not address any health effect of anabolic steroids.",
    whereYouSeeIt: "In training logs on all-out sets, and in your own blood pressure readings.",
    coverageLabel: "Sodium bicarbonate",
    sources: [SRC.odsExercise],
    review: PENDING,
  },
  {
    key: "tart-cherry",
    title: "Tart cherry",
    catalogName: "Tart Cherry",
    findings: [
      { area: "recovery", grade: "limited", finding: "Small trials report less soreness and strength returning sooner after hard sessions. The studies are small and the results vary.", markers: [] },
      { area: "sleep", grade: "limited", finding: "A few small trials report longer sleep. Cherries contain melatonin naturally, so it adds to any melatonin you already take.", markers: [] },
    ],
    doesNotAddress: "It does not address any health effect of anabolic steroids, and juice forms carry sugar that counts toward your daily intake.",
    whereYouSeeIt: "In your own sleep logs and how sessions feel afterwards.",
    coverageLabel: "Tart cherry (evidence: limited)",
    sources: [SRC.odsExercise, SRC.nccih],
    review: PENDING,
  },
];

/** Alphabetical, always. Order must never read as a ranking. */
export const SUPPORT_OPTIONS: readonly SupportOption[] = [...LIBRARY].sort((a, b) => a.title.localeCompare(b.title));

export function supportOptionByKey(key: string): SupportOption | undefined {
  return SUPPORT_OPTIONS.find((option) => option.key === key);
}

/* ─── Training & performance lens ─────────────────────────────────────────
   The same options a member can already browse, gathered so the training
   add-ons are easy to find in one place: creatine, EAAs, whey, beta-alanine,
   caffeine, citrulline, electrolytes and the rest. This is a view over the one
   library, not a second list — every option keeps its own cited grade
   (including where nothing is shown) and its own "does not address" line.

   Listed alphabetically, never ranked, never "best". Reserve sets no amounts,
   timing or combinations — the member chooses when and logs it themselves. */
export const PERFORMANCE_OPTION_KEYS: ReadonlySet<string> = new Set<string>([
  "beetroot",
  "beta-alanine",
  "caffeine",
  "creatine",
  "eaa",
  "electrolytes",
  "hmb",
  "l-citrulline",
  "sodium-bicarbonate",
  "tart-cherry",
  "taurine",
  "whey-protein",
]);

/** The training / performance add-ons, already alphabetical (SUPPORT_OPTIONS is). */
export const PERFORMANCE_OPTIONS: readonly SupportOption[] = SUPPORT_OPTIONS.filter((option) =>
  PERFORMANCE_OPTION_KEYS.has(option.key),
);

const GRADE_RANK: Record<EvidenceGrade, number> = { "well-studied": 0, some: 1, limited: 2, "not-shown": 3, uncertain: 4 };

/** The strongest evidence grade among an option's findings. */
export function bestGrade(option: SupportOption): EvidenceGrade {
  return [...option.findings].sort((a, b) => GRADE_RANK[a.grade] - GRADE_RANK[b.grade])[0]?.grade ?? "uncertain";
}

/* ─── Resolution ──────────────────────────────────────────────────────── */

export type SupportAreaEntry = { area: SupportArea; compoundNames: string[] };

/**
 * Areas the member's compounds affect, in the order they first appear.
 * Profiles for supplements themselves are skipped — a fish oil entry in the
 * log should not open a "Blood" support area. General nutrition is added
 * whenever any other compound is profiled.
 */
/**
 * Every marker at least one option in the library watches. A result outside
 * this set has no supplement answer, so the plan says so plainly rather than
 * leaving it silent.
 */
export const OPTION_MARKERS: ReadonlySet<MarkerKey> = new Set(SUPPORT_OPTIONS.flatMap((option) => option.findings.flatMap((finding) => finding.markers)));

export function supportAreasForBrief(brief: CompoundRiskBrief): SupportAreaEntry[] {
  const byArea = new Map<SupportArea, string[]>();
  const add = (area: SupportArea, names: string[]) => {
    const current = byArea.get(area) ?? [];
    for (const name of names) if (!current.includes(name)) current.push(name);
    byArea.set(area, current);
  };
  const general: string[] = [];
  for (const { profile, compoundNames } of brief.profiles) {
    if (profile.regulatory === "supplement") continue;
    for (const { system } of profile.systems) {
      if (!NON_BODY_AREAS.has(system)) add(system, compoundNames);
    }
    for (const name of compoundNames) if (!general.includes(name)) general.push(name);
  }
  if (general.length > 0) add("general", general);
  return [...byArea.entries()].map(([area, compoundNames]) => ({ area, compoundNames }));
}

export type AreaSupport = {
  area: SupportArea;
  label: string;
  note: string | null;
  options: Array<{ option: SupportOption; finding: SupportFinding }>;
};

export function supportForArea(area: SupportArea): AreaSupport {
  const options = SUPPORT_OPTIONS.flatMap((option) => {
    const finding = option.findings.find((f) => f.area === area);
    return finding ? [{ option, finding }] : [];
  });
  return { area, label: SUPPORT_AREA_LABEL[area], note: SUPPORT_AREA_NOTES[area] ?? null, options };
}

export type OptionOverlap = { system: RiskSystem; note: string; compoundNames: string[] };

/**
 * Areas where an option's own effect and a compound's effect act on the same
 * thing, so naming both together is meaningful. "Blood" is deliberately out:
 * fish oil's bleeding risk and testosterone's hematocrit share a label, not a
 * mechanism, and pairing them would mislead.
 */
const OVERLAP_AREAS: ReadonlySet<RiskSystem> = new Set(["liver", "metabolic"]);

/**
 * The option's own known risks, and where they land on an area the member's
 * compounds already affect (e.g. berberine lowers blood sugar; insulin acts on
 * blood sugar too).
 */
export function overlapsForOption(option: SupportOption, brief: CompoundRiskBrief): { overlaps: OptionOverlap[]; interactions: string[] } {
  const memberAreas = new Map(supportAreasForBrief(brief).map((entry) => [entry.area, entry.compoundNames]));
  const overlaps: OptionOverlap[] = [];
  const interactions: string[] = [];
  for (const profile of profilesForCompound({ name: option.catalogName })) {
    for (const { system, note } of profile.systems) {
      const compoundNames = OVERLAP_AREAS.has(system) ? memberAreas.get(system) : undefined;
      if (compoundNames && !overlaps.some((o) => o.system === system)) overlaps.push({ system, note, compoundNames });
    }
    for (const interaction of profile.interactions) if (!interactions.includes(interaction)) interactions.push(interaction);
  }
  return { overlaps, interactions };
}

/** True when the member's log already holds this option. */
export function optionInLog(option: SupportOption, compounds: CompoundIdentity[]): boolean {
  const target = option.catalogName.toLowerCase();
  return compounds.some((compound) => {
    const entry = findCatalogEntry(compound.officialName ?? "") ?? findCatalogEntry(compound.name);
    return entry?.officialName.toLowerCase() === target;
  });
}
