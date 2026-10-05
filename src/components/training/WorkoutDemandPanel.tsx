"use client";

import { useMemo } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { buildRecoverySnapshot } from "@/lib/recovery/engine";
import {
  WORKOUT_DEMAND_META,
  WORKOUT_DEMAND_ORDER,
  defaultWorkoutDemand,
  gateWorkoutDemand,
  type DemandGateResult,
  type WorkoutDemandLevel,
} from "@/lib/training/workout-demand";

const GOLD = "#d5b15f";

type TrainingAge = "beginner" | "intermediate" | "advanced";
const AGE_RANK: Record<TrainingAge, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Store-wired demand gate — one source of truth for every surface. */
export function useWorkoutDemandGate(): {
  requested: WorkoutDemandLevel | null;
  setWorkoutDemand: (level: WorkoutDemandLevel) => void;
  gate: DemandGateResult;
  trainingAge: TrainingAge;
} {
  const requested = useAthleteDashboardStore((s) => s.workoutDemand);
  const setWorkoutDemand = useAthleteDashboardStore((s) => s.setWorkoutDemand);
  const trainingExperience = useAthleteDashboardStore((s) => s.trainingExperience);
  const recoveryCommand = useAthleteDashboardStore((s) => s.recoveryCommand);

  const trainingAge: TrainingAge = (["beginner", "intermediate", "advanced"] as const).includes(
    trainingExperience as TrainingAge,
  )
    ? (trainingExperience as TrainingAge)
    : "intermediate";

  const gate = useMemo(() => {
    const snap = buildRecoverySnapshot(recoveryCommand, new Date());
    return gateWorkoutDemand(requested ?? defaultWorkoutDemand(trainingAge), {
      trainingAge,
      readiness: snap.hasData ? snap.reserve : null,
      activePainFlags: 0,
      deload: false,
    });
  }, [requested, trainingAge, recoveryCommand]);

  return { requested, setWorkoutDemand, gate, trainingAge };
}

/** Workout Demand selector — the member's session-depth tier. The gate result
 *  is displayed honestly: a capped tier says why, and the effective tier is
 *  what actually builds the session. */
export function WorkoutDemandPanel({
  requested,
  effective,
  limited,
  reason,
  trainingAge,
  onSelect,
  note,
}: {
  requested: WorkoutDemandLevel;
  effective: WorkoutDemandLevel;
  limited: boolean;
  reason: string | null;
  trainingAge: TrainingAge;
  onSelect: (level: WorkoutDemandLevel) => void;
  /** Optional context line (e.g. live-session immutability note). */
  note?: string | null;
}) {
  return (
    <div className="border-t border-white/[0.06] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-[#8ea0b8]/80">Workout Demand</p>
          <p className="mt-0.5 text-[11px] leading-5 text-white/45">
            How deep your sessions run. Intelligently limited by training age, readiness, and recovery.
          </p>
        </div>
        <span
          className="rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.16em]"
          style={{ borderColor: `${GOLD}40`, color: GOLD, background: `${GOLD}10` }}
        >
          Active · {WORKOUT_DEMAND_META[effective].label}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {WORKOUT_DEMAND_ORDER.map((level) => {
          const meta = WORKOUT_DEMAND_META[level];
          const locked = AGE_RANK[trainingAge] < AGE_RANK[meta.minTrainingAge];
          const selected = requested === level;
          return (
            <button
              key={level}
              type="button"
              disabled={locked}
              onClick={() => onSelect(level)}
              className="rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                borderColor: selected ? `${GOLD}55` : "rgba(255,255,255,0.07)",
                background: selected ? `${GOLD}10` : "rgba(255,255,255,0.02)",
              }}
              title={locked ? "Unlocks as your training history builds." : meta.tagline}
            >
              <span className="block text-[12px] font-bold" style={{ color: selected ? GOLD : "#ece8df" }}>
                {meta.label}
              </span>
              <span className="mt-1 block text-[9.5px] leading-4 text-white/38">{meta.tagline}</span>
              {locked && (
                <span className="mt-1.5 block font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/30">
                  Requires {meta.minTrainingAge}+
                </span>
              )}
            </button>
          );
        })}
      </div>
      {limited && reason && (
        <p className="mt-3 rounded-lg bg-[#e8c87a]/[0.06] px-3 py-2 text-[10.5px] leading-4 text-[#e8c87a]/90">
          {reason} Running {WORKOUT_DEMAND_META[effective].label} today.
        </p>
      )}
      {note && (
        <p className="mt-3 text-[10px] leading-4 text-white/35">{note}</p>
      )}
    </div>
  );
}

/** Self-wired panel for surfaces outside Training Command (Personal Command). */
export function ConnectedWorkoutDemandPanel() {
  const { requested, setWorkoutDemand, gate, trainingAge } = useWorkoutDemandGate();
  const liveSession = useAthleteDashboardStore((s) => s.trainingSession.sessionMode === "live");
  return (
    <WorkoutDemandPanel
      requested={requested ?? gate.requested}
      effective={gate.effective}
      limited={gate.limited}
      reason={gate.reason}
      trainingAge={trainingAge}
      onSelect={setWorkoutDemand}
      note={
        liveSession
          ? "A session is live right now — it keeps the demand it was built with. Your change applies when you rebuild it (zero progress) or to the next session."
          : null
      }
    />
  );
}
