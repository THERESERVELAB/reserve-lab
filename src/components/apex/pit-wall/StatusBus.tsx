"use client";

import { ReserveLiveNumber } from "@/components/ui/reserve/ReserveLiveNumber";
import { RESERVE } from "@/lib/design/tokens";

export type StatusReadout = {
  label: string;
  /** Null renders "—": there is no evidence yet, and the screen never guesses. */
  value: string | null;
  /** The same value as a number, so it counts to a new value after a log. */
  numeric?: { value: number; decimals?: number };
  unit?: string;
  /** Provenance — what the number is built from, or what evidence is missing. */
  title: string;
  /** Show in the top bar only on wide screens, where it fits without truncating. */
  wideOnly?: boolean;
};

/** A readout's value: counts to its new number after a log when it has one. */
function ReadoutValue({ readout }: { readout: StatusReadout }) {
  if (readout.value === null) return <>—</>;
  if (readout.numeric) return <ReserveLiveNumber value={readout.numeric.value} decimals={readout.numeric.decimals} />;
  return <>{readout.value}</>;
}

/* ════════════════════════════════════════════════════════════════════════
   STATUS BUS — the top bar as an instrument cluster.

   Readouts are read left to right and separated by light rather than boxes.
   A readout never truncates: when the bar is too narrow, a readout is left
   out rather than cut. Below `lg` the bar has no room at all; there, the
   instrument's system row (today's scores) carries the same states.

   Readiness, sleep and protein are deliberately absent here: their home is
   today's scores in the condition column.
   ════════════════════════════════════════════════════════════════════════ */

export function StatusBus({ readouts }: { readouts: StatusReadout[] }) {
  return (
    <dl className="hidden items-center lg:flex" aria-label="Today's status">
      {readouts.map((r) => (
        <div
          key={r.label}
          title={r.title}
          className={`${r.wideOnly ? "hidden min-[1360px]:flex" : "flex"} shrink-0 flex-col-reverse border-l border-white/[0.07] pl-4 ml-4 first:ml-0 first:border-l-0 first:pl-0 xl:ml-6 xl:pl-6`}
        >
          <dt className="mt-1 whitespace-nowrap font-mono text-[7.5px] uppercase tracking-[0.22em] text-white/40">{r.label}</dt>
          <dd
            className="tnum whitespace-nowrap font-display text-[15px] font-extrabold leading-none tracking-[-0.01em]"
            style={{ color: r.value === null ? "rgba(255,255,255,0.38)" : RESERVE.ivory }}
          >
            <ReadoutValue readout={r} />
            {r.value !== null && r.unit ? (
              <span className="ml-1 text-[10.5px] font-semibold text-white/40">{r.unit}</span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
