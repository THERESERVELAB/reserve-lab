/* ════════════════════════════════════════════════════════════════════════
   STORE → ATHLETE SNAPSHOT ADAPTER

   The one place that maps the athlete store's shape onto the snapshot input.
   Keeping it here means the snapshot builder, the programming profile, the
   suitability engine, and the horizon generator all stay pure and testable —
   and every surface reads the SAME derived athlete rather than assembling its
   own version.

   Nothing here invents data. A field the store does not hold is passed as
   null, which becomes an explicit assumption downstream.
   ════════════════════════════════════════════════════════════════════════ */

import type { AthleteActivity } from "@/lib/schedule/activity-reconciliation";
import {
  buildAthleteSnapshot,
  type AthleteContextSnapshot,
  type AthletePainRecord,
  type AthleteSnapshotInput,
  type GoalPriority,
  type RecoveryCapacityLevel,
} from "@/lib/athlete/snapshot";
import { sanitizeBodyweightLb } from "@/lib/profile/bodyweight";

/** The exact store fields the snapshot needs — nothing wider. */
export type AthleteStoreSlice = {
  profile: {
    name?: string;
    goal?: string;
    bodyFat?: string;
    experienceLevel?: string;
    weakPoints?: string[];
    recoveryAggression?: string;
    trainingStyle?: string;
  };
  setupProfile: {
    age?: number;
    sex?: "male" | "female" | "other";
    heightIn?: number;
    targetWeightLb?: number;
    baselineWeightLb?: number;
    trainingDaysPerWeek?: number;
    sessionDurationMin?: number;
    occupationLoad?: "sedentary" | "active" | "physical";
    targetTimelineWeeks?: number;
    weakPoints?: string[];
    equipmentAccess?: string;
    preferredSplit?: string;
    priorities?: string[];
  };
  nutritionPrefs?: { bodyweightLb?: number };
  userTrainingProfile?: {
    gymEnvironment?: string;
    trainingLevel?: string;
    sessionDurationMin?: number;
    movementLimitations?: string[];
    equipment?: string[];
  };
  scheduleProfile?: {
    /** "HH:MM" — the member's preferred training start. */
    preferredTrainingStart?: string;
    /** "HH:MM" — used with wakeTime to derive the real sleep window. */
    sleepTarget?: string;
    wakeTime?: string;
  };
  recoveryCommand?: {
    readinessScore?: number;
    restingHeartRate?: number;
    hrv?: number;
    /** Derived only from member-entered sleep logs, never from a target window. */
    averageSleepHours?: number;
  };
  physiqueCommand?: { weakPoints?: string[] };
  activityStack?: string | null;
  activitySport?: string | null;
  /** Recent bodyweight log entries, newest last. */
  recentWeights?: Array<{ date: string; weightLb: number }>;
  /** Recurring activities the athlete has told Reserve about. */
  recurringActivities?: AthleteActivity[];
  /** Logged strength markers, if any. */
  strengthMarkers?: Record<string, number>;
  /** Athlete-reported discomfort. Recorded, never interpreted. */
  currentPain?: AthletePainRecord[];
  /** Active nutrition phase label. */
  nutritionPhase?: string | null;
  athleteId?: string | null;
};

const RECOVERY_FROM_AGGRESSION: Record<string, RecoveryCapacityLevel> = {
  aggressive: "high",
  moderate: "moderate",
  conservative: "low",
};

/** Parse "12%" / "12" / "" into a number, or undefined. */
function parsePercent(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 2 && n < 70 ? n : null;
}

function goalPriority(slice: AthleteStoreSlice): GoalPriority {
  const priorities = slice.setupProfile.priorities ?? [];
  if (priorities.length === 1) return "single-focus";
  if (priorities.some((p) => /performance|athletic|strength|sport/i.test(p))) return "performance-led";
  return "balanced";
}

/**
 * Sleep window from the member's declared wake and sleep-target times.
 * This is their INTENDED window, not measured sleep — so it is only used
 * when nothing measured is available, and it is never presented as data
 * Reserve observed.
 */
export function sleepHoursFromWindow(sleepTarget?: string, wakeTime?: string): number | null {
  const parse = (t?: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec((t ?? "").trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  };
  const sleep = parse(sleepTarget);
  const wake = parse(wakeTime);
  if (sleep == null || wake == null) return null;
  const minutes = wake > sleep ? wake - sleep : 24 * 60 - sleep + wake;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return hours >= 3 && hours <= 12 ? hours : null;
}

/** Current body weight: the most recent logged weigh-in wins, then the
    nutrition bodyweight, then the onboarding baseline. */
function currentWeightLb(slice: AthleteStoreSlice): number | null {
  const logged = slice.recentWeights?.length
    ? slice.recentWeights[slice.recentWeights.length - 1].weightLb
    : null;
  return (
    sanitizeBodyweightLb(logged) ??
    sanitizeBodyweightLb(slice.nutritionPrefs?.bodyweightLb) ??
    sanitizeBodyweightLb(slice.setupProfile.baselineWeightLb)
  );
}

export function snapshotInputFromStore(slice: AthleteStoreSlice): AthleteSnapshotInput {
  const sp = slice.setupProfile;
  const utp = slice.userTrainingProfile ?? {};
  const weakPoints = [
    ...(slice.physiqueCommand?.weakPoints ?? []),
    ...(sp.weakPoints ?? []),
    ...(slice.profile.weakPoints ?? []),
  ].filter(Boolean);

  const equipment = utp.equipment?.length
    ? utp.equipment
    : sp.equipmentAccess
      ? [sp.equipmentAccess]
      : utp.gymEnvironment
        ? [utp.gymEnvironment]
        : null;

  const scheduleConstraints: string[] = [];
  if (slice.scheduleProfile?.preferredTrainingStart) {
    scheduleConstraints.push(`Trains around ${slice.scheduleProfile.preferredTrainingStart}`);
  }
  if (sp.targetTimelineWeeks) scheduleConstraints.push(`${sp.targetTimelineWeeks}-week target timeline`);

  return {
    athleteId: slice.athleteId ?? null,
    ageYears: sp.age ?? null,
    sex: sp.sex ?? null,
    heightIn: sp.heightIn ?? null,
    bodyWeightLb: currentWeightLb(slice),
    bodyFatPercent: parsePercent(slice.profile.bodyFat),

    primaryGoal: slice.profile.goal ?? null,
    secondaryGoals: sp.priorities ?? null,
    targetWeightLb: sp.targetWeightLb ?? null,
    goalPriority: goalPriority(slice),

    // Training age is not captured directly; the experience level carries it
    // and the snapshot builder derives the band from whichever is present.
    trainingAgeYears: null,
    experienceLevel: slice.profile.experienceLevel ?? utp.trainingLevel ?? null,
    currentSplit: slice.profile.trainingStyle ?? sp.preferredSplit ?? null,
    availableDays: sp.trainingDaysPerWeek ?? null,
    sessionDurationMinutes: utp.sessionDurationMin ?? sp.sessionDurationMin ?? null,
    preferredTrainingTime: slice.scheduleProfile?.preferredTrainingStart ?? null,
    strengthMarkers: slice.strengthMarkers ?? null,
    conditioningBackground: slice.activityStack ?? null,
    runningBackground: /run|marathon|track/i.test(slice.activitySport ?? "") ? slice.activitySport : null,
    exerciseRestrictions: utp.movementLimitations ?? null,
    weakPoints: weakPoints.length ? [...new Set(weakPoints)] : null,

    recoveryCapacity: RECOVERY_FROM_AGGRESSION[slice.profile.recoveryAggression ?? ""] ?? null,
    averageSleepHours: slice.recoveryCommand?.averageSleepHours ?? null,
    sleepConsistency: null,
    readinessScore: slice.recoveryCommand?.readinessScore ?? null,
    restingHeartRate: slice.recoveryCommand?.restingHeartRate ?? null,
    hrv: slice.recoveryCommand?.hrv ?? null,
    currentPain: slice.currentPain ?? null,
    injuryHistory: utp.movementLimitations ?? null,
    lifestyleDemand: sp.occupationLoad ?? null,

    nutritionPhase: slice.nutritionPhase ?? null,
    recentWeightsLb: slice.recentWeights ?? null,

    equipment,
    scheduleConstraints: scheduleConstraints.length ? scheduleConstraints : null,
    recurringActivities: slice.recurringActivities ?? null,
  };
}

export function snapshotFromStore(slice: AthleteStoreSlice, capturedAt?: string): AthleteContextSnapshot {
  return buildAthleteSnapshot({ ...snapshotInputFromStore(slice), capturedAt });
}
