/* ════════════════════════════════════════════════════════════════════════
   COMPOUND BURDENS — the physiological load a compound adds, by kind.

   A risk profile says what a compound is known to affect, body system by
   body system. A burden is finer: "raises hematocrit" and "adds to bleeding
   risk" are both "blood", but they are different loads and must never be
   counted as the same one. Burdens let the cycle review notice when several
   compounds in one plan add to the SAME load — redundancy — without ever
   saying which compound to change.

   Every link is drawn from the matching risk profile's own cited note, with
   an evidence grade on the shared scale. Supplements are not mapped: the
   review reasons about the member's plan, not their multivitamin.

   REVIEW: links ship "pending-clinician-review" with the risk profiles.
   ════════════════════════════════════════════════════════════════════════ */

import type { MarkerKey } from "@/lib/labs/markers";

import type { EvidenceGrade } from "./evidence";
import { profilesForCompound, type CompoundIdentity } from "./risk-profiles";

export const BURDEN_MAP_VERSION = "2026.09.16";

export type BurdenKey =
  | "androgenic"
  | "prostate"
  | "estrogen-prolactin"
  | "hpta-suppression"
  | "fertility"
  | "liver"
  | "lipids"
  | "blood-pressure"
  | "heart-structure"
  | "heart-rhythm"
  | "hematocrit"
  | "glucose"
  | "kidney"
  | "sleep"
  | "mood";

/** The body-system rows the cycle review reports on. */
export type HealthSystemKey = "cardiovascular" | "blood" | "hormonal" | "liver" | "kidney" | "glucose" | "mood" | "fertility" | "prostate" | "skin" | "sleep";

export const HEALTH_SYSTEM_LABEL: Record<HealthSystemKey, string> = {
  cardiovascular: "Cardiovascular",
  blood: "Blood",
  hormonal: "Hormonal",
  liver: "Liver",
  kidney: "Kidney",
  glucose: "Glucose",
  mood: "Mental wellbeing",
  fertility: "Fertility",
  prostate: "Prostate",
  skin: "Skin & hair",
  sleep: "Sleep",
};

export type BurdenDef = {
  key: BurdenKey;
  label: string;
  /** How the load reads in a sentence: "can affect cholesterol". */
  phrase: string;
  system: HealthSystemKey;
  /** Lab markers that show this load on the member's own reports. */
  markers: MarkerKey[];
  /** Check-in signals that show it when no lab marker does. */
  /** "check-in" means the weekly check-in's symptom list is where this load shows. */
  signals: Array<"blood-pressure" | "resting-hr" | "sleep" | "mood" | "libido" | "check-in">;
};

export const BURDENS: Record<BurdenKey, BurdenDef> = {
  /* Acne and scalp hair loss show on skin, not on a hormone panel — and the weekly check-in is where a member records them. */
  androgenic: { key: "androgenic", label: "Androgenic effects", phrase: "is commonly associated with androgenic effects such as acne and scalp hair loss", system: "skin", markers: [], signals: ["check-in"] },
  prostate: { key: "prostate", label: "Prostate effects", phrase: "acts on the prostate, where PSA is commonly watched", system: "prostate", markers: ["psa"], signals: [] },
  "estrogen-prolactin": { key: "estrogen-prolactin", label: "Estrogen and prolactin effects", phrase: "can change estradiol or prolactin", system: "hormonal", markers: ["estradiol", "prolactin"], signals: ["libido"] },
  "hpta-suppression": { key: "hpta-suppression", label: "Natural testosterone suppression", phrase: "can suppress the body's own testosterone production", system: "hormonal", markers: ["lh", "fsh", "total-testosterone"], signals: ["libido"] },
  fertility: { key: "fertility", label: "Fertility suppression", phrase: "can suppress sperm production", system: "fertility", markers: ["lh", "fsh"], signals: [] },
  liver: { key: "liver", label: "Liver strain", phrase: "can strain the liver", system: "liver", markers: ["alt", "ast", "bilirubin", "alk-phos", "ggt"], signals: [] },
  lipids: { key: "lipids", label: "Cholesterol changes", phrase: "can worsen cholesterol markers", system: "cardiovascular", markers: ["apob", "ldl", "hdl", "triglycerides", "total-cholesterol"], signals: [] },
  "blood-pressure": { key: "blood-pressure", label: "Blood pressure effects", phrase: "can change blood pressure", system: "cardiovascular", markers: [], signals: ["blood-pressure"] },
  "heart-structure": { key: "heart-structure", label: "Heart structure concerns", phrase: "is linked to changes in heart muscle or valves", system: "cardiovascular", markers: [], signals: [] },
  "heart-rhythm": { key: "heart-rhythm", label: "Heart rate and rhythm", phrase: "can raise heart rate or disturb heart rhythm", system: "cardiovascular", markers: ["potassium"], signals: ["resting-hr"] },
  hematocrit: { key: "hematocrit", label: "Red blood cell increase", phrase: "can raise hematocrit and hemoglobin", system: "blood", markers: ["hematocrit", "hemoglobin", "rbc"], signals: [] },
  glucose: { key: "glucose", label: "Blood sugar effects", phrase: "can change blood sugar or insulin sensitivity", system: "glucose", markers: ["glucose", "hba1c", "insulin"], signals: [] },
  kidney: { key: "kidney", label: "Kidney load", phrase: "can affect kidney function", system: "kidney", markers: ["creatinine", "egfr", "bun"], signals: [] },
  sleep: { key: "sleep", label: "Sleep effects", phrase: "can disrupt sleep or breathing during sleep", system: "sleep", markers: [], signals: ["sleep"] },
  mood: { key: "mood", label: "Mood effects", phrase: "can affect mood", system: "mood", markers: [], signals: ["mood"] },
};

export type BurdenLink = { burden: BurdenKey; grade: EvidenceGrade };

/** Risk profile key → the burdens its cited notes describe. */
export const PROFILE_BURDENS: Record<string, BurdenLink[]> = {
  "anabolic-steroids": [
    { burden: "blood-pressure", grade: "well-studied" },
    { burden: "heart-structure", grade: "some" },
    { burden: "hematocrit", grade: "well-studied" },
    { burden: "lipids", grade: "well-studied" },
    { burden: "hpta-suppression", grade: "well-studied" },
    { burden: "fertility", grade: "well-studied" },
    { burden: "liver", grade: "some" },
    { burden: "mood", grade: "some" },
    { burden: "androgenic", grade: "well-studied" },
  ],
  "dht-derived-steroids": [
    { burden: "androgenic", grade: "some" },
    { burden: "lipids", grade: "some" },
    { burden: "prostate", grade: "limited" },
  ],
  boldenone: [
    { burden: "hematocrit", grade: "limited" },
    { burden: "estrogen-prolactin", grade: "limited" },
  ],
  methenolone: [
    { burden: "androgenic", grade: "some" },
    { burden: "lipids", grade: "some" },
    { burden: "prostate", grade: "limited" },
  ],
  trestolone: [
    { burden: "estrogen-prolactin", grade: "limited" },
    { burden: "hpta-suppression", grade: "some" },
    { burden: "fertility", grade: "some" },
  ],
  "oral-17aa-steroids": [
    { burden: "liver", grade: "well-studied" },
    { burden: "lipids", grade: "well-studied" },
  ],
  nandrolone: [
    { burden: "estrogen-prolactin", grade: "some" },
    { burden: "hpta-suppression", grade: "well-studied" },
    { burden: "fertility", grade: "well-studied" },
  ],
  trenbolone: [
    { burden: "estrogen-prolactin", grade: "some" },
    { burden: "sleep", grade: "limited" },
    { burden: "mood", grade: "limited" },
  ],
  testosterone: [
    { burden: "hematocrit", grade: "well-studied" },
    { burden: "estrogen-prolactin", grade: "well-studied" },
    { burden: "hpta-suppression", grade: "well-studied" },
    { burden: "fertility", grade: "well-studied" },
    { burden: "blood-pressure", grade: "some" },
    { burden: "sleep", grade: "some" },
    { burden: "androgenic", grade: "well-studied" },
    /* The Endocrine Society guideline monitors PSA during testosterone therapy. */
    { burden: "prostate", grade: "well-studied" },
  ],
  hcg: [{ burden: "estrogen-prolactin", grade: "some" }],
  "growth-hormone": [{ burden: "glucose", grade: "well-studied" }],
  "gh-secretagogues": [
    { burden: "glucose", grade: "some" },
    { burden: "estrogen-prolactin", grade: "limited" },
  ],
  "igf-1-analogs": [{ burden: "glucose", grade: "some" }],
  "glp-1-agonists": [
    { burden: "glucose", grade: "well-studied" },
    { burden: "kidney", grade: "limited" },
  ],
  "aromatase-inhibitors": [
    { burden: "estrogen-prolactin", grade: "well-studied" },
    { burden: "lipids", grade: "some" },
  ],
  serms: [{ burden: "mood", grade: "limited" }],
  cabergoline: [
    { burden: "heart-structure", grade: "well-studied" },
    { burden: "blood-pressure", grade: "well-studied" },
    { burden: "mood", grade: "well-studied" },
  ],
  "5-alpha-reductase-inhibitors": [{ burden: "mood", grade: "some" }],
  telmisartan: [
    { burden: "kidney", grade: "well-studied" },
    { burden: "blood-pressure", grade: "well-studied" },
  ],
  tadalafil: [{ burden: "blood-pressure", grade: "well-studied" }],
  metformin: [
    { burden: "glucose", grade: "well-studied" },
    { burden: "kidney", grade: "some" },
  ],
  sarms: [
    { burden: "liver", grade: "some" },
    { burden: "lipids", grade: "some" },
    { burden: "hpta-suppression", grade: "some" },
    { burden: "fertility", grade: "some" },
  ],
  "thyroid-hormones": [{ burden: "heart-rhythm", grade: "well-studied" }],
  clenbuterol: [
    { burden: "heart-rhythm", grade: "some" },
    { burden: "glucose", grade: "some" },
  ],
  insulin: [{ burden: "glucose", grade: "well-studied" }],
  melanocortins: [{ burden: "blood-pressure", grade: "limited" }],
};

const GRADE_RANK: Record<EvidenceGrade, number> = { "well-studied": 0, some: 1, limited: 2, "not-shown": 3, uncertain: 4 };

export type CompoundBurden = { burden: BurdenKey; grade: EvidenceGrade; profileKeys: string[] };

/** Every burden one compound carries, strongest evidence kept when profiles repeat a burden. */
export function burdensForCompound(compound: CompoundIdentity): CompoundBurden[] {
  const byBurden = new Map<BurdenKey, CompoundBurden>();
  for (const profile of profilesForCompound(compound)) {
    if (profile.regulatory === "supplement") continue;
    for (const link of PROFILE_BURDENS[profile.key] ?? []) {
      const current = byBurden.get(link.burden);
      if (!current) {
        byBurden.set(link.burden, { burden: link.burden, grade: link.grade, profileKeys: [profile.key] });
      } else {
        current.profileKeys.push(profile.key);
        if (GRADE_RANK[link.grade] < GRADE_RANK[current.grade]) current.grade = link.grade;
      }
    }
  }
  return [...byBurden.values()];
}

export type BurdenOverlap = {
  burden: BurdenKey;
  compounds: Array<{ id: string; name: string; grade: EvidenceGrade }>;
};

/**
 * Burdens carried by two or more compounds in the same plan. Ordered by how
 * many compounds share the load, then by strength of evidence.
 */
export function findBurdenOverlaps(compounds: Array<CompoundIdentity & { id: string }>): BurdenOverlap[] {
  const byBurden = new Map<BurdenKey, BurdenOverlap>();
  for (const compound of compounds) {
    for (const { burden, grade } of burdensForCompound(compound)) {
      const overlap = byBurden.get(burden) ?? { burden, compounds: [] };
      overlap.compounds.push({ id: compound.id, name: compound.name, grade });
      byBurden.set(burden, overlap);
    }
  }
  const strongest = (o: BurdenOverlap) => Math.min(...o.compounds.map((c) => GRADE_RANK[c.grade]));
  return [...byBurden.values()]
    .filter((o) => o.compounds.length >= 2)
    .sort((a, b) => b.compounds.length - a.compounds.length || strongest(a) - strongest(b) || a.burden.localeCompare(b.burden));
}
