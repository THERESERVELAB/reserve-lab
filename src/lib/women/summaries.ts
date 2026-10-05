/* ════════════════════════════════════════════════════════════════════════
   RESERVE WOMEN — PLAIN LINES FROM THE MEMBER'S OWN LOGS.

   Every line counts or averages what she logged, and says how many entries
   it came from. None interprets, none compares to a norm, none says what
   caused anything.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import {
  ENERGY_ORDER,
  STRESS_ORDER,
  TRAINING_FELT_LABEL,
  TRAINING_FELT_ORDER,
  average,
  mostLogged,
} from "./cycle";
import type { CycleFlow, CycleLogEntry, CycleSymptom } from "./types";

const SYMPTOM_WORDS: Record<CycleSymptom, string> = {
  cramps: "cramps",
  bloating: "bloating",
  headache: "headache",
  fatigue: "fatigue",
  "mood-shift": "mood shift",
  "breast-tenderness": "breast tenderness",
  "low-back": "low back",
  cravings: "cravings",
  "poor-sleep": "poor sleep",
  none: "none",
};

const FLOW_WORDS: Record<CycleFlow, string> = { spotting: "spotting", light: "light", medium: "medium", heavy: "heavy" };

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** The facts of one logged day, in the order she answered them. */
export function dayFacts(entry: CycleLogEntry): string[] {
  const facts: string[] = [];
  if (entry.isPeriodDay === true) facts.push(entry.flow ? `Period · ${FLOW_WORDS[entry.flow]}` : "Period day");
  if (entry.isPeriodDay === false) facts.push("Not a period day");
  if (entry.energy) facts.push(`Energy ${entry.energy}`);
  if (entry.stress) facts.push(`Stress ${entry.stress}`);
  if (entry.trainingPerformance) facts.push(`Training: ${TRAINING_FELT_LABEL[entry.trainingPerformance].toLowerCase()}`);
  const symptoms = entry.symptoms.filter((s) => s !== "none");
  if (symptoms.length > 0) facts.push(`Noted: ${symptoms.map((s) => SYMPTOM_WORDS[s]).join(", ")}`);
  return facts;
}

/** The symptom noted most often, with its count. Null when none were noted. */
export function mostNotedSymptom(entries: readonly CycleLogEntry[]): { label: string; count: number } | null {
  const counts = new Map<CycleSymptom, number>();
  for (const entry of entries) for (const s of entry.symptoms) if (s !== "none") counts.set(s, (counts.get(s) ?? 0) + 1);
  let best: { label: string; count: number } | null = null;
  for (const [symptom, count] of counts) if (!best || count > best.count) best = { label: SYMPTOM_WORDS[symptom], count };
  return best;
}

/** One phase's logged days: how many, and the answer given most. */
export function phaseDaysRead(entries: readonly CycleLogEntry[]): { primary: string; secondary?: string } {
  const energy = mostLogged(entries.map((e) => e.energy), ENERGY_ORDER);
  const felt = mostLogged(entries.map((e) => e.trainingPerformance), TRAINING_FELT_ORDER);
  const symptom = mostNotedSymptom(entries);
  const secondary = [
    felt ? `Training ${TRAINING_FELT_LABEL[felt.value].toLowerCase()} on ${felt.count} of ${felt.of}` : null,
    symptom ? `Most noted: ${symptom.label} (${symptom.count})` : null,
  ].filter(Boolean);
  return {
    primary: `${days(entries.length)} logged${energy ? ` · energy ${energy.value} on ${energy.count} of ${energy.of}` : ""}`,
    secondary: secondary.length ? secondary.join(" · ") : undefined,
  };
}

/** How training felt in one phase. */
export function trainingFeltRead(entries: readonly CycleLogEntry[]): { primary: string; secondary?: string } {
  const answered = entries.filter((e) => e.trainingPerformance);
  const parts = TRAINING_FELT_ORDER.map((v) => ({ v, n: answered.filter((e) => e.trainingPerformance === v).length }))
    .filter((p) => p.n > 0)
    .map((p) => `${TRAINING_FELT_LABEL[p.v].toLowerCase()} ${p.n}`);
  return { primary: `${days(answered.length)} answered`, secondary: parts.join(" · ") || undefined };
}

/** Sleep in one phase, from the Recovery room's own sleep log. */
export function sleepRead(logs: readonly { hours: number }[]): { primary: string; secondary?: string } {
  const avg = average(logs.map((l) => l.hours));
  return { primary: `${avg}h average`, secondary: `${logs.length} night${logs.length === 1 ? "" : "s"} logged` };
}

/** Energy and stress in one phase, from her cycle log. */
export function energyStressRead(entries: readonly CycleLogEntry[]): { primary: string; secondary?: string } {
  const energy = mostLogged(entries.map((e) => e.energy), ENERGY_ORDER);
  const stress = mostLogged(entries.map((e) => e.stress), STRESS_ORDER);
  const primary = [energy ? `Energy ${energy.value} on ${energy.count} of ${energy.of}` : null, stress ? `Stress ${stress.value} on ${stress.count} of ${stress.of}` : null]
    .filter(Boolean)
    .join(" · ");
  return { primary: primary || `${days(entries.length)} logged, no energy or stress answered` };
}

/** Meal days in one phase, and how often cravings were noted on her cycle log. */
export function mealDaysRead(mealDays: number, cycleEntries: readonly CycleLogEntry[]): { primary: string; secondary?: string } {
  const cravings = cycleEntries.filter((e) => e.symptoms.includes("cravings")).length;
  return {
    primary: `${days(mealDays)} with meals logged`,
    secondary: cycleEntries.length > 0 ? `Cravings noted on ${cravings} of ${days(cycleEntries.length)} logged` : undefined,
  };
}
