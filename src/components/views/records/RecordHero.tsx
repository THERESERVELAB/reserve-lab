"use client";

import React from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { RESERVE, alpha } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   RECORD HERO — the first screen of a record or evidence surface.

   The same shape the shipped rooms use (NutritionRoomHero), reduced to what
   a log needs:

     STATEMENT   what the member's own record says right now, or what is
                 missing. Never a number nobody logged.
     READS       two or three real values, or "Evidence needed".
     ONE ACTION  a single gold primary. Everything else steps down
                 (Bible §11 · constitution components.md rule 6).

   It is local to this folder rather than in `components/ui` because the
   shared primitives are frozen during the redesign waves. If several waves
   end up wanting it, it is the obvious candidate to promote.
   ════════════════════════════════════════════════════════════════════════ */

export type HeroRead = {
  label: string;
  /** Null renders the evidence-needed line — never a zero standing in for a value. */
  value: string | null;
  unit?: string;
  detail?: string;
  /** Bible §12: a derived or estimated number says so. Member-entered needs no qualifier. */
  provenance?: "logged" | "derived" | "est.";
  /** What the member does when there is no value. */
  empty?: string;
};

export type HeroAction = {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  iconAfter?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
};

export function RecordHero({
  testId,
  accent = RESERVE.gold,
  eyebrow,
  statement,
  support,
  reads,
  action,
  secondary,
  tertiary,
  below,
}: {
  /** Becomes `data-record`, so a spec can name this screen's hero and action. */
  testId: string;
  accent?: string;
  /** Category or status. Two or three words. */
  eyebrow: string;
  /** The one plain-language line the screen is designed around. */
  statement: string;
  /** One line under the statement. Why this screen, from the member's side. */
  support?: string;
  reads: HeroRead[];
  /** THE single gold action. One node — the type is the rule. */
  action: HeroAction;
  /** A real alternative, rendered outlined. */
  secondary?: HeroAction;
  /** Reversible or navigational. Rendered as text. */
  tertiary?: HeroAction;
  /** Full-width content under the statement and action, inside the same hero (no second surface). */
  below?: React.ReactNode;
}) {
  return (
    /* Phones: a flush section inside the page gutter, not a card on a page
       (components.md rule 1 — at most two surface levels). */
    <GlassPanel accent={accent} noPad phone="flush" className="md:overflow-hidden">
      <section aria-label={eyebrow} data-record={testId} className="relative pb-5 pt-4 md:p-6 lg:px-8 lg:py-6">
        {/* The light is painted, not animated, and it feathers past the content
            on phones rather than being clipped by a box (components.md rule 3). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-3 inset-y-0 max-md:[mask-image:linear-gradient(180deg,#000_55%,transparent)] md:inset-x-0"
          style={{
            background: `radial-gradient(110% 90% at 0% 0%, ${alpha(accent, 0.08)}, transparent 55%)`,
          }}
        />

        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:items-end lg:gap-12">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">{eyebrow}</p>
            <p
              data-record-statement
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

            <div className="flex flex-wrap items-center gap-2.5">
              {/* The screen's one gold action. */}
              <div data-record-action className="min-w-0 max-sm:w-full">
                <ReserveButton
                  tier="primary"
                  size="md"
                  fullWidth
                  icon={action.icon}
                  iconAfter={action.iconAfter}
                  onClick={action.onClick}
                >
                  {action.label}
                </ReserveButton>
              </div>
              {secondary && (
                /* Never gold, whatever the room's accent is. A gold outline
                   beside a gold fill is two primaries, and the one action
                   stops being unmistakable (Bible §11). Slate is the
                   palette's neutral supporting signal. */
                <ReserveButton tier="secondary" size="md" accent={RESERVE.slate} icon={secondary.icon} onClick={secondary.onClick}>
                  {secondary.label}
                </ReserveButton>
              )}
              {tertiary && (
                <ReserveButton tier="quiet" size="md" icon={tertiary.icon} onClick={tertiary.onClick}>
                  {tertiary.label}
                </ReserveButton>
              )}
            </div>
          </div>
        </div>
        {below}
      </section>
    </GlassPanel>
  );
}

function Read({ read }: { read: HeroRead }) {
  const missing = read.value === null;
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/60">
        {read.label}
        {read.provenance && read.provenance !== "logged" && !missing && (
          <span className="text-white/45"> · {read.provenance}</span>
        )}
      </dt>
      <dd className="mt-1.5">
        {missing ? (
          <span className="block text-[12.5px] leading-[1.4] text-white/70">{read.empty ?? "Evidence needed"}</span>
        ) : (
          <>
            <span className="tnum block font-display text-[26px] font-black leading-none text-[#f2eee6] sm:text-[30px]">
              {read.value}
              {read.unit && (
                <span className="ml-1 font-sans text-[12px] font-semibold tracking-normal text-white/55">{read.unit}</span>
              )}
            </span>
            {read.detail && <span className="mt-1 block text-[11.5px] leading-snug text-white/65">{read.detail}</span>}
          </>
        )}
      </dd>
    </div>
  );
}
