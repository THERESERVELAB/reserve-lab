/* ════════════════════════════════════════════════════════════════════════
   CUSTOM WORKOUT PLANS — the member's own training system inside Reserve.
   ------------------------------------------------------------------------
   Members are never trapped in AI programming: they can author their own
   plan (days, exercises, sets/reps/rest/notes), run it alongside or instead
   of the Reserve-generated split, and mark sessions complete so custom work
   counts toward the same game-plan progress as generated sessions.

   The "Reserve enhance" layer is deterministic analysis — balance checks and
   progression suggestions derived from the plan itself. It advises, never
   overwrites. Pure data + helpers; no medical content.
   ════════════════════════════════════════════════════════════════════════ */

export type CustomExercise = {
  id: string;
  name: string;
  sets: number;
  /** Authored rep target, e.g. "8-12" or "5". */
  reps: string;
  /** Rest between sets, e.g. "90s" — optional. */
  rest?: string;
  notes?: string;
};

export type CustomPlanDay = {
  id: string;
  /** 0=Mon … 6=Sun, or null for an unscheduled/flex day. */
  dayIndex: number | null;
  title: string;
  exercises: CustomExercise[];
};

export type CustomWorkoutPlan = {
  id: string;
  name: string;
  days: CustomPlanDay[];
  createdAt: string;
  updatedAt: string;
};

export function newPlanId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
export function newDayId(): string {
  return `day-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
export function newExerciseId(): string {
  return `cex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const DAY_INDEX_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/* ─── Reserve enhance: deterministic plan analysis ────────────────────── */

export type PlanAnalysis = {
  headline: string;
  /** Push/pull/legs/core exposure counts read from exercise names. */
  balance: { push: number; pull: number; legs: number; core: number; other: number };
  findings: string[];
  progressionSuggestions: string[];
};

const PUSH = /(bench|press|push|dip|fly|pec|tricep|overhead|shoulder press)/i;
const PULL = /(row|pull|chin|lat|curl|face pull|shrug|deadlift|rdl|hinge)/i;
const LEGS = /(squat|leg|lunge|glute|ham|calf|quad|hip thrust|step.?up|rdl|deadlift)/i;
const CORE = /(ab|core|plank|crunch|oblique|vacuum|carry)/i;

export function analyzeCustomPlan(plan: CustomWorkoutPlan): PlanAnalysis {
  const balance = { push: 0, pull: 0, legs: 0, core: 0, other: 0 };
  let totalSets = 0;
  let exerciseCount = 0;

  for (const day of plan.days) {
    for (const ex of day.exercises) {
      exerciseCount += 1;
      totalSets += ex.sets;
      let matched = false;
      if (LEGS.test(ex.name)) { balance.legs += 1; matched = true; }
      if (PULL.test(ex.name)) { balance.pull += 1; matched = true; }
      if (PUSH.test(ex.name)) { balance.push += 1; matched = true; }
      if (CORE.test(ex.name)) { balance.core += 1; matched = true; }
      if (!matched) balance.other += 1;
    }
  }

  const trainingDays = plan.days.filter((d) => d.exercises.length > 0).length;
  const findings: string[] = [];

  if (trainingDays === 0) {
    findings.push("No training days authored yet — add a day and its exercises to unlock analysis.");
  } else {
    findings.push(`${trainingDays} training day${trainingDays === 1 ? "" : "s"} · ${exerciseCount} exercises · ${totalSets} working sets per week.`);
    if (balance.push > 0 && balance.pull === 0) findings.push("All pressing, no pulling — add rows or pulldowns to protect shoulder balance.");
    if (balance.pull > 0 && balance.push === 0) findings.push("All pulling, no pressing — a press pattern would round out the upper body.");
    if (balance.push > 0 && balance.pull > 0 && balance.push > balance.pull * 2) findings.push("Push volume is more than double the pull volume — consider one more pulling movement.");
    if (balance.legs === 0) findings.push("No lower-body work detected — even one leg day protects long-term structure.");
    if (balance.core === 0) findings.push("No direct core work — a short brace/anti-extension block finishes any day well.");
    if (trainingDays >= 6) findings.push("Six or more training days — protect at least one full recovery day so output stays high.");
    const heavyDays = plan.days.filter((d) => d.exercises.reduce((s, e) => s + e.sets, 0) > 25);
    if (heavyDays.length > 0) findings.push(`${heavyDays.map((d) => d.title).join(", ")}: 25+ sets in one session — consider splitting or trimming junk volume.`);
    if (findings.length === 1) findings.push("Structure reads balanced — push, pull, legs, and recovery are all represented.");
  }

  const progressionSuggestions =
    trainingDays === 0
      ? []
      : [
          "Week to week: beat one movement by +1 rep at the same load before adding weight.",
          "Add 5 lb to a compound only after hitting the top of your rep range with clean form.",
          "Every 4th week, trim ~30% of the sets and keep loads moderate — a deload keeps the plan progressing.",
          "Rotate one accessory per muscle every 3–4 weeks to avoid staleness without losing your identity.",
        ];

  return {
    headline:
      trainingDays === 0
        ? "Plan is empty"
        : `${plan.name} — ${trainingDays}-day structure`,
    balance,
    findings,
    progressionSuggestions,
  };
}
