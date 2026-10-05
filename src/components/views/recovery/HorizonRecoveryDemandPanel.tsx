"use client";

import { AlertTriangle, Moon, Route, ShieldCheck } from "lucide-react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { useActiveProgram } from "@/lib/hooks/useActiveProgram";

const CLASS_COLOR = {
  low: "#6ee7b7",
  moderate: "#5fb7d5",
  high: "#d5b15f",
  "very-high": "#e8c87a",
} as const;

/* Phones: a flush section and plain rows. From md up: the glass panel and its tiles, unchanged. */
const ROW = "md:rounded-xl md:border md:border-white/[0.06] md:bg-white/[0.02] md:p-3";

export function HorizonRecoveryDemandPanel() {
  const { resolution, assumptions } = useActiveProgram();
  if (!resolution) {
    return (
      <GlassPanel accent="#8ea0b8" phone="flush">
        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/35">Active Horizon Recovery Demand</p>
        <p className="mt-2 text-[12px] leading-5 text-white/55">No active Program Horizon is available. Reserve is not creating a generic fatigue or recovery score.</p>
        {assumptions[0] && <p className="mt-1 text-[10px] text-white/35">{assumptions[0]}</p>}
      </GlassPanel>
    );
  }

  const day = resolution.dayRecoveryContext;
  const week = resolution.recoveryDemand;
  const color = CLASS_COLOR[day.systemicDemand];
  const rows = [
    { label: "Local fatigue emphasis", value: day.localFatigueEmphasis.join(" · ") },
    { label: "Lower-body interference", value: day.lowerBodyInterference ?? "No lower-body interference is identified for today's Horizon day." },
    { label: "Impact accumulation", value: day.impactAccumulation ?? "No impact exposure is attached to today's Horizon day." },
    { label: "Next high-demand session", value: day.nextHighDemandSession ?? "No later high-demand session is identified in this week." },
    { label: "Next recovery opportunity", value: day.nextRecoveryOpportunity ?? "No later recovery day is identified in this week." },
    { label: "Current recovery priority", value: day.currentRecoveryPriority },
  ];

  return (
    <GlassPanel accent={color} noPad phone="flush" className="md:overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="pb-4 pt-4 md:border-b md:border-white/[0.06] md:p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2"><ShieldCheck size={13} style={{ color }} /><p className="font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color }}>Active Horizon Recovery Demand</p></div>
          <p className="mt-3 text-[25px] font-black uppercase tracking-tight text-[#f2eee6]">{day.systemicDemand.replace("-", " ")}</p>
          <p className="mt-1 text-[12px] font-semibold text-white/70">{day.dayTitle}</p>
          <p className="mt-1 text-[10.5px] leading-5 text-white/40">Week {resolution.currentWeekNumber} · {resolution.currentPhaseName} · {resolution.status}</p>
          <div className="mt-3 space-y-2">
            <div className={`flex gap-2 ${ROW}`}><Moon size={12} className="mt-0.5 shrink-0" style={{ color }} /><p className="text-[10.5px] leading-5 text-white/50">{day.sleepContext}</p></div>
            <div className={`flex gap-2 ${ROW}`}><AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color }} /><p className="text-[10.5px] leading-5 text-white/50">{day.painContext}</p></div>
          </div>
        </div>
        <div className="pb-1 md:p-5">
          <div className="flex items-center gap-2"><Route size={12} style={{ color }} /><p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/35">Live demand path</p></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 md:gap-2">
            {rows.map((row) => <div key={row.label} className={ROW}><p className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/30">{row.label}</p><p className="mt-1 text-[10.5px] leading-5 text-white/55">{row.value}</p></div>)}
          </div>
          {week.loadWarnings.length > 0 && <div className="mt-3 md:rounded-xl md: md: md:bg-[#e8c87a]/[0.05] md:p-3"><p className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-[#e8c87a]/70">Week load observations</p><ul className="mt-1 space-y-1">{week.loadWarnings.map((warning) => <li key={warning} className="text-[10px] leading-5 text-white/45">· {warning}</li>)}</ul></div>}
          {week.unknowns.length > 0 && <p className="mt-3 text-[9.5px] leading-5 text-white/30">Evidence needed · {week.unknowns.join(" ")}</p>}
        </div>
      </div>
    </GlassPanel>
  );
}
