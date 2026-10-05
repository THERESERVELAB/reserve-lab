/* ════════════════════════════════════════════════════════════════════════
   MEMBER INTELLIGENCE CONTRACT — the one member truth every engine reads.

   This is a PURE DERIVATION over the athlete store's canonical slices — not
   a parallel store, not a second copy. Zustand remains the responsive local
   cache and the cloud remains the authenticated source of truth (see
   lib/sync/state-contract.ts). Engines and screens consume this contract
   instead of inventing independent defaults, so onboarding answers,
   schedule, protocol, training history, and preferences stay one system.

   Extension points land with their features and are typed here first:
   workout-demand (Personal Command), pain observations (live feedback),
   nutrition calibration (Fuel Command), chapter/context (onboarding).
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";

import {
  useAthleteDashboardStore,
  type AthleteProfile,
  type BloodworkLogRecord,
  type SessionIntelligenceCard,
} from "@/lib/athlete-store";
import type { ActiveProtocol } from "@/lib/protocol/library";
import type { MemberScheduleProfile } from "@/lib/schedule/types";
import {
  buildMealPlan,
  detectSleepConflict,
  localScheduleDateKey,
  resolveTrainingScheduleContext,
  type PlannedMeal,
} from "@/lib/schedule/engine";
import { scheduleContradictions, type ScheduleContradiction } from "@/lib/schedule/derive";
import { resolveGamePlanWeek, type GamePlanWeek } from "@/lib/training/game-plan";
import { defaultWorkoutDemand, type WorkoutDemandLevel } from "@/lib/training/workout-demand";
import type { ProgramDefinition, ProgramOperatingMode } from "@/lib/program/types";

/* ─── Contract shape ──────────────────────────────────────────────────────── */

export type MemberIdentity = {
  name: string;
  /** "male" | "female" | other coaching-profile values; null pre-onboarding. */
  genderIdentity: string | null;
  /** Current Chapter (single primary identity) — set by onboarding. */
  currentChapter: string | null;
  /** Life Context modifiers (parent, traveler, masters-50 …). */
  lifeContext: string[];
  trainingAge: string; // beginner | intermediate | advanced persona scale
  onboardingComplete: boolean;
};

export type MemberGoals = {
  primaryGoal: string;
  goalStack: string[];
  physiquePriorities: string[]; // focus zones / muscle priorities
  weakPoints: string[];
  /** Event or deadline the programming aims at (ISO date) — null if none. */
  eventDate: string | null;
};

export type MemberArchitecture = {
  /** Saved split-system key ("ppl", custom id, …). */
  splitKey: string | null;
  splitName: string;
  trainingDaysPerWeek: number;
  /** Member's chosen workout-demand tier (Personal Command). */
  workoutDemand: WorkoutDemandLevel;
  activeCustomPlanId: string | null;
  sessionDurationMin: number | null;
};

export type MemberScheduleTruth = {
  profile: MemberScheduleProfile;
  meals: PlannedMeal[];
  sleepConflict: ReturnType<typeof detectSleepConflict>;
  contradictions: ScheduleContradiction[];
};

export type MemberContract = {
  identity: MemberIdentity;
  goals: MemberGoals;
  architecture: MemberArchitecture;
  program: {
    operatingMode: ProgramOperatingMode;
    active: ProgramDefinition | null;
  };
  schedule: MemberScheduleTruth;
  /** Equipment + facility environment. */
  environment: {
    gymEnvironment: string | null;
    configured: boolean;
    facilities: string[];
  };
  /** Movement-level intelligence: preferences, exclusions, reported feedback. */
  movement: {
    preferences: Record<string, unknown>;
    feedback: Record<string, unknown>;
  };
  /** Recovery history the engines may read (observational). */
  recovery: {
    sleepLogCount: number;
    lastSleepLog: string | null;
    hydrationLogCount: number;
  };
  /** Workout + exercise history. */
  training: {
    sessionHistory: SessionIntelligenceCard[];
    liveSessionActive: boolean;
  };
  /** Protocol + mesocycle position (real weeks, never invented). */
  protocol: {
    active: ActiveProtocol | null;
    week: GamePlanWeek;
  };
  /** Biomarker history (log-only). */
  biomarkers: {
    panelCount: number;
    lastPanelDate: string | null;
    records: BloodworkLogRecord[];
  };
  profile: AthleteProfile;
};

/* ─── Derivation ─────────────────────────────────────────────────────────── */

type StoreState = ReturnType<typeof useAthleteDashboardStore.getState>;

export function deriveMemberContract(s: StoreState, now: Date = new Date()): MemberContract {
  const cp = s.profile.coachingProfile;
  const scheduleProfile = s.scheduleProfile;
  const trainingScheduleContext = resolveTrainingScheduleContext(s.trainingOverrides, localScheduleDateKey(now));
  const week = resolveGamePlanWeek(s.activeProtocol, s.onboarding.completedAt ?? null, now);
  const sleepLogs = s.recoveryCommand.sleepLogs;
  const lastBloodwork = s.bloodworkLogs.length
    ? [...s.bloodworkLogs].sort((a, b) => b.testDate.localeCompare(a.testDate))[0]
    : null;

  return {
    identity: {
      name: s.profile.name,
      genderIdentity: cp?.genderIdentity ?? null,
      currentChapter: cp?.currentChapter ?? null,
      lifeContext: cp?.lifeContext ?? cp?.lifeStages ?? [],
      trainingAge: s.trainingExperience ?? s.profile.persona,
      onboardingComplete: s.onboarding.status === "complete",
    },
    goals: {
      primaryGoal: s.profile.goal,
      goalStack: cp?.goalStack ?? [],
      physiquePriorities: s.profile.focusZones ?? [],
      weakPoints: (s.physiqueCommand.weakPoints ?? []).map(String),
      eventDate: s.activeProtocol?.targetDate ?? null,
    },
    architecture: {
      splitKey: s.splitSystem?.key ?? null,
      splitName: s.profile.trainingStyle || "Reserve Method",
      trainingDaysPerWeek: scheduleProfile.trainingDaysPerWeek,
      workoutDemand:
        s.workoutDemand ??
        defaultWorkoutDemand(
          (["beginner", "intermediate", "advanced"].includes(s.trainingExperience)
            ? s.trainingExperience
            : "intermediate") as "beginner" | "intermediate" | "advanced",
        ),
      activeCustomPlanId: s.activeCustomPlanId,
      sessionDurationMin: s.userTrainingProfile.sessionDurationMin ?? null,
    },
    program: {
      operatingMode: s.programOperatingMode,
      active: s.programs.find((program) => program.id === s.activeProgramId) ?? null,
    },
    schedule: {
      profile: scheduleProfile,
      meals: buildMealPlan(scheduleProfile, trainingScheduleContext),
      sleepConflict: detectSleepConflict(scheduleProfile, trainingScheduleContext),
      contradictions: scheduleContradictions(scheduleProfile),
    },
    environment: {
      gymEnvironment: s.userTrainingProfile.gymEnvironment ?? null,
      configured: Boolean(s.userTrainingProfile.configured),
      facilities: (s.reserveAthleteFacilities ?? []).map(String),
    },
    movement: {
      preferences: (s.movementPreferences ?? {}) as Record<string, unknown>,
      feedback: (s.movementFeedback ?? {}) as Record<string, unknown>,
    },
    recovery: {
      sleepLogCount: sleepLogs.length,
      lastSleepLog: sleepLogs.length ? sleepLogs[sleepLogs.length - 1].date : null,
      hydrationLogCount: s.recoveryCommand.hydrationLogs.length,
    },
    training: {
      sessionHistory: s.trainingSession.sessionHistory ?? [],
      liveSessionActive: s.trainingSession.sessionMode === "live",
    },
    protocol: {
      active: s.activeProtocol,
      week,
    },
    biomarkers: {
      panelCount: s.bloodworkLogs.length,
      lastPanelDate: lastBloodwork?.testDate ?? null,
      records: s.bloodworkLogs,
    },
    profile: s.profile,
  };
}

/** React hook — derive the contract from live store state. Memoized against
    the store snapshot so it never returns a fresh object mid-render. */
export function useMemberContract(): MemberContract {
  const state = useAthleteDashboardStore();
  return useMemo(() => deriveMemberContract(state as StoreState), [state]);
}
