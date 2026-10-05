"use client";

import { ArrowRight, Gauge } from "lucide-react";

import type { DashboardView } from "@/lib/athlete-store";
import type { EnhancementDailySummary } from "@/lib/enhancement/schedule";
import { GlassPanel } from "@/components/ui/GlassPanel";

import { C } from "./shared";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE SMART BRIEF — the seven-line brief (Bible §12 contract), moved
   out of ApexCommandV2 with its markup and strings unchanged.
   ════════════════════════════════════════════════════════════════════════ */

/** The Smart Brief lines, each composed from today's real data by the Apex model. */
export type SmartBrief = {
  mission: string;
  highRoi: string;
  limiter: string;
  protect: string;
  avoid: string;
  afterTraining: string;
  nextEvidence: string;
};

export type SmartBriefBlockProps = {
  smartBrief: SmartBrief;
  confidenceLevel: string;
  intakeSummary: EnhancementDailySummary;
  onNavigate: (view: DashboardView) => void;
};

export function SmartBriefBlock({ smartBrief, confidenceLevel, intakeSummary, onNavigate }: SmartBriefBlockProps) {
  return (
    <GlassPanel accent={C.VIOLET}>
      <div className="mb-3 flex items-center gap-2">
        <Gauge size={14} style={{ color: C.VIOLET }} />
        <h3 className="font-mono text-[8.5px] uppercase tracking-[0.24em]" style={{ color: `${C.VIOLET}dd` }}>Reserve Smart Brief</h3>
        <span className="ml-auto font-mono text-[7px] uppercase tracking-[0.14em] text-white/30">{confidenceLevel} confidence</span>
      </div>
      {/* Hairline rows, not tinted tiles: the panel is the only surface (no card in a card). */}
      <div className="divide-y divide-white/[0.05]">
        {[
          { k: "Today's Mission", v: smartBrief.mission, c: C.GOLD },
          { k: "High ROI Move", v: smartBrief.highRoi, c: C.GREEN },
          { k: "Limiter", v: smartBrief.limiter, c: C.AMBER },
          { k: "Protect", v: smartBrief.protect, c: C.STEEL },
          { k: "Avoid", v: smartBrief.avoid, c: C.RED },
          { k: "After Training", v: smartBrief.afterTraining, c: C.VIOLET },
          { k: "Next Evidence", v: smartBrief.nextEvidence, c: C.SLATE },
        ].map((r) => (
          <div key={r.k} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="w-[84px] shrink-0 pt-px font-mono text-[7.5px] uppercase leading-[1.5] tracking-[0.14em]" style={{ color: r.c }}>{r.k}</span>
            <span className="text-[11.5px] leading-[1.45] text-white/65">{r.v}</span>
          </div>
        ))}
      </div>
      {intakeSummary.planned > 0 && (
        <p className="mt-2.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">
          Intake · {intakeSummary.taken} of {intakeSummary.planned} completed
          {intakeSummary.nextSlot ? ` · next ${intakeSummary.nextSlot.plannedTimeLabel}` : ""}
          <span className="text-white/20"> · log-only</span>
        </p>
      )}
      <button type="button" onClick={() => onNavigate("ai-strategist")} className="mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition hover:bg-white/[0.03]" style={{ borderColor: `${C.VIOLET}40`, background: `${C.VIOLET}10`, color: C.VIOLET }}>Open AI Strategist<ArrowRight size={12} /></button>
    </GlassPanel>
  );
}
