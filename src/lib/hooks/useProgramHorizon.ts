"use client";

/* ════════════════════════════════════════════════════════════════════════
   useProgramHorizon — the single source of truth for the projected program.

   Personal Command, Program Horizon, the 7-Day Split, Training Command,
   Nutrition, Recovery, and Schedule all read this hook, so no surface can
   render a different protocol from the one actually generating the week.

   The horizon is derived from the SAME athlete snapshot every time, and
   applied revisions are persisted, so a refresh restores the athlete's real
   program rather than regenerating a pristine one.
   ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { deriveProgrammingProfile, type AthleteProgrammingProfile } from "@/lib/athlete/programming-profile";
import type { AthleteContextSnapshot } from "@/lib/athlete/snapshot";
import { snapshotFromStore, type AthleteStoreSlice } from "@/lib/horizon/from-store";
import { resolveProgramAuthority, type ActiveProgramSource } from "@/lib/horizon/active-program";
import { applyActivityToHorizon, previewActivity } from "@/lib/horizon/revise";
import type { ProgramHorizon, ProgramRevision } from "@/lib/horizon/types";
import { rankProtocolSuitability, type SuitabilityRanking } from "@/lib/training/protocol-suitability";
import type { AthleteActivity } from "@/lib/schedule/activity-reconciliation";

export type ProgramHorizonResult = {
  snapshot: AthleteContextSnapshot;
  profile: AthleteProgrammingProfile;
  ranking: SuitabilityRanking;
  /** Null when no protocol is active — the surfaces show an honest empty state. */
  horizon: ProgramHorizon | null;
  currentWeek: number;
  source: ActiveProgramSource;
  assumptions: string[];
  /** Preview an activity against the live horizon without changing anything. */
  preview: (activity: AthleteActivity) => ReturnType<typeof previewActivity> | null;
  /** Apply a confirmed activity decision and persist the revision. */
  applyActivity: (activity: AthleteActivity, athleteConfirmed: boolean) =>
    { blocked: boolean; blockedReason?: string; revision: ProgramRevision | null };
};

export function useProgramHorizon(now?: Date): ProgramHorizonResult {
  const profileState = useAthleteDashboardStore((s) => s.profile);
  const setupProfile = useAthleteDashboardStore((s) => s.setupProfile);
  const nutritionPrefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const userTrainingProfile = useAthleteDashboardStore((s) => s.userTrainingProfile);
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const physiqueCommand = useAthleteDashboardStore((s) => s.physiqueCommand);
  const activityStack = useAthleteDashboardStore((s) => s.activityStack);
  const activitySport = useAthleteDashboardStore((s) => s.activitySport);
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const recoveryAggression = useAthleteDashboardStore((s) => s.profile.recoveryAggression);
  const recoveryCommand = useAthleteDashboardStore((s) => s.recoveryCommand);

  const horizonState = useAthleteDashboardStore((s) => s.programHorizon);
  const setProgramHorizon = useAthleteDashboardStore((s) => s.setProgramHorizon);
  const recordReserveDecision = useAthleteDashboardStore((s) => s.recordReserveDecision);
  const recordPlannedSessionOutcome = useAthleteDashboardStore((s) => s.recordPlannedSessionOutcome);
  const refreshWeekExecutionSummary = useAthleteDashboardStore((s) => s.refreshWeekExecutionSummary);

  const storeSlice = useMemo<AthleteStoreSlice>(
    () => ({
      profile: {
        goal: profileState.goal,
        bodyFat: profileState.bodyFat,
        experienceLevel: profileState.experienceLevel,
        weakPoints: profileState.weakPoints,
        recoveryAggression,
        trainingStyle: profileState.trainingStyle,
      },
      setupProfile,
      nutritionPrefs: { bodyweightLb: nutritionPrefs.bodyweightLb },
      userTrainingProfile: {
        gymEnvironment: userTrainingProfile.gymEnvironment,
        trainingLevel: userTrainingProfile.trainingLevel,
        sessionDurationMin: userTrainingProfile.sessionDurationMin ?? undefined,
        movementLimitations: userTrainingProfile.movementLimitations ?? undefined,
        equipment: userTrainingProfile.equipment ?? undefined,
      },
      scheduleProfile: {
        preferredTrainingStart: scheduleProfile?.preferredTrainingStart,
        sleepTarget: scheduleProfile?.sleepTarget,
        wakeTime: scheduleProfile?.wakeTime,
      },
      physiqueCommand: { weakPoints: physiqueCommand.weakPoints ?? undefined },
      recoveryCommand: {
        averageSleepHours: recoveryCommand.sleepLogs.length
          ? Math.round((recoveryCommand.sleepLogs.reduce((sum, log) => sum + log.hours, 0) / recoveryCommand.sleepLogs.length) * 10) / 10
          : undefined,
      },
      activityStack,
      activitySport,
      recurringActivities: horizonState.recurringActivities,
      nutritionPhase: activeProtocol?.nutritionFocus ?? null,
    }),
    [
      profileState.goal, profileState.bodyFat, profileState.experienceLevel, profileState.weakPoints,
      profileState.trainingStyle, recoveryAggression, setupProfile, nutritionPrefs.bodyweightLb,
      userTrainingProfile, scheduleProfile?.preferredTrainingStart, scheduleProfile?.sleepTarget,
      scheduleProfile?.wakeTime, physiqueCommand.weakPoints,
      recoveryCommand.sleepLogs, activityStack, activitySport, horizonState.recurringActivities, activeProtocol?.nutritionFocus,
    ],
  );

  const snapshot = useMemo(() => snapshotFromStore(storeSlice), [storeSlice]);
  const profile = useMemo(() => deriveProgrammingProfile(snapshot), [snapshot]);
  const ranking = useMemo(() => rankProtocolSuitability(snapshot, profile), [snapshot, profile]);

  const authority = useMemo(
    () => resolveProgramAuthority({
      storedHorizon: horizonState.horizon,
      activeProtocol,
      snapshot,
      profile,
      recommendedProtocolId: ranking.recommended.protocolId,
      resolveExtras: { activityStack, activitySport, recoveryPreference: recoveryAggression },
      now,
    }),
    [activeProtocol, horizonState.horizon, snapshot, profile, ranking.recommended.protocolId, activityStack, activitySport, recoveryAggression, now],
  );

  // The resolver's legacy migration is deterministic across consumers. The
  // first mounted consumer persists it; subsequent consumers then read the
  // same stored object and resolve as program-horizon.
  useEffect(() => {
    if (!authority.pendingPersistence) return;
    if (horizonState.horizon?.programId === authority.pendingPersistence.programId) return;
    setProgramHorizon(authority.pendingPersistence);
    recordReserveDecision({
      id: `decision:migration:horizon:${authority.pendingPersistence.programId}`,
      createdAt: authority.pendingPersistence.generatedAt,
      category: "migration",
      source: "system-migration",
      programId: authority.pendingPersistence.programId,
      observation: "An active legacy protocol did not yet have a persisted Program Horizon.",
      decision: "Generated and persisted the deterministic Horizon authority.",
      reason: "Live consumers require one program, week, phase, and revision source.",
      athleteDecision: "not-required",
    });
  }, [authority.pendingPersistence, horizonState.horizon?.programId, recordReserveDecision, setProgramHorizon]);

  const horizon = authority.horizon;
  const currentWeek = authority.resolution?.currentWeekNumber ?? 1;

  const preview = useCallback(
    (activity: AthleteActivity) => (horizon ? previewActivity(horizon, activity, now) : null),
    [horizon, now],
  );

  const applyActivity = useCallback(
    (activity: AthleteActivity, athleteConfirmed: boolean) => {
      if (!horizon) return { blocked: true, blockedReason: "No active program to adjust.", revision: null };
      const result = applyActivityToHorizon({ horizon, activity, athleteConfirmed, now });
      if (!result.blocked) {
        setProgramHorizon(
          result.horizon,
          activity.recurrence !== "one-time" ? activity : undefined,
        );
        if (result.revision) {
          recordReserveDecision({
            id: `decision:activity:${result.revision.id}`,
            createdAt: result.revision.createdAt,
            category: "activity-reconciliation",
            source: activity.source === "coach-added" ? "coach" : activity.source === "reserve" ? "reserve" : "athlete",
            programId: horizon.programId,
            observation: `${activity.title} was evaluated against the active Program Horizon.`,
            decision: result.proposal.recommendation,
            reason: result.revision.reason,
            affectedWeekNumbers: result.revision.affectedWeeks,
            confidence: result.proposal.riskLevel === "low" ? "high" : "moderate",
            athleteDecision: athleteConfirmed ? "accepted" : "not-required",
            before: result.revision.before,
            after: result.revision.after,
            activity: {
              activityId: activity.id,
              revisionId: result.revision.id,
              status: "accepted",
              effectiveWeek: result.revision.effectiveWeek,
              programStartDate: horizon.startDate,
              snapshot: activity,
            },
          });
          recordReserveDecision({
            id: `decision:week-revision:${result.revision.id}`,
            createdAt: result.revision.createdAt,
            category: "week-revision",
            source: result.revision.source,
            programId: horizon.programId,
            observation: `Future program weeks ${result.revision.affectedWeeks.join(", ")} required an explicit revision record.`,
            decision: "Preserved the original projection and stored the revised weeks separately.",
            reason: result.revision.reason,
            affectedWeekNumbers: result.revision.affectedWeeks,
            athleteDecision: athleteConfirmed ? "accepted" : "not-required",
            before: result.revision.before,
            after: result.revision.after,
          });

          if (result.proposal.resolvedRelationship === "replace") {
            const weekNumber = result.revision.effectiveWeek;
            const beforeWeek = result.revision.before.find((week) => week.weekNumber === weekNumber) ?? result.revision.before[0];
            const dayIndex = activity.dayOfWeek ?? 0;
            const plannedDay = beforeWeek?.weeklyStructure[dayIndex];
            if (beforeWeek && plannedDay) {
              recordPlannedSessionOutcome({
                snapshot: {
                  architectureId: horizon.architectureVersion,
                  architectureVersion: horizon.architectureVersion,
                  architectureName: horizon.protocolName,
                  mesocycleId: `${horizon.programId}:W${weekNumber}`,
                  generatedAt: result.revision.createdAt,
                  generationReason: "today-override",
                  splitTitle: plannedDay.title,
                  movements: [],
                  horizonProgramId: horizon.programId,
                  horizonProtocolId: horizon.protocolId,
                  horizonArchitectureVersion: horizon.architectureVersion,
                  horizonWeekNumber: weekNumber,
                  horizonPhaseId: beforeWeek.phaseId,
                  horizonDayIndex: dayIndex,
                  horizonDayTitle: plannedDay.title,
                  horizonRevisionIds: [result.revision.id],
                  horizonSource: "program-horizon",
                  horizonWeekSnapshot: beforeWeek,
                },
                calendarDate: activity.date ?? result.revision.createdAt.slice(0, 10),
                outcome: "replaced",
                reason: result.revision.reason,
                replacementActivityId: activity.id,
                adjustmentRevisionId: result.revision.id,
                reconciliationProposal: result.proposal.recommendation,
                athleteConfirmed,
                nutritionAdjustment: result.proposal.nutritionChanges,
                recoveryAdjustment: result.proposal.recoveryChanges,
                affectedFutureDays: result.proposal.affectedDays,
              });
            }
          }
          for (const weekNumber of result.revision.affectedWeeks) {
            const affectedWeek = result.horizon.weeks.find((week) => week.weekNumber === weekNumber);
            if (affectedWeek) {
              refreshWeekExecutionSummary(
                horizon.programId,
                weekNumber,
                affectedWeek.weeklyStructure.filter((day) => !day.recovery).length,
              );
            }
          }
        }
      } else if (!athleteConfirmed) {
        recordReserveDecision({
          id: `decision:activity-declined:${horizon.programId}:${activity.id}:${now?.toISOString() ?? "current"}`,
          category: "athlete-decision",
          source: "athlete",
          programId: horizon.programId,
          observation: `${activity.title} required athlete confirmation before changing the program.`,
          decision: "The proposed activity reconciliation was not applied.",
          reason: result.blockedReason ?? "Athlete confirmation was not provided.",
          affectedWeekNumbers: result.revision?.affectedWeeks,
          athleteDecision: "declined",
          activity: {
            activityId: activity.id,
            status: "declined",
            programStartDate: horizon.startDate,
            snapshot: activity,
          },
        });
      }
      return { blocked: result.blocked, blockedReason: result.blockedReason, revision: result.revision };
    },
    [horizon, now, recordPlannedSessionOutcome, recordReserveDecision, refreshWeekExecutionSummary, setProgramHorizon],
  );

  return {
    snapshot,
    profile,
    ranking,
    horizon,
    currentWeek,
    source: authority.source,
    assumptions: authority.assumptions,
    preview,
    applyActivity,
  };
}
