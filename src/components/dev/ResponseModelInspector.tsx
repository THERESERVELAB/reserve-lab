"use client";

/* ════════════════════════════════════════════════════════════════════════
   DEVELOPMENT RESPONSE MODEL — synthetic coaching intelligence.

   Runs the 25 synthetic simulations and exposes everything the model
   computed: data quality, insights, confidence tracing, contradiction
   tracing, excluded evidence, recommendation eligibility, decision outcomes,
   program revisions, and the raw JSON.

   Development only. Synthetic athletes only. Never touches member state.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";

import { deriveProgrammingProfile } from "@/lib/athlete/programming-profile";
import { fixtureSnapshot } from "@/lib/athlete/fixtures";
import { generateProgramHorizon } from "@/lib/horizon/generate";
import {
  RESPONSE_SIMULATIONS,
  SIMULATION_NOW,
  runResponseSimulation,
  type ResponseSimulation,
} from "@/lib/response-model/fixtures";
import { acceptRecommendation, declineRecommendation, deferRecommendation } from "@/lib/response-model/apply";
import { CONFIDENCE_LABEL } from "@/lib/response-model/confidence";
import {
  DOMAIN_LABEL,
  RESPONSE_DOMAIN_NAMES,
  RESPONSE_EVENT_LABEL,
  type ResponseConfidence,
  type ResponseDomainName,
  type ResponseEvent,
  type ResponseInsightStatus,
} from "@/lib/response-model/types";
import { ResponseIntegrationInspector } from "@/components/dev/ResponseIntegrationInspector";

type DecisionKind = "none" | "accept" | "decline" | "defer";

const STATUSES: Array<ResponseInsightStatus | "all"> = [
  "all", "insufficient", "emerging", "active", "established", "conflicted", "weakening", "superseded", "expired",
];
const CONFIDENCES: Array<ResponseConfidence | "all"> = ["all", "insufficient", "emerging", "moderate", "established"];

function Field({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  const id = `rm-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus-visible:border-white/40"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Bullets({ items, tone = "default" }: { items: string[]; tone?: "default" | "warn" | "good" }) {
  if (items.length === 0) return <p className="text-sm text-white/30">None.</p>;
  const color = tone === "warn" ? "text-amber-200/80" : tone === "good" ? "text-emerald-200/80" : "text-white/65";
  return (
    <ul className={`space-y-1 text-sm leading-relaxed ${color}`}>
      {items.map((t, i) => <li key={i}>· {t}</li>)}
    </ul>
  );
}

export function ResponseModelInspector() {
  const [simulation, setSimulation] = useState<ResponseSimulation>("productive-back-volume-range");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all");
  const [decision, setDecision] = useState<DecisionKind>("none");
  const [showJson, setShowJson] = useState(false);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);

  const base = useMemo(() => runResponseSimulation(simulation), [simulation]);

  // A synthetic horizon so revisions can be exercised without member state.
  const horizon = useMemo(() => {
    const snapshot = fixtureSnapshot("advanced-physique")!;
    return generateProgramHorizon({
      protocolId: "classic-physique-build",
      snapshot,
      profile: deriveProgrammingProfile(snapshot),
      totalWeeks: 12,
      now: new Date(SIMULATION_NOW),
      startDate: "2026-08-17",
    });
  }, []);

  const applied = useMemo(() => {
    const pending = base.model.pendingRecommendations.find((r) => r.approval.required)
      ?? base.model.pendingRecommendations[0];
    if (!pending || decision === "none") {
      // No decision means no NEW events. Returning base.events here caused the
      // render below to spread the same array twice and emit duplicate keys.
      return { model: base.model, horizon, revision: null, events: [], note: "No decision applied." };
    }
    const input = { model: base.model, horizon, recommendationId: pending.id, now: SIMULATION_NOW };
    const result = decision === "accept" ? acceptRecommendation(input)
      : decision === "decline" ? declineRecommendation(input)
        : deferRecommendation(input);
    return {
      model: result.model,
      horizon: result.horizon,
      revision: result.revision,
      events: result.events,
      note: result.blocked ? (result.blockedReason ?? "Blocked.") : `Decision "${decision}" applied to "${pending.summary}".`,
    };
  }, [base, decision, horizon]);

  const model = applied.model;

  // Events are deterministically identified, so a defensive dedupe keeps the
  // list stable even if a decision reproduces one Reserve already emitted.
  const allEvents = useMemo(() => {
    const byId = new Map<string, ResponseEvent>();
    for (const event of [...base.events, ...applied.events]) byId.set(event.id, event);
    return [...byId.values()];
  }, [base.events, applied.events]);

  const insights = useMemo(() => {
    const all = [...model.activeInsights, ...model.archivedInsights];
    return all.filter((i) => {
      if (domainFilter !== "all" && i.domain !== domainFilter) return false;
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (confidenceFilter !== "all" && i.confidence !== confidenceFilter) return false;
      return true;
    });
  }, [model, domainFilter, statusFilter, confidenceFilter]);

  const selected = insights.find((i) => i.id === selectedInsightId) ?? insights[0] ?? null;

  return (
    <section className="mt-8 rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <header className="mb-4 border-b border-white/10 pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/70">Development Response Model</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-white">
          Synthetic coaching intelligence
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-white/45">
          {base.label} — {base.note}
        </p>
      </header>

      {/* ── Controls ── */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Simulation" value={simulation} onChange={(v) => { setSimulation(v as ResponseSimulation); setSelectedInsightId(null); }} options={[...RESPONSE_SIMULATIONS]} />
        <Field label="Domain" value={domainFilter} onChange={setDomainFilter} options={["all", ...RESPONSE_DOMAIN_NAMES]} />
        <Field label="Insight status" value={statusFilter} onChange={setStatusFilter} options={STATUSES as string[]} />
        <Field label="Confidence" value={confidenceFilter} onChange={setConfidenceFilter} options={CONFIDENCES as string[]} />
        <Field label="Athlete decision" value={decision} onChange={(v) => setDecision(v as DecisionKind)} options={["none", "accept", "decline", "defer"]} />
      </div>

      <p className="mb-4 rounded border border-white/10 bg-black/30 p-2 text-xs text-white/45">{applied.note}</p>

      {/* ── Data quality ── */}
      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">Data quality</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {([
              ["Model version", model.modelVersion],
              ["Finalized sessions", model.dataQuality.finalizedSessions],
              ["Completed weeks", model.dataQuality.completedWeeks],
              ["Comparable exercise obs.", model.dataQuality.comparableExerciseObservations],
              ["Activity obs.", model.dataQuality.activityObservations],
              ["Readiness obs.", model.dataQuality.readinessObservations],
              ["Sleep obs.", model.dataQuality.sleepObservations],
              ["Pain obs.", model.dataQuality.painObservations],
              ["Body-weight obs.", model.dataQuality.bodyWeightObservations],
              ["Nutrition obs.", model.dataQuality.nutritionObservations],
              ["Overall confidence", CONFIDENCE_LABEL[model.dataQuality.overallConfidence]],
              ["Processed evidence", model.lastProcessedEvidenceIds.length],
            ] as const).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-white/35">{k}</dt><dd className="text-white/75">{String(v)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/30">Missing domains</p>
          <p className="text-xs text-white/50">{model.dataQuality.missingDomains.join(", ") || "None."}</p>
        </div>

        <div className="rounded border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">Domains</p>
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-white/30">
                <th className="text-left font-normal">Domain</th>
                <th className="text-left font-normal">Status</th>
                <th className="text-left font-normal">Conf.</th>
                <th className="text-right font-normal">Ev.</th>
              </tr>
            </thead>
            <tbody>
              {RESPONSE_DOMAIN_NAMES.map((domain) => {
                const d = model.domains[domain as ResponseDomainName];
                return (
                  <tr key={domain} className="text-white/65">
                    <td>{DOMAIN_LABEL[domain]}</td>
                    <td className="text-white/45">{d.status}</td>
                    <td className="text-white/45">{d.confidence}</td>
                    <td className="text-right">{d.evidenceCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">Assumptions</p>
          <Bullets items={model.assumptions} tone="warn" />
          <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Events</p>
          <ul className="mt-1 space-y-0.5 text-xs text-white/55">
            {allEvents.length === 0 && <li className="text-white/30">None.</li>}
            {allEvents.map((event) => (
              <li key={event.id}>· {RESPONSE_EVENT_LABEL[event.type]} — {event.decision}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Insights ── */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded border border-white/10 bg-black/30 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-white/30">
            Insights ({insights.length} of {model.activeInsights.length + model.archivedInsights.length})
          </p>
          <div className="space-y-1">
            {insights.length === 0 && <p className="text-sm text-white/30">No insights match these filters.</p>}
            {insights.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedInsightId(item.id)}
                className={`w-full rounded border px-2.5 py-1.5 text-left text-xs transition-colors ${
                  selected?.id === item.id ? "border-white/40 bg-white/10" : "border-white/10 hover:border-white/25"
                }`}
              >
                <span className="text-white/40">[{item.domain}/{item.status}/{item.confidence}]</span>{" "}
                <span className="text-white/85">{item.targetLabel}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded border border-white/10 bg-black/30 p-3">
          {selected ? (
            <>
              <p className="text-sm text-white">{selected.targetLabel}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">
                {selected.patternKey} · {selected.id}
              </p>
              <p className="mt-2 text-sm text-white/75">{selected.finding}</p>
              <p className="mt-1 text-sm text-white/50">{selected.interpretation}</p>

              <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Sample</p>
              <p className="text-xs text-white/60">
                {selected.sample.comparableObservations} comparable of {selected.sample.totalObservations} ·
                {" "}{selected.sample.supportingObservations} supporting ·
                {" "}{selected.sample.contradictingObservations} contradicting ·
                {" "}weeks [{selected.sample.weeksRepresented.join(", ") || "—"}] ·
                {" "}phases [{selected.sample.phasesRepresented.join(", ") || "—"}] ·
                {" "}{selected.sample.firstObservedAt} → {selected.sample.lastObservedAt}
              </p>

              <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Confidence trace</p>
              <Bullets items={selected.limitations} tone="warn" />

              <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">
                Supporting evidence ({selected.evidence.supportingEvidenceIds.length})
              </p>
              <pre className="max-h-24 overflow-auto text-[10px] leading-relaxed text-white/45">
                {selected.evidence.supportingEvidenceIds.join("\n") || "—"}
              </pre>

              <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-amber-200/60">
                Contradicting evidence ({selected.evidence.contradictingEvidenceIds.length})
              </p>
              <pre className="max-h-24 overflow-auto text-[10px] leading-relaxed text-amber-100/45">
                {selected.evidence.contradictingEvidenceIds.join("\n") || "—"}
              </pre>

              <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/30">
                Excluded evidence ({selected.evidence.excludedEvidenceIds.length})
              </p>
              <Bullets items={Object.entries(selected.evidence.exclusionReasons).map(([id, reason]) => `${id}: ${reason}`)} />

              <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Recommendation eligibility</p>
              <p className={`text-xs ${selected.recommendationEligibility.eligible ? "text-emerald-200/80" : "text-white/50"}`}>
                {selected.recommendationEligibility.eligible ? "Eligible" : "Not eligible"} — {selected.recommendationEligibility.reason}
              </p>
              {selected.archiveReason && (
                <>
                  <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">Archive reason</p>
                  <p className="text-xs text-white/50">{selected.archiveReason}</p>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-white/30">Select an insight.</p>
          )}
        </div>
      </div>

      {/* ── Recommendations + revisions ── */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">
            Pending recommendations ({model.pendingRecommendations.length})
          </p>
          <div className="mt-2 space-y-2">
            {model.pendingRecommendations.length === 0 && <p className="text-sm text-white/30">None.</p>}
            {model.pendingRecommendations.map((rec) => (
              <div key={rec.id} className="rounded border border-white/10 p-2">
                <p className="text-sm text-white/85">{rec.summary}</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                  {rec.category} · {rec.materiality} · {rec.confidence} · approval {String(rec.approval.required)}
                  {rec.effectiveWeek != null ? ` · week ${rec.effectiveWeek}` : ""}
                  {rec.decisionNote ? ` · ${rec.decisionNote}` : ""}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-white/30">
            Resolved ({model.resolvedRecommendations.length})
          </p>
          <div className="mt-1 space-y-1">
            {model.resolvedRecommendations.map((rec) => (
              <p key={rec.id} className="text-xs text-white/50">
                · {rec.summary} — <span className="text-white/75">{rec.decision}</span>
                {rec.suppressedUntil ? ` (suppressed until ${rec.suppressedUntil.slice(0, 10)})` : ""}
              </p>
            ))}
            {model.resolvedRecommendations.length === 0 && <p className="text-sm text-white/30">None.</p>}
          </div>
        </div>

        <div className="rounded border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">Program revisions</p>
          {applied.revision ? (
            <div className="mt-2 text-xs text-white/70">
              <p className="text-white/85">{applied.revision.reason}</p>
              <p className="mt-1 text-white/45">
                Effective week {applied.revision.effectiveWeek} · affects{" "}
                {applied.revision.affectedWeeks.join(", ")}
              </p>
              <p className="mt-1 text-white/45">
                Approved by {applied.revision.responseMetadata?.approvedBy ?? "—"} ·
                model {applied.revision.responseMetadata?.responseModelVersion ?? "—"}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/30">Before → after (first week)</p>
              <pre className="mt-1 max-h-40 overflow-auto text-[10px] leading-relaxed text-white/50">
                {JSON.stringify(
                  {
                    before: applied.revision.before[0]?.volumeTarget.setTargets,
                    after: applied.revision.after[0]?.volumeTarget.setTargets,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          ) : (
            <p className="mt-2 text-sm text-white/30">No revision — choose &ldquo;accept&rdquo; on a simulation with an approval-required recommendation.</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowJson((v) => !v)}
        className="mt-4 rounded border border-white/20 px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/40"
      >
        {showJson ? "Hide" : "Show"} raw response model JSON
      </button>
      {showJson && (
        <pre className="mt-2 max-h-[32rem] overflow-auto rounded border border-white/10 bg-black/50 p-3 text-[11px] leading-relaxed text-white/50">
          {JSON.stringify(model, null, 2)}
        </pre>
      )}
      <ResponseIntegrationInspector />
    </section>
  );
}
