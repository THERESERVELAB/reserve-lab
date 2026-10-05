/* ════════════════════════════════════════════════════════════════════════
   SESSION EXECUTION LEDGER

   Pure, deterministic contracts and transitions for the evidence between a
   Program Horizon prescription and what the athlete actually performed.
   The athlete store owns persistence; this module owns integrity rules.
   ════════════════════════════════════════════════════════════════════════ */

import type { AthleteActivity } from "@/lib/schedule/activity-reconciliation";

export const SESSION_EXECUTION_LEDGER_VERSION = 1;

export type SessionExecutionSource =
  | "program-horizon"
  | "member-custom"
  | "reserve-adjusted"
  | "replacement-activity"
  | "legacy-migration";

export type SessionExecutionStatus =
  | "planned"
  | "started"
  | "partial"
  | "completed"
  | "skipped"
  | "replaced"
  | "abandoned";

export type MovementExecutionSource =
  | "planned"
  | "substitution"
  | "athlete-added"
  | "reserve-adjusted";

export type MovementExecutionStatus =
  | "not-started"
  | "partial"
  | "completed"
  | "skipped"
  | "substituted";

export type CompletedSetRecord = {
  id: string;
  setNumber: number;
  targetReps?: string;
  completedReps?: number;
  targetLoad?: string;
  completedLoad?: number;
  loadUnit?: "lb" | "kg" | "bodyweight" | "assisted" | "band";
  /** Actual modality facts. They remain absent when the athlete did not log them. */
  completedDurationSeconds?: number;
  completedDistanceMeters?: number;
  targetRir?: number;
  actualRir?: number;
  actualRpe?: number;
  completed: boolean;
  failed?: boolean;
  pain?: number;
  notes?: string;
  completedAt?: string;
};

export type MovementExecutionRecord = {
  id: string;
  exerciseId: string;
  plannedName: string;
  performedName: string;
  source: MovementExecutionSource;
  order: number;
  plannedPrescription: {
    sets?: number;
    reps?: string;
    loadGuidance?: string;
    rir?: string;
    rpe?: string;
    tempo?: string;
    restSeconds?: number;
    technique?: string;
  };
  completedSets: CompletedSetRecord[];
  status: MovementExecutionStatus;
  substitutionReason?: string;
  addedReason?: string;
  insertionIndex?: number;
  overlapNote?: string;
  athleteFeedback?: {
    stimulus?: number;
    difficulty?: number;
    pain?: number;
    confidence?: number;
    notes?: string;
  };
};

/** Structural copy of SessionGenerationSnapshot. Extra JSON-safe fields are
 * retained at runtime when the snapshot is cloned. */
export type LedgerSessionSnapshot = {
  demandAtGeneration?: string;
  requestedDemand?: string;
  authorizedDemand?: string;
  architectureId: string;
  architectureVersion: string | null;
  architectureName: string;
  mesocycleId: string;
  generatedAt: string;
  generationReason?: string;
  splitTitle: string;
  movements: unknown[];
  phaseMap?: Record<string, string>;
  changeAcknowledgedAt?: string | null;
  programId?: string;
  programVersion?: number;
  programDayId?: string;
  programDayLineageId?: string;
  programDayVersion?: number;
  sourceWorkoutTemplateId?: string;
  horizonProgramId?: string;
  horizonProtocolId?: string;
  horizonArchitectureVersion?: string;
  horizonWeekNumber?: number;
  horizonPhaseId?: string;
  horizonDayIndex?: number;
  horizonDayTitle?: string;
  horizonRevisionIds?: string[];
  horizonSource?: string;
  horizonWeekSnapshot?: unknown;
};

export type SessionTransitionRecord = {
  from: SessionExecutionStatus;
  to: SessionExecutionStatus;
  at: string;
  reason?: string;
};

export type SessionExecutionRecord = {
  id: string;
  athleteId: string;
  programId: string | null;
  protocolId: string | null;
  architectureVersion: string | null;
  weekNumber: number | null;
  phaseId: string | null;
  phaseName: string | null;
  dayId: string | null;
  sessionId: string;
  calendarDate: string;
  source: SessionExecutionSource;
  /** Legacy-only display metadata. It is not a fabricated prescription. */
  legacySessionTitle?: string;
  legacySplitName?: string;
  plannedSnapshot: LedgerSessionSnapshot | null;
  adjustedSnapshot?: LedgerSessionSnapshot;
  startedSnapshot?: LedgerSessionSnapshot;
  status: SessionExecutionStatus;
  startedAt?: string;
  lastUpdatedAt?: string;
  completedAt?: string;
  movements: MovementExecutionRecord[];
  addedMovements: MovementExecutionRecord[];
  removedMovementIds: string[];
  skippedMovementIds: string[];
  replacementActivityId?: string;
  adjustmentRevisionId?: string;
  futureRevisionIds: string[];
  skipReason?: string;
  skipSource?: "athlete" | "reserve" | "coach";
  reschedulingOffered?: boolean;
  futureTopologyChanged?: boolean;
  reconciliationProposal?: string;
  athleteConfirmedReplacement?: boolean;
  nutritionAdjustment?: string[];
  recoveryAdjustment?: string[];
  affectedFutureDays?: string[];
  sessionMetrics: {
    plannedDurationMinutes?: number;
    actualDurationMinutes?: number;
    completionPercent?: number;
    sessionRpe?: number;
    sessionQuality?: number;
    energyBefore?: number;
    energyAfter?: number;
    painDuringSession?: Array<{ region: string; severity?: number; note?: string }>;
    athleteNotes?: string;
    endReason?: string;
  };
  transitions: SessionTransitionRecord[];
  integrity: {
    ledgerVersion: number;
    frozenAt?: string;
    completedRecordLockedAt?: string;
    migrationSource?: string;
  };
};

export type WeekExecutionSummary = {
  id: string;
  programId: string;
  weekNumber: number;
  createdAt: string;
  plannedSessionCount: number;
  completedSessionCount: number;
  partialSessionCount: number;
  abandonedSessionCount: number;
  skippedSessionCount: number;
  replacedSessionCount: number;
  unresolvedSessionCount: number;
  plannedSetCount?: number;
  completedSetCount?: number;
  addedActivityCount: number;
  addedMovementCount: number;
  completionPercent: number;
  majorDeviations: string[];
  athleteNotes: string[];
  recordIds: string[];
  status: "not-started" | "active" | "completed" | "completed-with-deviations";
};

export type ReserveDecisionCategory =
  | "session-adjustment"
  | "schedule-adjustment"
  | "activity-reconciliation"
  | "pain-adjustment"
  | "readiness-adjustment"
  | "exercise-substitution"
  | "week-revision"
  | "protocol-selection"
  | "athlete-decision"
  | "coach-decision"
  | "migration";

export type ReserveDecisionRecord = {
  id: string;
  athleteId: string;
  programId?: string;
  createdAt: string;
  category: ReserveDecisionCategory;
  source: "reserve" | "athlete" | "coach" | "system-migration";
  observation: string;
  decision: string;
  reason: string;
  affectedWeekNumbers?: number[];
  affectedSessionIds?: string[];
  confidence?: "low" | "moderate" | "high";
  athleteDecision?: "accepted" | "declined" | "deferred" | "not-required";
  /** Structured activity provenance for accepted, declined, and cancelled
      schedule reconciliations. This stays on the existing decision ledger so
      the Response Model can rebuild live activity evidence without a second
      activity store or parsing member-facing copy. */
  activity?: {
    activityId: string;
    revisionId?: string;
    status: "accepted" | "declined" | "cancelled";
    effectiveWeek?: number;
    programStartDate?: string;
    snapshot: AthleteActivity;
  };
  before?: unknown;
  after?: unknown;
};

export type TransitionResult =
  | { ok: true; record: SessionExecutionRecord }
  | { ok: false; record: SessionExecutionRecord; error: string };

const VALID_TRANSITIONS: Record<SessionExecutionStatus, SessionExecutionStatus[]> = {
  planned: ["started", "skipped", "replaced"],
  started: ["partial", "completed", "abandoned"],
  partial: ["partial", "completed", "abandoned"],
  completed: [],
  skipped: [],
  replaced: [],
  abandoned: [],
};

const LOCKING_STATUSES = new Set<SessionExecutionStatus>(["completed", "skipped", "replaced", "abandoned"]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function numericRir(value: unknown): number | undefined {
  const match = text(value)?.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function movementFromUnknown(value: unknown, order: number): MovementExecutionRecord | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const name = text(value.name);
  if (!id || !name) return null;
  const sets = number(value.sets);
  const suggestedLoad = number(value.suggestedLoad);
  const rirTargets = Array.isArray(value.rirTargets) ? value.rirTargets.filter((item): item is string => typeof item === "string") : [];
  return {
    id,
    exerciseId: id,
    plannedName: name,
    performedName: name,
    source: "planned",
    order,
    plannedPrescription: {
      sets,
      reps: text(value.reps),
      loadGuidance: suggestedLoad && suggestedLoad > 0 ? String(suggestedLoad) : text(value.whyLoad),
      rir: rirTargets.length ? [...new Set(rirTargets)].join(" · ") : undefined,
      rpe: text(value.intensity),
      tempo: text(value.tempo),
      restSeconds: number(value.restSeconds),
      technique: text(value.cue),
    },
    completedSets: [],
    status: "not-started",
  };
}

export function movementRecordsFromSnapshot(snapshot: LedgerSessionSnapshot | null): MovementExecutionRecord[] {
  if (!snapshot) return [];
  return snapshot.movements
    .map((movement, index) => movementFromUnknown(movement, index))
    .filter((movement): movement is MovementExecutionRecord => Boolean(movement));
}

function sourceFromSnapshot(snapshot: LedgerSessionSnapshot): SessionExecutionSource {
  if (snapshot.horizonProgramId) return "program-horizon";
  if (snapshot.generationReason === "today-override" || snapshot.generationReason === "member-rebuild") return "reserve-adjusted";
  return "member-custom";
}

export type CreatePlannedSessionInput = {
  id: string;
  athleteId?: string;
  snapshot: LedgerSessionSnapshot;
  calendarDate: string;
  source?: SessionExecutionSource;
  phaseName?: string | null;
  replacementActivityId?: string;
  adjustmentRevisionId?: string;
};

export function createPlannedSessionExecution(input: CreatePlannedSessionInput): SessionExecutionRecord {
  const snapshot = clone(input.snapshot);
  return {
    id: input.id,
    athleteId: input.athleteId ?? "athlete-local",
    programId: snapshot.horizonProgramId ?? snapshot.programId ?? null,
    protocolId: snapshot.horizonProtocolId ?? null,
    architectureVersion: snapshot.horizonArchitectureVersion ?? snapshot.architectureVersion ?? null,
    weekNumber: snapshot.horizonWeekNumber ?? null,
    phaseId: snapshot.horizonPhaseId ?? null,
    phaseName: input.phaseName ?? (isRecord(snapshot.horizonWeekSnapshot) ? text(snapshot.horizonWeekSnapshot.phaseName) ?? null : null),
    dayId: snapshot.programDayId ?? (snapshot.horizonProgramId && snapshot.horizonDayIndex != null
      ? `${snapshot.horizonProgramId}:W${snapshot.horizonWeekNumber ?? 0}:D${snapshot.horizonDayIndex}`
      : null),
    sessionId: input.id,
    calendarDate: input.calendarDate,
    source: input.source ?? sourceFromSnapshot(snapshot),
    plannedSnapshot: snapshot,
    status: "planned",
    movements: movementRecordsFromSnapshot(snapshot),
    addedMovements: [],
    removedMovementIds: [],
    skippedMovementIds: [],
    replacementActivityId: input.replacementActivityId,
    adjustmentRevisionId: input.adjustmentRevisionId,
    futureRevisionIds: [],
    sessionMetrics: { completionPercent: 0 },
    transitions: [],
    integrity: { ledgerVersion: SESSION_EXECUTION_LEDGER_VERSION },
  };
}

export function transitionSessionStatus(
  input: SessionExecutionRecord,
  nextStatus: SessionExecutionStatus,
  at = new Date().toISOString(),
  reason?: string,
): TransitionResult {
  const record = clone(input);
  if (record.integrity.completedRecordLockedAt) {
    return { ok: false, record: input, error: `Session ${record.id} is locked and cannot transition.` };
  }
  if (!VALID_TRANSITIONS[record.status].includes(nextStatus)) {
    return { ok: false, record: input, error: `Invalid session transition: ${record.status} → ${nextStatus}.` };
  }
  const previous = record.status;
  record.status = nextStatus;
  record.lastUpdatedAt = at;
  record.transitions.push({ from: previous, to: nextStatus, at, reason });
  if (nextStatus === "started") {
    record.startedAt = at;
    record.integrity.frozenAt = at;
    record.startedSnapshot = clone(record.adjustedSnapshot ?? record.plannedSnapshot!);
  }
  if (LOCKING_STATUSES.has(nextStatus)) {
    record.completedAt = at;
    record.integrity.completedRecordLockedAt = at;
  }
  return { ok: true, record };
}

export function createStartedSessionExecution(input: CreatePlannedSessionInput & { startedAt: string }): SessionExecutionRecord {
  const planned = createPlannedSessionExecution(input);
  const transitioned = transitionSessionStatus(planned, "started", input.startedAt, "Athlete started the frozen prescription.");
  return transitioned.record;
}

function plannedSetCount(record: SessionExecutionRecord): number {
  return record.movements.reduce((sum, movement) => sum + Math.max(0, movement.plannedPrescription.sets ?? 0), 0);
}

function completedPlannedSetCount(record: SessionExecutionRecord): number {
  return record.movements.reduce(
    (sum, movement) => sum + movement.completedSets.filter((set) => set.completed).length,
    0,
  );
}

export function sessionCompletionPercent(record: SessionExecutionRecord): number {
  const planned = plannedSetCount(record);
  if (planned === 0) return record.status === "completed" ? 100 : 0;
  return Math.min(100, Math.round((completedPlannedSetCount(record) / planned) * 100));
}

function withRecalculatedMetrics(record: SessionExecutionRecord): SessionExecutionRecord {
  return {
    ...record,
    sessionMetrics: {
      ...record.sessionMetrics,
      completionPercent: sessionCompletionPercent(record),
    },
  };
}

function mutateUnlocked(
  input: SessionExecutionRecord,
  mutate: (record: SessionExecutionRecord) => boolean,
  at = new Date().toISOString(),
): TransitionResult {
  if (input.integrity.completedRecordLockedAt) {
    return { ok: false, record: input, error: `Session ${input.id} is locked and cannot mutate.` };
  }
  let record = clone(input);
  if (!mutate(record)) return { ok: false, record: input, error: "The requested execution item was not found." };
  if (record.status === "started") {
    const transitioned = transitionSessionStatus(record, "partial", at, "Execution evidence recorded.");
    record = transitioned.record;
  } else {
    record.lastUpdatedAt = at;
  }
  return { ok: true, record: withRecalculatedMetrics(record) };
}

export type RecordCompletedSetInput = Omit<CompletedSetRecord, "id"> & { id?: string };

export function recordCompletedSet(
  input: SessionExecutionRecord,
  movementId: string,
  set: RecordCompletedSetInput,
): TransitionResult {
  const completedAt = set.completedAt ?? new Date().toISOString();
  return mutateUnlocked(input, (record) => {
    const collections = [record.movements, record.addedMovements];
    for (const movements of collections) {
      const movement = movements.find((candidate) => candidate.id === movementId);
      if (!movement) continue;
      const stored: CompletedSetRecord = {
        ...set,
        id: set.id ?? `${record.id}:${movementId}:set:${set.setNumber}`,
        targetReps: set.targetReps ?? movement.plannedPrescription.reps,
        targetLoad: set.targetLoad ?? movement.plannedPrescription.loadGuidance,
        targetRir: set.targetRir ?? numericRir(movement.plannedPrescription.rir),
        completedAt,
      };
      movement.completedSets = [
        ...movement.completedSets.filter((candidate) => candidate.setNumber !== stored.setNumber),
        stored,
      ].sort((a, b) => a.setNumber - b.setNumber);
      const completed = movement.completedSets.filter((candidate) => candidate.completed).length;
      const target = movement.plannedPrescription.sets ?? 0;
      movement.status = movement.source === "substitution"
        ? "substituted"
        : target > 0 && completed >= target
          ? "completed"
          : "partial";
      return true;
    }
    return false;
  }, completedAt);
}

export function editCompletedSet(
  input: SessionExecutionRecord,
  movementId: string,
  setNumber: number,
  updates: Partial<Omit<CompletedSetRecord, "id" | "setNumber">>,
  at = new Date().toISOString(),
): TransitionResult {
  return mutateUnlocked(input, (record) => {
    const movement = [...record.movements, ...record.addedMovements].find((candidate) => candidate.id === movementId);
    const set = movement?.completedSets.find((candidate) => candidate.setNumber === setNumber);
    if (!set) return false;
    Object.assign(set, updates, { completedAt: updates.completedAt ?? at });
    return true;
  }, at);
}

export function removeLastCompletedSet(
  input: SessionExecutionRecord,
  movementId: string,
  at = new Date().toISOString(),
): TransitionResult {
  return mutateUnlocked(input, (record) => {
    const movement = [...record.movements, ...record.addedMovements].find((candidate) => candidate.id === movementId);
    if (!movement || movement.completedSets.length === 0) return false;
    movement.completedSets = movement.completedSets.slice(0, -1);
    movement.status = movement.completedSets.length ? "partial" : "not-started";
    return true;
  }, at);
}

export function skipMovement(
  input: SessionExecutionRecord,
  movementId: string,
  reason?: string,
  at = new Date().toISOString(),
): TransitionResult {
  return mutateUnlocked(input, (record) => {
    const movement = [...record.movements, ...record.addedMovements].find((candidate) => candidate.id === movementId);
    if (!movement) return false;
    movement.status = "skipped";
    if (reason) movement.athleteFeedback = { ...movement.athleteFeedback, notes: reason };
    if (!record.skippedMovementIds.includes(movementId)) record.skippedMovementIds.push(movementId);
    return true;
  }, at);
}

export function removePlannedMovement(
  input: SessionExecutionRecord,
  movementId: string,
  reason?: string,
  at = new Date().toISOString(),
): TransitionResult {
  return mutateUnlocked(input, (record) => {
    const movement = record.movements.find((candidate) => candidate.id === movementId);
    if (!movement) return false;
    movement.status = "skipped";
    if (reason) movement.athleteFeedback = { ...movement.athleteFeedback, notes: reason };
    if (!record.removedMovementIds.includes(movementId)) record.removedMovementIds.push(movementId);
    return true;
  }, at);
}

export type AddMovementInput = {
  id: string;
  exerciseId?: string;
  name: string;
  sets?: number;
  reps?: string;
  loadGuidance?: string;
  rir?: string;
  rpe?: string;
  tempo?: string;
  restSeconds?: number;
  technique?: string;
  reason?: string;
  insertionIndex?: number;
  overlapNote?: string;
  source?: Extract<MovementExecutionSource, "athlete-added" | "reserve-adjusted">;
};

export function addMovement(
  input: SessionExecutionRecord,
  movement: AddMovementInput,
  at = new Date().toISOString(),
): TransitionResult {
  return mutateUnlocked(input, (record) => {
    if ([...record.movements, ...record.addedMovements].some((candidate) => candidate.id === movement.id)) return false;
    record.addedMovements.push({
      id: movement.id,
      exerciseId: movement.exerciseId ?? movement.id,
      plannedName: movement.name,
      performedName: movement.name,
      source: movement.source ?? "athlete-added",
      order: movement.insertionIndex ?? record.movements.length + record.addedMovements.length,
      plannedPrescription: {
        sets: movement.sets,
        reps: movement.reps,
        loadGuidance: movement.loadGuidance,
        rir: movement.rir,
        rpe: movement.rpe,
        tempo: movement.tempo,
        restSeconds: movement.restSeconds,
        technique: movement.technique,
      },
      completedSets: [],
      status: "not-started",
      addedReason: movement.reason,
      insertionIndex: movement.insertionIndex,
      overlapNote: movement.overlapNote,
    });
    return true;
  }, at);
}

export function substituteMovement(
  input: SessionExecutionRecord,
  movementId: string,
  replacementName: string,
  reason: string,
  at = new Date().toISOString(),
): TransitionResult {
  return mutateUnlocked(input, (record) => {
    const movement = record.movements.find((candidate) => candidate.id === movementId);
    if (!movement) return false;
    movement.performedName = replacementName;
    movement.source = "substitution";
    movement.status = "substituted";
    movement.substitutionReason = reason;
    return true;
  }, at);
}

export function updateMovementFeedback(
  input: SessionExecutionRecord,
  movementId: string,
  feedback: MovementExecutionRecord["athleteFeedback"],
  at = new Date().toISOString(),
): TransitionResult {
  return mutateUnlocked(input, (record) => {
    const movement = [...record.movements, ...record.addedMovements].find((candidate) => candidate.id === movementId);
    if (!movement) return false;
    movement.athleteFeedback = { ...movement.athleteFeedback, ...feedback };
    return true;
  }, at);
}

export function adjustStartedSession(
  input: SessionExecutionRecord,
  adjustedSnapshot: LedgerSessionSnapshot,
  revisionId: string,
  at = new Date().toISOString(),
): TransitionResult {
  if (input.integrity.completedRecordLockedAt) return { ok: false, record: input, error: "Locked sessions cannot be adjusted." };
  if (input.status !== "started" || completedPlannedSetCount(input) > 0) {
    return { ok: false, record: input, error: "Only a zero-output started session can be explicitly adjusted." };
  }
  const record = clone(input);
  record.adjustedSnapshot = clone(adjustedSnapshot);
  record.adjustmentRevisionId = revisionId;
  record.lastUpdatedAt = at;
  record.movements = movementRecordsFromSnapshot(record.adjustedSnapshot);
  return { ok: true, record };
}

export function relateFutureRevision(
  input: SessionExecutionRecord,
  revisionId: string,
  at = new Date().toISOString(),
): SessionExecutionRecord {
  if (input.integrity.completedRecordLockedAt || input.futureRevisionIds.includes(revisionId)) return input;
  return { ...clone(input), futureRevisionIds: [...input.futureRevisionIds, revisionId], lastUpdatedAt: at };
}

export function updateSessionMetrics(
  input: SessionExecutionRecord,
  updates: Partial<SessionExecutionRecord["sessionMetrics"]>,
  at = new Date().toISOString(),
): TransitionResult {
  if (input.integrity.completedRecordLockedAt) return { ok: false, record: input, error: "Locked sessions cannot be edited." };
  const record = clone(input);
  record.sessionMetrics = { ...record.sessionMetrics, ...updates };
  record.lastUpdatedAt = at;
  return { ok: true, record: withRecalculatedMetrics(record) };
}

export function finalizeSessionExecution(
  input: SessionExecutionRecord,
  finalStatus: Extract<SessionExecutionStatus, "completed" | "partial" | "abandoned">,
  at = new Date().toISOString(),
  metrics: Partial<SessionExecutionRecord["sessionMetrics"]> = {},
): TransitionResult {
  if (input.integrity.completedRecordLockedAt) return { ok: false, record: input, error: "Session is already finalized." };
  let record = clone(input);
  record.sessionMetrics = { ...record.sessionMetrics, ...metrics };
  if (record.startedAt && record.sessionMetrics.actualDurationMinutes == null) {
    record.sessionMetrics.actualDurationMinutes = Math.max(0, Math.round((Date.parse(at) - Date.parse(record.startedAt)) / 60_000));
  }
  record = withRecalculatedMetrics(record);
  if (finalStatus === "partial") {
    if (record.status === "started") {
      const partial = transitionSessionStatus(record, "partial", at, metrics.endReason ?? "Session closed with partial work.");
      record = partial.record;
    }
    if (record.status !== "partial") return { ok: false, record: input, error: `Cannot finalize ${record.status} as partial.` };
    record.completedAt = at;
    record.lastUpdatedAt = at;
    record.integrity.completedRecordLockedAt = at;
    return { ok: true, record };
  }
  const transitioned = transitionSessionStatus(record, finalStatus, at, metrics.endReason);
  return transitioned.ok ? { ok: true, record: withRecalculatedMetrics(transitioned.record) } : transitioned;
}

export function upsertExecutionRecord(
  records: SessionExecutionRecord[],
  record: SessionExecutionRecord,
  limit = 180,
): SessionExecutionRecord[] {
  return [...records.filter((candidate) => candidate.id !== record.id), clone(record)]
    .sort((a, b) => (a.startedAt ?? a.calendarDate).localeCompare(b.startedAt ?? b.calendarDate))
    .slice(-limit);
}

export function findUnfinishedExecution(
  records: SessionExecutionRecord[],
  identity: { programId?: string | null; weekNumber?: number | null; dayId?: string | null },
): SessionExecutionRecord | null {
  return records.find((record) =>
    !record.integrity.completedRecordLockedAt &&
    ["started", "partial"].includes(record.status) &&
    (identity.programId == null || record.programId === identity.programId) &&
    (identity.weekNumber == null || record.weekNumber === identity.weekNumber) &&
    (identity.dayId == null || record.dayId === identity.dayId)
  ) ?? null;
}

export type WeekSummaryInput = {
  programId: string;
  weekNumber: number;
  plannedSessionCount: number;
  records: SessionExecutionRecord[];
  decisions?: ReserveDecisionRecord[];
  addedActivityCount?: number;
  createdAt?: string;
};

export function summarizeWeekExecution(input: WeekSummaryInput): WeekExecutionSummary {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const matchingRecords = input.records.filter((record) => record.programId === input.programId && record.weekNumber === input.weekNumber);
  // A zero-output started record can be abandoned at the same moment its
  // planned occurrence is explicitly skipped/replaced. Both are valid audit
  // artifacts, but they represent one scheduled slot and must not be counted
  // twice in the week. Legacy records have no day identity and stay distinct.
  const byPlannedSlot = new Map<string, SessionExecutionRecord>();
  const unlinkedRecords: SessionExecutionRecord[] = [];
  const slotPriority: Record<SessionExecutionStatus, number> = {
    planned: 0,
    started: 1,
    abandoned: 2,
    skipped: 3,
    replaced: 3,
    partial: 4,
    completed: 5,
  };
  for (const record of matchingRecords) {
    if (!record.dayId) {
      unlinkedRecords.push(record);
      continue;
    }
    const key = `${record.calendarDate}:${record.dayId}`;
    const existing = byPlannedSlot.get(key);
    if (!existing || slotPriority[record.status] >= slotPriority[existing.status]) byPlannedSlot.set(key, record);
  }
  const records = [...unlinkedRecords, ...byPlannedSlot.values()];
  const completed = records.filter((record) => record.status === "completed");
  const partial = records.filter((record) => record.status === "partial" && Boolean(record.integrity.completedRecordLockedAt));
  const abandoned = records.filter((record) => record.status === "abandoned");
  const skipped = records.filter((record) => record.status === "skipped");
  const replaced = records.filter((record) => record.status === "replaced");
  const resolved = completed.length + partial.length + abandoned.length + skipped.length + replaced.length;
  const unresolvedSessionCount = Math.max(0, input.plannedSessionCount - resolved);
  const plannedSets = records.reduce((sum, record) => sum + plannedSetCount(record), 0);
  const completedSets = records.reduce((sum, record) => sum + completedPlannedSetCount(record), 0);
  // Average each planned occurrence instead of treating only the records with
  // known set prescriptions as the denominator. This keeps a migrated or
  // activity-replaced day (where sets are honestly unknown) from making the
  // rest of the week look 100% complete. Exact known-set totals remain on the
  // summary for inspection.
  const completionPoints = [...completed, ...partial].reduce(
    (sum, record) => sum + sessionCompletionPercent(record),
    0,
  );
  const completionPercent = input.plannedSessionCount > 0
    ? Math.min(100, Math.round(completionPoints / input.plannedSessionCount))
    : 0;
  const reconciledActivityCount = new Set(
    (input.decisions ?? [])
      .filter((decision) =>
        decision.category === "activity-reconciliation" &&
        decision.programId === input.programId &&
        decision.affectedWeekNumbers?.includes(input.weekNumber) &&
        decision.athleteDecision !== "declined" &&
        decision.athleteDecision !== "deferred"
      )
      .map((decision) => decision.id),
  ).size;
  // Replacement records are an older source of truth for reconciled activity;
  // decision records additionally capture accepted supplemental work.
  const addedActivityCount = input.addedActivityCount ?? Math.max(replaced.length, reconciledActivityCount);
  const addedMovementCount = records.reduce((sum, record) => sum + record.addedMovements.length, 0);
  const majorDeviations: string[] = [];
  if (partial.length) majorDeviations.push(`${partial.length} session${partial.length === 1 ? "" : "s"} finished partial.`);
  if (abandoned.length) majorDeviations.push(`${abandoned.length} session${abandoned.length === 1 ? " was" : "s were"} explicitly abandoned.`);
  if (skipped.length) majorDeviations.push(`${skipped.length} planned session${skipped.length === 1 ? " was" : "s were"} skipped.`);
  if (replaced.length) majorDeviations.push(`${replaced.length} planned session${replaced.length === 1 ? " was" : "s were"} replaced by another activity.`);
  if (addedActivityCount) majorDeviations.push(`${addedActivityCount} reconciled activit${addedActivityCount === 1 ? "y" : "ies"} recorded.`);
  if (addedMovementCount) majorDeviations.push(`${addedMovementCount} athlete-added movement${addedMovementCount === 1 ? "" : "s"} recorded.`);
  if (unresolvedSessionCount) majorDeviations.push(`${unresolvedSessionCount} scheduled session${unresolvedSessionCount === 1 ? " remains" : "s remain"} unresolved.`);
  const hasDeviations = majorDeviations.some((entry) => !entry.includes("unresolved"));
  const status: WeekExecutionSummary["status"] = records.length === 0 && addedActivityCount === 0
    ? "not-started"
    : unresolvedSessionCount > 0
      ? "active"
      : hasDeviations
        ? "completed-with-deviations"
        : "completed";
  return {
    id: `${input.programId}:W${input.weekNumber}:execution`,
    programId: input.programId,
    weekNumber: input.weekNumber,
    createdAt,
    plannedSessionCount: input.plannedSessionCount,
    completedSessionCount: completed.length,
    partialSessionCount: partial.length,
    abandonedSessionCount: abandoned.length,
    skippedSessionCount: skipped.length,
    replacedSessionCount: replaced.length,
    unresolvedSessionCount,
    plannedSetCount: plannedSets || undefined,
    completedSetCount: completedSets || undefined,
    addedActivityCount,
    addedMovementCount,
    completionPercent,
    majorDeviations,
    athleteNotes: records.map((record) => record.sessionMetrics.athleteNotes).filter((note): note is string => Boolean(note)),
    recordIds: records.map((record) => record.id),
    status,
  };
}

export function upsertWeekExecutionSummary(
  summaries: WeekExecutionSummary[],
  summary: WeekExecutionSummary,
): WeekExecutionSummary[] {
  return [...summaries.filter((candidate) => candidate.id !== summary.id), clone(summary)]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-104);
}

export type ReserveDecisionInput = Omit<ReserveDecisionRecord, "id" | "createdAt" | "athleteId"> & {
  id?: string;
  createdAt?: string;
  athleteId?: string;
};

export function createReserveDecision(input: ReserveDecisionInput): ReserveDecisionRecord {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const affected = input.affectedSessionIds?.join("-") ?? input.affectedWeekNumbers?.join("-") ?? "record";
  return {
    ...clone(input),
    id: input.id ?? `decision:${createdAt}:${input.category}:${affected}`,
    athleteId: input.athleteId ?? "athlete-local",
    createdAt,
  };
}

export function appendReserveDecision(
  decisions: ReserveDecisionRecord[],
  decision: ReserveDecisionRecord,
  limit = 240,
): ReserveDecisionRecord[] {
  if (decisions.some((candidate) => candidate.id === decision.id)) return decisions;
  return [...decisions, clone(decision)].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-limit);
}

type LegacySessionCard = {
  id: string;
  date?: string;
  sessionName?: string;
  splitName?: string;
  weekLabel?: string;
  phaseLabel?: string;
  completionStatus?: string;
};

type LegacyJournalEntry = {
  id: string;
  loggedAt?: string;
  sessionName?: string;
  splitName?: string;
  weekLabel?: string;
  phaseLabel?: string;
  completionStatus?: string;
  notes?: string;
};

export type LegacyMigrationResult = {
  records: SessionExecutionRecord[];
  decisions: ReserveDecisionRecord[];
  migratedCount: number;
};

function legacyWeek(label?: string): number | null {
  const match = label?.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function legacyRecord(
  value: LegacySessionCard | LegacyJournalEntry,
  source: string,
): SessionExecutionRecord {
  const at = (value as LegacySessionCard).date ?? (value as LegacyJournalEntry).loggedAt;
  const timestamp = at && !Number.isNaN(Date.parse(at)) ? new Date(at).toISOString() : new Date(0).toISOString();
  const status: SessionExecutionStatus = value.completionStatus === "as-planned" ? "completed" : "partial";
  return {
    id: `legacy:${value.id}`,
    athleteId: "athlete-local",
    programId: null,
    protocolId: null,
    architectureVersion: null,
    weekNumber: legacyWeek(value.weekLabel),
    phaseId: null,
    phaseName: value.phaseLabel ?? null,
    dayId: null,
    sessionId: value.id,
    calendarDate: dateKey(timestamp),
    source: "legacy-migration",
    legacySessionTitle: value.sessionName,
    legacySplitName: value.splitName,
    plannedSnapshot: null,
    status,
    startedAt: timestamp,
    lastUpdatedAt: timestamp,
    completedAt: timestamp,
    movements: [],
    addedMovements: [],
    removedMovementIds: [],
    skippedMovementIds: [],
    futureRevisionIds: [],
    sessionMetrics: {
      athleteNotes: "notes" in value ? value.notes : undefined,
    },
    transitions: [],
    integrity: {
      ledgerVersion: SESSION_EXECUTION_LEDGER_VERSION,
      frozenAt: timestamp,
      completedRecordLockedAt: timestamp,
      migrationSource: source,
    },
  };
}

/** Idempotent migration of the two histories already persisted inside the
 * canonical trainingSession slice. Missing prescriptions and sets stay null. */
export function migrateLegacyExecutionHistory(input: {
  sessionHistory?: LegacySessionCard[];
  trainingJournal?: LegacyJournalEntry[];
  existingRecords?: SessionExecutionRecord[];
  existingDecisions?: ReserveDecisionRecord[];
}): LegacyMigrationResult {
  const existingRecords = [...(input.existingRecords ?? [])];
  const canonicalRecords = existingRecords.filter((record) => record.source !== "legacy-migration");
  const completionTime = (record: SessionExecutionRecord): number | null => {
    const value = record.completedAt ?? record.startedAt;
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  };
  const legacyValueIsCanonicalProjection = (value: LegacySessionCard | LegacyJournalEntry): boolean => {
    const rawTimestamp = (value as LegacySessionCard).date ?? (value as LegacyJournalEntry).loggedAt;
    if (!rawTimestamp) return false;
    const timestamp = Date.parse(rawTimestamp);
    if (Number.isNaN(timestamp)) return false;
    return canonicalRecords.some((record) => {
      const canonicalTimestamp = completionTime(record);
      const canonicalTitle = record.startedSnapshot?.splitTitle ?? record.plannedSnapshot?.splitTitle;
      return canonicalTimestamp != null
        && Math.abs(canonicalTimestamp - timestamp) <= 5_000
        && (!value.sessionName || !canonicalTitle || value.sessionName === canonicalTitle);
    });
  };
  const legacyRecordIsCanonicalProjection = (record: SessionExecutionRecord): boolean => {
    if (record.source !== "legacy-migration") return false;
    const timestamp = completionTime(record);
    if (timestamp == null) return false;
    return canonicalRecords.some((canonical) => {
      const canonicalTimestamp = completionTime(canonical);
      return canonicalTimestamp != null
        && canonical.calendarDate === record.calendarDate
        && Math.abs(canonicalTimestamp - timestamp) <= 5_000;
    });
  };
  const shadowedLegacyIds = new Set(
    existingRecords.filter(legacyRecordIsCanonicalProjection).map((record) => record.id),
  );
  let records = existingRecords.filter((record) => !shadowedLegacyIds.has(record.id));
  const knownSessionIds = new Set(records.map((record) => record.sessionId));
  let migratedCount = 0;
  for (const card of input.sessionHistory ?? []) {
    if (!card?.id || knownSessionIds.has(card.id) || legacyValueIsCanonicalProjection(card)) continue;
    records = upsertExecutionRecord(records, legacyRecord(card, "trainingSession.sessionHistory"));
    knownSessionIds.add(card.id);
    migratedCount += 1;
  }
  for (const entry of input.trainingJournal ?? []) {
    if (!entry?.id || knownSessionIds.has(entry.id) || legacyValueIsCanonicalProjection(entry)) continue;
    records = upsertExecutionRecord(records, legacyRecord(entry, "trainingSession.trainingJournal"));
    knownSessionIds.add(entry.id);
    migratedCount += 1;
  }
  let decisions = [...(input.existingDecisions ?? [])];
  if (migratedCount > 0) {
    decisions = appendReserveDecision(decisions, createReserveDecision({
      id: "decision:migration:session-execution-ledger-v1",
      createdAt: new Date(0).toISOString(),
      category: "migration",
      source: "system-migration",
      observation: "Legacy training history existed without execution-ledger provenance.",
      decision: "Preserved legacy sessions as immutable unlinked records.",
      reason: "Missing prescriptions and set details were left unknown rather than fabricated.",
      athleteDecision: "not-required",
    }));
  } else if (shadowedLegacyIds.size > 0 && !records.some((record) => record.source === "legacy-migration")) {
    // Clean up the migration entry created by the pre-fix shadow import. A
    // genuine legacy record keeps the entry; only an all-shadow migration is
    // removed.
    decisions = decisions.filter((decision) => decision.id !== "decision:migration:session-execution-ledger-v1");
  }
  return { records, decisions, migratedCount };
}
