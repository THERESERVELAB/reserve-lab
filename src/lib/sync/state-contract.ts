/**
 * Cloud-safe member state contract.
 *
 * Single source of truth for WHICH slices of the athlete store are member
 * data. The Zustand `persist` partialize and the cloud sync engine both pick
 * exactly these keys, so localStorage and public.member_state can never
 * drift apart.
 *
 * Explicitly excluded (transient UI state, never synced): open modal/drawer
 * state, animation state, temporary filters, loading flags, dev/preview keys,
 * secrets, and binary image contents (photos are metadata-only in state).
 */

export const MEMBER_STATE_KEYS = [
  "profile",
  "subscriptionTier",
  "onboarding",
  "settings",
  "engagement",
  "trainingSession",
  "nutritionPrefs",
  "setupProfile",
  "womens",
  "modulePreferences",
  "recoveryCommand",
  "scheduleProfile",
  "physiqueCommand",
  "userTrainingProfile",
  "activeProtocol",
  /* The complete projected program plus the recurring activities that shaped
     it. Persisted so applied revisions and program history survive a refresh
     instead of being replaced by a pristine regeneration. */
  "programHorizon",
  /* Response Model. Insights are rebuilt from the execution ledger, but the
     athlete's decisions, the insight lifecycle history, and the response event
     log cannot be rederived and must persist. */
  "responseModel",
  "splitSystem",
  /* The member's own day changes — every Friday / just this Friday. Persisted
     and cloud-synced so a change made on one device follows the member, and
     reset at the account boundary like every other member slice. */
  "splitCustomization",
  /* What a class or run actually trained, in the member's own words. It is a
     training record, not a derivation — it cannot be recomputed. */
  "activityCoverage",
  "activityStack",
  "weeklyCommitments",
  "doubleDay",
  "activitySport",
  "reserveAthleteFacilities",
  "trainingExperience",
  "workoutDemand",
  "trainingBlockIntent",
  "coreTiming",
  "movementPreferences",
  "movementFeedback",
  "bloodworkLogs",
  /* The member's stated cycle plans, their safety acknowledgement and the
     red-flag symptoms they reported. Health data: synced to the member's own
     row only, and reset at the account boundary like every member slice. */
  "cyclePeriods",
  "safetyAcknowledgement",
  "redFlagReports",
  /* Cycle review: the member's goal per cycle, weekly check-ins (vitals and
     symptoms) and clinician summaries they chose to save. Same health-data
     handling as the cycle slices above. */
  "cycleGoals",
  "cycleCheckIns",
  "cycleReviewSnapshots",
  /* Supplements the member chose to track, with their own entered details. */
  "supportPlan",
  /* Timeline: change history written by the actions that change a plan, and
     the member's own dated notes and N=1 observations. */
  "changeHistory",
  "timelineNotes",
  "observations",
  "trainingOverrides",
  "trainingOverrideHistory",
  "customPlans",
  "activeCustomPlanId",
  "customMeals",
  /* The member's own meal plan — it replaces the generated fuel plan while active. */
  "memberMealPlans",
  "activeMemberMealPlanId",
  "hydrationFavorites",
  "hydrationDrinkLogs",
  "completedChallengeKeys",
  /* Build Your Player — member-built lifestyle systems (v15). */
  "lifestyleSchedules",
  "activeLifestyleScheduleId",
  "weekAssignments",
  "actualWeeks",
  "customWorkoutTemplates",
  "movementSelections",
  /* Program ownership — bounded v17 histories and import review state. */
  "programOperatingMode",
  "programs",
  "activeProgramId",
  "programDayVersions",
  "programDayOverrides",
  "programRecommendationPreferences",
  "programRecommendationDecisions",
  "importedProgramDrafts",
  "nutritionOwnership",
  /* Sync bookkeeping: per-slice and per-record change clocks plus tombstones
     for removed records. Lets two devices merge record-by-record instead of
     one overwriting the other (member-merge.ts). */
  "syncLedger",
] as const;

export type MemberStateKey = (typeof MEMBER_STATE_KEYS)[number];

/**
 * Version of the cloud payload envelope. Bump when the shape of the envelope
 * (not the store itself) changes. Store-level migrations keep running through
 * the athlete store's own versioned `migrate` pipeline (currently v18).
 */
export const CLOUD_SCHEMA_VERSION = 2;

/** The jsonb payload written to public.member_state.state. */
export type CloudMemberStateEnvelope = {
  /** Envelope shape version (CLOUD_SCHEMA_VERSION). */
  envelope: number;
  /** The athlete store persist version the slices were serialized at. */
  storeVersion: number;
  /** ISO timestamp of the local change that produced this payload. */
  serializedAt: string;
  /** The member slices, exactly the MEMBER_STATE_KEYS picks. */
  slices: Record<string, unknown>;
  /** Standalone offline logging maps that predate the Zustand member store. */
  logs?: import("@/lib/logging/store").LocalLogSnapshot;
};

/** Pick only the member-data slices from a full store state. */
export function pickMemberState<T extends Record<string, unknown>>(
  state: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of MEMBER_STATE_KEYS) {
    if (key in state) out[key] = state[key];
  }
  return out;
}

/**
 * Whether a serialized member state represents real member progress worth
 * protecting (vs. a fresh default store). Used by the first-login migration
 * to guarantee we never overwrite populated local progress with an empty
 * cloud row, and vice versa.
 */
export function hasMeaningfulProgress(slices: Record<string, unknown>): boolean {
  const onboarding = slices.onboarding as
    | { status?: string; draft?: { answers?: Record<string, unknown> } | null }
    | undefined;
  if (onboarding?.status === "complete") return true;
  // A partially-answered wizard is real member work. Without this, a member who
  // starts onboarding on one device and opens another would look "empty" to the
  // merge policy and have their draft overwritten by a pristine store.
  if (onboarding?.draft && Object.keys(onboarding.draft.answers ?? {}).length > 0) return true;

  const training = slices.trainingSession as
    | {
        sessionHistory?: unknown[];
        trainingJournal?: unknown[];
        enhancementLog?: unknown[];
        executionRecord?: unknown;
        executionHistory?: unknown[];
        weekExecutionSummaries?: unknown[];
        decisionHistory?: unknown[];
      }
    | undefined;
  if ((training?.sessionHistory?.length ?? 0) > 0) return true;
  if ((training?.trainingJournal?.length ?? 0) > 0) return true;
  if ((training?.enhancementLog?.length ?? 0) > 0) return true;
  if (training?.executionRecord) return true;
  if ((training?.executionHistory?.length ?? 0) > 0) return true;
  if ((training?.weekExecutionSummaries?.length ?? 0) > 0) return true;
  if ((training?.decisionHistory?.length ?? 0) > 0) return true;

  const recovery = slices.recoveryCommand as
    | { sleepLogs?: unknown[]; hydrationLogs?: unknown[]; mobilityLogs?: unknown[]; stressCheckIns?: unknown[]; stepLogs?: unknown[] }
    | undefined;
  /* Every kind of recovery log is real member work: a member who has only logged
     mobility or check-ins must never look empty to the first-login merge. */
  if ((recovery?.sleepLogs?.length ?? 0) > 0) return true;
  if ((recovery?.hydrationLogs?.length ?? 0) > 0) return true;
  if ((recovery?.mobilityLogs?.length ?? 0) > 0) return true;
  if ((recovery?.stressCheckIns?.length ?? 0) > 0) return true;
  if ((recovery?.stepLogs?.length ?? 0) > 0) return true;

  const physique = slices.physiqueCommand as
    | { entries?: unknown[]; photoCheckIns?: unknown[] }
    | undefined;
  if ((physique?.entries?.length ?? 0) > 0) return true;
  if ((physique?.photoCheckIns?.length ?? 0) > 0) return true;

  if ((slices.customPlans as unknown[] | undefined)?.length) return true;
  if ((slices.customMeals as unknown[] | undefined)?.length) return true;
  if ((slices.memberMealPlans as unknown[] | undefined)?.length) return true;
  if ((slices.lifestyleSchedules as unknown[] | undefined)?.length) return true;
  if ((slices.customWorkoutTemplates as unknown[] | undefined)?.length) return true;
  if ((slices.programs as unknown[] | undefined)?.length) return true;
  if ((slices.programDayOverrides as unknown[] | undefined)?.length) return true;
  if ((slices.importedProgramDrafts as unknown[] | undefined)?.length) return true;
  if ((slices.hydrationDrinkLogs as unknown[] | undefined)?.length) return true;
  if ((slices.bloodworkLogs as unknown[] | undefined)?.length) return true;
  if ((slices.completedChallengeKeys as unknown[] | undefined)?.length) return true;
  if (slices.activeProtocol) return true;

  return false;
}
