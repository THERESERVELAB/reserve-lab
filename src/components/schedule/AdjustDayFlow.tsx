"use client";

/* ════════════════════════════════════════════════════════════════════════
   ADJUST DAY — the athlete-facing reconciliation workflow.

   Five stages: what changed → one-time or recurring → the activity →
   how Reserve should treat it → review and confirm.

   Reserve infers stress and overlap and proposes an adjustment. The athlete
   decides. Nothing is applied without an explicit confirmation, and the
   review stage shows exactly which weeks are affected before anything moves.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { DiscardChangesBar, ReserveSelect, useDirtySnapshot, useFormCloseGuard } from "@/components/ui/reserve";
import { useProgramHorizon } from "@/lib/hooks/useProgramHorizon";
import type {
  ActivityIntensity,
  ActivityRelationship,
  ActivityType,
  AthleteActivity,
} from "@/lib/schedule/activity-reconciliation";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Stage = "what" | "cadence" | "activity" | "treatment" | "review" | "done";

type ChangeKind = {
  id: string;
  label: string;
  hint: string;
  /** What the day is called if the athlete does not name it themselves. */
  defaultTitle: string;
  activityType: ActivityType;
  focusAreas: string[];
  defaultIntensity: ActivityIntensity;
  defaultMinutes: number;
};

const CHANGE_KINDS: ChangeKind[] = [
  { id: "class", label: "Added a class", hint: "A group fitness or studio class.", defaultTitle: "Group Class", activityType: "group-fitness", focusAreas: ["lower body", "legs"], defaultIntensity: "high", defaultMinutes: 60 },
  { id: "sport", label: "Added a sport", hint: "A game, match, or league session.", defaultTitle: "Sport Session", activityType: "sport", focusAreas: ["conditioning", "sport"], defaultIntensity: "high", defaultMinutes: 90 },
  { id: "run", label: "Added a run", hint: "Any outdoor or treadmill distance.", defaultTitle: "Run", activityType: "running", focusAreas: ["distance", "conditioning", "lower body"], defaultIntensity: "moderate", defaultMinutes: 45 },
  { id: "conditioning", label: "Added conditioning", hint: "Intervals, rowing, cycling, or a circuit.", defaultTitle: "Conditioning", activityType: "conditioning", focusAreas: ["conditioning"], defaultIntensity: "moderate", defaultMinutes: 30 },
  { id: "moved", label: "Moved a workout", hint: "The session happened, on a different day.", defaultTitle: "Moved Session", activityType: "lifting", focusAreas: ["training"], defaultIntensity: "moderate", defaultMinutes: 60 },
  { id: "skipped", label: "Skipped a workout", hint: "The session did not happen.", defaultTitle: "Skipped Session", activityType: "recovery", focusAreas: [], defaultIntensity: "low", defaultMinutes: 0 },
  { id: "reduced", label: "Reduced a session", hint: "It happened, but shorter or lighter.", defaultTitle: "Reduced Session", activityType: "lifting", focusAreas: ["training"], defaultIntensity: "low", defaultMinutes: 30 },
  { id: "equipment", label: "Equipment unavailable", hint: "What you needed was not free or not there.", defaultTitle: "Equipment-Limited Session", activityType: "lifting", focusAreas: ["training"], defaultIntensity: "moderate", defaultMinutes: 60 },
  { id: "pain", label: "Pain or injury adjustment", hint: "Something was uncomfortable. Recorded, not assessed.", defaultTitle: "Adjusted Session", activityType: "mobility", focusAreas: ["mobility"], defaultIntensity: "low", defaultMinutes: 30 },
  { id: "travel", label: "Travel", hint: "Away from your usual training environment.", defaultTitle: "Travel Session", activityType: "custom", focusAreas: [], defaultIntensity: "low", defaultMinutes: 45 },
  { id: "conflict", label: "Schedule conflict", hint: "Something else took the slot.", defaultTitle: "Schedule Conflict", activityType: "custom", focusAreas: [], defaultIntensity: "unknown", defaultMinutes: 0 },
];

const TREATMENTS: Array<{ id: ActivityRelationship; label: string; hint: string }> = [
  { id: "reserve-decides", label: "Let Reserve decide", hint: "Reserve reads the overlap and stress, then proposes the adjustment." },
  { id: "replace", label: "This replaces the session", hint: "Treat it as that day's primary training." },
  { id: "supplement", label: "This is in addition", hint: "Keep the planned session and add this alongside." },
  { id: "reschedule", label: "Move the planned session", hint: "This takes the day; the session moves elsewhere." },
];

export function AdjustDayFlow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { horizon, currentWeek, preview, applyActivity } = useProgramHorizon();

  const [stage, setStage] = useState<Stage>("what");
  const [kindId, setKindId] = useState<string | null>(null);
  const [recurring, setRecurring] = useState(false);
  const [dayIndex, setDayIndex] = useState(4);
  const [startTime, setStartTime] = useState("05:45");
  const [minutes, setMinutes] = useState(60);
  const [intensity, setIntensity] = useState<ActivityIntensity>("high");
  const [title, setTitle] = useState("");
  const [treatment, setTreatment] = useState<ActivityRelationship>("reserve-decides");
  const [result, setResult] = useState<{ blocked: boolean; message: string } | null>(null);

  const kind = CHANGE_KINDS.find((k) => k.id === kindId) ?? null;

  const activity = useMemo<AthleteActivity | null>(() => {
    if (!kind) return null;
    return {
      id: `athlete-${kind.id}-${dayIndex}-${startTime}`,
      title: title.trim() || kind.defaultTitle,
      source: "athlete-added",
      recurrence: recurring ? "weekly" : "one-time",
      dayOfWeek: dayIndex,
      startTime,
      durationMinutes: minutes,
      location: kind.activityType === "running" ? "outdoor" : kind.activityType === "group-fitness" ? "studio" : "commercial-gym",
      activityType: kind.activityType,
      focusAreas: kind.focusAreas,
      intensity,
      relationship: treatment,
    };
  }, [kind, dayIndex, startTime, minutes, intensity, title, recurring, treatment]);

  const proposal = useMemo(() => (activity ? preview(activity) : null), [activity, preview]);

  const reset = () => {
    setStage("what"); setKindId(null); setRecurring(false); setDayIndex(4);
    setStartTime("05:45"); setMinutes(60); setIntensity("high"); setTitle("");
    setTreatment("reserve-decides"); setResult(null);
  };

  const close = () => { reset(); onClose(); };

  /* A flow in progress asks before X or Escape throws it away; once applied,
     nothing is left to lose. */
  const changed = useDirtySnapshot({ stage, kindId, recurring, dayIndex, startTime, minutes, intensity, title, treatment }, open);
  const guard = useFormCloseGuard(open && stage !== "done" && changed, close, { escape: open });

  const confirm = () => {
    if (!activity) return;
    const r = applyActivity(activity, true);
    if (r.blocked) {
      setResult({ blocked: true, message: r.blockedReason ?? "Reserve could not apply that change." });
      return;
    }
    setResult({
      blocked: false,
      message: recurring
        ? `Applied from week ${currentWeek} onward. Your completed weeks are unchanged, and the original projection is kept.`
        : `Applied to week ${currentWeek} only. Your future weeks keep their original plan.`,
    });
    setStage("done");
  };

  if (!open) return null;

  const stageIndex = ["what", "cadence", "activity", "treatment", "review"].indexOf(stage);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Adjust day">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border-white/12 bg-[#0b0d12] p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">Adjust day</p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-white">
              {stage === "done" ? "Adjustment applied" : "What changed?"}
            </h2>
          </div>
          <button
            type="button"
            onClick={guard.requestClose}
            aria-label="Close"
            className="rounded-full p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <DiscardChangesBar guard={guard} />

        {stage !== "done" && (
          <div className="mt-4 flex gap-1.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-0.5 flex-1 rounded-full ${i <= stageIndex ? "bg-white/70" : "bg-white/12"}`} />
            ))}
          </div>
        )}

        {!horizon && (
          <p className="mt-5 text-sm text-white/55">
            There is no active program to adjust yet. Select a protocol in Personal Command first.
          </p>
        )}

        {horizon && stage === "what" && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {CHANGE_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => {
                  setKindId(k.id);
                  setIntensity(k.defaultIntensity);
                  setMinutes(k.defaultMinutes);
                  setStage("cadence");
                }}
                className="rounded-lg border border-white/12 p-3 text-left transition-colors hover:border-white/35 hover:bg-white/[0.04]"
              >
                <p className="text-sm text-white">{k.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/45">{k.hint}</p>
              </button>
            ))}
          </div>
        )}

        {horizon && stage === "cadence" && (
          <div className="mt-5">
            <p className="text-sm text-white/70">Is this a one-time change, or does it repeat every week?</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => { setRecurring(false); setStage("activity"); }}
                className="rounded-lg border border-white/12 p-3 text-left transition-colors hover:border-white/35 hover:bg-white/[0.04]"
              >
                <p className="text-sm text-white">One time</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/45">
                  Reserve adjusts this week only. Your future weeks keep their original plan.
                </p>
              </button>
              <button
                type="button"
                onClick={() => { setRecurring(true); setStage("activity"); }}
                className="rounded-lg border border-white/12 p-3 text-left transition-colors hover:border-white/35 hover:bg-white/[0.04]"
              >
                <p className="text-sm text-white">Every week</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/45">
                  Reserve re-plans this week and every future week around it. Completed weeks are never rewritten.
                </p>
              </button>
            </div>
          </div>
        )}

        {horizon && stage === "activity" && kind && (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">What is it called?</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={kind.defaultTitle}
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus-visible:border-white/45"
              />
            </label>

            <div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">Which day?</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {DAY_NAMES.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDayIndex(i)}
                    className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                      dayIndex === i ? "bg-white text-black" : "bg-white/[0.06] text-white/60 hover:bg-white/12"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">Start time</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus-visible:border-white/45"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">Minutes</span>
                <input
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus-visible:border-white/45"
                />
              </label>
              {/* A <label> cannot name a listbox trigger, so the label moves
                  inside the control where it is wired with aria-labelledby. */}
              <div className="block">
                <ReserveSelect
                  label="Intensity"
                  value={intensity}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "moderate", label: "Moderate" },
                    { value: "high", label: "High" },
                    { value: "unknown", label: "Not sure" },
                  ]}
                  onChange={(v) => setIntensity(v as ActivityIntensity)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setStage("cadence")} className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-white/60 transition-colors hover:border-white/40">
                Back
              </button>
              <button type="button" onClick={() => setStage("treatment")} className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-black">
                Continue
              </button>
            </div>
          </div>
        )}

        {horizon && stage === "treatment" && (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-white/70">How should Reserve treat it?</p>
            <div className="grid gap-2">
              {TREATMENTS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTreatment(t.id); setStage("review"); }}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    treatment === t.id ? "border-white/40 bg-white/[0.06]" : "border-white/12 hover:border-white/35"
                  }`}
                >
                  <p className="text-sm text-white">{t.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/45">{t.hint}</p>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setStage("activity")} className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-white/60 transition-colors hover:border-white/40">
              Back
            </button>
          </div>
        )}

        {horizon && stage === "review" && proposal && (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border-white/15 bg-white/[0.04] p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Reserve recommends</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white">{proposal.proposal.recommendation}</p>
              <p className="mt-2 text-xs text-white/40">
                Risk reads {proposal.proposal.riskLevel}
                {recurring
                  ? ` · applies from week ${proposal.currentWeek} onward (${proposal.affectedWeeks.length} weeks)`
                  : ` · applies to week ${proposal.currentWeek} only`}
              </p>
            </div>

            {proposal.proposal.rationale.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Why</p>
                <ul className="mt-1.5 space-y-1.5 text-sm leading-relaxed text-white/65">
                  {proposal.proposal.rationale.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {[
              ["Kept as planned", proposal.proposal.preserve],
              ["Replaced", proposal.proposal.replace],
              ["Moved", proposal.proposal.move],
              ["Eased", proposal.proposal.reduce],
            ].map(([label, items]) => {
              const list = items as string[];
              if (list.length === 0) return null;
              return (
                <div key={label as string}>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">{label as string}</p>
                  <ul className="mt-1 space-y-1 text-sm text-white/60">
                    {list.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              );
            })}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Nutrition</p>
                <ul className="mt-1 space-y-1 text-sm text-white/60">
                  {proposal.proposal.nutritionChanges.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Recovery</p>
                <ul className="mt-1 space-y-1 text-sm text-white/60">
                  {proposal.proposal.recoveryChanges.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </div>

            {result?.blocked && (
              <p className="rounded border border-rose-300/25 bg-rose-300/[0.06] px-3 py-2 text-sm text-rose-100">{result.message}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setStage("treatment")} className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-white/60 transition-colors hover:border-white/40">
                Back
              </button>
              <button type="button" onClick={confirm} className="rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-black">
                Confirm adjustment
              </button>
            </div>
          </div>
        )}

        {stage === "done" && result && (
          <div className="mt-5 space-y-4">
            <p className="text-sm leading-relaxed text-white/75">{result.message}</p>
            <button type="button" onClick={close} className="rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-black">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
