/* ════════════════════════════════════════════════════════════════════════
   APEX COMMAND INTELLIGENCE — pure, deterministic builders for the Apex
   member-intelligence surfaces:

   · Biomarker Command       — member-entered lab markers grouped by category
   · Evidence Watch          — what data is missing / stale across systems
   · Measurement Review      — factual deltas from physique check-in entries
   · Photo Review            — factual coverage from photo check-ins
   · Enhanced Command        — log-only summary of user-entered protocol items

   HARD SAFETY BOUNDARIES (Reserve compliance):
   - Log-only. No reference ranges, no optimal/caution/danger judgments,
     no diagnosis, no treatment, no dosing, no compound recommendations.
   - Trends are pure arithmetic on the member's own entered values
     (newer number vs older number). Trend observation only.
   - Every lab/enhanced surface routes the member to clinician review.
   ════════════════════════════════════════════════════════════════════════ */

import type {
  BloodworkLogRecord,
  EnhancementAdherenceRecord,
  EnhancementEntry,
  InjectionLogRecord,
  SetupProfile,
} from "@/lib/athlete-store";
import type { PhotoCheckIn, PhysiqueEntry } from "@/lib/physique/types";
import { localDateKey } from "@/lib/dates/local-day";

/* ─── Shared helpers ──────────────────────────────────────────────────────── */

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(isoDate: string, now: Date): number | null {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / DAY_MS);
}

function parseNumeric(value: string): number | null {
  const m = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

export type MarkerTrend = "up" | "down" | "stable" | "logged";

/* ─── Biomarker Command ───────────────────────────────────────────────────── */

export type BiomarkerCategoryKey =
  | "performance-recovery"
  | "hormones-vitality"
  | "metabolic"
  | "inflammation"
  | "liver-kidney"
  | "cardiovascular";

export const BIOMARKER_CATEGORIES: { key: BiomarkerCategoryKey; label: string; relatesTo: string }[] = [
  { key: "performance-recovery", label: "Performance / Recovery", relatesTo: "May relate to energy, oxygen transport, and recovery capacity." },
  { key: "hormones-vitality", label: "Hormones / Vitality", relatesTo: "May relate to vitality, drive, sleep quality, and training response." },
  { key: "metabolic", label: "Metabolic Health", relatesTo: "May relate to fuel handling, body-composition trends, and energy stability." },
  { key: "inflammation", label: "Inflammation", relatesTo: "May relate to recovery load and systemic stress trends." },
  { key: "liver-kidney", label: "Liver / Kidney", relatesTo: "May relate to processing load — a common clinician-review panel." },
  { key: "cardiovascular", label: "Cardiovascular", relatesTo: "May relate to long-term cardiovascular health — review with a clinician." },
];

/** Known marker name → category. Keys are normalized lowercase. */
const MARKER_CATEGORY: Record<string, BiomarkerCategoryKey> = {
  // Performance / Recovery (oxygen transport, micronutrients, stress)
  hemoglobin: "performance-recovery",
  hematocrit: "performance-recovery",
  rbc: "performance-recovery",
  wbc: "performance-recovery",
  platelets: "performance-recovery",
  ferritin: "performance-recovery",
  iron: "performance-recovery",
  "vitamin d": "performance-recovery",
  b12: "performance-recovery",
  cortisol: "performance-recovery",
  // Hormones / Vitality
  "total testosterone": "hormones-vitality",
  testosterone: "hormones-vitality",
  "free testosterone": "hormones-vitality",
  estradiol: "hormones-vitality",
  shbg: "hormones-vitality",
  lh: "hormones-vitality",
  fsh: "hormones-vitality",
  prolactin: "hormones-vitality",
  dht: "hormones-vitality",
  tsh: "hormones-vitality",
  "free t3": "hormones-vitality",
  "free t4": "hormones-vitality",
  // Metabolic
  a1c: "metabolic",
  "fasting glucose": "metabolic",
  glucose: "metabolic",
  "fasting insulin": "metabolic",
  insulin: "metabolic",
  // Inflammation
  "hs-crp": "inflammation",
  crp: "inflammation",
  // Liver / Kidney
  alt: "liver-kidney",
  ast: "liver-kidney",
  ggt: "liver-kidney",
  creatinine: "liver-kidney",
  egfr: "liver-kidney",
  bun: "liver-kidney",
  // Cardiovascular
  hdl: "cardiovascular",
  ldl: "cardiovascular",
  triglycerides: "cardiovascular",
  apob: "cardiovascular",
  "total cholesterol": "cardiovascular",
};

export function categorizeMarker(name: string): BiomarkerCategoryKey | null {
  const key = name.trim().toLowerCase();
  if (MARKER_CATEGORY[key]) return MARKER_CATEGORY[key];
  // Loose contains-match for variants like "Testosterone, Total".
  for (const [k, v] of Object.entries(MARKER_CATEGORY)) {
    if (key.includes(k)) return v;
  }
  return null;
}

export type BiomarkerMarkerRead = {
  name: string;
  category: BiomarkerCategoryKey | null;
  latestValue: string;
  latestDate: string;
  previousValue: string | null;
  /** Pure arithmetic on member-entered numbers. Trend observation only. */
  trend: MarkerTrend;
  /** Member flagged this marker to discuss with their clinician. */
  flaggedByMember: boolean;
};

export type BiomarkerCategoryRead = {
  key: BiomarkerCategoryKey;
  label: string;
  relatesTo: string;
  markers: BiomarkerMarkerRead[];
  covered: boolean;
};

export type BiomarkerCommand = {
  hasData: boolean;
  recordCount: number;
  markerCount: number;
  lastLogDate: string | null;
  lastLogDaysAgo: number | null;
  categories: BiomarkerCategoryRead[];
  coveredCategories: number;
  /** Top review priorities: member-flagged markers first, then missing categories. */
  priorities: { label: string; detail: string; kind: "flagged" | "missing-category" | "review-due" }[];
  /** "Baseline missing" / "Baseline logged" / "Current" — factual log status. */
  internalStatus: string;
  /** Next lab review framing (from member-entered cadence / dates). */
  nextReviewLabel: string;
  nextReviewDueDays: number | null;
};

export function buildBiomarkerCommand(input: {
  logs: BloodworkLogRecord[];
  setup: SetupProfile;
  now: Date;
}): BiomarkerCommand {
  const { logs, setup, now } = input;
  // Sort newest-first by testDate (store already inserts newest-first, but be safe).
  const sorted = [...logs].sort((a, b) => (a.testDate < b.testDate ? 1 : -1));
  const flagged = new Set((setup.bloodworkMarkers ?? []).map((m) => m.trim().toLowerCase()).filter(Boolean));

  // Collect per-marker history (newest first), preserving display name from latest entry.
  const history = new Map<string, { name: string; values: { value: string; date: string }[] }>();
  for (const log of sorted) {
    for (const m of log.markers ?? []) {
      const key = m.name.trim().toLowerCase();
      if (!key) continue;
      const display = `${m.value}${m.unit ? ` ${m.unit}` : ""}`;
      const existing = history.get(key);
      if (existing) existing.values.push({ value: display, date: log.testDate });
      else history.set(key, { name: m.name.trim(), values: [{ value: display, date: log.testDate }] });
    }
  }

  const markerReads: BiomarkerMarkerRead[] = Array.from(history.entries()).map(([key, h]) => {
    const latest = h.values[0];
    const previous = h.values[1] ?? null;
    let trend: MarkerTrend = "logged";
    if (previous) {
      const a = parseNumeric(latest.value);
      const b = parseNumeric(previous.value);
      if (a !== null && b !== null) trend = a > b ? "up" : a < b ? "down" : "stable";
    }
    return {
      name: h.name,
      category: categorizeMarker(h.name),
      latestValue: latest.value,
      latestDate: latest.date,
      previousValue: previous?.value ?? null,
      trend,
      flaggedByMember: flagged.has(key) || Array.from(flagged).some((f) => key.includes(f) || f.includes(key)),
    };
  });

  const categories: BiomarkerCategoryRead[] = BIOMARKER_CATEGORIES.map((c) => {
    const markers = markerReads.filter((m) => m.category === c.key);
    return { ...c, markers, covered: markers.length > 0 };
  });

  const lastLog = sorted[0] ?? null;
  const lastLogDaysAgo = lastLog ? daysBetween(lastLog.testDate, now) : null;

  /* Next review — member-entered next review date, else last lab + cadence. */
  const cadenceWeeks = setup.labReviewCadenceWeeks ?? null;
  let nextReviewDueDays: number | null = null;
  let nextReviewLabel = "Set a lab review cadence with your clinician.";
  if (setup.nextReviewDate) {
    const d = daysBetween(setup.nextReviewDate, now);
    if (d !== null) {
      nextReviewDueDays = -d;
      nextReviewLabel = -d >= 0 ? `Next lab review in ${-d} day${-d === 1 ? "" : "s"}` : `Lab review ${d} day${d === 1 ? "" : "s"} past due`;
    }
  } else if (lastLog && cadenceWeeks) {
    const since = lastLogDaysAgo ?? 0;
    const due = cadenceWeeks * 7 - since;
    nextReviewDueDays = due;
    nextReviewLabel = due >= 0 ? `Next lab review in ~${due} day${due === 1 ? "" : "s"}` : `Lab review ~${-due} day${-due === 1 ? "" : "s"} overdue`;
  } else if (lastLog) {
    nextReviewLabel = `Last panel logged ${lastLogDaysAgo ?? 0} day${lastLogDaysAgo === 1 ? "" : "s"} ago — set the next review with your clinician.`;
  }

  /* Priorities — member-flagged first, then review-due, then missing categories. */
  const priorities: BiomarkerCommand["priorities"] = [];
  for (const m of markerReads.filter((r) => r.flaggedByMember)) {
    priorities.push({ label: m.name, detail: "Flagged by you to discuss with your clinician.", kind: "flagged" });
  }
  for (const f of Array.from(flagged)) {
    if (!markerReads.some((m) => m.name.trim().toLowerCase().includes(f) || f.includes(m.name.trim().toLowerCase()))) {
      priorities.push({ label: f.replace(/\b\w/g, (c) => c.toUpperCase()), detail: "Flagged to discuss — no logged value yet.", kind: "flagged" });
    }
  }
  if (nextReviewDueDays !== null && nextReviewDueDays <= 7) {
    priorities.push({ label: "Lab review window", detail: nextReviewLabel, kind: "review-due" });
  }
  for (const c of categories.filter((c) => !c.covered)) {
    priorities.push({ label: c.label, detail: "No logged markers yet — evidence missing.", kind: "missing-category" });
  }

  const internalStatus = sorted.length === 0
    ? "Baseline missing"
    : sorted.length === 1
      ? "Baseline logged"
      : lastLogDaysAgo !== null && cadenceWeeks && lastLogDaysAgo > cadenceWeeks * 7
        ? "Refresh due"
        : "Current";

  return {
    hasData: markerReads.length > 0 || sorted.length > 0,
    recordCount: sorted.length,
    markerCount: markerReads.length,
    lastLogDate: lastLog?.testDate ?? null,
    lastLogDaysAgo,
    categories,
    coveredCategories: categories.filter((c) => c.covered).length,
    priorities: priorities.slice(0, 3),
    internalStatus,
    nextReviewLabel,
    nextReviewDueDays,
  };
}

/* ─── Evidence Watch — missing / stale data across systems ────────────────── */

export type EvidenceItem = {
  id: string;
  label: string;
  detail: string;
  target: "bloodwork" | "measurements" | "progress-photos" | "recovery" | "settings";
  actionLabel: string;
  severity: "missing" | "stale" | "ok";
};

export function buildEvidenceWatch(input: {
  bloodwork: BiomarkerCommand;
  entries: PhysiqueEntry[];
  photoCheckIns: PhotoCheckIn[];
  checkInIntervalDays: number;
  recoveryHasData: boolean;
  now: Date;
}): EvidenceItem[] {
  const { bloodwork, entries, photoCheckIns, checkInIntervalDays, recoveryHasData, now } = input;
  const items: EvidenceItem[] = [];

  if (bloodwork.recordCount === 0) {
    items.push({ id: "labs", label: "Labs missing", detail: "Upload labs to start a log-only record for clinician review.", target: "bloodwork", actionLabel: "Upload Labs", severity: "missing" });
  } else if (bloodwork.nextReviewDueDays !== null && bloodwork.nextReviewDueDays < 0) {
    items.push({ id: "labs", label: "Lab review due", detail: bloodwork.nextReviewLabel, target: "bloodwork", actionLabel: "Open Bloodwork", severity: "stale" });
  }

  const latestEntry = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null;
  const entryDays = latestEntry ? daysBetween(latestEntry.date, now) : null;
  if (!latestEntry) {
    items.push({ id: "measurements", label: "Measurements missing", detail: "Log a baseline so the trend engine has evidence.", target: "measurements", actionLabel: "Log Measurements", severity: "missing" });
  } else if (entryDays !== null && entryDays > checkInIntervalDays) {
    items.push({ id: "measurements", label: "Measurements stale", detail: `Measurements due — trend confidence low (last logged ${entryDays} days ago).`, target: "measurements", actionLabel: "Log Measurements", severity: "stale" });
  }

  const latestPhoto = [...photoCheckIns].sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null;
  const photoDays = latestPhoto ? daysBetween(latestPhoto.date, now) : null;
  if (!latestPhoto) {
    items.push({ id: "photos", label: "Photos missing", detail: "Progress photos due — visual trend needs evidence.", target: "progress-photos", actionLabel: "Log Photos", severity: "missing" });
  } else if (photoDays !== null && photoDays > checkInIntervalDays) {
    items.push({ id: "photos", label: "Photos stale", detail: `Progress photos due — visual trend needs evidence (last check-in ${photoDays} days ago).`, target: "progress-photos", actionLabel: "Log Photos", severity: "stale" });
  }

  if (!recoveryHasData) {
    items.push({ id: "recovery", label: "Recovery data missing", detail: "Recovery check-in needed before training intensity is confirmed.", target: "recovery", actionLabel: "Open Recovery", severity: "missing" });
  }

  return items;
}

/* ─── Measurement Review — factual deltas from member entries ─────────────── */

export type MeasurementDelta = { label: string; latest: string; delta: string | null; direction: "up" | "down" | "flat" | null };

export type MeasurementReview = {
  hasData: boolean;
  entryCount: number;
  lastDate: string | null;
  lastDaysAgo: number | null;
  spanDays: number | null;
  deltas: MeasurementDelta[];
  /** Coach-style observational line from real numbers only. */
  trendNote: string;
  nextDueDays: number | null;
  nextDueLabel: string;
  /** Sites with no logged value — more evidence needed. */
  missingSites: string[];
};

const MEASUREMENT_SITES: { key: string; label: string }[] = [
  { key: "waist", label: "Waist" },
  { key: "chest", label: "Chest" },
  { key: "shoulders", label: "Shoulders" },
  { key: "arms", label: "Arms" },
  { key: "thighs", label: "Thighs" },
  { key: "hips", label: "Hips" },
];

export function buildMeasurementReview(input: {
  entries: PhysiqueEntry[];
  checkInIntervalDays: number;
  goalLabel: string;
  now: Date;
}): MeasurementReview {
  const { entries, checkInIntervalDays, goalLabel, now } = input;
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = sorted[0] ?? null;
  const previous = sorted[1] ?? null;

  if (!latest) {
    return {
      hasData: false, entryCount: 0, lastDate: null, lastDaysAgo: null, spanDays: null,
      deltas: [], trendNote: "No measurements logged yet — a baseline unlocks the trend read.",
      nextDueDays: 0, nextDueLabel: "Baseline due now",
      missingSites: MEASUREMENT_SITES.map((s) => s.label),
    };
  }

  const lastDaysAgo = daysBetween(latest.date, now);
  const spanDays = previous ? daysBetween(previous.date, new Date(`${latest.date}T12:00:00`)) : null;

  const deltas: MeasurementDelta[] = [];
  // Body weight first.
  {
    const d = previous ? latest.bodyWeightLb - previous.bodyWeightLb : null;
    deltas.push({
      label: "Weight",
      latest: `${latest.bodyWeightLb.toFixed(1)} lb`,
      delta: d !== null ? `${d > 0 ? "+" : ""}${d.toFixed(1)} lb` : null,
      direction: d === null ? null : d > 0.05 ? "up" : d < -0.05 ? "down" : "flat",
    });
  }
  for (const site of MEASUREMENT_SITES) {
    const cur = latest.measurements[site.key as keyof typeof latest.measurements];
    if (cur == null) continue;
    const prev = previous?.measurements[site.key as keyof typeof previous.measurements];
    const d = prev != null ? cur - prev : null;
    deltas.push({
      label: site.label,
      latest: `${cur}"`,
      delta: d !== null ? `${d > 0 ? "+" : ""}${d.toFixed(1)}"` : null,
      direction: d === null ? null : d > 0.05 ? "up" : d < -0.05 ? "down" : "flat",
    });
  }

  const missingSites = MEASUREMENT_SITES.filter((s) => latest.measurements[s.key as keyof typeof latest.measurements] == null).map((s) => s.label);

  /* Observational trend line composed from real deltas only. */
  let trendNote: string;
  if (!previous) {
    trendNote = "Baseline logged — the next check-in unlocks the trend comparison.";
  } else {
    const waist = deltas.find((d) => d.label === "Waist");
    const weight = deltas.find((d) => d.label === "Weight");
    const parts: string[] = [];
    if (weight?.delta) parts.push(`weight ${weight.delta}`);
    if (waist?.delta) parts.push(`waist ${waist.delta}`);
    trendNote = parts.length
      ? `Since the last check-in: ${parts.join(" · ")} — review against the ${goalLabel} goal.`
      : "Two check-ins logged — add site measurements to sharpen the trend.";
  }

  const nextDueDays = lastDaysAgo !== null ? Math.max(0, checkInIntervalDays - lastDaysAgo) : null;
  const overdue = lastDaysAgo !== null && lastDaysAgo > checkInIntervalDays;
  const nextDueLabel = overdue
    ? `Check-in overdue by ${(lastDaysAgo ?? 0) - checkInIntervalDays} day${(lastDaysAgo ?? 0) - checkInIntervalDays === 1 ? "" : "s"}`
    : nextDueDays === 0
      ? "Check-in due today"
      : `Next check-in in ${nextDueDays} day${nextDueDays === 1 ? "" : "s"}`;

  return {
    hasData: true,
    entryCount: sorted.length,
    lastDate: latest.date,
    lastDaysAgo,
    spanDays,
    deltas,
    trendNote,
    nextDueDays,
    nextDueLabel,
    missingSites,
  };
}

/* ─── Photo Review — factual coverage from photo check-ins ────────────────── */

export type PhotoReview = {
  hasData: boolean;
  checkInCount: number;
  lastDate: string | null;
  lastDaysAgo: number | null;
  posesCovered: string[];
  posesMissing: string[];
  avgConsistency: number | null;
  comparisonReady: boolean;
  /** Coach-style observations from real data only — never visual claims. */
  notes: string[];
  nextDueLabel: string;
};

const CORE_POSES: { id: string; label: string }[] = [
  { id: "front-relaxed", label: "Front" },
  { id: "side-relaxed", label: "Side" },
  { id: "back-relaxed", label: "Back" },
];

export function buildPhotoReview(input: {
  checkIns: PhotoCheckIn[];
  checkInIntervalDays: number;
  now: Date;
}): PhotoReview {
  const { checkIns, checkInIntervalDays, now } = input;
  const sorted = [...checkIns].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = sorted[0] ?? null;

  if (!latest) {
    return {
      hasData: false, checkInCount: 0, lastDate: null, lastDaysAgo: null,
      posesCovered: [], posesMissing: CORE_POSES.map((p) => p.label),
      avgConsistency: null, comparisonReady: false,
      notes: ["No photo check-ins yet — the visual trend starts with the first set."],
      nextDueLabel: "First check-in due now",
    };
  }

  const lastDaysAgo = daysBetween(latest.date, now);
  const allPoses = new Set(sorted.flatMap((c) => c.poses));
  const posesCovered = CORE_POSES.filter((p) => Array.from(allPoses).some((pose) => pose.startsWith(p.id.split("-")[0]))).map((p) => p.label);
  const posesMissing = CORE_POSES.filter((p) => !posesCovered.includes(p.label)).map((p) => p.label);
  const avgConsistency = sorted.length
    ? Math.round(sorted.reduce((s, c) => s + c.consistencyScore, 0) / sorted.length)
    : null;
  const comparisonReady = sorted.length >= 2;

  const notes: string[] = [];
  if (comparisonReady) notes.push(`${sorted.length} check-ins logged — side-by-side comparison is available in Physique Command.`);
  else notes.push("One check-in logged — the next set unlocks the visual comparison.");
  if (avgConsistency !== null) {
    notes.push(avgConsistency >= 80
      ? `Consistency ${avgConsistency}/100 — lighting and framing are holding, so changes you see are more likely real.`
      : `Consistency ${avgConsistency}/100 — matching lighting, distance, and time of day makes the visual trend more trustworthy.`);
  }
  if (posesMissing.length) notes.push(`${posesMissing.join(" + ")} pose${posesMissing.length > 1 ? "s" : ""} missing — add ${posesMissing.length > 1 ? "them" : "it"} for full symmetry evidence.`);

  const overdue = lastDaysAgo !== null && lastDaysAgo > checkInIntervalDays;
  const nextDueLabel = overdue
    ? `Photo check-in overdue by ${(lastDaysAgo ?? 0) - checkInIntervalDays} day${(lastDaysAgo ?? 0) - checkInIntervalDays === 1 ? "" : "s"}`
    : `Next photo check-in in ${Math.max(0, checkInIntervalDays - (lastDaysAgo ?? 0))} day${Math.max(0, checkInIntervalDays - (lastDaysAgo ?? 0)) === 1 ? "" : "s"}`;

  return {
    hasData: true,
    checkInCount: sorted.length,
    lastDate: latest.date,
    lastDaysAgo,
    posesCovered,
    posesMissing,
    avgConsistency,
    comparisonReady,
    notes,
    nextDueLabel,
  };
}

/* ─── Enhanced Command — log-only protocol organization summary ───────────── */

export type EnhancedWatchItem = {
  label: string;
  /** "Logged · trending up" / "No data — upload labs". Factual only. */
  status: string;
  hasData: boolean;
  trend: MarkerTrend | null;
};

export type EnhancedCommand = {
  mode: "foundation" | "advanced";
  modeLabel: string;
  activeCount: number;
  categories: string[];
  /** Adherence over the member's logged records, last 7 days. */
  adherence7d: { taken: number; total: number; pct: number | null };
  lastCompleted: { name: string; date: string; time: string | null } | null;
  missedRecent: number;
  /** Wellness / side-effect check-in recency (tolerance or symptoms logged). */
  sideEffectStatus: string;
  sideEffectDue: boolean;
  injectionLogCount: number;
  lastInjectionSite: string | null;
  /** Clinician review flags — factual counts, no judgments. */
  clinicianFlags: string[];
  /** Advanced watchlist from the member's own logged markers. */
  watchlist: EnhancedWatchItem[];
};

const WATCHLIST_DEFS: { label: string; markers: string[] }[] = [
  { label: "Blood Thickness / Oxygen Transport", markers: ["hematocrit", "hemoglobin", "rbc"] },
  { label: "Hormones / Vitality", markers: ["total testosterone", "testosterone", "free testosterone", "estradiol", "shbg", "prolactin"] },
  { label: "Liver / Kidney", markers: ["alt", "ast", "ggt", "creatinine", "egfr", "bun"] },
  { label: "Cardiovascular / Lipids", markers: ["hdl", "ldl", "triglycerides", "apob"] },
  { label: "Metabolic", markers: ["a1c", "fasting glucose", "glucose", "fasting insulin", "insulin"] },
  { label: "Inflammation", markers: ["hs-crp", "crp"] },
];

export function buildEnhancedCommand(input: {
  entries: EnhancementEntry[];
  adherence: EnhancementAdherenceRecord[];
  injectionLogs: InjectionLogRecord[];
  biomarkers: BiomarkerCommand;
  experienceLevel: string | undefined;
  now: Date;
}): EnhancedCommand {
  const { entries, adherence, injectionLogs, biomarkers, experienceLevel, now } = input;
  const active = entries.filter((e) => e.isActive && !e.pausedAt);
  const categories = Array.from(new Set(active.map((e) => e.category.charAt(0).toUpperCase() + e.category.slice(1))));

  const mode: EnhancedCommand["mode"] = experienceLevel === "advanced" || experienceLevel === "elite" ? "advanced" : "foundation";

  /* 7-day adherence from the member's own logged records. */
  const cutoff = localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));
  const recent = adherence.filter((r) => r.date >= cutoff);
  const taken = recent.filter((r) => r.takenStatus === "taken").length;
  const decided = recent.filter((r) => r.takenStatus === "taken" || r.takenStatus === "missed" || r.takenStatus === "skipped").length;
  const missedRecent = recent.filter((r) => r.takenStatus === "missed").length;

  const lastTaken = [...adherence]
    .filter((r) => r.takenStatus === "taken")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.actualTime ?? "") < (b.actualTime ?? "") ? 1 : -1))[0] ?? null;
  const lastTakenEntry = lastTaken ? entries.find((e) => e.id === lastTaken.entryId) : null;

  /* Side-effect / wellness check recency. */
  const lastWellness = [...adherence]
    .filter((r) => (r.tolerance && r.tolerance !== "unknown") || (r.symptoms && r.symptoms.trim().length > 0))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null;
  const wellnessDays = lastWellness ? daysBetween(lastWellness.date, now) : null;
  const sideEffectDue = wellnessDays === null || wellnessDays > 7;
  const sideEffectStatus = lastWellness
    ? `Last wellness note ${wellnessDays} day${wellnessDays === 1 ? "" : "s"} ago${sideEffectDue ? " — check-in due" : ""}`
    : "No wellness check-ins yet — log how you feel alongside your entries";

  /* Injection-site history (user-entered, display only). */
  const lastInjection = [...injectionLogs].sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null;

  /* Clinician review flags — factual. */
  const clinicianFlags: string[] = [];
  const flaggedMarkers = active.flatMap((e) => e.labMarkersToDiscuss ?? []);
  if (flaggedMarkers.length) clinicianFlags.push(`${flaggedMarkers.length} marker${flaggedMarkers.length === 1 ? "" : "s"} flagged to discuss with your clinician`);
  const noOversight = active.filter((e) => e.clinicianOversight === false).length;
  if (noOversight > 0) clinicianFlags.push(`${noOversight} entr${noOversight === 1 ? "y" : "ies"} without clinician oversight marked — worth reviewing`);
  if (biomarkers.recordCount === 0) clinicianFlags.push("Baseline labs needed before trend confidence");
  else if (biomarkers.nextReviewDueDays !== null && biomarkers.nextReviewDueDays <= 7) clinicianFlags.push(biomarkers.nextReviewLabel);

  /* Watchlist — purely from the member's logged markers. */
  const allMarkerReads = biomarkers.categories.flatMap((c) => c.markers);
  const watchlist: EnhancedWatchItem[] = WATCHLIST_DEFS.map((def) => {
    const hits = allMarkerReads.filter((m) => def.markers.some((k) => m.name.toLowerCase().includes(k)));
    if (!hits.length) return { label: def.label, status: "No data — upload labs", hasData: false, trend: null };
    const trending = hits.find((h) => h.trend === "up" || h.trend === "down");
    const trend = trending?.trend ?? "logged";
    const status = trending
      ? `${trending.name} logged · trend ${trending.trend === "up" ? "rising" : "falling"} — deserves attention at review`
      : `${hits.length} marker${hits.length === 1 ? "" : "s"} logged · stable on your entries`;
    return { label: def.label, status, hasData: true, trend };
  });

  return {
    mode,
    modeLabel: mode === "advanced" ? "Advanced Enhanced" : "Foundation Enhanced",
    activeCount: active.length,
    categories,
    adherence7d: { taken, total: decided, pct: decided > 0 ? Math.round((taken / decided) * 100) : null },
    lastCompleted: lastTaken
      ? { name: lastTakenEntry?.displayName ?? lastTakenEntry?.officialName ?? lastTakenEntry?.name ?? "Logged item", date: lastTaken.date, time: lastTaken.actualTime ?? null }
      : null,
    missedRecent,
    sideEffectStatus,
    sideEffectDue,
    injectionLogCount: injectionLogs.length,
    lastInjectionSite: lastInjection ? (lastInjection.side ? `${lastInjection.side} ${lastInjection.site}` : lastInjection.site) : null,
    clinicianFlags,
    watchlist,
  };
}
