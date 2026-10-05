"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { ReserveBottomSheet, ReserveButton } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import {
  MOBILITY_TARGET_MAX,
  MOBILITY_TARGET_MIN,
  WATER_TARGET_CHOICES,
  WATER_TARGET_MAX,
  WATER_TARGET_MIN,
  WATER_TARGET_STEP,
  clampMobilityTarget,
  clampWaterTarget,
} from "@/lib/recovery/water";

/**
 * YOUR TARGETS — the member sets their own water and mobility numbers. Reserve
 * reads the day against them and never says what they should be.
 */
export function RecoveryTargetsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ReserveBottomSheet open={open} onClose={onClose} title="Your targets" accent={RESERVE.steel}>
      {open && <TargetsForm onClose={onClose} />}
    </ReserveBottomSheet>
  );
}

function TargetsForm({ onClose }: { onClose: () => void }) {
  const saved = useAthleteDashboardStore((s) => s.recoveryCommand);
  const updateRecoveryTargets = useAthleteDashboardStore((s) => s.updateRecoveryTargets);
  const [water, setWater] = useState(saved.hydrationTargetOz);
  const [mobility, setMobility] = useState(saved.mobilityWeeklyTarget);

  return (
    <form
      className="flex flex-col gap-6"
      data-recovery-targets
      onSubmit={(e) => {
        e.preventDefault();
        updateRecoveryTargets({ hydrationTargetOz: clampWaterTarget(water), mobilityWeeklyTarget: clampMobilityTarget(mobility) });
        onClose();
      }}
    >
      <p className="text-[12.5px] leading-[1.55] text-white/60">Your numbers, set by you. Recovery reads your day against them.</p>

      <fieldset>
        <legend className="type-whisper" style={{ color: alpha(RESERVE.steel, 0.9) }}>Water a day</legend>
        <Stepper
          label="Water target"
          value={water}
          unit="oz"
          onChange={setWater}
          step={WATER_TARGET_STEP}
          min={WATER_TARGET_MIN}
          max={WATER_TARGET_MAX}
        />
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Water target choices">
          {WATER_TARGET_CHOICES.map((oz) => (
            <Chip key={oz} on={oz === water} onClick={() => setWater(oz)}>{oz} oz</Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="type-whisper" style={{ color: alpha(RESERVE.steel, 0.9) }}>Mobility sessions a week</legend>
        <Stepper
          label="Mobility target"
          value={mobility}
          unit={mobility === 1 ? "session" : "sessions"}
          onChange={setMobility}
          step={1}
          min={MOBILITY_TARGET_MIN}
          max={MOBILITY_TARGET_MAX}
        />
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <ReserveButton tier="primary" type="submit">Save targets</ReserveButton>
        <ReserveButton tier="quiet" onClick={onClose}>Cancel</ReserveButton>
      </div>
    </form>
  );
}

function Stepper({ label, value, unit, onChange, step, min, max }: { label: string; value: number; unit: string; onChange: (v: number) => void; step: number; min: number; max: number }) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <button type="button" aria-label={`Lower ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} className="grid h-11 w-11 place-items-center rounded-full text-white/70 disabled:opacity-30" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)" }}>
        <Minus size={16} />
      </button>
      <label className="flex items-baseline gap-1.5">
        <span className="sr-only">{label}</span>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 rounded-lg border border-white/[0.1] bg-black/30 px-2 py-2 text-center text-[20px] font-black text-[#f2eee6] outline-none focus:border-white/30"
        />
        <span className="text-[13px] text-white/55">{unit}</span>
      </label>
      <button type="button" aria-label={`Raise ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} className="grid h-11 w-11 place-items-center rounded-full text-white/70 disabled:opacity-30" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)" }}>
        <Plus size={16} />
      </button>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="min-h-[36px] rounded-full px-3 text-[12px] transition"
      style={{ background: on ? alpha(RESERVE.steel, 0.16) : "rgba(255,255,255,0.03)", boxShadow: `inset 0 0 0 1px ${on ? alpha(RESERVE.steel, 0.5) : "rgba(255,255,255,0.08)"}`, color: on ? RESERVE.ivory : "rgba(255,255,255,0.65)" }}
    >
      {children}
    </button>
  );
}
