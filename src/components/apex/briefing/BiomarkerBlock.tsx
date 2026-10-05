"use client";

import { ArrowRight, FlaskConical } from "lucide-react";

import type { DashboardView } from "@/lib/athlete-store";
import type { BiomarkerCommand } from "@/lib/apex/command-intelligence";
import { GlassPanel } from "@/components/ui/GlassPanel";

import { C, TrendGlyph } from "./shared";

/* ════════════════════════════════════════════════════════════════════════
   BIOMARKER COMMAND — member-entered labs · log-only · clinician-review
   framing. Moved out of ApexCommandV2 with its markup and every string
   unchanged: these lines sit behind the clinical wall (clinical-data.md) and
   are never reworded in passing.
   ════════════════════════════════════════════════════════════════════════ */

export type BiomarkerBlockProps = {
  biomarkers: BiomarkerCommand;
  onNavigate: (view: DashboardView) => void;
};

export function BiomarkerBlock({ biomarkers, onNavigate }: BiomarkerBlockProps) {
  return (
    <GlassPanel accent={C.STEEL} noPad className="overflow-hidden">
      <div className="relative p-5 sm:p-6">
        <div className="fba-breath-slow pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl" style={{ background: `${C.STEEL}14` }} />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <FlaskConical size={14} style={{ color: C.STEEL }} />
            <h3 className="font-mono text-[8.5px] uppercase tracking-[0.24em]" style={{ color: `${C.STEEL}cc` }}>Biomarker Command</h3>
            <span className="rounded-full border px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em]" style={{ borderColor: `${C.STEEL}40`, color: C.STEEL }}>Longevity Signal · {biomarkers.internalStatus}</span>
            <span className="rounded-full border border-white/[0.08] px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em] text-white/35">Log-Only</span>
            <span className="ml-auto font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/35">{biomarkers.nextReviewLabel}</span>
          </div>

          {biomarkers.hasData ? (
            <>
              <p className="mt-2 text-[11px] leading-[1.5] text-white/45">
                {biomarkers.markerCount} marker{biomarkers.markerCount === 1 ? "" : "s"} logged across {biomarkers.coveredCategories} of {biomarkers.categories.length} panels · {biomarkers.recordCount} lab record{biomarkers.recordCount === 1 ? "" : "s"} · values shown exactly as you entered them.
              </p>
              {/* Each panel on a left rule — steel when covered — not a tinted tile inside the Biomarker panel. */}
              <div className="mt-3.5 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {biomarkers.categories.map((cat) => (
                  <div key={cat.key} className="border-l pl-3" style={{ borderColor: cat.covered ? `${C.STEEL}55` : "rgba(255,255,255,0.08)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold text-[#f2eee6]">{cat.label}</p>
                      <span className="shrink-0 font-mono text-[6.5px] uppercase tracking-[0.12em]" style={{ color: cat.covered ? `${C.STEEL}cc` : "rgba(255,255,255,0.3)" }}>
                        {cat.covered ? `${cat.markers.length} logged` : "No data"}
                      </span>
                    </div>
                    {cat.covered ? (
                      <div className="mt-1.5 space-y-1">
                        {cat.markers.slice(0, 3).map((m) => (
                          <div key={m.name} className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-[10px] text-white/60">{m.name}{m.flaggedByMember ? <span style={{ color: C.AMBER }}> · flagged</span> : null}</span>
                            <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums" style={{ color: C.STEEL }}>{m.latestValue}</span>
                            <TrendGlyph trend={m.trend} />
                          </div>
                        ))}
                        {cat.markers.length > 3 && <p className="font-mono text-[6.5px] uppercase tracking-[0.12em] text-white/25">+{cat.markers.length - 3} more in the cockpit</p>}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[9.5px] leading-[1.5] text-white/35">Evidence missing — worth adding at your next draw.</p>
                    )}
                    <p className="mt-1.5 text-[8.5px] leading-[1.5] text-white/30">{cat.relatesTo}</p>
                  </div>
                ))}
              </div>
              {biomarkers.priorities.length > 0 && (
                <div className="mt-3.5">
                  <p className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/35">Top Review Priorities</p>
                  <div className="mt-1.5 grid gap-x-5 gap-y-2.5 sm:grid-cols-3">
                    {biomarkers.priorities.map((p) => (
                      <div key={`${p.kind}-${p.label}`} className="border-l border-white/[0.08] pl-2.5">
                        <p className="text-[10.5px] font-bold capitalize text-[#f2eee6]">{p.label}</p>
                        <p className="mt-0.5 text-[9px] leading-[1.45] text-white/45">{p.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Premium empty state — no labs logged */
            /* Untinted: it sits inside the Biomarker panel, so it groups by spacing, not a box (no card in a card). */
            <div className="mt-3.5 text-center">
              <div className="px-6 py-7">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl" style={{ borderColor: `${C.STEEL}33`, background: `${C.STEEL}10`, color: C.STEEL }}>
                  <FlaskConical size={20} />
                </span>
                <h3 className="mt-3.5 text-[14px] font-black uppercase tracking-tight text-[#f2eee6]">Your internal baseline is missing</h3>
                <p className="mx-auto mt-1.5 max-w-sm text-[11px] leading-[1.6] text-white/45">Upload labs to keep a log-only record for clinician review — stored as you enter it.</p>
              </div>
            </div>
          )}

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onNavigate("biomarker-intelligence")} className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition hover:bg-white/[0.03]" style={{ borderColor: `${C.STEEL}40`, background: `${C.STEEL}10`, color: C.STEEL }}>Open Biomarker Cockpit<ArrowRight size={12} /></button>
            <button type="button" onClick={() => onNavigate("bloodwork")} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/55 transition hover:bg-white/[0.03] hover:text-white/80">Upload Labs<ArrowRight size={12} /></button>
          </div>
          <p className="mt-3 font-mono text-[7px] uppercase leading-[1.6] tracking-[0.12em] text-white/25">
            Log-only · member-entered values · no reference ranges, diagnoses, or interpretation. Review every panel with a medical professional.
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}
