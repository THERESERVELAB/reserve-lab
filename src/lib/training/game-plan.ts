/* ════════════════════════════════════════════════════════════════════════
   GAME PLAN PROGRESSION — the member's real position in the plan.
   ------------------------------------------------------------------------
   One resolver for "which week am I on" so no surface can hardcode a week
   again. Week source priority:
     1. Active protocol → computeProtocolProgress (start date → week).
     2. Membership     → weeks since onboarding completion, cycled through
                         a rolling 8-week block (honest: your training week,
                         not a protocol week).
     3. Default        → Week 1 of 8 (brand-new member, nothing saved yet).

   Day states are earned from real completed-session records, never assumed:
   a past day with no logged session is MISSED, not silently "complete".

   Pure + deterministic. Training structure only — no medical content.
   ════════════════════════════════════════════════════════════════════════ */

import { computeProtocolProgress, type ActiveProtocol } from "@/lib/protocol/library";

export type GamePlanWeekSource = "protocol" | "membership" | "default";

export type GamePlanWeek = {
  /** 1-based current week. */
  week: number;
  /** Total weeks in the running block (protocol length or rolling 8). */
  total: number;
  /** Display label, e.g. "Week 3 of 8". */
  label: string;
  /** 0–100 progress through the block. */
  percentComplete: number;
  source: GamePlanWeekSource;
};

const ROLLING_BLOCK_WEEKS = 8;

function daysBetweenLocal(fromISO: string, now: Date): number {
  const from = new Date(`${fromISO.slice(0, 10)}T00:00:00`).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((today - from) / 86_400_000);
}

export function resolveGamePlanWeek(
  activeProtocol: ActiveProtocol | null | undefined,
  onboardingCompletedAt: string | null | undefined,
  now: Date = new Date(),
): GamePlanWeek {
  if (activeProtocol) {
    const prog = computeProtocolProgress(activeProtocol, now);
    const total = prog.totalWeeks > 0 ? prog.totalWeeks : ROLLING_BLOCK_WEEKS;
    const week = Math.max(1, Math.min(total, prog.currentWeek));
    return {
      week,
      total,
      label: `Week ${week} of ${total}`,
      percentComplete: prog.totalWeeks > 0 ? prog.percentComplete : Math.round(((week - 1) / total) * 100),
      source: "protocol",
    };
  }
  if (onboardingCompletedAt) {
    const elapsedDays = Math.max(0, daysBetweenLocal(onboardingCompletedAt, now));
    const week = (Math.floor(elapsedDays / 7) % ROLLING_BLOCK_WEEKS) + 1;
    return {
      week,
      total: ROLLING_BLOCK_WEEKS,
      label: `Week ${week} of ${ROLLING_BLOCK_WEEKS}`,
      percentComplete: Math.round(((week - 1) / ROLLING_BLOCK_WEEKS) * 100),
      source: "membership",
    };
  }
  return { week: 1, total: ROLLING_BLOCK_WEEKS, label: `Week 1 of ${ROLLING_BLOCK_WEEKS}`, percentComplete: 0, source: "default" };
}

/* ─── Completed-session day states ────────────────────────────────────────── */

export type GamePlanDayState = "completed" | "today" | "missed" | "upcoming";

/** Local Monday 00:00 of the week containing `now`. */
function mondayOf(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - offset);
  return d;
}

/** Split days (1=Mon … 7=Sun) of the CURRENT week that have a completed
    session record. `sessionISODates` are ISO timestamps of closed sessions. */
export function completedSplitDaysThisWeek(
  sessionISODates: readonly string[],
  now: Date = new Date(),
): Set<number> {
  const monday = mondayOf(now);
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const out = new Set<number>();
  for (const iso of sessionISODates) {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) continue;
    const localDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    if (localDay < monday || localDay >= nextMonday) continue;
    out.add(((dt.getDay() + 6) % 7) + 1);
  }
  return out;
}

/** Honest day state: completed only when a session record exists; past days
    without a record read as missed. Recovery days never read as missed. */
export function gamePlanDayState(
  splitDay: number,
  todaySplitDay: number,
  completed: ReadonlySet<number>,
  opts: { recovery?: boolean } = {},
): GamePlanDayState {
  if (completed.has(splitDay)) return "completed";
  if (splitDay === todaySplitDay) return "today";
  if (splitDay > todaySplitDay) return "upcoming";
  return opts.recovery ? "completed" : "missed";
}

/** Week adherence summary for progress surfaces. */
export function weekAdherence(
  plan: readonly { splitDay: number; recovery: boolean }[],
  todaySplitDay: number,
  completed: ReadonlySet<number>,
): { completed: number; missed: number; upcoming: number; totalTraining: number } {
  let done = 0, missed = 0, upcoming = 0, totalTraining = 0;
  for (const d of plan) {
    if (d.recovery) continue;
    totalTraining += 1;
    const state = gamePlanDayState(d.splitDay, todaySplitDay, completed, { recovery: d.recovery });
    if (state === "completed") done += 1;
    else if (state === "missed") missed += 1;
    else upcoming += 1; // "today" counts as still available
  }
  return { completed: done, missed, upcoming, totalTraining };
}
