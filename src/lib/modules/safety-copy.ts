/* ────────────────────────────────────────────────────────────────────────────
   RESERVE SAFETY COPY — one source of truth for sensitive-module disclaimers

   Use these constants everywhere a sensitive module renders a disclaimer so the
   language stays consistent and compliant across the app. Reserve is an
   optimization and tracking platform — never medical advice.
   ──────────────────────────────────────────────────────────────────────── */

import type { ModuleSafetyCategory } from "./registry";

export const SAFETY_COPY = {
  bloodwork:
    "Bloodwork is stored for tracking only. Reserve does not interpret labs, diagnose conditions, or recommend treatment. Review results with a qualified clinician.",
  compound:
    "Log-only. Reserve does not prescribe, recommend, or adjust compounds, supplements, medications, or dosages.",
  cycleFertilityPregnancy:
    "Lifestyle, tracking, and adherence support only. Reserve does not diagnose, treat, or provide medical guidance. Cycle dates are calendar estimates.",
  mensVitality:
    "Vitality Reserve reflects lifestyle inputs supporting energy, recovery, and performance. It is not a hormone measurement, diagnosis, or treatment.",
  general:
    "Reserve is an optimization and tracking platform — observational only, not medical advice. Review anything health-related with a qualified clinician.",
} as const;

/** Short scope label for the Settings module control center. */
export const SAFETY_SCOPE_LABEL: Record<ModuleSafetyCategory, string> = {
  "log-only": "Log-only · no prescriptions or interpretation",
  "estimate-only": "Estimate-only · not medical prediction",
  "lifestyle-only": "Lifestyle support only · not medical guidance",
};

export function safetyCopyFor(category: ModuleSafetyCategory): string {
  switch (category) {
    case "log-only":
      return SAFETY_COPY.compound;
    case "estimate-only":
      return SAFETY_COPY.cycleFertilityPregnancy;
    case "lifestyle-only":
      return SAFETY_COPY.cycleFertilityPregnancy;
  }
}
