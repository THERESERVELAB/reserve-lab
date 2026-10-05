"use client";

import React from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import type { HeroAction, HeroRead } from "@/components/views/records/RecordHero";
import { RESERVE, alpha } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   UTILITY HERO — the first screen of Settings, My Coach, Community and
   Education.

   The same shape as the shipped RecordHero (statement, two or three real
   reads, one gold action), with one difference a utility screen needs: the
   gold action is OPTIONAL. Some utility screens are honestly read-only (no
   lessons exist, the community is not open, a coach has not answered yet).
   There a gold button would be a dead CTA, so the hero states why there is
   nothing to do instead of inventing something (CLAUDE.md: no dead CTAs).

   Local to this folder because the shared primitives are frozen during the
   redesign waves. RecordHero plus an optional action is the obvious
   consolidation.
   ════════════════════════════════════════════════════════════════════════ */

export function UtilityHero({
  testId,
  accent = RESERVE.gold,
  eyebrow,
  statement,
  support,
  reads,
  action,
  noAction,
  secondary,
}: {
  /** Becomes `data-utility`, so a spec can name this screen's hero. */
  testId: string;
  accent?: string;
  eyebrow: string;
  statement: string;
  support?: string;
  reads: HeroRead[];
  /** THE single gold action, when there is a real next thing to do. */
  action?: HeroAction | null;
  /** Why there is no action. Shown in the action's place. */
  noAction?: string;
  /** A real alternative, rendered outlined in the neutral signal. */
  secondary?: HeroAction;
}) {
  return (
    <GlassPanel accent={accent} noPad phone="flush" className="md:overflow-hidden">
      <section aria-label={eyebrow} data-utility={testId} className="relative pb-5 pt-4 md:p-6 lg:px-8 lg:py-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-3 inset-y-0 max-md:[mask-image:linear-gradient(180deg,#000_55%,transparent)] md:inset-x-0"
          style={{ background: `radial-gradient(110% 90% at 0% 0%, ${alpha(accent, 0.08)}, transparent 55%)` }}
        />

        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:items-end lg:gap-12">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">{eyebrow}</p>
            <p
              data-utility-statement
              className="mt-2.5 font-display text-[26px] font-black uppercase leading-[0.98] tracking-[-0.02em] text-[#f2eee6] [hyphens:none] sm:text-[32px] lg:text-[38px]"
            >
              {statement}
            </p>
            {support && <p className="mt-3 max-w-[58ch] text-[13px] leading-[1.55] text-white/70">{support}</p>}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {reads.length > 0 && (
              <dl className={`grid gap-4 ${reads.length >= 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
                {reads.map((read) => (
                  <Read key={read.label} read={read} />
                ))}
              </dl>
            )}

            {(action || secondary || noAction) && (
              <div className="flex flex-wrap items-center gap-2.5">
                {action && (
                  <div data-utility-action className="min-w-0 max-sm:w-full">
                    <ReserveButton tier="primary" size="md" fullWidth icon={action.icon} iconAfter={action.iconAfter} onClick={action.onClick}>
                      {action.label}
                    </ReserveButton>
                  </div>
                )}
                {secondary && (
                  <ReserveButton tier="secondary" size="md" accent={RESERVE.slate} icon={secondary.icon} onClick={secondary.onClick}>
                    {secondary.label}
                  </ReserveButton>
                )}
                {!action && noAction && (
                  <p data-utility-no-action className="max-w-[46ch] text-[12.5px] leading-[1.5] text-white/60">
                    {noAction}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </GlassPanel>
  );
}

function Read({ read }: { read: HeroRead }) {
  const missing = read.value === null;
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/60">{read.label}</dt>
      <dd className="mt-1.5">
        {missing ? (
          <span className="block text-[12.5px] leading-[1.4] text-white/70">{read.empty ?? "Evidence needed"}</span>
        ) : (
          <>
            <span className="tnum block font-display text-[22px] font-black leading-tight text-[#f2eee6] sm:text-[26px]">
              {read.value}
              {read.unit && <span className="ml-1 font-sans text-[12px] font-semibold tracking-normal text-white/55">{read.unit}</span>}
            </span>
            {read.detail && <span className="mt-1 block text-[11.5px] leading-snug text-white/65">{read.detail}</span>}
          </>
        )}
      </dd>
    </div>
  );
}

/** Scrolls a section into view and moves focus to its first control, or to a named control. */
export function focusSection(id: string, selector?: string): boolean {
  if (typeof document === "undefined") return false;
  const host = document.getElementById(id);
  if (!host) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  host.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  const control =
    (selector ? host.querySelector<HTMLElement>(selector) : null) ??
    host.querySelector<HTMLElement>("input, button, select, textarea, a[href]");
  (control ?? host).focus({ preventScroll: true });
  return true;
}
