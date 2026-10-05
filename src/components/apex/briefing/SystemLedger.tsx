"use client";

import { Activity, ArrowRight } from "lucide-react";

import type { StrategistBriefing } from "@/lib/ai-strategist/types";
import type { DashboardView } from "@/lib/athlete-store";
import { isDashboardView } from "@/lib/apex/source-to-view";
import { GlassPanel } from "@/components/ui/GlassPanel";

import { C, STATUS_COLOR, STATUS_LABEL } from "./shared";

/* ════════════════════════════════════════════════════════════════════════
   SYSTEM LEDGER — the System Status bento, flattened into one list.

   Each system, its status word, its whole note, and a link only where the
   matrix names a real view. No lead card, no tiles, no line clamp: the
   Bloodwork and Compound notes are the log-only statements, and a clamped
   compliance statement is a truncated one. Rows separate with light, not
   drawn rules (Bible §06).
   ════════════════════════════════════════════════════════════════════════ */

export type SystemLedgerProps = {
  systems: StrategistBriefing["systemMatrix"];
  onNavigate: (view: DashboardView) => void;
};

export function SystemLedger({ systems, onNavigate }: SystemLedgerProps) {
  return (
    <GlassPanel accent={C.STEEL}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Activity size={14} style={{ color: C.STEEL }} />
        <h3 className="font-mono text-[8.5px] uppercase tracking-[0.24em]" style={{ color: `${C.STEEL}cc` }}>System Status</h3>
      </div>
      <ul>
        {systems.map((sys, i) => {
          const color = STATUS_COLOR[sys.status];
          const target = sys.target && isDashboardView(sys.target) ? sys.target : null;
          return (
            <li key={sys.system} className="relative py-2">
              {i > 0 && (
                <span
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.09), rgba(255,255,255,0.01))" }}
                  aria-hidden="true"
                />
              )}
              <div className="flex min-h-[28px] flex-wrap items-center gap-x-2 gap-y-1">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 7px ${color}` }} aria-hidden="true" />
                <p className="text-[11.5px] font-bold text-[#f2eee6]">{sys.system}</p>
                <span className="font-mono text-[7px] uppercase tracking-[0.12em]" style={{ color }}>{STATUS_LABEL[sys.status]}</span>
                {target && (
                  <button
                    type="button"
                    onClick={() => onNavigate(target)}
                    className="ml-auto inline-flex min-h-[44px] items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white/40 transition hover:text-white/70"
                  >
                    {sys.actionLabel ?? "Open"}<ArrowRight size={9} />
                  </button>
                )}
              </div>
              <p className="pl-3.5 text-[11px] leading-[1.5] text-white/55">{sys.note}</p>
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
