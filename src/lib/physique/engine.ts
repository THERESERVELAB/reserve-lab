/* ────────────────────────────────────────────────────────────────────────────
   PHYSIQUE COMMAND V2 — GUIDANCE ENGINE

   Deterministic, safe physique guidance from logged data. No exact body-fat
   claims from photos, no medical claims, no guaranteed results. Language stays
   in: visual trend, progress signal, measurement trend, based on logged data,
   data limited, confidence limited.
   ──────────────────────────────────────────────────────────────────────── */

import {
  MEASUREMENT_SITES,
  PHYSIQUE_GOAL_LABELS,
  WEAK_POINTS,
  type MeasurementSite,
  type PhotoCheckIn,
  type PhotoQualityChecklistItem,
  type PhysiqueCommandState,
  type PhysiqueEntry,
} from "./types";
import { localDateKey } from "@/lib/dates/local-day";

export type TrendDirection = "down" | "stable" | "up" | "data-limited";
export type PhysiqueMomentum = "improving" | "holding" | "needs-data" | "stalling";
export type ConfidenceLevel = "high" | "moderate" | "limited";

function daysBetween(aISO: string, bISO: string): number {
  return Math.round((new Date(bISO).getTime() - new Date(aISO).getTime()) / 86_400_000);
}

function sortedByDate(entries: PhysiqueEntry[]): PhysiqueEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

export function latestEntry(state: PhysiqueCommandState): PhysiqueEntry | null {
  const s = sortedByDate(state.entries);
  return s.length ? s[s.length - 1] : null;
}

/* ─── Logged record — only what the member entered ─────────────────────── */

export type MeasurementTrendRow = {
  site: MeasurementSite;
  label: string;
  firstDate: string;
  firstIn: number;
  latestDate: string;
  latestIn: number;
  deltaIn: number;
  /** How many dated check-ins recorded this site. */
  entries: number;
};

/**
 * First → latest change for every site the member measured on at least two
 * dated check-ins. Sites with fewer entries are left out; nothing is estimated.
 */
export function measurementTrends(state: PhysiqueCommandState): MeasurementTrendRow[] {
  const sorted = sortedByDate(state.entries);
  return MEASUREMENT_SITES.flatMap(({ id, label }) => {
    const logged = sorted.filter((entry) => typeof entry.measurements[id] === "number");
    if (logged.length < 2) return [];
    const first = logged[0];
    const latest = logged[logged.length - 1];
    const firstIn = first.measurements[id] as number;
    const latestIn = latest.measurements[id] as number;
    return [{
      site: id,
      label,
      firstDate: first.date,
      firstIn,
      latestDate: latest.date,
      latestIn,
      deltaIn: Number((latestIn - firstIn).toFixed(1)),
      entries: logged.length,
    }];
  });
}

/** Photo check-ins as dated entries, newest first. Photos are never analyzed or scored. */
export function photoCheckInLog(state: PhysiqueCommandState): PhotoCheckIn[] {
  return [...state.photoCheckIns].sort((a, b) => b.date.localeCompare(a.date));
}

export function baselineEntry(state: PhysiqueCommandState): PhysiqueEntry | null {
  const s = sortedByDate(state.entries);
  return s.length ? s[0] : null;
}

function trendOf(delta: number, downIsGood: boolean, threshold = 0.3): TrendDirection {
  if (Math.abs(delta) < threshold) return "stable";
  const improving = downIsGood ? delta < 0 : delta > 0;
  return improving ? (downIsGood ? "down" : "up") : (downIsGood ? "up" : "down");
}

export type PhysiqueGuidance = {
  hasData: boolean;
  entryCount: number;
  momentum: PhysiqueMomentum;
  momentumColor: string;
  weightTrend: TrendDirection;
  weightDeltaLb: number;
  waistTrend: TrendDirection;
  waistDeltaIn: number;
  measurementTrendLabel: string;
  /** 0–100 average of the latest check-in's adherence, or null when that check-in has none. */
  adherenceSignal: number | null;
  weakPointSignal: string;
  visualTrendLabel: string;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  observations: string[];
  nextAction: { label: string; reason: string; tone: "primary" | "support" | "complete" };
  daysSinceLastCheckIn: number | null;
  daysUntilNextCheckIn: number | null;
};

const MOMENTUM_COLOR: Record<PhysiqueMomentum, string> = {
  improving: "#6ee7b7",
  holding: "#d5b15f",
  "needs-data": "#8ea0b8",
  stalling: "#e8c87a",
};

export function buildPhysiqueGuidance(state: PhysiqueCommandState, now: Date = new Date()): PhysiqueGuidance {
  const today = localDateKey(now);
  const base = baselineEntry(state);
  const latest = latestEntry(state);
  const entryCount = state.entries.length;
  const hasData = entryCount > 0;

  const daysSinceLastCheckIn = latest ? daysBetween(latest.date, today) : null;
  const daysUntilNextCheckIn = daysSinceLastCheckIn !== null ? Math.max(0, state.checkInIntervalDays - daysSinceLastCheckIn) : null;

  // Trends (baseline → latest)
  let weightDeltaLb = 0;
  let waistDeltaIn = 0;
  let weightTrend: TrendDirection = "data-limited";
  let waistTrend: TrendDirection = "data-limited";
  if (base && latest && base.id !== latest.id) {
    weightDeltaLb = Number((latest.bodyWeightLb - base.bodyWeightLb).toFixed(1));
    weightTrend = trendOf(weightDeltaLb, false, 0.6) === "up" ? "up" : weightDeltaLb < -0.6 ? "down" : "stable";
    const bw = base.measurements.waist;
    const lw = latest.measurements.waist;
    if (typeof bw === "number" && typeof lw === "number") {
      waistDeltaIn = Number((lw - bw).toFixed(1));
      waistTrend = waistDeltaIn < -0.3 ? "down" : waistDeltaIn > 0.3 ? "up" : "stable";
    }
  }

  // Adherence signal (latest entry)
  const adh = latest?.adherence;
  const adherenceSignal = adh
    ? Math.round((adh.training + adh.nutrition + adh.hydration + adh.recovery) / 4)
    : null;

  // Momentum
  let momentum: PhysiqueMomentum;
  if (!hasData || entryCount < 2) momentum = "needs-data";
  else if (waistTrend === "down" && (weightTrend === "stable" || weightTrend === "down")) momentum = "improving";
  else if (weightTrend === "stable" && waistTrend === "stable") momentum = adherenceSignal !== null && adherenceSignal >= 80 ? "holding" : "stalling";
  else momentum = "holding";

  // Weak point signal
  const wp = state.weakPoints[0];
  let weakPointSignal = "No weak point focus selected.";
  if (wp) {
    const def = WEAK_POINTS.find((w) => w.id === wp);
    const site = def?.measurement;
    if (site && base && latest && typeof base.measurements[site] === "number" && typeof latest.measurements[site] === "number") {
      const d = Number((latest.measurements[site]! - base.measurements[site]!).toFixed(1));
      weakPointSignal = `${def?.label}: linked measurement ${d >= 0 ? "+" : ""}${d} in since baseline. Keep priority active and reassess after the next check-in.`;
    } else {
      weakPointSignal = `${def?.label ?? "Weak point"} priority active. Add the linked measurement for a stronger signal.`;
    }
  }

  // Visual trend (from photo consistency + frequency)
  const photo = [...state.photoCheckIns].sort((a, b) => a.date.localeCompare(b.date)).pop();
  let visualTrendLabel = "No photo check-ins yet.";
  if (photo) {
    visualTrendLabel = photo.consistencyScore >= 70
      ? "Photo consistency is solid — visual comparison is meaningful."
      : "Visual comparison confidence is limited until lighting and pose consistency improve.";
  }

  // Confidence
  let confidence: ConfidenceLevel = "limited";
  let confidenceReason = "Add more check-ins for stronger guidance.";
  const photoConsistent = photo ? photo.consistencyScore >= 70 : false;
  if (entryCount >= 3 && photoConsistent) {
    confidence = "high";
    confidenceReason = "Multiple check-ins logged with consistent photos.";
  } else if (entryCount >= 2) {
    confidence = "moderate";
    confidenceReason = photoConsistent ? "Check-ins logged; keep the cadence consistent." : "Check-ins logged; photo consistency would raise confidence.";
  }

  // Observations (careful language)
  const observations: string[] = [];
  if (momentum === "improving") observations.push("Waist is trending down while bodyweight is stable. This may indicate a positive recomp signal based on logged data.");
  if (weightTrend === "stable" && waistTrend === "stable" && entryCount >= 2) observations.push("Weight and waist are holding. Adherence is the main lever to move the next signal.");
  if (!photoConsistent && photo) observations.push("Photo comparison confidence is limited because lighting and pose consistency are not yet stable.");
  if (entryCount < 2) observations.push("Reserve needs at least two check-ins before progress trends become useful.");
  if (observations.length === 0) observations.push("Trends look steady. Keep logging consistent check-ins to sharpen the signal.");

  // Next best action — one
  let nextAction: PhysiqueGuidance["nextAction"];
  if (!hasData) {
    nextAction = { label: "Add Baseline Check-In", reason: "Set your starting point to begin tracking visual progress.", tone: "primary" };
  } else if (state.weakPoints.length === 0) {
    nextAction = { label: "Select Weak Point Focus", reason: "Direct tracking toward the area you want to prioritize.", tone: "primary" };
  } else if (daysUntilNextCheckIn !== null && daysUntilNextCheckIn <= 0) {
    nextAction = { label: "Complete Weekly Check-In", reason: "Your next check-in is due — keep the cadence to protect the trend.", tone: "primary" };
  } else if (!photoConsistent) {
    nextAction = { label: "Improve Photo Consistency", reason: "Consistent lighting and pose raise comparison confidence.", tone: "support" };
  } else if (entryCount < 3) {
    nextAction = { label: "Continue Current Block", reason: "Keep the plan steady for one more check-in before adjusting.", tone: "complete" };
  } else {
    nextAction = { label: "Review Comparison", reason: "Enough data to compare windows and confirm the trend.", tone: "complete" };
  }

  const measurementTrendLabel = waistTrend === "down" ? "Waist trending down" : waistTrend === "up" ? "Waist trending up" : waistTrend === "stable" ? "Measurements stable" : "Data limited";

  return {
    hasData,
    entryCount,
    momentum,
    momentumColor: MOMENTUM_COLOR[momentum],
    weightTrend,
    weightDeltaLb,
    waistTrend,
    waistDeltaIn,
    measurementTrendLabel,
    adherenceSignal,
    weakPointSignal,
    visualTrendLabel,
    confidence,
    confidenceReason,
    observations,
    nextAction,
    daysSinceLastCheckIn,
    daysUntilNextCheckIn,
  };
}

/* ─── Comparison ────────────────────────────────────────────────────────── */

export type ComparisonSnapshot = {
  fromDate: string;
  toDate: string;
  weightDeltaLb: number;
  waistDeltaIn: number;
  measurementDeltas: { label: string; delta: number }[];
  adherence?: { training: number; nutrition: number; recovery: number };
  guidance: string;
};

export function buildComparison(from: PhysiqueEntry, to: PhysiqueEntry): ComparisonSnapshot {
  const weightDeltaLb = Number((to.bodyWeightLb - from.bodyWeightLb).toFixed(1));
  const waistDeltaIn = from.measurements.waist != null && to.measurements.waist != null
    ? Number((to.measurements.waist - from.measurements.waist).toFixed(1))
    : 0;
  const measurementDeltas: { label: string; delta: number }[] = [];
  (Object.keys(to.measurements) as (keyof typeof to.measurements)[]).forEach((site) => {
    const a = from.measurements[site];
    const b = to.measurements[site];
    if (typeof a === "number" && typeof b === "number") {
      measurementDeltas.push({ label: String(site), delta: Number((b - a).toFixed(1)) });
    }
  });

  let guidance = "Keep logging consistent check-ins to confirm the direction.";
  if (waistDeltaIn < -0.3 && weightDeltaLb <= 0.5) guidance = "Strong early progress signal. Recovery and adherence are the levers to keep it going.";
  else if (waistDeltaIn > 0.3 && weightDeltaLb > 0.5) guidance = "Both weight and waist rose — review nutrition adherence against your goal.";
  else if (Math.abs(waistDeltaIn) <= 0.3 && Math.abs(weightDeltaLb) <= 0.5) guidance = "Holding steady. Adherence is the next lever to move the trend.";

  return {
    fromDate: from.date,
    toDate: to.date,
    weightDeltaLb,
    waistDeltaIn,
    measurementDeltas,
    adherence: to.adherence ? { training: to.adherence.training, nutrition: to.adherence.nutrition, recovery: to.adherence.recovery } : undefined,
    guidance,
  };
}

/* ─── Photo consistency ─────────────────────────────────────────────────── */

export function photoConsistencyScore(checked: PhotoQualityChecklistItem[], total: number): { score: number; label: "Strong" | "Moderate" | "Limited" } {
  const score = total > 0 ? Math.round((checked.length / total) * 100) : 0;
  const label = score >= 75 ? "Strong" : score >= 45 ? "Moderate" : "Limited";
  return { score, label };
}

export function goalLabel(state: PhysiqueCommandState): string {
  return PHYSIQUE_GOAL_LABELS[state.goal];
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function latestPhotoCheckIn(state: PhysiqueCommandState): PhotoCheckIn | null {
  const s = [...state.photoCheckIns].sort((a, b) => a.date.localeCompare(b.date));
  return s.length ? s[s.length - 1] : null;
}

export function photosStale(state: PhysiqueCommandState, now: Date = new Date()): boolean {
  const latest = latestPhotoCheckIn(state);
  if (!latest) return true;
  return daysBetween(latest.date, localDateKey(now)) > state.checkInIntervalDays;
}
