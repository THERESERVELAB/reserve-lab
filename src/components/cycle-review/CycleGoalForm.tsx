"use client";

import { useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveSelect } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import {
  COMPOUND_PURPOSE_LABEL,
  CYCLE_GOAL_LABEL,
  CYCLE_PRIMARY_GOALS,
  CYCLE_PRIORITIES,
  CYCLE_PRIORITY_LABEL,
  type CompoundPurpose,
  type CompoundPurposeKind,
  type CycleGoalSetup,
  type CyclePrimaryGoal,
  type CyclePriority,
} from "@/lib/cycle-review/types";
import { RESERVE, alpha } from "@/lib/design/tokens";

const PURPOSE_KINDS = Object.keys(COMPOUND_PURPOSE_LABEL) as CompoundPurposeKind[];

/**
 * What the member is trying to accomplish with this cycle — in their words.
 * Reserve reads the plan against this; it never assumes maximum muscle.
 */
export function CycleGoalForm({
  cycleId,
  compounds,
  initial,
  onDone,
}: {
  cycleId: string;
  compounds: Array<{ id: string; name: string }>;
  initial: CycleGoalSetup | null;
  onDone: () => void;
}) {
  const setCycleGoal = useAthleteDashboardStore((s) => s.setCycleGoal);
  const [goal, setGoal] = useState<CyclePrimaryGoal | null>(initial?.primaryGoal ?? null);
  const [priorities, setPriorities] = useState<CyclePriority[]>(initial?.priorities ?? []);
  const [purposes, setPurposes] = useState<Record<string, CompoundPurpose>>(initial?.compoundPurposes ?? {});

  const togglePriority = (priority: CyclePriority) =>
    setPriorities((current) => (current.includes(priority) ? current.filter((p) => p !== priority) : [...current, priority]));

  const setPurpose = (id: string, kind: string) =>
    setPurposes((current) => {
      const next = { ...current };
      if (!kind) delete next[id];
      else next[id] = { kind: kind as CompoundPurposeKind };
      return next;
    });

  const save = () => {
    if (!goal) return;
    const compoundPurposes = Object.fromEntries(Object.entries(purposes).filter(([id]) => compounds.some((c) => c.id === id)));
    setCycleGoal(cycleId, { primaryGoal: goal, priorities, compoundPurposes });
    onDone();
  };

  return (
    <GlassPanel accent={RESERVE.gold}>
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <p className="type-whisper" style={{ color: alpha(RESERVE.gold, 0.85) }}>Cycle review · goal</p>
          <h2 className="mt-1.5 text-[19px] font-bold leading-tight" style={{ color: RESERVE.ivory }}>
            What is this cycle for?
          </h2>
          <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.55] text-white/55">
            Reserve reads your plan, labs and training against the goal you set, not a default of more muscle.
          </p>
        </div>

        <fieldset>
          <legend className="text-[12px] font-semibold text-white/70">Primary goal</legend>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {CYCLE_PRIMARY_GOALS.map((key) => {
              const checked = goal === key;
              return (
                <label
                  key={key}
                  className="flex min-h-[48px] cursor-pointer items-center rounded-[12px] px-3 py-2 text-[12.5px] leading-tight transition focus-within:ring-2 focus-within:ring-[#d5b15f]/70"
                  style={{
                    background: checked ? alpha(RESERVE.gold, 0.12) : "rgba(255,255,255,0.025)",
                    boxShadow: checked ? `inset 0 0 0 1px ${alpha(RESERVE.gold, 0.5)}` : "inset 0 0 0 1px rgba(255,255,255,0.05)",
                    color: checked ? RESERVE.ivory : "rgba(255,255,255,0.68)",
                  }}
                >
                  <input type="radio" name="cycle-goal" value={key} checked={checked} onChange={() => setGoal(key)} className="sr-only" />
                  {CYCLE_GOAL_LABEL[key]}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-[12px] font-semibold text-white/70">Also important to you</legend>
          <p className="mt-0.5 text-[11.5px] text-white/45">Optional. Reserve flags parts of the plan known to work against these.</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {CYCLE_PRIORITIES.map((key) => {
              const checked = priorities.includes(key);
              return (
                <label
                  key={key}
                  className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2 text-[12.5px] transition focus-within:ring-2 focus-within:ring-[#5fb7d5]/70"
                  style={{
                    background: checked ? alpha(RESERVE.steel, 0.1) : "transparent",
                    color: checked ? RESERVE.ivory : "rgba(255,255,255,0.65)",
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => togglePriority(key)} className="h-4 w-4 shrink-0 accent-[#5fb7d5]" />
                  {CYCLE_PRIORITY_LABEL[key]}
                </label>
              );
            })}
          </div>
        </fieldset>

        {compounds.length > 0 && (
          <fieldset>
            <legend className="text-[12px] font-semibold text-white/70">Why each compound is in the plan</legend>
            <p className="mt-0.5 text-[11.5px] text-white/45">As you would explain it. Compounds without a recorded purpose are raised in the review.</p>
            <div className="mt-2 flex flex-col divide-y divide-white/[0.05]">
              {compounds.map((compound) => (
                <div key={compound.id} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="text-[13px]" style={{ color: RESERVE.ivory }}>{compound.name}</span>
                  <div className="sm:w-[280px]">
                    <ReserveSelect
                      srLabel={`Purpose for ${compound.name}`}
                      value={purposes[compound.id]?.kind ?? ""}
                      options={[{ value: "", label: "Not recorded" }, ...PURPOSE_KINDS.map((kind) => ({ value: kind, label: COMPOUND_PURPOSE_LABEL[kind] }))]}
                      onChange={(value) => setPurpose(compound.id, value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {goal ? (
            <ReserveButton tier="primary" type="submit">
              Save and review
            </ReserveButton>
          ) : (
            <ReserveButton tier="primary" disabled disabledReason="Choose a primary goal first.">
              Save and review
            </ReserveButton>
          )}
          {initial && (
            <ReserveButton tier="quiet" onClick={onDone}>
              Cancel
            </ReserveButton>
          )}
        </div>
      </form>
    </GlassPanel>
  );
}
