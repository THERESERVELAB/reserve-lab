/**
 * The member collections the sync merge unions entity-by-entity.
 *
 * Every path here is a list (or map) of records the member creates, edits or
 * removes one at a time, or an append-only history. Each record has a stable
 * key: its `id`, or — where the store dedupes by something else — that
 * logical key (e.g. one adherence mark per compound, day and planned time).
 *
 * Deliberately NOT listed (decided per slice, newest slice wins):
 *  - derived / regenerated state: programHorizon.horizon, responseModel
 *    (its event ids embed the rebuild time, so two devices would duplicate
 *    them), trainingSession.weekExecutionSummaries, scheduleProfile meal
 *    windows, engagement prompts, womens recovery habits
 *  - the live session: executionRecord, workoutSets, liveSetReviews,
 *    substitutions
 *  - lists of plain strings (preferences, favorites, completed steps)
 *  - lists replaced wholesale by a setter (weak points, facilities,
 *    weekly activities, upgrade intents)
 *
 * Adding a collection: it must have a unique key per record and be edited
 * record-by-record. The ledger (change-ledger.ts) then stamps and tombstones
 * it automatically.
 */

export type CollectionSpec = {
  /** Dotted path from the member-state root; the first segment is the slice. */
  path: string;
  kind: "list" | "map";
  /** Record key for lists. Defaults to the string `id` field. Null = not a keyable record. */
  keyOf?: (item: Record<string, unknown>) => string | null;
};

const str = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);

const byId = undefined;

const byFields =
  (...fields: string[]) =>
  (item: Record<string, unknown>): string | null => {
    const parts = fields.map((field) => item[field]);
    if (parts.some((part) => typeof part !== "string" && typeof part !== "number")) return null;
    return parts.join("|");
  };

/** Records with no key at all (several allowed per day): the record itself is its key. */
const byContent = (item: Record<string, unknown>): string | null => {
  try {
    return `json:${JSON.stringify(item)}`;
  } catch {
    return null;
  }
};

export const SYNC_COLLECTIONS: CollectionSpec[] = [
  /* Compounds, their schedule marks, site logs and links. */
  { path: "trainingSession.enhancementLog", kind: "list", keyOf: byId },
  { path: "trainingSession.enhancementAdherence", kind: "list", keyOf: byFields("entryId", "date", "plannedTime") },
  { path: "trainingSession.injectionLogs", kind: "list", keyOf: byId },
  { path: "trainingSession.compoundSupportLinks", kind: "list", keyOf: byFields("parentEntryId", "supportEntryId") },
  /* Training history. */
  { path: "trainingSession.sessionHistory", kind: "list", keyOf: byId },
  { path: "trainingSession.trainingJournal", kind: "list", keyOf: byId },
  { path: "trainingSession.executionHistory", kind: "list", keyOf: byId },
  { path: "trainingSession.decisionHistory", kind: "list", keyOf: byId },
  { path: "programHorizon.recurringActivities", kind: "list", keyOf: byId },
  /* Recovery logs. */
  { path: "recoveryCommand.sleepLogs", kind: "list", keyOf: (item) => str(item.date) },
  { path: "recoveryCommand.stressCheckIns", kind: "list", keyOf: (item) => str(item.date) },
  { path: "recoveryCommand.stepLogs", kind: "list", keyOf: (item) => str(item.date) },
  { path: "recoveryCommand.hydrationLogs", kind: "list", keyOf: byContent },
  { path: "recoveryCommand.mobilityLogs", kind: "list", keyOf: byContent },
  /* Physique. */
  { path: "physiqueCommand.entries", kind: "list", keyOf: byId },
  { path: "physiqueCommand.photoCheckIns", kind: "list", keyOf: byId },
  /* Women's cycle log. */
  { path: "womens.cycleLogs", kind: "list", keyOf: byId },
  /* Nutrition. */
  { path: "nutritionPrefs.purchases", kind: "list", keyOf: byId },
  { path: "nutritionPrefs.signatureMeals", kind: "list", keyOf: byId },
  { path: "nutritionPrefs.nutritionLogHistory", kind: "map" },
  { path: "customMeals", kind: "list", keyOf: byId },
  { path: "memberMealPlans", kind: "list", keyOf: byId },
  { path: "hydrationDrinkLogs", kind: "list", keyOf: byFields("drinkId", "loggedAt") },
  /* Engagement history. */
  { path: "engagement.events", kind: "list", keyOf: byId },
  /* Day changes and overrides. */
  { path: "splitCustomization.weekly", kind: "map" },
  { path: "splitCustomization.dated", kind: "map" },
  { path: "splitCustomization.history", kind: "list", keyOf: byContent },
  { path: "activityCoverage", kind: "map" },
  { path: "trainingOverrides", kind: "map" },
  { path: "trainingOverrideHistory", kind: "list", keyOf: byId },
  /* Plans, programs and schedules the member built. */
  { path: "customPlans", kind: "list", keyOf: byId },
  { path: "lifestyleSchedules", kind: "list", keyOf: byId },
  { path: "weekAssignments", kind: "list", keyOf: (item) => str(item.weekKey) },
  { path: "actualWeeks", kind: "list", keyOf: (item) => str(item.weekKey) },
  { path: "customWorkoutTemplates", kind: "list", keyOf: byId },
  { path: "movementSelections", kind: "list", keyOf: byId },
  { path: "programs", kind: "list", keyOf: byId },
  { path: "programDayVersions", kind: "list", keyOf: byId },
  { path: "programDayOverrides", kind: "list", keyOf: byFields("date", "programId", "dayLineageId") },
  { path: "programRecommendationDecisions", kind: "list", keyOf: byId },
  { path: "importedProgramDrafts", kind: "list", keyOf: byId },
  { path: "movementFeedback", kind: "map" },
  /* Health records, cycle tracking and the timeline. */
  { path: "bloodworkLogs", kind: "list", keyOf: byId },
  { path: "cyclePeriods", kind: "list", keyOf: byId },
  { path: "redFlagReports", kind: "list", keyOf: byId },
  { path: "cycleGoals", kind: "map" },
  { path: "cycleCheckIns", kind: "list", keyOf: byId },
  { path: "cycleReviewSnapshots", kind: "list", keyOf: byId },
  { path: "supportPlan", kind: "list", keyOf: byId },
  { path: "changeHistory", kind: "list", keyOf: byId },
  { path: "timelineNotes", kind: "list", keyOf: byId },
  { path: "observations", kind: "list", keyOf: byId },
];

export function keyOfItem(spec: CollectionSpec, item: Record<string, unknown>): string | null {
  return spec.keyOf ? spec.keyOf(item) : str(item.id);
}

export function sliceOf(path: string): string {
  const dot = path.indexOf(".");
  return dot < 0 ? path : path.slice(0, dot);
}

export function collectionsForSlice(slice: string, collections: CollectionSpec[] = SYNC_COLLECTIONS): CollectionSpec[] {
  return collections.filter((spec) => sliceOf(spec.path) === slice);
}
