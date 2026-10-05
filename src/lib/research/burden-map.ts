/* ════════════════════════════════════════════════════════════════════════
   BURDEN MAP — each body system, the running compounds commonly associated
   with effects there, the cited evidence grade, and when the member last
   tested the markers watched for it.

   Compounds are listed alphabetically, never ranked. Burden links ship
   pending clinician review with the risk profiles.
   ════════════════════════════════════════════════════════════════════════ */

import { BURDENS, HEALTH_SYSTEM_LABEL, burdensForCompound, type BurdenKey, type HealthSystemKey } from "@/lib/compound-intelligence/burdens";
import { EVIDENCE_GRADE_LABEL, type EvidenceGrade } from "@/lib/compound-intelligence/evidence";
import type { CompoundIdentity } from "@/lib/compound-intelligence/risk-profiles";
import { daysBetween } from "@/lib/cycle/cycle-period";
import { SYSTEM_ORDER } from "@/lib/cycle-review/body-systems";
import { formatLabValue } from "@/lib/cycle-review/lab-trends";
import type { LabSafetyBrief, MarkerReading } from "@/lib/labs/lab-safety";
import { markerDef, type MarkerKey } from "@/lib/labs/markers";

export type BurdenMapCompoundInput = CompoundIdentity & { id: string; isActive: boolean; pausedAt?: string };

export type BurdenMapLoad = { burden: BurdenKey; label: string; grade: EvidenceGrade; gradeLabel: string };

export type BurdenMapCompound = { id: string; name: string; loads: BurdenMapLoad[] };

export type BurdenMapMarker = {
  key: MarkerKey;
  label: string;
  latest: { date: string; valueText: string; labFlag?: MarkerReading["labFlag"] } | null;
  /** Days since the latest result, or null when never tested. */
  ageDays: number | null;
};

export type BurdenMapRow = {
  system: HealthSystemKey;
  label: string;
  compounds: BurdenMapCompound[];
  markers: BurdenMapMarker[];
  /** Check-in signals watched for this system. */
  signals: string[];
};

const SIGNAL_LABEL: Record<(typeof BURDENS)[BurdenKey]["signals"][number], string> = {
  "blood-pressure": "Blood pressure",
  "resting-hr": "Resting heart rate",
  sleep: "Sleep",
  mood: "Mood",
  libido: "Libido",
  "check-in": "Weekly check-in symptoms",
};

export function buildBurdenMap(input: { compounds: BurdenMapCompoundInput[]; labBrief: LabSafetyBrief; today: string }): BurdenMapRow[] {
  const running = input.compounds.filter((compound) => compound.isActive && !compound.pausedAt);
  const burdensBySystem = new Map<HealthSystemKey, BurdenKey[]>();
  for (const def of Object.values(BURDENS)) burdensBySystem.set(def.system, [...(burdensBySystem.get(def.system) ?? []), def.key]);

  const rows = SYSTEM_ORDER.map((system): BurdenMapRow => {
    const systemBurdens = burdensBySystem.get(system) ?? [];

    const compounds = running
      .map((compound): BurdenMapCompound => ({
        id: compound.id,
        name: compound.name,
        loads: burdensForCompound(compound)
          .filter((load) => BURDENS[load.burden].system === system)
          .map((load) => ({ burden: load.burden, label: BURDENS[load.burden].label, grade: load.grade, gradeLabel: EVIDENCE_GRADE_LABEL[load.grade] })),
      }))
      .filter((compound) => compound.loads.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    const markerKeys = [...new Set(systemBurdens.flatMap((burden) => BURDENS[burden].markers))];
    const markers = markerKeys.map((key): BurdenMapMarker => {
      const reading = input.labBrief.history[key]?.[0];
      return {
        key,
        label: markerDef(key).label,
        latest: reading ? { date: reading.date, valueText: formatLabValue(reading.valueText, reading.unit), labFlag: reading.labFlag } : null,
        ageDays: reading ? daysBetween(reading.date, input.today) : null,
      };
    });

    const signals = [...new Set(systemBurdens.flatMap((burden) => BURDENS[burden].signals))].map((signal) => SIGNAL_LABEL[signal]);

    return { system, label: HEALTH_SYSTEM_LABEL[system], compounds, markers, signals };
  });

  return [...rows.filter((row) => row.compounds.length > 0), ...rows.filter((row) => row.compounds.length === 0)];
}
