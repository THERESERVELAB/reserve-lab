"use client";

import { ArrowRight, User } from "lucide-react";

import type { DashboardView } from "@/lib/athlete-store";
import { GlassPanel } from "@/components/ui/GlassPanel";

import { C } from "./shared";

/* ════════════════════════════════════════════════════════════════════════
   PHYSIQUE PRIORITY — moved out of ApexCommandV2 with its markup and strings
   unchanged, less one row.

   The "Signal Watch" row ("Waist trend · training output · recovery
   compliance") was a hard-coded string presented as a live read. Nothing
   derived it from member data, which is fabricated provenance (Bible §12),
   so it is gone. Momentum and Next Evidence both come from real state.
   ════════════════════════════════════════════════════════════════════════ */

export type PhysiquePriorityBlockProps = {
  weakPointLabels: string[];
  momentum: string;
  checkInCadence: string;
  physiqueEvidence: number;
  onNavigate: (view: DashboardView) => void;
};

export function PhysiquePriorityBlock({ weakPointLabels, momentum, checkInCadence, physiqueEvidence, onNavigate }: PhysiquePriorityBlockProps) {
  return (
    <GlassPanel accent={C.GOLD}>
      <div className="mb-3 flex items-center gap-2"><User size={14} style={{ color: C.GOLD }} /><h3 className="font-mono text-[8.5px] uppercase tracking-[0.24em]" style={{ color: `${C.GOLD}cc` }}>Physique Priority</h3></div>
      <p className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/35">Weak-Point Focus</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {(weakPointLabels.length ? weakPointLabels : ["Balanced frame"]).map((w) => (
          <span key={w} className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-[#f2eee6]" style={{ borderColor: `${C.VIOLET}33`, background: `${C.VIOLET}10` }}>{w}</span>
        ))}
      </div>
      <div className="mt-3 divide-y divide-white/[0.05]">
        {[
          { k: "Momentum", v: momentum, c: C.GREEN },
          { k: "Next Evidence", v: `${checkInCadence} check-in · ${physiqueEvidence > 0 ? `${physiqueEvidence} logged` : "add baseline photos + measurements"}`, c: C.GOLD },
        ].map((r) => (
          <div key={r.k} className="flex gap-3 py-2.5 last:pb-0">
            <span className="w-[78px] shrink-0 font-mono text-[7.5px] uppercase tracking-[0.14em]" style={{ color: r.c }}>{r.k}</span>
            <span className="text-[11.5px] leading-[1.4] text-white/65">{r.v}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onNavigate("physique")} className="mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition hover:bg-white/[0.03]" style={{ borderColor: `${C.GOLD}40`, background: `${C.GOLD}10`, color: C.GOLD }}>Open Physique Command<ArrowRight size={12} /></button>
    </GlassPanel>
  );
}
