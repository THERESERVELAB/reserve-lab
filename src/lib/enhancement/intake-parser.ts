import {
  CompoundScheduleRule,
  EnhancementTimeOfDayPreference,
} from "@/lib/athlete-store";

export type IntakeParserResult = {
  vialTotalAmount?: number;
  vialTotalUnit?: "mg" | "mcg";
  reconstitutionVolumeMl?: number;
  syringeUnitsPerMl?: number;
  unitsPlannedPerLog?: number;
  scheduleRule?: CompoundScheduleRule;
  timeOfDayPreference?: EnhancementTimeOfDayPreference;
  timingPreference?: string;
  chips: string[];
  needsReview: string[];
};

const DAYS: Array<{ label: string; dow: number; tokens: string[] }> = [
  { label: "Sunday", dow: 0, tokens: ["sunday", "sundays", "sun"] },
  { label: "Monday", dow: 1, tokens: ["monday", "mondays", "mon"] },
  { label: "Tuesday", dow: 2, tokens: ["tuesday", "tuesdays", "tue", "tues"] },
  { label: "Wednesday", dow: 3, tokens: ["wednesday", "wednesdays", "wed"] },
  { label: "Thursday", dow: 4, tokens: ["thursday", "thursdays", "thu", "thurs"] },
  { label: "Friday", dow: 5, tokens: ["friday", "fridays", "fri"] },
  { label: "Saturday", dow: 6, tokens: ["saturday", "saturdays", "sat"] },
];

function word(text: string, token: string): boolean {
  return new RegExp(`\\b${token}\\b`, "i").test(text);
}

function numberMatch(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  if (!match?.[1]) return undefined;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

export function parseCompoundIntakeText(text: string): IntakeParserResult {
  const normalized = text.trim();
  const lower = normalized.toLowerCase();
  const needsReview: string[] = [];
  const chips: string[] = [];

  const vialMatch = lower.match(/(\d+(?:\.\d+)?)\s*(mg|mcg)\s*(?:vial|bottle|total)?/i);
  const vialTotalAmount = vialMatch?.[1] ? parseFloat(vialMatch[1]) : undefined;
  const vialTotalUnit = vialMatch?.[2] === "mcg" ? "mcg" : vialMatch?.[2] === "mg" ? "mg" : undefined;
  if (vialTotalAmount !== undefined && vialTotalUnit) chips.push(`Vial: ${vialTotalAmount} ${vialTotalUnit}`);

  const reconstitutionVolumeMl = numberMatch(lower, /(?:reconstituted|recon|mixed|diluted)\s*(?:with|in)?\s*(\d+(?:\.\d+)?)\s*ml/i)
    ?? numberMatch(lower, /(\d+(?:\.\d+)?)\s*ml\s*(?:reconstituted|recon|diluent|bacteriostatic|bac water|water)/i);
  if (reconstitutionVolumeMl !== undefined) chips.push(`Diluent: ${reconstitutionVolumeMl} mL`);

  const syringeUnitsPerMl = /u\s*-?\s*100|u100|100\s*units\s*=\s*1\s*ml/i.test(lower)
    ? 100
    : numberMatch(lower, /(\d+(?:\.\d+)?)\s*units\s*(?:per|\/)\s*ml/i);
  if (syringeUnitsPerMl !== undefined) chips.push(syringeUnitsPerMl === 100 ? "Syringe: U-100" : `Syringe: ${syringeUnitsPerMl} units/mL`);

  const unitsPlannedPerLog = numberMatch(lower, /(\d+(?:\.\d+)?)\s*(?:syringe\s*)?units?(?:\s*(?:per log|each|planned))?/i);
  if (unitsPlannedPerLog !== undefined) chips.push(`Units per log: ${unitsPlannedPerLog}`);

  const weekdays = DAYS.filter((day) => day.tokens.some((token) => word(lower, token))).map((day) => day.dow);
  const scheduleRule = weekdays.length > 0 ? { type: "specific_weekdays" as const, weekdays } : undefined;
  if (weekdays.length > 0) {
    const labels = DAYS.filter((day) => weekdays.includes(day.dow)).map((day) => day.label);
    chips.push(`Schedule: ${labels.join(" · ")}`);
  }

  let timeOfDayPreference: EnhancementTimeOfDayPreference | undefined;
  let timingPreference: string | undefined;
  if (/before\s+breakfast/i.test(lower)) {
    timeOfDayPreference = "morning";
    timingPreference = "Before breakfast";
    chips.push("Timing: Before breakfast");
  } else if (/\bmorning\b|breakfast/i.test(lower)) {
    timeOfDayPreference = "morning";
    timingPreference = "Morning";
    chips.push("Timing: Morning");
  } else if (/pre[-\s]?training|pre[-\s]?workout|before\s+(?:lift|training|workout)/i.test(lower)) {
    timeOfDayPreference = "pre_training";
    timingPreference = "Pre-training";
    chips.push("Timing: Pre-training");
  } else if (/bedtime|before\s+bed/i.test(lower)) {
    timeOfDayPreference = "bedtime";
    timingPreference = "Bedtime";
    chips.push("Timing: Bedtime");
  } else if (/\bevening\b|dinner/i.test(lower)) {
    timeOfDayPreference = "evening";
    timingPreference = "Evening";
    chips.push("Timing: Evening");
  }

  if (/or|maybe|about|around|not sure|unsure/i.test(lower)) {
    needsReview.push("Ambiguous wording found. Review extracted fields before applying.");
  }
  if (normalized.length > 0 && chips.length === 0) {
    needsReview.push("No explicit fields detected.");
  }

  return {
    vialTotalAmount,
    vialTotalUnit,
    reconstitutionVolumeMl,
    syringeUnitsPerMl,
    unitsPlannedPerLog,
    scheduleRule,
    timeOfDayPreference,
    timingPreference,
    chips,
    needsReview,
  };
}
