import { EnhancementEntry } from "@/lib/athlete-store";

export const CALCULATION_ONLY_COPY = "Calculation only from member-entered values. Not dosing guidance.";

export type ReconstitutionUnit = "mg" | "mcg";

export type ReconstitutionInput = {
  vialTotalAmount?: number;
  unit?: ReconstitutionUnit;
  reconstitutionVolumeMl?: number;
  unitsPerMl?: number;
  unitsPlannedPerLog?: number;
  amountPerLogOverrideMg?: number;
  vialCount?: number;
  startingRemainingAmountMg?: number;
  reorderLeadDays?: number;
  logsPerWeek?: number;
  today?: Date;
};

export type ReconstitutionResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  vialTotalMg: number | null;
  concentrationMgPerMl: number | null;
  mlPerUnit: number | null;
  mlPerLog: number | null;
  mgPerLog: number | null;
  mcgPerLog: number | null;
  logsPerVial: number | null;
  estimatedLogsRemaining: number | null;
  estimatedRunoutDate: Date | null;
  reorderDate: Date | null;
  formulaPreview: string;
};

function positiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

export function computeReconstitution(input: ReconstitutionInput): ReconstitutionResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const vialAmount = positiveNumber(input.vialTotalAmount);
  const reconstitutionVolumeMl = positiveNumber(input.reconstitutionVolumeMl);
  const unitsPerMl = positiveNumber(input.unitsPerMl);
  const unitsPlannedPerLog = positiveNumber(input.unitsPlannedPerLog);

  if (vialAmount === null) errors.push("Needs vial amount.");
  if (reconstitutionVolumeMl === null) errors.push("Needs reconstitution volume.");
  if (unitsPerMl === null) errors.push("Needs syringe units.");
  if (unitsPlannedPerLog === null) errors.push("Needs units per log.");

  const vialTotalMg = vialAmount !== null ? (input.unit === "mcg" ? vialAmount / 1000 : vialAmount) : null;
  const concentrationMgPerMl = vialTotalMg !== null && reconstitutionVolumeMl !== null
    ? vialTotalMg / reconstitutionVolumeMl
    : null;
  const mlPerUnit = unitsPerMl !== null ? 1 / unitsPerMl : null;
  const mlPerLog = unitsPerMl !== null && unitsPlannedPerLog !== null ? unitsPlannedPerLog / unitsPerMl : null;
  const calculatedMgPerLog = concentrationMgPerMl !== null && mlPerLog !== null
    ? concentrationMgPerMl * mlPerLog
    : null;
  const override = positiveNumber(input.amountPerLogOverrideMg);
  const mgPerLog = override ?? calculatedMgPerLog;
  const mcgPerLog = mgPerLog !== null ? mgPerLog * 1000 : null;
  const logsPerVial = vialTotalMg !== null && mgPerLog !== null ? vialTotalMg / mgPerLog : null;

  if (vialTotalMg !== null && mgPerLog !== null && mgPerLog > vialTotalMg) {
    errors.push("Impossible input: calculated amount per log exceeds vial total.");
  }
  if (concentrationMgPerMl !== null && (concentrationMgPerMl > 250 || concentrationMgPerMl < 0.01)) {
    warnings.push("Check entered values.");
  }

  const vialCount = positiveNumber(input.vialCount) ?? 1;
  const remainingMg = positiveNumber(input.startingRemainingAmountMg) ?? (vialTotalMg !== null ? vialTotalMg * vialCount : null);
  const estimatedLogsRemaining = remainingMg !== null && mgPerLog !== null ? remainingMg / mgPerLog : null;

  let estimatedRunoutDate: Date | null = null;
  const logsPerWeek = positiveNumber(input.logsPerWeek);
  if (estimatedLogsRemaining !== null && logsPerWeek !== null) {
    estimatedRunoutDate = addDays(input.today ?? new Date(), (estimatedLogsRemaining / logsPerWeek) * 7);
  }
  const reorderDate = estimatedRunoutDate && input.reorderLeadDays && input.reorderLeadDays > 0
    ? addDays(estimatedRunoutDate, -input.reorderLeadDays)
    : null;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    vialTotalMg,
    concentrationMgPerMl,
    mlPerUnit,
    mlPerLog,
    mgPerLog,
    mcgPerLog,
    logsPerVial,
    estimatedLogsRemaining,
    estimatedRunoutDate,
    reorderDate,
    formulaPreview: "vial mg / mL = concentration; units / units-per-mL = mL per log; concentration x mL per log = amount per log.",
  };
}

export function reconstitutionInputFromEntry(entry: EnhancementEntry): ReconstitutionInput {
  return {
    vialTotalAmount: entry.vialTotalAmount,
    unit: entry.vialTotalUnit,
    reconstitutionVolumeMl: entry.reconstitutionVolumeMl ?? entry.vialVolumeMl,
    unitsPerMl: entry.syringeUnitsPerMl,
    unitsPlannedPerLog: entry.unitsPlannedPerLog,
    amountPerLogOverrideMg: entry.amountSource === "manual" ? entry.amountPerLogMg : undefined,
    vialCount: entry.vialCount,
    startingRemainingAmountMg: entry.remainingQuantityMg ?? entry.totalQuantityMg,
    reorderLeadDays: entry.reorderLeadDays,
  };
}
