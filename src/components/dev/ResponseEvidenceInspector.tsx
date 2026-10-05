"use client";

import { useMemo, useState } from "react";

import {
  EVIDENCE_SCENARIOS,
  buildEvidenceScenario,
  compareResponseEvidence,
  type EvidenceScenario,
} from "@/lib/response-evidence";

function label(value: string): string {
  return value.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatHours(value: number | undefined): string {
  return value == null ? "missing" : `${value}h`;
}

function EvidencePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-sky-300/15 bg-sky-300/[0.025] p-4">
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100/45">{title}</h3>
      {children}
    </section>
  );
}

function SelectField({ label: fieldLabel, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const id = `evidence-${fieldLabel.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <label htmlFor={id} className="min-w-0">
      <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-white/30">{fieldLabel}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="w-full min-w-0 rounded border border-white/15 bg-black/60 px-2 py-2 text-xs text-white outline-none focus-visible:border-sky-200/50">
        <option value="all">All</option>
        {options.map((option) => <option key={option} value={option}>{label(option)}</option>)}
      </select>
    </label>
  );
}

function findPair<T>(values: T[], matches: (left: T, right: T) => boolean): readonly [T, T] | null {
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      if (matches(values[left], values[right])) return [values[left], values[right]] as const;
    }
  }
  return null;
}

export function ResponseEvidenceInspector() {
  const [scenario, setScenario] = useState<EvidenceScenario>("completed-exposure-week");
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-31");
  const [protocol, setProtocol] = useState("all");
  const [phase, setPhase] = useState("all");
  const [muscle, setMuscle] = useState("all");
  const [pattern, setPattern] = useState("all");
  const [exercise, setExercise] = useState("all");
  const bundle = useMemo(() => buildEvidenceScenario(scenario), [scenario]);
  const protocols = useMemo(() => [...new Set(bundle.evidence.map((item) => item.context.protocolId).filter((value): value is string => typeof value === "string"))].sort(), [bundle]);
  const phases = useMemo(() => [...new Set(bundle.evidence.map((item) => item.context.phaseId).filter((value): value is string => typeof value === "string"))].sort(), [bundle]);
  const muscles = bundle.muscleExposure.map((item) => item.muscle);
  const patterns = bundle.movementExposure.map((item) => item.pattern);
  const exercises = [...new Set(bundle.performance.map((item) => item.exerciseId))].sort();
  const filteredEvidence = bundle.evidence.filter((item) =>
    item.calendarDate >= startDate && item.calendarDate <= endDate &&
    (protocol === "all" || item.context.protocolId === protocol) &&
    (phase === "all" || item.context.phaseId === phase)
  );
  const visibleMuscles = bundle.muscleExposure.filter((item) => muscle === "all" || item.muscle === muscle);
  const visiblePatterns = bundle.movementExposure.filter((item) => pattern === "all" || item.pattern === pattern);
  const visiblePerformance = bundle.performance.filter((item) => exercise === "all" || item.exerciseId === exercise);
  const comparablePair = findPair(visiblePerformance, (left, right) => left.comparisonKey === right.comparisonKey);
  const nonComparablePair = findPair(bundle.performance, (left, right) => left.exerciseId !== right.exerciseId || left.comparisonKey !== right.comparisonKey);
  const comparisons = [
    comparablePair ? { label: "Comparable pair", result: compareResponseEvidence(comparablePair[0], comparablePair[1]) } : null,
    nonComparablePair ? { label: "Non-comparable pair", result: compareResponseEvidence(nonComparablePair[0], nonComparablePair[1]) } : null,
  ].filter((value): value is NonNullable<typeof value> => value != null);
  const direct = visibleMuscles.reduce((sum, item) => sum + item.completedDirectSetEquivalents, 0);
  const indirect = visibleMuscles.reduce((sum, item) => sum + item.completedIndirectSetEquivalents, 0);
  const missing = [...new Set([
    ...bundle.recovery.flatMap((item) => item.missingFields),
    ...bundle.normalizedSets.flatMap((item) => item.limitations),
  ])];

  return (
    <div data-testid="response-evidence-inspector" className="mb-6 min-w-0 rounded-xl border border-sky-300/20 bg-[#080d13] p-3 sm:p-5">
      <header className="mb-5 border-b border-sky-200/10 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-200/70">Development evidence</p>
        <h2 className="mt-1 text-xl font-semibold text-white">Response Evidence Engine</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-white/45">
          Not an athlete-facing recommendation. These synthetic fixtures expose normalized facts, missing context, comparability, and source provenance only.
        </p>
      </header>

      <EvidencePanel title="Evidence filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="min-w-0 sm:col-span-2">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-white/30">Athlete fixture / simulation</span>
            <select aria-label="Evidence scenario" value={scenario} onChange={(event) => setScenario(event.target.value as EvidenceScenario)} className="w-full min-w-0 rounded border border-sky-300/25 bg-black/60 px-2 py-2 text-xs text-white outline-none">
              {EVIDENCE_SCENARIOS.map((option) => <option key={option} value={option}>{label(option)}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-white/30">Start date</span>
            <input aria-label="Evidence start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded border border-white/15 bg-black/60 px-2 py-2 text-xs text-white" />
          </label>
          <label>
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-white/30">End date</span>
            <input aria-label="Evidence end date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded border border-white/15 bg-black/60 px-2 py-2 text-xs text-white" />
          </label>
          <SelectField label="Protocol" value={protocol} options={protocols} onChange={setProtocol} />
          <SelectField label="Phase" value={phase} options={phases} onChange={setPhase} />
          <SelectField label="Muscle" value={muscle} options={muscles} onChange={setMuscle} />
          <SelectField label="Movement pattern" value={pattern} options={patterns} onChange={setPattern} />
          <SelectField label="Exercise" value={exercise} options={exercises} onChange={setExercise} />
        </div>
      </EvidencePanel>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Direct exposure", direct.toFixed(1)], ["Indirect exposure", indirect.toFixed(1)],
          ["Evidence records", String(filteredEvidence.length)], ["Excluded mutable", String(bundle.provenance.excludedEvidence.length)],
        ].map(([name, value]) => (
          <div key={name} className="min-w-0 rounded border border-white/10 bg-black/25 p-2.5 text-center">
            <p className="truncate text-[8px] uppercase tracking-[0.13em] text-white/30">{name}</p>
            <p className="mt-1 font-mono text-lg text-sky-100/80">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
        <EvidencePanel title="Muscle exposure and actual frequency">
          <div className="space-y-2">
            {visibleMuscles.length ? visibleMuscles.map((item) => (
              <div key={item.muscle} className="rounded border border-white/10 bg-black/20 p-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-white/80">{item.muscle}</span><span className="text-white/35">{item.confidence} quality</span></div>
                <p className="mt-1 text-white/50">Planned direct {item.plannedDirectSets} · actual direct {item.completedDirectSetEquivalents} · indirect {item.completedIndirectSetEquivalents}</p>
                <p className="mt-1 text-white/40">{item.exposureDays} exposure day(s) · added {item.addedExposure} · substituted {item.substitutedExposure} · replacement events {item.replacementActivityExposure}</p>
              </div>
            )) : <p className="text-xs text-white/35">No classified muscle exposure in this fixture.</p>}
          </div>
        </EvidencePanel>

        <EvidencePanel title="Movement-pattern exposure">
          <div className="grid gap-2 sm:grid-cols-2">
            {visiblePatterns.length ? visiblePatterns.map((item) => (
              <div key={item.pattern} className="rounded border border-white/10 bg-black/20 p-2.5 text-xs">
                <p className="font-medium text-white/75">{label(item.pattern)}</p>
                <p className="mt-1 text-white/45">{item.completedExposureEquivalent} set-equivalent · {item.exposureDays} day(s)</p>
                <p className="mt-1 text-white/30">Sets: {item.contributingMovementIds.join(", ") || "none"}</p>
              </div>
            )) : <p className="text-xs text-white/35">No classified movement-pattern exposure.</p>}
          </div>
        </EvidencePanel>

        <EvidencePanel title="Exercise performance and comparability">
          <div className="space-y-2">
            {visiblePerformance.map((item) => (
              <div key={item.id} className="rounded border border-white/10 bg-black/20 p-2.5 text-xs">
                <p className="font-medium text-white/75">{item.performedName} · {item.performedAt.slice(0, 10)}</p>
                <p className="mt-1 text-white/45">
                  {item.completedSets} {item.completedSets === 1 ? "set" : "sets"} · {item.totalCompletedReps == null ? "reps missing" : `${item.totalCompletedReps} reps`} · {item.bestCompletedLoad ?? "load missing"} {item.loadUnit ?? ""}
                </p>
              </div>
            ))}
            {comparisons.map(({ label: comparisonLabel, result }) => <div key={comparisonLabel} className="rounded border border-sky-300/15 bg-sky-300/[0.04] p-2.5 text-xs"><p className="text-[9px] uppercase tracking-[0.13em] text-white/30">{comparisonLabel}</p><p className="mt-1 text-sky-100/70">Comparable: {String(result.comparable)} · score {result.score} · confidence {result.confidence}</p><p className="mt-1 text-white/35">Differences: {[...result.meaningfulDifferences, ...result.blockingDifferences].join(" · ") || "None"}</p></div>)}
          </div>
        </EvidencePanel>

        <EvidencePanel title="Conditioning proximity and recovery context">
          <div className="space-y-2 text-xs">
            {bundle.conditioning.map((item) => <div key={item.id} className="rounded border border-white/10 bg-black/20 p-2.5"><p className="text-white/75">{label(item.modality)} · {item.date}</p><p className="mt-1 text-white/45">Lower demand {item.lowerBodyDemand ?? "missing"} · systemic {item.systemicDemand ?? "missing"} · previous lower {formatHours(item.proximityToPreviousLowerTrainingHours)} · next lower {formatHours(item.proximityToNextLowerTrainingHours)}</p></div>)}
            {bundle.recovery.map((item) => <div key={item.sessionId} className="rounded border border-white/10 bg-black/20 p-2.5"><p className="text-white/75">Session {item.sessionId}</p><p className="mt-1 text-white/45">Sleep {item.sleepHours ?? "missing"} · readiness {item.readinessScore ?? "missing"} · pain before {item.painBefore?.length ?? 0} · pain during {item.painDuring?.length ?? 0}</p></div>)}
            {!bundle.conditioning.length && !bundle.recovery.length && <p className="text-white/35">No conditioning or finalized recovery context in this fixture.</p>}
          </div>
        </EvidencePanel>

        <EvidencePanel title="Body-composition and nutrition facts">
          <div className="space-y-2 text-xs">
            {bundle.bodyComposition.length ? bundle.bodyComposition.map((item) => <div key={item.id} className="rounded border border-white/10 bg-black/20 p-2.5"><p className="text-white/75">{item.observedAt.slice(0, 10)} · {item.source}</p><p className="mt-1 text-white/45">Weight {item.weightKg ?? "missing"} kg · body fat {item.bodyFatPercent ?? "missing"}% · waist {item.waistCm ?? "missing"} cm</p><p className="mt-1 text-white/45">Phase {item.nutritionPhase ?? "missing"} · calories {item.calorieActual ?? "missing"}/{item.calorieTarget ?? "missing"} · protein {item.proteinActual ?? "missing"}/{item.proteinTarget ?? "missing"}</p></div>) : <p className="text-white/35">No body-composition facts in this fixture. Nothing was inferred.</p>}
          </div>
        </EvidencePanel>

        <EvidencePanel title="Quality, missing information, and provenance">
          <p className="text-xs leading-5 text-white/45">{bundle.limitations.join(" ")}</p>
          <p className="mt-3 text-[9px] uppercase tracking-[0.14em] text-white/30">Missing or limited fields</p>
          <p className="mt-1 break-words text-xs leading-5 text-amber-100/55">{missing.join(" · ") || "No recorded limitations for this fixture."}</p>
          <dl className="mt-3 grid grid-cols-[125px_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs"><dt className="text-white/30">Sessions</dt><dd className="break-all text-white/55">{bundle.provenance.contributingSessions.join(", ") || "none"}</dd><dt className="text-white/30">Movements</dt><dd className="break-all text-white/55">{bundle.provenance.contributingMovements.join(", ") || "none"}</dd><dt className="text-white/30">Sets</dt><dd className="break-all text-white/55">{bundle.provenance.contributingSets.join(", ") || "none"}</dd><dt className="text-white/30">Activities</dt><dd className="break-all text-white/55">{bundle.provenance.contributingActivities.join(", ") || "none"}</dd></dl>
        </EvidencePanel>
      </div>

      <details className="mt-4 min-w-0 rounded border border-sky-300/15 bg-black/35 p-3">
        <summary className="cursor-pointer text-xs text-sky-100/60">Inspect structured response evidence JSON</summary>
        <pre className="mt-3 max-h-[560px] max-w-full overflow-auto whitespace-pre-wrap break-words text-[10px] leading-relaxed text-white/40">{JSON.stringify(bundle, null, 2)}</pre>
      </details>
    </div>
  );
}
