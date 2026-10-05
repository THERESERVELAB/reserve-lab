/* ════════════════════════════════════════════════════════════════════════
   SESSION DEBRIEF — what the room says after the last set.

   Lifted out of TrainingView unchanged: the progression decision, the
   post-workout meal guidance, the debrief itself and the phase completions.
   Pure: it reads the session's own record and returns text and numbers.
   ════════════════════════════════════════════════════════════════════════ */

import type { WorkoutDemandLevel } from "@/lib/training/workout-demand";
import { Flame, Heart, ShieldCheck, Waves } from "lucide-react";

import type { CloseoutAccuracy, LogAccuracy, PostWorkoutMealGuidance, ProgressionDecision, SessionCompletion } from "@/lib/athlete-store";
import type { SessionMovement as Movement } from "@/lib/training/session-movement";
import {
  SESSION_MODES,
  parseHM,
  toneFromIntensity,
  type LiveSessionState,
  type LoggedSet,
  type SessionModeKey,
  type SessionPhaseKey,
  type SupportPhaseSlot,
} from "./session-model";
import { GOLD, STEEL, VIOLET } from "./palette";

export function sessionCompletionLabel(v: SessionCompletion | null | undefined): string {
  switch (v) {
    case "as-planned": return "Completed As Planned";
    case "partial": return "Partial Session";
    case "minimum-effective": return "Minimum Effective Session";
    case "stopped-early": return "Stopped Early";
    default: return "Pending Closeout";
  }
}

export function logAccuracyLabel(v: LogAccuracy | null | undefined): string {
  switch (v) {
    case "fully-accurate": return "Fully Accurate";
    case "mostly-accurate": return "Mostly Accurate";
    case "estimated": return "Estimated Closeout";
    default: return "Pending";
  }
}

export function progressionDecisionLabel(d: ProgressionDecision): string {
  switch (d) {
    case "aggressive": return "Aggressive Progression Available";
    case "standard": return "Standard Progression";
    case "conservative": return "Conservative Progression";
    case "hold": return "Hold Load Next Exposure";
    case "recalibrate": return "Recalibrate Next Session";
  }
}

export function getProgressionDecision(input: {
  logAccuracy: LogAccuracy;
  sessionCompletion: SessionCompletion;
  completionPct: number;
  fatigueTrend: LiveSessionState["fatigueTrend"];
}): { decision: ProgressionDecision; copy: string } {
  const { logAccuracy, sessionCompletion, completionPct, fatigueTrend } = input;
  // Stopped early — never aggressive
  if (sessionCompletion === "stopped-early") {
    return { decision: "recalibrate", copy: "Session stopped early. Recalibrate next exposure before changing loads." };
  }
  // Completed as prescribed but data is thin — data confidence is low, progression stays conservative
  if (sessionCompletion === "as-planned" && (logAccuracy === "estimated" || completionPct < 60)) {
    return { decision: "hold", copy: "Completion accepted, but data confidence is low. Hold load until the next fully logged exposure confirms the lift." };
  }
  if (sessionCompletion === "as-planned" && logAccuracy === "fully-accurate" && completionPct >= 90 && fatigueTrend !== "rising") {
    return { decision: "aggressive", copy: "Full session, fully tracked, output strong. Aggressive progression available next exposure." };
  }
  if (sessionCompletion === "as-planned" && (logAccuracy === "fully-accurate" || logAccuracy === "mostly-accurate")) {
    return { decision: "standard", copy: "Plan completed with reliable logging. Standard progression available." };
  }
  if (sessionCompletion === "minimum-effective") {
    return { decision: "conservative", copy: "Minimum effective work captured. Conservative progression — confirm with a fuller exposure." };
  }
  if (sessionCompletion === "partial") {
    return { decision: "conservative", copy: "Partial session captured. Conservative progression across the full plan until the next complete exposure." };
  }
  return { decision: "hold", copy: "Signal incomplete. Hold load next exposure." };
}

export function getPostWorkoutMealGuidance(input: {
  workoutEndDate: Date | null;
  primaryGoal: string;
  sessionCompletion: SessionCompletion;
  /** The tier the session was built with; null when unknown. */
  sessionDemand: WorkoutDemandLevel | null;
  sleepTime?: string;
}): PostWorkoutMealGuidance {
  const { workoutEndDate, primaryGoal, sessionCompletion, sessionDemand, sleepTime } = input;
  const end = workoutEndDate ?? new Date();
  const hour = end.getHours();
  // window helpers
  function addMin(mins: number) {
    const d = new Date(end.getTime() + mins * 60_000);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  // Time-of-day labels and windows
  let mealLabel: string;
  let timingWindow: string;
  let reason: string;
  if (hour >= 4 && hour < 10) {
    mealLabel = "Post-Workout Breakfast";
    timingWindow = `Target: ${addMin(60)}–${addMin(90)}`;
    reason = "Start the day fed instead of dragging recovery into work.";
  } else if (hour >= 10 && hour < 14) {
    mealLabel = "Post-Workout Lunch";
    timingWindow = `Target: ${addMin(60)}–${addMin(90)}`;
    reason = "Lunch becomes the recovery meal. Refill without overloading the afternoon.";
  } else if (hour >= 14 && hour < 18) {
    mealLabel = "Afternoon Recovery Meal";
    timingWindow = `Target: ${addMin(60)}–${addMin(120)}`;
    reason = "Practical refuel window before dinner. Keep digestion easy.";
  } else if (hour >= 18 && hour < 22) {
    mealLabel = "Recovery Dinner";
    timingWindow = `Target: ${addMin(60)}–${addMin(120)}`;
    reason = "Dinner becomes the recovery meal. Build around protein and goal-matched carbs.";
  } else {
    mealLabel = "Late Recovery Meal";
    timingWindow = `Target: ${addMin(45)}–${addMin(75)} if tolerated`;
    reason = "Keep it light, protein-focused, and digestion-friendly so sleep is not disrupted.";
  }
  // Goal logic
  const isLateNight = hour >= 22 || hour < 4;
  let emphasis: string;
  let examples: string[];
  if (isLateNight) {
    emphasis = "Easy digestion · protein-first · avoid heavy carbs or fats that disrupt sleep.";
    examples = ["Greek yogurt + berries", "Protein shake + small banana", "Egg whites + toast", "Lean turkey slices + fruit"];
  } else if (/mass|hypertrophy|grow|build|muscle/i.test(primaryGoal)) {
    emphasis = "Muscle gain — protein anchor + stronger carb refill for recovery and growth.";
    examples = ["Eggs/egg whites + oats/fruit", "Chicken + rice + vegetables", "Greek yogurt + banana + honey", "Protein shake + bagel"];
  } else if (/cut|lean|fat|loss/i.test(primaryGoal)) {
    emphasis = "Fat loss — protein anchor + controlled carbs · keep total intake honest.";
    examples = ["Chicken salad + measured rice", "Greek yogurt + berries", "Eggs + spinach + small fruit", "Lean protein + sweet potato"];
  } else if (/performance|athletic/i.test(primaryGoal)) {
    emphasis = "Performance — protein + carbs + fluids · refuel for tomorrow's output.";
    examples = ["Salmon + rice + greens", "Chicken + pasta + sauce", "Beef + potato + vegetables", "Protein + oats + fruit"];
  } else {
    emphasis = "Protein anchor + simple carb refill.";
    examples = ["Eggs + toast + fruit", "Chicken + rice", "Greek yogurt + granola", "Protein shake + banana"];
  }
  // Honest adjustment when session was thin
  if (sessionCompletion === "minimum-effective" || sessionCompletion === "stopped-early") {
    emphasis += " Session was lighter than planned — match meal size to actual output, not the prescription.";
  }
  if ((sessionDemand === "elite-volume" || sessionDemand === "contest-prep") && sessionCompletion === "as-planned") {
    emphasis += " High-demand session completed — do not skip the carb refill.";
  }
  // Schedule awareness — if sleep window is close, flag the late meal risk
  const sleep = parseHM(sleepTime);
  if (sleep) {
    const sleepMinutes = sleep.h * 60 + sleep.m;
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const cmp = sleepMinutes < endMinutes ? sleepMinutes + 1440 : sleepMinutes;
    if (cmp - endMinutes < 120) {
      emphasis += " Sleep window is close — keep this meal lighter and digestion-friendly to protect tomorrow's readiness.";
    }
  }
  return { mealLabel, timingWindow, reason, emphasis, examples };
}

export function buildDebrief(input: {
  accuracy: CloseoutAccuracy;
  logAccuracy: LogAccuracy;
  sessionCompletion: SessionCompletion;
  state: LiveSessionState;
  workoutSets: Record<string, LoggedSet[]>;
  workoutEndDate: Date | null;
  primaryGoal: string;
  sleepTime?: string;
  movements: Movement[];
  /** The tier the session was built with; null when unknown. */
  sessionDemand?: WorkoutDemandLevel | null;
}): {
  headline: string;
  confidence: "high" | "moderate" | "low";
  rating: number;
  summary: string;
  gotDone: string;
  skipped: string;
  bestOutput: string;
  limiter: string;
  targetResult: string;
  recovery: string;
  nutrition: string;
  hydration: string;
  sleep: string;
  tomorrow: string;
  nextAction: string;
  logAccuracy: LogAccuracy;
  sessionCompletion: SessionCompletion;
  progression: { decision: ProgressionDecision; copy: string };
  meal: PostWorkoutMealGuidance;
} {
  const { accuracy, logAccuracy, sessionCompletion, state, workoutSets, workoutEndDate, primaryGoal, sleepTime, movements } = input;
  // Log confidence is purely about the data
  const confidence: "high" | "moderate" | "low" =
    logAccuracy === "fully-accurate" ? "high"
    : logAccuracy === "mostly-accurate" ? "moderate"
    : "low";

  const allSets = Object.values(workoutSets).flat();
  const completedMovements = movements.filter((m) => (workoutSets[m.id]?.length ?? 0) >= m.sets);
  const skippedMovements = movements.filter((m) => (workoutSets[m.id]?.length ?? 0) === 0);
  const bestSet = allSets.slice().sort((a, b) => b.load * b.reps - a.load * a.reps)[0];
  const bestMovement = bestSet ? movements.find((m) => m.id === Object.entries(workoutSets).find(([, sets]) => sets.includes(bestSet))?.[0]) : null;

  // Rating considers both log and completion. Honest scoring:
  // - As-prescribed + full logs = strong rating; thin logs = decent but capped.
  // - Partial + accurate log = limited rating.
  // - Stopped early = lower unless minimum effective was claimed.
  const completionPct = state.completion;
  let rating = 0;
  if (sessionCompletion === "as-planned") {
    if (completionPct >= 90 && logAccuracy !== "estimated") rating = 9.0;
    else if (completionPct >= 60) rating = 8.2;
    else if (logAccuracy === "estimated") rating = 7.6; // member-reported complete, no detail
    else rating = 7.8;
  } else if (sessionCompletion === "minimum-effective") {
    rating = 7.2;
  } else if (sessionCompletion === "partial") {
    rating = completionPct >= 50 ? 6.5 : 5.6;
  } else {
    // stopped-early
    rating = 4.6;
  }
  // log-quality nudge: estimated drops slightly, fully accurate steadies
  if (logAccuracy === "estimated" && sessionCompletion !== "as-planned") rating -= 0.4;
  if (logAccuracy === "fully-accurate") rating += 0.15;
  // fatigue management nudge
  if (state.fatigueTrend === "rising" && sessionCompletion !== "as-planned") rating -= 0.3;
  rating = Math.min(9.6, Math.max(3.8, rating));
  rating = Math.round(rating * 10) / 10;

  // Headline + summary — honest, no false completion claims
  let headline: string;
  let completionLine: string;
  if (sessionCompletion === "as-planned" && completionPct >= 90) {
    headline = "Session Secured. Full plan executed.";
    completionLine = "Session completion is high.";
  } else if (sessionCompletion === "minimum-effective") {
    headline = "Session Secured. Minimum effective work logged.";
    completionLine = "Minimum effective session captured — primary output secured.";
  } else if (sessionCompletion === "partial") {
    headline = "Partial Output Captured.";
    completionLine = "Session completion was partial.";
  } else if (sessionCompletion === "stopped-early") {
    headline = "Closeout Recorded. Session stopped early.";
    completionLine = "Session was cut short.";
  } else {
    headline = "Session Secured.";
    completionLine = "Useful output captured.";
  }

  const confidenceLine =
    confidence === "high"
      ? "Log confidence is high."
      : confidence === "moderate"
        ? "Log confidence is moderate. The system will use this as a directional session note."
        : "Log confidence is low. Treated as a directional note, not a full progression anchor.";

  const summaryHonesty =
    sessionCompletion === "as-planned" && confidence === "high"
      ? "Progression can remain active if recovery closes correctly."
      : confidence === "high" && (sessionCompletion === "partial" || sessionCompletion === "minimum-effective")
        ? "Today captured useful output but does not justify aggressive progression across the full plan."
        : sessionCompletion === "stopped-early"
          ? "Recalibrate the next exposure before changing loads."
          : "Progression will stay conservative until the next clean exposure.";

  const summary = `${completionLine} ${confidenceLine} ${summaryHonesty}`;

  // Progression decision
  const progression = getProgressionDecision({
    logAccuracy,
    sessionCompletion,
    completionPct,
    fatigueTrend: state.fatigueTrend,
  });

  // Meal timing — schedule-aware
  const meal = getPostWorkoutMealGuidance({
    workoutEndDate,
    primaryGoal,
    sessionCompletion,
    sessionDemand: input.sessionDemand ?? null,
    sleepTime,
  });

  // Honest sub-cards
  const targetResult =
    sessionCompletion === "as-planned" && completionPct >= 90
      ? "Primary tissue targets were meaningfully trained."
      : completionPct >= 50
        ? "Primary tissue signal started but not fully exposed — complete next session."
        : "Target tissue barely touched today. Re-expose at the next opportunity.";

  const sleepCopy =
    sessionCompletion === "stopped-early"
      ? "Protect sleep tonight. A clean wind-down is the highest-value lever after a cut-short session."
      : "Protect your planned sleep window. Reserve recovers most while you sleep.";

  return {
    headline,
    confidence,
    rating,
    summary,
    gotDone: completedMovements.length
      ? completedMovements.map((m) => m.name).join(" · ")
      : `${state.totalLogged} sets captured across the session.`,
    skipped: skippedMovements.length
      ? skippedMovements.map((m) => m.name).slice(0, 3).join(" · ")
      : "No fully skipped movement recorded.",
    bestOutput: bestSet && bestMovement
      ? `${bestMovement.name}: ${bestSet.load} lb × ${bestSet.reps} at ${toneFromIntensity(bestSet.intensity)} effort.`
      : "No peak set recorded yet.",
    limiter: state.fatigueTrend === "rising"
      ? "Fatigue rose late. Next session should protect rest windows."
      : sessionCompletion === "stopped-early"
        ? "Session was cut short — investigate the limiter (time, joints, fuel, signal) before next exposure."
        : "Main limiter was log completeness and execution consistency.",
    targetResult,
    recovery: "Recovery window opens now. Protect joints, hydrate steadily, and downshift the nervous system.",
    nutrition: `${meal.mealLabel} · ${meal.timingWindow}. ${meal.emphasis}`,
    hydration: "Water ready. Use your normal electrolyte routine if appropriate.",
    sleep: sleepCopy,
    tomorrow: sessionCompletion === "stopped-early"
      ? "Tomorrow's readiness depends on tonight's recovery. Honest wind-down protects the next exposure."
      : "Tomorrow's readiness depends on tonight's close. Wind down on schedule.",
    nextAction: progression.decision === "recalibrate"
      ? "Log hydration, eat a calm recovery meal, and recalibrate the next session before changing loads."
      : "Log post-workout meal, refill hydration, then open the Reserve Night Brief.",
    logAccuracy,
    sessionCompletion,
    progression,
    meal,
    // Echo back for compatibility
    ...(accuracy ? {} : {}),
  };
}

export type PhaseCompletionStatus =
  | "complete"
  | "member-reported"
  | "partial"
  | "shortened"
  | "skipped"
  | "not-included"
  | "not-reached";

export function phaseCompletionLabel(s: PhaseCompletionStatus): string {
  switch (s) {
    case "complete": return "Completed";
    case "member-reported": return "Member-Reported Complete";
    case "partial": return "Partial";
    case "shortened": return "Shortened";
    case "skipped": return "Skipped";
    case "not-included": return "Not Included";
    case "not-reached": return "Not Reached";
  }
}

export function getPhaseCompletions(
  state: LiveSessionState,
  mode: SessionModeKey,
  accuracy: CloseoutAccuracy,
  supportSlots: SupportPhaseSlot[] = [],
  sessionCompletion: SessionCompletion = "as-planned",
  logAccuracy: LogAccuracy = "fully-accurate",
): Array<{ key: SessionPhaseKey; label: string; status: PhaseCompletionStatus; note: string; color: string; icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }> }> {
  const activeMode = SESSION_MODES.find((sm) => sm.key === mode) ?? SESSION_MODES[0];
  const memberSaysComplete = sessionCompletion === "as-planned";
  const memberSaysMinimum = sessionCompletion === "minimum-effective";
  const memberSaysPartial = sessionCompletion === "partial";
  const memberStoppedEarly = sessionCompletion === "stopped-early";
  const sufficientlyLogged = state.completion >= 80 && logAccuracy !== "estimated";

  // Lifting status
  let lifting: PhaseCompletionStatus;
  let liftNote: string;
  if (memberSaysComplete) {
    if (sufficientlyLogged) {
      lifting = "complete";
      liftNote = "Completion accepted. All planned work logged. Standard held.";
    } else {
      lifting = "member-reported";
      liftNote = "Completion accepted by member. Logged detail limited — performance data incomplete.";
    }
  } else if (memberSaysMinimum) {
    lifting = state.completion >= 50 ? "complete" : "partial";
    liftNote = "Minimum effective work captured. Primary output secured.";
  } else if (memberSaysPartial) {
    lifting = "partial";
    liftNote = "Partial session — main lifts logged, full plan not finished.";
  } else if (memberStoppedEarly) {
    lifting = state.completion >= 30 ? "partial" : "not-reached";
    liftNote = state.completion >= 30
      ? "Session was cut short. What landed was captured."
      : "Session was cut short before meaningful output landed.";
  } else {
    lifting = state.completion >= 95 ? "complete" : state.completion >= 60 ? "partial" : "not-reached";
    liftNote = state.completion >= 60 ? "Main lifts captured." : "Closeout recorded — main output thin.";
  }

  function supportPhaseStatus(
    phaseKey: SessionPhaseKey,
    completeNote: string,
    shortNote: string,
  ): { status: PhaseCompletionStatus; note: string } {
    const slotKey =
      phaseKey === "core-command" ? "core"
      : phaseKey === "conditioning-reserve" ? "conditioning"
      : phaseKey === "recovery-chamber" ? "recovery"
      : null;
    const slot = slotKey ? supportSlots.find((s) => s.key === slotKey) : null;

    if (slot) {
      if (!slot.included || slot.status === "not-included") {
        return { status: "not-included", note: "Dropped in this session mode." };
      }
      if (slot.status === "completed") return { status: "complete", note: completeNote };
      if (slot.status === "skipped") {
        // Skip explicitly recorded by member action — honest skip
        return { status: "skipped", note: "Marked skipped by member. No false completion recorded." };
      }
      // Member said as-prescribed but didn't explicitly mark — credit as member-reported
      if (memberSaysComplete) {
        return { status: "member-reported", note: "Completion accepted by member. Specific block not logged directly — recorded as member-reported complete." };
      }
      if (memberSaysMinimum) {
        return phaseKey === "core-command"
          ? { status: "shortened", note: "Minimum mode keeps brace work only." }
          : { status: "not-included", note: "Minimum mode dropped this block." };
      }
      if (memberStoppedEarly) {
        return { status: "not-reached", note: "Not reached before session was stopped early." };
      }
      // Partial: didn't reach but didn't claim full completion
      return { status: "not-reached", note: `${shortNote} Not completed before closeout.` };
    }
    // No slot info (legacy path) — fall back to mode + completion gates
    if (!activeMode.phases.includes(phaseKey)) return { status: "not-included", note: "Dropped in this session mode." };
    if (memberSaysComplete && !sufficientlyLogged) {
      return { status: "member-reported", note: "Completion accepted. Block not logged directly — member-reported." };
    }
    if (memberStoppedEarly) return { status: "not-reached", note: "Not reached before session was stopped early." };
    if (state.completion < 60) return { status: "not-reached", note: "Not reached before closeout." };
    if (sufficientlyLogged) return { status: "complete", note: completeNote };
    return { status: "shortened", note: shortNote };
  }

  return [
    {
      key: "primary-output",
      label: "Lifting",
      status: lifting,
      note: liftNote,
      color: GOLD,
      icon: Flame,
    },
    {
      key: "core-command",
      label: "Core Command",
      ...supportPhaseStatus("core-command", "Programmed brace + contractile work logged.", "Trimmed to one brace movement."),
      color: VIOLET,
      icon: ShieldCheck,
    },
    {
      key: "conditioning-reserve",
      label: "Conditioning Reserve",
      ...supportPhaseStatus("conditioning-reserve", "Cardio completed inside today's window.", "Shortened cooldown only."),
      color: STEEL,
      icon: Heart,
    },
    {
      key: "recovery-chamber",
      label: "Reserve Recovery Suite",
      ...supportPhaseStatus("recovery-chamber", "Selected tool completed.", "Reduced to mobility + breath."),
      color: VIOLET,
      icon: Waves,
    },
  ];
}

/** Post-session game-plan position: session sealed → where the plan stands. */
/* ────────────────────────────────────────────────────────────────────────────
   RESERVE ENHANCEMENT LOG — safe user-defined entry layer
   ──────────────────────────────────────────────────────────────────────── */



/* ────────────────────────────────────────────────────────────────────────────
   EVENING DEBRIEF (stub)
   ──────────────────────────────────────────────────────────────────────── */

