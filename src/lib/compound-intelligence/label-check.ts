/* ════════════════════════════════════════════════════════════════════════
   LABEL CHECK — what is actually inside a product the member already uses.

   The member brings the product: a name and its ingredient panel, typed,
   pasted or read from a photo on their own device. Reserve reads every
   ingredient against what it knows and says, with sources:
     · substances the FDA has warned about in products sold as supplements
     · ingredients with known hazards, from the cited risk profiles
     · ingredients in the supplement library, with their evidence grade
     · ingredients that change a lab result
     · nutrients that can add up with the member's plan
     · a proprietary blend, which hides how much of each ingredient it holds
     · a "detox" or "cleanse" claim, and what the evidence says about them
     · an independent testing certification, when the label shows one
   and lists every ingredient it has no review for, rather than staying quiet.

   It never judges the product. There is no score, no "safe", no verdict and
   no suggestion to buy, start, stop or switch anything. Reserve does not pick
   products or stores; it reads the one in the member's hand.
   ════════════════════════════════════════════════════════════════════════ */

import { EVIDENCE_GRADE_LABEL, type EvidenceGrade } from "./evidence";
import { profilesForCompound, type ProfileSource } from "./risk-profiles";
import { NUTRIENT_LABEL, SUPPORT_OPTIONS, bestGrade, type NutrientKey } from "./support-options";

export const LABEL_CHECK_VERSION = "2026.09.16";

const SRC = {
  fdaDmaa: { label: "FDA: DMAA in products marketed as dietary supplements", url: "https://www.fda.gov/food/dietary-supplement-products-ingredients/dmaa-products-marketed-dietary-supplements" },
  fdaDmha: { label: "FDA warning letters on DMHA in products sold as dietary supplements, 2019" },
  fdaPhenibut: { label: "FDA warning letters on phenibut in products sold as dietary supplements, 2019" },
  fdaTianeptine: { label: "FDA warning: tianeptine products linked to serious harm, overdoses and death" },
  fdaSarms: { label: "FDA warning on body-building products containing selective androgen receptor modulators (SARMs), 2017" },
  fdaKratom: { label: "FDA and Kratom", url: "https://www.fda.gov/news-events/public-health-focus/fda-and-kratom" },
  fdaCaffeine: { label: "FDA: Pure and highly concentrated caffeine", url: "https://www.fda.gov/food/dietary-supplement-products-ingredients/pure-and-highly-concentrated-caffeine" },
  nccihYohimbe: { label: "NIH National Center for Complementary and Integrative Health: Yohimbe", url: "https://www.nccih.nih.gov/health/yohimbe" },
  nccihBitterOrange: { label: "NIH National Center for Complementary and Integrative Health: Bitter Orange", url: "https://www.nccih.nih.gov/health/bitter-orange" },
  nccihDetox: { label: "NIH National Center for Complementary and Integrative Health: Detoxes and Cleanses", url: "https://www.nccih.nih.gov/health/detoxes-and-cleanses-what-you-need-to-know" },
  fdaSupplements: { label: "FDA: Questions and answers on dietary supplements", url: "https://www.fda.gov/food/information-consumers-using-dietary-supplements/questions-and-answers-dietary-supplements" },
  fdaProprietary: { label: "FDA dietary supplement labeling rules for proprietary blends (21 CFR 101.36)" },
  biotinInterference: { label: "Gifford, Sadrzadeh, Naugler: Biotin interference in laboratory testing, Canadian Family Physician 2018", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5951654/" },
  certNsf: { label: "NSF Certified for Sport", url: "https://www.nsfsport.com" },
  certInformed: { label: "Informed Sport and Informed Choice certification programs" },
  certUsp: { label: "USP Verified dietary supplement program", url: "https://www.quality-supplements.org" },
} satisfies Record<string, ProfileSource>;

/* ─── Vocabulary ──────────────────────────────────────────────────────── */

type Rule = { patterns: RegExp[] };

/** Substances the FDA has warned about in products sold as supplements. */
const FLAGGED: Array<Rule & { key: string; label: string; note: string; sources: ProfileSource[] }> = [
  {
    key: "dmaa",
    label: "DMAA",
    patterns: [/\bdmaa\b/i, /1,?3[- ]?dimethyl ?amylamine/i, /methylhexan(?:e)?amine/i, /geranium (?:oil|extract|stem)/i],
    note: "The FDA considers DMAA unlawful in dietary supplements and has linked it to raised blood pressure, heart attacks, seizures and death. Geranium extract on a label is a name it is sold under.",
    sources: [SRC.fdaDmaa],
  },
  {
    key: "dmha",
    label: "DMHA",
    patterns: [/\bdmha\b/i, /2[- ]?amino[- ]?isoheptane/i, /\boctodrine\b/i, /2[- ]?amino[- ]?6[- ]?methylheptane/i],
    note: "A stimulant the FDA has warned is not a lawful dietary ingredient, sold as a substitute for DMAA with very little safety testing in people.",
    sources: [SRC.fdaDmha],
  },
  {
    key: "phenibut",
    label: "Phenibut",
    patterns: [/\bphenibut\b/i, /phenyl[- ]?gaba/i, /4[- ]?amino[- ]?3[- ]?phenylbutyric/i],
    note: "A drug in other countries that the FDA has warned is not a lawful dietary ingredient. Dependence and severe withdrawal have been reported.",
    sources: [SRC.fdaPhenibut],
  },
  {
    key: "tianeptine",
    label: "Tianeptine",
    patterns: [/\btianeptine\b/i],
    note: "Not approved for any use in the United States. The FDA has linked products containing it to seizures, loss of consciousness and death.",
    sources: [SRC.fdaTianeptine],
  },
  {
    key: "sarms",
    label: "A SARM",
    patterns: [/\b(?:ostarine|enobosarm|mk[- ]?2866|ligandrol|lgd[- ]?4033|testolone|rad[- ]?140|andarine|\bs[- ]?4\b|yk[- ]?11|cardarine|gw[- ]?501516)\b/i, /selective androgen receptor modulator/i],
    note: "Not dietary supplements and not approved drugs. The FDA has warned of liver injury and of heart attack and stroke risk with these products.",
    sources: [SRC.fdaSarms],
  },
  {
    key: "kratom",
    label: "Kratom",
    patterns: [/\bkratom\b/i, /mitragyn/i],
    note: "The FDA has warned against kratom because of serious risks, including dependence, and has reported deaths involving it.",
    sources: [SRC.fdaKratom],
  },
];

/** Stimulants with cited hazards that are lawful but worth naming. */
const STIMULANTS: Array<Rule & { key: string; label: string; note: string; sources: ProfileSource[] }> = [
  {
    key: "yohimbe",
    label: "Yohimbe or yohimbine",
    patterns: [/\byohimb/i],
    note: "NCCIH lists heart attacks, seizures and high blood pressure among reported problems, and notes product labels often do not match what is inside.",
    sources: [SRC.nccihYohimbe],
  },
  {
    key: "bitter-orange",
    label: "Bitter orange or synephrine",
    patterns: [/bitter orange/i, /synephrine/i, /citrus aurantium/i],
    note: "NCCIH notes that combined with caffeine and other stimulants it may raise heart rate and blood pressure, and that it has been linked to fainting, heart attacks and stroke.",
    sources: [SRC.nccihBitterOrange],
  },
  {
    key: "caffeine",
    label: "Caffeine",
    patterns: [/caffeine/i, /guarana/i, /\byerba mate\b/i, /\bkola nut\b/i, /teacrine|theacrine/i],
    note: "Caffeine adds up across drinks, pre-workouts and fat burners. The FDA has warned that concentrated caffeine can reach dangerous amounts quickly. It can also raise blood pressure and disturb sleep.",
    sources: [SRC.fdaCaffeine],
  },
];

/** Library options and hazard profiles, matched by what a label actually prints. */
const INGREDIENTS: Array<Rule & { catalogName: string; label: string }> = [
  { catalogName: "Turmeric", label: "Turmeric or curcumin", patterns: [/turmeric/i, /curcumin/i, /curcuma longa/i] },
  { catalogName: "Green Tea Extract", label: "Green tea extract", patterns: [/green tea extract/i, /\begcg\b/i, /epigallocatechin/i, /camellia sinensis (?:leaf )?extract/i] },
  { catalogName: "Ashwagandha", label: "Ashwagandha", patterns: [/ashwagandha/i, /withania/i] },
  { catalogName: "Kava", label: "Kava", patterns: [/\bkava\b/i, /piper methysticum/i, /kavalactone/i] },
  { catalogName: "Cinnamon", label: "Cinnamon", patterns: [/cinnamon/i, /\bcassia\b/i, /cinnamomum/i] },
  { catalogName: "Vitamin C", label: "Vitamin C", patterns: [/vitamin c\b/i, /ascorb/i] },
  { catalogName: "Garcinia Cambogia", label: "Garcinia cambogia", patterns: [/garcinia/i, /hydroxycitric/i] },
  { catalogName: "Red Yeast Rice", label: "Red yeast rice", patterns: [/red yeast rice/i, /monacolin/i] },
  { catalogName: "Niacin", label: "Niacin", patterns: [/\bniacin\b/i, /nicotinic acid/i] },
  { catalogName: "Biotin", label: "Biotin", patterns: [/\bbiotin\b/i, /vitamin b7\b/i] },
  { catalogName: "Licorice Root", label: "Licorice", patterns: [/licorice|liquorice/i, /glycyrrhiz/i] },
  { catalogName: "DHEA", label: "DHEA", patterns: [/\bdhea\b/i, /dehydroepiandrosterone/i] },
  { catalogName: "Creatine Monohydrate", label: "Creatine", patterns: [/\bcreatine\b/i] },
  { catalogName: "Zinc", label: "Zinc", patterns: [/\bzinc\b/i] },
  { catalogName: "Garlic Extract", label: "Garlic", patterns: [/garlic/i, /allicin/i] },
  { catalogName: "Potassium", label: "Potassium", patterns: [/potassium/i] },
  { catalogName: "N-Acetyl Cysteine", label: "N-acetyl cysteine", patterns: [/n[- ]?acetyl[- ]?(?:l[- ]?)?cysteine/i, /\bnac\b/i] },
  { catalogName: "Magnesium Glycinate", label: "Magnesium", patterns: [/magnesium/i] },
  { catalogName: "Vitamin D3", label: "Vitamin D", patterns: [/vitamin d\b|vitamin d3/i, /cholecalciferol/i] },
  { catalogName: "Fish Oil", label: "Fish oil or omega-3", patterns: [/fish oil/i, /omega[- ]?3/i, /\bepa\b|\bdha\b/i] },
  { catalogName: "CoQ10", label: "Coenzyme Q10", patterns: [/coq ?10|co[- ]?enzyme q10|coenzyme q10/i, /ubiquinol|ubiquinone/i] },
  { catalogName: "Berberine", label: "Berberine", patterns: [/berberine/i] },
  { catalogName: "Milk Thistle", label: "Milk thistle", patterns: [/milk thistle/i, /silymarin|silybum/i] },
  { catalogName: "TUDCA", label: "TUDCA", patterns: [/\btudca\b/i, /tauroursodeoxycholic/i] },
  { catalogName: "Psyllium Husk", label: "Psyllium", patterns: [/psyllium|ispaghula/i] },
  { catalogName: "Melatonin", label: "Melatonin", patterns: [/melatonin/i] },
  { catalogName: "Beetroot Extract", label: "Beetroot or nitrate", patterns: [/beet ?root|\bbeet\b/i, /\bnitrate\b/i] },
  { catalogName: "Boswellia", label: "Boswellia", patterns: [/boswellia/i] },
  { catalogName: "Collagen Peptides", label: "Collagen", patterns: [/collagen/i] },
  { catalogName: "Glycine", label: "Glycine", patterns: [/\bglycine\b/i] },
  { catalogName: "L-Citrulline", label: "Citrulline", patterns: [/citrulline/i] },
  { catalogName: "Taurine", label: "Taurine", patterns: [/\btaurine\b/i] },
  { catalogName: "Saw Palmetto", label: "Saw palmetto", patterns: [/saw palmetto/i, /serenoa/i] },
  { catalogName: "Electrolytes", label: "Electrolytes", patterns: [/electrolyte/i] },
];

/** Nutrients that add up across products, by what labels print. */
const NUTRIENT_PATTERNS: Array<{ nutrient: NutrientKey; patterns: RegExp[] }> = [
  { nutrient: "vitamin-a", patterns: [/vitamin a\b/i, /retinyl|retinol/i, /beta[- ]?carotene/i] },
  { nutrient: "vitamin-b6", patterns: [/vitamin b6\b/i, /pyridox/i] },
  { nutrient: "niacin", patterns: [/\bniacin\b/i, /niacinamide|nicotinamide|nicotinic acid/i] },
  { nutrient: "vitamin-d", patterns: [/vitamin d\b|vitamin d3/i, /cholecalciferol|ergocalciferol/i] },
  { nutrient: "vitamin-k", patterns: [/vitamin k\b|vitamin k2/i, /menaquinone|phylloquinone/i] },
  { nutrient: "calcium", patterns: [/\bcalcium\b/i] },
  { nutrient: "magnesium", patterns: [/magnesium/i] },
  { nutrient: "zinc", patterns: [/\bzinc\b/i] },
  { nutrient: "iron", patterns: [/\biron\b/i, /ferrous|ferric/i] },
  { nutrient: "sodium", patterns: [/\bsodium\b/i] },
  { nutrient: "potassium", patterns: [/potassium/i] },
  { nutrient: "omega-3", patterns: [/omega[- ]?3/i, /fish oil/i] },
];

const CERTIFICATIONS: Array<{ label: string; patterns: RegExp[]; source: ProfileSource }> = [
  { label: "NSF Certified for Sport", patterns: [/nsf certified for sport/i, /certified for sport/i], source: SRC.certNsf },
  { label: "Informed Sport", patterns: [/informed[- ]sport/i], source: SRC.certInformed },
  { label: "Informed Choice", patterns: [/informed[- ]choice/i], source: SRC.certInformed },
  { label: "USP Verified", patterns: [/usp verified/i], source: SRC.certUsp },
];

/* ─── Reading the label ───────────────────────────────────────────────── */

/** Label lines that open with furniture rather than an ingredient. */
const FURNITURE_PREFIX = /^(?:supplement facts|nutrition facts|serving size|servings? per container|amount per serving|%? ?daily value|other ingredients|ingredients|contains)\b\s*/i;
/** A blend or matrix name is a heading over ingredients, not an ingredient. */
const BLEND_NAME = /\b(?:blend|matrix|complex|formula|stack)$/i;

/** Label furniture that is not an ingredient. */
const NOISE = /^(?:supplement facts|nutrition facts|serving size|servings? per container|amount per serving|%? ?daily value|dv|calories|total carbohydrate|total fat|protein|sugars?|added sugars?|other ingredients|ingredients|contains|less than|not established|daily value not established|per serving|directions|warning|keep out of reach.*|store in.*|distributed by.*|manufactured.*|made in.*)$/i;

/** The ingredients as the label lists them, without amounts, percentages or label furniture. */
export function splitIngredients(labelText: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of labelText.split(/[\n,;•·]|\(|\)|\[|\]/)) {
    const cleaned = raw
      .trim()
      .replace(FURNITURE_PREFIX, "")
      .replace(/\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|iu|ml|kcal|cal|%|billion|cfu)\b/gi, " ")
      .replace(/\b\d+(?:[.,]\d+)?\b/g, " ")
      .replace(/[*†‡%:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const heading = FURNITURE_PREFIX.test(raw.trim()) && /^(?:supplement facts|nutrition facts|serving size|servings? per container|amount per serving|%? ?daily value)/i.test(raw.trim());
    if (heading || cleaned.length < 3 || !/[a-z]{3}/i.test(cleaned) || NOISE.test(cleaned) || BLEND_NAME.test(cleaned)) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

const matches = (rule: Rule, text: string) => rule.patterns.some((pattern) => pattern.test(text));

/* ─── The check ───────────────────────────────────────────────────────── */

export type LabelFinding = { key: string; label: string; notes: string[]; sources: ProfileSource[] };

export type LabelLibraryMatch = { optionKey: string; title: string; grade: EvidenceGrade; gradeLabel: string };

export type LabelCheck = {
  productName: string;
  ingredients: string[];
  /** Substances the FDA has warned about. Always shown first. */
  flagged: LabelFinding[];
  /** Lawful ingredients with cited hazards, stimulants included. */
  hazards: LabelFinding[];
  /** Ingredients that change a lab result. */
  labNotes: LabelFinding[];
  /** Ingredients in the supplement library, with their evidence grade. */
  library: LabelLibraryMatch[];
  nutrients: Array<{ nutrient: NutrientKey; label: string; alsoIn: string[] }>;
  proprietaryBlend: LabelFinding | null;
  claim: LabelFinding | null;
  certifications: Array<{ label: string; source: ProfileSource }>;
  /** Printed when no certification was found. */
  noCertification: LabelFinding | null;
  /** Ingredients Reserve has no review for. Listed, never dropped. */
  unreviewed: string[];
  /** Always shown: supplements are not checked by the FDA before they are sold. */
  standing: LabelFinding;
};

export type LabelCheckInput = {
  productName: string;
  labelText: string;
  /** Nutrients already coming from the member's plan and log, by product name. */
  planNutrients?: Partial<Record<NutrientKey, string[]>>;
};

export function checkLabel(input: LabelCheckInput): LabelCheck {
  const productName = input.productName.trim();
  const ingredients = splitIngredients(input.labelText);
  const whole = `${productName}\n${input.labelText}`;
  const claimed = new Set<string>();
  const claim = (ingredient: string) => claimed.add(ingredient.toLowerCase());

  const flagged: LabelFinding[] = FLAGGED.filter((rule) => matches(rule, whole)).map((rule) => {
    ingredients.filter((i) => matches(rule, i)).forEach(claim);
    return { key: rule.key, label: rule.label, notes: [rule.note], sources: rule.sources };
  });

  const hazards: LabelFinding[] = STIMULANTS.filter((rule) => matches(rule, whole)).map((rule) => {
    ingredients.filter((i) => matches(rule, i)).forEach(claim);
    return { key: rule.key, label: rule.label, notes: [rule.note], sources: rule.sources };
  });

  const labNotes: LabelFinding[] = [];
  const library: LabelLibraryMatch[] = [];

  for (const rule of INGREDIENTS) {
    const hits = ingredients.filter((i) => matches(rule, i));
    if (hits.length === 0 && !matches(rule, productName)) continue;
    hits.forEach(claim);

    const option = SUPPORT_OPTION_BY_CATALOG.get(rule.catalogName.toLowerCase());
    if (option) library.push({ optionKey: option.key, title: option.title, grade: bestGrade(option), gradeLabel: EVIDENCE_GRADE_LABEL[bestGrade(option)] });

    /* Only profiles written for this ingredient — the general supplement class profile would repeat on every line. */
    for (const profile of profilesForCompound({ name: rule.catalogName })) {
      if (profile.regulatory !== "supplement" || !profile.appliesTo.compounds?.length) continue;
      /* A note about the test itself (interference, a raised creatinine), not one that merely points at lab reports. */
      const labSystems = profile.systems.filter((s) => /\b(?:interfer\w*|measurement|raises blood creatinine|read\w* (?:lower|higher|wrong))\b/i.test(s.note));
      const otherSystems = profile.systems.filter((s) => !labSystems.includes(s));
      const worth = otherSystems.filter((s) => s.system !== "digestive");
      if (labSystems.length > 0) {
        labNotes.push({ key: profile.key, label: rule.label, notes: labSystems.map((s) => s.note), sources: profile.sources });
      }
      if (worth.length > 0 || profile.redFlags.length > 0 || profile.interactions.length > 0) {
        hazards.push({ key: profile.key, label: rule.label, notes: [...worth.map((s) => s.note), ...profile.interactions], sources: profile.sources });
      }
    }
  }

  /* Biotin changes more lab results than any other supplement ingredient. */
  if (matches({ patterns: [/\bbiotin\b/i, /vitamin b7\b/i] }, whole) && !labNotes.some((n) => n.label === "Biotin")) {
    labNotes.push({
      key: "biotin-labs",
      label: "Biotin",
      notes: ["Interferes with many hormone, thyroid, ferritin and B12 tests and can make results read too high or too low. Tell the lab and your clinician."],
      sources: [SRC.biotinInterference],
    });
  }

  const nutrients = NUTRIENT_PATTERNS.filter((n) => ingredients.some((i) => matches(n, i))).map((n) => ({
    nutrient: n.nutrient,
    label: NUTRIENT_LABEL[n.nutrient],
    alsoIn: input.planNutrients?.[n.nutrient] ?? [],
  }));
  ingredients.filter((i) => NUTRIENT_PATTERNS.some((n) => matches(n, i))).forEach(claim);

  const proprietaryBlend = /proprietary\b[^\n,]{0,40}?\b(?:blend|formula|complex|matrix)\b/i.test(whole)
    ? {
        key: "proprietary-blend",
        label: "Proprietary blend",
        notes: ["A proprietary blend lists its total weight but not how much of each ingredient it contains, so the amount of any one ingredient cannot be read from this label."],
        sources: [SRC.fdaProprietary],
      }
    : null;

  const claim_ = /\b(?:detox|cleanse|flush|purify)\w*/i.test(whole)
    ? {
        key: "detox-claim",
        label: "Detox or cleanse claim",
        notes: ["NCCIH reports there is no compelling research that detox or cleanse products remove toxins from the body, and that some have caused harm. The liver and kidneys are what clear the body."],
        sources: [SRC.nccihDetox],
      }
    : null;

  const certifications = CERTIFICATIONS.filter((c) => matches(c, whole)).map((c) => ({ label: c.label, source: c.source }));
  const noCertification: LabelFinding | null = certifications.length === 0
    ? {
        key: "no-certification",
        label: "No independent testing mark found",
        notes: ["Reserve did not find an NSF Certified for Sport, Informed Sport, Informed Choice or USP Verified mark in this text. Those programs test products for what they contain and for substances banned in sport. The mark may be on the package even if it is not in what you entered."],
        sources: [SRC.certNsf, SRC.certInformed, SRC.certUsp],
      }
    : null;

  const unreviewed = ingredients.filter((i) => !claimed.has(i.toLowerCase()));

  return {
    productName,
    ingredients,
    flagged,
    hazards: dedupe(hazards),
    labNotes: dedupe(labNotes),
    library: library.filter((m, i) => library.findIndex((x) => x.optionKey === m.optionKey) === i).sort((a, b) => a.title.localeCompare(b.title)),
    nutrients,
    proprietaryBlend,
    claim: claim_,
    certifications,
    noCertification,
    unreviewed,
    standing: {
      key: "not-pre-approved",
      label: "Supplements are not checked before they are sold",
      notes: ["The FDA does not approve dietary supplements for safety or effectiveness before they reach shelves, so what is in the container is not verified by anyone unless the product carries an independent testing mark."],
      sources: [SRC.fdaSupplements],
    },
  };
}

/** Library options by the catalog name a label rule points at. */
const SUPPORT_OPTION_BY_CATALOG = new Map(SUPPORT_OPTIONS.map((option) => [option.catalogName.toLowerCase(), option] as const));

function dedupe(findings: LabelFinding[]): LabelFinding[] {
  const byKey = new Map<string, LabelFinding>();
  for (const finding of findings) {
    const current = byKey.get(finding.key);
    if (!current) byKey.set(finding.key, { ...finding, notes: [...new Set(finding.notes)] });
    else current.notes = [...new Set([...current.notes, ...finding.notes])];
  }
  return [...byKey.values()];
}
