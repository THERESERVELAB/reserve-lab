"use client";

import { AlertTriangle, Utensils } from "lucide-react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import type { NutritionAlignment } from "@/lib/nutrition/useNutritionAlignment";

/* Protocol-matched nutrition truth — shared by Apex (compact) and Nutrition
   Command (full). Reads the alignment engine so the macros obey the mission.
   Organization only — no medical claims, no guaranteed outcomes. */

const C = { GREEN: "#6ee7b7", GOLD: "#d5b15f", AMBER: "#e8c87a", STEEL: "#5fb7d5", RED: "#ef7d55" };

function todayStrategy(a: NutritionAlignment): string {
  const r = a.resolution;
  switch (a.dayKind) {
    case "lower-body": return r.lowerBodyDayStrategy;
    case "high-output": return r.trainingDayStrategy;
    case "conditioning": return r.conditioningDayStrategy;
    case "rest": return r.restDayStrategy;
    case "recovery": return r.recoveryDayStrategy;
    default: return r.trainingDayStrategy;
  }
}

export function NutritionAlignmentCard({
  alignment,
  compact = false,
  onOpen,
}: {
  alignment: NutritionAlignment;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const { resolution: r, macros, todayMacros } = alignment;
  const warnings = r.conflictWarnings;
  const hasWarning = warnings.some((w) => w.severity === "warning");
  const accent = hasWarning ? C.AMBER : C.GREEN;

  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Utensils size={13} style={{ color: accent }} />
          <p className="font-mono text-[9px] uppercase tracking-[0.24em]" style={{ color: accent }}>Nutrition Alignment</p>
        </div>
        <span className="rounded-full border px-2.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em]" style={{ borderColor: `${C.GOLD}45`, background: `${C.GOLD}12`, color: C.GOLD }}>
          {r.phaseLabel}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {alignment.protocolName && <span className="text-[11px] font-bold text-[#f2eee6]">{alignment.protocolName}</span>}
        <span className="rounded-full border px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.14em]" style={{ borderColor: `${C.STEEL}40`, color: C.STEEL }}>{alignment.dayLabel}</span>
      </div>

      {/* Macro direction */}
      <p className="mt-2 text-[11px] leading-[1.5] text-white/60"><span className="font-mono text-[7.5px] uppercase tracking-[0.14em]" style={{ color: `${C.GOLD}cc` }}>Macro direction · </span>{r.calorieBias}</p>

      {/* Today's fuel bias */}
      <p className="mt-1.5 text-[11px] leading-[1.5] text-white/60"><span className="font-mono text-[7.5px] uppercase tracking-[0.14em]" style={{ color: `${accent}cc` }}>Today&apos;s fuel bias · </span>{todayStrategy(alignment)}</p>

      {/* Macros (or missing-data state) */}
      {macros.incomplete || !todayMacros ? (
        <p className="mt-2 rounded-lg px-2.5 py-1.5 text-[10.5px] leading-snug" style={{ borderColor: `${C.AMBER}33`, background: `${C.AMBER}0c`, color: C.AMBER }}>
          Macro targets need body weight and goal phase to finalize.{onOpen ? "" : " Add them in Settings."}
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {[
            { k: "Cal", v: todayMacros.calories, c: C.GOLD },
            { k: "Protein", v: `${todayMacros.proteinG}g`, c: C.GREEN },
            { k: "Carbs", v: `${todayMacros.carbsG}g`, c: C.STEEL },
            { k: "Fat", v: `${todayMacros.fatG}g`, c: C.AMBER },
          ].map((m) => (
            <div key={m.k} className="rounded-lg bg-white/[0.02] px-2 py-1.5 text-center">
              <p className="font-mono text-[6.5px] uppercase tracking-[0.14em] text-white/35">{m.k}</p>
              <p className="mt-0.5 text-[12px] font-black leading-none" style={{ color: m.c }}>{m.v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Conflict warnings */}
      {warnings.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] leading-snug" style={{ color: w.severity === "warning" ? C.AMBER : "rgba(255,255,255,0.5)" }}>
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />{w.message}
            </div>
          ))}
        </div>
      )}

      {!compact && (
        <p className="mt-2.5 text-[9px] leading-snug text-white/30">{macros.safetyCopy}</p>
      )}
    </>
  );

  if (onOpen) {
    return (
      <GlassPanel accent={accent} noPad className="overflow-hidden">
        <button type="button" onClick={onOpen} className="block w-full p-4 text-left transition hover:bg-white/[0.02]">{body}</button>
      </GlassPanel>
    );
  }
  return <GlassPanel accent={accent}>{body}</GlassPanel>;
}
