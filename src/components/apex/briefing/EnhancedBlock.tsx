"use client";

import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";

import type { DashboardView } from "@/lib/athlete-store";
import type { BiomarkerCommand, EnhancedCommand } from "@/lib/apex/command-intelligence";
import type { EnhancementDailySummary } from "@/lib/enhancement/schedule";
import { GlassPanel } from "@/components/ui/GlassPanel";

import { C, LuxTile, TrendGlyph } from "./shared";

/* ════════════════════════════════════════════════════════════════════════
   ENHANCED MEMBER COMMAND — private, log-only, clinician-review framing.
   Moved out of ApexCommandV2 with its markup and every compliance line
   unchanged (clinical-data.md).

   One behaviour change: Configure is honest about access. It used to switch
   `enhancedLogOnly` on for every member, including members whose tier
   cannot open Compound Command — enabling tracking they could not reach.
   It now enables only when the destination opens; otherwise it names the
   tier and navigates, and the router shows that view's locked state. The
   two Open buttons follow the same rule: a member who turned tracking on and
   later lost access sees the tier named, not an unmarked link to a lock.
   ════════════════════════════════════════════════════════════════════════ */

export type EnhancedBlockProps = {
  enhanced: EnhancedCommand;
  enhancedLogOnly: boolean;
  intakeSummary: EnhancementDailySummary;
  biomarkers: BiomarkerCommand;
  onNavigate: (view: DashboardView) => void;
  /** Turns enhanced log-only tracking on. Called only when `canAccessEnhanced`. */
  onEnableEnhanced: () => void;
  /** `canAccessView(tier, "supplements")` — whether Configure's destination opens for this member. */
  canAccessEnhanced: boolean;
  /** `canAccessView(tier, "enhanced-monitor")` — whether Open Enhanced Monitor's destination opens. */
  canAccessMonitor: boolean;
};

export function EnhancedBlock({ enhanced, enhancedLogOnly, intakeSummary, biomarkers, onNavigate, onEnableEnhanced, canAccessEnhanced, canAccessMonitor }: EnhancedBlockProps) {
  const [enhancedSetupHidden, setEnhancedSetupHidden] = useState(false);

  return enhancedLogOnly ? (
    <GlassPanel accent={C.VIOLET} noPad className="overflow-hidden">
      <div className="relative p-5 sm:p-6">
        <div className="fba-breath-slow pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full blur-3xl" style={{ background: `${C.VIOLET}14` }} />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Lock size={13} style={{ color: C.VIOLET }} />
            <h3 className="font-mono text-[8.5px] uppercase tracking-[0.24em]" style={{ color: `${C.VIOLET}dd` }}>Enhanced Member Command</h3>
            <span className="rounded-full border px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em]" style={{ borderColor: `${C.VIOLET}40`, color: C.VIOLET }}>{enhanced.modeLabel}</span>
            <span className="rounded-full border border-white/[0.08] px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em] text-white/35">Private Log</span>
          </div>
          <div className="mt-3.5 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
            {/* Status tiles */}
            <div className="grid grid-cols-2 gap-2">
              <LuxTile label="Active Items" value={enhanced.activeCount > 0 ? `${enhanced.activeCount} · ${enhanced.categories.slice(0, 2).join(" / ") || "logged"}` : "None logged"} color={C.IVORY} dot={C.VIOLET} />
              <LuxTile label="Logged Adherence · 7d" value={enhanced.adherence7d.pct !== null ? `${enhanced.adherence7d.pct}% (${enhanced.adherence7d.taken}/${enhanced.adherence7d.total})` : "No logs yet"} color={C.IVORY} dot={C.GREEN} />
              <LuxTile label="Next Logged Item" value={intakeSummary.nextSlot ? `${intakeSummary.nextSlot.entry.displayName ?? intakeSummary.nextSlot.entry.name} · ${intakeSummary.nextSlot.plannedTimeLabel}` : "Nothing pending"} color={C.IVORY} dot={C.GOLD} />
              <LuxTile label="Last Completed" value={enhanced.lastCompleted ? `${enhanced.lastCompleted.name} · ${enhanced.lastCompleted.date.slice(5)}` : "—"} color={C.IVORY} dot={C.STEEL} />
              <LuxTile label="Missed · 7d" value={enhanced.missedRecent > 0 ? `${enhanced.missedRecent} missed` : "0 missed"} color={enhanced.missedRecent > 0 ? C.AMBER : C.IVORY} dot={enhanced.missedRecent > 0 ? C.RED : C.GREEN} />
              <LuxTile label="Bloodwork" value={biomarkers.nextReviewDueDays !== null ? biomarkers.nextReviewLabel.replace("Next lab review ", "").replace("Lab review ", "") : biomarkers.recordCount === 0 ? "Baseline needed" : "Cadence not set"} color={C.IVORY} dot={C.STEEL} />
              {enhanced.injectionLogCount > 0 && (
                <LuxTile label="Site Log" value={`${enhanced.injectionLogCount} entries${enhanced.lastInjectionSite ? ` · last ${enhanced.lastInjectionSite}` : ""}`} color={C.IVORY} dot={C.VIOLET} />
              )}
              <LuxTile label="Wellness Check" value={enhanced.sideEffectDue ? "Check-in due" : "Current"} color={enhanced.sideEffectDue ? C.AMBER : C.IVORY} dot={enhanced.sideEffectDue ? C.AMBER : C.GREEN} />
            </div>
            {/* Mode-specific intelligence */}
            <div className="border-l border-white/[0.08] pl-3">
              {enhanced.mode === "advanced" ? (
                <>
                  <p className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/35">Bloodwork Watchlist · from your logged values</p>
                  <div className="mt-1.5 space-y-1.5">
                    {enhanced.watchlist.map((w) => (
                      <div key={w.label} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: w.hasData ? C.STEEL : "rgba(255,255,255,0.18)" }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10.5px] font-bold text-[#f2eee6]">{w.label}</p>
                          <p className="text-[9px] leading-[1.45] text-white/45">{w.status}</p>
                        </div>
                        <TrendGlyph trend={w.trend} />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/35">Foundation Protocol Support</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {[
                      biomarkers.recordCount === 0 ? "Baseline labs needed before trend confidence — upload your first panel." : "Baseline labs on file — keep the review cadence with your clinician.",
                      "Review your protocol with your clinician — Reserve organizes the log, it never prescribes.",
                      "Track blood pressure, sleep, mood, and hydration alongside every logged item.",
                      "Do not change anything without medical supervision.",
                      enhanced.sideEffectDue ? "Side-effect check-in due — log how you feel with today's entries." : "Side-effect check-ins are current.",
                      "Meals and sleep stay on the board alongside your logged protocol.",
                    ].map((line) => (
                      <li key={line} className="flex items-start gap-2 text-[10px] leading-[1.5] text-white/55">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: C.VIOLET }} />{line}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
          {enhanced.clinicianFlags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {enhanced.clinicianFlags.map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[9px]" style={{ borderColor: `${C.AMBER}35`, color: `${C.AMBER}dd` }}>
                  <ShieldCheck size={9} />{f}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onNavigate("supplements")} className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition hover:bg-white/[0.03]" style={{ borderColor: `${C.VIOLET}40`, background: `${C.VIOLET}10`, color: C.VIOLET }}>{canAccessEnhanced ? "Open Enhanced Command" : "Open Enhanced Command · Reserve Black"}<ArrowRight size={12} /></button>
            <button type="button" onClick={() => onNavigate("enhanced-monitor")} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/55 transition hover:bg-white/[0.03] hover:text-white/80">{canAccessMonitor ? "Open Enhanced Monitor" : "Open Enhanced Monitor · Reserve Black"}<ArrowRight size={12} /></button>
          </div>
          <p className="mt-3 text-[9px] leading-[1.55]" style={{ color: `${C.RED}cc` }}>
            Chest discomfort, shortness of breath, fainting, or severe symptoms should be reviewed urgently by a medical professional.
          </p>
          <p className="mt-1.5 font-mono text-[7px] uppercase leading-[1.6] tracking-[0.12em] text-white/25">
            Private log · user-entered · clinician-review safe. Reserve does not prescribe or recommend compounds, amounts, or protocols. Do not adjust without medical supervision. You control what is tracked.
          </p>
        </div>
      </div>
    </GlassPanel>
  ) : !enhancedSetupHidden ? (
    /* Optional setup state — clean, private, no pressure */
    <GlassPanel accent={C.SLATE} noPad className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3.5 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ borderColor: `${C.SLATE}30`, background: `${C.SLATE}10` }}>
          <Lock size={16} style={{ color: C.SLATE }} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/40">Enhanced Tracking · Optional</h3>
          <p className="mt-0.5 text-[12px] font-bold text-[#f2eee6]">Enhanced tracking is private and optional.</p>
          <p className="mt-0.5 text-[10.5px] leading-[1.5] text-white/45">Members using physician-supervised advanced protocols can track logs, labs, wellness check-ins, and clinician-review reminders. Reserve never recommends compounds.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (canAccessEnhanced) onEnableEnhanced();
              onNavigate("supplements");
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition hover:bg-white/[0.04]"
            style={{ borderColor: `${C.VIOLET}45`, color: C.VIOLET }}
          >
            {canAccessEnhanced ? "Configure Enhanced Tracking" : "Configure Enhanced Tracking · Reserve Black"}
          </button>
          <button type="button" onClick={() => setEnhancedSetupHidden(true)} className="rounded-xl border border-white/[0.1] px-3 py-1.5 text-[11px] font-semibold text-white/45 transition hover:bg-white/[0.03] hover:text-white/70">Keep Hidden</button>
        </div>
      </div>
    </GlassPanel>
  ) : null;
}
