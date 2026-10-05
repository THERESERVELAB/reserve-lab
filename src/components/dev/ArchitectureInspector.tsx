"use client";

/* ════════════════════════════════════════════════════════════════════════
   TRAINING ARCHITECTURE INSPECTOR — development quality control.

   Proves the generated program is real: pick a protocol and an athlete
   fixture, edit the athlete, and inspect the derived profile, the suitability
   score, the personalized explanation, every projected week, the structural
   signature, and the raw JSON.

   Development-only. Never linked from member navigation.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";

import { ResponseEvidenceInspector } from "@/components/dev/ResponseEvidenceInspector";
import { ResponseModelInspector } from "@/components/dev/ResponseModelInspector";

import { ATHLETE_FIXTURES, FRIDAY_LOWER_CLASS } from "@/lib/athlete/fixtures";
import { deriveProgrammingProfile } from "@/lib/athlete/programming-profile";
import { buildAthleteSnapshot, type AthleteSnapshotInput } from "@/lib/athlete/snapshot";
import { generateProgramHorizon, getOriginalWeek, getWeek } from "@/lib/horizon/generate";
import { applyActivityToHorizon, previewActivity } from "@/lib/horizon/revise";
import { PROTOCOL_LIBRARY } from "@/lib/protocol/library";
import { FAMILY_LABEL, PROTOCOL_DNA, getProtocolDNA } from "@/lib/training/protocol-dna";
import { rankProtocolSuitability, SUITABILITY_LABEL } from "@/lib/training/protocol-suitability";
import { compareProtocolStructures, structuralSignature } from "@/lib/training/structural-signature";
import { useActiveProgram } from "@/lib/hooks/useActiveProgram";
import { useAthleteDashboardStore, type SessionGenerationSnapshot } from "@/lib/athlete-store";
import {
  addMovement,
  createPlannedSessionExecution,
  createStartedSessionExecution,
  finalizeSessionExecution,
  migrateLegacyExecutionHistory,
  recordCompletedSet,
  relateFutureRevision,
  skipMovement,
  substituteMovement,
  summarizeWeekExecution,
  transitionSessionStatus,
  updateMovementFeedback,
  type LedgerSessionSnapshot,
  type ReserveDecisionRecord,
  type SessionExecutionRecord,
  type WeekExecutionSummary,
} from "@/lib/training/session-execution";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PROTOCOL_IDS = Object.keys(PROTOCOL_DNA).sort();

type ExecutionSimulation = {
  record: SessionExecutionRecord | null;
  summary: WeekExecutionSummary | null;
  decisions: ReserveDecisionRecord[];
  note: string;
};

const SIMULATION_OPTIONS = [
  "fully-completed-session",
  "partial-session",
  "skipped-session",
  "replaced-session",
  "added-exercise",
  "pain-substitution",
  "refresh-during-active-session",
  "future-horizon-revision-during-active-session",
  "protocol-change-during-active-session",
  "legacy-session-migration",
] as const;

function simulationSnapshot(frozen?: SessionGenerationSnapshot | null): LedgerSessionSnapshot {
  if (frozen) return frozen;
  return {
    architectureId: "dev-ledger-simulation",
    architectureVersion: "dev-ledger-1",
    architectureName: "Development Ledger Fixture",
    mesocycleId: "dev-program:W1",
    generatedAt: "2026-07-22T12:00:00.000Z",
    splitTitle: "Development Lower Session",
    movements: [
      { id: "dev-squat", name: "Pendulum Squat", sets: 2, reps: "8-10", suggestedLoad: 0, whyLoad: "No load inferred", rirTargets: ["3 RIR", "2 RIR"], restSeconds: 120, cue: "Controlled execution" },
      { id: "dev-curl", name: "Seated Leg Curl", sets: 2, reps: "10-12", suggestedLoad: 0, whyLoad: "No load inferred", rirTargets: ["3 RIR", "2 RIR"], restSeconds: 90, cue: "Controlled execution" },
    ],
    horizonProgramId: "dev-program",
    horizonProtocolId: "dev-protocol",
    horizonArchitectureVersion: "dev-ledger-1",
    horizonWeekNumber: 1,
    horizonPhaseId: "dev-phase",
    horizonDayIndex: 4,
    horizonDayTitle: "Development Lower Session",
    horizonRevisionIds: [],
    horizonSource: "program-horizon",
  };
}

function runExecutionSimulation(
  kind: (typeof SIMULATION_OPTIONS)[number],
  frozen?: SessionGenerationSnapshot | null,
): ExecutionSimulation {
  const snapshot = simulationSnapshot(frozen);
  const at = "2026-07-22T12:05:00.000Z";
  if (kind === "legacy-session-migration") {
    const migrated = migrateLegacyExecutionHistory({
      sessionHistory: [{ id: "legacy-dev", date: "2026-07-01T18:00:00.000Z", sessionName: "Legacy Session", weekLabel: "Week 1", phaseLabel: "Legacy", completionStatus: "partial" }],
    });
    return { record: migrated.records[0] ?? null, summary: null, decisions: migrated.decisions, note: "Legacy record migrated once without fabricated prescriptions or sets." };
  }
  let record = createStartedSessionExecution({ id: `dev:${kind}`, snapshot, calendarDate: "2026-07-22", startedAt: at });
  if (kind === "skipped-session" || kind === "replaced-session") {
    let planned = createPlannedSessionExecution({ id: `dev:${kind}`, snapshot, calendarDate: "2026-07-22", replacementActivityId: kind === "replaced-session" ? "friday-class" : undefined });
    planned = transitionSessionStatus(planned, kind === "skipped-session" ? "skipped" : "replaced", at, "Development simulation").record;
    return { record: planned, summary: summarizeWeekExecution({ programId: planned.programId!, weekNumber: 1, plannedSessionCount: 1, records: [planned], createdAt: at }), decisions: [], note: "Original plan remains attached to the terminal outcome." };
  }
  if (kind === "fully-completed-session") {
    for (const movement of record.movements) {
      for (let setNumber = 1; setNumber <= (movement.plannedPrescription.sets ?? 0); setNumber += 1) {
        record = recordCompletedSet(record, movement.id, { setNumber, completedReps: 10, completed: true, completedAt: at }).record;
      }
    }
    record = finalizeSessionExecution(record, "completed", "2026-07-22T13:00:00.000Z").record;
  } else if (kind === "partial-session") {
    record = recordCompletedSet(record, record.movements[0].id, { setNumber: 1, completedReps: 8, completed: true, completedAt: at }).record;
    record = skipMovement(record, record.movements[1].id, "Time constraint", at).record;
    record = finalizeSessionExecution(record, "partial", "2026-07-22T12:35:00.000Z", { endReason: "Time constraint" }).record;
  } else if (kind === "added-exercise") {
    record = addMovement(record, { id: "dev-added", name: "Athlete Added Carry", sets: 1, reps: "40 m", reason: "Wanted loaded carry practice" }, at).record;
    record = recordCompletedSet(record, "dev-added", { setNumber: 1, completed: true, completedAt: at }).record;
  } else if (kind === "pain-substitution") {
    record = substituteMovement(record, record.movements[0].id, "Belt Squat", "Pain", at).record;
    record = updateMovementFeedback(record, record.movements[0].id, { pain: 4, notes: "Athlete-reported discomfort" }, at).record;
  } else if (kind === "refresh-during-active-session") {
    record = recordCompletedSet(record, record.movements[0].id, { setNumber: 1, completedReps: 8, completed: true, completedAt: at }).record;
    record = JSON.parse(JSON.stringify(record)) as SessionExecutionRecord;
  } else if (kind === "future-horizon-revision-during-active-session") {
    record = relateFutureRevision(record, "dev-future-revision", at);
  }
  const note = kind === "protocol-change-during-active-session"
    ? "Protocol selection is deferred by the store; the frozen session remains unchanged."
    : "Structured development simulation only; member state was not changed.";
  const summary = record.programId && record.weekNumber != null
    ? summarizeWeekExecution({ programId: record.programId, weekNumber: record.weekNumber, plannedSessionCount: 1, records: [record], createdAt: at })
    : null;
  return { record, summary, decisions: [], note };
}

function protocolName(id: string): string {
  return PROTOCOL_LIBRARY.find((p) => p.id === id)?.name ?? id;
}

/* ─── Small presentational helpers ────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{title}</h3>
      {children}
    </section>
  );
}

function Bullets({ items, tone = "default" }: { items: string[]; tone?: "default" | "warn" | "good" }) {
  if (items.length === 0) return <p className="text-sm text-white/30">None.</p>;
  const color = tone === "warn" ? "text-amber-200/80" : tone === "good" ? "text-emerald-200/80" : "text-white/70";
  return (
    <ul className={`space-y-1.5 text-sm leading-relaxed ${color}`}>
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Field({
  label, value, onChange, type = "text", options,
}: {
  label: string;
  value: string | number | undefined;
  onChange: (v: string) => void;
  type?: "text" | "number";
  options?: string[];
}) {
  const id = `field-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">{label}</span>
      {options ? (
        <select
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus-visible:border-white/40"
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={type}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus-visible:border-white/40"
        />
      )}
    </label>
  );
}

/* ─── The inspector ───────────────────────────────────────────────────── */

export function ArchitectureInspector() {
  const liveProgram = useActiveProgram();
  const frozenSession = useAthleteDashboardStore((state) => state.trainingSession.generation);
  const activeExecution = useAthleteDashboardStore((state) => state.trainingSession.executionRecord);
  const executionHistory = useAthleteDashboardStore((state) => state.trainingSession.executionHistory);
  const weekExecutionSummaries = useAthleteDashboardStore((state) => state.trainingSession.weekExecutionSummaries);
  const decisionHistory = useAthleteDashboardStore((state) => state.trainingSession.decisionHistory);
  const writeOnboardingProfile = useAthleteDashboardStore((state) => state.writeOnboardingProfile);
  const setProgramHorizon = useAthleteDashboardStore((state) => state.setProgramHorizon);
  const liveResolution = liveProgram.resolution;
  const [fixtureId, setFixtureId] = useState(ATHLETE_FIXTURES[0].id);
  const [overrides, setOverrides] = useState<Partial<AthleteSnapshotInput>>({});
  const [protocolId, setProtocolId] = useState("classic-physique-build");
  const [compareId, setCompareId] = useState("12-week-physique");
  const [totalWeeks, setTotalWeeks] = useState(12);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [fridayClass, setFridayClass] = useState<"none" | "one-time" | "recurring">("none");
  const [simulationKind, setSimulationKind] = useState<(typeof SIMULATION_OPTIONS)[number]>("fully-completed-session");
  const simulation = useMemo(() => runExecutionSimulation(simulationKind, frozenSession), [frozenSession, simulationKind]);

  const fixture = ATHLETE_FIXTURES.find((f) => f.id === fixtureId)!;

  const snapshot = useMemo(
    () => buildAthleteSnapshot({ ...fixture.input, ...overrides }),
    [fixture, overrides],
  );
  const profile = useMemo(() => deriveProgrammingProfile(snapshot), [snapshot]);
  const ranking = useMemo(() => rankProtocolSuitability(snapshot, profile), [snapshot, profile]);

  const baseHorizon = useMemo(
    () => generateProgramHorizon({
      protocolId, snapshot, profile, totalWeeks,
      athleteChoseManually: protocolId !== ranking.recommended.protocolId,
      startDate: "2026-07-20",
    }),
    [protocolId, snapshot, profile, totalWeeks, ranking.recommended.protocolId],
  );

  const horizon = useMemo(() => {
    if (!baseHorizon || fridayClass === "none") return baseHorizon;
    const activity = { ...FRIDAY_LOWER_CLASS, recurrence: fridayClass === "recurring" ? ("weekly" as const) : ("one-time" as const) };
    const applied = applyActivityToHorizon({ horizon: baseHorizon, activity, athleteConfirmed: true });
    return applied.blocked ? baseHorizon : applied.horizon;
  }, [baseHorizon, fridayClass]);

  const activityPreview = useMemo(() => {
    if (!baseHorizon || fridayClass === "none") return null;
    const activity = { ...FRIDAY_LOWER_CLASS, recurrence: fridayClass === "recurring" ? ("weekly" as const) : ("one-time" as const) };
    return previewActivity(baseHorizon, activity);
  }, [baseHorizon, fridayClass]);

  const dna = getProtocolDNA(protocolId);
  const suitability = ranking.all.find((s) => s.protocolId === protocolId) ?? null;
  const comparison = useMemo(() => compareProtocolStructures(protocolId, compareId), [protocolId, compareId]);

  const week = horizon ? getWeek(horizon, selectedWeek) : null;
  const originalWeek = horizon ? getOriginalWeek(horizon, selectedWeek) : null;
  const day = week && selectedDay != null ? week.weeklyStructure[selectedDay] : null;

  const set = (key: keyof AthleteSnapshotInput, raw: string, numeric = false) => {
    setOverrides((prev) => ({
      ...prev,
      [key]: raw === "" ? undefined : numeric ? Number(raw) : raw,
    }));
  };

  const jumpWeeks = [1, 4, 8, 12, totalWeeks].filter((n, i, a) => n <= totalWeeks && a.indexOf(n) === i);

  const loadPreviewIntoLiveRuntime = () => {
    if (!horizon) return;
    const activationDate = new Date(`${horizon.startDate}T12:00:00.000Z`);
    writeOnboardingProfile({
      profile: { persona: "advanced" },
      persona: "advanced",
      protocolId,
      protocolOptions: { durationWeeks: totalWeeks, now: activationDate },
      completeOnboarding: true,
      markSetupComplete: true,
    });
    const recurringActivity = fridayClass === "recurring"
      ? { ...FRIDAY_LOWER_CLASS, recurrence: "weekly" as const }
      : undefined;
    setProgramHorizon(horizon, recurringActivity);
  };

  return (
    <main className="min-h-screen bg-[#07080c] px-3 py-6 text-white sm:px-6 sm:py-8">
      <header className="mb-6 border-b border-white/10 pb-5">
        <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/70">Development only · not in member navigation</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          Training Architecture Inspector
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-white/45">
          Select an athlete and a protocol, edit the athlete, and inspect what the engine actually generates —
          the derived profile, the suitability result, the personalized explanation, and every projected week.
        </p>
        <label className="mt-4 flex max-w-sm flex-col gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-100/65">Live runtime action</span>
          <select
            aria-label="Live runtime action"
            value=""
            onChange={(event) => {
              if (event.target.value === "load") loadPreviewIntoLiveRuntime();
            }}
            disabled={!horizon}
            className="rounded border border-amber-300/30 bg-black/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100 outline-none disabled:cursor-not-allowed disabled:opacity-30"
          >
            <option value="">Choose action</option>
            <option value="load">Load preview into live runtime</option>
          </select>
        </label>
      </header>

      {/* ── Live execution authority ── */}
      <div className="mb-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Section title="Active Program Resolution">
          {liveResolution ? (
            <>
              <dl className="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[180px_1fr]">
                {[
                  ["Program ID", liveResolution.programId],
                  ["Protocol ID", liveResolution.protocolId],
                  ["Architecture", `${liveResolution.architectureName} · ${liveResolution.architectureVersion}`],
                  ["Current position", `Week ${liveResolution.currentWeekNumber} · ${liveResolution.currentPhaseName}`],
                  ["Selected day", `${DAY_NAMES[liveResolution.selectedDayIndex]} · ${liveResolution.selectedDay.title}`],
                  ["Status", liveResolution.status],
                  ["Source", liveResolution.source],
                  ["Revision IDs", liveResolution.revisionIds.join(", ") || "None"],
                ].map(([label, value]) => <div key={label} className="contents"><dt className="text-white/35">{label}</dt><dd className="break-all text-white/75">{value}</dd></div>)}
              </dl>
              <p className="mb-1 mt-4 text-[10px] uppercase tracking-[0.14em] text-white/30">Fallback path / assumptions</p>
              <Bullets items={liveResolution.assumptions} tone="warn" />
            </>
          ) : (
            <>
              <p className="text-sm text-white/55">No executable Program Horizon.</p>
              <Bullets items={liveProgram.assumptions} tone="warn" />
            </>
          )}
        </Section>

        <Section title="Consumer sources + frozen session">
          <dl className="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[190px_1fr]">
            {[
              ["Training Command source", liveResolution?.source ?? "explicit-fallback"],
              ["Apex source", liveResolution?.source ?? "explicit-fallback"],
              ["Core Command source", frozenSession?.horizonSource ?? liveResolution?.source ?? "explicit-fallback"],
              ["Mesocycle source", liveResolution?.source ?? "explicit-fallback"],
              ["Nutrition demand source", liveResolution ? `Horizon week ${liveResolution.nutritionDemand.weekNumber}` : "explicit-fallback"],
              ["Recovery demand source", liveResolution ? `Horizon week ${liveResolution.recoveryDemand.weekNumber}` : "explicit-fallback"],
              ["Frozen session", frozenSession ? `${frozenSession.splitTitle} · ${frozenSession.generatedAt}` : "None"],
              ["Frozen Horizon reference", frozenSession?.horizonProgramId ? `${frozenSession.horizonProgramId} · W${frozenSession.horizonWeekNumber} · ${frozenSession.horizonDayTitle}` : "None"],
              ["Frozen revision IDs", frozenSession?.horizonRevisionIds?.join(", ") || "None"],
            ].map(([label, value]) => <div key={label} className="contents"><dt className="text-white/35">{label}</dt><dd className="break-all text-white/75">{value}</dd></div>)}
          </dl>
          {frozenSession?.horizonWeekSnapshot && (
            <details className="mt-4 rounded border border-white/10 bg-black/30 p-2.5">
              <summary className="cursor-pointer text-xs text-white/60">Compare frozen Horizon week JSON</summary>
              <pre className="mt-2 max-h-64 overflow-auto text-[10px] leading-relaxed text-white/45">{JSON.stringify(frozenSession.horizonWeekSnapshot, null, 2)}</pre>
            </details>
          )}
        </Section>
      </div>

      {/* ── Session execution ledger ── */}
      <div className="mb-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Section title="Live session execution integrity">
          {activeExecution ? (
            <>
              <dl className="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[190px_1fr]">
                {[
                  ["Record / status", `${activeExecution.id} · ${activeExecution.status}`],
                  ["Program position", `${activeExecution.programId ?? "unlinked"} · W${activeExecution.weekNumber ?? "—"} · ${activeExecution.phaseName ?? activeExecution.phaseId ?? "—"}`],
                  ["Original plan", activeExecution.plannedSnapshot?.splitTitle ?? "Unavailable (legacy)"],
                  ["Adjusted snapshot", activeExecution.adjustedSnapshot?.splitTitle ?? "None"],
                  ["Started snapshot", activeExecution.startedSnapshot?.splitTitle ?? "None"],
                  ["Completed sets", String([...activeExecution.movements, ...activeExecution.addedMovements].reduce((sum, movement) => sum + movement.completedSets.length, 0))],
                  ["Added / removed / skipped", `${activeExecution.addedMovements.length} / ${activeExecution.removedMovementIds.length} / ${activeExecution.skippedMovementIds.length}`],
                  ["Substitutions", String(activeExecution.movements.filter((movement) => movement.source === "substitution").length)],
                  ["Transitions", activeExecution.transitions.map((transition) => `${transition.from}→${transition.to}`).join(", ") || "None"],
                  ["Future revision links", activeExecution.futureRevisionIds.join(", ") || "None"],
                  ["Migration source", activeExecution.integrity.migrationSource ?? "Native ledger"],
                  ["Locked", activeExecution.integrity.completedRecordLockedAt ?? "No"],
                ].map(([label, value]) => <div key={label} className="contents"><dt className="text-white/35">{label}</dt><dd className="break-all text-white/75">{value}</dd></div>)}
              </dl>
              <details className="mt-4 rounded border border-white/10 bg-black/30 p-2.5">
                <summary className="cursor-pointer text-xs text-white/60">Inspect active execution JSON</summary>
                <pre className="mt-2 max-h-96 overflow-auto text-[10px] leading-relaxed text-white/45">{JSON.stringify(activeExecution, null, 2)}</pre>
              </details>
            </>
          ) : <p className="text-sm text-white/45">No active execution record. Start a real Training session or run a development simulation.</p>}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[["History", executionHistory.length], ["Week summaries", weekExecutionSummaries.length], ["Decisions", decisionHistory.length]].map(([label, value]) => <div key={label} className="rounded border border-white/10 bg-black/25 p-2"><p className="text-[9px] uppercase tracking-[0.12em] text-white/30">{label}</p><p className="mt-1 font-mono text-lg text-white/70">{value}</p></div>)}
          </div>
        </Section>

        <Section title="Execution simulations">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">Scenario</span>
            <select aria-label="Session execution simulation" value={simulationKind} onChange={(event) => setSimulationKind(event.target.value as typeof simulationKind)} className="rounded border border-white/15 bg-black/50 px-2 py-2 text-sm text-white outline-none">
              {SIMULATION_OPTIONS.map((option) => <option key={option} value={option}>{option.replaceAll("-", " ")}</option>)}
            </select>
          </label>
          <p className="mt-3 text-xs leading-5 text-white/45">{simulation.note}</p>
          {simulation.record && <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs"><dt className="text-white/30">Status</dt><dd className="text-white/70">{simulation.record.status}</dd><dt className="text-white/30">Completion</dt><dd className="text-white/70">{simulation.record.sessionMetrics.completionPercent ?? 0}%</dd><dt className="text-white/30">Added</dt><dd className="text-white/70">{simulation.record.addedMovements.length}</dd><dt className="text-white/30">Skipped</dt><dd className="text-white/70">{simulation.record.skippedMovementIds.length}</dd><dt className="text-white/30">Substituted</dt><dd className="text-white/70">{simulation.record.movements.filter((movement) => movement.source === "substitution").length}</dd><dt className="text-white/30">Locked</dt><dd className="text-white/70">{simulation.record.integrity.completedRecordLockedAt ? "Yes" : "No"}</dd></dl>}
          <details className="mt-4 rounded border border-white/10 bg-black/30 p-2.5">
            <summary className="cursor-pointer text-xs text-white/60">Inspect simulation JSON</summary>
            <pre className="mt-2 max-h-96 overflow-auto text-[10px] leading-relaxed text-white/45">{JSON.stringify(simulation, null, 2)}</pre>
          </details>
        </Section>
      </div>

      <ResponseEvidenceInspector />

      <ResponseModelInspector />

      {/* ── Controls ── */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title="Athlete">
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Fixture"
              value={fixtureId}
              onChange={(v) => { setFixtureId(v); setOverrides({}); }}
              options={ATHLETE_FIXTURES.map((f) => f.id)}
            />
            <Field label="Block weeks" type="number" value={totalWeeks} onChange={(v) => setTotalWeeks(Math.max(1, Math.min(52, Number(v) || 12)))} />
          </div>
          <p className="mb-3 rounded border border-white/10 bg-black/30 p-2 text-xs leading-relaxed text-white/45">
            <span className="text-white/60">Proves:</span> {fixture.proves}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Weight (lb)" type="number" value={overrides.bodyWeightLb ?? fixture.input.bodyWeightLb ?? ""} onChange={(v) => set("bodyWeightLb", v, true)} />
            <Field label="Height (in)" type="number" value={overrides.heightIn ?? fixture.input.heightIn ?? ""} onChange={(v) => set("heightIn", v, true)} />
            <Field label="Body fat %" type="number" value={overrides.bodyFatPercent ?? fixture.input.bodyFatPercent ?? ""} onChange={(v) => set("bodyFatPercent", v, true)} />
            <Field label="Training age (yrs)" type="number" value={overrides.trainingAgeYears ?? fixture.input.trainingAgeYears ?? ""} onChange={(v) => set("trainingAgeYears", v, true)} />
            <Field label="Available days" type="number" value={overrides.availableDays ?? fixture.input.availableDays ?? ""} onChange={(v) => set("availableDays", v, true)} />
            <Field label="Session minutes" type="number" value={overrides.sessionDurationMinutes ?? fixture.input.sessionDurationMinutes ?? ""} onChange={(v) => set("sessionDurationMinutes", v, true)} />
            <Field label="Sleep hours" type="number" value={overrides.averageSleepHours ?? fixture.input.averageSleepHours ?? ""} onChange={(v) => set("averageSleepHours", v, true)} />
            <Field label="Recovery capacity" value={overrides.recoveryCapacity ?? fixture.input.recoveryCapacity ?? ""} onChange={(v) => set("recoveryCapacity", v)} options={["low", "moderate", "high"]} />
            <Field label="Experience" value={overrides.experienceLevel ?? fixture.input.experienceLevel ?? ""} onChange={(v) => set("experienceLevel", v)} options={["beginner", "novice", "intermediate", "advanced", "elite"]} />
            <Field label="Lifestyle demand" value={overrides.lifestyleDemand ?? fixture.input.lifestyleDemand ?? ""} onChange={(v) => set("lifestyleDemand", v)} options={["sedentary", "active", "physical"]} />
            <Field label="Nutrition phase" value={overrides.nutritionPhase ?? fixture.input.nutritionPhase ?? ""} onChange={(v) => set("nutritionPhase", v)} options={["cut", "maintenance", "lean gain", "recomp"]} />
            <Field label="Running background" value={overrides.runningBackground ?? fixture.input.runningBackground ?? ""} onChange={(v) => set("runningBackground", v)} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Primary goal" value={overrides.primaryGoal ?? fixture.input.primaryGoal ?? ""} onChange={(v) => set("primaryGoal", v)} />
            <Field
              label="Weak points (comma separated)"
              value={(overrides.weakPoints ?? fixture.input.weakPoints ?? []).join(", ")}
              onChange={(v) => setOverrides((p) => ({ ...p, weakPoints: v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [] }))}
            />
          </div>
        </Section>

        <Section title="Protocol + activity">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Protocol" value={protocolId} onChange={setProtocolId} options={PROTOCOL_IDS} />
            <Field label="Compare against" value={compareId} onChange={setCompareId} options={PROTOCOL_IDS} />
            <Field label="Friday 5:45 lower-body class" value={fridayClass} onChange={(v) => setFridayClass(v as typeof fridayClass)} options={["none", "one-time", "recurring"]} />
          </div>

          <div className="mt-4 rounded border border-white/10 bg-black/30 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Reserve&rsquo;s recommendation</p>
            <p className="mt-1 text-sm text-white">
              {protocolName(ranking.recommended.protocolId)}{" "}
              <span className="text-white/40">· {ranking.recommended.recommendedFrequency} days · score {ranking.recommended.score}</span>
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/35">Alternatives</p>
            <ul className="mt-1 space-y-0.5 text-sm text-white/55">
              {ranking.alternatives.map((a) => (
                <li key={a.protocolId}>
                  {protocolName(a.protocolId)} <span className="text-white/30">· {a.recommendedFrequency} days · {a.score}</span>
                </li>
              ))}
            </ul>
            {protocolId !== ranking.recommended.protocolId && (
              <p className="mt-2 rounded border border-amber-300/25 bg-amber-300/5 p-2 text-xs text-amber-200/80">
                You are inspecting a manual selection. Reserve keeps the choice and adapts it rather than substituting.
              </p>
            )}
          </div>

          <div className="mt-3 rounded border border-white/10 bg-black/30 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Structural comparison</p>
            <p className="mt-1 text-sm text-white">
              {comparison.similarityScore} similarity ·{" "}
              <span className={comparison.collisionRisk === "high" ? "text-rose-300" : comparison.collisionRisk === "moderate" ? "text-amber-300" : "text-emerald-300"}>
                {comparison.classification}
              </span>
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">Shared</p>
                <Bullets items={comparison.sharedFeatures} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">Meaningful differences</p>
                <Bullets items={comparison.meaningfulDifferences} tone="good" />
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ── Derived intelligence ── */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Section title="Derived programming profile">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            {([
              ["Training capacity", profile.trainingCapacity],
              ["Recovery capacity", profile.recoveryCapacity],
              ["Schedule capacity", profile.scheduleCapacity],
              ["Impact tolerance", profile.impactTolerance],
              ["Conditioning tolerance", profile.conditioningTolerance],
              ["Volume tolerance", profile.volumeTolerance],
              ["Complexity tolerance", profile.complexityTolerance],
              ["Frequency range", `${profile.preferredFrequencyRange[0]}–${profile.preferredFrequencyRange[1]}`],
              ["Muscle retention", profile.muscleRetentionPriority],
              ["Strength priority", profile.strengthPriority],
              ["Hypertrophy priority", profile.hypertrophyPriority],
              ["Conditioning priority", profile.conditioningPriority],
              ["Recovery priority", profile.recoveryPriority],
              ["Confidence", profile.confidence],
            ] as const).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-white/35">{k}</dt>
                <dd className="text-white/80">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm leading-relaxed text-white/60">{profile.bodyCompositionContext}</p>
        </Section>

        <Section title="Constraints, conflicts, opportunities">
          <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/30">Goal conflicts</p>
          <Bullets items={profile.goalConflicts} tone="warn" />
          <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Constraints</p>
          <Bullets items={profile.majorConstraints} tone="warn" />
          <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Opportunities</p>
          <Bullets items={profile.majorOpportunities} tone="good" />
        </Section>

        <Section title="Evidence + assumptions">
          <p className="text-sm text-white/60">
            Confidence <span className="text-white">{snapshot.evidence.confidence}</span> ·{" "}
            {snapshot.evidence.completeFields.length} known · {snapshot.evidence.missingFields.length} missing
          </p>
          <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Missing fields</p>
          <p className="text-sm text-white/50">{snapshot.evidence.missingFields.join(", ") || "None."}</p>
          <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Assumptions</p>
          <Bullets items={snapshot.evidence.assumptions} tone="warn" />
        </Section>
      </div>

      {/* ── Suitability + explanation ── */}
      {dna && suitability && horizon && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Section title={`Suitability · ${protocolName(protocolId)}`}>
            <p className="text-sm text-white">
              {SUITABILITY_LABEL[suitability.classification]}{" "}
              <span className="text-white/40">· score {suitability.score} · {suitability.recommendedFrequency} days · {suitability.recommendedDurationWeeks} weeks</span>
            </p>
            <p className="mt-1 text-xs text-white/35">
              Family: {FAMILY_LABEL[dna.identity.family]} · runtime source: {dna.topology.blueprintName} ({dna.topology.blueprintId}) · {dna.architectureVersion}
            </p>
            <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Why it fits</p>
            <Bullets items={suitability.whyItFits} />
            <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">What the split will do</p>
            <Bullets items={suitability.whatTheSplitWillDo} />
            <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Compromises</p>
            <Bullets items={suitability.compromises} tone="warn" />
            <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Risks</p>
            <Bullets items={suitability.risks} tone="warn" />
            <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Contraindications</p>
            <Bullets items={suitability.contraindications} tone="warn" />
          </Section>

          <Section title="Personalized explanation">
            <p className="text-sm font-medium text-white">{horizon.personalizedExplanation.headline}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/70">{horizon.personalizedExplanation.summary}</p>
            {([
              ["Athlete context", horizon.personalizedExplanation.athleteContext],
              ["Why this protocol", horizon.personalizedExplanation.whyThisProtocol],
              ["Weekly logic", horizon.personalizedExplanation.weeklyLogic],
              ["Body composition", horizon.personalizedExplanation.bodyCompositionStrategy],
              ["Recovery", horizon.personalizedExplanation.recoveryStrategy],
              ["Nutrition", horizon.personalizedExplanation.nutritionStrategy],
              ["Reserve will monitor", horizon.personalizedExplanation.whatReserveWillMonitor],
              ["What could change it", horizon.personalizedExplanation.changeConditions],
            ] as const).map(([label, items]) => (
              <div key={label}>
                <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">{label}</p>
                <Bullets items={items} />
              </div>
            ))}
          </Section>
        </div>
      )}

      {/* ── Activity reconciliation ── */}
      {activityPreview && (
        <div className="mb-6">
          <Section title={`Friday class · ${fridayClass}`}>
            <p className="text-sm text-white">{activityPreview.proposal.recommendation}</p>
            <p className="mt-1 text-xs text-white/40">
              Resolved as {activityPreview.proposal.resolvedRelationship} · risk {activityPreview.proposal.riskLevel} ·
              overlap {activityPreview.proposal.overlapWithPlanned} · affects weeks{" "}
              {activityPreview.affectedWeeks.length > 3
                ? `${activityPreview.affectedWeeks[0]}–${activityPreview.affectedWeeks[activityPreview.affectedWeeks.length - 1]}`
                : activityPreview.affectedWeeks.join(", ")}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div><p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/30">Rationale</p><Bullets items={activityPreview.proposal.rationale} /></div>
              <div><p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/30">Reduce</p><Bullets items={activityPreview.proposal.reduce} tone="warn" /></div>
              <div><p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/30">Preserve</p><Bullets items={activityPreview.proposal.preserve} tone="good" /></div>
            </div>
          </Section>
        </div>
      )}

      {/* ── The horizon ── */}
      {horizon && (
        <Section title={`Program horizon · ${horizon.totalWeeks} weeks · ${horizon.frequency} days`}>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {jumpWeeks.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setSelectedWeek(n); setSelectedDay(null); }}
                className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                  selectedWeek === n ? "border-white/50 bg-white/10 text-white" : "border-white/15 text-white/50 hover:border-white/30"
                }`}
              >
                Jump to week {n}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap gap-1">
            {horizon.weeks.map((w) => (
              <button
                key={w.weekNumber}
                type="button"
                onClick={() => { setSelectedWeek(w.weekNumber); setSelectedDay(null); }}
                title={`${w.phaseName} · ${w.status}`}
                className={`h-9 w-9 rounded text-[11px] transition-colors ${
                  selectedWeek === w.weekNumber
                    ? "bg-white text-black"
                    : w.status === "deload" ? "bg-sky-400/20 text-sky-100"
                      : w.status === "assessment" ? "bg-violet-400/20 text-violet-100"
                        : w.status === "revised" ? "bg-amber-400/20 text-amber-100"
                          : "bg-white/[0.06] text-white/50 hover:bg-white/15"
                }`}
              >
                {w.weekNumber}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.14em] text-white/30">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-sky-400/40" />Deload</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-violet-400/40" />Assessment</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400/40" />Revised</span>
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {horizon.phases.map((p) => (
              <div key={p.id} className="rounded border border-white/10 bg-black/30 p-2.5">
                <p className="text-sm text-white">{p.name} <span className="text-white/35">· weeks {p.weekStart}–{p.weekEnd}</span></p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/45">{p.objective}</p>
              </div>
            ))}
          </div>

          {week && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="rounded border border-white/10 bg-black/30 p-3">
                <p className="text-sm text-white">
                  Week {week.weekNumber} · {week.phaseName} (week {week.phaseWeek}) ·{" "}
                  <span className="uppercase tracking-[0.14em] text-white/40">{week.status}</span>
                </p>
                {week.revisionReason && <p className="mt-1 text-xs text-amber-200/70">{week.revisionReason}</p>}
                <p className="mt-2 text-sm text-white/60">{week.objective}</p>
                <p className="mt-2 text-xs text-white/45">
                  Volume: {week.volumeTarget.relativeLoad} · Effort: {week.intensityTarget.effortRange}
                </p>
                {week.intensityTarget.primaryLiftExposure && (
                  <p className="mt-1 text-xs text-white/45">Primary lift: {week.intensityTarget.primaryLiftExposure}</p>
                )}
                {week.conditioningTarget && (
                  <p className="mt-1 text-xs text-white/45">
                    Conditioning: {week.conditioningTarget.type} · {week.conditioningTarget.frequency}× ·{" "}
                    {week.conditioningTarget.duration} min
                    {week.conditioningTarget.distance ? ` · ~${week.conditioningTarget.distance} km` : ""} ·{" "}
                    {week.conditioningTarget.intensity}
                  </p>
                )}
                <p className="mt-1 text-xs text-white/45">Nutrition: {week.nutritionDemand}</p>

                <div className="mt-3 space-y-1">
                  {week.weeklyStructure.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedDay(i)}
                      className={`flex w-full items-center gap-3 rounded border px-2.5 py-1.5 text-left text-sm transition-colors ${
                        selectedDay === i ? "border-white/40 bg-white/10" : "border-white/10 hover:border-white/25"
                      }`}
                    >
                      <span className="w-8 shrink-0 text-[11px] uppercase tracking-[0.1em] text-white/35">{DAY_NAMES[i]}</span>
                      <span className={d.recovery ? "text-white/40" : "text-white/85"}>{d.title}</span>
                      {d.emphasis.includes("reduced-volume") && (
                        <span className="ml-auto rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-200">reduced</span>
                      )}
                    </button>
                  ))}
                </div>

                <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Weekly set targets</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(week.volumeTarget.setTargets).map(([k, v]) => (
                    <span key={k} className="rounded bg-white/[0.06] px-2 py-0.5 text-xs text-white/60">{k} {v}</span>
                  ))}
                </div>

                {originalWeek && week.status === "revised" && (
                  <div className="mt-3 rounded border border-white/10 bg-black/40 p-2.5">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">Original projection (preserved)</p>
                    <ul className="mt-1 space-y-0.5 text-xs text-white/45">
                      {originalWeek.weeklyStructure.map((d, i) => (
                        <li key={i}>{DAY_NAMES[i]} · {d.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="rounded border border-white/10 bg-black/30 p-3">
                {day ? (
                  <>
                    <p className="text-sm text-white">{DAY_NAMES[selectedDay!]} · {day.title}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <dt className="text-white/35">Archetype</dt><dd className="text-white/70">{day.archetype}</dd>
                      <dt className="text-white/35">Intent</dt><dd className="text-white/70">{day.intent}</dd>
                      <dt className="text-white/35">Priority</dt><dd className="text-white/70">{day.priority}</dd>
                      <dt className="text-white/35">Recovery</dt><dd className="text-white/70">{String(Boolean(day.recovery))}</dd>
                      <dt className="text-white/35">Emphasis</dt><dd className="text-white/70">{day.emphasis.join(", ") || "—"}</dd>
                    </dl>
                  </>
                ) : (
                  <>
                    <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/30">Why this week fits now</p>
                    <Bullets items={week.athleteRationale.whyThisWeekFitsNow} />
                    <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">What this week should do</p>
                    <Bullets items={week.athleteRationale.whatThisWeekShouldDo} />
                    <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Watch items</p>
                    <Bullets items={week.athleteRationale.watchItems} tone="warn" />
                    <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Recovery target</p>
                    <Bullets items={week.recoveryTarget} />
                    <p className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Entry / exit criteria</p>
                    <Bullets items={[...week.entryCriteria, ...week.exitCriteria]} />
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Structural signature + JSON ── */}
          {dna && (
            <div className="mt-4 rounded border border-white/10 bg-black/30 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">Structural signature</p>
              <pre className="mt-1 max-h-64 overflow-auto text-[11px] leading-relaxed text-white/55">
                {JSON.stringify(structuralSignature(dna), null, 2)}
              </pre>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowJson((v) => !v)}
            className="mt-4 rounded border border-white/20 px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/40"
          >
            {showJson ? "Hide" : "Show"} raw horizon JSON
          </button>
          {showJson && (
            <pre className="mt-2 max-h-[32rem] overflow-auto rounded border border-white/10 bg-black/50 p-3 text-[11px] leading-relaxed text-white/50">
              {JSON.stringify(horizon, null, 2)}
            </pre>
          )}
        </Section>
      )}
    </main>
  );
}
