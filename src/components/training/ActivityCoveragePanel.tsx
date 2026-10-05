"use client";

/* ════════════════════════════════════════════════════════════════════════
   "WHAT DID THIS HIT?" — the one question that turns an activity into a
   training record.

   A group class standing in for leg day IS leg day, but Reserve only knew
   the day was an activity and said "no lifting today". The week showed a
   hole where real work happened.

   The member answers in body regions, because that is what they actually
   know walking out of a class — nobody leaves a 6 AM class knowing their
   tonnage, everybody knows their quads are gone.

   Nothing is ever saved on the member's behalf. A suggestion is pre-selected
   for activities whose content is obvious (a run hits calves), but it is not
   recorded until Save is pressed — a suggestion written in unread is Reserve
   inventing training that may not have happened. A group class suggests
   nothing at all, because its content genuinely cannot be guessed.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { ReserveButton } from "@/components/ui/reserve/ReserveButton";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import {
  TRAINING_REGIONS,
  compareCoverage,
  describeRegions,
  regionsForSplitKey,
  suggestedRegionsFor,
  type TrainingRegion,
} from "@/lib/training/activity-coverage";
import type { SplitActivityKey } from "@/lib/training/split-activities";
import type { ResolvedSplit } from "@/lib/training/workout-templates";


const GROUP_LABEL: Record<"lower" | "upper" | "other", string> = {
  lower: "Lower",
  upper: "Upper",
  other: "Other",
};

export function ActivityCoveragePanel({
  isoDate,
  activityKey,
  activityLabel,
  /** What the day WOULD have trained if it were a lifting day, if anything. */
  plannedSplit,
}: {
  isoDate: string;
  activityKey: SplitActivityKey;
  activityLabel: string;
  plannedSplit?: ResolvedSplit | null;
}) {
  const saved = useAthleteDashboardStore((s) => s.activityCoverage[isoDate]);
  const setActivityCoverage = useAthleteDashboardStore((s) => s.setActivityCoverage);

  /* Seed from the member's own saved answer, else the suggestion. The
     suggestion is only ever a starting position in the picker. */
  const [selected, setSelected] = useState<TrainingRegion[]>(
    () => saved?.regions ?? suggestedRegionsFor(activityKey),
  );
  const [justSaved, setJustSaved] = useState(false);

  const planned = useMemo(() => regionsForSplitKey(plannedSplit), [plannedSplit]);
  const verdict = useMemo(() => compareCoverage(saved?.regions ?? [], planned), [saved?.regions, planned]);
  const savedLine = saved ? describeRegions(saved.regions) : null;

  const dirty =
    !saved ||
    saved.regions.length !== selected.length ||
    saved.regions.some((r) => !selected.includes(r));

  const toggle = (key: TrainingRegion) => {
    setJustSaved(false);
    setSelected((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]));
  };

  const handleSave = () => {
    setActivityCoverage(isoDate, activityKey, selected, saved?.minutes);
    setJustSaved(true);
  };

  return (
    <section
      aria-label="What this session trained"
      data-training="activity-coverage"
      className="mt-4 border-t border-white/[0.07] pt-4"
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#d5b15f]/85">
        What did {activityLabel.toLowerCase()} hit?
      </p>
      <p className="mt-1.5 text-[12.5px] leading-[1.6] text-white/55">
        {saved
          ? "Your record for today. Change it any time."
          : "Reserve did not watch the session — tell it what you trained and the week reads honestly."}
      </p>

      {(["lower", "upper", "other"] as const).map((group) => (
        <div key={group} className="mt-3">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-white/35">{GROUP_LABEL[group]}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {TRAINING_REGIONS.filter((r) => r.group === group).map((region) => {
              const on = selected.includes(region.key);
              return (
                <button
                  key={region.key}
                  type="button"
                  onClick={() => toggle(region.key)}
                  aria-pressed={on}
                  className={`min-h-[36px] rounded-full border px-3.5 text-[12px] transition-colors ${
                    on
                      ? "border-[#d5b15f]/45 bg-[#d5b15f]/[0.12] text-[#f2eee6]"
                      : "border-white/[0.08] bg-white/[0.02] text-white/55 hover:text-white/80"
                  }`}
                >
                  {region.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mt-4 flex items-center gap-2">
        {selected.length === 0 && !saved ? (
          <ReserveButton
            tier="primary"
            size="md"
            icon={CheckCircle2}
            disabled
            disabledReason="Pick at least one area you trained."
          >
            Save what this hit
          </ReserveButton>
        ) : (
          <ReserveButton tier="primary" size="md" icon={CheckCircle2} onClick={handleSave}>
            {saved ? (dirty ? "Update what this hit" : "Saved") : "Save what this hit"}
          </ReserveButton>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {justSaved && !dirty ? "Saved what this session trained." : ""}
      </p>

      {savedLine && (
        <p className="mt-3 text-[12.5px] leading-[1.6] text-white/70">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">Logged</span>{" "}
          {savedLine}.
        </p>
      )}

      {saved && planned.length > 0 && (
        /* A factual comparison of two lists — never a judgement that the class
           was not enough, and never a prescription to add work. */
        <p className="mt-2 text-[12.5px] leading-[1.6] text-white/55">
          {verdict.standsIn
            ? "That covers everything the planned session would have trained."
            : `Untouched from the planned session: ${describeRegions(verdict.missed)?.toLowerCase()}.`}
        </p>
      )}
    </section>
  );
}
