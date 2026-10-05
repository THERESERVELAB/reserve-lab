/* ════════════════════════════════════════════════════════════════════════
   EVIDENCE — one scale for every health statement Reserve makes.

   Support options, compound burdens and the cycle review all grade their
   statements on this scale. There is no second evidence system.

     Established         consistent results across large or many human trials,
                         or stated in FDA prescribing information
     Supported           human evidence shows it, but trials are small, short
                         or mixed
     Limited evidence    mostly small studies, case reports or user reports
     Not shown in trials trials looked for it and did not find it
     Uncertain           too little human evidence to say either way
   ════════════════════════════════════════════════════════════════════════ */

export type EvidenceGrade = "well-studied" | "some" | "limited" | "not-shown" | "uncertain";

export const EVIDENCE_GRADE_LABEL: Record<EvidenceGrade, string> = {
  "well-studied": "Established",
  some: "Supported",
  limited: "Limited evidence",
  "not-shown": "Not shown in trials",
  uncertain: "Uncertain",
};

export const EVIDENCE_GRADE_DETAIL: Record<EvidenceGrade, string> = {
  "well-studied": "Consistent results across large or many human trials, or stated in FDA prescribing information.",
  some: "Human evidence shows an effect, but the trials are small, short or mixed.",
  limited: "Mostly small studies, case reports or user reports.",
  "not-shown": "Human trials looked for this and did not find a consistent effect.",
  uncertain: "Too little human evidence to say either way.",
};
