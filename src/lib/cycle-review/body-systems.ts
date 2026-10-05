/* ════════════════════════════════════════════════════════════════════════
   BODY SYSTEMS — where monitoring stands, system by system.

   Each row answers one question: for the loads this plan puts on this
   system, is Reserve seeing current evidence, and has anything moved?

     Review with your clinician  a result outside the lab's range, a result
                                 the lab marked critical, or a symptom that
                                 needs care
     Trend worth reviewing       a related marker or check-in signal moved
     Monitoring due              evidence exists but is not current
     Evidence needed             the plan loads this system and nothing is
                                 logged
     Monitored                   current evidence, nothing moving
     No known load               nothing in the plan is known to load it

   No status is a verdict on health. High-severity styling is reserved for
   "Review with your clinician".
   ════════════════════════════════════════════════════════════════════════ */

import { BURDENS, HEALTH_SYSTEM_LABEL, burdensForCompound, type BurdenKey, type HealthSystemKey } from "@/lib/compound-intelligence/burdens";
import { daysBetween, isDateKey } from "@/lib/cycle/cycle-period";
import type { MarkerKey } from "@/lib/labs/markers";

import type { CheckInComparison } from "./check-in";
import type { MarkerTrend } from "./lab-trends";
import type { ReviewCompound } from "./complexity";
import { inSentence, listOr } from "./text";
import { CHECK_IN_SYMPTOMS, type CycleCheckIn } from "./types";

export type SystemStatus = "clinician-review" | "trend" | "monitoring-due" | "incomplete" | "monitored" | "no-load";

export const SYSTEM_STATUS_LABEL: Record<SystemStatus, string> = {
  "clinician-review": "Get this reviewed",
  trend: "Trend worth reviewing",
  "monitoring-due": "Monitoring due",
  incomplete: "Evidence needed",
  monitored: "Monitored",
  "no-load": "No known load",
};

export const SYSTEM_ORDER: HealthSystemKey[] = ["cardiovascular", "blood", "hormonal", "liver", "kidney", "glucose", "mood", "fertility", "prostate", "skin", "sleep"];

export type SystemRow = {
  system: HealthSystemKey;
  label: string;
  status: SystemStatus;
  detail: string;
  burdens: BurdenKey[];
  compoundNames: string[];
};

/** Lab evidence older than this is no longer current. */
export const LAB_CURRENT_DAYS = 90;
/** Check-in evidence older than this is no longer current. */
export const SIGNAL_CURRENT_DAYS = 10;

function formatDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
/** Every marker watched for a system, whether or not a compound loads it. */
const SYSTEM_MARKERS = new Map<HealthSystemKey, MarkerKey[]>();
for (const def of Object.values(BURDENS)) {
  SYSTEM_MARKERS.set(def.system, [...new Set([...(SYSTEM_MARKERS.get(def.system) ?? []), ...def.markers])]);
}

export function buildSystemRows(input: {
  compounds: ReviewCompound[];
  trends: MarkerTrend[];
  checkIns: CycleCheckIn[];
  comparison: CheckInComparison | null;
  sleepLogDates: string[];
  today: string;
}): SystemRow[] {
  const trendByKey = new Map(input.trends.map((t) => [t.key, t]));
  const latestCheckIn = [...input.checkIns].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const checkInAge = latestCheckIn ? daysBetween(latestCheckIn.date, input.today) : undefined;

  const loads = new Map<HealthSystemKey, { burdens: Set<BurdenKey>; names: Set<string> }>();
  for (const compound of input.compounds) {
    for (const { burden } of burdensForCompound(compound)) {
      const system = BURDENS[burden].system;
      const entry = loads.get(system) ?? { burdens: new Set(), names: new Set() };
      entry.burdens.add(burden);
      entry.names.add(compound.name);
      loads.set(system, entry);
    }
  }

  const movedSignal = (id: string) => input.comparison?.changes.find((c) => c.id === id && (c.bucket === "worth-watching" || c.bucket === "review"));

  return SYSTEM_ORDER.map((system): SystemRow => {
    const load = loads.get(system);
    const burdens = [...(load?.burdens ?? [])];
    const compoundNames = [...(load?.names ?? [])];
    const label = HEALTH_SYSTEM_LABEL[system];
    const base = { system, label, burdens, compoundNames };

    const markerKeys = [...new Set(burdens.flatMap((b) => BURDENS[b].markers))];
    const signals = [...new Set(burdens.flatMap((b) => BURDENS[b].signals))];
    const markers = markerKeys.map((k) => trendByKey.get(k)).filter((t): t is MarkerTrend => Boolean(t));
    const withData = markers.filter((t) => t.current);

    /* Symptoms from the newest check-in that belong to this system */
    const systemSymptoms = (latestCheckIn?.symptoms ?? []).filter((s) => {
      const def = CHECK_IN_SYMPTOMS[s];
      return def.burden && BURDENS[def.burden].system === system;
    });

    if (!load) {
      /* No compound loads this system, but the member's own results still speak. */
      const own = (SYSTEM_MARKERS.get(system) ?? []).map((k) => trendByKey.get(k)).filter((t): t is MarkerTrend => Boolean(t?.current));
      const ownReview = own.filter((t) => t.status === "clinician-review" || t.status === "outside-range");
      if (ownReview.length > 0) {
        return { ...base, status: "clinician-review", detail: ownReview.map((t) => `${t.label}: ${t.reason}`).join(" ") };
      }
      const ownMoving = own.filter((t) => t.status === "trend" || t.status === "changed");
      if (ownMoving.length > 0) {
        return { ...base, status: "trend", detail: ownMoving.map((t) => `${t.label}: ${t.reason}`).join(" ") };
      }
      return { ...base, status: "no-load", detail: "Nothing in this plan is known to load this system." };
    }

    const review = markers.filter((t) => t.status === "clinician-review" || t.status === "outside-range");
    if (review.length > 0) {
      return { ...base, status: "clinician-review", detail: `${review.map((t) => `${t.label}: ${t.reason}`).join(" ")}` };
    }
    const signalReview = signals.includes("blood-pressure") ? input.comparison?.changes.find((c) => c.id === "blood-pressure" && c.bucket === "review") : undefined;
    if (signalReview) return { ...base, status: "clinician-review", detail: signalReview.text };

    const moving = markers.filter((t) => t.status === "trend" || t.status === "changed");
    const signalMoves = [
      signals.includes("blood-pressure") ? movedSignal("blood-pressure") : undefined,
      signals.includes("resting-hr") ? movedSignal("resting-hr") : undefined,
      signals.includes("sleep") ? movedSignal("sleep-hours") ?? movedSignal("sleepQuality") : undefined,
      signals.includes("mood") ? movedSignal("mood") : undefined,
      signals.includes("libido") ? movedSignal("libido") : undefined,
    ].filter((c): c is NonNullable<typeof c> => Boolean(c));
    if (moving.length > 0 || signalMoves.length > 0 || systemSymptoms.length > 0) {
      const parts = [
        ...moving.map((t) => `${t.label}: ${t.reason}`),
        ...signalMoves.map((c) => c.text),
        ...(systemSymptoms.length ? [`Check-in: ${systemSymptoms.map((s) => CHECK_IN_SYMPTOMS[s].label.toLowerCase()).join(", ")}.`] : []),
      ];
      return { ...base, status: "trend", detail: parts.join(" ") };
    }

    /* Freshness */
    const labDates = withData.map((t) => t.current!.date).sort();
    const latestLab = labDates.at(-1);
    const labCurrent = latestLab ? daysBetween(latestLab, input.today) <= LAB_CURRENT_DAYS : false;
    const sleepCurrent = input.sleepLogDates.some((d) => isDateKey(d.slice(0, 10)) && daysBetween(d.slice(0, 10), input.today) <= SIGNAL_CURRENT_DAYS);
    const signalCurrent = checkInAge !== undefined && checkInAge <= SIGNAL_CURRENT_DAYS;
    const needsLabs = markerKeys.length > 0;
    const needsSignals = signals.length > 0;
    const signalsOk = !needsSignals || signalCurrent || (signals.every((s) => s === "sleep") && sleepCurrent);

    if ((needsLabs && !latestLab) && (!needsSignals || (!latestCheckIn && !sleepCurrent))) {
      const labels = markerKeys.slice(0, 3).map((k) => inSentence(trendByKey.get(k)?.label ?? k));
      return { ...base, status: "incomplete", detail: `No ${listOr(labels)} result logged yet.` };
    }
    if (!needsLabs && needsSignals && !latestCheckIn && !sleepCurrent) {
      return { ...base, status: "incomplete", detail: "No weekly check-in logged yet." };
    }
    if ((needsLabs && !labCurrent) || !signalsOk) {
      const parts: string[] = [];
      if (needsLabs && latestLab && !labCurrent) parts.push(`Latest related lab ${formatDate(latestLab)}.`);
      if (needsLabs && !latestLab) parts.push("No related lab logged.");
      if (!signalsOk) parts.push(latestCheckIn ? `Last check-in ${formatDate(latestCheckIn.date)}.` : "No weekly check-in logged.");
      return { ...base, status: "monitoring-due", detail: parts.join(" ") };
    }

    const parts: string[] = [];
    if (latestLab) parts.push(`Latest related lab ${formatDate(latestLab)}.`);
    if (needsSignals && latestCheckIn) parts.push(`Last check-in ${formatDate(latestCheckIn.date)}.`);
    return { ...base, status: "monitored", detail: parts.join(" ") || "Evidence is current." };
  });
}
