"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChevronRight,
  Circle,
  Compass,
  Dumbbell,
  Eye,
  Flame,
  Gauge,
  GraduationCap,
  Heart,
  Layers3,
  ListChecks,
  Minus,
  Moon,
  Move,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Utensils,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EnhancedRoomContext } from "@/components/enhanced/EnhancedRoomContext";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { markCompoundLogged, recordTrainingCloseOut } from "@/components/ui/reserve/log-moment/recorders";
import { TrainingResponseContext } from "@/components/response/TrainingResponseContext";
import { buildProgramDaySessionSnapshot, dateKey as programDateKey, resolveProgramDayForDate } from "@/lib/program/engine";
import { useProgramWeek } from "@/lib/program/useProgramWeek";
import { PROGRAM_OWNERSHIP_LABELS } from "@/lib/program/types";
import {
  WORKOUT_DEMAND_META,
  WORKOUT_DEMAND_ORDER,
  defaultWorkoutDemand,
  gateWorkoutDemand,
  type WorkoutDemandLevel,
} from "@/lib/training/workout-demand";
import { WorkoutDemandPanel } from "@/components/training/WorkoutDemandPanel";
import { useSafetyToolsVisible } from "@/components/authz/CapabilitiesProvider";
import { resolveCycleState, selectCurrentCycle } from "@/lib/cycle/cycle-period";
import { hasCurrentSafetyAcknowledgement } from "@/lib/safety/acknowledgement";
import { localScheduleDateKey } from "@/lib/schedule/engine";
import {
  blockPlacementLine,
  requestedDemandForToday,
  resolveBlockRelease,
  resolveTrainingBlock,
  type TrainingBlock,
} from "@/lib/training/cycle-training-block";
import { SessionExecutionLedgerPanel } from "@/components/training/SessionExecutionLedgerPanel";
import {
  CloseoutAccuracy,
  LogAccuracy,
  PostWorkoutMealGuidance,
  ProgressionDecision,
  SessionCompletion,
  StoredLoggedSet,
  StoredSubstitution,
  SupportPhaseStatus,
  useAthleteDashboardStore,
} from "@/lib/athlete-store";
import type { SessionGenerationSnapshot, TrainingOverrideAction } from "@/lib/athlete-store";
import {
  getEnhancementDailySchedule,
  todayDateString,
} from "@/lib/enhancement/schedule";
import {
  categoryLabel,
  getStackStatus,
  summarizeStack,
} from "@/lib/enhancement/status";
import {
  RECOVERY_RUNWAY,
  type RecoveryRunway,
  resolveSplitKey,
  type TemplateMovement,
  type WorkoutPhaseKey,
  type WorkoutTemplate,
  type IntensityTier,
  allTemplateMovements,
  applyProtocolIntensity,
  applyChestPriority,
  applyGlutePriority,
  applyWomensSession,
  applyExperienceScaling,
  applyWorkoutDemand,
  applyPhaseProgression,
  phaseMeta,
  type TrainingPhase,
  applyMovementPreferences,
  computeSessionMetrics,
  progressionRulesFor,
  chestReadinessFrom,
  getWorkoutTemplateForSplit,
  getArchetypeOnlyTemplate,
  resolveCorePlacement,
  applyCoreTiming,
  type CoreTiming,
  protocolIntensityTier,
  EXPERIENCE_SPECS,
  EXPERIENCE_LABEL,
  MOVEMENT_FEEDBACK_OPTIONS,
  type ChestReadiness,
  type ResolvedSplit,
  type WomensSessionKind,
  type TrainingExperience,
  type SessionMetrics,
  type MovementPreferences,
  type MovementFeedbackKind,
} from "@/lib/training/workout-templates";
import { withStartingLoads, type LoadProfile } from "@/lib/training/load-estimator";
import { resolveMemberBodyweight } from "@/lib/profile/bodyweight";
import { ActivityCoveragePanel } from "@/components/training/ActivityCoveragePanel";
import { applyGymEnvironment } from "@/lib/training/gym-substitution";
import type { UserTrainingProfile } from "@/lib/training/gym-environment";
import { getProtocol } from "@/lib/protocol/library";
import { GOLD, STEEL, GREEN, RED, AMBER, VIOLET } from "./training/palette";
import {
  buildDebrief,
  getPhaseCompletions,
  logAccuracyLabel,
  phaseCompletionLabel,
  progressionDecisionLabel,
  sessionCompletionLabel,
} from "./training/session-debrief";
import {
  SESSION_MODES,
  formatHM,
  parseHM,
  toneFromIntensity,
  type IntensityTone,
  type SupportPhaseSlot,
  type SupportPhaseStatusUI,
  type SetReview,
  type LiveSessionState,
  type LoggedSet,
  type SessionModeKey,
  type SessionPhaseKey,
  type ToneStyle,
} from "./training/session-model";
import {
  getConditioningOptions,
  getDayPrescription,
  getRecoverySuiteOptions,
  statusLabelForCardio,
  statusLabelForRecovery,
  supportStatusLabel,
  type CardioOption,
  type DaySupportPrescription,
  type RecoverySuiteOption,
} from "./training/support-prescriptions";
import {
  MovementVisualChamber,
  MuscleTargetIllustration,
  type SilhouetteGender,
} from "./training/movement-visuals";
import { ReserveAthleteDayPanel } from "@/components/training/ReserveAthleteDayPanel";
import { StillMotionProvider } from "@/components/training/room/still-motion";
import { SetLoggedMark, SetLoggedSweep } from "@/components/training/room/SetLoggedMark";
import { TrainingHorizon } from "@/components/training/room/TrainingHorizon";
import { TrainingRoomHero } from "@/components/training/room/TrainingRoomHero";
import {
  DETAIL_BAND_BLEED,
  DiscardChangesBar,
  ReserveBottomSheet,
  ReserveButton,
  ReserveDetailImage,
  ReserveDisclosure,
  ReserveSectionHeader,
  ReserveSegmented,
  ReserveSelect,
  ReserveSheetClose,
  useDirtySnapshot,
  useFormCloseGuard,
} from "@/components/ui/reserve";
import { ReserveWeekRail } from "@/components/training/ReserveWeekRail";
import { FIXED_NOON } from "@/components/apex/model/apex-format";
import { formatTime12 } from "@/lib/schedule/engine";
import { toApexWeekDays } from "@/lib/training/daily-context";
import { buildSessionHorizon, postSessionWindow, type SessionHorizonBlock } from "@/lib/training/session-horizon";
import {
  formatClockSeconds,
  programSourceLine,
  readinessRead,
  restClock,
  sessionClockLead,
  sessionMetric,
  sessionVolume,
  todaySessionOwner,
  trainingHeroCopy,
  trainingPrimaryAction,
  type TrainingPrimaryKind,
} from "@/lib/training/training-room";
import { useAmbientMotionStore } from "@/lib/ui/ambient-motion-store";
import { getArchitectureForSystem, lowerDaysPerWeek } from "@/lib/training/split-architectures";
import {
  resolveDailyTrainingContext,
  type ResolvedDay,
} from "@/lib/training/daily-context";
import { getSplitSystem } from "@/lib/training/split-architect";
import { formatSplitDistance } from "@/lib/training/split-customization";
import {
  familyArchitectureName,
  familyForCategory,
  isSpecializedFamily,
  resolveFocusArchitecture,
  type ProtocolFamily,
} from "@/lib/protocol/architecture";
import { buildTrainingIntelligence } from "@/lib/training/plateau-engine";
import {
  completedSplitDaysThisWeek,
  resolveGamePlanWeek,
  type GamePlanWeek,
} from "@/lib/training/game-plan";
import { isReserveAthlete } from "@/lib/training/reserve-athlete";
import { getBlueprintForProtocol } from "@/lib/training/split-blueprints";
import { getRecentTrainingLogs, saveTrainingLog } from "@/lib/logging/store";
import {
  buildMovementHistory,
  detectSessionPRs,
  historyForMovement,
  type MovementHistoryMap,
  type MovementHistoryRead,
} from "@/lib/training/challenge";
import { SplitArchitectPanel } from "./training/SplitArchitectPanel";
import { WeekPlanningPanel } from "./training/WeekPlanningPanel";
import { TrainingPhasePanel } from "@/components/women/phase-panels";
import { CustomPlansPanel } from "@/components/training/CustomPlansPanel";
import { ScheduleFlexPanel } from "./training/ScheduleFlexPanel";
import { TrainingIntelligencePanel } from "./training/TrainingIntelligencePanel";
import { TrainingProfileCard } from "./training/TrainingProfileCard";
import { computeProfileCompleteness } from "@/lib/training/gym-environment";
import { buildRecoverySnapshot } from "@/lib/recovery/engine";
import { useActiveProgram } from "@/lib/hooks/useActiveProgram";
import { applyHorizonWeekTargets, freezeHorizonSessionReference, trainingPhaseFromHorizon } from "@/lib/horizon/training-adapter";
import { goalKeyFromString } from "@/lib/nutrition/adapter";
import { ViewShell } from "./ViewShell";
import { localDateKey } from "@/lib/dates/local-day";

/* ────────────────────────────────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────────────────────────────── */



/* Session movement shapes moved to lib/training/session-movement so the
   custom-workout session bridge builds the exact queue shape the cockpit
   renders. Local aliases keep the rest of this file unchanged. */
type SwapReason = import("@/lib/training/session-movement").SwapReason;
type MovementSub = import("@/lib/training/session-movement").MovementSub;
type MovementEducation = import("@/lib/training/session-movement").MovementEducation;
type EquipmentKind = import("@/lib/training/session-movement").EquipmentKind;
type Movement = import("@/lib/training/session-movement").SessionMovement;

type ProfileContext = {
  experienceLevel: string;
  injuryNotes: string;
  lifeStages: string[];
  healthContext: string[];
  readiness: number | null;
  hasStrengthHistory: boolean;
  fatigueSensitivity: string;
  recoveryAggression: string;
  goal: string;
  tone: ToneStyle;
};


/* ────────────────────────────────────────────────────────────────────────────
   CONSTANTS
   ──────────────────────────────────────────────────────────────────────── */



const SPLIT_NAME = "Reserve Strength + Physique Rotation";

/* ────────────────────────────────────────────────────────────────────────────
   TIME / GREETING HELPERS
   ──────────────────────────────────────────────────────────────────────── */

function useLiveTime() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const frame = requestAnimationFrame(tick);
    const id = setInterval(tick, 30_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(id);
    };
  }, []);
  return now;
}

function getGreeting(hour: number, name: string, tone: ToneStyle): { greeting: string; icon: typeof Sun } {
  const safeName = name && name.length > 0 ? name : "Athlete";
  if (hour >= 5 && hour < 12) {
    if (tone === "stoic") return { greeting: `Good morning, ${safeName}`, icon: Sunrise };
    if (tone === "refined") return { greeting: `Good morning, ${safeName}`, icon: Sunrise };
    return { greeting: `Good morning, ${safeName}`, icon: Sunrise };
  }
  if (hour >= 12 && hour < 17) {
    return { greeting: `Good afternoon, ${safeName}`, icon: Sun };
  }
  if (hour >= 17 && hour < 21) {
    return { greeting: `Good evening, ${safeName}`, icon: Sunset };
  }
  if (hour >= 21 && hour < 24) {
    if (tone === "stoic") return { greeting: `Late watch, ${safeName}`, icon: Moon };
    if (tone === "refined") return { greeting: `Good evening, ${safeName}`, icon: Moon };
    return { greeting: `Good evening, ${safeName}`, icon: Moon };
  }
  return { greeting: `Recovery window, ${safeName}`, icon: Moon };
}

function formatClock(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function getDayIndex(d: Date | null): number {
  if (!d) return -1;
  const map = [6, 0, 1, 2, 3, 4, 5]; // JS Sunday=0 -> our Mon=0
  return map[d.getDay()] ?? -1;
}

/* ────────────────────────────────────────────────────────────────────────────
   TONE-AWARE COPY
   ──────────────────────────────────────────────────────────────────────── */

function getTone(genderIdentity: string | undefined): ToneStyle {
  if (genderIdentity === "male") return "stoic";
  if (genderIdentity === "female") return "refined";
  return "neutral";
}

/* ────────────────────────────────────────────────────────────────────────────
   SET / LOAD / REVIEW HELPERS
   ──────────────────────────────────────────────────────────────────────── */

function toneColor(t: IntensityTone): string {
  if (t === "Limit") return RED;
  if (t === "Productive") return GREEN;
  return STEEL;
}
function roundLoad(v: number, step = 5): number {
  return Math.max(0, Math.round(v / step) * step);
}

function buildSetReview(m: Movement, load: number, reps: number, intensity: number, history: LoggedSet[], ctx: ProfileContext): SetReview {
  const tone = toneFromIntensity(intensity);
  const setNumber = history.length;
  const isFinal = setNumber >= m.sets;
  const isFirst = setNumber === 1;
  const target = m.primaryMuscles[0] ?? m.target;
  const stimulus =
    tone === "Limit"
      ? `High-tension load delivered into ${target.toLowerCase()}. Mechanical tension landed at the top of today's growth signal.`
      : tone === "Productive"
        ? `Productive stimulus into ${target.toLowerCase()} — sufficient tension to drive adaptation without overdrawing the reserve.`
        : `Controlled tension into ${target.toLowerCase()}. Pattern work is loading the system without crossing the fatigue line.`;
  const repParts = m.reps.split("-").map((n) => parseInt(n, 10));
  const lowT = repParts[0] ?? reps;
  const highT = repParts[1] ?? lowT;
  const performance =
    reps >= highT
      ? `You hit the top of the target range at ${load} lb × ${reps}. Output is climbing.`
      : reps >= lowT
        ? `You matched the target range at ${load} lb × ${reps} under ${tone.toLowerCase()} effort.`
      : `Reps fell below the target range. ${load} lb × ${reps} under ${tone.toLowerCase()} effort — output is asking for protection.`;
  let coachDecision: string;
  if (isFirst) {
    coachDecision =
      tone === "Limit"
        ? "First set already at limit. Hold load and protect remaining sets — do not let ego compound fatigue."
        : tone === "Controlled"
          ? "Pattern is dialed and there is reserve. Tighten focus and raise intent."
          : "Working load confirmed. Hold and chase reps in the productive window.";
  } else if (isFinal) {
    coachDecision =
      tone === "Limit"
        ? "Final set executed at limit. Full rest, switch movements, protect cumulative output."
        : "Final set complete. If reps land near the top of range next session, advance load 5–10 lb.";
  } else if (tone === "Limit") {
    coachDecision = `Fatigue accumulating. Hold ${load} lb — only repeat if press path stays clean.`;
  } else {
    coachDecision = `Hold ${load} lb. Match or beat ${reps} reps next set. Add load only when reps consistently hit the top of range.`;
  }
  const goalImpact = /cut|lean|fat/i.test(ctx.goal)
    ? `Maintains ${target.toLowerCase()} density during the cut and protects the standard you brought into peak prep.`
    : /mass|hypertrophy|grow|build/i.test(ctx.goal)
      ? `Adds growth volume to ${target.toLowerCase()} — exactly the tissue your archetype targets first.`
      : `Reinforces ${target.toLowerCase()} development and the torso line you are training to refine.`;
  const nextSetRecommendation = isFinal
    ? `Move to the next movement. Reset rest, reset focus, protect cumulative output.`
    : tone === "Limit"
      ? `${load} lb target · rest ${m.rest} · only repeat if press path stays clean.`
      : tone === "Productive"
        ? `${load} lb target · rest ${m.rest} · chase the top of ${m.reps} reps.`
        : `${roundLoad(load + (load > 120 ? 5 : 2.5))} lb target · rest ${m.rest} · raise intent, keep pattern.`;
  const restDirective = isFinal
    ? "Full reset. Hydrate, breathe, transition cleanly."
    : tone === "Limit"
      ? `Rest at the top of ${m.rest}. Do not compress recovery between limit sets.`
      : `Rest ${m.rest}. Stay still — pacing the rest is part of the lift.`;
  return { stimulus, performance, coachDecision, goalImpact, nextSetRecommendation, restDirective };
}


/* ────────────────────────────────────────────────────────────────────────────
   MEANINGFUL OUTPUT GATE
   Determines whether a live session has produced enough output to warrant
   normal end-session debrief. A session with only warm-up taps or a single
   accidental set should NOT trigger post-workout logic.

   Current liveState does not distinguish working sets from warm-up sets, so
   we use both signals as OR — either alone is enough to qualify.
   ──────────────────────────────────────────────────────────────────────── */

function hasMeaningfulTrainingOutput(state: { totalLogged: number; completion: number }): boolean {
  return state.totalLogged >= 1 || state.completion >= 10;
}

/* ────────────────────────────────────────────────────────────────────────────
   LIVE SESSION RESERVE COPY ENGINE
   ──────────────────────────────────────────────────────────────────────── */

function computeLiveSessionState(workoutSets: Record<string, LoggedSet[]>, total: number): LiveSessionState {
  const totalLogged = Object.values(workoutSets).reduce((sum, sets) => sum + sets.length, 0);
  const completion = Math.min(100, Math.round((totalLogged / Math.max(total, 1)) * 100));
  const allSets: LoggedSet[] = Object.values(workoutSets).flat();
  const limitCount = allSets.filter((s) => s.tone === "Limit").length;
  const fatigueTrend: LiveSessionState["fatigueTrend"] =
    limitCount >= 4 ? "rising" : limitCount >= 2 ? "stable" : "controlled";
  let phase: LiveSessionState["phase"] = "warmup";
  if (completion === 100) phase = "complete";
  else if (completion >= 75) phase = "late";
  else if (completion >= 40) phase = "mid";
  else if (completion >= 10) phase = "early";
  return { totalLogged, totalSets: total, completion, fatigueTrend, phase };
}

/* ────────────────────────────────────────────────────────────────────────────
   NEXT BEST ACTION
   ──────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
   STATIC DATA
   ──────────────────────────────────────────────────────────────────────── */

/* The 7-day week now comes from the unified daily-training context (resolved
   per the active architecture + focus), so Training and Apex never drift and a
   specialized architecture never renders the canonical bodybuilding week. */

const SET_PURPOSE_LABELS_5 = ["Primer", "Build", "Output", "Reinforce", "Finish"] as const;
const SET_PURPOSE_LABELS_4 = ["Primer", "Build", "Output", "Finish"] as const;
const SET_PURPOSE_LABELS_3 = ["Primer", "Output", "Finish"] as const;
const SET_PURPOSE_LABELS_2 = ["Output", "Finish"] as const;

function getSetPurpose(setIndex: number, totalSets: number): { label: string; intent: string; color: string } {
  const purposes =
    totalSets >= 5 ? SET_PURPOSE_LABELS_5
    : totalSets === 4 ? SET_PURPOSE_LABELS_4
    : totalSets === 3 ? SET_PURPOSE_LABELS_3
    : totalSets === 2 ? SET_PURPOSE_LABELS_2
    : (["Output"] as const);
  const safeIndex = Math.min(setIndex, purposes.length - 1);
  const label = purposes[safeIndex];
  const intent =
    label === "Primer" ? "Pattern, range, tissue connection. No ego load."
    : label === "Build" ? "Controlled load. Confirm the target window."
    : label === "Output" ? "Strongest clean working set. Earn the rep."
    : label === "Reinforce" ? "Match reps. Protect form, no junk volume."
    : "Controlled hard set. Finish at the standard.";
  const color =
    label === "Primer" ? STEEL
    : label === "Build" ? STEEL
    : label === "Output" ? GOLD
    : label === "Reinforce" ? AMBER
    : RED;
  return { label, intent, color };
}

function getLoadUnit(m: Movement): { unit: string; note: string } {
  if (m.mode === "dumbbell" || m.equipmentKind === "dumbbell") {
    return { unit: "lb per hand", note: "Per hand · each dumbbell weighs this" };
  }
  if (m.equipmentKind === "barbell") {
    return { unit: "lb total", note: "Total bar + plates" };
  }
  if (m.equipmentKind === "smith") {
    return { unit: "lb on bar", note: "Guided bar · loaded plates only" };
  }
  if (m.equipmentKind === "cable") {
    return { unit: "lb stack", note: "Cable stack pin position" };
  }
  return { unit: "lb stack", note: "Machine stack pin position" };
}

function loadDisplayValue(m: Movement): string {
  /* The member's own last top set first — a real logged number always outranks
     an estimate. Failing that, the starting estimate built from THEIR body
     data (never the old authored constants, which told every member 225).
     With no bodyweight on file there is nothing to estimate, so we ask. */
  if (m.lastLoad && m.lastLoad > 0) return `${m.lastLoad}`;
  if (m.loadIsEstimate && m.suggestedLoad > 0) return `${m.suggestedLoad}`;
  return "Set your load";
}

function movementRoleLabel(m: Movement): string {
  return m.roleLabel ?? "PRIMARY OUTPUT";
}

function movementTempoValue(m: Movement): string {
  return m.tempo ?? "3-1-1-0";
}

const MOVEMENTS: Movement[] = [
  {
    id: "low-incline-barbell",
    name: "Low Incline Barbell Press",
    purpose: "Heavy upper-chest tension before fatigue dilutes the press.",
    target: "Upper chest",
    region: "Clavicular pec fibers",
    sets: 5,
    reps: "4-6",
    suggestedLoad: 225,
    mode: "barbell",
    equipmentKind: "barbell",
    equipmentName: "Olympic Barbell · Adjustable Bench",
    setupNote: "Bench set to 15–30°. Eyes under the bar. Shoulder blades pinned, feet planted, ribcage stacked.",
    rirTargets: ["2 RIR", "2 RIR", "1 RIR", "1 RIR", "0-1 RIR"],
    rest: "2:45-3:15",
    restSeconds: 180,
    cue: "Bar to upper chest, elbows at 45 degrees, pause the stretch, then drive clean.",
    physiqueImpact: "Builds the shelf that makes the torso look wider and more controlled.",
    whyLoad: "Add load only when every set reaches the top of the rep range with clean reps.",
    primaryMuscles: ["Upper Chest"],
    secondaryMuscles: ["Front Delts", "Triceps"],
    stabilizers: ["Scaps", "Core Brace"],
    education: {
      whyHere: "Today's upper-chest foundation. Places high-tension loading into clavicular pec fibers before fatigue reduces pressing quality.",
      whatToFeel: "A deep upper-chest stretch at the bottom, then a clean upward drive without the shoulders taking over.",
      goalConnection: "Builds the upper shelf that makes the torso look wider, fuller, and more athletic from every angle.",
      commonError: "Bench angle climbing past 30° converts this into a delt-dominant press and drains the chest signal.",
      stretchFocus: "Controlled upper-chest stretch at bottom — pause briefly, do not bounce.",
      contractionFocus: "Drive elbows in and up. Press the bar away and slightly toward the chin line.",
    },
    substitutions: [
      { name: "Smith Low Incline Press", equipment: "Smith Machine", reasons: ["machine-occupied", "joint-discomfort"], preservesStimulus: true, intentLine: "Same angle · same tissue · lower joint cost", note: "Fixed bar path reduces shoulder stress and keeps the upper-chest line intact." },
      { name: "Low Incline Dumbbell Press", equipment: "Dumbbells · Adjustable Bench", reasons: ["machine-occupied", "home-hotel", "no-equipment"], preservesStimulus: true, intentLine: "Original intent protected · superior stretch", note: "Full range of motion with deeper bottom stretch. Control tempo to offset the lack of fixed path." },
      { name: "Neutral-Grip Machine Incline Press", equipment: "Plate-Loaded Machine", reasons: ["joint-discomfort", "low-readiness"], preservesStimulus: true, intentLine: "Same stimulus · joint-friendly path", note: "Neutral grip reduces shoulder strain. Use when pressing feels off in the shoulder, not the chest." },
      { name: "Cable Incline Fly + Mechanical Drop", equipment: "Cable Stack · Adjustable Bench", reasons: ["low-readiness", "need-faster", "feels-wrong"], preservesStimulus: false, intentLine: "Tissue preserved · lower system cost", note: "Lower joint load, preserves chest stretch. Use 3 sets to mechanical failure as a low-CNS substitute." },
    ],
  },
  {
    id: "hammer-incline",
    name: "Plate-Loaded Incline Press",
    purpose: "Stable volume after the compound primer.",
    target: "Upper chest",
    region: "Upper and mid pec tie-in",
    sets: 4,
    reps: "8-10",
    suggestedLoad: 180,
    mode: "machine",
    equipmentKind: "machine",
    equipmentName: "Plate-Loaded Incline Press",
    setupNote: "Seat set so handles align with mid-clavicle. Ribcage stacked, scapula pulled down and back.",
    rirTargets: ["2 RIR", "2 RIR", "1 RIR", "1 RIR"],
    rest: "2:00",
    restSeconds: 120,
    cue: "Drive handles up and in without losing ribs-down control.",
    physiqueImpact: "Adds repeatable growth volume without taxing the low back or setup.",
    whyLoad: "Match your last clean load and earn one more rep before adding weight.",
    primaryMuscles: ["Upper Chest", "Mid Chest"],
    secondaryMuscles: ["Front Delts", "Triceps"],
    stabilizers: ["Serratus", "Mid Traps"],
    education: {
      whyHere: "Second pressing exposure with a stable path. Banks repeatable hypertrophy volume after the compound has done its CNS work.",
      whatToFeel: "Continuous tension across the upper and mid chest. Pump should arrive by set 2 and stay through the end.",
      goalConnection: "Growth volume vehicle. Stable path means more clean reps, more tissue signal, less wasted effort.",
      commonError: "Flaring elbows too wide or letting shoulders roll forward — both rob the chest of tension.",
      stretchFocus: "Brief stretch at the bottom — no bounce, no lockout pause.",
      contractionFocus: "Squeeze the chest at the top without locking out.",
    },
    substitutions: [
      { name: "Incline Dumbbell Press", equipment: "Dumbbells · Adjustable Bench", reasons: ["machine-occupied", "home-hotel"], preservesStimulus: true, intentLine: "Same angle · same stimulus", note: "Identical chest signal. Use controlled tempo to offset the lack of machine stability." },
      { name: "Incline Cable Press", equipment: "Dual Cable Stack", reasons: ["machine-occupied", "joint-discomfort"], preservesStimulus: true, intentLine: "Constant tension preserved", note: "Cables keep tension on the chest throughout. Joint-friendly and stable." },
      { name: "Pec Deck — Incline Variation", equipment: "Pec Deck", reasons: ["joint-discomfort", "low-readiness"], preservesStimulus: false, intentLine: "Tissue preserved · lower joint cost", note: "Reduces compound load. Preserves chest stretch and contraction arc when pressing feels off." },
      { name: "Push-Up + Mechanical Drop", equipment: "Bodyweight", reasons: ["no-equipment", "home-hotel", "need-faster"], preservesStimulus: false, intentLine: "Travel-ready · chest tension preserved", note: "Elevate feet for upper-chest bias, drop to flat for the back half. Two mechanical drops per set." },
    ],
  },
  {
    id: "low-incline-db",
    name: "Low Incline Dumbbell Press",
    purpose: "Deep upper-chest range with unilateral control after the heavy primer.",
    target: "Upper chest",
    region: "Clavicular pec stretch line",
    sets: 4,
    reps: "8-12",
    suggestedLoad: 85,
    mode: "dumbbell",
    equipmentKind: "dumbbell",
    equipmentName: "Dumbbells · Adjustable Bench",
    setupNote: "Bench low incline. Dumbbells start just outside upper chest. Wrists stacked, ribs down.",
    rirTargets: ["2 RIR", "2 RIR", "1 RIR", "1 RIR"],
    rest: "2:00",
    restSeconds: 120,
    cue: "Lower with control, feel the upper-chest stretch, then press toward the eye line.",
    physiqueImpact: "Builds fuller upper-chest shape while exposing left/right control gaps.",
    whyLoad: "Per-hand load is based on prior clean dumbbell work. Calibrate down if setup feels unstable.",
    primaryMuscles: ["Upper Chest"],
    secondaryMuscles: ["Front Delts", "Triceps"],
    stabilizers: ["Rotator Cuff", "Serratus", "Core Brace"],
    education: {
      whyHere: "Third upper-chest exposure. Dumbbells add stretch, stability demand, and side-to-side quality control after fixed-path pressing.",
      whatToFeel: "A clean stretch across the upper chest with no shoulder pinch, then an even drive from both sides.",
      goalConnection: "Adds the fuller upper shelf that makes the torso read wide and athletic without relying on one pressing pattern.",
      commonError: "Letting the dumbbells drift too low or flare too wide. Keep the line upper chest, not front shoulder.",
      stretchFocus: "Controlled bottom range with shoulder blades pinned and wrists stacked.",
      contractionFocus: "Press up and slightly in without crashing the dumbbells together.",
    },
    substitutions: [
      { name: "Low Incline Machine Press", equipment: "Plate-Loaded Machine", reasons: ["machine-occupied", "joint-discomfort", "low-readiness"], preservesStimulus: true, intentLine: "Same angle · more stability", note: "Preserves upper-chest output with less setup demand and lower shoulder noise." },
      { name: "Feet-Elevated Push-Up", equipment: "Bodyweight", reasons: ["home-hotel", "no-equipment", "need-faster"], preservesStimulus: false, intentLine: "Travel-ready · upper-chest bias", note: "Elevate feet and control tempo. Use higher reps to preserve tissue signal." },
      { name: "Single-Arm Cable Incline Press", equipment: "Cable Stack", reasons: ["feels-wrong", "joint-discomfort"], preservesStimulus: true, intentLine: "Unilateral · constant tension", note: "One arm at a time to clean up path and keep the chest, not the shoulder, leading the rep." },
    ],
  },
  {
    id: "low-to-high-cable-fly",
    name: "Low-to-High Cable Fly",
    purpose: "Upper-chest shape work without another heavy press.",
    target: "Upper chest",
    region: "Upper pec sweep",
    sets: 4,
    reps: "12-15",
    suggestedLoad: 35,
    mode: "machine",
    equipmentKind: "cable",
    equipmentName: "Dual Cable Stack · D-Handles",
    setupNote: "Cables low, one step forward. Hands travel from low ribs toward the upper-chest line.",
    rirTargets: ["2 RIR", "2 RIR", "1 RIR", "0-1 RIR"],
    rest: "1:15",
    restSeconds: 75,
    cue: "Sweep up and in. Stop before shoulders roll forward or traps take over.",
    physiqueImpact: "Finishes the chest with shape and contraction instead of noisy extra pressing.",
    whyLoad: "Small progression only. If shoulder position changes, stay at last clean load.",
    primaryMuscles: ["Upper Chest"],
    secondaryMuscles: ["Inner Chest"],
    stabilizers: ["Scaps", "Deep Core"],
    education: {
      whyHere: "Shape and contraction exposure. It keeps upper-chest tissue active after pressing without adding another high-joint-cost set.",
      whatToFeel: "A stretch at the bottom with the chest open, then a clean upward squeeze across the clavicle line.",
      goalConnection: "Improves the upper-chest line and the visual transition from pec to shoulder.",
      commonError: "Turning it into a front-delt raise. The hands travel up, but the chest must close the arc.",
      stretchFocus: "Open the chest at the bottom without letting shoulders dump forward.",
      contractionFocus: "Bring hands up and in until the upper chest shortens, then control the return.",
    },
    substitutions: [
      { name: "Incline Cable Fly", equipment: "Cable Stack · Incline Bench", reasons: ["machine-occupied", "feels-wrong"], preservesStimulus: true, intentLine: "Same tissue · longer stretch", note: "Bench support improves control while preserving the upper-chest arc." },
      { name: "Low Incline Dumbbell Fly", equipment: "Dumbbells · Adjustable Bench", reasons: ["no-equipment", "home-hotel"], preservesStimulus: true, intentLine: "Same angle · simple setup", note: "Use a conservative load and soft elbows. Chase stretch and control, not max range." },
      { name: "Cable Press-Around", equipment: "Cable Stack", reasons: ["joint-discomfort", "low-readiness"], preservesStimulus: true, intentLine: "Joint-friendly · upper-chest line", note: "Press and sweep across the body to reduce shoulder strain while preserving target tissue." },
    ],
  },
  {
    id: "incline-smith-backoff",
    name: "Incline Smith Press Back-Off",
    purpose: "Controlled final press to lock in upper-chest density after primary work.",
    target: "Upper chest",
    region: "Upper and mid pec density",
    sets: 3,
    reps: "10-12",
    suggestedLoad: 185,
    mode: "machine",
    equipmentKind: "smith",
    equipmentName: "Smith Machine · Low Incline Bench",
    setupNote: "Bench low incline. Bar descends to upper chest with the same touch point every rep.",
    rirTargets: ["2 RIR", "1 RIR", "1 RIR"],
    rest: "1:45",
    restSeconds: 105,
    cue: "Stack the ribs, keep elbows under the bar, and make every rep look identical.",
    physiqueImpact: "Adds enough repeatable upper-chest work for a true flagship session without junk volume.",
    whyLoad: "Back-off press should feel precise, not reckless. Reduce load if the path changes.",
    primaryMuscles: ["Upper Chest"],
    secondaryMuscles: ["Mid Chest", "Triceps"],
    stabilizers: ["Scaps", "Serratus"],
    education: {
      whyHere: "Back-off press exposure. Stable path lets you bank productive volume after the harder free-weight work is already done.",
      whatToFeel: "Consistent upper-chest pressure from first rep to last with no shoulder takeover.",
      goalConnection: "Secures density and repeatable hypertrophy volume without extending the heavy loading window.",
      commonError: "Letting fatigue make the touch point drift. If the bar path changes, the set is no longer useful.",
      stretchFocus: "Same controlled touch point on every rep, no bounce.",
      contractionFocus: "Drive the bar with chest intent and stop short of a lazy lockout.",
    },
    substitutions: [
      { name: "Neutral-Grip Machine Incline", equipment: "Plate-Loaded Machine", reasons: ["joint-discomfort", "machine-occupied"], preservesStimulus: true, intentLine: "Original intent protected", note: "Keeps the back-off press stable with less shoulder demand." },
      { name: "Incline Push-Up Mechanical Drop", equipment: "Bodyweight", reasons: ["home-hotel", "no-equipment", "need-faster"], preservesStimulus: false, intentLine: "Lower demand · chest finish", note: "Use controlled high reps and drop the incline only when reps slow." },
      { name: "Cable Incline Press", equipment: "Dual Cable Stack", reasons: ["feels-wrong", "low-readiness"], preservesStimulus: true, intentLine: "Constant tension · lower joint cost", note: "Preserves pressing intent while reducing fixed-bar stress." },
    ],
  },
  {
    id: "wide-pulldown",
    name: "Wide Grip Lat Pulldown",
    purpose: "Primary vertical pull for width and V-taper.",
    target: "Lats",
    region: "Lower lat sweep",
    sets: 5,
    reps: "8-10",
    suggestedLoad: 175,
    mode: "machine",
    equipmentKind: "cable",
    equipmentName: "Cable Stack · Wide Lat Bar",
    setupNote: "Thighs locked under pad. Slight torso lean back, chest up, eyes forward.",
    rirTargets: ["2 RIR", "2 RIR", "1 RIR", "1 RIR", "0-1 RIR"],
    rest: "2:30",
    restSeconds: 150,
    cue: "Depress the shoulder blades first, then drive elbows toward back pockets.",
    physiqueImpact: "Expands the shoulder-to-waist illusion without chasing messy load.",
    whyLoad: "Add load only when every set reaches the top of the rep range cleanly.",
    primaryMuscles: ["Lats"],
    secondaryMuscles: ["Rear Delts", "Biceps", "Mid Back"],
    stabilizers: ["Lower Traps", "Forearms"],
    education: {
      whyHere: "Primary vertical pulling exposure. Trains the lats through full range under load — the foundation of upper back width.",
      whatToFeel: "Lats stretched at the top, then a controlled drive of the elbows down and toward your back pockets.",
      goalConnection: "V-taper builder. Wider lats narrow the apparent waist and complete the torso line.",
      commonError: "Pulling with the biceps and shrugging up at the top. Depress the shoulder blades first.",
      stretchFocus: "Full lat stretch at the top — let the shoulders elevate slightly before initiating the pull.",
      contractionFocus: "Drive elbows toward the floor. Squeeze the lats at the bottom.",
    },
    substitutions: [
      { name: "Neutral Grip Pulldown", equipment: "Cable Stack · V-Handle", reasons: ["joint-discomfort"], preservesStimulus: true, intentLine: "Lat signal preserved · joint-friendly", note: "Reduces elbow and shoulder stress. Slightly more mid-back involvement." },
      { name: "Assisted Pull-Up", equipment: "Pull-Up Bar · Assisted Machine", reasons: ["machine-occupied", "home-hotel"], preservesStimulus: true, intentLine: "Original pattern · deeper stretch", note: "Superior lat stretch at the top. Use a band or assisted machine to keep reps in range." },
      { name: "Single-Arm Cable Pulldown", equipment: "Cable Stack · D-Handle", reasons: ["machine-occupied", "low-readiness"], preservesStimulus: true, intentLine: "Unilateral · same tissue", note: "One side at a time. Improves connection on the lagging side. Lower spinal load." },
      { name: "Banded Lat Pulldown", equipment: "Heavy Resistance Band", reasons: ["no-equipment", "home-hotel"], preservesStimulus: false, intentLine: "Travel-ready · lat pattern preserved", note: "Anchor band high. High reps to compensate for reduced resistance curve." },
    ],
  },
  {
    id: "chest-supported-row",
    name: "Chest-Supported Row",
    purpose: "Heavy back density without spending the lower-back reserve.",
    target: "Mid back + lats",
    region: "Mid-back shelf and lat tie-in",
    sets: 4,
    reps: "8-10",
    suggestedLoad: 160,
    mode: "machine",
    equipmentKind: "machine",
    equipmentName: "Chest-Supported Row Machine",
    setupNote: "Chest pinned to pad, neutral spine, handles aligned with lower ribs.",
    rirTargets: ["2 RIR", "2 RIR", "1 RIR", "1 RIR"],
    rest: "2:15",
    restSeconds: 135,
    cue: "Pull elbows back and slightly down. Pause without letting the chest leave the pad.",
    physiqueImpact: "Builds dense mid-back thickness while preserving the session reserve for later pulls.",
    whyLoad: "Progress only if the chest stays pinned and the pause is honest.",
    primaryMuscles: ["Mid Back", "Lats"],
    secondaryMuscles: ["Rear Delts", "Biceps"],
    stabilizers: ["Lower Traps", "Forearms"],
    education: {
      whyHere: "Primary supported row. It adds dense back volume without asking the lower back to brace another hard set.",
      whatToFeel: "Lats and mid-back shortening together while the torso stays locked to the pad.",
      goalConnection: "Adds the back thickness that makes the torso look powerful from the side and rear.",
      commonError: "Lifting the chest off the pad to finish reps. That turns density work into momentum.",
      stretchFocus: "Let the shoulder blades reach forward without losing chest contact.",
      contractionFocus: "Pause with elbows behind the body and shoulder blades tucked down.",
    },
    substitutions: [
      { name: "Seal Row", equipment: "Bench · Barbell or Dumbbells", reasons: ["machine-occupied"], preservesStimulus: true, intentLine: "Same support · same density", note: "Chest support remains the priority. Use a strict pause at the top." },
      { name: "Cable Row Chest-Supported", equipment: "Cable Stack · Incline Bench", reasons: ["joint-discomfort", "low-readiness"], preservesStimulus: true, intentLine: "Constant tension · lower joint cost", note: "Set the bench in front of a low cable and preserve the supported row pattern." },
      { name: "One-Arm Dumbbell Row", equipment: "Dumbbell · Bench", reasons: ["home-hotel", "no-equipment"], preservesStimulus: true, intentLine: "Same tissue · simpler setup", note: "Brace hard and pull toward the hip to preserve lat and mid-back intent." },
    ],
  },
  {
    id: "meadows-row",
    name: "Meadows Row",
    purpose: "Unilateral lat and upper-back detail.",
    target: "Lats + mid back",
    region: "Lat sweep and rear-delt tie-in",
    sets: 4,
    reps: "8-10",
    suggestedLoad: 95,
    mode: "barbell",
    equipmentKind: "barbell",
    equipmentName: "Landmine · Olympic Barbell",
    setupNote: "Bar wedged in corner or landmine. Stand perpendicular, hips back, free hand braced on knee.",
    rirTargets: ["2 RIR", "2 RIR", "1 RIR", "1 RIR"],
    rest: "2:00",
    restSeconds: 120,
    cue: "Hips back, slight rotation, elbow high, no bicep-dominant pulling.",
    physiqueImpact: "Adds density that makes the back read athletic from every angle.",
    whyLoad: "Add a small load only when sets finish with reps left in reserve and the path stays clean.",
    primaryMuscles: ["Lats", "Mid Back"],
    secondaryMuscles: ["Rear Delts", "Biceps", "Rhomboids"],
    stabilizers: ["Spinal Erectors", "Obliques"],
    education: {
      whyHere: "Unilateral horizontal pull. Adds back density and corrects side-to-side imbalances that bilateral work cannot reach.",
      whatToFeel: "Stretch through the lat as the arm extends, then a tight squeeze at the top as the elbow drives high.",
      goalConnection: "3D back density that separates a built physique from a tall, flat one. Pure detail work.",
      commonError: "Pulling with the bicep and finishing low. Drive the elbow high and toward the hip.",
      stretchFocus: "Let the arm fully extend and the lat lengthen. Do not cut the bottom short.",
      contractionFocus: "Pause briefly at the top with the elbow high. Feel the lat shorten before lowering.",
    },
    substitutions: [
      { name: "Single-Arm Dumbbell Row", equipment: "Dumbbell · Bench", reasons: ["home-hotel", "no-equipment"], preservesStimulus: true, intentLine: "Classic unilateral · same pattern", note: "Brace on a bench. Drive the elbow, not the hand. Keep the back flat and pull toward the hip." },
      { name: "Single-Arm Cable Row", equipment: "Cable Stack · D-Handle", reasons: ["joint-discomfort", "machine-occupied"], preservesStimulus: true, intentLine: "Constant tension · back-friendly", note: "Constant tension version. Easier on the lower back brace position." },
      { name: "Chest-Supported T-Bar Row", equipment: "T-Bar Row Machine · Chest Pad", reasons: ["joint-discomfort", "low-readiness"], preservesStimulus: true, intentLine: "Lower back protected", note: "Chest support removes spinal load. Bilateral but preserves back density work." },
      { name: "Heavy Banded Row", equipment: "Resistance Band", reasons: ["home-hotel", "no-equipment", "need-faster"], preservesStimulus: false, intentLine: "Travel-ready · back pattern preserved", note: "Anchor band low. High rep, constant tension. Bilateral." },
    ],
  },
  {
    id: "single-arm-cable-lat-row",
    name: "Single-Arm Cable Lat Row",
    purpose: "Unilateral lat sweep with precise elbow path.",
    target: "Lats",
    region: "Lower lat sweep",
    sets: 4,
    reps: "10-12",
    suggestedLoad: 70,
    mode: "machine",
    equipmentKind: "cable",
    equipmentName: "Cable Stack · D-Handle",
    setupNote: "Cable set low. Hips square. Row one side at a time toward the back pocket.",
    rirTargets: ["2 RIR", "2 RIR", "1 RIR", "1 RIR"],
    rest: "1:30",
    restSeconds: 90,
    cue: "Reach long, then drive the elbow toward the hip without twisting the torso.",
    physiqueImpact: "Sharpens the lat sweep and keeps left/right output honest late in the workout.",
    whyLoad: "Progress only if left and right sides match cleanly.",
    primaryMuscles: ["Lats"],
    secondaryMuscles: ["Mid Back", "Biceps"],
    stabilizers: ["Obliques", "Forearms"],
    education: {
      whyHere: "Unilateral lat work. It protects the width objective after heavier rows while revealing side-to-side gaps.",
      whatToFeel: "A long lat stretch at the front, then a smooth elbow drive toward the hip.",
      goalConnection: "Builds the lower-lat line that sharpens the V-taper and waist illusion.",
      commonError: "Rotating the torso to move the stack. Keep hips square and let the lat move the handle.",
      stretchFocus: "Reach without shrugging. Let the lat lengthen before the next pull.",
      contractionFocus: "Elbow to back pocket, slight pause, ribs quiet.",
    },
    substitutions: [
      { name: "Single-Arm Pulldown", equipment: "Cable Stack · D-Handle", reasons: ["machine-occupied", "joint-discomfort"], preservesStimulus: true, intentLine: "Same tissue · vertical angle", note: "Keeps the lat bias when the row station is unavailable." },
      { name: "Band Lat Row", equipment: "Resistance Band", reasons: ["home-hotel", "no-equipment"], preservesStimulus: false, intentLine: "Travel-ready · lat path preserved", note: "Anchor low and use a higher-rep range to keep tension meaningful." },
      { name: "Machine High Row", equipment: "Plate-Loaded Machine", reasons: ["low-readiness", "need-faster"], preservesStimulus: true, intentLine: "Same outcome · faster setup", note: "Use a neutral grip and drive elbows down to keep lat intent." },
    ],
  },
  {
    id: "machine-pullover",
    name: "Machine Pullover",
    purpose: "Lat isolation without arm dominance.",
    target: "Lats",
    region: "Lat stretch and contraction arc",
    sets: 3,
    reps: "10-12",
    suggestedLoad: 125,
    mode: "machine",
    equipmentKind: "machine",
    equipmentName: "Pullover Machine",
    setupNote: "Seat set so elbows drive in a clean arc. Ribs stacked, shoulders down.",
    rirTargets: ["2 RIR", "1 RIR", "0-1 RIR"],
    rest: "1:30",
    restSeconds: 90,
    cue: "Pull with elbows, not hands. Keep the ribcage quiet and own the stretch.",
    physiqueImpact: "Finishes the lat target without adding more biceps or low-back noise.",
    whyLoad: "Increase only if shoulder position and rib control stay quiet.",
    primaryMuscles: ["Lats"],
    secondaryMuscles: ["Serratus", "Long Head Triceps"],
    stabilizers: ["Deep Core", "Scaps"],
    education: {
      whyHere: "Lat isolation finish. It lets the back, not arms or grip, finish the width objective.",
      whatToFeel: "A deep lat stretch overhead, then the lats shortening as elbows sweep down.",
      goalConnection: "Reinforces width and ribcage control, keeping the torso line clean.",
      commonError: "Turning it into a triceps pushdown or arching the ribs to fake range.",
      stretchFocus: "Let the lats lengthen overhead while ribs stay stacked.",
      contractionFocus: "Drive elbows down and slightly in; pause before the stack drops.",
    },
    substitutions: [
      { name: "Cable Straight-Arm Pulldown", equipment: "Cable Stack · Straight Bar", reasons: ["machine-occupied", "need-faster"], preservesStimulus: true, intentLine: "Same tissue · same outcome", note: "Keep elbows soft and pull from the lats, not the triceps." },
      { name: "Dumbbell Pullover", equipment: "Dumbbell · Bench", reasons: ["home-hotel", "no-equipment"], preservesStimulus: true, intentLine: "Same stretch · simple setup", note: "Use conservative load and stop before the ribs flare." },
      { name: "Band Straight-Arm Pulldown", equipment: "Resistance Band", reasons: ["low-readiness", "home-hotel"], preservesStimulus: false, intentLine: "Lower demand · lat finish", note: "High-rep tension to finish the tissue without joint cost." },
    ],
  },
  {
    id: "reverse-fly",
    name: "Reverse Fly Machine",
    purpose: "Rear-delt cap and shoulder balance.",
    target: "Rear delts",
    region: "Posterior deltoid",
    sets: 3,
    reps: "15-18",
    suggestedLoad: 90,
    mode: "machine",
    equipmentKind: "machine",
    equipmentName: "Reverse Pec Deck",
    setupNote: "Chest pressed firmly to the pad. Handles at shoulder height. Arms slightly bent and locked.",
    rirTargets: ["1 RIR", "1 RIR", "0-1 RIR"],
    rest: "1:00",
    restSeconds: 60,
    cue: "Sweep wide, pause at peak, keep traps quiet.",
    physiqueImpact: "Finishes the 3D shoulder look without adding joint noise.",
    whyLoad: "Add a small load only when every set holds the pause and traps stay quiet.",
    primaryMuscles: ["Rear Delts"],
    secondaryMuscles: ["Mid Traps", "Rhomboids"],
    stabilizers: ["Rotator Cuff"],
    education: {
      whyHere: "Closes the session with rear-delt isolation. Restores shoulder balance after pressing volume and completes the 3D look.",
      whatToFeel: "Pure rear-delt burn by the back half of each set. Traps stay relaxed — if they fire, you are pulling, not sweeping.",
      goalConnection: "Rear delts are the difference between a built upper body and a 'pec-and-front-delt' look. This is the finish.",
      commonError: "Letting the traps take over and rolling the shoulders up. Keep the chest pressed to the pad.",
      stretchFocus: "Brief stretch at the front — do not let the handles travel past the shoulder line.",
      contractionFocus: "Pause at the peak. Two-second hold on every rep is the gold standard for rear delts.",
    },
    substitutions: [
      { name: "Dumbbell Rear Delt Fly", equipment: "Dumbbells · Incline Bench", reasons: ["machine-occupied", "home-hotel"], preservesStimulus: true, intentLine: "Same stimulus · classic version", note: "Prone on incline bench or standing hinged at 45°. Control the arc — no momentum." },
      { name: "Face Pulls", equipment: "Cable Stack · Rope Attachment", reasons: ["machine-occupied", "joint-discomfort"], preservesStimulus: true, intentLine: "Rear delt + rotator cuff", note: "Adds rotator cuff stability. Use rope attachment, pull to the face with elbows high." },
      { name: "Cable Rear Delt Fly", equipment: "Dual Cable Stack", reasons: ["machine-occupied", "low-readiness"], preservesStimulus: true, intentLine: "Constant tension preserved", note: "Cross-body cable fly. Constant tension through full range. Joint-friendly." },
      { name: "Band Pull-Apart", equipment: "Resistance Band", reasons: ["no-equipment", "home-hotel"], preservesStimulus: false, intentLine: "Travel-ready · rear delt activation", note: "High rep, constant tension. Use heaviest available band. Pause at the peak." },
    ],
  },
];


const MOVEMENT_PHASE: Record<string, "primary-output" | "secondary-volume" | "detail-work"> = {
  "low-incline-barbell": "primary-output",
  "hammer-incline": "primary-output",
  "low-incline-db": "secondary-volume",
  "low-to-high-cable-fly": "detail-work",
  "incline-smith-backoff": "detail-work",
  "wide-pulldown": "primary-output",
  "chest-supported-row": "primary-output",
  "meadows-row": "secondary-volume",
  "single-arm-cable-lat-row": "secondary-volume",
  "machine-pullover": "detail-work",
  "reverse-fly": "detail-work",
};

/* ────────────────────────────────────────────────────────────────────────────
   SPLIT-SPECIFIC SESSION RESOLUTION
   The rich MOVEMENTS array above is the canonical Upper Specialization session.
   Every other split is generated from its template so the Mission Runway and
   live session render the correct workout. No split falls back to Upper.
   ──────────────────────────────────────────────────────────────────────── */

function equipmentKindFor(equipment: string): EquipmentKind {
  const e = equipment.toLowerCase();
  if (e.includes("barbell") || e.includes("t-bar")) return "barbell";
  if (e.includes("dumbbell")) return "dumbbell";
  if (e.includes("smith")) return "smith";
  if (e.includes("cable")) return "cable";
  return "machine";
}

function modeFor(kind: EquipmentKind): Movement["mode"] {
  if (kind === "barbell" || kind === "smith") return "barbell";
  if (kind === "dumbbell") return "dumbbell";
  return "machine";
}

function restSecondsFromRange(rest: string): number {
  const first = rest.split("-")[0]?.trim();
  const match = first?.match(/^(\d+):(\d{2})$/);
  if (!match) return 120;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Convert a baseline template movement into the rich Movement shape the engine renders.
 *  No invented performance history — load suggestions stay neutral until logged.
 *  Progression rule + substitution pool flow through from the template. */
function templateMovementToMovement(tm: TemplateMovement): Movement {
  const equipmentKind = equipmentKindFor(tm.equipment);
  const cue = tm.notes ?? `Controlled reps on ${tm.targetMuscle.toLowerCase()} — earn each set.`;
  const subs: MovementSub[] = tm.substitutions.map((name) => ({
    name,
    equipment: "Pool alternative",
    reasons: ["machine-occupied", "feels-wrong"],
    preservesStimulus: true,
    intentLine: "SWAP IF UNAVAILABLE · same target tissue",
    note: tm.plateauRule,
  }));
  return {
    id: tm.id,
    name: tm.name,
    purpose: tm.purpose,
    target: tm.targetMuscle,
    region: tm.targetMuscle,
    sets: tm.sets,
    reps: tm.targetReps,
    suggestedLoad: 0,
    mode: modeFor(equipmentKind),
    equipmentKind,
    equipmentName: tm.equipment,
    setupNote: tm.notes ?? "Set up clean, brace, and own the working range.",
    rirTargets: Array.from({ length: tm.sets }, (_, i) => (i < tm.sets - 1 ? "2 RIR" : "1 RIR")),
    rest: tm.rest,
    restSeconds: restSecondsFromRange(tm.rest),
    role: tm.role,
    roleLabel: tm.roleLabel,
    superset: tm.superset,
    supersetPartner: tm.supersetPartner,
    finishingTechnique: tm.finishingTechnique,
    tempo: tm.tempo,
    intensity: tm.intensity,
    progressionTarget: tm.progressionTarget,
    weakPointTags: tm.weakPointTags,
    phaseTags: tm.phaseTags,
    cue,
    physiqueImpact: `Develops ${tm.targetMuscle.toLowerCase()} within today's split focus.`,
    whyLoad: tm.progressionTarget,
    primaryMuscles: [tm.targetMuscle],
    secondaryMuscles: [],
    stabilizers: ["Core Brace"],
    education: {
      whyHere: tm.purpose,
      whatToFeel: `${tm.roleLabel}: tension through the ${tm.targetMuscle.toLowerCase()} across the full range.`,
      goalConnection: tm.progressionTarget,
      commonError: "Rushing reps or chasing load before the pattern is clean.",
      stretchFocus: tm.fatigueNote ?? `Tempo ${tm.tempo}. Control the lengthened position with no bounce.`,
      contractionFocus: tm.intensity,
    },
    substitutions: subs,
  };
}

type ActiveSessionKind = "lifting" | "recovery" | "missing" | "activity";

type ActiveSession = {
  kind: ActiveSessionKind;
  /** Set only for kind "activity" — a track day, run or class stands in for lifting. */
  activity?: NonNullable<ResolvedDay["activity"]>;
  movements: Movement[];
  phaseMap: Record<string, WorkoutPhaseKey>;
  totalSets: number;
  displayName: string;
  focus: string;
  template: WorkoutTemplate | null;
  recovery: RecoveryRunway | null;
  intensityTier: IntensityTier;
  intensityLabel: string | null;
  intensityNote: string | null;
  /* Experience-scaling + intensity-metrics layer. */
  experience: TrainingExperience;
  metrics: SessionMetrics | null;
};

/* The session is resolved from a ResolvedDay (the single training-truth model):
   display title and engine key are separate, and the per-day transform decides
   the focus restructure. The cockpit always loads from `day.splitKey`. */
/* Coach-smart core placement for the session: heavy lower / compound days keep
   pre-core light (bracing only); glute / runway / waistline / posture days keep
   core visibility high; the member's explicit choice always wins over auto. */
function placeCore(day: ResolvedDay, template: WorkoutTemplate, coreTiming: CoreTiming): WorkoutTemplate {
  const sk = template.splitKey;
  const region: "upper" | "lower" | "general" =
    sk === "legs" || sk === "lower" || sk === "lower-posterior" ? "lower"
    : sk === "chest" || sk === "back" || sk === "shoulders" || sk === "arms" || sk === "upper"
      || sk === "upper-specialization" || sk === "push" || sk === "pull" || sk === "arms-delts" || sk === "chest-back" ? "upper"
    : "general";
  const heavyCompoundLead = template.phases.some(
    (p) => p.phase === "primary-output" && p.movements.some((m) => m.role === "primary" && /barbell|trap bar/i.test(m.equipment)),
  );
  const signal = `${day.archetype ?? ""} ${day.transform ?? ""} ${day.displayTitle ?? ""}`.toLowerCase();
  const waistlineFocus = /glute|waist|runway|posture|tone|sculpt/.test(signal);
  const conditioning = /conditioning|sport|athletic|zone2/.test(signal);
  const placement = resolveCorePlacement({ coreTiming, region, heavyCompoundLead, waistlineFocus, conditioning });
  return applyCoreTiming(template, placement);
}

/* ── Visible-superset source of truth ─────────────────────────────────────
   The "Supersets" metric and the movement-card pair badges must agree. Both
   read the SAME rendered queue — never a separately-scaled template the member
   never sees. countVisibleSupersets counts only COMPLETE pairs actually present
   on the rendered movements, so the number can never exceed the badges on
   screen (and an authored queue with no pairs honestly shows zero). */
function countVisibleSupersets(movements: Movement[]): number {
  const groups = new Map<string, number>();
  for (const m of movements) {
    if (!m.superset) continue;
    const g = m.superset.replace(/\d+$/, ""); // "A1" → "A"
    groups.set(g, (groups.get(g) ?? 0) + 1);
  }
  let pairs = 0;
  for (const n of groups.values()) if (n >= 2) pairs += 1;
  return pairs;
}

/* The hand-authored Upper Specialization queue renders from a fixed Movement[]
   (not a template), so it never received the experience layer's superset
   labels. Pair its complementary accessories here — same rules as the template
   engine (never the primary-output lead, never two heavy free-iron compounds,
   pair different tissue) and experience-gated so beginners stay simple and
   advanced get density. Returns a NEW array; the shared MOVEMENTS const and
   movement order are never mutated. */
function labelRenderedSupersets(movements: Movement[], experience: TrainingExperience): Movement[] {
  const out = movements.map((m) => ({ ...m }));
  const spec = EXPERIENCE_SPECS[experience];
  if (!spec.supersetsAllowed || spec.maxSupersets <= 0) return out;
  const maxSupersets = spec.maxSupersets;
  const isHeavy = (m: Movement) => m.equipmentKind === "barbell" || m.equipmentKind === "smith";
  const canPair = (a: Movement, b: Movement) =>
    !isHeavy(a) && !isHeavy(b) && a.target.trim().toLowerCase() !== b.target.trim().toLowerCase();
  // Accessories only — never the primary-output phase. A first training level
  // pairs stable machine / cable work only.
  const pool = out.filter(
    (m) =>
      !m.superset &&
      MOVEMENT_PHASE[m.id] !== "primary-output" &&
      (!spec.supersetMachineOnly || m.equipmentKind === "machine" || m.equipmentKind === "cable"),
  );
  const used = new Set<string>();
  const groups = ["A", "B", "C", "D", "E", "F"];
  let count = 0;
  for (let i = 0; i < pool.length && count < maxSupersets; i++) {
    if (used.has(pool[i].id)) continue;
    let partner = -1;
    for (let j = i + 1; j < pool.length; j++) {
      if (used.has(pool[j].id)) continue;
      if (canPair(pool[i], pool[j])) { partner = j; break; }
    }
    if (partner === -1) continue;
    const g = groups[count] ?? `S${count + 1}`;
    pool[i].superset = `${g}1`;
    pool[partner].superset = `${g}2`;
    pool[i].supersetPartner = pool[partner].name;
    pool[partner].supersetPartner = pool[i].name;
    used.add(pool[i].id);
    used.add(pool[partner].id);
    count += 1;
  }
  return out;
}

function resolveActiveSession(
  day: ResolvedDay,
  tier: IntensityTier = "standard",
  readiness: ChestReadiness = "moderate",
  experience: TrainingExperience = "advanced",
  prefs: MovementPreferences | null = null,
  coreTiming: CoreTiming = "auto",
  phase: TrainingPhase = "foundation",
  gymProfile: UserTrainingProfile | null = null,
  /** Gated workout-demand tier — already clamped by age/readiness/pain. */
  demand: WorkoutDemandLevel = "high-output",
): ActiveSession {
  const key: ResolvedSplit = day.recovery ? "recovery" : day.splitKey;

  // Activity day (track, run, group class) → the activity IS the session. It
  // must never fall through to "template missing" and offer to build a workout.
  if (day.activity && !day.recovery) {
    return {
      kind: "activity", activity: day.activity, movements: [], phaseMap: {}, totalSets: 0,
      displayName: day.displayTitle || day.activity.label, focus: day.goal,
      template: null, recovery: null,
      intensityTier: "standard", intensityLabel: null, intensityNote: null,
      experience, metrics: null,
    };
  }

  // Recovery / rest day → no lifting queue. Intensity never forces a session here.
  if (key === "recovery") {
    return {
      kind: "recovery", movements: [], phaseMap: {}, totalSets: 0,
      displayName: day.displayTitle || RECOVERY_RUNWAY.displayName, focus: RECOVERY_RUNWAY.focus,
      template: null, recovery: RECOVERY_RUNWAY,
      intensityTier: "standard", intensityLabel: null, intensityNote: null,
      experience, metrics: null,
    };
  }

  // Upper Specialization → keep the canonical, richly authored session.
  // Experience scaling drives the metrics / duration; the authored queue stays.
  if (key === "upper-specialization") {
    const baseTemplate = getWorkoutTemplateForSplit("upper specialization");
    const intensified = baseTemplate ? applyProtocolIntensity(baseTemplate, tier) : null;
    const template = intensified ? applyWorkoutDemand(applyExperienceScaling(intensified, experience), demand) : null;
    // The authored queue never went through the template superset pass — pair its
    // accessories here so the cards carry real A1/A2 badges, then count those.
    const movements = labelRenderedSupersets(MOVEMENTS, experience);
    const metrics = template ? computeSessionMetrics(template, experience) : null;
    if (metrics) metrics.supersetCount = countVisibleSupersets(movements);
    return {
      kind: "lifting", movements, phaseMap: MOVEMENT_PHASE,
      totalSets: movements.reduce((s, m) => s + m.sets, 0),
      displayName: day.displayTitle || "Upper Specialization", focus: "Upper chest, delts, arms, and back detail",
      template, recovery: null,
      intensityTier: tier, intensityLabel: template?.intensityLabel ?? null, intensityNote: template?.intensityNote ?? null,
      experience, metrics,
    };
  }

  // Archetype-specific identity (Protocol Architecture 2.0 depth layer): when a
  // blueprint day carries an archetype that has its own authored template, load
  // that — so Glute Strength / Shape / Pump / Detail (and every other archetype)
  // render distinct workouts, not a shared split pool. Intensity, experience
  // scaling, and member preferences still layer on top exactly as elsewhere.
  if (day.archetype) {
    const archetypeBase = getArchetypeOnlyTemplate(day.archetype);
    if (archetypeBase) {
      let template = applyProtocolIntensity(archetypeBase, tier);
      template = applyExperienceScaling(template, experience);
      template = applyPhaseProgression(template, phase);
      // Demand is the FINAL depth pass so phase deltas can never re-inflate a
      // Precision trim (or mute an Elite bump). Deload phases already pull the
      // gate down before we get here.
      template = applyWorkoutDemand(template, demand);
      template = applyMovementPreferences(template, prefs);
      template = placeCore(day, template, coreTiming);
      // Gym-environment substitutions run LAST so role / sets / reps / phase /
      // superset / intensity are already final — only name + equipment may change.
      template = applyGymEnvironment(template, gymProfile);
      const movements = template.phases.flatMap((p) => p.movements.map(templateMovementToMovement));
      const phaseMap: Record<string, WorkoutPhaseKey> = {};
      template.phases.forEach((p) => p.movements.forEach((m) => { phaseMap[m.id] = m.phase; }));
      // Metric reflects the pairs actually rendered (incl. any core block superset).
      const metrics = computeSessionMetrics(template, experience);
      metrics.supersetCount = countVisibleSupersets(movements);
      return {
        kind: "lifting", movements, phaseMap,
        totalSets: movements.reduce((s, m) => s + m.sets, 0),
        displayName: day.displayTitle || template.displayName, focus: template.focus,
        template, recovery: null,
        intensityTier: tier, intensityLabel: template.intensityLabel ?? null, intensityNote: template.intensityNote ?? null,
        experience, metrics,
      };
    }
  }

  // Any other known split → load by ENGINE KEY (never the display title), then
  // apply the day's focus transform. Every non-matching split is unchanged.
  const baseTemplate = key ? getWorkoutTemplateForSplit(key) : null;
  if (baseTemplate) {
    const intensified = applyProtocolIntensity(baseTemplate, tier);
    let template = intensified;
    switch (day.transform) {
      case "chest":
        template = applyChestPriority(intensified, { active: true, upperChest: day.chestUpper, readiness });
        break;
      case "glute-strength":
        template = applyGlutePriority(intensified, { active: true, glutes: true, quads: false, lead: "glute", readiness });
        break;
      case "quad-volume":
        template = applyGlutePriority(intensified, { active: true, glutes: false, quads: true, lead: "quad", readiness });
        break;
      case "glute-shape":
        template = applyGlutePriority(intensified, { active: true, glutes: true, quads: false, lead: "glute", readiness });
        break;
      case "glute-strength-waist":
      case "quad-shape-glute-support":
      case "quad-shape-upper-finish":
      case "back-line-delts-conditioning":
      case "glute-hamstring-shape":
      case "upper-sculpt-posture":
        template = applyWomensSession(intensified, day.transform as WomensSessionKind, readiness);
        break;
      default:
        break;
    }
    // Experience scaling (HOW hard) + long-protocol phase progression + member
    // movement preferences run last, so they layer on top of the protocol
    // identity + focus transform without changing the architecture name or which
    // split trains.
    template = applyExperienceScaling(template, experience);
    template = applyPhaseProgression(template, phase);
    template = applyWorkoutDemand(template, demand);
    template = applyMovementPreferences(template, prefs);
    template = placeCore(day, template, coreTiming);
    // Gym-environment substitutions run LAST so role / sets / reps / phase /
    // superset / intensity are already final — only name + equipment may change.
    template = applyGymEnvironment(template, gymProfile);
    const movements = template.phases.flatMap((p) => p.movements.map(templateMovementToMovement));
    const phaseMap: Record<string, WorkoutPhaseKey> = {};
    template.phases.forEach((p) => p.movements.forEach((m) => { phaseMap[m.id] = m.phase; }));
    // Metric reflects the pairs actually rendered (incl. any core block superset).
    const metrics = computeSessionMetrics(template, experience);
    metrics.supersetCount = countVisibleSupersets(movements);
    return {
      kind: "lifting", movements, phaseMap,
      totalSets: movements.reduce((s, m) => s + m.sets, 0),
      // Display title is the member-facing label; engine state stays in template.
      displayName: day.displayTitle || template.displayName, focus: template.focus,
      template, recovery: null,
      intensityTier: tier, intensityLabel: template.intensityLabel ?? null, intensityNote: template.intensityNote ?? null,
      experience, metrics,
    };
  }

  // Unknown split → missing-template state (never fall back to Upper).
  return { kind: "missing", movements: [], phaseMap: {}, totalSets: 0, displayName: day.displayTitle || "Unknown split", focus: "", template: null, recovery: null, intensityTier: "standard", intensityLabel: null, intensityNote: null, experience, metrics: null };
}

function unresolvedProgramSession(day: ResolvedDay, experience: TrainingExperience): ActiveSession {
  return {
    kind: "missing",
    movements: [],
    phaseMap: {},
    totalSets: 0,
    displayName: day.displayTitle || "Program Horizon required",
    focus: "Activate a protocol or select a member-authored program before starting a session.",
    template: null,
    recovery: null,
    intensityTier: "standard",
    intensityLabel: null,
    intensityNote: null,
    experience,
    metrics: null,
  };
}

const EXPERIENCE_ORDER: TrainingExperience[] = ["beginner", "intermediate", "advanced", "full-gym-advanced", "athlete"];

const RECOVERY_DEMAND_COLOR: Record<string, string> = {
  Low: GREEN, Moderate: STEEL, High: AMBER, "Very High": "#ef7d55",
};

/** Session intensity command panel — every session exposes its difficulty,
 *  intensity (1–10), recovery demand, volume / density, muscle load, advanced
 *  methods, and the experience selector that scales HOW hard it trains.
 *  Programming cue + organization only — no medical claims, no dosing. */
function SessionIntensityPanel({
  session,
  experience,
  onSetExperience,
  phase = null,
}: {
  session: ActiveSession;
  experience: TrainingExperience;
  onSetExperience: (e: TrainingExperience) => void;
  /** Long-protocol phase story — only present when a multi-week protocol is active. */
  phase?: { label: string; note: string; week: number; total: number } | null;
}) {
  const m = session.metrics;
  const spec = EXPERIENCE_SPECS[experience];
  const progression = progressionRulesFor(experience);
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5" style={{ borderColor: "rgba(255,255,255,0.08)", background: "linear-gradient(150deg, rgba(95,183,213,0.05), rgba(255,255,255,0.012))" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge size={14} style={{ color: STEEL }} />
          <p className="font-mono text-[9px] uppercase tracking-[0.24em]" style={{ color: STEEL }}>Session Intensity</p>
        </div>
        {m && (
          <span className="rounded-full border px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.14em]" style={{ borderColor: `${GOLD}45`, background: `${GOLD}12`, color: GOLD }}>
            {session.displayName} · {m.sessionDifficultyLabel}
          </span>
        )}
      </div>

      {/* Long-protocol phase — why this week feels different from week 2. */}
      {phase && (
        <div className="mt-3 border-l-2 py-1 pl-3" style={{ borderColor: `${GOLD}55` }}>
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} style={{ color: GOLD }} />
              <p className="font-mono text-[7.5px] uppercase tracking-[0.2em]" style={{ color: `${GOLD}cc` }}>Protocol Phase</p>
            </div>
            <span className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/45">Week {phase.week} / {phase.total}</span>
          </div>
          <p className="mt-1 text-[12px] font-bold tracking-tight" style={{ color: "#f2eee6" }}>{phase.label}</p>
          <p className="mt-0.5 text-[10px] leading-[1.5] text-white/50">{phase.note}</p>
        </div>
      )}

      {/* Experience selector — honest training level, member-controlled. */}
      <p className="mt-3 font-mono text-[7.5px] uppercase tracking-[0.18em] text-white/40">Training Experience · scales how hard the session trains</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {EXPERIENCE_ORDER.map((e) => {
          const active = e === experience;
          return (
            <button
              key={e}
              type="button"
              onClick={() => onSetExperience(e)}
              aria-pressed={active}
              className="rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition"
              style={active
                ? { borderColor: `${GOLD}88`, background: `${GOLD}1f`, color: "#f2eee6", boxShadow: `0 0 16px ${GOLD}33` }
                : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.55)" }}
            >
              {EXPERIENCE_LABEL[e]}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10.5px] leading-[1.5] text-white/45">{spec.style}</p>

      {m && (
        <>
          {/* Intensity 1–10 meter */}
          <div className="mt-3.5 flex items-center gap-3">
            <div className="flex flex-1 gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-2 flex-1 rounded-full" style={{ background: i < m.intensityLevel ? `linear-gradient(90deg, ${GOLD}, ${AMBER})` : "rgba(255,255,255,0.08)" }} />
              ))}
            </div>
            <span className="font-mono text-[11px] font-black" style={{ color: GOLD }}>{m.intensityLevel}/10</span>
          </div>

          {/* Metric grid */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <IntensityMetric label="Experience" value={m.experienceLabel} color={GOLD} />
            <IntensityMetric label="Duration" value={`${m.estimatedDuration} min`} color={STEEL} />
            <IntensityMetric label="Recovery Demand" value={m.recoveryDemand} color={RECOVERY_DEMAND_COLOR[m.recoveryDemand] ?? STEEL} />
            <IntensityMetric label="Volume" value={`${m.volumeTier} · ${m.totalWorkingSets} sets`} color={VIOLET} />
            <IntensityMetric label="Density" value={m.densityTier} color={VIOLET} />
            <IntensityMetric label="Supersets" value={String(m.supersetCount)} color={AMBER} />
            <IntensityMetric label="Primary Load" value={m.primaryMuscleLoad.join(" · ") || "—"} color={GOLD} />
            <IntensityMetric label="Fuel Demand" value={m.sessionFuelDemand} color={GREEN} />
          </div>

          {m.advancedMethods.length > 0 && (
            <div className="mt-3">
              <p className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/40">Advanced Methods</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {m.advancedMethods.map((a) => (
                  <span key={a} className="rounded-full border px-2 py-0.5 text-[10px] text-white/60" style={{ borderColor: `${GOLD}2c`, background: `${GOLD}0c` }}>{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Progression rules by experience */}
          <div className="mt-3">
            <p className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/40">Progression · {m.experienceLabel}</p>
            <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
              {progression.map((r) => (
                <li key={r} className="flex items-start gap-1.5 text-[10.5px] leading-snug text-white/55"><span style={{ color: GOLD }}>·</span>{r}</li>
              ))}
            </ul>
          </div>
          <p className="mt-2.5 text-[9px] leading-snug text-white/30">Training programming and organization only — not medical advice. Stop with pain and follow clinician guidance.</p>
        </>
      )}
    </div>
  );
}

function IntensityMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-white/[0.02] px-2.5 py-2">
      <p className="font-mono text-[7px] uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-0.5 text-[11.5px] font-bold capitalize leading-tight" style={{ color }}>{value}</p>
    </div>
  );
}

const SESSION_PHASE_DEFS: {
  key: SessionPhaseKey;
  label: string;
  description: string;
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
}[] = [
  { key: "primer", label: "Prime The Target", description: "Warm-up, mobility, activation, and ramp sets.", color: STEEL, icon: Sparkles },
  { key: "primary-output", label: "Primary Output", description: "Primary heavy movement and controlled overload.", color: GOLD, icon: Flame },
  { key: "secondary-volume", label: "Stretch-Biased Volume", description: "Lengthened tension and stable hypertrophy work.", color: GOLD, icon: Layers3 },
  { key: "detail-work", label: "Pump Finisher", description: "Cable, machine, isolation, and target-feel finish.", color: AMBER, icon: Target },
  { key: "core-command", label: "Core Command", description: "Programmed brace and contractile core work.", color: VIOLET, icon: ShieldCheck },
  { key: "conditioning-reserve", label: "Conditioning Reserve", description: "Goal-aware cardio — protect output, not overspend.", color: STEEL, icon: Heart },
  { key: "recovery-chamber", label: "Recovery Handoff", description: "Optional downshift · sauna · mobility · breath.", color: VIOLET, icon: Waves },
  { key: "post-session-handoff", label: "Post-Session Handoff", description: "Logs sealed · meal · hydration · debrief.", color: GREEN, icon: CheckCircle2 },
];


const SWAP_REASON_LABELS: Record<SwapReason, string> = {
  "machine-occupied": "Machine occupied",
  "joint-discomfort": "Joint discomfort",
  "no-equipment": "No equipment",
  "low-readiness": "Low readiness",
  "need-faster": "Need it faster",
  "home-hotel": "Home / hotel gym",
  "feels-wrong": "Feels wrong today",
};

/* ────────────────────────────────────────────────────────────────────────────
   PRIMITIVES
   ──────────────────────────────────────────────────────────────────────── */

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.025] p-3">
      <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">{label}</p>
      <p className="mt-1 break-words text-sm font-bold leading-snug text-[#f2eee6]">{value}</p>
    </div>
  );
}

function SetHistoryBadges({ history }: { history: LoggedSet[] }) {
  if (history.length === 0) return null;
  return (
    <div className="mt-4 rounded-2xl bg-black/20 p-3">
      <p className="mb-2 font-mono text-[7px] uppercase tracking-[0.22em] text-white/30">Set History</p>
      <div className="space-y-1.5">
        {history.map((s) => {
          const color = toneColor(s.tone);
          return (
            <div key={s.setNumber} className="flex items-center gap-2">
              <CheckCircle2 size={10} style={{ color, flexShrink: 0 }} />
              <span className="font-mono text-[9px] text-white/60">Set {s.setNumber} · {s.load} lb × {s.reps}</span>
              <span className="ml-auto rounded-md px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider" style={{ background: `${color}1c`, color }}>
                {s.tone}
              </span>
              {s.review?.coachDecision && (
                <p className="basis-full pl-4 text-[10px] leading-4 text-white/34">{s.review.coachDecision}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ────────────────────────────────────────────────────────────────────────────
   EDUCATION
   ──────────────────────────────────────────────────────────────────────── */

function EducationLine({ icon: Icon, label, text, color }: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  text: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-1.5">
        <Icon size={11} style={{ color: `${color}cc` }} />
        <p className="font-mono text-[7.5px] uppercase tracking-[0.22em]" style={{ color: `${color}cc` }}>{label}</p>
      </div>
      <p className="mt-1.5 text-[11.5px] leading-[1.55] text-white/65">{text}</p>
    </div>
  );
}

function MovementEducationPanel({ education }: { education: MovementEducation }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <EducationLine icon={Compass} label="Why this is here" text={education.whyHere} color={GOLD} />
      <EducationLine icon={Eye} label="What to feel" text={education.whatToFeel} color={STEEL} />
      <EducationLine icon={Target} label="Goal connection" text={education.goalConnection} color={GREEN} />
      <EducationLine icon={AlertTriangle} label="Common error" text={education.commonError} color={AMBER} />
      <EducationLine icon={Layers3} label="Stretch focus" text={education.stretchFocus} color={STEEL} />
      <EducationLine icon={Flame} label="Contraction focus" text={education.contractionFocus} color={GOLD} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   SET LOGGER — log a set in seconds, one hand, mid-set.

   The header says what is being logged: the movement, set N of M, the target
   reps and effort, and the member's own last time when it exists. Reps and
   load are steppers prefilled from this session's last set (or the load the
   cockpit already shows); effort is one segmented row. One gold Log Set sits
   at the thumb. Logging closes the sheet: the cockpit confirms the set and
   the rest clock starts. Coaching lives in the Coaching sheet, not here.

   Surface rule: the sheet is the one surface. Nothing inside draws a box.
   ──────────────────────────────────────────────────────────────────────── */

const EFFORT_SEGMENTS = [
  { value: "4", label: "4+" },
  { value: "2", label: "2–3" },
  { value: "0", label: "0–1" },
] as const;
type EffortValue = (typeof EFFORT_SEGMENTS)[number]["value"];

/** "2 RIR" → the effort tier that holds it. No number, no guess: Productive. */
function effortFromTarget(target: string | undefined): number {
  const n = target?.match(/\d+/);
  if (!n) return 2;
  const v = Number(n[0]);
  return v >= 4 ? 4 : v >= 2 ? 2 : 0;
}

/** The low end of the target ("8-12" → 8). A target with no number starts at 8. */
function repsFromTarget(reps: string): number {
  const n = reps.match(/\d+/);
  return n ? Math.max(1, Number(n[0])) : 8;
}

function formatLoadInput(load: number): string {
  return load > 0 ? String(load) : "";
}

function parseLoadInput(text: string): number {
  const v = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : 0;
}

/** A number with a 44px − and + either side. Typing is always allowed. */
function LoggerStepper({
  id,
  label,
  detail,
  value,
  inputMode,
  placeholder,
  lessLabel,
  moreLabel,
  onChange,
  onStep,
  onEnter,
}: {
  id: string;
  label: string;
  detail: string;
  value: string;
  inputMode: "numeric" | "decimal";
  placeholder: string;
  lessLabel: string;
  moreLabel: string;
  onChange: (text: string) => void;
  onStep: (direction: 1 | -1) => void;
  onEnter: () => void;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/55">{label}</label>
        <span className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">{detail}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b border-white/[0.08]">
        <button
          type="button"
          aria-label={lessLabel}
          onClick={() => onStep(-1)}
          className="grid h-12 w-11 place-items-center text-white/60 transition-colors hover:text-white active:text-[#d5b15f]"
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          enterKeyHint="done"
          autoComplete="off"
          data-numeral=""
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.replace(inputMode === "numeric" ? /[^\d]/g : /[^\d.,]/g, "").slice(0, 5))}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
          className="tnum h-12 w-full min-w-0 bg-transparent text-center font-display text-[32px] font-black leading-none text-[#f2eee6] outline-none placeholder:text-white/25 focus-visible:text-[#d5b15f]"
        />
        <button
          type="button"
          aria-label={moreLabel}
          onClick={() => onStep(1)}
          className="grid h-12 w-11 place-items-center text-white/60 transition-colors hover:text-white active:text-[#d5b15f]"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function SetLoggerSheet({
  movement,
  history,
  exposure,
  ctx,
  onClose,
  onLogged,
  onEdit,
  onUndo,
}: {
  movement: Movement;
  history: LoggedSet[];
  exposure: MovementHistoryRead | undefined;
  ctx: ProfileContext;
  onClose: () => void;
  onLogged: (load: number, reps: number, intensity: number, review: SetReview) => void;
  onEdit: (setNumber: number, load: number, reps: number, intensity: number, review: SetReview) => void;
  onUndo: () => void;
}) {
  const unit = getLoadUnit(movement).unit;
  const last = history.length > 0 ? history[history.length - 1] : null;
  /* The load the cockpit already shows: this session's last set, else the
     member's own last time, else the starting estimate from their body data —
     so the field opens with a real number to work from instead of empty. */
  const startLoad = last && last.load > 0 ? last.load
    : movement.lastLoad && movement.lastLoad > 0 ? movement.lastLoad
    : exposure?.exposure.lastTopLoad
      || (movement.loadIsEstimate ? movement.suggestedLoad : 0)
      || 0;
  const startIsEstimate = !last && !movement.lastLoad && !exposure?.exposure.lastTopLoad && Boolean(movement.loadIsEstimate) && startLoad > 0;
  const startReps = last ? last.reps : repsFromTarget(movement.reps);
  const startEffort = effortFromTarget(movement.rirTargets?.[Math.min(history.length, movement.sets - 1)] ?? movement.intensity);

  const [loadText, setLoadText] = useState(formatLoadInput(startLoad));
  const [repsText, setRepsText] = useState(String(startReps));
  const [intensity, setIntensity] = useState(startEffort);
  const [editingSetNumber, setEditingSetNumber] = useState<number | null>(null);
  /* Bumped when the entry starts over from a known baseline (a set undone or
     opened for edit), so the guard compares against what was on screen then. */
  const [entryRound, setEntryRound] = useState(0);
  const dirty = useDirtySnapshot({ loadText, repsText, intensity, editingSetNumber }, entryRound);

  const load = parseLoadInput(loadText);
  const reps = Math.max(0, Number.parseInt(repsText, 10) || 0);
  const setNumber = editingSetNumber ?? history.length + 1;
  const extra = !editingSetNumber && history.length >= movement.sets;
  const effortTarget = movement.rirTargets?.[Math.min(setNumber - 1, movement.sets - 1)] ?? movement.intensity ?? null;

  function handleLog() {
    if (reps < 1) return;
    const tone = toneFromIntensity(intensity);
    const projected: LoggedSet = { load, reps, intensity, tone, setNumber };
    const projectedHistory = editingSetNumber
      ? history.map((set) => (set.setNumber === editingSetNumber ? projected : set))
      : [...history, projected];
    const review = buildSetReview(movement, load, reps, intensity, projectedHistory, ctx);
    if (editingSetNumber) onEdit(editingSetNumber, load, reps, intensity, review);
    else onLogged(load, reps, intensity, review);
    onClose();
  }
  function startEdit(set: LoggedSet) {
    setEditingSetNumber(set.setNumber);
    setLoadText(formatLoadInput(set.load));
    setRepsText(String(set.reps));
    setIntensity(set.intensity);
    setEntryRound((r) => r + 1);
  }
  function handleUndo() {
    if (!last) return;
    onUndo();
    /* The undone set's numbers stay in the fields, ready to log again. */
    setEditingSetNumber(null);
    setLoadText(formatLoadInput(last.load));
    setRepsText(String(last.reps));
    setIntensity(last.intensity);
    setEntryRound((r) => r + 1);
  }
  const stepLoad = (direction: 1 | -1) => setLoadText(formatLoadInput(Math.max(0, load + direction * 5)));
  const stepReps = (direction: 1 | -1) => setRepsText(String(Math.max(1, reps + direction)));

  return (
    <ReserveBottomSheet
      open
      onClose={onClose}
      dirty={dirty}
      title={`Log set · ${movement.name}`}
      accent={GOLD}
      footer={
        <div className="flex items-center gap-2">
          <ReserveSheetClose fallback={onClose}>
            {(requestClose) => (
              <ReserveButton tier="quiet" size="lg" onClick={requestClose}>Cancel</ReserveButton>
            )}
          </ReserveSheetClose>
          <div className="min-w-0 flex-1">
            {reps < 1 ? (
              <ReserveButton tier="primary" size="lg" fullWidth icon={CheckCircle2} disabled disabledReason="Enter the reps you completed.">
                {editingSetNumber ? `Save Set ${editingSetNumber}` : "Log Set"}
              </ReserveButton>
            ) : (
              <ReserveButton tier="primary" size="lg" fullWidth icon={CheckCircle2} onClick={handleLog}>
                {editingSetNumber ? `Save Set ${editingSetNumber}` : "Log Set"}
              </ReserveButton>
            )}
          </div>
        </div>
      }
    >
      <div data-training="set-logger" className="flex flex-col gap-4">
        <p className="-mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#d5b15f]/90">
          {editingSetNumber ? `Editing set ${editingSetNumber}` : extra ? `Extra set · ${movement.sets} planned` : `Set ${setNumber} of ${movement.sets}`}
          <span className="text-white/55"> · {movement.reps} reps{effortTarget ? ` · ${effortTarget}` : ""}</span>
        </p>

        <div className="grid grid-cols-2 gap-4">
          <LoggerStepper
            id="set-logger-reps"
            label="Reps"
            detail={`Target ${movement.reps}`}
            value={repsText}
            inputMode="numeric"
            placeholder="0"
            lessLabel="One fewer rep"
            moreLabel="One more rep"
            onChange={setRepsText}
            onStep={stepReps}
            onEnter={handleLog}
          />
          <LoggerStepper
            id="set-logger-load"
            label="Load"
            detail={unit}
            value={loadText}
            inputMode="decimal"
            placeholder="0"
            lessLabel="5 lb less"
            moreLabel="5 lb more"
            onChange={setLoadText}
            onStep={stepLoad}
            onEnter={handleLog}
          />
        </div>

        {startIsEstimate && movement.loadBasis && (
          /* The field opened pre-filled — say plainly that the number is an
             estimate from their own body data and theirs to change. */
          <p className="-mt-1 text-[11px] leading-snug text-white/45">
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#d5b15f]/85">Starting estimate</span>
            {" · "}{movement.loadBasis}
          </p>
        )}

        <div className="flex min-h-[48px] items-center justify-between gap-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/55">Reps in reserve</span>
          <ReserveSegmented<EffortValue>
            label="Reps in reserve"
            value={String(intensity) as EffortValue}
            segments={EFFORT_SEGMENTS.map((s) => ({ value: s.value, label: s.label }))}
            onChange={(v) => setIntensity(Number(v))}
          />
        </div>

        {(exposure || history.length > 0) && (
          <dl className="flex flex-col divide-y divide-white/[0.06] border-t border-white/[0.06]">
            {exposure && (
              <div className="flex min-h-[44px] items-center gap-3 py-1">
                <dt className="w-[76px] shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">Last time</dt>
                <dd className="tnum min-w-0 flex-1 truncate text-[13px] text-white/75">
                  {exposure.lastLine} <span className="text-white/45">· {exposure.lastDateLabel}</span>
                </dd>
              </div>
            )}
            {history.length > 0 && (
              <div className="flex min-h-[44px] items-center gap-3 py-1">
                <dt className="w-[76px] shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">Today</dt>
                <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1">
                  {history.map((set) => {
                    const editing = set.setNumber === editingSetNumber;
                    return (
                      <button
                        key={set.setNumber}
                        type="button"
                        aria-pressed={editing}
                        aria-label={`Edit set ${set.setNumber} · ${set.load > 0 ? set.load : "BW"} × ${set.reps}`}
                        onClick={() => startEdit(set)}
                        className="tnum min-h-[44px] px-1.5 text-[13px] underline-offset-[6px] transition-colors hover:text-white"
                        style={{ color: editing ? GOLD : "rgba(255,255,255,0.75)", textDecoration: editing ? "underline" : "none" }}
                      >
                        {set.load > 0 ? set.load : "BW"} × {set.reps}
                      </button>
                    );
                  })}
                  {!editingSetNumber && (
                    <button
                      type="button"
                      onClick={handleUndo}
                      className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 pl-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/50 transition-colors hover:text-white/80"
                    >
                      <RotateCcw size={11} aria-hidden="true" />Undo Last
                    </button>
                  )}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </ReserveBottomSheet>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   OPERATIONAL SUBSTITUTION PANEL (premium redesign)
   ──────────────────────────────────────────────────────────────────────── */

function TacticalSubstitutionPanel({
  movement,
  onClose,
  onSelect,
  feedbackKinds,
  onFeedback,
  onAvoid,
}: {
  movement: Movement;
  onClose: () => void;
  onSelect: (substitution: MovementSub, reason: SwapReason | null) => void;
  feedbackKinds?: MovementFeedbackKind[];
  onFeedback?: (kind: MovementFeedbackKind) => void;
  onAvoid?: () => void;
}) {
  const [reason, setReason] = useState<SwapReason | null>(null);
  const allReasons = Array.from(new Set(movement.substitutions.flatMap((s) => s.reasons)));
  const filtered = reason ? movement.substitutions.filter((s) => s.reasons.includes(reason)) : movement.substitutions;
  return (
    <AnimatePresence>
      {/* Fades in with CSS, not presence-tracked — see the note in
          MealConfirmationDrawer: a second exit animation can strand the overlay. */}
      <div className="fba-scrim-in fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4" style={{ backdropFilter: "blur(14px)" }} onClick={onClose}>
        <motion.div role="dialog" aria-modal="true" aria-label={`Substitute ${movement.name}`} className="w-full max-w-xl overflow-hidden rounded-t-[28px] border border-white/[0.1] bg-[#06070b] shadow-[0_30px_120px_rgba(0,0,0,0.85)] sm:rounded-[28px]" style={{ maxHeight: "88dvh", overflowY: "auto" }} initial={{ y: 44, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#06070b]/96 px-5 py-4">
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-[#7dd3ee]/75">Operational Substitution</p>
              <h3 className="mt-0.5 text-[17px] font-black leading-tight text-[#f2eee6]">{movement.name}</h3>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/40 transition hover:text-white/70"><X size={14} /></button>
          </div>
          <div className="flex flex-col gap-5 p-5">
            {onFeedback && (
              <div>
                <p className="mb-2.5 font-mono text-[8px] uppercase tracking-[0.22em] text-white/35">Movement feedback · observational, helps Reserve learn</p>
                <div className="flex flex-wrap gap-1.5">
                  {MOVEMENT_FEEDBACK_OPTIONS.map((opt) => {
                    const active = (feedbackKinds ?? []).includes(opt.kind);
                    const danger = opt.kind === "do-not-suggest" || opt.kind === "joint-stress";
                    const tone = danger ? "#ef7d55" : opt.kind === "felt-great" || opt.kind === "pump-strong" ? GREEN : STEEL;
                    return (
                      <button
                        key={opt.kind}
                        type="button"
                        onClick={() => { onFeedback(opt.kind); if (opt.kind === "do-not-suggest") onAvoid?.(); }}
                        aria-pressed={active}
                        className="rounded-full border px-2.5 py-1 text-[10px] font-semibold transition"
                        style={active
                          ? { borderColor: `${tone}88`, background: `${tone}1f`, color: "#f2eee6" }
                          : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.5)" }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[9px] leading-snug text-white/30">Observational only — not medical advice. &ldquo;Do not suggest again&rdquo; also adds this movement to your avoid list. Stop with pain and follow clinician guidance.</p>
              </div>
            )}
            <div>
              <p className="mb-2.5 font-mono text-[8px] uppercase tracking-[0.22em] text-white/35">Why are you swapping?</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                <SegmentChip active={reason === null} onClick={() => setReason(null)} label="Show all" color={STEEL} />
                {allReasons.map((r) => (
                  <SegmentChip key={r} active={reason === r} onClick={() => setReason(r === reason ? null : r)} label={SWAP_REASON_LABELS[r]} color={GOLD} />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {filtered.length === 0 && <p className="py-6 text-center text-sm text-white/35">No tactical substitution matches that situation. Try a different reason.</p>}
              {filtered.map((sub) => (
                <motion.div key={sub.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="relative overflow-hidden rounded-2xl bg-white/[0.03] p-4">
                  <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${sub.preservesStimulus ? GREEN : GOLD}50, transparent)` }} />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-[14px] font-bold text-[#f2eee6]">{sub.name}</h4>
                      <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/40">{sub.equipment}</p>
                    </div>
                    <span className="rounded-full border px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.18em]" style={{ borderColor: sub.preservesStimulus ? `${GREEN}35` : `${GOLD}30`, color: sub.preservesStimulus ? GREEN : GOLD, background: sub.preservesStimulus ? `${GREEN}0d` : `${GOLD}0a` }}>
                      {sub.preservesStimulus ? "Mission Preserved" : "Modified Intent"}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.18em]" style={{ color: sub.preservesStimulus ? `${GREEN}aa` : `${GOLD}aa` }}>{sub.intentLine}</p>
                  <p className="mt-2 text-[11.5px] leading-[1.55] text-white/58">{sub.note}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {sub.reasons.map((r) => (
                      <span key={r} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.16em] text-white/32">{SWAP_REASON_LABELS[r]}</span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(sub, reason)}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#d5b15f]/24 bg-[#d5b15f]/10 px-3 py-2 font-mono text-[8px] uppercase tracking-[0.18em] text-[#d5b15f] transition hover:bg-[#d5b15f]/15"
                  >
                    <CheckCircle2 size={11} />Select Replacement
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function SegmentChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: string }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl border px-2.5 py-2 font-mono text-[8px] uppercase tracking-[0.16em] transition" style={{ borderColor: active ? `${color}50` : "rgba(255,255,255,0.08)", background: active ? `${color}14` : "rgba(255,255,255,0.02)", color: active ? color : "rgba(255,255,255,0.45)" }}>
      {label}
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   TODAY'S SESSION — rows, not a document.

   What gets trained, the standard, and the movements themselves — the list the member actually works from. The conditioning and
   recovery-suite choices are one row each and open their options in a sheet.
   The session's phases are not repeated here: the Session Horizon above
   already lays them out on the clock, and follows the standard chosen here.

   Surface rule: one glass layer. Rows separate with hairlines; nothing inside
   draws its own tinted, bordered or shadowed box (components.md rule 1).
   ──────────────────────────────────────────────────────────────────────── */

function SessionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[44px] items-center gap-3 py-1.5">
      <dt className="w-[92px] shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">{label}</dt>
      <dd className="min-w-0 flex-1 text-[13px] leading-[1.45] text-white/75">{children}</dd>
    </div>
  );
}

function OptionRow({
  name,
  meta,
  selected,
  disabled,
  disabledReason,
  onSelect,
}: {
  name: string;
  meta: string;
  selected: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        aria-pressed={selected}
        className="flex min-h-[44px] w-full items-center gap-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-45"
      >
        {selected ? <CheckCircle2 size={14} style={{ color: GREEN }} aria-hidden="true" /> : <Circle size={14} className="text-white/30" aria-hidden="true" />}
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-[#f2eee6]">{name}</span>
          <span className="block text-[11.5px] leading-[1.45] text-white/50">{meta}</span>
        </span>
      </button>
    </li>
  );
}

/** A row that opens a sheet of choices. */
function SheetRow({ id, label, value, onOpen }: { id?: string; label: string; value: string; onOpen: () => void }) {
  return (
    <button
      id={id}
      type="button"
      aria-haspopup="dialog"
      onClick={onOpen}
      className="flex min-h-[48px] w-full scroll-mt-4 items-center gap-3 py-2 text-left transition-colors hover:text-white"
    >
      <span className="w-[92px] shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-white/80">{value}</span>
      <ChevronRight size={14} className="shrink-0 text-white/35" aria-hidden="true" />
    </button>
  );
}

export type TrainingOptionSheet = "conditioning" | "recovery" | "depth";

/** A session-depth tier as Today's Session offers it — the member's own
    training history decides which ones are open to them. */
type DepthOption = {
  id: WorkoutDemandLevel;
  name: string;
  meta: string;
  selected: boolean;
  available: boolean;
};

/** The conditioning or recovery-suite choices, in a sheet. Choosing closes it. */
function TrainingOptionsSheet({
  open,
  onClose,
  cardioOptions,
  onSelectCardio,
  recoveryOptions,
  onSelectRecovery,
  depthOptions,
  onSelectDepth,
  block,
  onHoldForBlock,
  onOpenCycle,
}: {
  open: TrainingOptionSheet | null;
  onClose: () => void;
  cardioOptions: CardioOption[];
  onSelectCardio: (id: string) => void;
  recoveryOptions: RecoverySuiteOption[];
  onSelectRecovery: (id: string) => void;
  depthOptions: DepthOption[];
  onSelectDepth: (id: WorkoutDemandLevel) => void;
  /** The member's running cycle span, when they have one and can see it. */
  block: TrainingBlock | null;
  onHoldForBlock: (hold: boolean) => void;
  onOpenCycle: () => void;
}) {
  return (
    <ReserveBottomSheet
      open={open !== null}
      onClose={onClose}
      title={open === "recovery" ? "Recovery suite" : open === "depth" ? "Session depth" : "Conditioning"}
      accent={open === "recovery" ? VIOLET : open === "depth" ? GOLD : STEEL}
    >
      {open === "conditioning" && (
        <>
          <ul aria-label="Conditioning options" className="flex flex-col divide-y divide-white/[0.05]">
            {cardioOptions.map((opt) => (
              <OptionRow
                key={opt.id}
                name={opt.name}
                meta={`${statusLabelForCardio(opt.status)} · ${opt.duration} · ${opt.intensity} · ${opt.targetHR}`}
                selected={opt.selected}
                onSelect={() => { onSelectCardio(opt.id); onClose(); }}
              />
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] leading-[1.55] text-white/50">
            Target ranges are guidance. Adjust by readiness, symptoms, and professional guidance.
          </p>
        </>
      )}
      {open === "recovery" && (
        <>
          <ul aria-label="Recovery suite options" className="flex flex-col divide-y divide-white/[0.05]">
            {recoveryOptions.map((opt) => (
              <OptionRow
                key={opt.id}
                name={opt.name}
                meta={`${statusLabelForRecovery(opt.status)} · ${opt.duration} · ${opt.reason}`}
                selected={opt.selected}
                disabled={!opt.available}
                disabledReason="Not in the recovery tools you have available."
                onSelect={() => { onSelectRecovery(opt.id); onClose(); }}
              />
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] leading-[1.55] text-white/50">
            Optional. Skip heat or cold exposure if you feel dizzy, unwell, have chest discomfort, unusual symptoms, or clinician restrictions.
          </p>
        </>
      )}
      {open === "depth" && (
        <>
          {/* A lab date the member or their clinician set that has passed
              without a lab. Their own record, shown where they are training
              because that is when they are thinking about the block. It
              reports and routes; it never judges and never gates the session. */}
          {block?.overdue.length ? (
            <button
              type="button"
              onClick={() => { onOpenCycle(); onClose(); }}
              className="mb-2 flex min-h-[48px] w-full items-center gap-3 rounded-[12px] border border-[#d5b15f]/25 bg-[#d5b15f]/[0.06] px-3 py-2 text-left"
            >
              <span className="min-w-0 flex-1 text-[12.5px] leading-[1.5] text-[#f2eee6]">
                {block.overdue.length === 1
                  ? `A lab checkpoint you set — ${block.overdue[0].label} — passed ${block.overdue[0].daysOverdue} ${block.overdue[0].daysOverdue === 1 ? "day" : "days"} ago.`
                  : `${block.overdue.length} lab checkpoints you set have passed.`}{" "}
                <span className="text-white/55">Open Compound Command.</span>
              </span>
              <ChevronRight size={14} className="shrink-0 text-white/35" aria-hidden="true" />
            </button>
          ) : null}
          <ul aria-label="Session depth options" className="flex flex-col divide-y divide-white/[0.05]">
            {depthOptions.map((opt) => (
              <OptionRow
                key={opt.id}
                name={opt.name}
                meta={opt.meta}
                selected={opt.selected}
                disabled={!opt.available}
                disabledReason="Opens as your training history builds."
                onSelect={() => { onSelectDepth(opt.id); onClose(); }}
              />
            ))}
          </ul>
          {/* Hold the depth for the span the member declared, so they set it
              once instead of twice. Placement only — the block’s name and
              week, never a reason, and nothing about what they are taking. */}
          {block && (
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(block.demand)}
              onClick={() => onHoldForBlock(!block.demand)}
              className="mt-3 flex min-h-[48px] w-full items-center gap-3 border-t border-white/[0.06] pt-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-[#f2eee6]">Hold this depth for {block.cycleName}</span>
                <span className="block text-[11.5px] leading-[1.5] text-white/55">
                  {block.placement} · {block.daysRemaining} {block.daysRemaining === 1 ? "day" : "days"} left in the span you set.
                  Reserve hands depth back to your own setting when it ends.
                </span>
              </span>
              <span
                aria-hidden="true"
                className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ color: block.demand ? GOLD : "rgba(255,255,255,0.4)" }}
              >
                {block.demand ? "Held" : "Hold"}
              </span>
            </button>
          )}
          <p className="mt-2 text-[11.5px] leading-[1.55] text-white/50">
            Depth is what Reserve builds before the day is taken into account. Low readiness, a discomfort
            report or a deload week still step it down, and the row says so when they do.
          </p>
        </>
      )}
    </ReserveBottomSheet>
  );
}

function TodaysSessionSection({
  row,
  todayRow,
  isCatchUp,
  session,
  movements,
  sessionTitle,
  hasPlan,
  sessionMode,
  onSessionMode,
  depth,
  cardioOptions,
  recoveryOptions,
  onOpenOptions,
}: {
  row: ResolvedDay;
  todayRow?: ResolvedDay;
  isCatchUp: boolean;
  session: ActiveSession;
  movements: Movement[];
  /** What today is called on this screen — the program day's title when one
      governs, otherwise the resolved day's. The empty state used `row` and so
      named a different session than the line directly above it. */
  sessionTitle: string;
  hasPlan: boolean;
  sessionMode: SessionModeKey;
  onSessionMode: (mode: SessionModeKey) => void;
  /** What Reserve is building today, and why if the day pulled it down. */
  depth: { value: string; note: string | null } | null;
  cardioOptions: CardioOption[];
  recoveryOptions: RecoverySuiteOption[];
  onOpenOptions: (sheet: TrainingOptionSheet) => void;
}) {
  const template = session.template;
  const lifting = session.kind === "lifting" && movements.length > 0;

  const primary = template
    ? Array.from(new Set(template.phases.filter((p) => p.priority === "P1").flatMap((p) => p.movements.map((m) => m.targetMuscle))))
    : [];
  const selectedCardio = cardioOptions.find((o) => o.selected) ?? cardioOptions[0] ?? null;
  const selectedRecovery = recoveryOptions.find((o) => o.selected) ?? recoveryOptions[0] ?? null;

  const recoveryRow = selectedRecovery && (
    <SheetRow id="training-recovery-suite" label="Suite" value={selectedRecovery.name} onOpen={() => onOpenOptions("recovery")} />
  );

  return (
    <GlassPanel accent={GOLD} phone="flush" className="md:overflow-hidden">
      {/* The strength floor, as a thin strip of atmosphere above the session. */}
      <ReserveDetailImage id="strength-floor" size="strip" className={DETAIL_BAND_BLEED} />
      <section id="training-today" aria-label="Today's session" data-training="today" className="scroll-mt-4">
        <ReserveSectionHeader label={isCatchUp ? `Catch-up · ${row.dayLong}` : "Today's session"} accent={GOLD} />
        {isCatchUp && todayRow && (
          <p className="mb-2 text-[12px] leading-[1.5] text-white/55">
            Calendar today · {todayRow.dayLong} · {todayRow.displayTitle}
          </p>
        )}

        {lifting ? (
          <>
            <dl className="flex flex-col divide-y divide-white/[0.06]">
              <SessionRow label="Trains">
                <span className="font-semibold text-[#f2eee6]">{(primary.length ? primary : [session.focus]).join(" · ")}</span>
              </SessionRow>
              <SessionRow label="Standard">
                {/* Plain choices, not a boxed track: the row already sits inside the section's glass. */}
                <div role="group" aria-label="Session standard" className="-my-2 flex flex-wrap gap-x-5">
                  {SESSION_MODES.map((m) => {
                    const active = m.key === sessionMode;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        aria-pressed={active}
                        title={m.description}
                        onClick={() => onSessionMode(m.key)}
                        className="min-h-[44px] font-mono text-[10px] uppercase tracking-[0.18em] underline-offset-[6px] transition-colors"
                        style={{ color: active ? GOLD : "rgba(255,255,255,0.55)", textDecoration: active ? "underline" : "none" }}
                      >
                        {m.key === "full-reserve" ? "Full" : m.key === "express" ? "Express" : "Minimum"}
                      </button>
                    );
                  })}
                </div>
              </SessionRow>
            </dl>

            {/* Two columns from md, read down each column in order. */}
            <ol
              id="training-session-preview"
              aria-label="Today's movements"
              className="mt-2 grid scroll-mt-4 border-t border-white/[0.06] md:grid-flow-col md:gap-x-10 md:[grid-template-rows:repeat(var(--rows),auto)]"
              style={{ "--rows": Math.ceil(movements.length / 2) } as React.CSSProperties}
            >
              {movements.map((m, i) => (
                <li key={m.id} className="flex min-h-[40px] items-center gap-3 border-b border-white/[0.05] py-2">
                  <span className="tnum w-5 shrink-0 font-mono text-[10px] text-white/40">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#f2eee6]">{m.name}</span>
                  <span className="tnum shrink-0 text-[12px] text-white/55">
                    {m.sets} × {m.reps}
                  </span>
                </li>
              ))}
            </ol>

            <div className="flex flex-col divide-y divide-white/[0.06]">
              {/* Reserve builds an advanced member a deep session by default.
                  It says which one, where the session is — not three screens
                  away — so the member can dial it back in one tap. */}
              {depth && (
                <>
                  <SheetRow id="training-depth" label="Depth" value={depth.value} onOpen={() => onOpenOptions("depth")} />
                  {depth.note && (
                    <p className="pb-2 pl-[104px] text-[11.5px] leading-[1.5] text-white/50">{depth.note}</p>
                  )}
                </>
              )}
              {selectedCardio && (
                <SheetRow id="training-conditioning" label="Cardio" value={selectedCardio.name} onOpen={() => onOpenOptions("conditioning")} />
              )}
              {recoveryRow}
            </div>
          </>
        ) : session.kind === "recovery" && session.recovery ? (
          <>
            <ol id="training-recovery-runway" aria-label="Recovery runway" className="flex scroll-mt-4 flex-col divide-y divide-white/[0.06]">
              {session.recovery.items.map((item) => (
                <li key={item.id} className="flex min-h-[44px] items-center gap-3 py-2 first:pt-0">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#f2eee6]">{item.label}</span>
                  <span className="tnum shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
                    {item.duration} · {item.status}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-1 border-t border-white/[0.06]">{recoveryRow}</div>
          </>
        ) : session.kind === "activity" && session.activity ? (
          <dl className="flex flex-col divide-y divide-white/[0.06]">
            <SessionRow label="Activity">{session.activity.label}</SessionRow>
            {(formatActivityClock(session.activity.startTime) || session.activity.durationMinutes) && (
              <SessionRow label="When">
                {[formatActivityClock(session.activity.startTime), session.activity.durationMinutes ? `${session.activity.durationMinutes} min` : null].filter(Boolean).join(" · ")}
              </SessionRow>
            )}
            {formatSplitDistance(session.activity.distance) && (
              <SessionRow label="Distance goal">{formatSplitDistance(session.activity.distance)}</SessionRow>
            )}
            <SessionRow label="Load">{ACTIVITY_LOAD_LABEL[session.activity.load]} · no lifting today</SessionRow>
          </dl>
        ) : (
          <p className="text-[13px] leading-[1.6] text-white/65">
            {hasPlan ? `No workout template for “${sessionTitle}” yet.` : "No split set yet."}
          </p>
        )}
        {session.kind === "activity" && session.activity && (
          /* An activity used to end here at "no lifting today", which left the
             week showing a hole where real work happened. The member says what
             it trained, and the day becomes a record. */
          <ActivityCoveragePanel
            isoDate={localDateKey()}
            activityKey={session.activity.key}
            activityLabel={session.activity.label}
            /* The lifting day this activity is standing in for, when the
               member's own title still names one (e.g. a class on Legs). */
            plannedSplit={resolveSplitKey(row.title)}
          />
        )}
      </section>
    </GlassPanel>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LAST SESSIONS — the three most recent closed sessions, as rows.
   The full journal for each lives in the Journal.
   ──────────────────────────────────────────────────────────────────────── */

function RecentSessionRows() {
  const history = useAthleteDashboardStore((s) => s.trainingSession.sessionHistory);
  const cards = history.slice(0, 3);
  if (cards.length === 0) return null;
  return (
    <ul aria-label="Last sessions" className="flex flex-col divide-y divide-white/[0.05]">
      {cards.map((s) => (
        <li key={s.id} className="py-2.5">
          <div className="flex items-baseline gap-3">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#f2eee6]">
              {s.sessionName} <span className="font-normal text-white/50">· {s.dateLabel}</span>
            </span>
            <span className="tnum shrink-0 font-mono text-[12px]" style={{ color: GOLD }}>{s.rating.toFixed(1)}</span>
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-white/55">
            {s.completionLabel} · {progressionDecisionLabel(s.progressionDecision)} · Next · {s.nextTen}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LIVE SESSION RESERVE PANEL
   ──────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
   RESERVE ANATOMY HUD (upgrade of body map)
   ──────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
   RESERVE DAY PLANNER
   ──────────────────────────────────────────────────────────────────────── */


/* ────────────────────────────────────────────────────────────────────────────
   SUPPORT PHASE INTELLIGENCE — derived status, due-after, duration, copy
   ──────────────────────────────────────────────────────────────────────── */

function statusFromStore(
  stored: SupportPhaseStatus,
  recStatus: "recommended" | "reduced" | "skip" | undefined,
  liftingDone: boolean,
  earlierCleared: boolean,
  included: boolean,
): SupportPhaseStatusUI {
  if (!included) return "not-included";
  if (stored === "completed") return "completed";
  if (stored === "skipped") return "skipped";
  if (stored === "due-now") {
    if (recStatus === "reduced") return "reduced";
    if (recStatus === "skip") return "optional";
    return "due-now";
  }
  if (liftingDone && earlierCleared && stored === "pending") {
    // due now — color by recommendation severity
    if (recStatus === "reduced") return "reduced";
    if (recStatus === "skip") return "optional";
    return "due-now";
  }
  if (recStatus === "reduced") return "reduced";
  if (recStatus === "skip") return "optional";
  return "pending";
}

function statusLabelFor(s: SupportPhaseStatusUI): string {
  switch (s) {
    case "due-now": return "Due Now";
    case "completed": return "Completed";
    case "skipped": return "Skipped";
    case "reduced": return "Reduced Today";
    case "optional": return "Optional";
    case "recommended-if-hydrated": return "Recommended if hydrated";
    case "not-included": return "Not Included";
    default: return "Pending";
  }
}

function statusColorFor(s: SupportPhaseStatusUI, base: string): string {
  if (s === "completed") return GREEN;
  if (s === "skipped") return "rgba(255,255,255,0.35)";
  if (s === "due-now") return base;
  if (s === "reduced") return AMBER;
  if (s === "optional") return STEEL;
  if (s === "recommended-if-hydrated") return GREEN;
  if (s === "not-included") return "rgba(255,255,255,0.25)";
  return base;
}

function buildSupportPhaseSlots(args: {
  activeMode: typeof SESSION_MODES[number];
  finalLiftingMovementName: string | null;
  liftingDone: boolean;
  coreRec: PhaseRecommendation;
  cardioRec: PhaseRecommendation;
  recoveryRec: PhaseRecommendation;
  dayPrescription: DaySupportPrescription;
  selectedCardio?: CardioOption | null;
  selectedRecovery?: RecoverySuiteOption | null;
  storedCore: SupportPhaseStatus;
  storedCardio: SupportPhaseStatus;
  storedRecovery: SupportPhaseStatus;
  storedHandoff: SupportPhaseStatus;
}): SupportPhaseSlot[] {
  const {
    activeMode,
    finalLiftingMovementName,
    liftingDone,
    coreRec,
    cardioRec,
    recoveryRec,
    dayPrescription,
    selectedCardio,
    selectedRecovery,
    storedCore,
    storedCardio,
    storedRecovery,
    storedHandoff,
  } = args;

  const coreIncluded = activeMode.phases.includes("core-command");
  const cardioIncluded = activeMode.phases.includes("conditioning-reserve");
  const recoveryIncluded = activeMode.phases.includes("recovery-chamber");

  const coreCleared = !coreIncluded || storedCore === "completed" || storedCore === "skipped";
  const cardioCleared = !cardioIncluded || storedCardio === "completed" || storedCardio === "skipped";
  const recoveryCleared = !recoveryIncluded || storedRecovery === "completed" || storedRecovery === "skipped";

  const coreStatus = statusFromStore(storedCore, coreRec.status, liftingDone, true, coreIncluded);
  const cardioStatus = statusFromStore(storedCardio, cardioRec.status, liftingDone, coreCleared, cardioIncluded);
  const recoveryStatusRaw = statusFromStore(storedRecovery, recoveryRec.status, liftingDone, coreCleared && cardioCleared, recoveryIncluded);
  const recoveryStatus =
    recoveryStatusRaw === "due-now" && recoveryRec.status === "recommended"
      ? "recommended-if-hydrated"
      : recoveryStatusRaw;
  // Handoff is always required once lifting is done and earlier phases are cleared
  const handoffStatus: SupportPhaseStatusUI =
    storedHandoff === "completed" ? "completed"
    : storedHandoff === "skipped" ? "skipped"
    : (liftingDone && coreCleared && cardioCleared && recoveryCleared) ? "due-now"
    : "pending";

  const coreDueAfter = finalLiftingMovementName ?? "Final lifting movement";
  const cardioDueAfter = coreIncluded ? "Core Command" : (finalLiftingMovementName ?? "Final lifting movement");
  const recoveryDueAfter = cardioIncluded ? "Conditioning Reserve" : coreIncluded ? "Core Command" : (finalLiftingMovementName ?? "Final lifting movement");
  const handoffDueAfter =
    recoveryIncluded ? "Reserve Recovery Suite"
    : cardioIncluded ? "Conditioning Reserve"
    : coreIncluded ? "Core Command"
    : (finalLiftingMovementName ?? "Final lifting movement");

  return [
    {
      key: "core",
      label: "Core Command",
      color: VIOLET,
      icon: ShieldCheck,
      included: coreIncluded,
      required: dayPrescription.core.status === "required",
      requirementLabel: supportStatusLabel(dayPrescription.core.status),
      duration: dayPrescription.core.duration,
      dueAfter: coreDueAfter,
      status: coreStatus,
      statusLabel: statusLabelFor(coreStatus),
      reason: coreRec.reason,
    },
    {
      key: "conditioning",
      label: "Conditioning Reserve",
      color: STEEL,
      icon: Heart,
      included: cardioIncluded,
      required: dayPrescription.cardio.status === "required",
      requirementLabel: supportStatusLabel(dayPrescription.cardio.status),
      duration: selectedCardio?.duration ?? dayPrescription.cardio.duration,
      dueAfter: cardioDueAfter,
      status: cardioStatus,
      statusLabel: statusLabelFor(cardioStatus),
      reason: cardioRec.reason,
    },
    {
      key: "recovery",
      label: "Reserve Recovery Suite",
      color: VIOLET,
      icon: Waves,
      included: recoveryIncluded,
      required: dayPrescription.recovery.status === "required",
      requirementLabel: supportStatusLabel(dayPrescription.recovery.status),
      duration: selectedRecovery?.duration ?? "8–12 min optional",
      dueAfter: recoveryDueAfter,
      status: recoveryStatus,
      statusLabel: statusLabelFor(recoveryStatus),
      reason: recoveryRec.reason,
    },
    {
      key: "handoff",
      label: "Post-Session Handoff",
      color: GREEN,
      icon: CheckCircle2,
      included: true,
      required: true,
      requirementLabel: "Required",
      duration: "3–5 min",
      dueAfter: handoffDueAfter,
      status: handoffStatus,
      statusLabel: statusLabelFor(handoffStatus),
      reason: "Meal timing, hydration, recovery, sleep, and tomorrow readiness.",
    },
  ];
}

/* ────────────────────────────────────────────────────────────────────────────
   LIVE PHASE DUE TIMELINE — compact phase intelligence inside live mode
   ──────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
   MISSION RUNWAY — phase-grouped session queue
   ──────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
   COMPACT PHASE CARD — live-mode collapsible Core/Cardio/Recovery
   ──────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
   LIVE WORKOUT COCKPIT
   ──────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
   LIVE COCKPIT — what a member needs between sets, and nothing else.

   Mid-set the member reads: the movement, set N of M, the target reps, load
   and effort, the rest clock, and the one gold action (log the set). Next
   movement and the way out sit under it. Coaching, the full queue, support
   phases and the execution ledger are one tap away — a sheet or Details —
   never on the page while the bar is loaded.

   Surface rule: one glass layer. Readouts and rows separate with hairlines
   and space; nothing inside draws its own box (components.md rule 1).
   ──────────────────────────────────────────────────────────────────────── */

/** A one-second clock for the rest timer. 0 until mounted, so render stays pure. */
function useSecondTick(active: boolean): number {
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNowMs(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);
  return nowMs;
}

function CockpitReadout({ label, value, detail, testId }: { label: string; value: string; detail?: string; testId?: string }) {
  return (
    <div className="min-w-0" data-training={testId}>
      <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/55">{label}</dt>
      <dd className="mt-1.5">
        <span className="tnum block truncate font-display text-[30px] font-black leading-none text-[#f2eee6] sm:text-[40px]">{value}</span>
        {detail && <span className="mt-1 block truncate text-[11.5px] text-white/60">{detail}</span>}
      </dd>
    </div>
  );
}

function LiveCockpit({
  movement: m,
  position,
  movementCount,
  history,
  lastLoggedAt,
  exposure,
  next,
  substitution,
  manualSelection,
  canSkip,
  onLog,
  onSwap,
  onSkip,
  onEnd,
  onOpenQueue,
  onOpenCoaching,
  confirm,
  sheen,
}: {
  movement: Movement;
  position: number;
  movementCount: number;
  history: LoggedSet[];
  /** The session's most recent logged set, any movement — the rest clock runs from it. */
  lastLoggedAt: string | null;
  exposure: MovementHistoryRead | undefined;
  next: string;
  substitution: StoredSubstitution | null;
  manualSelection: boolean;
  canSkip: boolean;
  onLog: () => void;
  onSwap: () => void;
  onSkip: () => void;
  onEnd: () => void;
  onOpenQueue: () => void;
  onOpenCoaching: () => void;
  /** A set just logged or saved: the rest row confirms it for a moment. */
  confirm: { id: string; line: string } | null;
  sheen: boolean;
}) {
  const done = history.length;
  const setNumber = Math.min(done + 1, m.sets);
  const extra = done >= m.sets;
  const effort = m.rirTargets?.[Math.min(done, m.sets - 1)] ?? m.intensity ?? null;
  const lastSetLoad = history.length > 0 ? history[history.length - 1].load : null;
  const load = lastSetLoad && lastSetLoad > 0 ? { value: `${lastSetLoad}`, detail: `${getLoadUnit(m).unit} · last set` }
    : m.lastLoad && m.lastLoad > 0 ? { value: `${m.lastLoad}`, detail: `${getLoadUnit(m).unit} · last time` }
    /* No history yet → a starting estimate from the member's own body data,
       always labelled as an estimate so it is never mistaken for their lift. */
    : m.loadIsEstimate && m.suggestedLoad > 0 ? { value: `${m.suggestedLoad}`, detail: `${getLoadUnit(m).unit} · starting estimate` }
    /* No history and no body weight to estimate from: say which, so the blank
       reads as a missing input rather than a gap in the plan. */
    : { value: "—", detail: "Your call — log body weight for a starting estimate" };
  const nowMs = useSecondTick(Boolean(lastLoggedAt));
  const restSeconds = m.restSeconds ?? 90;
  const rest = nowMs > 0 ? restClock(lastLoggedAt, restSeconds, nowMs) : null;

  return (
    <GlassPanel accent={GOLD} phone="flush" className="md:overflow-hidden">
      <section id="training-cockpit" aria-label="Current movement" data-training="cockpit" className="scroll-mt-4">
        <p role="status" aria-live="polite" className="sr-only">{confirm?.line ?? ""}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-mono text-[9px] uppercase tracking-[0.24em] text-[#d5b15f]/85">
            Movement {position} of {movementCount} · {movementRoleLabel(m)}
          </p>
          <button
            type="button"
            onClick={onEnd}
            className="-mr-2 inline-flex min-h-[44px] shrink-0 items-center px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#ef7d55]/85 transition-colors hover:text-[#ef7d55]"
          >
            End Workout
          </button>
        </div>

        <h3 className="break-words font-display text-[28px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#f2eee6] [hyphens:none] sm:text-[38px]">
          {m.name}
        </h3>
        {(m.superset || substitution || (manualSelection && !extra)) && (
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/55">
            {[
              /* Name the partner when we know it — "back-to-back with its pair"
                 made the member hunt the queue for what came next. */
              m.superset
                ? m.supersetPartner
                  ? `Superset ${m.superset} · straight into ${m.supersetPartner}`
                  : `Superset ${m.superset} · back-to-back with its pair`
                : null,
              substitution ? `Swapped · ${substitution.replacementName}` : null,
              manualSelection && !extra ? "Picked out of order" : null,
            ].filter(Boolean).join(" · ")}
          </p>
        )}

        {m.finishingTechnique && (
          /* The intensity technique lands on the LAST set — call it out while
             the member is on it, not after. Training instruction only. */
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-[11px] leading-snug ${
              setNumber >= m.sets && !extra
                ? "border-[#d5b15f]/30 bg-[#d5b15f]/[0.07] text-white/75"
                : "border-white/[0.07] bg-white/[0.02] text-white/45"
            }`}
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#d5b15f]/90">
              {m.finishingTechnique.label} · set {m.sets}
            </span>
            <span className="mt-1 block">{m.finishingTechnique.instruction}</span>
          </p>
        )}

        <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-4">
          <CockpitReadout testId="set-count" label="Set" value={extra ? `${done + 1}` : `${setNumber}/${m.sets}`} detail={extra ? `Extra · ${m.sets} planned` : undefined} />
          <CockpitReadout label="Reps" value={m.reps} detail={effort ?? undefined} />
          <CockpitReadout label="Load" value={load.value} detail={load.detail} />
        </dl>

        <dl className="mt-4 flex flex-col divide-y divide-white/[0.06] border-t border-white/[0.06]">
          <div className="relative flex min-h-[44px] items-center gap-3 py-1.5" data-training="rest-timer" role="timer" aria-label="Rest timer">
            {confirm && <SetLoggedSweep id={confirm.id} />}
            <dt className="flex w-[92px] shrink-0 items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">
              <Timer size={11} aria-hidden="true" />Rest
            </dt>
            <dd className="min-w-0 flex-1 text-[13px] text-white/75">
              {rest ? (
                <span>
                  <span className="tnum font-display text-[20px] font-black" style={{ color: rest.over ? GREEN : "#f2eee6" }}>
                    {formatClockSeconds(rest.remaining)}
                  </span>{" "}
                  <span className="text-white/55">{rest.over ? "over · ready when you are" : `left of ${m.rest}`}</span>
                </span>
              ) : (
                <span>{m.rest} between sets</span>
              )}
              {confirm && <span className="mt-1 block"><SetLoggedMark id={confirm.id} line={confirm.line} /></span>}
            </dd>
          </div>
          {exposure && (
            <div className="flex min-h-[44px] items-center gap-3 py-1.5">
              <dt className="w-[92px] shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">Last time</dt>
              <dd className="min-w-0 flex-1 text-[13px] leading-[1.45] text-white/75">
                {exposure.lastLine} <span className="text-white/45">· {exposure.lastDateLabel}</span>
                <span className="block text-[12px]" style={{ color: GOLD }}>{exposure.targetLine}</span>
              </dd>
            </div>
          )}
          {history.length > 0 && (
            <div className="flex min-h-[44px] items-center gap-3 py-1.5">
              <dt className="w-[92px] shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">Logged</dt>
              <dd className="tnum min-w-0 flex-1 truncate text-[13px] text-white/75">
                {history.map((s) => `${s.load > 0 ? s.load : "BW"} × ${s.reps}`).join("  ·  ")}
              </dd>
            </div>
          )}
          <div className="flex min-h-[44px] items-center gap-3 py-1.5">
            <dt className="w-[92px] shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">Next</dt>
            <dd className="min-w-0 flex-1 truncate text-[13px] text-white/75">{next}</dd>
          </div>
        </dl>

        {/* The one gold action. On a phone it rides above the tab bar while the cockpit is on screen. */}
        <div
          data-training="log-set"
          className="mt-4 max-md:sticky max-md:bottom-[calc(var(--fba-shell-bottom-h,calc(56px+env(safe-area-inset-bottom,0px)))+8px)] max-md:z-10 max-md:-mx-1 max-md:bg-[linear-gradient(180deg,transparent,rgba(6,7,11,0.92)_30%)] max-md:px-1 max-md:pb-1 max-md:pt-3"
        >
          <ReserveButton tier="primary" size="lg" fullWidth icon={CheckCircle2} sheen={sheen} onClick={onLog}>
            {extra ? "Log Extra Set" : `Log Set ${done + 1} of ${m.sets}`}
          </ReserveButton>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-x-2 sm:flex sm:flex-wrap sm:gap-x-4">
          <ReserveButton tier="quiet" size="sm" icon={Shuffle} onClick={onSwap}>Swap Movement</ReserveButton>
          {canSkip ? (
            <ReserveButton tier="quiet" size="sm" icon={X} onClick={onSkip}>Skip Movement</ReserveButton>
          ) : (
            <ReserveButton tier="quiet" size="sm" icon={X} disabled disabledReason="This movement is already closed in the session record.">Skip Movement</ReserveButton>
          )}
          <ReserveButton tier="quiet" size="sm" icon={GraduationCap} onClick={onOpenCoaching}>Coaching</ReserveButton>
          <ReserveButton tier="quiet" size="sm" icon={ListChecks} onClick={onOpenQueue}>All Movements</ReserveButton>
        </div>
      </section>
    </GlassPanel>
  );
}

/** Every movement in today's queue. Choosing one makes it current and closes the sheet. */
function MovementQueueSheet({
  open,
  onClose,
  movements,
  currentId,
  workoutSets,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  movements: Movement[];
  currentId: string | null;
  workoutSets: Record<string, LoggedSet[]>;
  onSelect: (id: string) => void;
}) {
  return (
    <ReserveBottomSheet open={open} onClose={onClose} title="All movements" accent={GOLD}>
      <ol aria-label="Session movements" className="flex flex-col divide-y divide-white/[0.05]">
        {movements.map((mv, i) => {
          const logged = workoutSets[mv.id]?.length ?? 0;
          const current = mv.id === currentId;
          const closed = logged >= mv.sets;
          return (
            <li key={mv.id}>
              <button
                type="button"
                aria-current={current ? "step" : undefined}
                onClick={() => { onSelect(mv.id); onClose(); }}
                className="flex min-h-[48px] w-full items-center gap-3 py-2 text-left"
              >
                <span className="tnum w-5 shrink-0 font-mono text-[10px] text-white/40">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold" style={{ color: current ? GOLD : "#f2eee6" }}>{mv.name}</span>
                  <span className="block text-[11.5px] text-white/50">{mv.sets} × {mv.reps} · rest {mv.rest}</span>
                </span>
                <span className="tnum shrink-0 font-mono text-[11px]" style={{ color: closed ? GREEN : "rgba(255,255,255,0.55)" }}>
                  {logged}/{mv.sets}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </ReserveBottomSheet>
  );
}

/** How to perform the current movement: its purpose, standard, feel and the common error. */
function CoachingSheet({ open, onClose, movement }: { open: boolean; onClose: () => void; movement: Movement | null }) {
  return (
    <ReserveBottomSheet open={open} onClose={onClose} title={movement ? `Coaching · ${movement.name}` : "Coaching"} accent={VIOLET}>
      {movement && (
        <dl className="flex flex-col divide-y divide-white/[0.06]">
          <SessionRow label="Why here">{movement.purpose}</SessionRow>
          <SessionRow label="Standard">{movement.cue}</SessionRow>
          <SessionRow label="Feel">{movement.education.whatToFeel}</SessionRow>
          <SessionRow label="Avoid">{movement.education.commonError}</SessionRow>
          <SessionRow label="Tempo">{movementTempoValue(movement)}</SessionRow>
          <SessionRow label="Targets">{[...movement.primaryMuscles, ...movement.secondaryMuscles.slice(0, 2)].join(" · ")}</SessionRow>
        </dl>
      )}
    </ReserveBottomSheet>
  );
}

/** The member's own logged entries due around this session. Record keeping only. */
function LoggedEntryRows({ schedulePlan }: { schedulePlan: { wakeTime: string; sleepTime: string; workoutTime: string } }) {
  const entries = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog);
  const adherence = useAthleteDashboardStore((s) => s.trainingSession.enhancementAdherence);
  const logEnhancementAdherence = useAthleteDashboardStore((s) => s.logEnhancementAdherence);
  const slots = useMemo(
    () => getEnhancementDailySchedule({
      entries,
      adherence,
      isTrainingDay: true,
      wakeTime: schedulePlan.wakeTime,
      sleepTime: schedulePlan.sleepTime,
      preferredGymTime: schedulePlan.workoutTime,
      date: todayDateString(),
    }),
    [entries, adherence, schedulePlan.wakeTime, schedulePlan.sleepTime, schedulePlan.workoutTime],
  );
  if (entries.length === 0) return null;
  const summary = summarizeStack(slots);
  const due = slots.map((slot) => ({ slot, meta: getStackStatus(slot) })).find((x) => x.meta.status === "due");
  return (
    <section aria-label="Your logged entries">
      <ReserveSectionHeader label="Your logged entries" accent={VIOLET} />
      <dl className="flex flex-col divide-y divide-white/[0.06]">
        {due ? (
          <SessionRow label="Due now">
            <span className="font-semibold text-[#f2eee6]">{due.slot.entry.name}</span> · {due.slot.plannedTimeLabel}
            <span className="mt-1 flex gap-4">
              <button
                type="button"
                onClick={() => {
                  logEnhancementAdherence({ entryId: due.slot.entryId, date: todayDateString(), plannedTime: due.slot.plannedTime, takenStatus: "taken", actualTime: new Date().toTimeString().slice(0, 5) });
                  markCompoundLogged();
                }}
                className="min-h-[44px] font-mono text-[10px] uppercase tracking-[0.18em] text-[#79e3b5]"
              >
                Mark Logged
              </button>
              <button
                type="button"
                onClick={() => {
                  logEnhancementAdherence({ entryId: due.slot.entryId, date: todayDateString(), plannedTime: due.slot.plannedTime, takenStatus: "skipped" });
                  markCompoundLogged();
                }}
                className="min-h-[44px] font-mono text-[10px] uppercase tracking-[0.18em] text-white/55"
              >
                Skip
              </button>
            </span>
          </SessionRow>
        ) : (
          <SessionRow label="Today">{summary.logged} logged · {summary.pending} pending</SessionRow>
        )}
      </dl>
      <p className="mt-1 text-[11.5px] leading-[1.5] text-white/45">Your own record, as you set it. Reserve does not prescribe.</p>
    </section>
  );
}

const SUPPORT_ACTIONABLE = new Set<SupportPhaseStatusUI>(["due-now", "reduced", "optional", "recommended-if-hydrated"]);

/** The support phases after lifting, with their start / done / skip controls. */
function SupportPhaseRows({
  slots,
  onAction,
  selectedCardio,
  selectedRecovery,
  onOpenOptions,
  locked,
}: {
  slots: SupportPhaseSlot[];
  onAction: (key: SupportPhaseSlot["key"], action: "complete" | "skip" | "start") => void;
  selectedCardio: CardioOption | null;
  selectedRecovery: RecoverySuiteOption | null;
  onOpenOptions: (sheet: TrainingOptionSheet) => void;
  /** After close-out the phases are a record: no controls. */
  locked?: boolean;
}) {
  const shown = slots.filter((s) => s.included);
  return (
    <section aria-label="After lifting">
      <ReserveSectionHeader label="After lifting" accent={STEEL} />
      <ul className="flex flex-col divide-y divide-white/[0.06]">
        {shown.map((slot) => {
          const color = statusColorFor(slot.status, slot.color);
          const canAct = !locked && slot.key !== "handoff" && SUPPORT_ACTIONABLE.has(slot.status);
          return (
            <li key={slot.key} className="flex min-h-[48px] flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-[#f2eee6]">{slot.label}</span>
                <span className="block text-[11.5px] text-white/50">{slot.duration} · after {slot.dueAfter}</span>
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color }}>{slot.statusLabel}</span>
              {canAct && (
                <span className="flex w-full gap-4 sm:w-auto">
                  <button type="button" onClick={() => onAction(slot.key, "start")} className="min-h-[44px] font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">Start</button>
                  <button type="button" onClick={() => onAction(slot.key, "complete")} className="min-h-[44px] font-mono text-[10px] uppercase tracking-[0.18em] text-[#79e3b5]">Done</button>
                  <button type="button" onClick={() => onAction(slot.key, "skip")} className="min-h-[44px] font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">Skip</button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {!locked && (
        <div className="flex flex-col divide-y divide-white/[0.06] border-t border-white/[0.06]">
          {selectedCardio && <SheetRow label="Cardio" value={selectedCardio.name} onOpen={() => onOpenOptions("conditioning")} />}
          {selectedRecovery && <SheetRow label="Suite" value={selectedRecovery.name} onOpen={() => onOpenOptions("recovery")} />}
        </div>
      )}
      <p className="mt-1 text-[11.5px] leading-[1.5] text-white/45">
        Recovery suite is optional. Skip heat or cold if dizzy, unwell, with chest discomfort or clinician restrictions.
      </p>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   CLOSE-OUT — the numbers that matter, how it was logged, and what is next.
   The long debrief moved into Details as rows.
   ──────────────────────────────────────────────────────────────────────── */

function CloseOutPanel({
  movementsLogged,
  movementCount,
  volume,
  records,
  hasPriorHistory,
  logAccuracy,
  sessionCompletion,
  progression,
  meal,
  nextSession,
  onMeal,
  sheen,
}: {
  movementsLogged: number;
  movementCount: number;
  volume: number | null;
  records: string[];
  hasPriorHistory: boolean;
  logAccuracy: LogAccuracy;
  sessionCompletion: SessionCompletion;
  progression: ProgressionDecision | null;
  meal: PostWorkoutMealGuidance | null;
  nextSession: string | null;
  onMeal: () => void;
  sheen: boolean;
}) {
  return (
    <GlassPanel accent={GOLD} phone="flush" className="md:overflow-hidden">
      <section id="training-closeout" aria-label="Close-out" data-training="closeout" className="scroll-mt-4">
        <ReserveSectionHeader label="Close-out" accent={GOLD} />
        <dl className="grid grid-cols-2 gap-4 border-b border-white/[0.06] pb-4">
          <CockpitReadout label="Movements" value={`${movementsLogged}/${movementCount}`} detail="with a logged set" />
          <CockpitReadout label="Volume" value={volume ? volume.toLocaleString("en-US") : "—"} detail={volume ? "lb · load × reps" : "No loaded sets"} />
        </dl>
        <dl className="flex flex-col divide-y divide-white/[0.06]">
          <SessionRow label="Records">
            {records.length > 0
              ? <span style={{ color: GOLD }}>{records.join(" · ")}</span>
              : hasPriorHistory ? "None against your last exposure" : "First logged exposure · a baseline"}
          </SessionRow>
          <SessionRow label="Logged as">{logAccuracyLabel(logAccuracy)} · {sessionCompletionLabel(sessionCompletion)}</SessionRow>
          {progression && <SessionRow label="Next time">{progressionDecisionLabel(progression)}</SessionRow>}
          {meal && <SessionRow label="Meal window">{meal.timingWindow.replace(/^Target:\s*/i, "")} · {meal.mealLabel}</SessionRow>}
          {nextSession && <SessionRow label="Next session">{nextSession}</SessionRow>}
        </dl>
        <div className="mt-4">
          <ReserveButton tier="primary" size="lg" fullWidth icon={Utensils} sheen={sheen} onClick={onMeal}>
            Log Recovery Meal
          </ReserveButton>
        </div>
      </section>
    </GlassPanel>
  );
}

/** The session's own review, as rows — what the long debrief used to spread over twenty cards. */
function SessionReviewRows({ debrief }: { debrief: ReturnType<typeof buildDebrief> }) {
  return (
    <section aria-label="Session review">
      <ReserveSectionHeader label="Session review" accent={GOLD} />
      <dl className="flex flex-col divide-y divide-white/[0.06]">
        <SessionRow label="Done">{debrief.gotDone}</SessionRow>
        <SessionRow label="Best set">{debrief.bestOutput}</SessionRow>
        <SessionRow label="Limiter">{debrief.limiter}</SessionRow>
        <SessionRow label="Next time">{debrief.progression.copy}</SessionRow>
        <SessionRow label="Sleep">{debrief.sleep}</SessionRow>
      </dl>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   NOT-READY / SESSION FLEX MODAL
   Shown when End Session is clicked with 0 meaningful sets logged.
   Five clean paths: Not Ready · Accidental Start · Reschedule · Switch ·
   Save As Partial Note. Only "Not Ready" and "Accidental Start" reset with
   no side effects. Reschedule captures a targetDate. Switch records a swap
   and navigates to the new session. Save Note is lightweight — no
   post-workout logic, no progression anchor, no debrief.
   ──────────────────────────────────────────────────────────────────────── */

const NOT_READY_DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function NotReadyModal({
  sessionTitle,
  weeklyPlan,
  todayIndex,
  onNotReady,
  onReschedule,
  onSwitchSession,
  onSaveNote,
  onCancel,
}: {
  sessionTitle: string;
  weeklyPlan: ResolvedDay[];
  todayIndex: number;
  onNotReady: (action: Extract<TrainingOverrideAction, "not_ready" | "accidental_start">) => void;
  onReschedule: (target: { targetDate: string; targetDayIndex: number; targetDayTitle: string; targetSessionId?: string }) => void;
  onSwitchSession: (dayIndex: number, newSessionTitle: string) => void;
  onSaveNote: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"main" | "reschedule" | "switch">("main");
  const [selectedTargetDayIndex, setSelectedTargetDayIndex] = useState<number | null>(null);
  const [customTargetDate, setCustomTargetDate] = useState("");
  const [minimumTargetDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return programDateKey(date);
  });

  function computeDateForDayIndex(dayIndex: number): string {
    const dt = new Date();
    dt.setDate(dt.getDate() + (dayIndex - todayIndex));
    return programDateKey(dt);
  }

  function formatDayLabel(dayIndex: number): string {
    const offset = dayIndex - todayIndex;
    if (offset === 1) return "Tomorrow";
    const dt = new Date();
    dt.setDate(dt.getDate() + offset);
    return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  /* A picked target day or date is the member's entry: an outside click keeps
     it, and X / Escape ask before discarding it. The main step's options act
     on tap and hold nothing to lose. */
  const guard = useFormCloseGuard(
    step === "reschedule" && (selectedTargetDayIndex !== null || customTargetDate !== ""),
    onCancel,
    { backdropClosesWhenClean: true },
  );

  const rescheduleDays = weeklyPlan.filter((d) => d.dayIndex > todayIndex && !d.recovery);
  const switchDays = weeklyPlan.filter((d) => d.dayIndex !== todayIndex && !d.recovery);

  return (
    <AnimatePresence>
      {/* Fades in with CSS, not presence-tracked — a second exit animation is a
          second thing that can stall and strand the overlay. */}
      <div
        className="fba-scrim-in fixed inset-0 z-50 flex items-end justify-center bg-black/82 p-0 sm:items-center sm:p-4"
        style={{ backdropFilter: "blur(18px) saturate(120%)" }}
        onClick={() => guard.requestCloseFrom("backdrop")}
      >
        <motion.div
          role="dialog" aria-modal="true" aria-label="Not starting yet"
          className="relative w-full max-w-xl overflow-hidden rounded-t-[28px] border border-white/[0.1] sm:rounded-[28px]"
          style={{
            background: "linear-gradient(168deg, rgba(14,16,24,0.96) 0%, rgba(6,7,11,0.99) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 32px 120px rgba(0,0,0,0.82)",
          }}
          /* No exit animation, on purpose — framer stalls mid-exit under CPU
             starvation and never releases the node, stranding the sheet over
             a dimmed screen. Dismissal must not wait on an animation. */
          initial={{ y: 44, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${STEEL}55, transparent)` }} />
          <DiscardChangesBar guard={guard} />

          {/* ── MAIN step ─────────────────────────────────────────────────── */}
          {step === "main" && (
            <>
              <div className="border-b border-white/[0.06] px-5 py-4">
                <div className="flex items-center gap-2">
                  <motion.span className="h-1.5 w-1.5 rounded-full" style={{ background: STEEL }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} />
                  <p className="font-mono text-[8px] uppercase tracking-[0.28em]" style={{ color: `${STEEL}cc` }}>0 Sets Logged · Session Flex</p>
                </div>
                <h3 className="mt-1.5 text-[18px] font-black leading-tight text-[#f2eee6]">Not starting yet?</h3>
                <p className="mt-2 text-[12px] leading-[1.55] text-white/50">
                  No sets were logged for <span className="font-semibold text-white/80">{sessionTitle}</span>. Reserve won&apos;t treat this as a workout.
                </p>
              </div>
              <div className="flex flex-col gap-2.5 p-5">
                <motion.button type="button" onClick={() => onNotReady("not_ready")} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden rounded-2xl border p-4 text-left transition-all" style={{ borderColor: `${STEEL}30`, background: `linear-gradient(160deg, ${STEEL}0e 0%, rgba(255,255,255,0.012) 100%)` }}>
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: STEEL }}>Not Ready</p>
                  <p className="mt-1 text-[12px] leading-[1.5] text-white/60">Set today aside without recording training output. The calendar keeps the exact reason.</p>
                </motion.button>
                <motion.button type="button" onClick={() => onNotReady("accidental_start")} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden rounded-2xl border p-4 text-left transition-all" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.025)" }}>
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/55">Accidental Start</p>
                  <p className="mt-1 text-[12px] leading-[1.5] text-white/50">Reset the empty session and retain an accidental-start calendar record.</p>
                </motion.button>
                <motion.button type="button" onClick={() => setStep("reschedule")} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden rounded-2xl border p-4 text-left transition-all" style={{ borderColor: `${VIOLET}30`, background: `linear-gradient(160deg, ${VIOLET}0e 0%, rgba(255,255,255,0.012) 100%)` }}>
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: VIOLET }}>Reschedule Session</p>
                  <p className="mt-1 text-[12px] leading-[1.5] text-white/60">Move today&apos;s session to another day this week. Reserve protects the architecture.</p>
                </motion.button>
                <motion.button type="button" onClick={() => setStep("switch")} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden rounded-2xl border p-4 text-left transition-all" style={{ borderColor: `${GREEN}30`, background: `linear-gradient(160deg, ${GREEN}0e 0%, rgba(255,255,255,0.012) 100%)` }}>
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: GREEN }}>Switch Session</p>
                  <p className="mt-1 text-[12px] leading-[1.5] text-white/60">Train a different session from this week instead. No post-workout logic triggered.</p>
                </motion.button>
                <motion.button type="button" onClick={onSaveNote} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden rounded-2xl border p-4 text-left transition-all" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.025)" }}>
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/55">Save As Partial Note</p>
                  <p className="mt-1 text-[12px] leading-[1.5] text-white/50">Record a brief note only. No post-workout logic, no progression anchor, no output captured.</p>
                </motion.button>
                <button type="button" onClick={onCancel} className="mt-1 flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] py-3 font-mono text-[8px] uppercase tracking-[0.2em] text-white/45 transition hover:text-white/75">
                  <X size={11} />Keep Training
                </button>
              </div>
            </>
          )}

          {/* ── RESCHEDULE step ────────────────────────────────────────────── */}
          {step === "reschedule" && (
            <>
              <div className="border-b border-white/[0.06] px-5 py-4">
                <button type="button" onClick={() => setStep("main")} className="mb-3 flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-white/40 transition hover:text-white/70">
                  <ArrowLeft size={10} />Back
                </button>
                <h3 className="text-[17px] font-black leading-tight text-[#f2eee6]">Move to which day?</h3>
                <p className="mt-1.5 text-[12px] leading-[1.5] text-white/50">Pick a target day for <span className="font-semibold text-white/75">{sessionTitle}</span>. Reserve will note it and protect the week architecture.</p>
              </div>
              <div className="flex flex-col gap-2 p-5">
                {rescheduleDays.length === 0 ? (
                  <p className="rounded-xl bg-white/[0.02] p-3 text-[12px] text-white/40">No upcoming training day remains this week. Pick another calendar date below.</p>
                ) : (
                  rescheduleDays.map((day) => {
                    const isSelected = selectedTargetDayIndex === day.dayIndex;
                    return (
                      <button
                        key={day.dayIndex}
                        type="button"
                        onClick={() => { setSelectedTargetDayIndex(isSelected ? null : day.dayIndex); setCustomTargetDate(""); }}
                        className="flex items-center justify-between rounded-2xl border p-3.5 text-left transition-all"
                        style={{ borderColor: isSelected ? `${VIOLET}60` : "rgba(255,255,255,0.08)", background: isSelected ? `${VIOLET}12` : "rgba(255,255,255,0.02)" }}
                      >
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: isSelected ? VIOLET : "rgba(255,255,255,0.4)" }}>
                            {NOT_READY_DAY_SHORT[day.dayIndex]} · {formatDayLabel(day.dayIndex)}
                          </p>
                          <p className="mt-0.5 text-[13px] font-bold text-[#f2eee6]">{day.displayTitle}</p>
                        </div>
                        {isSelected && <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: VIOLET }} />}
                      </button>
                    );
                  })
                )}
                <label className="mt-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                  <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/38">Pick Another Date</span>
                  <input
                    type="date"
                    min={minimumTargetDate}
                    value={customTargetDate}
                    onChange={(event) => { setCustomTargetDate(event.target.value); setSelectedTargetDayIndex(null); }}
                    className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-[12px] text-white/75 outline-none focus:border-[#a78bfa]/50"
                  />
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={selectedTargetDayIndex === null && !customTargetDate}
                    title={selectedTargetDayIndex === null && !customTargetDate ? "Pick a new target day" : undefined}
                    onClick={() => {
                      const selected = selectedTargetDayIndex === null ? null : weeklyPlan.find((day) => day.dayIndex === selectedTargetDayIndex);
                      const targetDate = selectedTargetDayIndex !== null ? computeDateForDayIndex(selectedTargetDayIndex) : customTargetDate;
                      const targetDateValue = new Date(`${targetDate}T12:00:00`);
                      const targetDayIndex = selectedTargetDayIndex ?? (targetDateValue.getDay() + 6) % 7;
                      onReschedule({
                        targetDate,
                        targetDayIndex,
                        targetDayTitle: selected?.displayTitle ?? targetDateValue.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
                        targetSessionId: selected?.splitKey ?? undefined,
                      });
                    }}
                    className="flex-1 rounded-2xl py-3 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
                    style={{ background: `linear-gradient(120deg, #e8c87a, ${GOLD})` }}
                  >
                    {selectedTargetDayIndex !== null ? `Move to ${formatDayLabel(selectedTargetDayIndex)}` : customTargetDate ? "Move to Selected Date" : "Pick New Day"}
                  </button>
                  <button type="button" onClick={() => { setSelectedTargetDayIndex(null); setCustomTargetDate(""); setStep("main"); }} aria-label="Clear the new day and go back" className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 text-white/40 transition hover:text-white/70">
                    <X size={12} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── SWITCH SESSION step ────────────────────────────────────────── */}
          {step === "switch" && (
            <>
              <div className="border-b border-white/[0.06] px-5 py-4">
                <button type="button" onClick={() => setStep("main")} className="mb-3 flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-white/40 transition hover:text-white/70">
                  <ArrowLeft size={10} />Back
                </button>
                <h3 className="text-[17px] font-black leading-tight text-[#f2eee6]">Switch to which session?</h3>
                <p className="mt-1.5 text-[12px] leading-[1.5] text-white/50">Choose a different session from this week. No post-workout logic triggered for the skipped session.</p>
              </div>
              <div className="flex flex-col gap-2 p-5">
                {switchDays.length === 0 ? (
                  <p className="rounded-xl bg-white/[0.02] p-3 text-[12px] text-white/40">No other sessions available this week.</p>
                ) : (
                  switchDays.map((day) => (
                    <button
                      key={day.dayIndex}
                      type="button"
                      onClick={() => onSwitchSession(day.dayIndex, day.displayTitle)}
                      className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-left transition-all hover:border-white/[0.16] hover:bg-white/[0.04]"
                    >
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                          {NOT_READY_DAY_SHORT[day.dayIndex]} · {day.dayIndex < todayIndex ? "Earlier this week" : "Upcoming"}
                        </p>
                        <p className="mt-0.5 text-[13px] font-bold text-[#f2eee6]">{day.displayTitle}</p>
                      </div>
                      <ChevronRight size={14} className="shrink-0 text-white/30" />
                    </button>
                  ))
                )}
                <button type="button" onClick={() => setStep("main")} className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] py-3 font-mono text-[8px] uppercase tracking-[0.2em] text-white/45 transition hover:text-white/75">
                  <X size={11} />Cancel
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   END WORKOUT MODAL
   ──────────────────────────────────────────────────────────────────────── */

function EndWorkoutModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (a: CloseoutAccuracy, extras: { logAccuracy: LogAccuracy; sessionCompletion: SessionCompletion }) => void;
}) {
  const [step, setStep] = useState<"accuracy" | "completion">("accuracy");
  const [logAccuracy, setLogAccuracy] = useState<LogAccuracy | null>(null);

  const accuracyOpts: { value: LogAccuracy; label: string; desc: string; color: string }[] = [
    { value: "fully-accurate", label: "Fully Accurate", desc: "Everything shown is exactly what happened.", color: GREEN },
    { value: "mostly-accurate", label: "Mostly Accurate", desc: "Main work is correct. Minor details may be missing.", color: GOLD },
    { value: "estimated", label: "Estimated Closeout", desc: "Session happened, but details are incomplete.", color: STEEL },
  ];

  const completionOpts: { value: SessionCompletion; label: string; desc: string; color: string }[] = [
    { value: "as-planned", label: "Completed As Planned", desc: "All planned work was performed — regardless of how much got logged.", color: GREEN },
    { value: "partial", label: "Partial Session", desc: "Main lifts captured, but the full plan was not finished.", color: GOLD },
    { value: "minimum-effective", label: "Minimum Effective Session", desc: "Primary output secured, accessory work trimmed.", color: STEEL },
    { value: "stopped-early", label: "Stopped Early", desc: "Cut short — fatigue, time, or signal said stop.", color: RED },
  ];

  /* Step 1's answer is held until step 2 confirms it: an outside click keeps
     it, and Cancel / Escape ask before discarding it. */
  const guard = useFormCloseGuard(step === "completion" && logAccuracy !== null, onClose, { backdropClosesWhenClean: true });

  function handleAccuracySelect(v: LogAccuracy) {
    setLogAccuracy(v);
    setStep("completion");
  }

  function handleCompletionSelect(v: SessionCompletion) {
    if (!logAccuracy) return;
    const legacyAccuracy: CloseoutAccuracy =
      logAccuracy === "fully-accurate" ? "fully-logged"
      : logAccuracy === "mostly-accurate" ? "operationally-accurate"
      : "quick-closeout";
    onConfirm(legacyAccuracy, { logAccuracy, sessionCompletion: v });
  }

  return (
    <AnimatePresence>
      {/* Fades in with CSS, not presence-tracked — a second exit animation is a
          second thing that can stall and strand the overlay. */}
      <div
        className="fba-scrim-in fixed inset-0 z-50 flex items-end justify-center bg-black/82 p-0 sm:items-center sm:p-4"
        style={{ backdropFilter: "blur(18px) saturate(120%)" }}
        onClick={() => guard.requestCloseFrom("backdrop")}
      >
        <motion.div
          role="dialog" aria-modal="true" aria-label="Close out session"
          /* safe-bottom: on a phone the last choice clears the home indicator. */
          className="safe-bottom relative w-full max-w-xl overflow-hidden rounded-t-[28px] border border-white/[0.1] sm:rounded-[28px]"
          style={{
            background: "linear-gradient(168deg, rgba(14,16,24,0.96) 0%, rgba(6,7,11,0.99) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(213,177,95,0.05), 0 32px 120px rgba(0,0,0,0.82), 0 0 60px rgba(213,177,95,0.05)",
          }}
          /* No exit animation, on purpose — framer stalls mid-exit under CPU
             starvation and never releases the node, stranding the sheet over
             a dimmed screen. Dismissal must not wait on an animation. */
          initial={{ y: 44, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}55, transparent)` }} />
          <DiscardChangesBar guard={guard} />
          <div className="border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <motion.span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} />
              <p className="font-mono text-[8px] uppercase tracking-[0.28em] text-[#d5b15f]/85">Closeout · Step {step === "accuracy" ? "1" : "2"} of 2</p>
            </div>
            <h3 className="mt-1.5 text-[18px] font-black leading-tight text-[#f2eee6]">
              {step === "accuracy" ? "How accurate is this log?" : "How much of the session did you complete?"}
            </h3>
            <p className="mt-2 text-[12px] leading-[1.55] text-white/50">
              {step === "accuracy"
                ? "Honest answer keeps progression calibration clean. This is about the data, not the workout."
                : "Separate from log accuracy — this is about what actually happened in the gym."}
            </p>
          </div>

          {/* No exit on these steps: with mode="wait" the incoming step is not
              mounted until the outgoing one has left, so a stalled exit means
              the next step never appears. */}
          <AnimatePresence mode="wait">
            {step === "accuracy" ? (
              <motion.div key="accuracy" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }} className="flex flex-col gap-3 p-5">
                {accuracyOpts.map((opt) => (
                  <motion.button
                    key={opt.value}
                    type="button"
                    onClick={() => handleAccuracySelect(opt.value)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative overflow-hidden rounded-2xl border p-4 text-left transition-all"
                    style={{
                      borderColor: `${opt.color}30`,
                      background: `linear-gradient(160deg, ${opt.color}0e 0%, rgba(255,255,255,0.012) 100%)`,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${opt.color}55, transparent)` }} />
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: opt.color }}>{opt.label}</p>
                      <ChevronRight size={13} style={{ color: opt.color }} />
                    </div>
                    <p className="mt-1.5 text-[12px] leading-[1.55] text-white/65">{opt.desc}</p>
                  </motion.button>
                ))}
                <button type="button" onClick={guard.requestClose} className="mt-1 flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] py-3 font-mono text-[8px] uppercase tracking-[0.2em] text-white/45 transition hover:text-white/75">
                  <X size={11} />Cancel · Keep Lifting
                </button>
              </motion.div>
            ) : (
              <motion.div key="completion" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }} className="flex flex-col gap-3 p-5">
                <div className="rounded-xl bg-white/[0.022] px-3 py-2">
                  <p className="font-mono text-[7.5px] uppercase tracking-[0.22em] text-white/40">Log accuracy locked</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-[#f2eee6] capitalize">{logAccuracy?.replace("-", " ")}</p>
                </div>
                {completionOpts.map((opt) => (
                  <motion.button
                    key={opt.value}
                    type="button"
                    onClick={() => handleCompletionSelect(opt.value)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative overflow-hidden rounded-2xl border p-4 text-left transition-all"
                    style={{
                      borderColor: `${opt.color}30`,
                      background: `linear-gradient(160deg, ${opt.color}0e 0%, rgba(255,255,255,0.012) 100%)`,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${opt.color}55, transparent)` }} />
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: opt.color }}>{opt.label}</p>
                      <ChevronRight size={13} style={{ color: opt.color }} />
                    </div>
                    <p className="mt-1.5 text-[12px] leading-[1.55] text-white/65">{opt.desc}</p>
                  </motion.button>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setStep("accuracy")} className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] py-3 font-mono text-[8px] uppercase tracking-[0.2em] text-white/45 transition hover:text-white/75">
                    <ArrowLeft size={11} />Back
                  </button>
                  <button type="button" onClick={guard.requestClose} className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] py-3 font-mono text-[8px] uppercase tracking-[0.2em] text-white/45 transition hover:text-white/75">
                    <X size={11} />Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   POST-SESSION DEBRIEF (premium completion)
   ──────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
   PROGRESSION DECISION + POST-WORKOUT MEAL TIMING
   ──────────────────────────────────────────────────────────────────────── */

type ReserveDayScheduleInput = {
  wakeTime?: string;
  sleepTime?: string;
  preferredGymTime?: string;
  commuteMinutes?: number;
  prepMinutes?: number;
  trainingDurationMinutes?: number;
};

type ReserveDayScheduleSlot = {
  key: string;
  label: string;
  timeLabel: string;
  note: string;
};


export function getReserveDaySchedule(input: ReserveDayScheduleInput): {
  configured: boolean;
  slots: ReserveDayScheduleSlot[];
  postWorkoutWindow: { startMinutes: number; endMinutes: number; startLabel: string; endLabel: string } | null;
  sleepRiskNote: string | null;
} {
  const gym = parseHM(input.preferredGymTime);
  const wake = parseHM(input.wakeTime);
  const sleep = parseHM(input.sleepTime);
  const duration = input.trainingDurationMinutes ?? 85;
  const commute = input.commuteMinutes ?? 0;
  const prep = input.prepMinutes ?? 0;

  if (!gym) {
    return {
      configured: false,
      slots: [],
      postWorkoutWindow: null,
      sleepRiskNote: null,
    };
  }

  const gymMinutes = gym.h * 60 + gym.m;
  const wakeMinutes = wake ? wake.h * 60 + wake.m : null;
  const sleepMinutes = sleep ? sleep.h * 60 + sleep.m : null;
  const endMinutes = gymMinutes + duration;

  const { startMin: postStart, endMin: postEnd } = postSessionWindow(endMinutes, gymMinutes);

  const slots: ReserveDayScheduleSlot[] = [];
  if (wakeMinutes !== null) {
    slots.push({ key: "wake", label: "Wake window", timeLabel: formatHM(wakeMinutes), note: "Hydrate first. Daylight if possible." });
  }
  if (prep > 0) {
    slots.push({ key: "prep", label: "Prep window", timeLabel: `${formatHM(gymMinutes - prep)} – ${formatHM(gymMinutes - commute)}`, note: "Pack bag · custom prep items · clean focus." });
  }
  if (commute > 0) {
    slots.push({ key: "commute", label: "Leave for gym", timeLabel: formatHM(gymMinutes - commute), note: `${commute} min commute buffer protects start time.` });
  }
  slots.push({ key: "gym-start", label: "Training begins", timeLabel: formatHM(gymMinutes), note: "Honor the session standard." });
  slots.push({ key: "gym-end", label: "Estimated session end", timeLabel: formatHM(endMinutes), note: `${duration} min training window.` });
  slots.push({ key: "post-meal", label: "Post-workout meal window", timeLabel: `${formatHM(postStart)} – ${formatHM(postEnd)}`, note: "Refill protein + carbs inside this window." });
  if (sleepMinutes !== null) {
    const windDown = ((sleepMinutes - 60) % 1440 + 1440) % 1440;
    slots.push({ key: "wind-down", label: "Wind-down begins", timeLabel: formatHM(windDown), note: "Dim lights · screens down · breath slow." });
    slots.push({ key: "sleep", label: "Sleep target", timeLabel: formatHM(sleepMinutes), note: "Tomorrow's readiness is decided here." });
  }

  let sleepRiskNote: string | null = null;
  if (sleepMinutes !== null) {
    // Project times into a 24h cycle. If post-workout meal ends within ~90 min of sleep, flag risk.
    const meal = postEnd;
    const sleepCmp = sleepMinutes < gymMinutes ? sleepMinutes + 1440 : sleepMinutes;
    if (sleepCmp - meal < 90) {
      sleepRiskNote = "Late session — post-workout meal lands close to sleep. Keep it lighter, protein-forward, and digestion-friendly.";
    }
  }

  return { configured: true, slots, postWorkoutWindow: { startMinutes: postStart, endMinutes: postEnd, startLabel: formatHM(postStart), endLabel: formatHM(postEnd) }, sleepRiskNote };
}

/* ────────────────────────────────────────────────────────────────────────────
   MOVEMENT CARDS (pre-session list)
   ──────────────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept as the legacy full-card renderer for live-session recovery while pre-session stays lightweight.
function MovementCard({ movement, index, history, onOpenLogger, onOpenSubs, tone, gender = "neutral" }: { movement: Movement; index: number; history: LoggedSet[]; onOpenLogger: (m: Movement) => void; onOpenSubs: (m: Movement) => void; tone: ToneStyle; gender?: SilhouetteGender }) {
  const accent = index % 2 === 0 ? GOLD : STEEL;
  const completedSets = history.length;
  const isComplete = completedSets >= movement.sets;
  const [showEducation, setShowEducation] = useState(false);
  const toneCue = tone === "refined" ? "Refined output. Hold tension." : tone === "stoic" ? "Hold the line. Earn the rep." : "Maintain precision.";
  const loadUnit = getLoadUnit(movement);
  const nextPurpose = getSetPurpose(completedSets, movement.sets);
  return (
    <motion.article initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.045, duration: 0.42, ease: [0.22, 1, 0.36, 1] }} whileHover={{ y: -5, scale: 1.005 }} style={{ transformPerspective: 1400, position: "relative" }}>
      <div className="pointer-events-none absolute inset-0 rounded-[28px]" style={{ background: `radial-gradient(ellipse at 30% 0%, ${accent}0d 0%, transparent 65%)`, filter: "blur(12px)", transform: "translateY(10px) scale(0.97)", zIndex: -1 }} />
      <div className="relative overflow-hidden rounded-[24px] border" style={{ background: isComplete ? "rgba(6,12,8,0.88)" : "rgba(6,7,11,0.84)", borderColor: isComplete ? `${GREEN}22` : `${accent}15`, backdropFilter: "blur(20px)", boxShadow: `0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)` }}>
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${isComplete ? GREEN : accent}40, transparent)` }} />
        <div className="pointer-events-none absolute right-5 top-3 select-none font-black leading-none text-white/[0.03]" style={{ fontSize: 96 }}>{String(index + 1).padStart(2, "0")}</div>
        {isComplete && (
          <motion.div className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full border border-[#79e3b5]/25 bg-[#79e3b5]/10 px-3 py-1.5" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
            <CheckCircle2 size={11} className="text-[#79e3b5]" />
            <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#79e3b5]">Complete</span>
          </motion.div>
        )}
        <div className="grid gap-6 p-6 xl:grid-cols-[1fr_260px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/32">{index + 1} of {MOVEMENTS.length}</span>
              <span className="rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.18em]" style={{ borderColor: `${accent}28`, background: `${accent}10`, color: `${accent}d0` }}>{movement.target}</span>
              {movement.lastLoad && <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 font-mono text-[8px] text-white/30">Last: {movement.lastLoad} {loadUnit.unit} × {movement.lastReps}</span>}
              <span className="rounded-full border border-white/[0.05] bg-white/[0.02] px-2.5 py-1 font-mono text-[8px] text-white/28">{completedSets}/{movement.sets} sets</span>
            </div>
            <h4 className="mt-4 text-[24px] font-black leading-tight tracking-tight text-[#f2eee6] sm:text-[28px]">{movement.name}</h4>
            <p className="mt-2 max-w-xl text-[13px] leading-[1.6] text-white/45">{movement.purpose}</p>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              <MetricCard label={`Load · ${loadUnit.unit}`} value={loadDisplayValue(movement)} />
              <MetricCard label="Rest" value={movement.rest} />
              <MetricCard label="Sets × reps" value={`${movement.sets} × ${movement.reps}`} />
            </div>

            {/* Set purpose progression strip */}
            <div className="mt-4 rounded-2xl bg-white/[0.018] p-3">
              <p className="font-mono text-[7.5px] uppercase tracking-[0.22em] text-white/30">Set Purpose Progression</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from({ length: movement.sets }).map((_, i) => {
                  const purpose = getSetPurpose(i, movement.sets);
                  const done = i < completedSets;
                  return (
                    <span
                      key={`${movement.id}-purpose-${i}`}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-[8px] uppercase tracking-[0.16em]"
                      style={{
                        borderColor: done ? `${GREEN}38` : `${purpose.color}30`,
                        background: done ? `${GREEN}10` : `${purpose.color}10`,
                        color: done ? GREEN : `${purpose.color}d0`,
                      }}
                    >
                      <span className="font-bold">S{i + 1}</span>
                      {purpose.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white/[0.02] p-4">
              <p className="mb-1.5 font-mono text-[7.5px] uppercase tracking-[0.22em] text-white/28">Execution Cue</p>
              <p className="text-[12px] leading-[1.55] text-white/55">{movement.cue}</p>
            </div>
            <div className="mt-3 flex items-start gap-2">
              <Zap size={10} className="mt-0.5 flex-shrink-0" style={{ color: `${accent}90` }} />
              <p className="text-[11px] leading-5 text-white/35">{toneCue} {movement.physiqueImpact}</p>
            </div>

            {/* Reserve Coach Preview — replaces blank area */}
            {!showEducation && (
              <div className="mt-4 overflow-hidden rounded-2xl bg-[#8ea0b8]/[0.05] p-4">
                <div className="flex items-center gap-1.5">
                  <Brain size={11} className="text-[#8ea0b8]" />
                  <p className="font-mono text-[7.5px] uppercase tracking-[0.24em] text-[#8ea0b8]/85">Reserve Coach Preview</p>
                </div>
                <p className="mt-2 text-[12px] leading-[1.55] text-white/65">{movement.education.whyHere}</p>
                <div className="mt-3 grid gap-1.5">
                  <p className="text-[11px] leading-[1.5] text-white/55"><span className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#79e3b5]/80">Feel · </span>{movement.education.whatToFeel}</p>
                  <p className="text-[11px] leading-[1.5] text-white/55"><span className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#ef7d55]/80">Avoid · </span>{movement.education.commonError}</p>
                  <p className="text-[11px] leading-[1.5] text-white/55"><span className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#d5b15f]/80">Next cue · </span>Set {Math.min(completedSets + 1, movement.sets)} is a <span style={{ color: nextPurpose.color }}>{nextPurpose.label}</span> set — {nextPurpose.intent.toLowerCase()}</p>
                </div>
              </div>
            )}

            <button type="button" onClick={() => setShowEducation((v) => !v)} className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-white/45 transition hover:border-white/[0.14] hover:text-white/75">
              <GraduationCap size={11} />{showEducation ? "Hide full coaching" : "Open Full Coaching Layer"}
            </button>
            <AnimatePresence initial={false}>
              {showEducation && (
                <motion.div key="education" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="mt-4 overflow-hidden">
                  <MovementEducationPanel education={movement.education} />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {movement.rirTargets.map((rir, i) => {
                const done = i < history.length;
                return (<span key={`${movement.id}-rir-${i}`} className="rounded-lg px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em]" style={{ borderColor: done ? `${GREEN}35` : "rgba(255,255,255,0.07)", background: done ? `${GREEN}12` : "rgba(0,0,0,0.2)", color: done ? GREEN : "rgba(255,255,255,0.42)" }}>{done && "✓ "}Set {i + 1}: {rir}</span>);
              })}
            </div>
            <SetHistoryBadges history={history} />
          </div>
          <div className="flex flex-col gap-3">
            <MovementVisualChamber movement={movement} accent={accent} gender={gender} />
            <MuscleTargetIllustration movement={movement} />
            <motion.button type="button" onClick={() => onOpenLogger(movement)} whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }} className="flex items-center justify-center gap-2.5 rounded-2xl py-3.5 font-mono text-[9px] uppercase tracking-[0.2em] transition-all" style={{ background: isComplete ? `linear-gradient(135deg, ${STEEL}1c, ${STEEL}0a)` : `linear-gradient(135deg, ${GREEN}1c, ${GREEN}0a)`, border: `1px solid ${isComplete ? STEEL : GREEN}30`, color: isComplete ? STEEL : GREEN, boxShadow: `0 0 22px ${isComplete ? STEEL : GREEN}10` }}>
              <CheckCircle2 size={14} />
              {isComplete ? "Log Extra Set" : completedSets > 0 ? `Log Set ${completedSets + 1}` : "Log First Set"}
            </motion.button>
            <button type="button" onClick={() => onOpenSubs(movement)} className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] py-2.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/40 transition hover:border-white/[0.14] hover:text-white/65">
              <Shuffle size={11} />Operational Substitution
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   RECENT SESSION INTELLIGENCE + ALERTS
   ──────────────────────────────────────────────────────────────────────── */



/* ────────────────────────────────────────────────────────────────────────────
   SESSION ARCHITECTURE — phase timeline, mode selector, core, cardio, suite
   ──────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
   ADAPTIVE PHASE RECOMMENDATIONS — Core/Cardio/Recovery purposeful logic
   ──────────────────────────────────────────────────────────────────────── */

type PhaseRecommendation = {
  status: "recommended" | "reduced" | "skip";
  reason: string;
};

function getCoreRecommendation(ctx: { goal: string; readiness: number | null; sessionTitle: string; sessionMode: SessionModeKey; injuryNotes?: string }): PhaseRecommendation {
  const { goal, readiness, sessionTitle, sessionMode, injuryNotes } = ctx;
  if (sessionMode === "minimum-effective") return { status: "reduced", reason: "Minimum mode — one brace movement only." };
  if (readiness !== null && readiness < 55) return { status: "reduced", reason: "Recovery reserve low — one brace movement, no loaded flexion." };
  if (injuryNotes && /back|spine|disc|hernia/i.test(injuryNotes)) return { status: "reduced", reason: "Spine-flagged history — favor anti-rotation, skip loaded crunch." };
  if (/posterior|hamstring|deadlift/i.test(sessionTitle)) return { status: "reduced", reason: "Heavy posterior-chain day — trunk already loaded." };
  if (/upper|chest|back|delts|arms|abs/i.test(sessionTitle)) return { status: "recommended", reason: "Upper-body day — programmed brace pairs cleanly." };
  if (/physique|waist|cut|lean/i.test(goal)) return { status: "recommended", reason: "Physique/waist goal — Core Command serves the line." };
  return { status: "recommended", reason: "Pairs with today's session standard." };
}

function getCardioRecommendation(ctx: { goal: string; readiness: number | null; sessionTitle: string; sessionMode: SessionModeKey }): PhaseRecommendation {
  const { goal, readiness, sessionTitle, sessionMode } = ctx;
  if (sessionMode === "minimum-effective") return { status: "skip", reason: "Minimum mode — output preserved over conditioning." };
  if (readiness !== null && readiness < 55) return { status: "reduced", reason: "Recovery reserve low — easy walk only, protect the system." };
  if (/leg|squat|posterior|quad/i.test(sessionTitle) && (readiness !== null && readiness < 75)) return { status: "reduced", reason: "Heavy lower demand — cooldown only, no Zone 2." };
  if (/cut|lean|fat/i.test(goal)) return { status: "recommended", reason: "Fat-loss goal — Zone 2 / incline walk after lifting." };
  if (/mass|hypertrophy|grow|build/i.test(goal)) return { status: "reduced", reason: "Muscle-gain goal — short cooldown protects reserve." };
  if (/performance/i.test(goal) && (readiness !== null && readiness < 70)) return { status: "reduced", reason: "Performance goal — preserve output on lower readiness days." };
  return { status: "recommended", reason: "Conditioning window matches today's reserve." };
}

function getRecoveryRecommendation(ctx: { readiness: number | null; sessionMode: SessionModeKey; hydrationHandled?: boolean; healthContext?: string[] }): PhaseRecommendation {
  const { readiness, sessionMode, hydrationHandled = true, healthContext } = ctx;
  if (sessionMode === "minimum-effective") return { status: "skip", reason: "Minimum mode — hydrate and rest." };
  if (sessionMode === "express") return { status: "reduced", reason: "Express mode — hydration + breath only." };
  if (!hydrationHandled) return { status: "reduced", reason: "Hydration not yet handled — restore fluids first." };
  if (healthContext?.some((h) => /heart|cardio|hyperten|blood pressure|pregnan/i.test(h))) return { status: "skip", reason: "Flagged health context — follow clinician guidance on heat exposure." };
  if (readiness !== null && readiness < 55) return { status: "skip", reason: "Low readiness — heat exposure stresses recovery further." };
  if (readiness === null) return { status: "reduced", reason: "No recovery reserve read today — mobility, breath and a walking cooldown until one is logged." };
  if (readiness !== null && readiness >= 75) return { status: "recommended", reason: "Reserve allows the full suite — selected tool ready if hydrated." };
  return { status: "reduced", reason: "Reduce to mobility, breath, and walking cooldown only." };
}

/* ────────────────────────────────────────────────────────────────────────────
   RECOVERY RUNWAY — rest-day card (no lifting queue)
   ──────────────────────────────────────────────────────────────────────── */

function RecoveryRunwayCard({ recovery, displayName, focus }: { recovery: RecoveryRunway; displayName: string; focus: string }) {
  const statusColor: Record<RecoveryRunway["items"][number]["status"], string> = {
    required: GREEN,
    recommended: STEEL,
    optional: "rgba(255,255,255,0.4)",
  };
  return (
    <div className="relative overflow-hidden rounded-3xl"
      style={{ background: "linear-gradient(168deg, rgba(10,12,18,0.96) 0%, rgba(6,7,11,0.99) 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 32px rgba(0,0,0,0.42)" }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GREEN}55, transparent)` }} />
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-2">
          <Waves size={13} style={{ color: GREEN }} />
          <div>
            <p className="font-mono text-[8.5px] uppercase tracking-[0.26em] text-white/55">{displayName}</p>
            <p className="mt-0.5 text-[11px] text-white/40">{focus}</p>
          </div>
        </div>
        <span className="rounded-full border px-2.5 py-1 font-mono text-[7.5px] uppercase tracking-[0.2em]"
          style={{ borderColor: `${GREEN}30`, background: `${GREEN}10`, color: GREEN }}>No lifting today</span>
      </div>
      <div className="space-y-1.5 px-4 pb-4">
        {recovery.items.map((item, i) => (
          <motion.div key={item.id} className="grid grid-cols-[20px_1fr_auto] items-center gap-2.5 rounded-xl bg-white/[0.02] px-3 py-2.5"
            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.28 }}>
            <span className="font-mono text-[8px] text-white/30">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <p className="truncate text-[11.5px] font-semibold text-[#f2eee6]">{item.label}</p>
              <p className="truncate text-[9.5px] text-white/40">{item.detail}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[8px] tabular-nums text-white/40">{item.duration}</span>
              <span className="rounded-md border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.16em]"
                style={{ borderColor: `${statusColor[item.status]}30`, background: `${statusColor[item.status]}10`, color: statusColor[item.status] }}>
                {item.status}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   MISSING TEMPLATE — unknown split (never falls back to Upper)
   ──────────────────────────────────────────────────────────────────────── */

/** "05:45" → "5:45 AM". Null for anything that is not a clock time. */
function formatActivityClock(hhmm: string | undefined): string | null {
  const match = hhmm ? /^(\d{1,2}):(\d{2})$/.exec(hhmm) : null;
  if (!match) return null;
  const hours = Number(match[1]);
  return `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`;
}

const ACTIVITY_LOAD_LABEL: Record<NonNullable<ResolvedDay["activity"]>["load"], string> = {
  low: "Low load",
  moderate: "Moderate load",
  high: "High load",
};

/** An activity day — track, run, group class. No lifting queue, no build prompt. */
function MissingTemplateCard({ splitName, onBuild }: { splitName: string; onBuild: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-6 text-center"
      style={{ background: "linear-gradient(168deg, rgba(10,12,18,0.96) 0%, rgba(6,7,11,0.99) 100%)" }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${AMBER}55, transparent)` }} />
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl" style={{ borderColor: `${AMBER}30`, background: `${AMBER}10`, color: AMBER }}>
        <AlertTriangle size={18} />
      </div>
      <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.24em]" style={{ color: `${AMBER}b0` }}>Workout template missing</p>
      <h3 className="mt-1 text-[16px] font-bold text-[#f2eee6]">No template for “{splitName}”</h3>
      <p className="mx-auto mt-1.5 max-w-[420px] text-[11px] leading-[1.55] text-white/45">
        This split has no workout template yet. Build or edit a template to load its Mission Runway.
      </p>
      <button type="button" onClick={onBuild}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-[8.5px] uppercase tracking-[0.18em] transition hover:brightness-110"
        style={{ borderColor: `${GOLD}45`, background: `${GOLD}12`, color: GOLD }}>
        <Layers3 size={12} />
        Build / Edit Template
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   SESSION LIFECYCLE — PRE-SESSION COMMAND + MOBILITY & PRIMER COMMAND
   The launch sequence the athlete moves through before lifting goes live:
   Pre-Session Command → Mobility & Primer Command → Live Training Command.
   ──────────────────────────────────────────────────────────────────────── */

type LaunchStage = "idle" | "pre-session" | "primer";

type ReadinessItem = { id: string; label: string; helper: string };

type ReadinessWindow = {
  key: "morning" | "midday" | "evening" | "late";
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  emphasis: string;
};

function getReadinessWindow(hour: number): ReadinessWindow {
  if (hour >= 5 && hour < 12) return { key: "morning", label: "Morning Training", icon: Sunrise, emphasis: "Hydration priority · wake-up readiness · mobility emphasis." };
  if (hour >= 12 && hour < 17) return { key: "midday", label: "Midday Training", icon: Sun, emphasis: "Meal timing · schedule conflict check before the lift." };
  if (hour >= 17 && hour < 21) return { key: "evening", label: "Evening Training", icon: Sunset, emphasis: "Fatigue and stress review · protect recovery tonight." };
  return { key: "late", label: "Late Night Training", icon: Moon, emphasis: "Sleep protection · reduce conditioning · recovery emphasis." };
}

const READINESS_BASE: ReadinessItem[] = [
  { id: "hydration-confirmed", label: "Hydration confirmed", helper: "Water and your normal electrolyte routine ready." },
  { id: "nutrition-confirmed", label: "Pre-session nutrition confirmed", helper: "Fuel landed in your usual pre-lift window." },
  { id: "tissues-reviewed", label: "Target tissues reviewed", helper: "You know the muscles this session is built around." },
  { id: "objective-reviewed", label: "Session objective reviewed", helper: "The intent of today's mission is clear." },
  { id: "gear-ready", label: "Training gear ready", helper: "Belt, straps, shoes, and anything else staged." },
  { id: "rest-windows", label: "Rest windows reviewed", helper: "You'll honor the programmed rest on the heavy work." },
  { id: "post-meal", label: "Post-workout meal planned", helper: "The recovery meal is decided before you start." },
  { id: "recovery-reserve", label: "Recovery reserve reviewed", helper: "Sleep, joints, and readiness clear the standard." },
];

const READINESS_BY_WINDOW: Record<ReadinessWindow["key"], ReadinessItem[]> = {
  morning: [
    { id: "wake-readiness", label: "Wake-up readiness clear", helper: "Joints loose, nervous system online, no morning stiffness limiting output." },
    { id: "mobility-emphasis", label: "Mobility emphasis noted", helper: "Morning sessions need a longer ramp — give the primer its time." },
  ],
  midday: [
    { id: "meal-timing", label: "Meal timing locked", helper: "Midday fuel timed so you're not training on an empty or overfull stomach." },
    { id: "schedule-conflict", label: "Schedule conflict checked", helper: "Enough clear time to finish the session without rushing the standard." },
  ],
  evening: [
    { id: "fatigue-review", label: "Fatigue reviewed", helper: "Day's accumulated fatigue accounted for in today's loads." },
    { id: "stress-review", label: "Stress reviewed", helper: "High-stress day? Keep effort honest, protect recovery." },
  ],
  late: [
    { id: "sleep-protect", label: "Sleep protection acknowledged", helper: "Late training can cost sleep — keep stimulants and intensity in check." },
    { id: "conditioning-reduce", label: "Conditioning reduction noted", helper: "Trim aggressive conditioning so recovery isn't compromised overnight." },
  ],
};

function buildReadinessChecklist(window: ReadinessWindow): ReadinessItem[] {
  return [...READINESS_BASE, ...READINESS_BY_WINDOW[window.key]];
}

type MobilityMove = { name: string; cue: string };
type MobilityPrimer = { focusLabel: string; estTime: string; goal: string; moves: MobilityMove[] };

function getMobilityPrimer(workoutType: string): MobilityPrimer {
  const t = workoutType.toLowerCase();
  const goal = "Prepare joints, tissues, movement patterns, and movement quality before output.";
  if (t.includes("posterior") || (t.includes("leg") && !t.includes("delt"))) {
    return {
      focusLabel: "Posterior / Lower Primer",
      estTime: "5–10 min",
      goal,
      moves: [
        { name: "Hip Hinge Rehearsal", cue: "Pattern the hinge with a dowel — hips back, neutral spine." },
        { name: "Hamstring Floss", cue: "Dynamic length through the posterior chain, no bouncing." },
        { name: "Glute Bridge Activation", cue: "Wake the glutes so they drive the heavy work." },
        { name: "Ankle Mobility", cue: "Open the ankles for clean depth and stable footing." },
        { name: "Bodyweight RDL Patterning", cue: "Groove the hinge under control before loading it." },
      ],
    };
  }
  if (t.includes("chest") && t.includes("back")) {
    return {
      focusLabel: "Chest / Back Primer",
      estTime: "5–10 min",
      goal,
      moves: [
        { name: "Thoracic Extension", cue: "Open the upper back so the press and pull track clean." },
        { name: "Band Pull Aparts", cue: "Switch on the upper back and rear delts." },
        { name: "Scapular Push Ups", cue: "Find scapular control before pressing." },
        { name: "Shoulder External Rotation", cue: "Prime the cuff to protect the shoulder under load." },
        { name: "Thoracic Rotation", cue: "Free the mid-back for full pulling range." },
      ],
    };
  }
  if (t.includes("chest")) {
    return {
      focusLabel: "Chest Primer",
      estTime: "5–10 min",
      goal,
      moves: [
        { name: "Thoracic Extension", cue: "Open the upper back so the press tracks clean." },
        { name: "Band Pull Aparts", cue: "Balance the pressing volume with upper-back work." },
        { name: "Scapular Push Ups", cue: "Find scapular control before pressing." },
        { name: "Shoulder External Rotation", cue: "Prime the cuff to protect the shoulder under load." },
        { name: "Pec Opener", cue: "Gentle chest opener to reach full range without strain." },
      ],
    };
  }
  if (t.includes("back")) {
    return {
      focusLabel: "Back Primer",
      estTime: "5–10 min",
      goal,
      moves: [
        { name: "Thoracic Rotation", cue: "Free the mid-back for full pulling range." },
        { name: "Lat Opener", cue: "Lengthen the lats so you can reach a true stretch." },
        { name: "Scapular Depression", cue: "Pull the shoulder blades down before rowing." },
        { name: "Band Rows", cue: "Light reps to feel the back driving the movement." },
        { name: "Dead Hang (optional)", cue: "Decompress and set the shoulders if a bar is free." },
      ],
    };
  }
  if (t.includes("delt") || t.includes("arm")) {
    return {
      focusLabel: "Delts / Arms Primer",
      estTime: "5–8 min",
      goal,
      moves: [
        { name: "Shoulder CARs", cue: "Controlled circles to take the shoulder through full range." },
        { name: "Band Pull Aparts", cue: "Switch on the rear delts and upper back." },
        { name: "External Rotation", cue: "Prime the cuff before overhead and pressing work." },
        { name: "Wrist & Elbow Prep", cue: "Loosen the wrists and elbows for direct arm volume." },
        { name: "Scapular Push Ups", cue: "Find scapular control before pressing." },
      ],
    };
  }
  if (t.includes("upper") || t.includes("special")) {
    return {
      focusLabel: "Upper Specialization Primer",
      estTime: "5–8 min",
      goal,
      moves: [
        { name: "Shoulder CARs", cue: "Controlled circles to open the shoulders." },
        { name: "Band Pull Aparts", cue: "Switch on the upper back and rear delts." },
        { name: "Scapular Control Drill", cue: "Own scapular position before detail volume." },
        { name: "Pec & Lat Opener", cue: "Open chest and lats to reach full range." },
        { name: "External Rotation", cue: "Prime the cuff to protect the shoulder." },
      ],
    };
  }
  if (t.includes("recovery") || t.includes("posing")) {
    return {
      focusLabel: "Recovery Mobility Flow",
      estTime: "8–12 min",
      goal: "Restore range, downshift the nervous system, and rehearse pose control.",
      moves: [
        { name: "Full-Body Mobility Flow", cue: "Gentle, continuous movement — no load, no strain." },
        { name: "Thoracic Rotation", cue: "Free the mid-back and decompress." },
        { name: "Hip Openers", cue: "Open the hips after a week of heavy lower work." },
        { name: "Ankle Mobility", cue: "Restore ankle range for clean standing positions." },
        { name: "Breath Cadence", cue: "Slow nasal breathing to settle into recovery." },
      ],
    };
  }
  return {
    focusLabel: "General Movement Primer",
    estTime: "5–10 min",
    goal,
    moves: [
      { name: "Thoracic Extension", cue: "Open the upper back before output." },
      { name: "Band Pull Aparts", cue: "Switch on the upper back and rear delts." },
      { name: "Hip Hinge Rehearsal", cue: "Groove the hinge under control." },
      { name: "Shoulder External Rotation", cue: "Prime the cuff for pressing and pulling." },
      { name: "Ankle Mobility", cue: "Open the ankles for stable footing." },
    ],
  };
}

function LaunchCheckRow({ checked, label, detail, onToggle }: { checked: boolean; label: string; detail?: string; onToggle: () => void }) {
  return (
    <li>
      <button type="button" aria-pressed={checked} onClick={onToggle} className="flex min-h-[48px] w-full items-center gap-3 py-2 text-left">
        {checked ? <CheckCircle2 size={16} style={{ color: GREEN }} aria-hidden="true" /> : <Circle size={16} className="text-white/30" aria-hidden="true" />}
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold" style={{ color: checked ? "#f2eee6" : "rgba(242,238,230,0.8)" }}>{label}</span>
          {detail && <span className="block text-[11.5px] leading-[1.45] text-white/50">{detail}</span>}
        </span>
      </button>
    </li>
  );
}

function PreSessionCommandPanel({
  now,
  workoutType,
  checked,
  setChecked,
  onBeginPrimer,
  onBack,
}: {
  now: Date | null;
  workoutType: string;
  checked: Record<string, boolean>;
  setChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onBeginPrimer: () => void;
  onBack: () => void;
}) {
  const window = getReadinessWindow(now?.getHours() ?? 12);
  const items = useMemo(() => buildReadinessChecklist(window), [window]);
  const doneCount = items.filter((i) => checked[i.id]).length;
  return (
    <GlassPanel accent={GOLD} phone="flush" className="md:overflow-hidden">
      <section aria-label="Readiness check" data-training="pre-session">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-mono text-[9px] uppercase tracking-[0.24em] text-[#d5b15f]/85">Step 1 of 2 · {window.label}</p>
          <ReserveButton tier="quiet" size="sm" icon={ArrowLeft} onClick={onBack}>Back</ReserveButton>
        </div>
        <h3 className="font-display text-[26px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#f2eee6] sm:text-[32px]">Pre-Session Command</h3>
        <p className="tnum mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
          {workoutType} · {doneCount} of {items.length} checked · optional
        </p>
        <ul aria-label="Readiness checks" className="mt-3 grid border-t border-white/[0.06] md:grid-cols-2 md:gap-x-10 [&>li]:border-b [&>li]:border-white/[0.05]">
          {items.map((item) => (
            <LaunchCheckRow
              key={item.id}
              checked={!!checked[item.id]}
              label={item.label}
              onToggle={() => setChecked((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
            />
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Secondary: the screen's one gold action is Start Session, in the hero. */}
          <ReserveButton tier="secondary" size="md" icon={Move} onClick={onBeginPrimer}>
            Begin Mobility Primer
          </ReserveButton>
          <p className="text-[12px] text-white/50">Or start the session from the top.</p>
        </div>
      </section>
    </GlassPanel>
  );
}

function MobilityPrimerCommand({
  workoutType,
  checked,
  setChecked,
  onStartLive,
  onBack,
}: {
  workoutType: string;
  checked: Record<string, boolean>;
  setChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onStartLive: () => void;
  onBack: () => void;
}) {
  const primer = useMemo(() => getMobilityPrimer(workoutType), [workoutType]);
  const doneCount = primer.moves.filter((m) => checked[m.name]).length;
  return (
    <GlassPanel accent={STEEL} phone="flush" className="md:overflow-hidden">
      <section aria-label="Mobility primer" data-training="primer">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-mono text-[9px] uppercase tracking-[0.24em] text-[#7dd3ee]/85">Step 2 of 2 · {primer.focusLabel}</p>
          <ReserveButton tier="quiet" size="sm" icon={ArrowLeft} onClick={onBack}>Back</ReserveButton>
        </div>
        <h3 className="font-display text-[26px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#f2eee6] sm:text-[32px]">Mobility Primer</h3>
        <p className="tnum mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
          {primer.estTime} · {doneCount} of {primer.moves.length} done
        </p>
        <ol aria-label="Primer moves" className="mt-3 flex flex-col divide-y divide-white/[0.05] border-t border-white/[0.06]">
          {primer.moves.map((move) => (
            <LaunchCheckRow
              key={move.name}
              checked={!!checked[move.name]}
              label={move.name}
              detail={move.cue}
              onToggle={() => setChecked((prev) => ({ ...prev, [move.name]: !prev[move.name] }))}
            />
          ))}
        </ol>
        <div className="mt-4">
          {/* The step's one gold action: the hero offers none while the primer runs. */}
          <ReserveButton tier="primary" size="lg" fullWidth icon={Play} onClick={onStartLive}>
            Start Live Session
          </ReserveButton>
        </div>
      </section>
    </GlassPanel>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LIVE EXECUTION STATUS BAR — operational fuel / hydration / recovery / progress
   ──────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
   POST-SESSION HANDOFF — mission completion review
   ──────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
   STORE → LOCAL CONVERSION HELPERS
   ──────────────────────────────────────────────────────────────────────── */

function storedToLocal(stored: StoredLoggedSet[]): LoggedSet[] {
  return stored.map((s) => ({
    load: s.load,
    reps: s.reps,
    intensity: s.intensity,
    tone: toneFromIntensity(s.intensity),
    setNumber: s.setNumber,
    review: s.review,
  }));
}

function buildLocalWorkout(workoutSetsStore: Record<string, StoredLoggedSet[]>): Record<string, LoggedSet[]> {
  const out: Record<string, LoggedSet[]> = {};
  Object.entries(workoutSetsStore).forEach(([k, v]) => { out[k] = storedToLocal(v); });
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
   MAIN EXPORT
   ──────────────────────────────────────────────────────────────────────── */

/* Shown when the session is flagged "live" but the resolved day has no lifting
   queue (recovery / posing / un-templated split). Prevents fake-live UI at the
   source — clear status + explicit recovery actions, no set logging. */
function StaleLiveSessionPanel({ kind, splitName, recovery, displayName, focus, onReturnToPre, onEndSession, onBuildSession }: {
  kind: "recovery" | "missing" | "empty" | "activity";
  splitName: string;
  recovery: RecoveryRunway | null;
  displayName: string;
  focus: string;
  onReturnToPre: () => void;
  onEndSession: () => void;
  onBuildSession: () => void;
}) {
  const accent = kind === "recovery" ? STEEL : AMBER;
  const kicker = kind === "recovery" ? "Recovery Window" : "Session Status";
  const title = kind === "recovery" ? "No Lifting Queue · Recovery Day" : kind === "activity" ? "No Lifting Queue · Activity Day" : kind === "missing" ? "Session Template Needed" : "No Active Lifting Queue";
  const body = kind === "recovery"
    ? "Today is a recovery / posing day, so there's no lifting queue. Use the recovery support flow below, or return to pre-session to stage a different day."
    : kind === "activity"
      ? `${displayName} is today's session, so there's no lifting queue. Return to pre-session to stage a different day, or end the session.`
    : kind === "missing"
      ? `${splitName} doesn't have a built session template yet. Build it, or return to pre-session and pick another training day.`
      : "The selected day has no lifting queue. Return to pre-session to stage a session, or end the session.";
  return (
    <section className="grid gap-4">
      <div className="rounded-2xl bg-white/[0.02] p-5 sm:p-6">
        <div className="flex items-center gap-2">
          {kind === "recovery" ? <Moon size={14} style={{ color: accent }} /> : <AlertTriangle size={14} style={{ color: accent }} />}
          <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: accent }}>{kicker}</p>
        </div>
        <h3 className="mt-2 text-xl font-black uppercase tracking-tight text-[#f2eee6] sm:text-2xl">{title}</h3>
        <p className="mt-2 max-w-2xl text-[12px] leading-[1.55] text-white/55">{body}</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button type="button" onClick={onReturnToPre} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] text-black transition hover:brightness-110" style={{ background: GOLD }}>
            <ArrowLeft size={13} /> Return to Pre-Session
          </button>
          {kind === "missing" && (
            <button type="button" onClick={onBuildSession} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] transition" style={{ borderColor: `${STEEL}40`, background: `${STEEL}12`, color: STEEL }}>
              Build Session
            </button>
          )}
          <button type="button" onClick={onEndSession} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] transition" style={{ borderColor: "#ef7d5540", background: "#ef7d5510", color: "#ef7d55" }}>
            <Trophy size={12} /> End Session
          </button>
        </div>
      </div>
      {kind === "recovery" && recovery && <RecoveryRunwayCard recovery={recovery} displayName={displayName} focus={focus} />}
      {kind === "missing" && <MissingTemplateCard splitName={splitName} onBuild={onBuildSession} />}
    </section>
  );
}

export function TrainingView() {
  const profile = useAthleteDashboardStore((s) => s.profile);
  const setupProfile = useAthleteDashboardStore((s) => s.setupProfile);
  const activityStack = useAthleteDashboardStore((s) => s.activityStack);
  const activitySport = useAthleteDashboardStore((s) => s.activitySport);
  const session = useAthleteDashboardStore((s) => s.trainingSession);
  const startTrainingSession = useAthleteDashboardStore((s) => s.startTrainingSession);
  const rebuildLiveSession = useAthleteDashboardStore((s) => s.rebuildLiveSession);
  const acknowledgeGenerationChange = useAthleteDashboardStore((s) => s.acknowledgeGenerationChange);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const setCurrentTrainingMovement = useAthleteDashboardStore((s) => s.setCurrentTrainingMovement);
  const logTrainingSet = useAthleteDashboardStore((s) => s.logTrainingSet);
  const editTrainingSet = useAthleteDashboardStore((s) => s.editTrainingSet);
  const undoLastTrainingSet = useAthleteDashboardStore((s) => s.undoLastTrainingSet);
  const closeOutTrainingSession = useAthleteDashboardStore((s) => s.closeOutTrainingSession);
  const recordTrainingSubstitution = useAthleteDashboardStore((s) => s.recordTrainingSubstitution);
  const recordPlannedSessionOutcome = useAthleteDashboardStore((s) => s.recordPlannedSessionOutcome);
  const recordReserveDecision = useAthleteDashboardStore((s) => s.recordReserveDecision);
  const saveTrainingDebriefSummary = useAthleteDashboardStore((s) => s.saveTrainingDebriefSummary);
  const appendSessionIntelligenceCard = useAthleteDashboardStore((s) => s.appendSessionIntelligenceCard);
  const appendTrainingJournalEntry = useAthleteDashboardStore((s) => s.appendTrainingJournalEntry);
  const resetTrainingSession = useAthleteDashboardStore((s) => s.resetTrainingSession);
  const resetTrainingSessionWithUndo = useAthleteDashboardStore((s) => s.resetTrainingSessionWithUndo);
  const undoTrainingReset = useAthleteDashboardStore((s) => s.undoTrainingReset);
  const clearTrainingResetSnapshot = useAthleteDashboardStore((s) => s.clearTrainingResetSnapshot);
  const trainingResetSnapshot = useAthleteDashboardStore((s) => s.trainingResetSnapshot);
  const clearTrainingOverride = useAthleteDashboardStore((s) => s.clearTrainingOverride);
  const toggleMinimalLogging = useAthleteDashboardStore((s) => s.toggleMinimalLogging);
  const skipTrainingMovement = useAthleteDashboardStore((s) => s.skipTrainingMovement);
  const setSupportPhaseStatus = useAthleteDashboardStore((s) => s.setSupportPhaseStatus);
  const setManualMovementSelection = useAthleteDashboardStore((s) => s.setManualMovementSelection);
  const setSelectedCardioOption = useAthleteDashboardStore((s) => s.setSelectedCardioOption);
  const setSelectedRecoveryOption = useAthleteDashboardStore((s) => s.setSelectedRecoveryOption);

  const physiqueCommand = useAthleteDashboardStore((s) => s.physiqueCommand);
  /* Only the number — selecting all of nutritionPrefs would re-render the
     cockpit on every unrelated food edit. */
  const nutritionBodyweightLb = useAthleteDashboardStore((s) => s.nutritionPrefs.bodyweightLb);
  const recoveryCommand = useAthleteDashboardStore((s) => s.recoveryCommand);
  const userTrainingProfile = useAthleteDashboardStore((s) => s.userTrainingProfile);
  const updateUserTrainingProfile = useAthleteDashboardStore((s) => s.updateUserTrainingProfile);
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const splitSystemSelection = useAthleteDashboardStore((s) => s.splitSystem);
  const clearSplitSystem = useAthleteDashboardStore((s) => s.clearSplitSystem);
  const setTrainingOverride = useAthleteDashboardStore((s) => s.setTrainingOverride);
  const programs = useAthleteDashboardStore((s) => s.programs);
  const activeProgramId = useAthleteDashboardStore((s) => s.activeProgramId);
  const weekAssignments = useAthleteDashboardStore((s) => s.weekAssignments);
  const programDayOverrides = useAthleteDashboardStore((s) => s.programDayOverrides);
  const customWorkoutTemplates = useAthleteDashboardStore((s) => s.customWorkoutTemplates);

  // The SELECTED PROTOCOL is the source of truth. Specialized families
  // (women / senior / lifestyle / home / student / log-only) assert the family
  // architecture so a women's protocol never shows a default bodybuilding
  // label; physique families keep the member's own split name (sacred copy).
  // Same resolution Apex Command uses.
  const protocolFamily: ProtocolFamily | null = activeProtocol ? familyForCategory(activeProtocol.category) : null;
  // The member's selected muscle priority / women's track WINS over any previously
  // saved split name. Without this, a stale profile.trainingStyle (an old custom or
  // upper-body split) leaks even after the member sets a glute/quad focus.
  const focusArchitecture = resolveFocusArchitecture(physiqueCommand.focus, {
    womensActive: protocolFamily === "women_performance",
  });
  // Structural hybrid architectures (Reserve Athlete, Grand Touring) define the
  // week themselves — the focus emphasizes INSIDE them, it does not rename the
  // split. So the identity label follows the architecture's own blueprint name
  // instead of a focus-derived "Chest Priority Rotation" that no longer matches
  // the hybrid week on screen.
  const isStructuralArchitecture = Boolean(
    activeProtocol && (isReserveAthlete(activeProtocol.category, activeProtocol.protocolId) || activeProtocol.category === "hybrid-performance"),
  );
  const splitIdentityName = isStructuralArchitecture
    ? getBlueprintForProtocol(activeProtocol!.protocolId, activeProtocol!.category).name
    : focusArchitecture.active
      ? focusArchitecture.architectureName
      : (protocolFamily && isSpecializedFamily(protocolFamily))
        ? familyArchitectureName(protocolFamily)
        : (profile.trainingStyle?.trim()
          || getSplitSystem(splitSystemSelection.key)?.name
          || activeProtocol?.protocolName?.trim()
          || SPLIT_NAME);

  // Protocol-aware training intensity: advanced/bodybuilding protocols unlock a harder session tier.
  const intensityTier = useMemo<IntensityTier>(() => {
    if (!activeProtocol) return "standard";
    const def = getProtocol(activeProtocol.protocolId);
    return protocolIntensityTier({ category: activeProtocol.category, difficulty: def?.difficulty, logOnly: def?.logOnly });
  }, [activeProtocol]);
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  // Training experience (HOW hard) + movement preferences scale the session on
  // top of the protocol identity. Member-controlled, never assumed.
  const trainingExperience = useAthleteDashboardStore((s) => s.trainingExperience);
  const setTrainingExperience = useAthleteDashboardStore((s) => s.setTrainingExperience);
  const coreTiming = useAthleteDashboardStore((s) => s.coreTiming);
  const movementPreferences = useAthleteDashboardStore((s) => s.movementPreferences);
  const movementFeedback = useAthleteDashboardStore((s) => s.movementFeedback);
  const logMovementFeedback = useAthleteDashboardStore((s) => s.logMovementFeedback);
  const setMovementPreference = useAthleteDashboardStore((s) => s.setMovementPreference);

  const now = useLiveTime();
  const todayIndex = getDayIndex(now);
  const tone: ToneStyle = getTone(profile.coachingProfile?.genderIdentity);
  // Gender for silhouette + movement media: female for women's-performance /
  // female identity, male for male identity, neutral otherwise.
  // Modal state
  const [loggerMovement, setLoggerMovement] = useState<Movement | null>(null);
  /* Stable, so the logger sheet's focus handling never re-runs on a parent render. */
  const closeLogger = useCallback(() => setLoggerMovement(null), []);
  /* The cockpit's answer to a logged set: shown briefly, then gone. */
  const [setConfirm, setSetConfirm] = useState<{ id: string; line: string } | null>(null);
  const confirmCount = useRef(0);
  const announceSet = (line: string) => {
    confirmCount.current += 1;
    setSetConfirm({ id: `set-${confirmCount.current}`, line });
  };
  useEffect(() => {
    if (!setConfirm) return;
    const t = window.setTimeout(() => setSetConfirm((c) => (c?.id === setConfirm.id ? null : c)), 2800);
    return () => window.clearTimeout(t);
  }, [setConfirm]);
  const [subMovement, setSubMovement] = useState<Movement | null>(null);
  /* Live sheets: the full queue and the current movement's coaching. */
  const [queueOpen, setQueueOpen] = useState(false);
  const closeQueue = useCallback(() => setQueueOpen(false), []);
  const [coachingOpen, setCoachingOpen] = useState(false);
  const closeCoaching = useCallback(() => setCoachingOpen(false), []);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [notReadyOpen, setNotReadyOpen] = useState(false);
  const [sessionResetNote, setSessionResetNote] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionModeKey>("full-reserve");
  /* The conditioning or recovery-suite choices, open in a sheet from Today's session. */
  const [optionSheet, setOptionSheet] = useState<TrainingOptionSheet | null>(null);
  const closeOptionSheet = useCallback(() => setOptionSheet(null), []);
  const [launchStage, setLaunchStage] = useState<LaunchStage>("idle");
  const [readinessChecked, setReadinessChecked] = useState<Record<string, boolean>>({});
  const [primerChecked, setPrimerChecked] = useState<Record<string, boolean>>({});
  const [selectedOverrideDayIndex, setSelectedOverrideDayIndex] = useState<number | null>(null);

  // ── Launch intent (Start Core Command) ──────────────────────────────────
  // Selectors here; the arrival effect lives below dailyContext so it can
  // route recovery days to the recovery runway instead of a lifting launch.
  const trainingLaunchIntent = useAthleteDashboardStore((s) => s.trainingLaunchIntent);
  const clearTrainingLaunchIntent = useAthleteDashboardStore((s) => s.clearTrainingLaunchIntent);
  /* The pre-session standard is confirmed in the readiness step the gold action opens. */
  const activeMode = useMemo(() => SESSION_MODES.find((m) => m.key === sessionMode) ?? SESSION_MODES[0], [sessionMode]);
  const selectedDayIndex = selectedOverrideDayIndex ?? todayIndex;
  const activeProgram = useActiveProgram({ now: now ?? undefined, selectedDayIndex });
  const activeResolution = activeProgram.resolution;
  // The Horizon phase now owns live progression. Legacy/no-Horizon sessions
  // retain the authored foundation posture and never receive a fabricated week.
  const trainingPhase = useMemo<TrainingPhase>(
    () => activeResolution
      ? trainingPhaseFromHorizon(activeResolution.currentPhaseKind, activeResolution.activeWeek.phaseWeek)
      : "foundation",
    [activeResolution],
  );
  const phaseStory = useMemo(() => {
    if (!activeResolution) return null;
    const meta = phaseMeta(trainingPhase);
    return {
      label: activeResolution.currentPhaseName,
      note: `${activeResolution.activeWeek.objective} ${meta.note}`,
      week: activeResolution.currentWeekNumber,
      total: activeResolution.horizon.totalWeeks,
    };
  }, [activeResolution, trainingPhase]);
  const selectedProgramDate = useMemo(() => {
    const value = new Date((now ?? new Date()).getTime());
    value.setDate(value.getDate() + selectedDayIndex - todayIndex);
    return value;
  }, [now, selectedDayIndex, todayIndex]);
  const resolvedProgramDay = useMemo(
    () => activeResolution
      ? null
      : resolveProgramDayForDate({
          programs,
          activeProgramId,
          assignments: weekAssignments,
          overrides: programDayOverrides,
          date: selectedProgramDate,
        }),
    [activeResolution, programs, activeProgramId, weekAssignments, programDayOverrides, selectedProgramDate],
  );
  // The member intentionally picked a day other than today → catch-up context.
  // Every card labels this as catch-up, never "today", so the page reads as one truth.
  const isCatchUp = selectedDayIndex !== todayIndex;

  // Readiness band drives focus-transform volume (recovery-protected when low).
  const recoverySnapshot = useMemo(() => buildRecoverySnapshot(recoveryCommand, now ?? new Date()), [recoveryCommand, now]);
  const sessionReadiness = useMemo<ChestReadiness>(
    () => chestReadinessFrom(recoverySnapshot.hasData ? recoverySnapshot.reserve : null, recoverySnapshot.hasData),
    [recoverySnapshot],
  );
  // Numeric readiness for recommendations / status surfaces — the real recovery
  // reserve when there is enough evidence for one, otherwise null. It was a
  // fixed 84 that read as "Protected" and was saved into training logs.
  const readinessScore: number | null = recoverySnapshot.hasData ? Math.round(recoverySnapshot.reserve) : null;

  /* ── GAME PLAN POSITION — the member's real week + earned day states. ── */
  const onboardingCompletedAt = useAthleteDashboardStore((s) => s.onboarding.completedAt);
  const gamePlanWeek = useMemo<GamePlanWeek>(
    () => resolveGamePlanWeek(activeProtocol, onboardingCompletedAt, now ?? new Date()),
    [activeProtocol, onboardingCompletedAt, now],
  );
  const executionWeekNumber = activeResolution?.currentWeekNumber ?? gamePlanWeek.week;
  const completedSplitDays = useMemo(
    () => completedSplitDaysThisWeek((session.sessionHistory ?? []).map((c) => c.date), now ?? new Date()),
    [session.sessionHistory, now],
  );

  // Real per-movement exposure history from the member's own completed logs —
  // powers "last time / today's target", load suggestions, and PR detection.
  // Loaded in an effect (localStorage) so SSR and hydration stay clean.
  const [movementHistory, setMovementHistory] = useState<MovementHistoryMap>({});
  /* The same history without this session's own log: close-out reads records against it. */
  const [historyBeforeSession, setHistoryBeforeSession] = useState<MovementHistoryMap>({});
  useEffect(() => {
    // Deferred read of the external log store (localStorage) — post-hydration,
    // re-synced whenever a session closes out.
    const t = setTimeout(() => {
      const logs = getRecentTrainingLogs(30);
      setMovementHistory(buildMovementHistory(logs));
      setHistoryBeforeSession(buildMovementHistory(logs.filter((log) => !session.sessionId || log.sessionId !== session.sessionId)));
    }, 0);
    return () => clearTimeout(t);
  }, [session.sessionMode, session.sessionId]);

  const splitCustomization = useAthleteDashboardStore((s) => s.splitCustomization);
  /* The member's program as a week, so the rail and Apex render the same days
     the cockpit loads (lib/program/resolved-week). */
  const programWeek = useProgramWeek(now ?? undefined);

  /* ── UNIFIED DAILY TRAINING CONTEXT — the single training-truth source. ──
     One protocol · one focus · one architecture · one resolved week · one
     engine key. The whole view (hero, week, calendar, cockpit, directive)
     reads from here, so a Glute + Quad architecture never renders Chest / Back. */
  const dailyContext = useMemo(
    () => resolveDailyTrainingContext({
      now: now ?? new Date(),
      focus: physiqueCommand.focus,
      weakPoints: physiqueCommand.weakPoints,
      protocolName: activeResolution?.protocolName ?? activeProtocol?.protocolName ?? null,
      protocolArchitectureName: activeResolution?.architectureName ?? splitIdentityName,
      womensActive: protocolFamily === "women_performance",
      selectedDayIndex,
      protocolId: activeProtocol?.protocolId ?? null,
      protocolCategory: activeProtocol?.category ?? null,
      trainingDaysTarget: setupProfile.trainingDaysPerWeek ?? null,
      activityStack,
      activitySport,
      recoveryPreference:
        profile.recoveryAggression === "conservative"
          ? "Protective"
          : profile.recoveryAggression === "aggressive"
            ? "Aggressive"
            : "Balanced",
      weekNumber: executionWeekNumber,
      activeHorizonWeek: activeResolution?.activeWeek.weeklyStructure,
      requireActiveHorizon: !activeResolution && !resolvedProgramDay,
      splitSystemKey: splitSystemSelection.key,
      splitSystemChosen: Boolean(splitSystemSelection.selectedAt),
      splitRestDayIndex: splitSystemSelection.restDayIndex,
      splitCustomization,
      programWeek,
    }),
    [programWeek, now, physiqueCommand.focus, physiqueCommand.weakPoints, activeProtocol?.protocolName, activeProtocol?.protocolId, activeProtocol?.category, activeResolution, resolvedProgramDay, splitIdentityName, protocolFamily, selectedDayIndex, setupProfile.trainingDaysPerWeek, activityStack, activitySport, profile.recoveryAggression, executionWeekNumber, splitSystemSelection.key, splitSystemSelection.selectedAt, splitSystemSelection.restDayIndex, splitCustomization],
  );
  const weeklyPlan = dailyContext.weeklyPlan;
  /* Leg frequency of the split she chose, so the paused-track notice can state
     both numbers rather than only the one she gave up. */
  const chosenSplitLegDays = useMemo(() => {
    if (!dailyContext.pausedWomensTrack) return null;
    const arch = getArchitectureForSystem(splitSystemSelection.key, { trainingDaysPerWeek: setupProfile.trainingDaysPerWeek ?? null });
    return arch ? lowerDaysPerWeek(arch) : null;
  }, [dailyContext.pausedWomensTrack, splitSystemSelection.key, setupProfile.trainingDaysPerWeek]);
  const selectedSplitRow = dailyContext.todaySession;


  // Split-specific session: the cockpit loads from the resolved ENGINE KEY
  // (selectedSplitRow.splitKey), never the display title.
  // Workout demand: member's chosen tier, gated by training age + readiness
  // before it ever touches the session. The gate result is surfaced in the UI.
  const requestedDemand = useAthleteDashboardStore((s) => s.workoutDemand);
  const setWorkoutDemand = useAthleteDashboardStore((s) => s.setWorkoutDemand);
  const demandAge = (["beginner", "intermediate", "advanced"] as const).includes(
    trainingExperience as "beginner" | "intermediate" | "advanced",
  )
    ? (trainingExperience as "beginner" | "intermediate" | "advanced")
    : "intermediate";
  /* ── THE MEMBER'S BLOCK ──────────────────────────────────────────────────
     A cycle period is a span of time the member declared. They can hold a
     session depth for it so they set it once instead of twice, and Reserve
     hands depth back the day that span ends.

     What reaches training is a span and a week number — placement in their
     own declared time. No compound is read here or anywhere downstream, and
     no depth is chosen, raised or suggested because of one; see the contract
     at the top of lib/training/cycle-training-block.ts.

     Gated on the safety launch switch and the member's acknowledgement,
     because naming their cycle in Training Command is a surface onto Cycle &
     Safety and it is review-pending. Without it they simply see the depth
     control they already had. */
  const safetyToolsVisible = useSafetyToolsVisible();
  const cyclePeriods = useAthleteDashboardStore((s) => s.cyclePeriods);
  const bloodworkLogs = useAthleteDashboardStore((s) => s.bloodworkLogs);
  const safetyAcknowledgement = useAthleteDashboardStore((s) => s.safetyAcknowledgement);
  const blockIntent = useAthleteDashboardStore((s) => s.trainingBlockIntent);
  const setTrainingBlockIntent = useAthleteDashboardStore((s) => s.setTrainingBlockIntent);
  const blockVisible = safetyToolsVisible && hasCurrentSafetyAcknowledgement(safetyAcknowledgement, setupProfile.age);
  /* Day-stable. A block is a week number in a span of days, so it has no use
     for the live clock, and re-resolving it on every tick would cost the
     screen work for a number that changes at midnight. */
  const blockDayKey = localScheduleDateKey(now ?? undefined);
  const blockCycleState = useMemo(
    () => {
      if (!blockVisible) return null;
      const clock = new Date(`${blockDayKey}T12:00:00`);
      const current = selectCurrentCycle(cyclePeriods, clock);
      /* `compounds: []` is the point, not a shortcut: the training path is
         handed no compound list, so nothing downstream of here CAN reason
         from one. `stillActivePastEnd` and the compound roster it would fill
         belong to Compound Command, which reads them with the real list. */
      return current
        ? resolveCycleState(current, { now: clock, compounds: [], labDates: bloodworkLogs.map((log) => log.testDate) })
        : null;
    },
    [blockVisible, blockDayKey, cyclePeriods, bloodworkLogs],
  );
  const trainingBlock = useMemo(
    () => resolveTrainingBlock({ cycleState: blockCycleState, intent: blockIntent }),
    [blockCycleState, blockIntent],
  );
  const blockRelease = useMemo(
    () => blockVisible ? resolveBlockRelease({ cycleState: blockCycleState, intent: blockIntent }) : { kind: "none" as const },
    [blockVisible, blockCycleState, blockIntent],
  );
  /* The span the member declared is over. Reserve returns depth to their own
     setting and drops the pin, rather than quietly driving a finished block. */
  useEffect(() => {
    if (blockRelease.kind === "returned") setTrainingBlockIntent(null);
  }, [blockRelease.kind, setTrainingBlockIntent]);

  const demandGate = useMemo(
    () =>
      gateWorkoutDemand(requestedDemandForToday({
        block: trainingBlock,
        standing: requestedDemand,
        fallback: defaultWorkoutDemand(demandAge),
      }), {
        trainingAge: demandAge,
        readiness: recoverySnapshot.hasData ? recoverySnapshot.reserve : null,
        activePainFlags: 0,
        deload: activeResolution?.status === "deload" || activeResolution?.currentPhaseKind === "deload",
      }),
    [trainingBlock, requestedDemand, demandAge, recoverySnapshot.hasData, recoverySnapshot.reserve, activeResolution?.status, activeResolution?.currentPhaseKind],
  );

  /* Picking a depth while a block is held updates the BLOCK, not the standing
     setting — one control, and the member's baseline survives the block. */
  const chooseDepth = (level: WorkoutDemandLevel) => {
    if (trainingBlock?.demand) {
      setTrainingBlockIntent({ cycleId: trainingBlock.cycleId, demand: level, setAt: new Date().toISOString() });
      return;
    }
    setWorkoutDemand(level);
  };
  const holdForBlock = (hold: boolean) => {
    if (!trainingBlock) return;
    setTrainingBlockIntent(
      hold ? { cycleId: trainingBlock.cycleId, demand: demandGate.requested, setAt: new Date().toISOString() } : null,
    );
  };
  /* The depth tiers as Today's Session offers them. A tier above the member's
     training history is shown and disabled with the reason, never hidden —
     they can see what their own history opens next. */
  const depthOptions = useMemo<DepthOption[]>(() => {
    const rank = { beginner: 0, intermediate: 1, advanced: 2 } as const;
    return WORKOUT_DEMAND_ORDER.map((level) => {
      const meta = WORKOUT_DEMAND_META[level];
      return {
        id: level,
        name: meta.label,
        meta: meta.tagline,
        selected: level === demandGate.requested,
        available: rank[demandAge] >= rank[meta.minTrainingAge],
      };
    });
  }, [demandGate.requested, demandAge]);
  /* A member who chose a split, or changed today themselves, has a real
     session — their split's authored template, or the activity they set. Only
     a member with NO plan and NO change of their own gets the honest
     "no program" state. Before this, choosing Push / Pull / Legs without a
     protocol still showed "Program Horizon required" in the cockpit. */
  const memberPlanActive = dailyContext.memberArchitectureActive || Boolean(selectedSplitRow.memberEdit);

  /* ── A DAY THE MEMBER SET IS THEIRS ──────────────────────────────────────
     A change the member made to a specific date is the most specific thing
     anyone has said about that date — more specific than the program that
     scheduled it. It already governs the resolver, the week rail and the
     hero. The program day did not stand down with them, so a member who set
     "Legs every Friday" over a program whose Friday is a member-authored day
     with no template read:

         LEGS.
         Your program · Chest Day · Member created
         No session queue yet            [ Build Today's Session ]
         No workout template for “Legs” yet.

     — the screen naming their session at the top and refusing to build it
     underneath, because the cockpit was still trying to build the program's
     day. For an EDITED date the program day yields, exactly as the plan
     does; every other date keeps its program day untouched. */
  const sessionOwner = todaySessionOwner({
    horizonActive: Boolean(activeResolution),
    programDayResolved: Boolean(resolvedProgramDay),
    memberDayEdit: Boolean(selectedSplitRow.memberEdit),
    memberSplitActive: dailyContext.memberArchitectureActive,
  });
  const governingProgramDay = sessionOwner === "program-day" ? resolvedProgramDay : null;

  /* Starting-load inputs — the member's OWN body data. With no bodyweight on
     file the estimator returns nothing and the cockpit keeps its honest
     "set your load" state, so a number is never invented for anybody. */
  const loadProfile = useMemo<LoadProfile>(
    () => ({
      bodyweightLb: resolveMemberBodyweight({
        weighIns: physiqueCommand.entries,
        baselineWeightLb: setupProfile.baselineWeightLb,
        profileBodyweightLb: nutritionBodyweightLb,
      })?.lb ?? null,
      heightIn: setupProfile.heightIn ?? null,
      sex: setupProfile.sex ?? null,
      experience: trainingExperience,
    }),
    [physiqueCommand.entries, setupProfile.baselineWeightLb, setupProfile.heightIn, setupProfile.sex, nutritionBodyweightLb, trainingExperience],
  );

  const activeSession = useMemo(
    () => !activeResolution && !governingProgramDay && !memberPlanActive
      ? unresolvedProgramSession(selectedSplitRow, trainingExperience)
      : resolveActiveSession(selectedSplitRow, intensityTier, sessionReadiness, trainingExperience, movementPreferences, coreTiming, trainingPhase, userTrainingProfile, demandGate.effective),
    [activeResolution, governingProgramDay, memberPlanActive, selectedSplitRow, intensityTier, sessionReadiness, trainingExperience, movementPreferences, coreTiming, trainingPhase, userTrainingProfile, demandGate.effective],
  );
  const programSessionBuild = useMemo(
    () => governingProgramDay
      ? buildProgramDaySessionSnapshot(
          governingProgramDay,
          customWorkoutTemplates,
          demandGate.requested,
          demandGate.effective,
        )
      : null,
    [governingProgramDay, customWorkoutTemplates, demandGate.requested, demandGate.effective],
  );
  /* ── A DAY THE MEMBER NAMED IS A DAY RESERVE CAN BUILD ───────────────────
     A member-authored program day with no workout template attached used to
     render nothing, on every such day, forever — "No workout template for
     'Chest Day' yet" under a hero that said CHEST DAY, with Build Today's
     Session as the only way out.

     But Reserve knows what "Chest Day" means: resolveSplitKey reads the
     member's own title and returns `chest`, and there is a chest session
     behind it. The same three words typed into the 7-day rail load a full
     workout. Typed into Build Studio they loaded nothing. One word, one
     member, two answers.

     So a title Reserve can place IS the instruction. A title it cannot place
     — "Day 1", "Workout A", "Glutes" — still waits for a template, because
     there Reserve genuinely does not know what the member meant and will not
     guess. The honesty line says the session came from the day's name, so
     nobody mistakes Reserve's movements for their own. */
  const programLiftingDay = Boolean(
    governingProgramDay &&
    ["member-customized", "member-created", "imported"].includes(governingProgramDay.day.ownership) &&
    ["strength", "hypertrophy", "custom"].includes(governingProgramDay.day.sessionType),
  );
  /* "recovery" does not count: resolveSplitKey("Rest") returns it, and a rest
     day is not a session Reserve built from a title. Without this the honesty
     line announced "session built from the day you named" over a mobility
     runway. */
  const programDayNamesASplit =
    programLiftingDay && (() => {
      const key = resolveSplitKey(governingProgramDay!.day.title);
      return Boolean(key) && key !== "recovery";
    })();
  const memberProgramRequiresTemplate = programLiftingDay && !programSessionBuild && !programDayNamesASplit;
  // Enrich the queue with REAL last-exposure data (or nothing) — any authored
  // placeholder lastLoad/lastReps values are replaced so "your last session"
  // copy is never fabricated.
  // ── Launch intent arrival (Start Core Command) ──────────────────────────
  // Live session → resume the cockpit untouched (never regenerate).
  // Fresh training day → enter pre-session readiness (the minimum setup).
  // Recovery day → stay idle: the recovery runway IS the correct command.
  // Completed/closed → default review state. Intent clears ON arrival.
  useEffect(() => {
    if (!trainingLaunchIntent) return;
    clearTrainingLaunchIntent();
    // Reacting to a cross-view store signal (Start Core Command) — the stage
    // transition must happen on arrival, exactly once per intent.
    if (session.sessionMode === "live") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLaunchStage("idle");
    } else if (session.sessionMode === "pre") {
      const todayIsRecovery = Boolean(dailyContext.todaySession?.recovery);
      setLaunchStage(todayIsRecovery ? "idle" : "pre-session");
    }
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, [trainingLaunchIntent, clearTrainingLaunchIntent, session.sessionMode, dailyContext.todaySession]);

  /* ── SESSION IMMUTABILITY ────────────────────────────────────────────────
     A live session renders from its generation snapshot — the exact queue,
     demand, and architecture captured when the member started it. Settings
     changed mid-session can never silently rewrite the workout. Legacy live
     sessions (no snapshot) keep the derived queue exactly as before. */
  const sessionGeneration = session.generation;
  const frozenLive =
    session.sessionMode === "live" &&
    Boolean(sessionGeneration && Array.isArray(sessionGeneration.movements) && sessionGeneration.movements.length > 0);

  /** Settings-derived queue (always current — used for previews + rebuilds). */
  const derivedMovements = useMemo(
    () => {
      const resolved = (memberProgramRequiresTemplate
      ? []
      : ((programSessionBuild?.snapshot.movements as Movement[] | undefined) ?? activeSession.movements));
      const prescribed = activeResolution
        ? applyHorizonWeekTargets(resolved, activeResolution.activeWeek, activeResolution.projectedWeek)
        : resolved;
      const withHistory = prescribed.map((m) => {
        const read = historyForMovement(movementHistory, m.name);
        return {
          ...m,
          lastLoad: read?.exposure.lastTopLoad || undefined,
          lastReps: read?.exposure.lastTopReps || undefined,
        };
      });
      /* Starting loads come LAST so real logged history is already in place —
         a movement the member has lifted keeps their number, and only the rest
         get an estimate from their own bodyweight / height. */
      return withStartingLoads(withHistory, loadProfile);
    },
    [memberProgramRequiresTemplate, programSessionBuild, activeSession.movements, activeResolution, movementHistory, loadProfile],
  );

  const activeMovements = useMemo(() => {
    if (!frozenLive) return derivedMovements;
    // History overlay stays live; the queue itself is frozen. The starting-load
    // hint rides with the overlay — it is display data, not queue structure, so
    // a session frozen before estimates existed still opens with a number.
    const overlaid = (sessionGeneration!.movements as Movement[]).map((m) => {
      const read = historyForMovement(movementHistory, m.name);
      return {
        ...m,
        lastLoad: read?.exposure.lastTopLoad || m.lastLoad,
        lastReps: read?.exposure.lastTopReps || m.lastReps,
      };
    });
    return withStartingLoads(overlaid, loadProfile);
  }, [frozenLive, derivedMovements, sessionGeneration, movementHistory, loadProfile]);

  const activePhaseMap = frozenLive && sessionGeneration?.phaseMap
    ? (sessionGeneration.phaseMap as Record<string, WorkoutPhaseKey>)
    : ((programSessionBuild?.snapshot.phaseMap as Record<string, WorkoutPhaseKey> | undefined) ?? activeSession.phaseMap);
  const activeTotalSets = frozenLive
    ? activeMovements.reduce((s, m) => s + m.sets, 0)
    : activeMovements.reduce((s, m) => s + m.sets, 0);

  /* Consistency guard (development only) — surface any disagreement between the
     resolved daily context and the workout cockpit so mixed state can never
     ship silently. No user-facing error. */
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (governingProgramDay && programSessionBuild) return;
    const displayTitle = dailyContext.todayDisplayTitle;
    if (displayTitle && activeSession.displayName && displayTitle !== activeSession.displayName) {
      console.warn(`[Reserve consistency] resolved display "${displayTitle}" != cockpit session "${activeSession.displayName}"`);
    }
    const engineKey = dailyContext.todaySplitKey;
    const templateKey = activeSession.template?.splitKey;
    if (engineKey && engineKey !== "recovery" && templateKey && templateKey !== engineKey) {
      console.warn(`[Reserve consistency] engine key "${engineKey}" != loaded template "${templateKey}"`);
    }
  }, [dailyContext.todayDisplayTitle, dailyContext.todaySplitKey, activeSession.displayName, activeSession.template?.splitKey, governingProgramDay, programSessionBuild]);

  // Training intelligence — plateau / movement-pattern / equipment / superset / weak-point signals.
  const trainingIntel = useMemo(() => {
    const snap = buildRecoverySnapshot(recoveryCommand, now ?? new Date());
    return buildTrainingIntelligence({
      template: activeSession.template,
      movements: activeSession.template ? allTemplateMovements(activeSession.template) : [],
      weakPoints: physiqueCommand.weakPoints,
      recoveryReserve: snap.hasData ? snap.reserve : null,
      recoveryHasData: snap.hasData,
      profile: userTrainingProfile,
      goal: goalKeyFromString(profile.goal),
    });
  }, [activeSession.template, physiqueCommand.weakPoints, recoveryCommand, now, userTrainingProfile, profile.goal]);

  const trainingProfileCompleteness = useMemo(() => computeProfileCompleteness({
    profile: userTrainingProfile,
    hasGoal: Boolean(profile.goal),
    hasWeakPoints: physiqueCommand.weakPoints.length > 0,
    hasSchedule: Boolean(scheduleProfile.preferredTrainingStart && scheduleProfile.sleepTarget),
  }), [userTrainingProfile, profile.goal, physiqueCommand.weakPoints, scheduleProfile.preferredTrainingStart, scheduleProfile.sleepTarget]);

  const workoutSets = useMemo(() => buildLocalWorkout(session.workoutSets), [session.workoutSets]);
  const liveState = useMemo(() => computeLiveSessionState(workoutSets, activeTotalSets || 1), [workoutSets, activeTotalSets]);

  /* Architecture/demand changed AFTER this session was generated? The member
     decides what happens — never a silent regeneration. */
  const currentGenerationDay = sessionGeneration?.programDayLineageId
    ? programs.find((program) => program.id === sessionGeneration.programId)?.days.find(
        (day) => day.lineageId === sessionGeneration.programDayLineageId,
      )
      ?? programs.find((program) => program.id === activeProgramId)?.days.find(
        (day) => day.lineageId === sessionGeneration.programDayLineageId,
      )
    : null;
  const generationOutOfDate = Boolean(
    frozenLive &&
    sessionGeneration &&
    !sessionGeneration.changeAcknowledgedAt &&
    (sessionGeneration.programDayLineageId
      ? Boolean(currentGenerationDay) && (
        sessionGeneration.programDayVersion !== currentGenerationDay?.version ||
        sessionGeneration.sourceWorkoutTemplateId !== currentGenerationDay?.workoutTemplateId
      )
      : sessionGeneration.demandAtGeneration !== demandGate.effective ||
        (sessionGeneration.architectureVersion ?? null) !== (splitSystemSelection.selectedAt ?? null) ||
        (Boolean(sessionGeneration.horizonProgramId) && (
          sessionGeneration.horizonProgramId !== activeResolution?.programId ||
          sessionGeneration.horizonWeekNumber !== activeResolution?.currentWeekNumber ||
          (sessionGeneration.horizonRevisionIds ?? []).join("|") !== (activeResolution?.revisionIds ?? []).join("|")
        ))),
  );

  const firstIncompleteMovement = useMemo(() => {
    const next = activeMovements.find((m) => (workoutSets[m.id]?.length ?? 0) < m.sets);
    return next ?? null;
  }, [workoutSets, activeMovements]);

  const currentMovement = useMemo<Movement | null>(() => {
    if (activeMovements.length === 0) return null;
    // If user manually picked a card, honor that selection until it's completed
    if (session.manualMovementSelection && session.currentMovementId) {
      const manual = activeMovements.find((mm) => mm.id === session.currentMovementId);
      if (manual) return manual;
    }
    // If persisted id matches first incomplete or is still incomplete, use it
    if (session.currentMovementId) {
      const m = activeMovements.find((mm) => mm.id === session.currentMovementId);
      if (m && ((workoutSets[m.id]?.length ?? 0) < m.sets || !firstIncompleteMovement)) return m;
    }
    // Otherwise default to first incomplete (prevents starting at final movement)
    return firstIncompleteMovement ?? activeMovements[activeMovements.length - 1] ?? activeMovements[0];
  }, [session.currentMovementId, session.manualMovementSelection, workoutSets, firstIncompleteMovement, activeMovements]);

  const nextMovement = useMemo<Movement | null>(() => {
    if (!currentMovement) return null;
    const idx = activeMovements.findIndex((m) => m.id === currentMovement.id);
    if (idx < 0) return null;
    for (let i = idx + 1; i < activeMovements.length; i += 1) {
      const m = activeMovements[i];
      if ((workoutSets[m.id]?.length ?? 0) < m.sets) return m;
    }
    return null;
  }, [currentMovement, activeMovements, workoutSets]);

  const ctx: ProfileContext = useMemo(() => ({
    experienceLevel: profile.experienceLevel ?? "unknown",
    injuryNotes: profile.coachingProfile?.injuryNotes ?? "",
    lifeStages: profile.coachingProfile?.lifeStages ?? [],
    healthContext: profile.coachingProfile?.healthContext ?? [],
    readiness: readinessScore,
    hasStrengthHistory: Boolean(profile.experienceLevel && profile.experienceLevel !== "beginner"),
    fatigueSensitivity: profile.fatigueSensitivity ?? "medium",
    recoveryAggression: profile.recoveryAggression ?? "moderate",
    goal: profile.goal ?? "",
    tone,
  }), [profile, tone, readinessScore]);

  const latestSubstitution = useMemo(() => {
    if (!currentMovement) return null;
    return [...session.substitutions].reverse().find((sub) => sub.movementId === currentMovement.id) ?? null;
  }, [session.substitutions, currentMovement]);
  const isPostSession = session.sessionMode === "complete" || session.sessionMode === "closed";
  // Stale live: the session is flagged live but the resolved day has no lifting
  // queue (recovery / posing / un-templated split). Never present a fake live
  // workout — route to a clear no-queue state instead.
  const staleLive = session.sessionMode === "live" && activeMovements.length === 0;
  const isLive = session.sessionMode === "live" && !staleLive;
  // Hero/next-action copy should not read "Session Is Live" in the stale case.
  const effectiveSessionMode = staleLive ? "pre" : session.sessionMode;

  // Adaptive phase recommendations — purposeful Core/Cardio/Recovery
  const recCtxGoal = profile.goal ?? "";
  const recCtxInjury = profile.coachingProfile?.injuryNotes ?? "";
  const recCtxHealth = useMemo(
    () => profile.coachingProfile?.healthContext ?? [],
    [profile.coachingProfile?.healthContext]
  );
  const coreRec = useMemo(() => getCoreRecommendation({
    goal: recCtxGoal,
    readiness: readinessScore,
    sessionTitle: selectedSplitRow.title,
    sessionMode,
    injuryNotes: recCtxInjury,
  }), [recCtxGoal, sessionMode, recCtxInjury, readinessScore, selectedSplitRow.title]);
  const cardioRec = useMemo(() => getCardioRecommendation({
    goal: recCtxGoal,
    readiness: readinessScore,
    sessionTitle: selectedSplitRow.title,
    sessionMode,
  }), [recCtxGoal, sessionMode, readinessScore, selectedSplitRow.title]);
  const recoveryRec = useMemo(() => getRecoveryRecommendation({
    readiness: readinessScore,
    sessionMode,
    hydrationHandled: true,
    healthContext: recCtxHealth,
  }), [sessionMode, recCtxHealth, readinessScore]);

  const cardioOptions = useMemo(() => getConditioningOptions({
    dayIndex: selectedDayIndex,
    workoutType: selectedSplitRow.title,
    primaryGoal: recCtxGoal,
    readiness: readinessScore,
    selectedOptionId: session.selectedCardioOptionId,
  }), [selectedDayIndex, selectedSplitRow.title, recCtxGoal, session.selectedCardioOptionId, readinessScore]);

  const recoveryOptions = useMemo(() => getRecoverySuiteOptions({
    dayIndex: selectedDayIndex,
    workoutType: selectedSplitRow.title,
    primaryGoal: recCtxGoal,
    readiness: readinessScore,
    hydrationReady: true,
    preferences: session.recoveryPreferences,
    healthContext: recCtxHealth,
    selectedOptionId: session.selectedRecoveryOptionId,
  }), [selectedDayIndex, selectedSplitRow.title, recCtxGoal, session.recoveryPreferences, recCtxHealth, session.selectedRecoveryOptionId, readinessScore]);

  const selectedCardio = cardioOptions.find((o) => o.selected) ?? cardioOptions[0] ?? null;
  const selectedRecovery = recoveryOptions.find((o) => o.selected) ?? recoveryOptions[0] ?? null;

  function handleSelectCardioOption(id: string) {
    setSelectedCardioOption(id);
  }
  function handleSelectRecoveryOption(id: string) {
    setSelectedRecoveryOption(id);
  }

  // Compute lifting completion + final lifting movement (within active mode)
  const includedLiftingIds = useMemo(
    () => activeMovements.filter((mv) => activeMode.movementPhases.includes(activePhaseMap[mv.id] ?? "primary-output")).map((mv) => mv.id),
    [activeMode, activeMovements, activePhaseMap]
  );
  const liftingComplete = useMemo(
    () => includedLiftingIds.length > 0 && includedLiftingIds.every((id) => {
      const target = activeMovements.find((mv) => mv.id === id);
      if (!target) return true;
      return (workoutSets[id]?.length ?? 0) >= target.sets;
    }),
    [includedLiftingIds, workoutSets, activeMovements]
  );
  const finalLiftingMovementName = useMemo(() => {
    if (includedLiftingIds.length === 0) return null;
    const lastId = includedLiftingIds[includedLiftingIds.length - 1];
    return activeMovements.find((mv) => mv.id === lastId)?.name ?? null;
  }, [includedLiftingIds, activeMovements]);

  const supportSlots = useMemo(
    () => buildSupportPhaseSlots({
      activeMode,
      finalLiftingMovementName,
      liftingDone: liftingComplete,
      coreRec,
      cardioRec,
      recoveryRec,
      dayPrescription: getDayPrescription(selectedDayIndex),
      selectedCardio,
      selectedRecovery,
      storedCore: session.corePhaseStatus,
      storedCardio: session.conditioningPhaseStatus,
      storedRecovery: session.recoveryPhaseStatus,
      storedHandoff: session.handoffPhaseStatus,
    }),
    [activeMode, finalLiftingMovementName, liftingComplete, coreRec, cardioRec, recoveryRec, selectedDayIndex, selectedCardio, selectedRecovery, session.corePhaseStatus, session.conditioningPhaseStatus, session.recoveryPhaseStatus, session.handoffPhaseStatus]
  );

  function handleSupportAction(key: SupportPhaseSlot["key"], action: "complete" | "skip" | "start") {
    if (action === "complete") setSupportPhaseStatus(key, "completed");
    else if (action === "skip") setSupportPhaseStatus(key, "skipped");
    else setSupportPhaseStatus(key, "due-now");
  }

  function handleBeginLaunch() {
    setLaunchStage("pre-session");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Capture HOW this session is being built — the immutable generation
      record startTrainingSession freezes. Always built from the DERIVED
      (current-settings) queue, never from a previous snapshot. */
  function buildGenerationSnapshot(reason: SessionGenerationSnapshot["generationReason"]): SessionGenerationSnapshot {
    if (programSessionBuild) {
      return {
        ...programSessionBuild.snapshot,
        generatedAt: new Date().toISOString(),
        generationReason: reason === "member-rebuild"
          ? "member-rebuild"
          : programSessionBuild.snapshot.generationReason,
        requestedDemand: demandGate.requested,
        demandAtGeneration: demandGate.effective,
        authorizedDemand: demandGate.effective,
        changeAcknowledgedAt: null,
      };
    }
    return {
      demandAtGeneration: demandGate.effective,
      requestedDemand: demandGate.requested,
      authorizedDemand: demandGate.effective,
      architectureId: splitSystemSelection.selectedAt
        ? (splitSystemSelection.key ?? "reserve-default")
        : activeProtocol?.protocolId
          ? `protocol:${activeProtocol.protocolId}`
          : "reserve-default",
      architectureVersion: splitSystemSelection.selectedAt ?? null,
      architectureName: dailyContext.activeArchitectureName,
      mesocycleId: `${activeResolution?.programId ?? activeProtocol?.protocolId ?? "membership"}:W${executionWeekNumber}`,
      generatedAt: new Date().toISOString(),
      generationReason: reason,
      splitTitle: governingProgramDay?.day.title ?? activeSession.displayName,
      movements: derivedMovements,
      phaseMap: activeSession.phaseMap as Record<string, string>,
      changeAcknowledgedAt: null,
      programId: governingProgramDay?.program.id,
      programVersion: governingProgramDay?.program.version,
      programDayId: governingProgramDay?.day.id,
      programDayLineageId: governingProgramDay?.day.lineageId,
      programDayVersion: governingProgramDay?.day.version,
      programDayOwnership: governingProgramDay?.day.ownership,
      sourceWorkoutTemplateId: governingProgramDay?.day.workoutTemplateId,
      ...freezeHorizonSessionReference(activeResolution),
    };
  }

  function handleStart() {
    const firstMovement = derivedMovements[0];
    if (!firstMovement) return;
    startTrainingSession(firstMovement.id, buildGenerationSnapshot("member-start"));
    setManualMovementSelection(false);
    setLaunchStage("idle");
  }

  /** Member explicitly chose REBUILD TODAY'S SESSION (zero progress only). */
  function handleRebuildSession() {
    const firstMovement = derivedMovements[0];
    rebuildLiveSession(buildGenerationSnapshot("member-rebuild"), firstMovement?.id ?? null);
  }

  function handleSelectSplitDay(dayIndex: number) {
    setSelectedOverrideDayIndex(dayIndex === todayIndex ? null : dayIndex);
  }

  function handleLogged(load: number, reps: number, intensity: number, review: SetReview) {
    if (!loggerMovement) return;
    const history = workoutSets[loggerMovement.id] ?? [];
    announceSet(`Set ${history.length + 1} logged · ${load > 0 ? load : "BW"} × ${reps}`);
    logTrainingSet({
      movementId: loggerMovement.id,
      load,
      reps,
      intensity,
      setNumber: history.length + 1,
      review,
    });
    const projectedMovementSets = history.length + 1;
    if (projectedMovementSets >= loggerMovement.sets) {
      const next = activeMovements.find((m) => m.id !== loggerMovement.id && (workoutSets[m.id]?.length ?? 0) < m.sets);
      setCurrentTrainingMovement(next?.id ?? loggerMovement.id);
    } else {
      setCurrentTrainingMovement(loggerMovement.id);
    }
  }

  function handleEditSet(setNumber: number, load: number, reps: number, intensity: number, review: SetReview) {
    if (!loggerMovement) return;
    announceSet(`Set ${setNumber} saved · ${load > 0 ? load : "BW"} × ${reps}`);
    editTrainingSet(loggerMovement.id, setNumber, { load, reps, intensity, review });
  }

  function handleUndo() {
    if (!loggerMovement) return;
    undoLastTrainingSet(loggerMovement.id);
  }

  function handleEndWorkout(
    accuracy: CloseoutAccuracy,
    extras: { logAccuracy: LogAccuracy; sessionCompletion: SessionCompletion }
  ) {
    const endDate = new Date();
    const debrief = buildDebrief({
      accuracy,
      logAccuracy: extras.logAccuracy,
      sessionCompletion: extras.sessionCompletion,
      state: liveState,
      workoutSets,
      workoutEndDate: endDate,
      primaryGoal: profile.goal ?? "",
      sleepTime: session.schedulePlan.sleepTime,
      movements: activeMovements,
      sessionDemand: sessionGeneration?.demandAtGeneration ?? demandGate.effective,
    });
    saveTrainingDebriefSummary({
      confidence: debrief.confidence,
      completion: liveState.completion,
      rating: debrief.rating,
      summary: debrief.summary,
      nextBestAction: debrief.nextAction,
      logAccuracy: extras.logAccuracy,
      sessionCompletion: extras.sessionCompletion,
      progressionDecision: debrief.progression.decision,
      mealTimingGuidance: debrief.meal,
    });

    // The intelligence card, journal projection, durable workout log, and
    // execution ledger all describe the SAME session. Reuse the frozen
    // identity so the legacy-history migration cannot import these derived
    // views as a second completed workout after refresh.
    const sessionId = session.sessionId ?? `reserve-${endDate.getTime()}`;
    const dateLabel = endDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const phaseLabel = phaseCompletionLabel(getPhaseCompletions(liveState, sessionMode, accuracy, supportSlots, extras.sessionCompletion, extras.logAccuracy)[0]?.status ?? "complete");

    // Personal records — today's top sets vs the member's own history.
    const sessionPRs = detectSessionPRs(
      movementHistory,
      activeMovements
        .filter((m) => (workoutSets[m.id]?.length ?? 0) > 0)
        .map((m) => ({ movementName: m.name, sets: (workoutSets[m.id] ?? []).map((s) => ({ load: s.load, reps: s.reps })) })),
    );
    const prLine = sessionPRs.length > 0 ? ` ${sessionPRs.map((p) => p.line).join(" · ")}.` : "";

    // Build improved/heldBack copy from debrief + state
    const improved = `${
      extras.sessionCompletion === "as-planned" && debrief.confidence === "high"
        ? `${debrief.bestOutput} ${debrief.targetResult}`
        : extras.sessionCompletion === "as-planned"
          ? "Session completion recorded. Upper output advanced the week's intent."
          : debrief.bestOutput
    }${prLine}`;
    const heldBack =
      debrief.confidence === "low"
        ? "Logged detail was limited — progression confidence stays conservative until the next fully logged exposure."
        : debrief.limiter;
    const nextTen = debrief.progression.decision === "hold" || debrief.progression.decision === "recalibrate"
      ? "Fully log the first two compound lifts next exposure. Keep recovery meal inside the target window."
      : "Repeat today's standard. Protect rest windows on the heavier compounds.";

    // Compute momentum (0–100) from rating + completion + confidence
    const confidenceWeight = debrief.confidence === "high" ? 1 : debrief.confidence === "moderate" ? 0.88 : 0.78;
    const momentum = Math.max(20, Math.min(98, Math.round(debrief.rating * 10 * confidenceWeight)));

    // Enhancement Log summary for journal + session intelligence card
    const enhancementSlotsForReport = getEnhancementDailySchedule({
      entries: session.enhancementLog,
      adherence: session.enhancementAdherence,
      isTrainingDay: true,
      wakeTime: session.schedulePlan.wakeTime,
      sleepTime: session.schedulePlan.sleepTime,
      preferredGymTime: session.schedulePlan.workoutTime,
      date: todayDateString(),
    });
    const enhancementSummaryForReport = summarizeStack(enhancementSlotsForReport);
    const enhancementSummaryLine = session.enhancementLog.length === 0
      ? "Enhancement Log: empty."
      : `Enhancement Log: ${enhancementSummaryForReport.planned} planned · ${enhancementSummaryForReport.logged} logged · ${enhancementSummaryForReport.pending} pending${enhancementSummaryForReport.missed > 0 ? ` · ${enhancementSummaryForReport.missed} missed` : ""}${enhancementSummaryForReport.skipped > 0 ? ` · ${enhancementSummaryForReport.skipped} skipped` : ""}`;
    const enhancementCategoriesLine = enhancementSummaryForReport.categories.length > 0
      ? `Categories: ${enhancementSummaryForReport.categories.map((c) => categoryLabel(c)).join(" · ")}`
      : "";
    const enhancementReviewActionLine = enhancementSummaryForReport.needsReview > 0 && enhancementSummaryForReport.reviewSlot
      ? `Next review: ${enhancementSummaryForReport.reviewSlot.entry.name} timing preference incomplete.`
      : enhancementSummaryForReport.nextDue
        ? `Next review: ${enhancementSummaryForReport.nextDue.bucketLabel.toLowerCase()} entry pending.`
        : "";
    const toleranceMentioned = session.enhancementAdherence.some((r) => (r.tolerance && r.tolerance !== "unknown") || (r.symptoms && r.symptoms.trim().length > 0));
    const toleranceNoteLine = toleranceMentioned
      ? "Tolerance note recorded. Discuss any concerning symptoms with a qualified professional."
      : "";

    const intelligenceCard: import("@/lib/athlete-store").SessionIntelligenceCard = {
      id: sessionId,
      date: endDate.toISOString(),
      dateLabel,
      sessionName: selectedSplitRow.displayTitle,
      splitName: splitIdentityName,
      weekLabel: `Week ${executionWeekNumber}`,
      phaseLabel,
      rating: debrief.rating,
      completionStatus: extras.sessionCompletion,
      completionLabel: sessionCompletionLabel(extras.sessionCompletion),
      logAccuracy: extras.logAccuracy,
      dataConfidence: debrief.confidence,
      progressionDecision: debrief.progression.decision,
      improved,
      heldBack,
      nextTen,
      nutritionNext: `${debrief.meal.mealLabel} · ${debrief.meal.timingWindow}`,
      recoveryNote: selectedRecovery
        ? `${selectedRecovery.name} selected. ${debrief.sleep}`
        : debrief.sleep,
      enhancementSummary: enhancementSummaryLine,
      enhancementCategories: enhancementCategoriesLine || undefined,
      enhancementReviewAction: enhancementReviewActionLine || undefined,
      momentum,
    };

    const journalEntry: import("@/lib/athlete-store").TrainingJournalEntry = {
      id: sessionId,
      loggedAt: endDate.toISOString(),
      dateLabel,
      sessionName: selectedSplitRow.displayTitle,
      splitName: splitIdentityName,
      weekLabel: `Week ${executionWeekNumber}`,
      phaseLabel,
      completionStatus: extras.sessionCompletion,
      completionLabel: sessionCompletionLabel(extras.sessionCompletion),
      logAccuracy: extras.logAccuracy,
      dataConfidence: debrief.confidence,
      rating: debrief.rating,
      bestOutput: debrief.bestOutput,
      limiter: debrief.limiter,
      coreStatus: supportSlots.find((s) => s.key === "core")?.statusLabel ?? "—",
      conditioningStatus: supportSlots.find((s) => s.key === "conditioning")?.statusLabel ?? "—",
      selectedCardio: selectedCardio?.name ?? "Not selected",
      recoveryStatus: supportSlots.find((s) => s.key === "recovery")?.statusLabel ?? "—",
      selectedRecovery: selectedRecovery?.name ?? "Not selected",
      postWorkoutMeal: `${debrief.meal.mealLabel} · ${debrief.meal.timingWindow}`,
      hydration: debrief.hydration,
      sleepPriority: debrief.sleep,
      tomorrowReadiness: debrief.tomorrow,
      nextSessionAdjustment: debrief.progression.copy,
      enhancementSummary: enhancementSummaryLine,
      enhancementCategories: enhancementCategoriesLine || undefined,
      enhancementReviewAction: enhancementReviewActionLine || undefined,
      enhancementToleranceNote: toleranceNoteLine || undefined,
      notes: "",
    };

    appendSessionIntelligenceCard(intelligenceCard);
    appendTrainingJournalEntry(journalEntry);

    // Durable, syncable session record (offline-safe store + Supabase queue).
    saveTrainingLog({
      id: sessionId,
      sessionId,
      date: todayDateString(),
      splitDay: selectedSplitRow.splitDay,
      focus: selectedSplitRow.displayTitle,
      readinessScore,
      perceivedEffort: null,
      exerciseLogs: activeMovements
        .filter((m) => (workoutSets[m.id]?.length ?? 0) > 0)
        .map((m) => ({
          exerciseId: m.id,
          exerciseName: m.name,
          bodyGroup: m.region ?? null,
          targetMuscle: m.primaryMuscles?.[0] ?? m.target ?? null,
          sets: (workoutSets[m.id] ?? []).map((s, i) => ({
            setNumber: i + 1,
            weight: s.load,
            reps: s.reps,
            rir: null,
            tempo: null,
            notes: null,
            jointFeedback: "none" as const,
            pumpScore: null,
            completedAt: null,
          })),
          notes: null,
          rpe: null,
          prescribedSets: m.sets,
          loggedAt: endDate.toISOString(),
        })),
      cardioMinutes: null,
      saunaMinutes: null,
      totalVolumeLbs: null,
      totalSetsCompleted: null,
      mood: null,
      notes: null,
      status: extras.sessionCompletion === "as-planned" ? "completed" : "partial",
      completedAt: endDate.toISOString(),
      source: "manual",
    });

    recordTrainingCloseOut(
      () => closeOutTrainingSession(accuracy, extras),
      Object.values(workoutSets).reduce((sum, sets) => sum + sets.length, 0),
    );
    setEndModalOpen(false);
    setLoggerMovement(null);
    setSubMovement(null);
  }

  function handleResumePre() {
    resetTrainingSession();
    setLoggerMovement(null);
    setSubMovement(null);
    setLaunchStage("idle");
    setReadinessChecked({});
    setPrimerChecked({});
  }

  const todayDateKey = programDateKey(new Date());

  function handleNotReady(action: Extract<TrainingOverrideAction, "not_ready" | "accidental_start">) {
    const sessionTitle = selectedSplitRow.displayTitle;
    setTrainingOverride(todayDateKey, {
      action,
      originalSessionTitle: sessionTitle,
      originalSessionId: selectedSplitRow.splitKey ?? undefined,
      originalProgramDayId: governingProgramDay?.day.lineageId,
      originalDayIndex: selectedSplitRow.dayIndex,
      reason: action === "not_ready" ? "Member was not ready — no training output" : "Accidental start — no training output",
    });
    // Snapshot-then-reset so the member can Undo a test / accidental reset.
    // No debrief, post-workout meal timing, recovery handoff, or progression runs.
    resetTrainingSessionWithUndo();
    setNotReadyOpen(false);
    setLoggerMovement(null);
    setSubMovement(null);
    setLaunchStage("idle");
    setReadinessChecked({});
    setPrimerChecked({});
    setSessionResetNote(action === "not_ready"
      ? "Not ready was recorded. No training data was captured."
      : "Accidental start was recorded. No training data was captured.");
  }

  function handleUndoReset() {
    // Restore the live session exactly as it was — no post-workout logic fires.
    undoTrainingReset();
    clearTrainingOverride(todayDateKey);
    setSessionResetNote(null);
    setLaunchStage("idle");
  }

  function handleReschedule(target: { targetDate: string; targetDayIndex: number; targetDayTitle: string; targetSessionId?: string }) {
    const sessionTitle = selectedSplitRow.displayTitle;
    const targetResolution = resolveProgramDayForDate({
      programs,
      activeProgramId,
      assignments: weekAssignments,
      overrides: programDayOverrides,
      date: new Date(`${target.targetDate}T12:00:00`),
    });
    setTrainingOverride(todayDateKey, {
      action: "rescheduled",
      originalSessionTitle: sessionTitle,
      originalSessionId: selectedSplitRow.splitKey ?? undefined,
      originalProgramDayId: governingProgramDay?.day.lineageId,
      originalDayIndex: selectedSplitRow.dayIndex,
      targetDate: target.targetDate,
      targetDayIndex: target.targetDayIndex,
      targetDayTitle: target.targetDayTitle,
      targetProgramDayId: targetResolution?.day.lineageId,
      newSessionId: target.targetSessionId,
      reason: `Rescheduled to ${target.targetDate} · ${target.targetDayTitle}`,
    });
    recordReserveDecision({
      category: "schedule-adjustment",
      source: "athlete",
      programId: activeResolution?.programId,
      observation: `${sessionTitle} was planned for ${todayDateKey}.`,
      decision: `Rescheduled the session to ${target.targetDate} · ${target.targetDayTitle}.`,
      reason: "Athlete selected a different calendar slot.",
      affectedWeekNumbers: activeResolution ? [activeResolution.currentWeekNumber] : undefined,
      affectedSessionIds: session.sessionId ? [session.sessionId] : undefined,
      athleteDecision: "accepted",
    });
    resetTrainingSession();
    setNotReadyOpen(false);
    setLoggerMovement(null);
    setSubMovement(null);
    setLaunchStage("idle");
    setReadinessChecked({});
    setPrimerChecked({});
    setSessionResetNote(`Session moved to ${new Date(target.targetDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}. Meal timing and calendar status now follow the new day.`);
  }

  function handleSaveNote() {
    // Called only from NotReadyModal (0 meaningful sets). Lightweight note — no post-workout logic.
    const sessionTitle = selectedSplitRow.displayTitle;
    setTrainingOverride(todayDateKey, {
      action: "skipped",
      originalSessionTitle: sessionTitle,
      originalSessionId: selectedSplitRow.splitKey ?? undefined,
      originalProgramDayId: governingProgramDay?.day.lineageId,
      originalDayIndex: selectedSplitRow.dayIndex,
      reason: "Partial note saved — no meaningful training output",
    });
    recordPlannedSessionOutcome({
      snapshot: buildGenerationSnapshot("member-start"),
      calendarDate: todayDateKey,
      outcome: "skipped",
      reason: "Partial note saved — no meaningful training output",
      reschedulingOffered: true,
      athleteConfirmed: true,
    });
    resetTrainingSession();
    setNotReadyOpen(false);
    setLoggerMovement(null);
    setSubMovement(null);
    setLaunchStage("idle");
    setReadinessChecked({});
    setPrimerChecked({});
    setSessionResetNote("Partial note saved. No training output was recorded.");
  }

  function handleSwitchSession(newDayIndex: number, newSessionTitle: string) {
    const newDay = weeklyPlan.find((d) => d.dayIndex === newDayIndex);
    setTrainingOverride(todayDateKey, {
      action: "swapped",
      originalSessionTitle: selectedSplitRow.displayTitle,
      originalSessionId: selectedSplitRow.splitKey ?? undefined,
      originalProgramDayId: governingProgramDay?.day.lineageId,
      originalDayIndex: selectedSplitRow.dayIndex,
      newSessionTitle,
      newSessionId: newDay?.splitKey ?? undefined,
      targetDate: todayDateKey,
      targetDayIndex: newDayIndex,
      targetDayTitle: newSessionTitle,
      reason: `Switched to ${newSessionTitle}`,
    });
    recordPlannedSessionOutcome({
      snapshot: buildGenerationSnapshot("member-start"),
      calendarDate: todayDateKey,
      outcome: "replaced",
      reason: `Athlete switched the planned session to ${newSessionTitle}.`,
      replacementActivityId: newDay?.splitKey ?? `planned-day-${newDayIndex}`,
      reconciliationProposal: `Replace today's planned session with ${newSessionTitle}.`,
      athleteConfirmed: true,
      affectedFutureDays: [newSessionTitle],
    });
    resetTrainingSession();
    setNotReadyOpen(false);
    setLoggerMovement(null);
    setSubMovement(null);
    handleSelectSplitDay(newDayIndex);
    setLaunchStage("idle");
    setReadinessChecked({});
    setPrimerChecked({});
    setSessionResetNote(`Switched to ${newSessionTitle}.`);
  }

  function handleEndWorkoutAttempt() {
    if (!hasMeaningfulTrainingOutput(liveState)) {
      setNotReadyOpen(true);
    } else {
      setEndModalOpen(true);
    }
  }

  function handleSelectMovement(id: string) {
    setCurrentTrainingMovement(id);
    // Treat as manual override only when user chooses something other than the natural next movement
    if (firstIncompleteMovement && id !== firstIncompleteMovement.id) {
      setManualMovementSelection(true);
    } else {
      setManualMovementSelection(false);
    }
  }

  function handleSubstitutionSelect(substitution: MovementSub, reason: SwapReason | null) {
    if (!subMovement) return;
    recordTrainingSubstitution({
      movementId: subMovement.id,
      reason,
      replacementName: substitution.name,
      equipment: substitution.equipment,
      preservesStimulus: substitution.preservesStimulus,
    });
    setSubMovement(null);
  }

  /* ── TRAINING ROOM — honest reads, one gold action, today's session on one clock. ── */
  const motionPaused = useAmbientMotionStore((s) => s.paused);
  const reducedMotion = useReducedMotion();
  /* Live logging holds every decorative loop still, as do the top bar's pause and reduced motion. */
  const stillMotion = isLive || motionPaused || Boolean(reducedMotion);
  const heroReadiness = readinessRead(recoverySnapshot);
  /* Plan resolved today: an active Program Horizon, a program day, or the member's own split or day change. */
  const hasPlan = Boolean(activeResolution || governingProgramDay || memberPlanActive);
  /* What Reserve is building today, in the member's own set count, with the
     day's own step-down named when there is one. The depth control used to
     live only inside Plan & Split, so a member could not see the tier that
     produced the session sitting in front of them. */
  const sessionDepthRead =
    activeSession.kind === "lifting" && activeTotalSets > 0
      ? {
          value: `${WORKOUT_DEMAND_META[demandGate.effective].label} · ${activeTotalSets} sets`,
          /* The day's own step-down first — it changed today's session. Then
             placement, which only says where in the member's declared span
             this sits. Never both as one sentence: one is a reason, the other
             is a date, and they must not read as cause and effect. */
          note: demandGate.limited ? demandGate.reason : blockPlacementLine(trainingBlock),
        }
      : null;
  const heroCopy = trainingHeroCopy({
    mode: effectiveSessionMode,
    liftingStarted: !staleLive && liveState.totalLogged > 0,
    isCatchUp,
    /* The hero names whatever is actually governing today. When a program day
       owns the session the cockpit already carries its title, and the hero
       read the resolver's week instead — so one screen said "Pull." above
       "Your program · Chest Day" above "No workout template for Pull yet".
       Three names for one day. They are one name now. */
    title: activeSession.kind === "activity"
      ? (activeSession.activity?.label ?? selectedSplitRow.displayTitle)
      : governingProgramDay?.day.title ?? selectedSplitRow.displayTitle,
    kind: activeSession.kind,
    hasPlan,
  });
  const todayPlanRow = weeklyPlan.find((r) => r.dayIndex === todayIndex);
  /* The honesty line: what actually generated today's session. It replaces the
     "Active program resolution" panel, which said no Program Horizon was
     available directly above a session the member's split had built. */
  const programLine = programSourceLine({
    generation: session.sessionMode !== "pre" && sessionGeneration
      ? { architectureName: sessionGeneration.architectureName, splitTitle: sessionGeneration.splitTitle }
      : null,
    horizon: activeResolution
      ? {
          protocolName: activeResolution.protocolName,
          phaseName: activeResolution.currentPhaseName,
          weekNumber: activeResolution.currentWeekNumber,
          totalWeeks: activeResolution.horizon.totalWeeks,
        }
      : null,
    programDay: governingProgramDay
      ? {
          title: governingProgramDay.day.title,
          ownershipLabel: PROGRAM_OWNERSHIP_LABELS[governingProgramDay.day.ownership] ?? null,
          builtFromDayName: !programSessionBuild && programDayNamesASplit,
        }
      : null,
    memberSplitName: dailyContext.memberArchitectureActive ? dailyContext.activeArchitectureName : null,
    memberDayEdit: Boolean(selectedSplitRow.memberEdit),
  });
  const heroMetric = sessionMetric({
    mode: effectiveSessionMode,
    kind: activeSession.kind,
    estimatedDurationMin: activeSession.template?.estimatedDurationMin ?? null,
    movements: activeMovements.length,
    totalSets: activeTotalSets,
    loggedSets: liveState.totalLogged,
    recoveryMoves: activeSession.recovery?.items.length ?? null,
    activityLabel: activeSession.activity?.label ?? null,
    activityMinutes: activeSession.activity?.durationMinutes ?? null,
  });

  /** Brings a section into view, opening any disclosure it sits behind first. */
  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    for (let details = el.closest("details"); details; details = details.parentElement?.closest("details") ?? null) details.open = true;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: stillMotion ? "auto" : "smooth", block: "start" }));
  }

  /* The screen's single gold action (`trainingPrimaryAction`). Idle it opens the
     readiness step; in pre-session it starts the session. */
  const primaryAction = trainingPrimaryAction({
    mode: session.sessionMode,
    staleLive,
    launchStage,
    kind: activeSession.kind,
    movementCount: derivedMovements.length,
    hasRecoveryRunway: Boolean(activeSession.recovery),
    hasPlan,
  });
  const primaryHandlers: Record<TrainingPrimaryKind, () => void> = {
    begin: handleBeginLaunch,
    start: handleStart,
    "recovery-runway": () => scrollToSection("training-recovery-runway"),
    "choose-split": () => scrollToSection("training-split-architect"),
    build: () => setActiveView("mesocycle-planner"),
  };
  const heroPrimary = primaryAction ? { label: primaryAction.label, onClick: primaryHandlers[primaryAction.kind] } : null;

  /* The week rail Apex shows, from Training's own resolved week, so both agree. */
  const railWeek = useMemo(
    () => toApexWeekDays(weeklyPlan, now ?? FIXED_NOON, completedSplitDays),
    [weeklyPlan, now, completedSplitDays],
  );

  const sessionHorizon = useMemo(() => {
    if (!now || staleLive || activeMovements.length === 0) return null;
    return buildSessionHorizon({
      mode: session.sessionMode,
      now,
      plannedStart: scheduleProfile.preferredTrainingStart || session.schedulePlan.workoutTime || null,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      primerTime: session.sessionMode === "pre" ? getMobilityPrimer(selectedSplitRow.title).estTime : null,
      estimatedLiftingMin: activeSession.template?.estimatedDurationMin ?? null,
      work: activeMode.movementPhases.map((phase) => ({
        phase,
        label: SESSION_PHASE_DEFS.find((d) => d.key === phase)?.label ?? phase,
        movements: activeMovements
          .filter((m) => (activePhaseMap[m.id] ?? "primary-output") === phase)
          .map((m) => ({ id: m.id, sets: m.sets, restSeconds: m.restSeconds, loggedSets: workoutSets[m.id]?.length ?? 0 })),
      })),
      support: supportSlots.map((s) => ({ key: s.key, label: s.label, included: s.included, duration: s.duration, status: s.status })),
    });
  }, [now, staleLive, activeMovements, session.sessionMode, scheduleProfile.preferredTrainingStart, session.schedulePlan.workoutTime, session.startedAt, session.endedAt, selectedSplitRow.title, activeSession.template, activeMode, activePhaseMap, workoutSets, supportSlots]);
  const horizonEmpty = staleLive
    ? "This live session has no lifting queue to place on the clock."
    : activeSession.kind === "recovery"
      ? "Recovery day · no lifting blocks to place on the clock."
      : activeSession.kind === "activity"
        ? `${activeSession.activity?.label ?? "Activity"} day · no lifting blocks today.`
        : activeMovements.length === 0
          ? "No session queue yet · build today's session to see its blocks."
          : "Reading the clock.";

  /** What a horizon block opens. Only surfaces that are on screen right now; otherwise the block is plain text. */
  function horizonAction(block: SessionHorizonBlock): (() => void) | null {
    if (block.kind === "post-window") return () => setActiveView("nutrition");
    if (isLive) {
      const movementId = block.firstOpenMovementId;
      if (movementId) return () => { handleSelectMovement(movementId); scrollToSection("training-cockpit"); };
      return block.supportKey ? () => scrollToSection("training-details") : null;
    }
    if (isPostSession) return null;
    if (launchStage === "primer") return null;
    if (block.kind === "primer") return () => { setLaunchStage("primer"); scrollToSection("training-room-top"); };
    if (block.kind === "work") return () => scrollToSection("training-session-preview");
    if (launchStage === "idle" && block.supportKey === "conditioning") return () => setOptionSheet("conditioning");
    if (launchStage === "idle" && block.supportKey === "recovery") return () => setOptionSheet("recovery");
    return null;
  }

  const closeoutAccuracy = session.closeoutAccuracy ?? "fully-logged";
  const persistedLogAccuracy: LogAccuracy = session.logAccuracy
    ?? (closeoutAccuracy === "fully-logged" ? "fully-accurate" : closeoutAccuracy === "operationally-accurate" ? "mostly-accurate" : "estimated");
  const persistedSessionCompletion: SessionCompletion = session.sessionCompletion
    ?? (liveState.completion >= 95 ? "as-planned" : liveState.completion >= 60 ? "partial" : liveState.completion >= 30 ? "minimum-effective" : "stopped-early");
  const sessionEndDate: Date | null = session.endedAt ? new Date(session.endedAt) : null;

  /* ── LIVE AND CLOSE-OUT READS ── */
  const heroLead = sessionClockLead({
    mode: effectiveSessionMode,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    now,
    formatTime: (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  });
  let lastLoggedAt: string | null = null;
  for (const sets of Object.values(session.workoutSets)) {
    for (const set of sets) if (!lastLoggedAt || set.loggedAt > lastLoggedAt) lastLoggedAt = set.loggedAt;
  }
  const followingMovement = nextMovement ?? activeMovements.find((m) => m.id !== currentMovement?.id && (workoutSets[m.id]?.length ?? 0) < m.sets) ?? null;
  const pendingSupport = supportSlots.find((slot) => slot.included && (SUPPORT_ACTIONABLE.has(slot.status) || slot.status === "pending"));
  const cockpitNext = followingMovement
    ? `${followingMovement.name} · ${followingMovement.sets} × ${followingMovement.reps}`
    : pendingSupport
      ? `${pendingSupport.label}${pendingSupport.duration !== "—" ? ` · ${pendingSupport.duration}` : ""}`
      : "Close out · End Workout";
  const recordMovement = session.executionRecord && currentMovement
    ? session.executionRecord.movements.find((mv) => mv.id === currentMovement.id) ?? null
    : null;
  const canSkipCurrent = Boolean(
    recordMovement && !session.executionRecord?.integrity.completedRecordLockedAt && recordMovement.status !== "skipped" && recordMovement.status !== "completed",
  );
  function handleSkipCurrent() {
    if (!currentMovement || !skipTrainingMovement(currentMovement.id, "Athlete skipped this movement during the live session.")) return;
    const next = activeMovements.find((m) => m.id !== currentMovement.id && (workoutSets[m.id]?.length ?? 0) < m.sets);
    if (next) setCurrentTrainingMovement(next.id);
  }

  const closeoutDebrief = isPostSession
    ? buildDebrief({
        accuracy: closeoutAccuracy,
        logAccuracy: persistedLogAccuracy,
        sessionCompletion: persistedSessionCompletion,
        state: liveState,
        workoutSets,
        workoutEndDate: sessionEndDate,
        primaryGoal: profile.goal ?? "",
        sleepTime: session.schedulePlan.sleepTime,
        movements: activeMovements,
      })
    : null;
  const loggedMovements = activeMovements.filter((m) => (workoutSets[m.id]?.length ?? 0) > 0);
  const closeoutRecords = isPostSession
    ? detectSessionPRs(
        historyBeforeSession,
        loggedMovements.map((m) => ({ movementName: m.name, sets: (workoutSets[m.id] ?? []).map((set) => ({ load: set.load, reps: set.reps })) })),
      ).map((pr) => pr.line)
    : [];
  const nextTrainingDay = weeklyPlan.find((d) => d.dayIndex > todayIndex && !d.recovery) ?? null;

  return (
    <StillMotionProvider still={stillMotion}>
    <ViewShell
      label="Training"
      title="Reserve Training Command"
      icon={Dumbbell}
      accentColor={GOLD}
      roomHero
      disclaimer="THE RESERVE METHOD provides coaching and training tracking only. Not medical advice. Follow clinician guidance. Stop with pain, dizziness, chest pain, or unusual symptoms."
    >
      <div id="training-room-top" className="scroll-mt-4">
        <TrainingRoomHero
          whisper={`${getGreeting(now?.getHours() ?? 18, profile.name, tone).greeting} · ${formatClock(now)}`}
          statement={heroCopy.statement}
          accent={heroCopy.accent}
          source={programLine.text}
          readiness={heroReadiness}
          lead={heroLead}
          onLogCheckIn={() => setActiveView("recovery")}
          metric={heroMetric}
          metricEmpty={activeSession.kind === "recovery" ? "Recovery day" : activeSession.kind === "activity" ? "Activity day" : "No session queue yet"}
          primary={heroPrimary}
          sheen={!stillMotion}
        />
      </div>

      {/* LIVE: the cockpit comes first — what the member needs between sets. */}
      {isLive && generationOutOfDate && (
        <GlassPanel accent={GOLD} phone="flush">
          <section aria-label="Session change" data-training="generation-change" className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-[13px] leading-[1.5] text-white/75">
              <span className="font-semibold text-[#f2eee6]">
                {sessionGeneration?.programDayId ? "Your program day changed." : "Your training architecture changed."}
              </span>{" "}
              {liveState.totalLogged === 0
                ? `This session was built from ${sessionGeneration?.splitTitle ?? "the earlier day"}. No sets are logged yet.`
                : "This session stays exactly as built. The change applies next time."}
            </p>
            <div className="flex flex-wrap gap-2">
              {liveState.totalLogged === 0 && (
                <ReserveButton tier="secondary" size="sm" onClick={handleRebuildSession}>Rebuild Today&apos;s Session</ReserveButton>
              )}
              <ReserveButton tier="quiet" size="sm" onClick={acknowledgeGenerationChange}>
                {liveState.totalLogged === 0 ? "Apply Next Session" : "Understood"}
              </ReserveButton>
            </div>
          </section>
        </GlassPanel>
      )}

      {isLive && currentMovement && (
        <LiveCockpit
          movement={currentMovement}
          position={Math.max(1, activeMovements.findIndex((m) => m.id === currentMovement.id) + 1)}
          movementCount={activeMovements.length}
          history={workoutSets[currentMovement.id] ?? []}
          lastLoggedAt={lastLoggedAt}
          exposure={historyForMovement(movementHistory, currentMovement.name)}
          next={cockpitNext}
          substitution={latestSubstitution?.movementId === currentMovement.id ? latestSubstitution : null}
          manualSelection={session.manualMovementSelection}
          canSkip={canSkipCurrent}
          onLog={() => { setCurrentTrainingMovement(currentMovement.id); setLoggerMovement(currentMovement); }}
          onSwap={() => setSubMovement(currentMovement)}
          onSkip={handleSkipCurrent}
          onEnd={handleEndWorkoutAttempt}
          onOpenQueue={() => setQueueOpen(true)}
          onOpenCoaching={() => setCoachingOpen(true)}
          confirm={setConfirm}
          sheen={!stillMotion}
        />
      )}

      {/* AFTER: the close-out — the numbers that matter, and what is next. */}
      {isPostSession && !staleLive && (
        <CloseOutPanel
          movementsLogged={loggedMovements.length}
          movementCount={activeMovements.length}
          volume={sessionVolume(loggedMovements.flatMap((m) => workoutSets[m.id] ?? []))}
          records={closeoutRecords}
          hasPriorHistory={loggedMovements.some((m) => Boolean(historyForMovement(historyBeforeSession, m.name)))}
          logAccuracy={persistedLogAccuracy}
          sessionCompletion={persistedSessionCompletion}
          progression={session.debriefSummary?.progressionDecision ?? closeoutDebrief?.progression.decision ?? null}
          meal={session.debriefSummary?.mealTimingGuidance ?? closeoutDebrief?.meal ?? null}
          nextSession={nextTrainingDay ? `${nextTrainingDay.dayLong} · ${nextTrainingDay.displayTitle}` : null}
          onMeal={() => setActiveView("nutrition")}
          sheen={!stillMotion}
        />
      )}

      {/* THE INSTRUMENT — today on one clock, then the week. One region, like Apex's timeline column.
          After close-out the session is a record: the close-out panel carries it, not the clock. */}
      {!isPostSession && (
      <div data-training="instrument" className="flex flex-col gap-4 md:gap-5">
      {/* Today's session on one clock. While live it holds completely still. */}
      <TrainingHorizon horizon={sessionHorizon} emptyMessage={horizonEmpty} live={isLive} flow={!stillMotion} actionFor={horizonAction} />

      {/* The week, from Training's own resolved plan. Idle only: live, the cockpit owns the screen. */}
      {!isLive && !staleLive && launchStage === "idle" && (
        <ReserveWeekRail
          week={railWeek}
          sleepTarget={scheduleProfile.sleepTarget ? formatTime12(scheduleProfile.sleepTarget) : "—"}
          onOpenTraining={() => scrollToSection("training-today")}
          now={now ?? FIXED_NOON}
        />
      )}
      </div>
      )}

      {staleLive ? (
        <StaleLiveSessionPanel
          kind={activeSession.kind === "recovery" ? "recovery" : activeSession.kind === "activity" ? "activity" : memberProgramRequiresTemplate || activeSession.kind === "missing" ? "missing" : "empty"}
          splitName={governingProgramDay?.day.title ?? selectedSplitRow.title}
          recovery={activeSession.recovery}
          displayName={governingProgramDay?.day.title ?? activeSession.displayName}
          focus={activeSession.focus}
          onReturnToPre={handleResumePre}
          onEndSession={() => recordTrainingCloseOut(() => closeOutTrainingSession("quick-closeout"), 0)}
          onBuildSession={() => setActiveView("mesocycle-planner")}
        />
      ) : isLive || isPostSession ? (
        /* DETAILS — live and after, the screen's one closed disclosure. */
        <div id="training-details" data-training="details" className="scroll-mt-4">
          <ReserveDisclosure summary={isLive ? "Session tools" : "Session record"} accent={GOLD}>
            <div className="flex flex-col gap-6 pt-2">
              {closeoutDebrief && <SessionReviewRows debrief={closeoutDebrief} />}
              <SupportPhaseRows
                slots={supportSlots}
                onAction={handleSupportAction}
                selectedCardio={selectedCardio}
                selectedRecovery={selectedRecovery}
                onOpenOptions={setOptionSheet}
                locked={isPostSession}
              />
              {isLive && (
                <section aria-label="Logging">
                  <ReserveSectionHeader label="Logging" accent={VIOLET} />
                  <div className="flex min-h-[48px] items-center gap-3">
                    <p className="min-w-0 flex-1 text-[13px] leading-[1.45] text-white/75">
                      Key sets only{" "}
                      <span className="text-white/50">· {session.minimalLogging ? "on · progression reads with less confidence" : "off · every set tracked"}</span>
                    </p>
                    <ReserveButton tier="secondary" size="sm" onClick={toggleMinimalLogging}>
                      {session.minimalLogging ? "Turn Off" : "Turn On"}
                    </ReserveButton>
                  </div>
                </section>
              )}
              {isLive && (
                <LoggedEntryRows schedulePlan={{ wakeTime: session.schedulePlan.wakeTime, sleepTime: session.schedulePlan.sleepTime, workoutTime: session.schedulePlan.workoutTime }} />
              )}
              <SessionExecutionLedgerPanel />
              {isPostSession && (
                <div className="flex flex-wrap items-center gap-3">
                  <ReserveButton tier="quiet" size="sm" icon={RefreshCw} onClick={handleResumePre}>Reset Day · New Session</ReserveButton>
                  <p className="text-[11.5px] text-white/45">Starts today over. Saved logs stay saved.</p>
                </div>
              )}
            </div>
          </ReserveDisclosure>
        </div>
      ) : launchStage === "pre-session" ? (
        /* The readiness step. Focused: the hero's Start Session and this check, nothing else. */
        <PreSessionCommandPanel
          now={now}
          workoutType={selectedSplitRow.title}
          checked={readinessChecked}
          setChecked={setReadinessChecked}
          onBeginPrimer={() => { setLaunchStage("primer"); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }}
          onBack={() => setLaunchStage("idle")}
        />
      ) : launchStage === "primer" ? (
        <MobilityPrimerCommand
          workoutType={selectedSplitRow.title}
          checked={primerChecked}
          setChecked={setPrimerChecked}
          onStartLive={handleStart}
          onBack={() => setLaunchStage("pre-session")}
        />
      ) : (
        <>
          {/* Speaks only when the week needs a decision: missed work, a reset, an override, a catch-up. */}
          <ScheduleFlexPanel
            weeklyPlan={weeklyPlan}
            todayIndex={todayIndex}
            selectedDayIndex={selectedDayIndex}
            sessionResetNote={sessionResetNote}
            onSelectDay={handleSelectSplitDay}
            onClearReset={() => { setSessionResetNote(null); clearTrainingResetSnapshot(); }}
            onUndo={handleUndoReset}
            canUndo={Boolean(trainingResetSnapshot)}
          />
          <TodaysSessionSection
            row={selectedSplitRow}
            todayRow={todayPlanRow}
            isCatchUp={isCatchUp}
            session={activeSession}
            movements={activeMovements}
            sessionTitle={governingProgramDay?.day.title ?? selectedSplitRow.displayTitle}
            hasPlan={hasPlan}
            sessionMode={sessionMode}
            onSessionMode={setSessionMode}
            depth={sessionDepthRead}
            cardioOptions={cardioOptions}
            recoveryOptions={recoveryOptions}
            onOpenOptions={setOptionSheet}
          />
        </>
      )}

      {/* The member's own cycle week, symptoms and symptom-check route — only when they logged a cycle or compound. */}
      <EnhancedRoomContext room="training" />

      {/* How training felt, sorted by estimated phase, from her own answers.
          Renders nothing without a logged period start. Replaces the separate
          Women's Training room. */}
      <TrainingPhasePanel />

      <TrainingResponseContext
        currentDate={localDateKey(selectedProgramDate)}
        currentWeek={executionWeekNumber}
        focusAreas={[
          activeSession.focus,
          selectedSplitRow.title,
          ...activeMovements.flatMap((movement) => [...movement.primaryMuscles, ...movement.secondaryMuscles]),
        ]}
        exercises={activeMovements.flatMap((movement) => [movement.id, movement.name])}
        movementPatterns={activeMovements.map((movement) => movement.target)}
        lowerBody={/lower|leg|quad|glute|hamstring|calf|posterior|hinge|squat/i.test([
          activeSession.focus,
          selectedSplitRow.title,
          ...activeMovements.flatMap((movement) => movement.primaryMuscles),
        ].join(" "))}
        frozen={isLive || staleLive || liveState.totalLogged > 0}
      />

      {/* Reserve Athlete Method — renders only when a Reserve Athlete protocol is active. */}
      <ReserveAthleteDayPanel />

      {/* DETAILS — the screen's one closed disclosure: how the week is built, and the last sessions.
          Set occasionally, not read every day. */}
      {!isLive && !isPostSession && !staleLive && launchStage === "idle" && (
        <div id="training-plan" data-training="details" className="scroll-mt-4">
          {/* One closed disclosure on the screen (the room's contract), and
              inside it each tool opens on its own: the five used to unfold as
              a single six-screen scroll. The split leads, already open. */}
          <ReserveDisclosure summary="Plan & split" accent={GOLD}>
            <div className="flex flex-col gap-2.5">
              <ReserveDisclosure summary="Split & rest day" defaultOpen>
                <div className="flex flex-col gap-4 md:gap-5">
                  <div id="training-split-architect" className="scroll-mt-4">
                    <SplitArchitectPanel />
                  </div>
                  {/* The week she already has — sits directly under the split
                      she chooses, because a split is only placeable against her
                      real commitments. Reports collisions; never moves a day. */}
                  <div id="training-week-planning" className="scroll-mt-4">
                    <WeekPlanningPanel
                      pausedTrack={dailyContext.pausedWomensTrack}
                      chosenLegDays={chosenSplitLegDays}
                      onClearSplit={clearSplitSystem}
                    />
                  </div>
                  {/* Train a different day of the week today (catch-up). The day itself is edited on the 7-day split. */}
                  <div className="max-w-sm">
                    <ReserveSelect
                      label="Today's session"
                      value={String(selectedDayIndex)}
                      options={weeklyPlan.map((d) => ({ value: String(d.dayIndex), label: `${d.dayIndex === todayIndex ? "Today" : d.dayLong} · ${d.displayTitle}` }))}
                      onChange={(v) => handleSelectSplitDay(Number(v))}
                    />
                  </div>
                </div>
              </ReserveDisclosure>
              {activeSession.kind === "lifting" && (
                <>
                  <ReserveDisclosure summary="Session intensity & depth">
                    <div className="flex flex-col gap-4 md:gap-5">
                      <SessionIntensityPanel session={activeSession} experience={trainingExperience} onSetExperience={setTrainingExperience} phase={phaseStory} />
                      <WorkoutDemandPanel requested={requestedDemand ?? demandGate.requested} effective={demandGate.effective} limited={demandGate.limited} reason={demandGate.reason} trainingAge={demandAge} onSelect={setWorkoutDemand} />
                    </div>
                  </ReserveDisclosure>
                  <ReserveDisclosure summary="Training intelligence">
                    <TrainingIntelligencePanel snapshot={trainingIntel} onNavigate={setActiveView} />
                  </ReserveDisclosure>
                </>
              )}
              <ReserveDisclosure summary="Your plans & profile">
                <div className="flex flex-col gap-4 md:gap-5">
                  <CustomPlansPanel todayIndex={todayIndex} />
                  <TrainingProfileCard profile={userTrainingProfile} onUpdate={updateUserTrainingProfile} completeness={trainingProfileCompleteness} />
                </div>
              </ReserveDisclosure>
              <ReserveDisclosure summary="Recent sessions">
                <RecentSessionRows />
              </ReserveDisclosure>
            </div>
          </ReserveDisclosure>
        </div>
      )}

      <TrainingOptionsSheet
        open={optionSheet}
        onClose={closeOptionSheet}
        cardioOptions={cardioOptions}
        onSelectCardio={handleSelectCardioOption}
        recoveryOptions={recoveryOptions}
        onSelectRecovery={handleSelectRecoveryOption}
        depthOptions={depthOptions}
        onSelectDepth={chooseDepth}
        block={trainingBlock}
        onHoldForBlock={holdForBlock}
        /* Compound Command hosts the Cycle tab — the member’s own record. */
        onOpenCycle={() => setActiveView("supplements")}
      />

      {/* MODALS */}
      {loggerMovement && (
        <SetLoggerSheet
          movement={loggerMovement}
          history={workoutSets[loggerMovement.id] ?? []}
          exposure={historyForMovement(movementHistory, loggerMovement.name)}
          ctx={ctx}
          onClose={closeLogger}
          onLogged={handleLogged}
          onEdit={handleEditSet}
          onUndo={handleUndo}
        />
      )}

      {subMovement && (
        <TacticalSubstitutionPanel
          movement={subMovement}
          onClose={() => setSubMovement(null)}
          onSelect={handleSubstitutionSelect}
          feedbackKinds={movementFeedback[subMovement.name]?.kinds}
          onFeedback={(kind) => logMovementFeedback(subMovement.name, kind)}
          onAvoid={() => setMovementPreference("avoid", subMovement.name, true)}
        />
      )}

      <MovementQueueSheet
        open={queueOpen}
        onClose={closeQueue}
        movements={activeMovements}
        currentId={currentMovement?.id ?? null}
        workoutSets={workoutSets}
        onSelect={handleSelectMovement}
      />
      <CoachingSheet open={coachingOpen} onClose={closeCoaching} movement={currentMovement} />

      {notReadyOpen && (
        <NotReadyModal
          sessionTitle={selectedSplitRow.displayTitle}
          weeklyPlan={weeklyPlan}
          todayIndex={todayIndex}
          onNotReady={handleNotReady}
          onReschedule={handleReschedule}
          onSwitchSession={handleSwitchSession}
          onSaveNote={handleSaveNote}
          onCancel={() => setNotReadyOpen(false)}
        />
      )}

      {endModalOpen && (
        <EndWorkoutModal onClose={() => setEndModalOpen(false)} onConfirm={handleEndWorkout} />
      )}
    </ViewShell>
    </StillMotionProvider>
  );
}
