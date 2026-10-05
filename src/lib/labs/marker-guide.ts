/* ════════════════════════════════════════════════════════════════════════
   MARKER GUIDE — what each lab test measures, in plain language.

   Helps a member understand their panel: which test is which, and what it is
   a measure of. It never describes what a member's own value means, never
   names a condition, and never says what causes a result — those belong to
   the member's clinician. Ranges always come from the member's own report.

   REVIEW: ships "pending-clinician-review" with the version below.
   ════════════════════════════════════════════════════════════════════════ */

import type { ProfileReview, ProfileSource } from "@/lib/compound-intelligence/risk-profiles";

import type { MarkerKey } from "./markers";

export const MARKER_GUIDE_VERSION = "2026.09.16";

const MEDLINEPLUS: ProfileSource = { label: "MedlinePlus Lab Tests, U.S. National Library of Medicine", url: "https://medlineplus.gov/lab-tests/" };
const PENDING: ProfileReview = { status: "pending-clinician-review", version: MARKER_GUIDE_VERSION };

/* ─── What can move a reading ──────────────────────────────────────────
   Some results change because of something the member took or carries,
   not because the organ being measured changed. That is a fact about the
   test, so it belongs next to the number — the member can then tell the
   lab and their clinician, who are the ones who read the result.
   Every note here is a measurement effect with a citation. None of them
   says what a value means, names a condition, or asks anyone to start or
   stop anything.
   ──────────────────────────────────────────────────────────────────── */

const SRC = {
  ods: { label: "NIH Office of Dietary Supplements fact sheets", url: "https://ods.od.nih.gov" },
  niddkGfr: { label: "NIDDK: Estimating Glomerular Filtration Rate", url: "https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/kidney-disease/laboratory-evaluation/glomerular-filtration-rate" },
  fdaBiotin: { label: "FDA safety communication: biotin may interfere with lab tests, 2019" },
  biotinInterference: { label: "Gifford, Sadrzadeh, Naugler: Biotin interference in laboratory testing, Canadian Family Physician 2018", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5951654/" },
  dailymed: { label: "DailyMed prescribing information, U.S. National Library of Medicine", url: "https://dailymed.nlm.nih.gov" },
} satisfies Record<string, ProfileSource>;

type ReadingNote = { note: string; sources: ProfileSource[] };

/* Biotin interferes with the streptavidin-biotin immunoassays most labs run,
   and can push a result either way depending on the test and the machine. The
   amounts in hair, skin and nail products are far above what food provides. */
const BIOTIN_NOTE = "Biotin, in hair, skin and nail products and many multivitamins, interferes with the test itself and can make this read either too high or too low. The amounts in those products are far above what food provides. Tell the lab and your clinician if you take it — labs may ask how long it has been since your last one.";
const BIOTIN_SOURCES: ProfileSource[] = [SRC.fdaBiotin, SRC.biotinInterference];
const biotin = (): ReadingNote => ({ note: BIOTIN_NOTE, sources: BIOTIN_SOURCES });

export type MarkerGuideEntry = {
  measures: string;
  affectedBy?: string;
  affectedBySources?: ProfileSource[];
  source: ProfileSource;
  review: ProfileReview;
};

const AFFECTED_BY: Partial<Record<MarkerKey, ReadingNote>> = {
  creatinine: {
    note: "Creatine supplements and a large amount of muscle raise this on their own, with the kidneys filtering exactly as before. N-acetyl cysteine has been reported to interfere with the common test method and make it read lower than it is. Cystatin C is affected by neither.",
    sources: [SRC.ods, SRC.niddkGfr],
  },
  egfr: {
    note: "This is calculated from creatinine, so creatine supplements, muscle mass and N-acetyl cysteine move it while kidney filtering is unchanged. An estimate based on cystatin C is read instead when that is a question.",
    sources: [SRC.niddkGfr],
  },
  "cystatin-c": {
    note: "Not moved by creatine, muscle mass or N-acetyl cysteine, which is why it is used when a creatinine result is hard to read.",
    sources: [SRC.niddkGfr],
  },
  psa: {
    note: "Finasteride and dutasteride lower this by about half, so a result taken while on either is read with that in mind. Saw palmetto does not change it.",
    sources: [SRC.dailymed],
  },
  /* Every assay named in the biotin interference review that Reserve tracks. */
  tsh: biotin(),
  "free-t4": biotin(),
  "free-t3": biotin(),
  "total-testosterone": biotin(),
  "free-testosterone": biotin(),
  estradiol: biotin(),
  lh: biotin(),
  fsh: biotin(),
  shbg: biotin(),
  cortisol: biotin(),
  ferritin: biotin(),
  "vitamin-b12": biotin(),
};

const MEASURES: Record<MarkerKey, string> = {
  hematocrit: "The share of your blood volume made up of red blood cells.",
  hemoglobin: "The protein in red blood cells that carries oxygen.",
  rbc: "The number of red blood cells in a sample of blood.",
  wbc: "The number of white blood cells, which are part of the immune system.",
  platelets: "Cell fragments that help blood clot.",
  "total-testosterone": "All testosterone in the blood, both bound to proteins and free.",
  "free-testosterone": "Testosterone that is not bound to proteins in the blood.",
  estradiol: "The main form of estrogen.",
  lh: "Luteinizing hormone, a pituitary hormone that signals the testes or ovaries.",
  fsh: "Follicle-stimulating hormone, a pituitary hormone involved in sperm and egg production.",
  shbg: "Sex hormone-binding globulin, a protein that carries testosterone and estradiol in the blood.",
  prolactin: "A hormone made by the pituitary gland.",
  "igf-1": "Insulin-like growth factor 1, made mainly by the liver in response to growth hormone.",
  "dhea-s": "A hormone made mainly by the adrenal glands.",
  cortisol: "A hormone made by the adrenal glands. Levels change through the day.",
  psa: "Prostate-specific antigen, a protein made by the prostate.",
  "total-cholesterol": "All the cholesterol carried in the blood.",
  ldl: "Cholesterol carried by low-density lipoproteins.",
  hdl: "Cholesterol carried by high-density lipoproteins.",
  triglycerides: "A type of fat carried in the blood.",
  apob: "Apolipoprotein B, the main protein on LDL and similar particles. It reflects how many of those particles there are.",
  alt: "Alanine aminotransferase, an enzyme found mostly in the liver.",
  ast: "Aspartate aminotransferase, an enzyme found in the liver, muscles and other tissues.",
  "alk-phos": "Alkaline phosphatase, an enzyme found mainly in the liver and bones.",
  bilirubin: "A yellow substance made when red blood cells break down, processed by the liver.",
  ggt: "Gamma-glutamyl transferase, an enzyme found mostly in the liver.",
  albumin: "The main protein in the liquid part of blood, made by the liver.",
  creatinine: "A waste product made by muscles and cleared by the kidneys.",
  egfr: "Estimated glomerular filtration rate, a calculation of how well the kidneys filter blood.",
  bun: "Blood urea nitrogen, a waste product of protein breakdown cleared by the kidneys.",
  "cystatin-c": "A protein cleared by the kidneys, used as another way to estimate kidney filtering.",
  glucose: "The amount of sugar in the blood at the time of the draw.",
  hba1c: "Hemoglobin A1c, which reflects average blood sugar over roughly the past three months.",
  insulin: "The hormone that moves sugar from the blood into cells.",
  tsh: "Thyroid-stimulating hormone, the pituitary signal that tells the thyroid to make its hormones.",
  "free-t4": "The unbound form of thyroxine, the main hormone made by the thyroid.",
  "free-t3": "The unbound form of triiodothyronine, the most active thyroid hormone.",
  potassium: "An electrolyte that nerves and muscles, including the heart, depend on.",
  sodium: "An electrolyte that helps control the balance of fluid in the body.",
  calcium: "A mineral used by bones, muscles, nerves and the heart.",
  magnesium: "A mineral involved in muscle, nerve and energy processes.",
  ferritin: "A protein that stores iron in the body.",
  iron: "The amount of iron in the blood at the time of the draw.",
  "vitamin-d": "25-hydroxyvitamin D, the form of vitamin D measured in blood tests.",
  "vitamin-b12": "A vitamin the body uses to make red blood cells and support nerves.",
  zinc: "A mineral involved in immune function and many enzymes.",
  lipase: "An enzyme made by the pancreas that helps digest fat.",
  "hs-crp": "High-sensitivity C-reactive protein, a protein the liver makes in response to inflammation.",
  ck: "Creatine kinase, an enzyme found mainly in muscle, including heart muscle.",
};

export const MARKER_GUIDE: Record<MarkerKey, MarkerGuideEntry> = Object.fromEntries(
  (Object.entries(MEASURES) as Array<[MarkerKey, string]>).map(([key, measures]) => [
    key,
    { measures, affectedBy: AFFECTED_BY[key]?.note, affectedBySources: AFFECTED_BY[key]?.sources, source: MEDLINEPLUS, review: PENDING },
  ]),
) as Record<MarkerKey, MarkerGuideEntry>;

export function whatItMeasures(key: MarkerKey | undefined): string | null {
  return key ? MARKER_GUIDE[key]?.measures ?? null : null;
}

/** What can move this result without the organ it measures having changed. */
export function whatAffectsReading(key: MarkerKey | undefined): string | null {
  return key ? MARKER_GUIDE[key]?.affectedBy ?? null : null;
}

/** Markers whose reading can be moved by something the member takes or carries. */
export const MARKERS_WITH_READING_NOTES = Object.keys(AFFECTED_BY) as MarkerKey[];

export function readingNoteSources(key: MarkerKey | undefined): ProfileSource[] {
  return (key ? MARKER_GUIDE[key]?.affectedBySources : undefined) ?? [];
}
