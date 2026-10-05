"use client";

import type { ReactNode } from "react";

import { RESERVE, alpha } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   CONDITION COLUMN — what state the member is in.

   Whisper → statement → command, then today's scores: the instrument that
   replaced the lone readiness jewel and the sleep bar strip (both now live
   inside their dials' sheets, with projected session quality and the sleep
   trend). Then the member's main compounds (when they logged any), the
   split and the day's line.

   Phone:   statement, then the instrument, full width.
   Tablet:  statement left, instrument right.
   Desktop: a single column beside the day.
   ════════════════════════════════════════════════════════════════════════ */

export function ConditionColumn({
  greeting,
  statement,
  splitName,
  splitLine,
  instrument,
  compounds,
  line,
}: {
  greeting: string;
  statement: { hero: string; command: string };
  splitName: string | null;
  splitLine: string | null;
  /** Today's scores. */
  instrument: ReactNode;
  /** The member's main compounds, directly under the scores. Renders nothing when none are logged. */
  compounds?: ReactNode;
  /** The day's line. */
  line: ReactNode;
}) {
  return (
    <section
      aria-label="Condition"
      className="flex min-w-0 flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_minmax(300px,auto)] md:items-end md:gap-10 xl:flex xl:flex-col xl:items-stretch xl:gap-0"
    >
      {/* Statement */}
      <div className="min-w-0">
        <p className="font-mono text-[8px] uppercase tracking-[0.3em]" style={{ color: alpha(RESERVE.gold, 0.8) }}>
          Private performance briefing
        </p>
        <p className="mt-1.5 truncate font-mono text-[8.5px] uppercase tracking-[0.24em] text-white/45">{greeting}</p>
        {/* In the 320px desktop column the statement steps down so its longest
            word ("DISCIPLINE") never crosses into the day. `!` is required:
            `.type-hero` is unlayered CSS and outranks a layered utility. */}
        {/* fba-so-*: the systems-online settle (globals.css). The statement is
            the likely LCP, so it only lifts; it is never hidden at load. */}
        <h1 data-room-statement className="fba-so-statement type-hero mt-3 text-[#f2eee6] [hyphens:none] xl:text-[clamp(34px,4vw,56px)]!">{statement.hero}</h1>
        <p className="fba-so-statement type-command mt-3 max-w-[46ch]">{statement.command}</p>
        {splitName && (
          <p className="mt-3 truncate font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/60 xl:hidden">
            {splitName}
            {splitLine ? ` · ${splitLine}` : ""}
          </p>
        )}
      </div>

      {/* Today's scores — then, on desktop, the split and the day's line. */}
      <div className={`fba-so-metric flex min-w-0 flex-col ${compounds ? "gap-4 md:gap-6" : "gap-6"} xl:mt-7 xl:border-t xl:border-white/[0.06] xl:pt-6`}>
        {instrument}
        {compounds}
        {splitName && (
          <div className="hidden xl:block">
            <p className="font-display text-[15px] font-extrabold leading-tight tracking-[-0.01em] text-[#f2eee6]">{splitName}</p>
            {splitLine && <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">{splitLine}</p>}
          </div>
        )}
        {line}
      </div>
    </section>
  );
}
