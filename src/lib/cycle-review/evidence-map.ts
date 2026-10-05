/* ════════════════════════════════════════════════════════════════════════
   EVIDENCE MAP — every body area the member's compounds affect, and what the
   supplement library honestly shows for each, on one screen.

   Built only from the member's own logged compounds and the cited library.
   Within an area, options are alphabetical and never ranked. An area with no
   option says so plainly. Hazards worth knowing before adding anything, and
   the non-supplement habits with the strongest evidence, sit beside it.

   Nothing here is added to the member's plan; they add what they choose.
   ════════════════════════════════════════════════════════════════════════ */

import { EVIDENCE_GRADE_LABEL, type EvidenceGrade } from "@/lib/compound-intelligence/evidence";
import type { CompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import {
  SUPPORT_AREA_LABEL,
  SUPPORT_AREA_NOTES,
  SUPPORT_OPTIONS,
  supportAreasForBrief,
  type SupportArea,
} from "@/lib/compound-intelligence/support-options";

export const EVIDENCE_MAP_VERSION = "2026.09.16";

/** Display order: the loads anabolic steroids carry most, then everyday areas. */
const AREA_ORDER: SupportArea[] = [
  "lipids", "cardiovascular", "liver", "metabolic", "blood", "kidney", "hormonal", "fertility", "prostate", "skin", "mood", "thyroid", "bone", "digestive", "sleep", "general", "hydration",
];

/** Everyday areas shown for anyone with compounds logged. */
const EVERYDAY: SupportArea[] = ["sleep", "general", "hydration"];

/** A hazard a member should see beside the option itself, not only in its detail. */
const OPTION_CAUTION: Record<string, string> = {
  potassium: "Dangerous with some blood pressure medicines or reduced kidney function.",
  zinc: "High intake lowers HDL, the same direction anabolic steroids push it.",
  garlic: "May increase bleeding risk alongside anything else that thins the blood.",
  "red-yeast-rice": "Contains a statin. Never alongside a prescription statin, and it adds liver load.",
  creatine: "Raises blood creatinine, which can read like a kidney problem on labs.",
};

export type EvidenceMapOption = { key: string; title: string; grade: EvidenceGrade; gradeLabel: string; caution: string | null };

export type EvidenceMapArea = {
  area: SupportArea;
  label: string;
  compoundNames: string[];
  options: EvidenceMapOption[];
  /** The area's honest statement. Always present when no option has at least supported evidence. */
  note: string | null;
};

export type EvidenceMap = {
  areas: EvidenceMapArea[];
  /** Areas the compounds affect where no option exists at all. */
  nothingShown: EvidenceMapArea[];
  hazards: Array<{ title: string; text: string }>;
  habits: string[];
};

/** Hazards cited in the risk profiles, worth knowing before adding anything. */
export const EVIDENCE_MAP_HAZARDS: Array<{ title: string; text: string }> = [
  { title: "Turmeric, green tea extract, ashwagandha and kava", text: "Each can injure the liver, on top of the load oral anabolic steroids already carry." },
  { title: "Biotin", text: "Throws off many hormone and thyroid lab results, including testosterone and estradiol." },
  { title: "Creatine", text: "Raises blood creatinine without kidney damage. Tell whoever reads your kidney labs." },
];

/** Non-supplement habits with the strongest evidence. Facts, not a program. */
export const EVIDENCE_MAP_HABITS: string[] = [
  "Blood pressure checked at home, since anabolic steroids commonly raise it.",
  "Bloodwork before, during and after a cycle, so changes can be seen.",
  "Enough sleep, and a look at loud snoring or pauses in breathing.",
  "Regular easy cardio, the kind you can hold a conversation through.",
  "Meals high in fiber and lower in saturated fat, which support cholesterol.",
  "Little or no alcohol, which adds to liver load.",
  "Never sharing needles or vials, which spreads HIV and hepatitis.",
];

export function buildEvidenceMap(brief: CompoundRiskBrief): EvidenceMap | null {
  const loaded = supportAreasForBrief(brief);
  if (loaded.length === 0) return null;
  const namesByArea = new Map(loaded.map((entry) => [entry.area, entry.compoundNames]));
  for (const area of EVERYDAY) if (!namesByArea.has(area)) namesByArea.set(area, []);

  const all: EvidenceMapArea[] = AREA_ORDER.filter((area) => namesByArea.has(area)).map((area) => {
    const options = SUPPORT_OPTIONS.flatMap((option): EvidenceMapOption[] => {
      const finding = option.findings.find((f) => f.area === area);
      return finding
        ? [{ key: option.key, title: option.title, grade: finding.grade, gradeLabel: EVIDENCE_GRADE_LABEL[finding.grade], caution: OPTION_CAUTION[option.key] ?? null }]
        : [];
    }).sort((a, b) => a.title.localeCompare(b.title));
    const supported = options.some((o) => o.grade === "well-studied" || o.grade === "some");
    const note = SUPPORT_AREA_NOTES[area] ?? null;
    return {
      area,
      label: SUPPORT_AREA_LABEL[area],
      compoundNames: namesByArea.get(area) ?? [],
      options,
      note: !supported || area === "liver" || area === "skin" ? note : null,
    };
  });

  return {
    areas: all.filter((a) => a.options.length > 0),
    nothingShown: all.filter((a) => a.options.length === 0),
    hazards: EVIDENCE_MAP_HAZARDS,
    habits: EVIDENCE_MAP_HABITS,
  };
}
