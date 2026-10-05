/* ════════════════════════════════════════════════════════════════════════
   DOSE MATH ENGINE
   ------------------------------------------------------------------------
   Pure arithmetic on member/provider-entered values only. This module does
   NOT recommend doses, prescribe, optimize cycles, or assert that any dose is
   safe. Every result carries the disclaimer below.
   ════════════════════════════════════════════════════════════════════════ */

export const DOSE_SAFETY_NOTE = "Calculation only from member-entered values. Not dosing guidance.";

export type AmountUnit = "mg" | "mcg" | "iu";

export type DoseFormType =
  | "injectable_vial"     // reconstituted peptide vial, dosed in syringe units
  | "injectable_ml_marked" // mL-marked syringe (e.g. testosterone 200 mg/mL)
  | "tablet"
  | "capsule"
  | "liquid_oral"
  | "manual";

export type DoseCalculationMode =
  | "units_to_amount"
  | "amount_to_units"
  | "ml_to_amount"
  | "amount_to_ml"
  | "unit_count_to_amount" // tablets/capsules
  | "liquid_ml_to_amount"
  | "manual";

export type DoseMathInput = {
  formType: DoseFormType;
  mode: DoseCalculationMode;
  // Reconstituted vial
  vialTotalAmount?: number;
  vialTotalUnit?: AmountUnit;
  reconstitutionVolumeMl?: number;
  syringeUnitsPerMl?: number; // U-100 → 100, U-50 → 50
  plannedUnitsPerLog?: number;
  targetAmountPerLog?: number;
  targetAmountUnit?: AmountUnit;
  // mL-marked / liquid oral
  concentrationMgPerMl?: number;
  plannedMlPerLog?: number;
  // tablets / capsules
  amountPerUnit?: number;
  amountPerUnitUnit?: AmountUnit;
  quantityPerLog?: number;
};

export type DoseMathResult = {
  ok: boolean;
  /** Headline equivalence, e.g. "10 units = 0.5 mg". */
  primaryLine: string;
  /** Supporting numbers for the UI. */
  detail: string[];
  /** Canonical calculated amount (when applicable) for storing on the log. */
  calculatedAmount?: number;
  calculatedAmountUnit?: AmountUnit;
  calculatedUnitsEquivalent?: number;
  calculatedMlEquivalent?: number;
  concentrationAmountPerMl?: number;
  error?: string;
  safetyNote: string;
};

const fail = (error: string): DoseMathResult => ({ ok: false, primaryLine: "—", detail: [], error, safetyNote: DOSE_SAFETY_NOTE });

function valid(...vals: Array<number | undefined>): boolean {
  return vals.every((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function unitLabel(u: AmountUnit): string { return u === "iu" ? "IU" : u; }

/* ─── Concentration of a reconstituted vial (amount per mL, in vial unit) ── */
export function reconstitutedConcentration(input: DoseMathInput): number | null {
  if (!valid(input.vialTotalAmount, input.reconstitutionVolumeMl)) return null;
  return input.vialTotalAmount! / input.reconstitutionVolumeMl!;
}

/* ════════════════════════════════════════════════════════════════════════
   CALCULATE
   ════════════════════════════════════════════════════════════════════════ */

export function calculateDose(input: DoseMathInput): DoseMathResult {
  switch (input.mode) {

    // ── Injectable vial: syringe units → amount ──
    case "units_to_amount": {
      if (!valid(input.vialTotalAmount, input.reconstitutionVolumeMl, input.syringeUnitsPerMl, input.plannedUnitsPerLog)) {
        return fail("Check entered values — vial amount, reconstitution volume, syringe units/mL, and units per log are required.");
      }
      const unit = input.vialTotalUnit ?? "mg";
      const concentration = input.vialTotalAmount! / input.reconstitutionVolumeMl!; // amount per mL
      const mlPerLog = input.plannedUnitsPerLog! / input.syringeUnitsPerMl!;
      const amount = mlPerLog * concentration;
      if (amount > input.vialTotalAmount!) {
        return fail("Calculated amount per log exceeds the vial total. Check entered values.");
      }
      const logsPerVial = Math.floor(input.vialTotalAmount! / amount);
      return {
        ok: true,
        primaryLine: `${fmt(input.plannedUnitsPerLog!)} units = ${fmt(amount)} ${unitLabel(unit)}`,
        detail: [
          `Concentration · ${fmt(concentration)} ${unitLabel(unit)}/mL`,
          `Volume per log · ${fmt(mlPerLog)} mL`,
          `Logs per vial · ~${logsPerVial}`,
        ],
        calculatedAmount: amount,
        calculatedAmountUnit: unit,
        calculatedMlEquivalent: mlPerLog,
        calculatedUnitsEquivalent: input.plannedUnitsPerLog,
        concentrationAmountPerMl: concentration,
        safetyNote: DOSE_SAFETY_NOTE,
      };
    }

    // ── Injectable vial: target amount → syringe units ──
    case "amount_to_units": {
      if (!valid(input.vialTotalAmount, input.reconstitutionVolumeMl, input.syringeUnitsPerMl, input.targetAmountPerLog)) {
        return fail("Check entered values — vial amount, reconstitution volume, syringe units/mL, and target amount are required.");
      }
      const unit = input.targetAmountUnit ?? input.vialTotalUnit ?? "mg";
      const concentration = input.vialTotalAmount! / input.reconstitutionVolumeMl!;
      const mlPerLog = input.targetAmountPerLog! / concentration;
      const units = mlPerLog * input.syringeUnitsPerMl!;
      if (input.targetAmountPerLog! > input.vialTotalAmount!) {
        return fail("Target amount exceeds the vial total. Check entered values.");
      }
      return {
        ok: true,
        primaryLine: `${fmt(input.targetAmountPerLog!)} ${unitLabel(unit)} = ${fmt(units)} units`,
        detail: [
          `Concentration · ${fmt(concentration)} ${unitLabel(unit)}/mL`,
          `Volume per log · ${fmt(mlPerLog)} mL`,
        ],
        calculatedAmount: input.targetAmountPerLog,
        calculatedAmountUnit: unit,
        calculatedUnitsEquivalent: units,
        calculatedMlEquivalent: mlPerLog,
        concentrationAmountPerMl: concentration,
        safetyNote: DOSE_SAFETY_NOTE,
      };
    }

    // ── mL-marked syringe: mL → amount ──
    case "ml_to_amount": {
      if (!valid(input.concentrationMgPerMl, input.plannedMlPerLog)) {
        return fail("Check entered values — concentration (mg/mL) and mL per log are required.");
      }
      const amount = input.concentrationMgPerMl! * input.plannedMlPerLog!;
      return {
        ok: true,
        primaryLine: `${fmt(input.plannedMlPerLog!)} mL = ${fmt(amount)} mg`,
        detail: [`Concentration · ${fmt(input.concentrationMgPerMl!)} mg/mL`],
        calculatedAmount: amount,
        calculatedAmountUnit: "mg",
        calculatedMlEquivalent: input.plannedMlPerLog,
        concentrationAmountPerMl: input.concentrationMgPerMl,
        safetyNote: DOSE_SAFETY_NOTE,
      };
    }

    // ── mL-marked syringe: amount → mL ──
    case "amount_to_ml": {
      if (!valid(input.concentrationMgPerMl, input.targetAmountPerLog)) {
        return fail("Check entered values — concentration (mg/mL) and target mg are required.");
      }
      const ml = input.targetAmountPerLog! / input.concentrationMgPerMl!;
      return {
        ok: true,
        primaryLine: `${fmt(input.targetAmountPerLog!)} mg = ${fmt(ml)} mL`,
        detail: [`Concentration · ${fmt(input.concentrationMgPerMl!)} mg/mL`],
        calculatedAmount: input.targetAmountPerLog,
        calculatedAmountUnit: "mg",
        calculatedMlEquivalent: ml,
        concentrationAmountPerMl: input.concentrationMgPerMl,
        safetyNote: DOSE_SAFETY_NOTE,
      };
    }

    // ── Tablets / capsules: count → total amount ──
    case "unit_count_to_amount": {
      if (!valid(input.amountPerUnit, input.quantityPerLog)) {
        return fail("Check entered values — amount per tablet/capsule and quantity per log are required.");
      }
      const unit = input.amountPerUnitUnit ?? "mg";
      const total = input.amountPerUnit! * input.quantityPerLog!;
      const noun = input.formType === "capsule" ? "capsule" : "tablet";
      return {
        ok: true,
        primaryLine: `${fmt(input.quantityPerLog!)} ${noun}${input.quantityPerLog === 1 ? "" : "s"} = ${fmt(total)} ${unitLabel(unit)} total`,
        detail: [`Per ${noun} · ${fmt(input.amountPerUnit!)} ${unitLabel(unit)}`],
        calculatedAmount: total,
        calculatedAmountUnit: unit,
        safetyNote: DOSE_SAFETY_NOTE,
      };
    }

    // ── Liquid oral: mL → total amount ──
    case "liquid_ml_to_amount": {
      if (!valid(input.concentrationMgPerMl, input.plannedMlPerLog)) {
        return fail("Check entered values — concentration per mL and mL per log are required.");
      }
      const total = input.concentrationMgPerMl! * input.plannedMlPerLog!;
      return {
        ok: true,
        primaryLine: `${fmt(input.plannedMlPerLog!)} mL = ${fmt(total)} mg total`,
        detail: [`Concentration · ${fmt(input.concentrationMgPerMl!)} mg/mL`],
        calculatedAmount: total,
        calculatedAmountUnit: "mg",
        calculatedMlEquivalent: input.plannedMlPerLog,
        concentrationAmountPerMl: input.concentrationMgPerMl,
        safetyNote: DOSE_SAFETY_NOTE,
      };
    }

    case "manual":
    default:
      return { ok: true, primaryLine: "Manual entry", detail: ["No calculation — amount tracked as entered."], safetyNote: DOSE_SAFETY_NOTE };
  }
}

/* ─── Form → default calculation modes ───────────── */
export const MODES_FOR_FORM: Record<DoseFormType, DoseCalculationMode[]> = {
  injectable_vial: ["units_to_amount", "amount_to_units"],
  injectable_ml_marked: ["ml_to_amount", "amount_to_ml"],
  tablet: ["unit_count_to_amount"],
  capsule: ["unit_count_to_amount"],
  liquid_oral: ["liquid_ml_to_amount"],
  manual: ["manual"],
};

export const FORM_LABELS: Record<DoseFormType, string> = {
  injectable_vial: "Injectable vial (reconstituted)",
  injectable_ml_marked: "mL-marked injectable",
  tablet: "Tablet",
  capsule: "Capsule",
  liquid_oral: "Liquid oral",
  manual: "Manual tracking",
};

export const MODE_LABELS: Record<DoseCalculationMode, string> = {
  units_to_amount: "Units → amount",
  amount_to_units: "Amount → units",
  ml_to_amount: "mL → amount",
  amount_to_ml: "Amount → mL",
  unit_count_to_amount: "Count → total amount",
  liquid_ml_to_amount: "mL → total amount",
  manual: "Manual",
};

/** Common syringe presets (units per mL). */
export const SYRINGE_PRESETS: Array<{ label: string; unitsPerMl: number }> = [
  { label: "U-100", unitsPerMl: 100 },
  { label: "U-50", unitsPerMl: 50 },
  { label: "U-40", unitsPerMl: 40 },
];
