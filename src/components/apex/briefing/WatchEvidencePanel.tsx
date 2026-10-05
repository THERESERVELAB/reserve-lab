"use client";

import { ArrowRight, Eye } from "lucide-react";

import type { StrategistBriefing } from "@/lib/ai-strategist/types";
import type { DashboardView } from "@/lib/athlete-store";
import type { EvidenceItem } from "@/lib/apex/command-intelligence";
import { sourceToView } from "@/lib/apex/source-to-view";
import { GlassPanel } from "@/components/ui/GlassPanel";

import { C } from "./shared";

/* ════════════════════════════════════════════════════════════════════════
   WATCH LIST + EVIDENCE NEEDED — one panel, rendered below the line on the
   page (not inside Full briefing). Strings are the ones that shipped.

   Rows separate with hairlines, not bordered boxes: a card inside this glass
   panel would be a third surface level (components.md allows two). Text that
   carries information found nowhere else meets AA, and every link is a real
   44px target.

   The per-signal link works. The old `sourceToView` compared lowercase keys
   against the capitalised sources the strategist emits ("Recovery",
   "Physique"), so it always returned null and no "Open …" link rendered.
   ════════════════════════════════════════════════════════════════════════ */

export type WatchEvidencePanelProps = {
  hurting: StrategistBriefing["hurting"];
  evidence: EvidenceItem[];
  confidenceLevel: string;
  onNavigate: (view: DashboardView) => void;
};

export function WatchEvidencePanel({ hurting, evidence, confidenceLevel, onNavigate }: WatchEvidencePanelProps) {
  return (
    <GlassPanel accent={C.AMBER}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Eye size={14} style={{ color: C.AMBER }} aria-hidden="true" />
          <h2 className="font-mono text-[8.5px] uppercase tracking-[0.24em]" style={{ color: `${C.AMBER}dd` }}>
            Watch List
          </h2>
        </div>
        <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/55">{confidenceLevel} confidence</span>
      </div>

      {hurting.length ? (
        <ul className="divide-y divide-white/[0.06]">
          {hurting.map((s) => {
            const sev = s.severity === "high" ? C.RED : s.severity === "moderate" ? C.AMBER : C.SLATE;
            const view = sourceToView(s.source);
            return (
              <li key={s.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12.5px] font-bold text-white/85">{s.title}</p>
                  <span
                    className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em]"
                    style={{ borderColor: `${sev}40`, color: sev }}
                  >
                    {s.severity ?? "low"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-[1.5] text-white/60">{s.detail}</p>
                {view && (
                  <button
                    type="button"
                    onClick={() => onNavigate(view)}
                    className="-mb-2 inline-flex min-h-[44px] items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white/65 transition hover:text-white/90"
                  >
                    Open {s.source}
                    <ArrowRight size={9} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-2 text-[11.5px] leading-[1.5] text-white/60">
          All systems aligned on logged data. Keep executing the plan — the watchlist updates as signals change.
        </p>
      )}

      {/* Evidence Watch — missing / stale data the member can fix right now */}
      {evidence.length > 0 && (
        <div className="mt-2 border-t border-white/[0.08] pt-3">
          <h3 className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-white/55">Evidence Needed</h3>
          <ul className="mt-1 divide-y divide-white/[0.05]">
            {evidence.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(e.target)}
                  className="group flex min-h-[44px] w-full items-start gap-2.5 rounded-[10px] py-2.5 text-left transition-colors hover:bg-white/[0.025]"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: e.severity === "missing" ? C.AMBER : C.SLATE }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold text-white/80">{e.label}</span>
                    <span className="block text-[10px] leading-[1.45] text-white/60">{e.detail}</span>
                  </span>
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 font-mono text-[7.5px] uppercase tracking-[0.12em] text-white/55 transition group-hover:text-white/85">
                    {e.actionLabel}
                    <ArrowRight size={8} aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassPanel>
  );
}
