import {
  EnhancementAdherenceRecord,
  EnhancementCategory,
  EnhancementEntry,
} from "@/lib/athlete-store";
import { EnhancementScheduleSlot } from "@/lib/enhancement/schedule";
import { computeReconstitution } from "@/lib/enhancement/reconstitution";
import { isDoseComplete } from "@/lib/enhancement/dose-timing";

export type StackStatus =
  | "ready"
  | "due"
  | "logged"
  | "skipped"
  | "missed"
  | "not-due"
  | "review";

export type StackStatusMeta = {
  status: StackStatus;
  label: string;
  symbol: string;
  color: string;
  pulse: boolean;
};

export const STATUS_COLORS: Record<StackStatus, string> = {
  ready: "#79e3b5",   // green ready glow
  due: "#d5b15f",     // gold due indicator
  logged: "#79e3b5",  // logged check
  skipped: "#e8c87a", // amber-ish skipped
  missed: "#ef7d55",  // red/orange missed
  "not-due": "rgba(255,255,255,0.55)",
  review: "#e8c87a",  // amber review warning
};

const STATUS_LABELS: Record<StackStatus, string> = {
  ready: "Ready",
  due: "Due",
  logged: "Logged",
  skipped: "Skipped",
  missed: "Missed",
  "not-due": "Not Due",
  review: "Review",
};

const STATUS_SYMBOLS: Record<StackStatus, string> = {
  ready: "✓",
  due: "●",
  logged: "✓",
  skipped: "×",
  missed: "⏱",
  "not-due": "–",
  review: "!",
};

const PULSE_STATUSES: StackStatus[] = ["due", "missed"];

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function slotMinutes(slot: EnhancementScheduleSlot): number | null {
  if (!slot.plannedTime || slot.plannedTime === "—") return null;
  const [hh, mm] = slot.plannedTime.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hh)) return null;
  return hh * 60 + (mm || 0);
}

/** Timing flags for an entry's own dose times, or null when it uses the single time-of-day setting. */
function doseTimingFlags(entry: EnhancementEntry): string[] | null {
  const doses = entry.scheduleRule?.doses;
  if (!doses || doses.length === 0) return null;
  return doses.some((dose) => !isDoseComplete(dose)) ? ["Dose time missing"] : [];
}

function needsReview(entry: EnhancementEntry): boolean {
  const doseFlags = doseTimingFlags(entry);
  if (doseFlags) return getCriticalReviewFlags(entry).length > 0;
  if (!entry.timeOfDayPreference || entry.timeOfDayPreference === "unspecified") return true;
  if (entry.timeOfDayPreference === "custom" && !entry.customTime) return true;
  if (getCriticalReviewFlags(entry).length > 0) return true;
  return false;
}

/**
 * Detailed review flags shown in the Reserve Review panel and operator card.
 */
export function getReviewFlags(entry: EnhancementEntry): string[] {
  return getCriticalReviewFlags(entry);
}

export function getCriticalReviewFlags(entry: EnhancementEntry): string[] {
  const flags: string[] = [];
  const doseFlags = doseTimingFlags(entry);
  if (doseFlags) {
    flags.push(...doseFlags);
  } else {
    if (!entry.timeOfDayPreference || entry.timeOfDayPreference === "unspecified") flags.push("Timing anchor not set");
    if (entry.timeOfDayPreference === "custom" && !entry.customTime) flags.push("Custom time missing");
  }
  const ft = entry.frequencyType ?? "daily";
  if ((ft === "weekly" || ft === "specific_days") && (entry.daysOfWeek ?? []).length === 0 && entry.scheduleRule?.type !== "specific_weekdays") {
    flags.push("Days of week not selected");
  }
  if (entry.scheduleReviewReason) flags.push(entry.scheduleReviewReason);
  if (entry.route === "injectable" && !entry.injectionType) flags.push("Injectable item missing injection type");
  const calc = computeReconstitution({
    vialTotalAmount: entry.vialTotalAmount,
    unit: entry.vialTotalUnit,
    reconstitutionVolumeMl: entry.reconstitutionVolumeMl ?? entry.vialVolumeMl,
    unitsPerMl: entry.syringeUnitsPerMl,
    unitsPlannedPerLog: entry.unitsPlannedPerLog,
    amountPerLogOverrideMg: entry.amountSource === "manual" ? entry.amountPerLogMg : undefined,
    vialCount: entry.vialCount,
    startingRemainingAmountMg: entry.remainingQuantityMg ?? entry.totalQuantityMg,
    reorderLeadDays: entry.reorderLeadDays,
  });
  const hasCalculatorValues = Boolean(entry.vialTotalAmount || entry.reconstitutionVolumeMl || entry.syringeUnitsPerMl || entry.unitsPlannedPerLog);
  if (hasCalculatorValues) {
    flags.push(...calc.errors.filter((error) => error.startsWith("Impossible input")));
  }
  if (entry.totalQuantityMg !== undefined && entry.totalQuantityMg <= 0) flags.push("Inventory total must be greater than zero");
  if (entry.remainingQuantityMg !== undefined && entry.remainingQuantityMg < 0) flags.push("Inventory remaining cannot be negative");
  return flags;
}

export function getOptionalReviewNotes(entry: EnhancementEntry): string[] {
  const notes: string[] = [];
  if (!entry.toleranceNotes || entry.toleranceNotes.trim().length === 0) notes.push("Optional: add tolerance note");
  if ((entry.labMarkersToDiscuss ?? []).length === 0) notes.push("Optional: add lab marker watch");
  if (!entry.supplierNote) notes.push("Optional: add supplier note");
  if (!entry.storageNote) notes.push("Optional: add storage note");
  if (!entry.symptomNotes) notes.push("Optional: add symptom watch");
  return notes;
}

/**
 * Most recent adherence touch for an entry (taken or skipped).
 */
export function getLastAdherenceTouch(
  entryId: string,
  adherence: EnhancementAdherenceRecord[],
): { record: EnhancementAdherenceRecord; label: string } | null {
  const matches = adherence
    .filter((r) => r.entryId === entryId && (r.takenStatus === "taken" || r.takenStatus === "skipped"))
    // Order by the dose's OWN day (newest first), then by when it was entered.
    // Sorting by createdAt alone made a dose backfilled for an earlier day read
    // as the latest one — and labelled it "Today", because it was entered today.
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
  if (matches.length === 0) return null;
  const rec = matches[0];
  const action = rec.takenStatus === "taken" ? "Logged" : "Skipped";
  const dateLabel = (() => {
    // The day the dose is FOR — never createdAt, which is only when it was entered.
    const day = rec.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? "")) return day || "";
    const time = rec.actualTime && /^\d{2}:\d{2}/.test(rec.actualTime)
      ? rec.actualTime
      : rec.plannedTime && /^\d{2}:\d{2}/.test(rec.plannedTime) ? rec.plannedTime : null;
    const d = new Date(`${day}T${time ?? "12:00"}:00`);
    if (Number.isNaN(d.getTime())) return day;
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const timeLabel = time ? ` · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : "";
    if (d.toDateString() === today.toDateString()) return `Today${timeLabel}`;
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday${timeLabel}`;
    return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}${timeLabel}`;
  })();
  return { record: rec, label: `${action} · ${dateLabel}` };
}

/**
 * Derive a Reserve Stack Status for a scheduled slot.
 *
 * "Ready" means schedule-ready only — the user-defined reminder is configured.
 * Reserve does not approve, prescribe, or adjust dosing.
 */
export function getStackStatus(slot: EnhancementScheduleSlot, currentMinutes: number = nowMinutes()): StackStatusMeta {
  if (!slot.entry.isActive) {
    return meta("not-due", "Paused");
  }
  if (needsReview(slot.entry)) {
    return meta("review");
  }
  if (slot.status === "taken") return meta("logged");
  if (slot.status === "skipped") return meta("skipped");

  const sm = slotMinutes(slot);
  if (sm === null) {
    return meta("review");
  }

  // Missed: planned time passed by > 60 minutes without action
  if (currentMinutes - sm > 60) return meta("missed");
  // Due: within ±90 minutes
  if (Math.abs(sm - currentMinutes) <= 90) return meta("due");
  return meta("ready");
}

/**
 * Status for an entry that has NO slot in today's schedule (e.g. trained-day-off entry).
 */
export function getEntryFallbackStatus(entry: EnhancementEntry): StackStatusMeta {
  if (!entry.isActive) return meta("not-due", "Paused");
  if (needsReview(entry)) return meta("review");
  return meta("not-due");
}

function meta(status: StackStatus, overrideLabel?: string): StackStatusMeta {
  return {
    status,
    label: overrideLabel ?? STATUS_LABELS[status],
    symbol: STATUS_SYMBOLS[status],
    color: STATUS_COLORS[status],
    pulse: PULSE_STATUSES.includes(status),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   CATEGORY BADGE TOKENS — kept here so every consumer (Training/Live/Recovery/
   Night Brief/Journal/Settings) renders the same label and accent.
   ──────────────────────────────────────────────────────────────────────── */

export const CATEGORY_LABELS: Record<EnhancementCategory, string> = {
  supplement: "Supplement",
  peptide: "Peptide",
  hormone: "Hormones / AAS",
  medication: "Medication",
  vitamin: "Vitamin",
  nootropic: "Nootropic",
  recovery: "Recovery",
  other: "Other",
};

export const CATEGORY_ACCENTS: Record<EnhancementCategory, string> = {
  supplement: "#79e3b5",
  peptide: "#a78bfa",
  hormone: "#d5b15f",
  medication: "#7dd3ee",
  vitamin: "#79e3b5",
  nootropic: "#a78bfa",
  recovery: "#7dd3ee",
  other: "#8ea0b8",
};

export function categoryLabel(c: EnhancementCategory): string {
  return CATEGORY_LABELS[c] ?? "Other";
}

export function categoryAccent(c: EnhancementCategory): string {
  return CATEGORY_ACCENTS[c] ?? "#8ea0b8";
}

/* ────────────────────────────────────────────────────────────────────────────
   GROUPED SUMMARY for slot lists — used by Night Brief, Journal, Live Mode
   ──────────────────────────────────────────────────────────────────────── */

export type StackSummary = {
  planned: number;
  logged: number;
  pending: number;
  skipped: number;
  missed: number;
  needsReview: number;
  categories: EnhancementCategory[];
  preTrainingCount: number;
  postTrainingCount: number;
  windDownCount: number;
  nextDue: EnhancementScheduleSlot | null;
  reviewSlot: EnhancementScheduleSlot | null;
};

export function summarizeStack(slots: EnhancementScheduleSlot[]): StackSummary {
  const summary: StackSummary = {
    planned: slots.length,
    logged: 0,
    pending: 0,
    skipped: 0,
    missed: 0,
    needsReview: 0,
    categories: [],
    preTrainingCount: 0,
    postTrainingCount: 0,
    windDownCount: 0,
    nextDue: null,
    reviewSlot: null,
  };
  const catSet = new Set<EnhancementCategory>();
  const now = nowMinutes();
  let nextDue: EnhancementScheduleSlot | null = null;
  let nextDueMinutes = Number.POSITIVE_INFINITY;

  for (const slot of slots) {
    catSet.add(slot.entry.category);
    if (slot.bucket === "pre_training") summary.preTrainingCount += 1;
    if (slot.bucket === "post_training" || slot.bucket === "post_workout") summary.postTrainingCount += 1;
    if (slot.bucket === "bedtime" || slot.bucket === "wind_down" || slot.bucket === "evening") summary.windDownCount += 1;

    const meta = getStackStatus(slot, now);
    if (meta.status === "logged") summary.logged += 1;
    else if (meta.status === "skipped") summary.skipped += 1;
    else if (meta.status === "missed") summary.missed += 1;
    else if (meta.status === "review") summary.needsReview += 1;
    else summary.pending += 1;

    if (meta.status === "due" || meta.status === "ready") {
      const sm = slotMinutes(slot);
      if (sm !== null && sm >= now && sm < nextDueMinutes) {
        nextDueMinutes = sm;
        nextDue = slot;
      } else if (meta.status === "due" && nextDue === null) {
        nextDue = slot;
      }
    }
    if (meta.status === "review" && summary.reviewSlot === null) summary.reviewSlot = slot;
  }
  summary.categories = Array.from(catSet);
  summary.nextDue = nextDue;
  return summary;
}
