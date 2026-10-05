import type { SimpleLanguageTerm } from "@/lib/contracts/product";

export const SIMPLE_LANGUAGE_TERMS: Record<string, SimpleLanguageTerm> = {
  RIR: {
    key: "RIR",
    plainLabel: "Reps Left In Reserve",
    shortDefinition: "How many clean reps you could still perform when a set ends.",
  },
  HRV: {
    key: "HRV",
    plainLabel: "Heart Rate Variability",
    shortDefinition: "A recovery trend signal based on the time variation between heartbeats.",
  },
  MEV: {
    key: "MEV",
    plainLabel: "Minimum Effective Volume",
    shortDefinition: "The lowest weekly training volume that appears to move progress for a muscle.",
  },
  MAV: {
    key: "MAV",
    plainLabel: "Best Growth Volume Range",
    shortDefinition: "The weekly volume range that usually produces the best growth signal before fatigue climbs too high.",
  },
  MRV: {
    key: "MRV",
    plainLabel: "Maximum Recoverable Volume",
    shortDefinition: "The upper weekly volume limit you can recover from before performance and joints trend down.",
  },
  "S:F": {
    key: "S:F",
    plainLabel: "Stimulus vs Fatigue",
    shortDefinition: "How much useful muscle stimulus an exercise gives compared with the fatigue it creates.",
  },
};

export function getSimpleLanguageTerm(key: string): SimpleLanguageTerm | null {
  return SIMPLE_LANGUAGE_TERMS[key.toUpperCase()] ?? null;
}

export function getSimpleLanguageLabel(key: string): string {
  return getSimpleLanguageTerm(key)?.plainLabel ?? key;
}
