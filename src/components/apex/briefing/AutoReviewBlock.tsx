"use client";

import { ArrowRight, Camera, FlaskConical, RefreshCw, Ruler } from "lucide-react";

import type { DashboardView } from "@/lib/athlete-store";
import type { BiomarkerCommand, MeasurementReview, PhotoReview } from "@/lib/apex/command-intelligence";
import { GlassPanel } from "@/components/ui/GlassPanel";

import { C } from "./shared";

/* ════════════════════════════════════════════════════════════════════════
   LOG SUMMARY — labs · measurements · progress photos, each read only from
   what the member logged. Moved out of ApexCommandV2; renamed from "Auto AI
   Review" and its empty lab line reworded so neither promises interpretation.
   The lab lines stay behind the clinical wall.
   ════════════════════════════════════════════════════════════════════════ */

export type AutoReviewBlockProps = {
  biomarkers: BiomarkerCommand;
  measurementReview: MeasurementReview;
  photoReview: PhotoReview;
  onNavigate: (view: DashboardView) => void;
};

export function AutoReviewBlock({ biomarkers, measurementReview, photoReview, onNavigate }: AutoReviewBlockProps) {
  return (
    <GlassPanel accent={C.VIOLET}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <RefreshCw size={14} style={{ color: C.VIOLET }} />
        <h3 className="font-mono text-[8.5px] uppercase tracking-[0.24em]" style={{ color: `${C.VIOLET}dd` }}>Log Summary</h3>
        <span className="rounded-full border border-white/[0.08] px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em] text-white/35">Updates as you log</span>
      </div>
      <p className="mb-3 text-[11px] leading-[1.5] text-white/40">Each review reads only what you&apos;ve logged — update labs, measurements, or photos anytime and the read refreshes.</p>
      {/* Three reviews on left rules in their own colour, not three tinted tiles inside the panel. */}
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        {/* Lab review */}
        <div className="flex flex-col border-l pl-3" style={{ borderColor: `${C.STEEL}40` }}>
          <div className="flex items-center gap-1.5"><FlaskConical size={11} style={{ color: C.STEEL }} /><p className="font-mono text-[7.5px] uppercase tracking-[0.18em]" style={{ color: `${C.STEEL}cc` }}>Lab Review</p></div>
          <p className="mt-1.5 text-[11px] font-bold text-[#f2eee6]">
            {biomarkers.recordCount > 0 ? `${biomarkers.recordCount} record${biomarkers.recordCount === 1 ? "" : "s"} · ${biomarkers.coveredCategories}/${biomarkers.categories.length} panels covered` : "Labs not logged yet"}
          </p>
          <p className="mt-1 flex-1 text-[9.5px] leading-[1.5] text-white/45">
            {biomarkers.recordCount > 0
              ? `${biomarkers.markerCount} markers on file · ${biomarkers.priorities.length ? `top priority: ${biomarkers.priorities[0].label}` : "no flagged priorities"} · ${biomarkers.nextReviewLabel.toLowerCase()}. Review trends with your clinician.`
              : "Upload your first panel to start a log-only record — categories and trends, organized for clinician review."}
          </p>
          <button type="button" onClick={() => onNavigate("biomarker-intelligence")} className="mt-2 inline-flex w-fit items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white/40 transition hover:text-white/70">Open Biomarker Cockpit<ArrowRight size={9} /></button>
        </div>
        {/* Measurement review */}
        <div className="flex flex-col border-l pl-3" style={{ borderColor: `${C.GOLD}40` }}>
          <div className="flex items-center gap-1.5"><Ruler size={11} style={{ color: C.GOLD }} /><p className="font-mono text-[7.5px] uppercase tracking-[0.18em]" style={{ color: `${C.GOLD}cc` }}>Measurement Review</p></div>
          <p className="mt-1.5 text-[11px] font-bold text-[#f2eee6]">
            {measurementReview.hasData ? measurementReview.nextDueLabel : "Baseline due now"}
          </p>
          {measurementReview.hasData && measurementReview.deltas.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {measurementReview.deltas.slice(0, 4).map((d) => (
                <span key={d.label} className="rounded border border-white/[0.07] px-1.5 py-0.5 font-mono text-[7.5px] tabular-nums text-white/55">
                  {d.label} {d.latest}{d.delta ? <span style={{ color: d.direction === "down" ? C.STEEL : d.direction === "up" ? C.GREEN : "rgba(255,255,255,0.35)" }}> {d.delta}</span> : null}
                </span>
              ))}
            </div>
          )}
          <p className="mt-1 flex-1 text-[9.5px] leading-[1.5] text-white/45">{measurementReview.trendNote}{measurementReview.missingSites.length > 0 && measurementReview.hasData ? ` More evidence needed: ${measurementReview.missingSites.slice(0, 3).join(", ").toLowerCase()}.` : ""}</p>
          <button type="button" onClick={() => onNavigate("measurements")} className="mt-2 inline-flex w-fit items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white/40 transition hover:text-white/70">Open Measurements<ArrowRight size={9} /></button>
        </div>
        {/* Photo review */}
        <div className="flex flex-col border-l pl-3" style={{ borderColor: `${C.VIOLET}40` }}>
          <div className="flex items-center gap-1.5"><Camera size={11} style={{ color: C.VIOLET }} /><p className="font-mono text-[7.5px] uppercase tracking-[0.18em]" style={{ color: `${C.VIOLET}cc` }}>Progress Photo Review</p></div>
          <p className="mt-1.5 text-[11px] font-bold text-[#f2eee6]">
            {photoReview.hasData ? `${photoReview.checkInCount} check-in${photoReview.checkInCount === 1 ? "" : "s"} · ${photoReview.nextDueLabel.toLowerCase()}` : "First check-in due now"}
          </p>
          <p className="mt-1 flex-1 text-[9.5px] leading-[1.5] text-white/45">{photoReview.notes.slice(0, 2).join(" ")}</p>
          <p className="mt-1 font-mono text-[6.5px] uppercase tracking-[0.12em] text-white/25">Coach-style observations only · no body-fat claims from photos</p>
          <button type="button" onClick={() => onNavigate("progress-photos")} className="mt-2 inline-flex w-fit items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white/40 transition hover:text-white/70">Open Progress Photos<ArrowRight size={9} /></button>
        </div>
      </div>
    </GlassPanel>
  );
}
