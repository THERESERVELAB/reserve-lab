"use client";

import { Play } from "lucide-react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { RESERVE, alpha } from "@/lib/design/tokens";
import type { HeroLead, ReadinessRead, SessionMetric } from "@/lib/training/training-room";

/* ════════════════════════════════════════════════════════════════════════
   TRAINING ROOM HERO — the first screen of Training (Bible §11 layers 1–3).

   Statement (today's session) → where it came from → the two honest
   reads → the one gold action. Once a session starts, the first read is
   the session clock (elapsed, then duration) instead of readiness. No intent sentence: Today's session below
   names what gets trained. It replaces a
   hero that ran two decorative loops and printed "84%" and "72%" for every
   member. Readiness comes from the member's recovery logs; the session read
   is the plan's own estimate or the sets actually logged. With no evidence
   it says so and offers the logging action.

   The light is painted, not animated: nothing here moves, in any state,
   so the live cockpit below it stays still.

   Desktop: statement left; reads and the action right, in that order.
   Phone:   one column, action last and full width, inside the first screen.
   ════════════════════════════════════════════════════════════════════════ */

export type TrainingRoomAction = { label: string; onClick: () => void };

export function TrainingRoomHero({
  whisper,
  statement,
  accent,
  source,
  readiness,
  lead = null,
  onLogCheckIn,
  metric,
  metricEmpty,
  primary,
  sheen,
}: {
  whisper: string;
  statement: string;
  accent: string | null;
  /** One honest line: what actually generated today's session (`programSourceLine`). */
  source: string;
  readiness: ReadinessRead | null;
  /** Once a session has started, the clock replaces readiness as the first read (`sessionClockLead`). */
  lead?: HeroLead | null;
  onLogCheckIn: () => void;
  metric: SessionMetric | null;
  /** What the session read says when there is nothing real to show. */
  metricEmpty: string;
  /** The screen's single gold action, or none. */
  primary: TrainingRoomAction | null;
  /** The scarce CTA light pass. Off while motion is paused or reduced. */
  sheen: boolean;
}) {
  return (
    /* Phones: a flush section inside the page gutter, not a card (components.md rule 1). */
    <GlassPanel accent={RESERVE.gold} noPad phone="flush" className="md:overflow-hidden">
      <section aria-label="Today's session" data-training="hero" className="relative pb-5 pt-4 md:p-6 lg:px-8 lg:py-7">
        <div
          aria-hidden="true"
          /* On phones the light reaches the screen edge and feathers out downward, never cut by a box. */
          className="pointer-events-none absolute -inset-x-3 inset-y-0 max-md:[mask-image:linear-gradient(180deg,#000_55%,transparent)] md:inset-x-0"
          style={{ background: `radial-gradient(120% 90% at 0% 0%, ${alpha(RESERVE.gold, 0.1)}, transparent 55%)` }}
        />

        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-end lg:gap-12">
          <div className="min-w-0">
            <p className="truncate font-mono text-[9px] uppercase tracking-[0.24em] text-white/60">{whisper}</p>
            <h2 data-room-statement className="mt-2.5 font-display text-[26px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#f2eee6] [hyphens:none] sm:text-[34px] lg:text-[42px]">
              {statement}
              {accent && (
                <span className="block" style={{ color: RESERVE.gold }}>
                  {accent}
                </span>
              )}
            </h2>
            {/* The room video shows through the glass, so the smallest line on
                the screen carries more weight than a caption on flat dark. */}
            <p data-training="program-source" className="mt-3 max-w-[58ch] font-mono text-[9px] uppercase leading-[1.7] tracking-[0.18em] text-white/70">
              {source}
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <dl className="grid grid-cols-2 gap-4">
              {lead ? (
                <div data-training="session-clock" className="min-w-0">
                  <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/60">
                    {lead.label}{lead.provenance && <span className="text-white/40"> · {lead.provenance}</span>}
                  </dt>
                  <dd className="mt-1.5">
                    <span className="tnum block font-display text-[34px] font-black leading-none text-[#f2eee6]">{lead.value}</span>
                    <span className="mt-1 block truncate text-[11.5px] text-white/65">{lead.detail}</span>
                  </dd>
                </div>
              ) : (
              <div data-training="readiness" className="min-w-0">
                <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/60">
                  Readiness
                  {/* Nothing is derived until something is logged, so the
                      provenance only appears with a reading behind it. */}
                  {readiness && <span className="text-white/40"> · derived</span>}
                </dt>
                <dd className="mt-1.5">
                  {readiness ? (
                    <>
                      <span className="tnum block font-display text-[34px] font-black leading-none text-[#f2eee6]">{readiness.value}</span>
                      <span className="mt-1 block truncate text-[11.5px] text-white/65">{readiness.label}</span>
                    </>
                  ) : (
                    <>
                      <span className="block text-[12.5px] leading-[1.4] text-white/70">Evidence needed</span>
                      <span className="mt-1 block">
                        <ReserveButton tier="secondary" size="sm" onClick={onLogCheckIn}>
                          Log Check-in
                        </ReserveButton>
                      </span>
                    </>
                  )}
                </dd>
              </div>
              )}

              <div data-training="session-metric" className="min-w-0">
                <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/60">
                  {metric?.label ?? "Session"}{metric?.provenance && <span className="text-white/40"> · {metric.provenance}</span>}
                </dt>
                <dd className="mt-1.5">
                  {metric ? (
                    <>
                      <span className="tnum block truncate font-display text-[34px] font-black leading-none text-[#f2eee6]">{metric.value}</span>
                      <span className="mt-1 block truncate text-[11.5px] text-white/65">{metric.detail}</span>
                    </>
                  ) : (
                    <span className="block text-[12.5px] leading-[1.4] text-white/70">{metricEmpty}</span>
                  )}
                </dd>
              </div>
            </dl>

            {primary && (
              <div data-training="primary-action">
                <ReserveButton tier="primary" size="lg" fullWidth icon={Play} sheen={sheen} onClick={primary.onClick}>
                  {primary.label}
                </ReserveButton>
              </div>
            )}
          </div>
        </div>
      </section>
    </GlassPanel>
  );
}
