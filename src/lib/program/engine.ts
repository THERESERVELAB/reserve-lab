import { RESERVE_WEEK_SPLIT } from "@/lib/training/weekly-split";
import { MOVEMENT_LIBRARY } from "@/lib/training/prescription-engine";
import { classifyMovementPattern } from "@/lib/training/plateau-engine";
import { resolveActivityLoad } from "@/lib/lifestyle/activity-load";
import { buildCustomSessionSnapshot, type CustomSessionBuild } from "@/lib/lifestyle/session-bridge";
import {
  isoWeekKey,
  lifestyleId,
  type CustomWorkoutMovement,
  type CustomWorkoutTemplate,
  type LifestyleSchedule,
  type WeekAssignment,
} from "@/lib/lifestyle/types";
import type { WorkoutDemandLevel } from "@/lib/training/workout-demand";
import type {
  ImportedMovementDraft,
  ImportedProgramDayDraft,
  ImportedProgramDraft,
  ProgramDayDefinition,
  ProgramDayOverride,
  ProgramDefinition,
  ProgramImportSourceKind,
  ProgramOperatingMode,
  ProgramRecommendationPreferences,
} from "./types";

const MOVEMENT_BY_ID = new Map(MOVEMENT_LIBRARY.map((movement) => [movement.id, movement]));

export type ProgramDayResolution = {
  program: ProgramDefinition;
  day: ProgramDayDefinition;
  override: ProgramDayOverride | null;
  reason:
    | "today-only-override"
    | "member-definition"
    | "reserve-optimized"
    | "reserve-original";
};

export function dateKey(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function programRotationIndex(program: ProgramDefinition, date: Date): number {
  const rotation = Math.max(1, program.rotationLengthDays);
  if (rotation === 7) {
    const weekday = (date.getDay() + 6) % 7;
    return (weekday - program.weekAnchor + 7) % 7;
  }
  const origin = new Date(program.createdAt);
  const originDay = Date.UTC(origin.getUTCFullYear(), origin.getUTCMonth(), origin.getUTCDate());
  const currentDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const elapsed = Math.max(0, Math.floor((currentDay - originDay) / 86_400_000));
  return elapsed % rotation;
}

export function resolveProgramForDate(
  programs: ProgramDefinition[],
  activeProgramId: string | null,
  assignments: WeekAssignment[],
  date: Date,
): ProgramDefinition | null {
  const assignment = assignments.find((entry) => entry.weekKey === isoWeekKey(date));
  const assigned = assignment?.programId
    ? programs.find((program) => program.id === assignment.programId && program.status !== "archived")
    : null;
  if (assigned) return assigned;
  return programs.find((program) => program.id === activeProgramId && program.status !== "archived") ?? null;
}

/** Resolution priority after the active-session snapshot (which TrainingView
 * always handles first): today-only override, current member/imported day,
 * Reserve optimized, then Reserve original. */
export function resolveProgramDayForDate(input: {
  programs: ProgramDefinition[];
  activeProgramId: string | null;
  assignments: WeekAssignment[];
  overrides: ProgramDayOverride[];
  date: Date;
}): ProgramDayResolution | null {
  const program = resolveProgramForDate(input.programs, input.activeProgramId, input.assignments, input.date);
  if (!program) return null;
  const index = programRotationIndex(program, input.date);
  const current = program.days.find((day) => day.dayIndex === index && day.status !== "archived");
  if (!current) return null;
  const override = input.overrides
    .filter((entry) => entry.status === "active" && entry.date === dateKey(input.date))
    .find((entry) => entry.programId === program.id && entry.dayLineageId === current.lineageId) ?? null;
  if (override) return { program, day: override.definition, override, reason: "today-only-override" };
  if (["member-customized", "member-created", "imported"].includes(current.ownership)) {
    return { program, day: current, override: null, reason: "member-definition" };
  }
  return {
    program,
    day: current,
    override: null,
    reason: current.ownership === "reserve-optimized" ? "reserve-optimized" : "reserve-original",
  };
}

export function buildProgramDaySessionSnapshot(
  resolution: ProgramDayResolution,
  templates: CustomWorkoutTemplate[],
  requestedDemand: WorkoutDemandLevel,
  authorizedDemand: WorkoutDemandLevel = requestedDemand,
): CustomSessionBuild | null {
  const template = resolution.day.workoutTemplateId
    ? templates.find((candidate) => candidate.id === resolution.day.workoutTemplateId)
    : null;
  if (!template || template.movements.length === 0) return null;
  const built = buildCustomSessionSnapshot(template, authorizedDemand);
  return {
    firstMovementId: built.firstMovementId,
    snapshot: {
      ...built.snapshot,
      requestedDemand,
      demandAtGeneration: authorizedDemand,
      authorizedDemand,
      generationReason: resolution.override ? "today-override" : "program-day-start",
      programId: resolution.program.id,
      programVersion: resolution.program.version,
      programDayId: resolution.day.id,
      programDayLineageId: resolution.day.lineageId,
      programDayVersion: resolution.day.version,
      programDayOwnership: resolution.day.ownership,
      sourceWorkoutTemplateId: template.id,
      splitTitle: resolution.day.title,
    },
  };
}

function targetNames(template: CustomWorkoutTemplate | undefined): string[] {
  if (!template) return [];
  return template.movements.map((movement) =>
    movement.exerciseId
      ? MOVEMENT_BY_ID.get(movement.exerciseId)?.name ?? movement.customExerciseName ?? "Custom Movement"
      : movement.customExerciseName ?? "Custom Movement",
  );
}

function equipmentNames(template: CustomWorkoutTemplate | undefined): string[] {
  if (!template) return [];
  return [...new Set(template.movements.map((movement) => {
    if (!movement.exerciseId) return "Member specified";
    return MOVEMENT_BY_ID.get(movement.exerciseId)?.equipment ?? "Member specified";
  }))];
}

function directSets(template: CustomWorkoutTemplate | undefined): number {
  return template?.movements.reduce((sum, movement) => sum + Math.max(0, movement.workingSets), 0) ?? 0;
}

export type ProgramDayComparison = {
  addedExercises: string[];
  removedExercises: string[];
  orderChanges: string[];
  directSetDelta: number;
  estimatedIndirectExposureChange: "lower" | "similar" | "higher" | "evidence-needed";
  muscleEmphasisAdded: string[];
  muscleEmphasisRemoved: string[];
  movementPatternChanges: string[];
  durationDeltaMinutes: number | null;
  fatigueChange: "lower" | "similar" | "higher" | "evidence-needed";
  recoveryChange: string;
  jointStressChange: string;
  equipmentAdded: string[];
  equipmentRemoved: string[];
  weeklyExposureNote: string;
  sideActivityNote: string;
};

export function compareProgramDays(
  original: ProgramDayDefinition,
  current: ProgramDayDefinition,
  templates: CustomWorkoutTemplate[],
  schedule?: LifestyleSchedule | null,
): ProgramDayComparison {
  const originalTemplate = original.workoutTemplateId
    ? templates.find((candidate) => candidate.id === original.workoutTemplateId)
    : undefined;
  const currentTemplate = current.workoutTemplateId
    ? templates.find((candidate) => candidate.id === current.workoutTemplateId)
    : undefined;
  const originalNames = targetNames(originalTemplate);
  const currentNames = targetNames(currentTemplate);
  const addedExercises = currentNames.filter((name) => !originalNames.includes(name));
  const removedExercises = originalNames.filter((name) => !currentNames.includes(name));
  const orderChanges = currentNames.filter((name, index) => originalNames.includes(name) && originalNames.indexOf(name) !== index);
  const originalPatterns = new Set((originalTemplate?.movements ?? []).map((movement) => {
    const entry = movement.exerciseId ? MOVEMENT_BY_ID.get(movement.exerciseId) : undefined;
    const name = entry?.name ?? movement.customExerciseName ?? "";
    return classifyMovementPattern(name, entry?.target ?? name);
  }));
  const currentPatterns = new Set((currentTemplate?.movements ?? []).map((movement) => {
    const entry = movement.exerciseId ? MOVEMENT_BY_ID.get(movement.exerciseId) : undefined;
    const name = entry?.name ?? movement.customExerciseName ?? "";
    return classifyMovementPattern(name, entry?.target ?? name);
  }));
  const patternChanges = [
    ...[...currentPatterns].filter((pattern) => !originalPatterns.has(pattern)).map((pattern) => `Added ${pattern}`),
    ...[...originalPatterns].filter((pattern) => !currentPatterns.has(pattern)).map((pattern) => `Removed ${pattern}`),
  ];
  const durationA = original.expectedDurationMinutes ?? originalTemplate?.timeAvailableMin;
  const durationB = current.expectedDurationMinutes ?? currentTemplate?.timeAvailableMin;
  const setDelta = directSets(currentTemplate) - directSets(originalTemplate);
  const adjacent = schedule?.activities.filter((activity) =>
    Math.abs(activity.dayIndex - current.dayIndex) <= 1 && activity.dayIndex !== current.dayIndex,
  ) ?? [];
  const adjacentDemand = adjacent.reduce((sum, activity) => sum + resolveActivityLoad(activity).fatigue, 0);

  return {
    addedExercises,
    removedExercises,
    orderChanges,
    directSetDelta: setDelta,
    estimatedIndirectExposureChange: !originalTemplate || !currentTemplate
      ? "evidence-needed"
      : setDelta > 3 ? "higher" : setDelta < -3 ? "lower" : "similar",
    muscleEmphasisAdded: current.primaryTargets.filter((target) => !original.primaryTargets.includes(target)),
    muscleEmphasisRemoved: original.primaryTargets.filter((target) => !current.primaryTargets.includes(target)),
    movementPatternChanges: patternChanges,
    durationDeltaMinutes: durationA !== undefined && durationB !== undefined ? durationB - durationA : null,
    fatigueChange: !originalTemplate || !currentTemplate
      ? "evidence-needed"
      : setDelta >= 4 ? "higher" : setDelta <= -4 ? "lower" : "similar",
    recoveryChange: setDelta >= 4
      ? "More direct work may raise recovery cost. Confirm with completed-session logs."
      : setDelta <= -4
        ? "Lower direct volume may reduce recovery cost. Confirm with completed-session logs."
        : "No material recovery change is inferred from direct sets alone.",
    jointStressChange: "Joint-stress direction is observational until movement feedback and completed sets provide evidence.",
    equipmentAdded: equipmentNames(currentTemplate).filter((name) => !equipmentNames(originalTemplate).includes(name)),
    equipmentRemoved: equipmentNames(originalTemplate).filter((name) => !equipmentNames(currentTemplate).includes(name)),
    weeklyExposureNote: `${setDelta >= 0 ? "+" : ""}${setDelta} planned direct sets on this day; the weekly exposure view shows where they land.`,
    sideActivityNote: adjacent.length === 0
      ? "No adjacent side activity is scheduled."
      : `${adjacent.map((activity) => activity.title).join(", ")} sits beside this day (${adjacentDemand.toFixed(1)} coarse fatigue units).`,
  };
}

export type ProgramDayAuditRecommendation = {
  id: string;
  rank: number;
  category: "best-fit" | "strong-alternative" | "possible-with-caution" | "keep-as-built";
  title: string;
  reason: string;
  expectedBenefit: string;
  tradeoff: string;
  patch?: Partial<ProgramDayDefinition>;
};

export type ProgramDayAudit = {
  generatedAt: string;
  observations: string[];
  recommendations: ProgramDayAuditRecommendation[];
};

export function auditProgramDay(input: {
  day: ProgramDayDefinition;
  templates: CustomWorkoutTemplate[];
  schedule?: LifestyleSchedule | null;
  preferences: ProgramRecommendationPreferences;
}): ProgramDayAudit {
  const template = input.day.workoutTemplateId
    ? input.templates.find((candidate) => candidate.id === input.day.workoutTemplateId)
    : undefined;
  const observations: string[] = [];
  const recommendations: ProgramDayAuditRecommendation[] = [];
  const sets = directSets(template);
  const duration = input.day.expectedDurationMinutes ?? template?.timeAvailableMin;
  const nearby = input.schedule?.activities.filter((activity) =>
    Math.abs(activity.dayIndex - input.day.dayIndex) <= 1 && activity.dayIndex !== input.day.dayIndex,
  ) ?? [];
  const nearbyLoad = nearby.reduce((sum, activity) => sum + resolveActivityLoad(activity).fatigue, 0);

  if (!template && ["strength", "hypertrophy"].includes(input.day.sessionType)) {
    observations.push("Evidence needed: no movement template is assigned to this training day.");
  }
  if (input.preferences.volume && sets > 24) {
    observations.push(`${sets} planned direct sets creates a high-volume session.`);
    recommendations.push({
      id: `audit-volume-${input.day.lineageId}`,
      rank: 1,
      category: "best-fit",
      title: "Review the lowest-priority movement",
      reason: "The day carries more than 24 planned direct sets.",
      expectedBenefit: "A tighter sequence may preserve output on the primary targets.",
      tradeoff: "Planned direct volume would decrease if you choose to edit it.",
    });
  }
  if (input.preferences.duration && duration && duration > 120) {
    observations.push(`${duration} minutes is longer than most completed-session windows in Reserve.`);
    recommendations.push({
      id: `audit-duration-${input.day.lineageId}`,
      rank: recommendations.length + 1,
      category: "strong-alternative",
      title: "Create a compact version",
      reason: "The planned duration may be difficult to repeat inside a normal week.",
      expectedBenefit: "A compact version gives travel and constrained days a deliberate fallback.",
      tradeoff: "The full version remains available in history and the day library.",
      patch: { expectedDurationMinutes: 75 },
    });
  }
  if (input.preferences["side-activity"] && nearbyLoad >= 2.2) {
    observations.push(`${nearby.map((activity) => activity.title).join(", ")} adds adjacent recovery demand.`);
    recommendations.push({
      id: `audit-side-${input.day.lineageId}`,
      rank: recommendations.length + 1,
      category: "possible-with-caution",
      title: "Keep the day and monitor the overlap",
      reason: "A high-demand side activity sits within one day of this session.",
      expectedBenefit: "The written program stays intact while actual output supplies better evidence.",
      tradeoff: "Reserve will continue flagging the spacing until completion logs show the pattern is sustainable.",
    });
  }
  recommendations.push({
    id: `audit-keep-${input.day.lineageId}`,
    rank: recommendations.length + 1,
    category: "keep-as-built",
    title: "Keep as built",
    reason: "Your current version remains a valid member-owned choice.",
    expectedBenefit: "No program structure changes.",
    tradeoff: "Reserve continues monitoring duration, completion, and adjacent load.",
  });
  if (observations.length === 0) observations.push("The day is internally coherent against the evidence currently available.");
  return { generatedAt: new Date().toISOString(), observations, recommendations };
}

export function createReserveProgram(mode: ProgramOperatingMode, now = new Date()): ProgramDefinition {
  const createdAt = now.toISOString();
  const programId = lifestyleId("program");
  const days: ProgramDayDefinition[] = RESERVE_WEEK_SPLIT.map((row) => {
    const id = lifestyleId("pday");
    const recovery = row.dayIndex === 6;
    return {
      id,
      lineageId: id,
      programId,
      programVersion: 1,
      dayIndex: row.dayIndex,
      calendarDay: row.dayLong,
      title: row.title,
      sessionType: recovery ? "recovery" : "hypertrophy",
      sessionObjective: row.goal,
      primaryTargets: recovery ? [] : row.title.split(/\s*\/\s*|\s*\+\s*/).filter(Boolean),
      secondaryTargets: [],
      ownership: "reserve-original",
      reserveOriginalDayId: id,
      version: 1,
      locked: false,
      preserveFromAiOverwrite: false,
      reserveNotes: row.reason,
      coachingNotes: row.protect,
      status: "active",
      createdAt,
      updatedAt: createdAt,
    };
  });
  return {
    id: programId,
    lineageId: programId,
    version: 1,
    name: "Reserve Weekly Program",
    description: "The current Reserve week, independently editable one day at a time.",
    status: "active",
    source: "reserve",
    operatingMode: mode,
    rotationLengthDays: 7,
    weekAnchor: 0,
    days,
    createdAt,
    updatedAt: createdAt,
  };
}

export function createProgramFromSchedule(
  schedule: LifestyleSchedule,
  mode: ProgramOperatingMode,
  now = new Date(),
): ProgramDefinition {
  const createdAt = now.toISOString();
  const programId = lifestyleId("program");
  const days: ProgramDayDefinition[] = Array.from({ length: schedule.rotationLengthDays }, (_, dayIndex) => {
    const activity = schedule.activities.find((candidate) => candidate.dayIndex === dayIndex);
    const id = lifestyleId("pday");
    const sessionType = activity?.type === "running" || activity?.type === "zone2" || activity?.type === "hiit"
      ? "conditioning"
      : activity?.type === "strength" || activity?.type === "hypertrophy" || activity?.type === "track" || activity?.type === "sprint" || activity?.type === "sport" || activity?.type === "mobility" || activity?.type === "recovery" || activity?.type === "rest"
        ? activity.type
        : "custom";
    return {
      id,
      lineageId: id,
      programId,
      programVersion: 1,
      dayIndex,
      title: activity?.title ?? `Day ${dayIndex + 1}`,
      sessionType,
      sessionObjective: activity?.notes ?? activity?.title ?? "Member-defined day",
      primaryTargets: activity?.focus ?? [],
      secondaryTargets: [],
      workoutTemplateId: activity?.workoutTemplateId,
      activityId: activity?.id,
      ownership: "member-created",
      version: 1,
      locked: false,
      preserveFromAiOverwrite: mode !== "reserve-managed",
      expectedDurationMinutes: activity?.durationMinutes,
      intensity: activity?.intensity,
      facility: activity?.location,
      equipment: activity?.equipment,
      memberNotes: activity?.notes,
      status: "active",
      createdAt,
      updatedAt: createdAt,
    };
  });
  return {
    id: programId,
    lineageId: programId,
    version: 1,
    name: `${schedule.name} Program`,
    status: "active",
    source: "member",
    operatingMode: mode,
    rotationLengthDays: schedule.rotationLengthDays,
    weekAnchor: schedule.weekAnchor,
    days,
    scheduleId: schedule.id,
    createdAt,
    updatedAt: createdAt,
  };
}

function parseMovement(line: string, index: number): ImportedMovementDraft {
  const cleaned = line.replace(/^[-*•]\s*/, "").trim();
  const setRep = cleaned.match(/^(.*?)\s+(\d+)\s*[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?(.*)$/i);
  if (!setRep) {
    return {
      id: lifestyleId("import-movement"),
      name: cleaned || `Movement ${index + 1}`,
      uncertainFields: ["sets", "reps", "rest"],
    };
  }
  const tail = setRep[5]?.trim();
  const rest = tail?.match(/(?:rest\s*)?(\d+)\s*(?:s|sec)/i);
  return {
    id: lifestyleId("import-movement"),
    name: setRep[1].trim(),
    sets: Number(setRep[2]),
    repMin: Number(setRep[3]),
    repMax: Number(setRep[4] ?? setRep[3]),
    restSeconds: rest ? Number(rest[1]) : undefined,
    notes: tail || undefined,
    uncertainFields: rest ? [] : ["rest"],
  };
}

function looksLikeDayHeading(line: string): boolean {
  return /^(day\s*\d+|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)(\s*[-:–—].*)?$/i.test(line.trim())
    || /^week\s+[ab]\s*[-:–—]/i.test(line.trim());
}

export function parseProgramText(
  text: string,
  sourceKind: ProgramImportSourceKind = "paste",
  sourceName?: string,
): ImportedProgramDraft {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 500);
  const dayBlocks: Array<{ title: string; lines: string[] }> = [];
  for (const line of lines) {
    if (looksLikeDayHeading(line)) {
      dayBlocks.push({ title: line.replace(/:$/, ""), lines: [] });
    } else if (dayBlocks.length === 0) {
      dayBlocks.push({ title: "Day 1", lines: [line] });
    } else {
      dayBlocks[dayBlocks.length - 1].lines.push(line);
    }
  }
  const days: ImportedProgramDayDraft[] = dayBlocks.map((block, dayIndex) => ({
    id: lifestyleId("import-day"),
    title: block.title,
    sessionType: /rest|off/i.test(block.title) ? "rest" : /track|sprint/i.test(block.title) ? "track" : "custom",
    movements: block.lines.map(parseMovement),
    uncertainFields: block.lines.length === 0 ? ["movements"] : ["session type", "targets"],
    notes: `Interpreted as day ${dayIndex + 1}. Review every field before activation.`,
  }));
  const now = new Date().toISOString();
  return {
    id: lifestyleId("import-draft"),
    name: sourceName ? sourceName.replace(/\.[^.]+$/, "") : "Imported Program Draft",
    sourceKind,
    sourceName,
    sourceExcerpt: text.slice(0, 30_000),
    rotationLengthDays: Math.max(1, days.length),
    days,
    uncertainFields: days.length === 0 ? ["days", "rotation"] : ["rotation start", "program intent"],
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function movementDraftToTemplateMovement(movement: ImportedMovementDraft, order: number): CustomWorkoutMovement {
  return {
    id: lifestyleId("cwm"),
    customExerciseName: movement.name,
    slotRole: "",
    order,
    workingSets: movement.sets ?? 1,
    repMin: movement.repMin,
    repMax: movement.repMax,
    restSeconds: movement.restSeconds,
    substitutionExerciseIds: [],
    notes: movement.notes,
  };
}
