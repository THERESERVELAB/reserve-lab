/* ════════════════════════════════════════════════════════════════════════
   CANONICAL LAB MARKERS

   Labs name the same test differently. Quest prints "TESTOSTERONE, TOTAL, MS",
   Labcorp prints "Testosterone", and a member types "total test". Everything
   downstream — trends across draws, the link between a compound and the
   markers commonly watched for it — needs ONE key per test.

   Names are normalized before matching: lowercased, parenthetical text
   removed ("ALT (SGPT)" → "alt"), punctuation split, and method words that
   do not change what was measured ("LC/MS", "Serum", "Calc") dropped.

   This file carries NO reference ranges. A range always comes from the
   member's own lab report, never from Reserve.
   ════════════════════════════════════════════════════════════════════════ */

export type MarkerSystem =
  | "blood"
  | "hormones"
  | "lipids"
  | "liver"
  | "kidney"
  | "metabolic"
  | "thyroid"
  | "prostate"
  | "electrolytes"
  | "nutrients"
  | "pancreas"
  | "inflammation"
  | "muscle";

export type MarkerKey =
  | "hematocrit"
  | "hemoglobin"
  | "rbc"
  | "wbc"
  | "platelets"
  | "total-testosterone"
  | "free-testosterone"
  | "estradiol"
  | "lh"
  | "fsh"
  | "shbg"
  | "prolactin"
  | "igf-1"
  | "dhea-s"
  | "cortisol"
  | "psa"
  | "total-cholesterol"
  | "ldl"
  | "hdl"
  | "triglycerides"
  | "apob"
  | "alt"
  | "ast"
  | "alk-phos"
  | "bilirubin"
  | "ggt"
  | "albumin"
  | "creatinine"
  | "egfr"
  | "bun"
  | "cystatin-c"
  | "glucose"
  | "hba1c"
  | "insulin"
  | "tsh"
  | "free-t4"
  | "free-t3"
  | "potassium"
  | "sodium"
  | "calcium"
  | "magnesium"
  | "ferritin"
  | "iron"
  | "vitamin-d"
  | "vitamin-b12"
  | "zinc"
  | "lipase"
  | "hs-crp"
  | "ck";

export type MarkerDef = {
  key: MarkerKey;
  label: string;
  system: MarkerSystem;
  /** Names as labs and members write them. Normalized at load. */
  aliases: string[];
  /** Normalized prefixes that also match ("egfr non afr american"). */
  prefixAliases?: string[];
};

export const MARKER_SYSTEM_LABEL: Record<MarkerSystem, string> = {
  blood: "Blood count",
  hormones: "Hormones",
  lipids: "Cholesterol",
  liver: "Liver",
  kidney: "Kidney",
  metabolic: "Blood sugar",
  thyroid: "Thyroid",
  prostate: "Prostate",
  electrolytes: "Electrolytes",
  nutrients: "Vitamins & minerals",
  pancreas: "Pancreas",
  inflammation: "Inflammation",
  muscle: "Muscle",
};

export const MARKERS: MarkerDef[] = [
  // Blood count
  { key: "hematocrit", label: "Hematocrit", system: "blood", aliases: ["Hematocrit", "HCT"] },
  { key: "hemoglobin", label: "Hemoglobin", system: "blood", aliases: ["Hemoglobin", "HGB"] },
  { key: "rbc", label: "Red blood cells", system: "blood", aliases: ["RBC", "Red Blood Cell Count", "Red Blood Cells", "Red Blood Cell"] },
  { key: "wbc", label: "White blood cells", system: "blood", aliases: ["WBC", "White Blood Cell Count", "White Blood Cells"] },
  { key: "platelets", label: "Platelets", system: "blood", aliases: ["Platelets", "Platelet Count", "PLT"] },

  // Hormones
  { key: "total-testosterone", label: "Total testosterone", system: "hormones", aliases: ["Testosterone", "Testosterone, Total", "Total Testosterone", "Testosterone, Total, MS", "Testosterone, Serum"] },
  { key: "free-testosterone", label: "Free testosterone", system: "hormones", aliases: ["Free Testosterone", "Testosterone, Free", "Free Testosterone(Direct)"] },
  { key: "estradiol", label: "Estradiol", system: "hormones", aliases: ["Estradiol", "Estradiol, Ultrasensitive, LC/MS", "E2", "Estradiol Sensitive"] },
  { key: "lh", label: "LH", system: "hormones", aliases: ["LH", "Luteinizing Hormone"] },
  { key: "fsh", label: "FSH", system: "hormones", aliases: ["FSH", "Follicle Stimulating Hormone"] },
  { key: "shbg", label: "SHBG", system: "hormones", aliases: ["SHBG", "Sex Hormone Binding Globulin", "Sex Horm Binding Glob, Serum"] },
  { key: "prolactin", label: "Prolactin", system: "hormones", aliases: ["Prolactin"] },
  { key: "igf-1", label: "IGF-1", system: "hormones", aliases: ["IGF-1", "IGF 1, LC/MS", "IGF-I", "Insulin-Like Growth Factor I", "Insulin Like Growth Factor 1"] },
  { key: "dhea-s", label: "DHEA-S", system: "hormones", aliases: ["DHEA Sulfate", "DHEA-S", "DHEA-Sulfate"] },
  { key: "cortisol", label: "Cortisol", system: "hormones", aliases: ["Cortisol", "Cortisol, Total", "Cortisol, AM"] },

  // Prostate
  { key: "psa", label: "PSA", system: "prostate", aliases: ["PSA", "PSA, Total", "Prostate Specific Antigen", "Prostate Specific Ag"] },

  // Lipids
  { key: "total-cholesterol", label: "Total cholesterol", system: "lipids", aliases: ["Cholesterol, Total", "Total Cholesterol", "Cholesterol"] },
  { key: "ldl", label: "LDL cholesterol", system: "lipids", aliases: ["LDL Cholesterol", "LDL-Cholesterol", "LDL Chol Calc (NIH)", "LDL Chol", "LDL", "LDL Calculated"] },
  { key: "hdl", label: "HDL cholesterol", system: "lipids", aliases: ["HDL Cholesterol", "HDL", "HDL-C"] },
  { key: "triglycerides", label: "Triglycerides", system: "lipids", aliases: ["Triglycerides", "Triglyceride"] },
  { key: "apob", label: "ApoB", system: "lipids", aliases: ["Apolipoprotein B", "ApoB", "Apo B"] },

  // Liver
  { key: "alt", label: "ALT", system: "liver", aliases: ["ALT", "ALT (SGPT)", "SGPT", "Alanine Aminotransferase"] },
  { key: "ast", label: "AST", system: "liver", aliases: ["AST", "AST (SGOT)", "SGOT", "Aspartate Aminotransferase"] },
  { key: "alk-phos", label: "Alkaline phosphatase", system: "liver", aliases: ["Alkaline Phosphatase", "ALP", "Alk Phos"] },
  { key: "bilirubin", label: "Total bilirubin", system: "liver", aliases: ["Bilirubin, Total", "Total Bilirubin", "Bilirubin"] },
  { key: "ggt", label: "GGT", system: "liver", aliases: ["GGT", "Gamma Glutamyl Transferase", "Gamma-Glutamyl Transpeptidase"] },
  { key: "albumin", label: "Albumin", system: "liver", aliases: ["Albumin"] },

  // Kidney
  { key: "creatinine", label: "Creatinine", system: "kidney", aliases: ["Creatinine"] },
  { key: "egfr", label: "eGFR", system: "kidney", aliases: ["eGFR"], prefixAliases: ["egfr"] },
  { key: "bun", label: "BUN", system: "kidney", aliases: ["BUN", "Urea Nitrogen (BUN)", "Urea Nitrogen", "Blood Urea Nitrogen"] },
  { key: "cystatin-c", label: "Cystatin C", system: "kidney", aliases: ["Cystatin C"] },

  // Metabolic
  { key: "glucose", label: "Glucose", system: "metabolic", aliases: ["Glucose", "Glucose, Fasting", "Fasting Glucose"] },
  { key: "hba1c", label: "Hemoglobin A1c", system: "metabolic", aliases: ["Hemoglobin A1c", "HbA1c", "A1c", "Hgb A1c"] },
  { key: "insulin", label: "Insulin", system: "metabolic", aliases: ["Insulin", "Insulin, Fasting"] },

  // Thyroid
  { key: "tsh", label: "TSH", system: "thyroid", aliases: ["TSH", "Thyroid Stimulating Hormone"] },
  { key: "free-t4", label: "Free T4", system: "thyroid", aliases: ["Free T4", "T4, Free", "Thyroxine (T4) Free", "Free Thyroxine"] },
  { key: "free-t3", label: "Free T3", system: "thyroid", aliases: ["Free T3", "T3, Free", "Triiodothyronine (T3), Free", "Free Triiodothyronine"] },

  // Electrolytes
  { key: "potassium", label: "Potassium", system: "electrolytes", aliases: ["Potassium"] },
  { key: "sodium", label: "Sodium", system: "electrolytes", aliases: ["Sodium"] },
  { key: "calcium", label: "Calcium", system: "electrolytes", aliases: ["Calcium"] },
  { key: "magnesium", label: "Magnesium", system: "electrolytes", aliases: ["Magnesium"] },

  // Nutrients
  { key: "ferritin", label: "Ferritin", system: "nutrients", aliases: ["Ferritin"] },
  { key: "iron", label: "Iron", system: "nutrients", aliases: ["Iron", "Iron, Total"] },
  { key: "vitamin-d", label: "Vitamin D", system: "nutrients", aliases: ["Vitamin D, 25-Hydroxy", "Vitamin D,25-OH,Total,IA", "25-Hydroxyvitamin D", "Vitamin D 25 OH", "Vitamin D"] },
  { key: "vitamin-b12", label: "Vitamin B12", system: "nutrients", aliases: ["Vitamin B12", "B12", "Vitamin B-12", "Cobalamin"] },
  { key: "zinc", label: "Zinc", system: "nutrients", aliases: ["Zinc", "Zinc, Plasma or Serum"] },

  // Pancreas / inflammation / muscle
  { key: "lipase", label: "Lipase", system: "pancreas", aliases: ["Lipase"] },
  { key: "hs-crp", label: "hs-CRP", system: "inflammation", aliases: ["hs-CRP", "HS CRP", "C-Reactive Protein, Cardiac", "High Sensitivity CRP"] },
  { key: "ck", label: "Creatine kinase", system: "muscle", aliases: ["CK", "CK, Total", "Creatine Kinase", "Creatine Kinase, Total, Serum", "CPK"] },
];

/** Words that describe HOW a test was run, not WHAT it measured. */
const METHOD_TOKENS = new Set([
  "ms", "lc", "ia", "calc", "serum", "plasma", "or", "direct", "nih",
  "ultrasensitive", "sensitive", "dialysis", "equilibrium", "quantitative",
]);

export function normalizeMarkerName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[,/_.:;*]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((token) => token && !METHOD_TOKENS.has(token))
    .join(" ");
}

const BY_ALIAS = new Map<string, MarkerDef>();
const BY_PREFIX: Array<[string, MarkerDef]> = [];
for (const def of MARKERS) {
  for (const alias of [def.label, ...def.aliases]) {
    const normalized = normalizeMarkerName(alias);
    if (normalized && !BY_ALIAS.has(normalized)) BY_ALIAS.set(normalized, def);
  }
  for (const prefix of def.prefixAliases ?? []) BY_PREFIX.push([prefix, def]);
}

const BY_KEY = new Map<MarkerKey, MarkerDef>(MARKERS.map((def) => [def.key, def]));

/** Exact alias match after normalization. Never a fuzzy guess. */
export function matchMarker(raw: string | undefined | null): MarkerDef | null {
  if (!raw) return null;
  const normalized = normalizeMarkerName(raw);
  if (!normalized) return null;
  const exact = BY_ALIAS.get(normalized);
  if (exact) return exact;
  for (const [prefix, def] of BY_PREFIX) {
    if (normalized === prefix || normalized.startsWith(`${prefix} `)) return def;
  }
  return null;
}

export function markerDef(key: MarkerKey): MarkerDef {
  return BY_KEY.get(key)!;
}

export function isMarkerKey(value: string | undefined | null): value is MarkerKey {
  return Boolean(value && BY_KEY.has(value as MarkerKey));
}
