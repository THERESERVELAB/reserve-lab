/* ════════════════════════════════════════════════════════════════════════
   DEVELOPMENT RESPONSE MODEL — synthetic coaching intelligence.

   Clearly fictional athletes and sessions used to prove the closed loop
   behaves correctly, and to drive the development inspector.

   These fixtures never enter member state. They exist so every claim the
   Response Model makes can be reproduced deterministically.
   ════════════════════════════════════════════════════════════════════════ */

import {
  createPlannedSessionExecution,
  createStartedSessionExecution,
  finalizeSessionExecution,
  recordCompletedSet,
  substituteMovement,
  transitionSessionStatus,
  updateMovementFeedback,
  updateSessionMetrics,
  type LedgerSessionSnapshot,
  type SessionExecutionRecord,
} from "@/lib/training/session-execution";
import type {
  BodyCompositionInput,
  NutritionEvidenceInput,
  ReadinessEvidenceInput,
  ResponseEvidenceInput,
} from "@/lib/response-evidence/types";
import type { AthleteActivity } from "@/lib/schedule/activity-reconciliation";

import { buildResponseModel, type BuildResponseModelResult } from "./build";

export const RESPONSE_SIMULATIONS = [
  "insufficient-evidence",
  "two-comparable-successful-sessions",
  "six-comparable-successful-sessions",
  "successful-with-one-contradiction",
  "established-then-weakened",
  "genuinely-conflicting-evidence",
  "productive-back-volume-range",
  "excessive-lower-volume",
  "two-versus-three-exposures",
  "machine-press-outperforms-barbell",
  "one-painful-exposure",
  "three-painful-exposures",
  "conditioning-within-24-hours",
  "conditioning-separated-72-hours",
  "rapid-fat-loss-declining-performance",
  "stable-weight-improving-performance",
  "poor-adherence-stable-weight",
  "recovery-limited-athlete",
  "grand-touring-recurring-class",
  "athlete-accepts-recommendation",
  "athlete-declines-recommendation",
  "athlete-defers-recommendation",
  "future-revision-while-session-frozen",
  "insight-expiration-after-phase-change",
  "insight-superseded-by-phase-response",
] as const;

export type ResponseSimulation = (typeof RESPONSE_SIMULATIONS)[number];

export const SIMULATION_LABEL: Record<ResponseSimulation, string> = {
  "insufficient-evidence": "Insufficient evidence",
  "two-comparable-successful-sessions": "Two comparable successful sessions",
  "six-comparable-successful-sessions": "Six comparable successful sessions",
  "successful-with-one-contradiction": "Successful evidence with one contradiction",
  "established-then-weakened": "Established insight weakened by new evidence",
  "genuinely-conflicting-evidence": "Evidence that genuinely conflicts",
  "productive-back-volume-range": "Productive back-volume range",
  "excessive-lower-volume": "Excessive lower-body volume pattern",
  "two-versus-three-exposures": "Two-exposure versus three-exposure frequency",
  "machine-press-outperforms-barbell": "Machine press outperforming barbell press",
  "one-painful-exposure": "One painful movement exposure",
  "three-painful-exposures": "Three repeated painful exposures",
  "conditioning-within-24-hours": "Conditioning within 24 hours of lower training",
  "conditioning-separated-72-hours": "Conditioning separated by 72 hours",
  "rapid-fat-loss-declining-performance": "Rapid fat loss with declining performance",
  "stable-weight-improving-performance": "Stable weight with improving performance",
  "poor-adherence-stable-weight": "Poor nutrition adherence with stable weight",
  "recovery-limited-athlete": "Recovery-limited athlete",
  "grand-touring-recurring-class": "Grand Touring athlete with recurring class",
  "athlete-accepts-recommendation": "Athlete accepts recommendation",
  "athlete-declines-recommendation": "Athlete declines recommendation",
  "athlete-defers-recommendation": "Athlete defers recommendation",
  "future-revision-while-session-frozen": "Future revision while a session is frozen",
  "insight-expiration-after-phase-change": "Insight expiration after phase change",
  "insight-superseded-by-phase-response": "Insight superseded by phase-specific response",
};

export const SIMULATION_NOW = "2026-08-24T09:00:00.000Z";

/* ─── Movement library ────────────────────────────────────────────────── */

const MOVEMENTS = {
  row: {
    id: "chest-supported-row", name: "Chest-Supported Row", sets: 4, reps: "8-10", suggestedLoad: 150,
    whyLoad: "Synthetic fixture load", rirTargets: ["2 RIR"], restSeconds: 120, cue: "Controlled execution",
    role: "primary", primaryMuscles: ["Back"], secondaryMuscles: ["Biceps"],
  },
  pulldown: {
    id: "lat-pulldown", name: "Lat Pulldown", sets: 3, reps: "10-12", suggestedLoad: 120,
    whyLoad: "Synthetic fixture load", rirTargets: ["2 RIR"], restSeconds: 90, cue: "Controlled execution",
    role: "secondary", primaryMuscles: ["Back"], secondaryMuscles: ["Biceps"],
  },
  machinePress: {
    id: "incline-machine-press", name: "Incline Machine Press", sets: 3, reps: "8-10", suggestedLoad: 130,
    whyLoad: "Synthetic fixture load", rirTargets: ["2 RIR"], restSeconds: 120, cue: "Controlled execution",
    role: "primary", primaryMuscles: ["Chest"], secondaryMuscles: ["Triceps", "Front Delts"],
  },
  barbellPress: {
    id: "incline-barbell-press", name: "Incline Barbell Press", sets: 3, reps: "8-10", suggestedLoad: 155,
    whyLoad: "Synthetic fixture load", rirTargets: ["2 RIR"], restSeconds: 150, cue: "Controlled execution",
    role: "primary", primaryMuscles: ["Chest"], secondaryMuscles: ["Triceps", "Front Delts"],
  },
  squat: {
    id: "hack-squat", name: "Hack Squat", sets: 4, reps: "8-10", suggestedLoad: 220,
    whyLoad: "Synthetic fixture load", rirTargets: ["2 RIR"], restSeconds: 150, cue: "Controlled execution",
    role: "primary", primaryMuscles: ["Quads"], secondaryMuscles: ["Glutes"],
  },
  legCurl: {
    id: "seated-leg-curl", name: "Seated Leg Curl", sets: 3, reps: "10-12", suggestedLoad: 90,
    whyLoad: "Synthetic fixture load", rirTargets: ["2 RIR"], restSeconds: 90, cue: "Controlled execution",
    role: "secondary", primaryMuscles: ["Hamstrings"], secondaryMuscles: ["Glutes"],
  },
};

type MovementSpec = (typeof MOVEMENTS)[keyof typeof MOVEMENTS];

function snapshot(
  date: string,
  movements: MovementSpec[],
  options: { week: number; phaseId?: string; dayIndex?: number; title?: string } = { week: 1 },
): LedgerSessionSnapshot {
  return {
    architectureId: "synthetic-response-architecture",
    architectureVersion: "synthetic-response-1",
    architectureName: "Synthetic Response Fixture",
    mesocycleId: `synthetic-response:W${options.week}`,
    generatedAt: `${date}T09:00:00.000Z`,
    splitTitle: options.title ?? "Synthetic Response Session",
    movements,
    horizonProgramId: "synthetic-response-program",
    horizonProtocolId: "synthetic-response-protocol",
    horizonArchitectureVersion: "synthetic-response-1",
    horizonWeekNumber: options.week,
    horizonPhaseId: options.phaseId ?? "accumulation",
    horizonDayIndex: options.dayIndex ?? 1,
    horizonDayTitle: options.title ?? "Synthetic Response Session",
    horizonRevisionIds: [],
    horizonSource: "program-horizon",
  };
}

type SetSpec = { load?: number; reps?: number; rir?: number; rpe?: number; pain?: number; failed?: boolean };

function session(
  id: string,
  date: string,
  movements: MovementSpec[],
  sets: Record<string, SetSpec[]>,
  options: { week: number; phaseId?: string; quality?: number; title?: string; dayIndex?: number } = { week: 1 },
): SessionExecutionRecord {
  let record = createStartedSessionExecution({
    id,
    athleteId: "synthetic-athlete",
    snapshot: snapshot(date, movements, options),
    calendarDate: date,
    startedAt: `${date}T09:00:00.000Z`,
  });
  for (const [movementId, specs] of Object.entries(sets)) {
    specs.forEach((spec, index) => {
      record = recordCompletedSet(record, movementId, {
        setNumber: index + 1,
        completedLoad: spec.load,
        completedReps: spec.reps,
        loadUnit: spec.load != null ? "lb" : undefined,
        actualRir: spec.rir,
        actualRpe: spec.rpe,
        pain: spec.pain,
        failed: spec.failed,
        // A failed set was still performed. Marking it incomplete would remove
        // it from the evidence entirely, which is the opposite of the point.
        completed: true,
        completedAt: `${date}T09:30:00.000Z`,
      }).record;
    });
  }
  if (options.quality != null) {
    record = updateSessionMetrics(record, { sessionQuality: options.quality }).record;
  }
  return finalizeSessionExecution(record, "completed", `${date}T10:30:00.000Z`).record;
}

/** N sets of the same spec — the common case. */
function reps(count: number, spec: SetSpec): SetSpec[] {
  return Array.from({ length: count }, () => ({ ...spec }));
}

function baseInput(
  records: SessionExecutionRecord[],
  extras: Partial<ResponseEvidenceInput> = {},
): ResponseEvidenceInput {
  return {
    athleteId: "synthetic-athlete",
    executionRecords: records,
    sleepLogs: records.map((record) => ({ date: record.calendarDate, hours: 7.6 })),
    readiness: records.map((record, index) => ({
      id: `ready-${index}`,
      date: record.calendarDate,
      readinessScore: 76,
      restingHeartRate: 56,
      hrv: 58,
    })) satisfies ReadinessEvidenceInput[],
    ...extras,
  };
}

/** Weekly Monday dates so week numbers and calendar dates agree. */
function weekDate(week: number, dayOffset = 0): string {
  const base = Date.parse("2026-07-06T00:00:00.000Z"); // a Monday
  return new Date(base + ((week - 1) * 7 + dayOffset) * 86_400_000).toISOString().slice(0, 10);
}

/* ─── Scenario inputs ─────────────────────────────────────────────────── */

export function buildSimulationInput(kind: ResponseSimulation): ResponseEvidenceInput {
  switch (kind) {
    case "insufficient-evidence": {
      // One finalized session. Nothing can be concluded from it.
      return baseInput([
        session("sim-1", weekDate(1), [MOVEMENTS.row], { "chest-supported-row": reps(4, { load: 150, reps: 9, rir: 2 }) }, { week: 1, quality: 7 }),
      ]);
    }

    case "two-comparable-successful-sessions": {
      return baseInput([
        session("sim-1", weekDate(1), [MOVEMENTS.row], { "chest-supported-row": reps(4, { load: 150, reps: 9, rir: 2 }) }, { week: 1, quality: 7 }),
        session("sim-2", weekDate(2), [MOVEMENTS.row], { "chest-supported-row": reps(4, { load: 155, reps: 9, rir: 2 }) }, { week: 2, quality: 7 }),
      ]);
    }

    case "six-comparable-successful-sessions": {
      return baseInput(
        Array.from({ length: 6 }, (_, index) =>
          session(
            `sim-${index + 1}`,
            weekDate(index + 1),
            [MOVEMENTS.row],
            { "chest-supported-row": reps(4, { load: 150 + index * 5, reps: 9, rir: 2 }) },
            { week: index + 1, quality: 8 },
          ),
        ),
      );
    }

    case "successful-with-one-contradiction": {
      const records = Array.from({ length: 5 }, (_, index) =>
        session(
          `sim-${index + 1}`,
          weekDate(index + 1),
          [MOVEMENTS.row],
          { "chest-supported-row": reps(4, { load: 150 + index * 5, reps: 9, rir: 2 }) },
          { week: index + 1, quality: 8 },
        ),
      );
      // One exposure goes backwards in otherwise identical conditions.
      records.push(
        session("sim-6", weekDate(6), [MOVEMENTS.row], { "chest-supported-row": reps(4, { load: 160, reps: 7, rir: 2 }) }, { week: 6, quality: 4 }),
      );
      return baseInput(records);
    }

    case "established-then-weakened": {
      const records = Array.from({ length: 6 }, (_, index) =>
        session(
          `sim-${index + 1}`,
          weekDate(index + 1),
          [MOVEMENTS.row],
          { "chest-supported-row": reps(4, { load: 150 + index * 5, reps: 9, rir: 2 }) },
          { week: index + 1, quality: 8 },
        ),
      );
      // Three consecutive declines in the same conditions.
      for (let index = 0; index < 3; index += 1) {
        records.push(
          session(
            `sim-decline-${index + 1}`,
            weekDate(7 + index),
            [MOVEMENTS.row],
            { "chest-supported-row": reps(4, { load: 175 - index * 10, reps: 7, rir: 1 }) },
            { week: 7 + index, quality: 4 },
          ),
        );
      }
      return baseInput(records);
    }

    case "genuinely-conflicting-evidence": {
      // Identical conditions, alternating outcomes. Nothing explains the
      // difference away, so Reserve should refuse to act.
      const records: SessionExecutionRecord[] = [];
      // Nine exposures give eight transitions: four up, four down. Evenly
      // split outcomes in identical conditions are what conflict means.
      const loads = [150, 160, 150, 160, 150, 160, 150, 160, 150];
      loads.forEach((load, index) => {
        records.push(
          session(`conflict-${index + 1}`, weekDate(index + 1), [MOVEMENTS.row], {
            "chest-supported-row": reps(4, { load, reps: 9, rir: 2 }),
          }, { week: index + 1, quality: index % 2 === 0 ? 8 : 4 }),
        );
      });
      return baseInput(records);
    }

    case "productive-back-volume-range": {
      const records: SessionExecutionRecord[] = [];
      // Weeks 1–4 at 14–16 back sets: progressing.
      for (let week = 1; week <= 4; week += 1) {
        records.push(
          session(`vol-a-${week}`, weekDate(week), [MOVEMENTS.row, MOVEMENTS.pulldown], {
            "chest-supported-row": reps(4, { load: 150 + week * 5, reps: 9, rir: 2 }),
            "lat-pulldown": reps(3, { load: 120, reps: 11, rir: 2 }),
          }, { week, quality: 8 }),
          session(`vol-b-${week}`, weekDate(week, 3), [MOVEMENTS.row, MOVEMENTS.pulldown], {
            "chest-supported-row": reps(4, { load: 150 + week * 5, reps: 9, rir: 2 }),
            "lat-pulldown": reps(4, { load: 120, reps: 11, rir: 2 }),
          }, { week, quality: 8, dayIndex: 4 }),
        );
      }
      // Weeks 5–6 at higher volume with worse quality and failed sets.
      for (let week = 5; week <= 6; week += 1) {
        records.push(
          session(`vol-a-${week}`, weekDate(week), [MOVEMENTS.row, MOVEMENTS.pulldown], {
            "chest-supported-row": reps(6, { load: 170, reps: 8, rir: 1, failed: true }),
            "lat-pulldown": reps(6, { load: 120, reps: 9, rir: 1 }),
          }, { week, quality: 4 }),
          session(`vol-b-${week}`, weekDate(week, 3), [MOVEMENTS.row, MOVEMENTS.pulldown], {
            "chest-supported-row": reps(5, { load: 165, reps: 7, rir: 1, failed: true }),
            "lat-pulldown": reps(6, { load: 120, reps: 9, rir: 1 }),
          }, { week, quality: 3, dayIndex: 4 }),
        );
      }
      return baseInput(records);
    }

    case "excessive-lower-volume": {
      const records: SessionExecutionRecord[] = [];
      for (let week = 1; week <= 3; week += 1) {
        records.push(
          session(`low-${week}`, weekDate(week), [MOVEMENTS.squat, MOVEMENTS.legCurl], {
            "hack-squat": reps(4, { load: 220 + week * 10, reps: 9, rir: 2 }),
            "seated-leg-curl": reps(3, { load: 90, reps: 11, rir: 2 }),
          }, { week, quality: 8 }),
        );
      }
      for (let week = 4; week <= 6; week += 1) {
        records.push(
          session(`low-${week}`, weekDate(week), [MOVEMENTS.squat, MOVEMENTS.legCurl], {
            "hack-squat": reps(8, { load: 230, reps: 7, rir: 0, failed: true }),
            "seated-leg-curl": reps(7, { load: 90, reps: 8, rir: 0 }),
          }, { week, quality: 3 }),
        );
      }
      return baseInput(records);
    }

    case "two-versus-three-exposures": {
      const records: SessionExecutionRecord[] = [];
      // Weeks 1–4: two back exposures, progressing.
      for (let week = 1; week <= 4; week += 1) {
        records.push(
          session(`freq-a-${week}`, weekDate(week), [MOVEMENTS.row], { "chest-supported-row": reps(4, { load: 150 + week * 5, reps: 9, rir: 2 }) }, { week, quality: 8 }),
          session(`freq-b-${week}`, weekDate(week, 3), [MOVEMENTS.pulldown], { "lat-pulldown": reps(4, { load: 120 + week * 5, reps: 11, rir: 2 }) }, { week, quality: 8, dayIndex: 4 }),
        );
      }
      // Week 5: a third exposure appears once — not enough to compare.
      records.push(
        session("freq-a-5", weekDate(5), [MOVEMENTS.row], { "chest-supported-row": reps(4, { load: 175, reps: 9, rir: 2 }) }, { week: 5, quality: 8 }),
        session("freq-b-5", weekDate(5, 2), [MOVEMENTS.pulldown], { "lat-pulldown": reps(4, { load: 140, reps: 11, rir: 2 }) }, { week: 5, quality: 8, dayIndex: 3 }),
        session("freq-c-5", weekDate(5, 4), [MOVEMENTS.pulldown], { "lat-pulldown": reps(3, { load: 130, reps: 11, rir: 2 }) }, { week: 5, quality: 7, dayIndex: 5 }),
      );
      return baseInput(records);
    }

    case "machine-press-outperforms-barbell": {
      const records: SessionExecutionRecord[] = [];
      for (let week = 1; week <= 7; week += 1) {
        records.push(
          session(`press-machine-${week}`, weekDate(week), [MOVEMENTS.machinePress], {
            "incline-machine-press": reps(3, { load: 130 + week * 5, reps: 9, rir: 2 }),
          }, { week, quality: 8 }),
        );
      }
      // Barbell: stalls and reports discomfort twice.
      for (let week = 1; week <= 4; week += 1) {
        records.push(
          session(`press-barbell-${week}`, weekDate(week, 3), [MOVEMENTS.barbellPress], {
            "incline-barbell-press": reps(3, { load: 155, reps: week <= 2 ? 8 : 6, rir: 1, pain: week >= 3 ? 4 : undefined }),
          }, { week, quality: 5, dayIndex: 4 }),
        );
      }
      return baseInput(records);
    }

    case "one-painful-exposure": {
      const records = [
        session("pain-1", weekDate(1), [MOVEMENTS.barbellPress], { "incline-barbell-press": reps(3, { load: 155, reps: 8, rir: 2, pain: 4 }) }, { week: 1, quality: 6 }),
        session("pain-2", weekDate(2), [MOVEMENTS.barbellPress], { "incline-barbell-press": reps(3, { load: 155, reps: 8, rir: 2 }) }, { week: 2, quality: 8 }),
      ];
      return baseInput(records);
    }

    case "three-painful-exposures": {
      const records = [1, 2, 3, 4].map((week) =>
        session(`pain-${week}`, weekDate(week), [MOVEMENTS.barbellPress], {
          "incline-barbell-press": reps(3, { load: 155, reps: 8, rir: 2, pain: week <= 3 ? 5 : undefined }),
        }, { week, quality: 5 }),
      );
      return baseInput(records);
    }

    case "conditioning-within-24-hours": {
      const records: SessionExecutionRecord[] = [];
      const activities: AthleteActivity[] = [];
      for (let week = 1; week <= 4; week += 1) {
        activities.push({
          id: `cond-${week}`,
          title: "High-Output Intervals",
          source: "athlete-added",
          recurrence: "weekly",
          date: weekDate(week, 1),
          dayOfWeek: 1,
          // Evening conditioning followed by a next-morning lower session is
          // genuinely inside 24 hours, which is the case being modelled.
          startTime: "18:00",
          durationMinutes: 45,
          location: "outdoor",
          activityType: "conditioning",
          focusAreas: ["conditioning", "lower body"],
          intensity: "high",
          relationship: "supplement",
        });
        // Lower session the next morning, consistently poor.
        records.push(
          session(`cond-lower-${week}`, weekDate(week, 2), [MOVEMENTS.squat], {
            "hack-squat": reps(4, { load: 210, reps: 7, rir: 1, failed: true }),
          }, { week, quality: 4, dayIndex: 3 }),
        );
      }
      return baseInput(records, { activities });
    }

    case "conditioning-separated-72-hours": {
      const records: SessionExecutionRecord[] = [];
      const activities: AthleteActivity[] = [];
      for (let week = 1; week <= 4; week += 1) {
        activities.push({
          id: `cond-${week}`,
          title: "High-Output Intervals",
          source: "athlete-added",
          recurrence: "weekly",
          date: weekDate(week, 0),
          dayOfWeek: 0,
          startTime: "06:00",
          durationMinutes: 45,
          location: "outdoor",
          activityType: "conditioning",
          focusAreas: ["conditioning", "lower body"],
          intensity: "high",
          relationship: "supplement",
        });
        records.push(
          session(`cond-lower-${week}`, weekDate(week, 3), [MOVEMENTS.squat], {
            "hack-squat": reps(4, { load: 220 + week * 5, reps: 9, rir: 2 }),
          }, { week, quality: 8, dayIndex: 4 }),
        );
      }
      return baseInput(records, { activities });
    }

    case "rapid-fat-loss-declining-performance": {
      const records = [1, 2, 3, 4, 5].map((week) =>
        session(`cut-${week}`, weekDate(week), [MOVEMENTS.squat], {
          "hack-squat": reps(4, { load: 240 - week * 8, reps: 8, rir: 1 }),
        }, { week, quality: 4 }),
      );
      const bodyComposition: BodyCompositionInput[] = [1, 2, 3, 4, 5].map((week) => ({
        id: `bw-${week}`,
        observedAt: `${weekDate(week)}T07:00:00.000Z`,
        bodyWeightLb: 210 - (week - 1) * 3.5,
        source: "synthetic",
      }));
      const nutrition: NutritionEvidenceInput[] = [1, 2, 3, 4, 5].map((week) => ({
        id: `nut-${week}`,
        observedAt: `${weekDate(week)}T20:00:00.000Z`,
        nutritionPhase: "cut",
        calorieTarget: 2400,
        calorieActual: 2350,
        proteinTarget: 190,
        proteinActual: 185,
        adherence: 0.92,
        source: "synthetic",
      }));
      return baseInput(records, { bodyComposition, nutrition });
    }

    case "stable-weight-improving-performance": {
      const records = [1, 2, 3, 4, 5].map((week) =>
        session(`recomp-${week}`, weekDate(week), [MOVEMENTS.squat], {
          "hack-squat": reps(4, { load: 220 + week * 7, reps: 9, rir: 2 }),
        }, { week, quality: 8 }),
      );
      const bodyComposition: BodyCompositionInput[] = [1, 2, 3, 4, 5].map((week) => ({
        id: `bw-${week}`,
        observedAt: `${weekDate(week)}T07:00:00.000Z`,
        bodyWeightLb: 190 + (week % 2 === 0 ? 0.3 : -0.2),
        source: "synthetic",
      }));
      const nutrition: NutritionEvidenceInput[] = [1, 3, 5].map((week) => ({
        id: `nut-${week}`,
        observedAt: `${weekDate(week)}T20:00:00.000Z`,
        nutritionPhase: "recomp",
        calorieTarget: 2800,
        calorieActual: 2790,
        proteinTarget: 190,
        proteinActual: 188,
        adherence: 0.94,
        source: "synthetic",
      }));
      return baseInput(records, { bodyComposition, nutrition });
    }

    case "poor-adherence-stable-weight": {
      const records = [1, 2, 3].map((week) =>
        session(`adh-${week}`, weekDate(week), [MOVEMENTS.squat], {
          "hack-squat": reps(4, { load: 220, reps: 9, rir: 2 }),
        }, { week, quality: 7 }),
      );
      const bodyComposition: BodyCompositionInput[] = [1, 2, 3].map((week) => ({
        id: `bw-${week}`,
        observedAt: `${weekDate(week)}T07:00:00.000Z`,
        bodyWeightLb: 205,
        adherence: 0.5,
        source: "synthetic",
      }));
      const nutrition: NutritionEvidenceInput[] = [1, 2, 3].map((week) => ({
        id: `nut-${week}`,
        observedAt: `${weekDate(week)}T20:00:00.000Z`,
        nutritionPhase: "cut",
        calorieTarget: 2300,
        adherence: 0.5,
        source: "synthetic",
      }));
      return baseInput(records, { bodyComposition, nutrition });
    }

    case "recovery-limited-athlete": {
      const records = [1, 2, 3, 4].map((week) =>
        session(`rec-${week}`, weekDate(week), [MOVEMENTS.squat], {
          "hack-squat": reps(4, { load: 200, reps: 8, rir: 2 }),
        }, { week, quality: week % 2 === 0 ? 8 : 3 }),
      );
      return {
        athleteId: "synthetic-athlete",
        executionRecords: records,
        // Alternating short and adequate sleep, actually recorded.
        sleepLogs: records.map((record, index) => ({ date: record.calendarDate, hours: index % 2 === 0 ? 5.2 : 7.8 })),
        readiness: records.map((record, index) => ({
          id: `ready-${index}`,
          date: record.calendarDate,
          readinessScore: index % 2 === 0 ? 44 : 78,
        })),
      };
    }

    case "grand-touring-recurring-class": {
      const records: SessionExecutionRecord[] = [];
      const activities: AthleteActivity[] = [];
      for (let week = 1; week <= 4; week += 1) {
        activities.push({
          id: `class-${week}`,
          title: "Friday Lower-Body Group Class",
          source: "athlete-added",
          recurrence: "weekly",
          date: weekDate(week, 4),
          dayOfWeek: 4,
          startTime: "05:45",
          durationMinutes: 60,
          location: "studio",
          activityType: "group-fitness",
          focusAreas: ["lower body", "legs", "glutes"],
          intensity: "high",
          relationship: "reserve-decides",
        });
        // The planned Friday posterior-lower session runs the same day, hours
        // after the class — the real collision from this athlete's week.
        records.push(
          session(`gt-lower-${week}`, weekDate(week, 4), [MOVEMENTS.squat], {
            "hack-squat": reps(4, { load: 215, reps: 7, rir: 1, failed: true }),
          }, { week, quality: 4, dayIndex: 5 }),
        );
      }
      return baseInput(records, { activities });
    }

    case "athlete-accepts-recommendation":
    case "athlete-declines-recommendation":
    case "athlete-defers-recommendation":
    case "future-revision-while-session-frozen":
      // These reuse the volume scenario, which reliably produces one
      // approval-required recommendation to decide on.
      return buildSimulationInput("productive-back-volume-range");

    case "insight-expiration-after-phase-change": {
      // Evidence stops eight weeks before "now", so the insight goes stale.
      const records = [1, 2, 3, 4].map((week) =>
        session(`old-${week}`, weekDate(week), [MOVEMENTS.row], {
          "chest-supported-row": reps(4, { load: 150 + week * 5, reps: 9, rir: 2 }),
        }, { week, phaseId: "accumulation", quality: 8 }),
      );
      return baseInput(records);
    }

    case "insight-superseded-by-phase-response": {
      const records: SessionExecutionRecord[] = [];
      // Surplus phase: high volume works.
      for (let week = 1; week <= 4; week += 1) {
        records.push(
          session(`sur-${week}`, weekDate(week), [MOVEMENTS.machinePress], {
            "incline-machine-press": reps(6, { load: 130 + week * 5, reps: 9, rir: 2 }),
          }, { week, phaseId: "surplus-accumulation", quality: 8 }),
        );
      }
      return baseInput(records);
    }

    default:
      return baseInput([]);
  }
}

/* ─── Running a simulation ────────────────────────────────────────────── */

export type SimulationResult = BuildResponseModelResult & {
  kind: ResponseSimulation;
  label: string;
  note: string;
};

const SIMULATION_NOTE: Partial<Record<ResponseSimulation, string>> = {
  "insufficient-evidence": "One finalized session cannot establish anything. Every domain should remain insufficient.",
  "two-comparable-successful-sessions": "Two comparable observations may reach emerging, never moderate.",
  "six-comparable-successful-sessions": "Repeated comparable evidence across six weeks can reach established.",
  "successful-with-one-contradiction": "The contradiction stays visible and caps confidence without erasing the supporting evidence.",
  "established-then-weakened": "New contradicting evidence weakens a previously strong pattern rather than deleting it.",
  "genuinely-conflicting-evidence": "Evidence that alternates in identical conditions conflicts, and a conflicted insight cannot drive a change.",
  "productive-back-volume-range": "A productive range emerges with decline above it, which is the case volume adjustment exists for.",
  "excessive-lower-volume": "Higher lower-body volume weeks coincide with failed sets and lower session quality.",
  "two-versus-three-exposures": "Two exposures are well evidenced; the third has not been repeated enough to compare.",
  "machine-press-outperforms-barbell": "Machine and barbell variations stay separate and are judged independently.",
  "one-painful-exposure": "One painful exposure is recorded and monitored. It never bans an exercise.",
  "three-painful-exposures": "Repeated comparable discomfort becomes an emerging concern.",
  "conditioning-within-24-hours": "A repeated performance relationship, not timing alone, supports an interference insight.",
  "conditioning-separated-72-hours": "Well separated conditioning produces no interference insight.",
  "rapid-fat-loss-declining-performance": "Demand review, never automatic cardio.",
  "stable-weight-improving-performance": "A stable scale with improving performance is compatible with recomposition, not proof of it.",
  "poor-adherence-stable-weight": "Incomplete adherence blocks any intake change.",
  "recovery-limited-athlete": "Recorded short sleep tracks lower session quality.",
  "grand-touring-recurring-class": "The recurring class is real load and shows up against the following lower session.",
  "athlete-accepts-recommendation": "Accepting creates exactly one revision affecting only future unstarted weeks.",
  "athlete-declines-recommendation": "Declining leaves the horizon untouched and records the decision.",
  "athlete-defers-recommendation": "Deferring leaves the recommendation pending without re-asking.",
  "future-revision-while-session-frozen": "A frozen started session is never rewritten by a future revision.",
  "insight-expiration-after-phase-change": "Evidence that stops producing comparable exposures ages into an archived insight.",
  "insight-superseded-by-phase-response": "A phase-specific response supersedes rather than contradicts the earlier one.",
};

export function runResponseSimulation(
  kind: ResponseSimulation,
  options: { now?: string; previousModel?: BuildResponseModelResult["model"] | null } = {},
): SimulationResult {
  const now = options.now ?? SIMULATION_NOW;
  const result = buildResponseModel({
    evidenceInput: buildSimulationInput(kind),
    previousModel: options.previousModel ?? null,
    context: {
      now,
      programId: "synthetic-response-program",
      currentPhaseId: kind === "insight-superseded-by-phase-response" ? "deficit-retention" : "accumulation",
      currentNutritionPhase:
        kind === "rapid-fat-loss-declining-performance" || kind === "poor-adherence-stable-weight"
          ? "cut"
          : kind === "insight-superseded-by-phase-response"
            ? "cut"
            : "maintenance",
      completedWeeks: 4,
      currentWeek: 5,
      protectedWeeks: kind === "future-revision-while-session-frozen" ? [5, 6] : [],
    },
  });
  return {
    ...result,
    kind,
    label: SIMULATION_LABEL[kind],
    note: SIMULATION_NOTE[kind] ?? "Synthetic development simulation.",
  };
}

/** A record that is STARTED but not finalized — used to prove unfinalized
    sessions never contribute conclusions and frozen sessions never mutate. */
export function frozenStartedSession(): SessionExecutionRecord {
  let record = createStartedSessionExecution({
    id: "frozen-session",
    athleteId: "synthetic-athlete",
    snapshot: snapshot(weekDate(5), [MOVEMENTS.squat], { week: 5 }),
    calendarDate: weekDate(5),
    startedAt: `${weekDate(5)}T09:00:00.000Z`,
  });
  record = recordCompletedSet(record, "hack-squat", {
    setNumber: 1, completedLoad: 220, completedReps: 9, loadUnit: "lb", completed: true,
    completedAt: `${weekDate(5)}T09:15:00.000Z`,
  }).record;
  return record;
}

/** A planned session that was skipped — proves skipped work contributes nothing. */
export function skippedSession(): SessionExecutionRecord {
  const planned = createPlannedSessionExecution({
    id: "skipped-session",
    athleteId: "synthetic-athlete",
    snapshot: snapshot(weekDate(2), [MOVEMENTS.row], { week: 2 }),
    calendarDate: weekDate(2),
  });
  return transitionSessionStatus(planned, "skipped", `${weekDate(2)}T20:00:00.000Z`, "Synthetic skip").record;
}

/** A session where the athlete substituted a movement for pain. */
export function painSubstitutionSession(): SessionExecutionRecord {
  let record = createStartedSessionExecution({
    id: "pain-substitution",
    athleteId: "synthetic-athlete",
    snapshot: snapshot(weekDate(3), [MOVEMENTS.barbellPress], { week: 3 }),
    calendarDate: weekDate(3),
    startedAt: `${weekDate(3)}T09:00:00.000Z`,
  });
  record = substituteMovement(record, "incline-barbell-press", "Incline Machine Press", "Pain", `${weekDate(3)}T09:05:00.000Z`).record;
  record = updateMovementFeedback(record, "incline-barbell-press", { pain: 5, notes: "Athlete-reported shoulder discomfort" }, `${weekDate(3)}T09:40:00.000Z`).record;
  return finalizeSessionExecution(record, "completed", `${weekDate(3)}T10:00:00.000Z`).record;
}

export { weekDate as simulationWeekDate };
