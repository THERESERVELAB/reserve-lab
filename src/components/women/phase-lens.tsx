"use client";

import React from "react";

import { CYCLE_PHASE_META, type PhaseGroup } from "@/lib/women/cycle";

/* ════════════════════════════════════════════════════════════════════════
   THE PHASE LENS — the one thing the women's duplicate rooms actually added.

   Reserve shipped four women's rooms — Training, Nutrition, Recovery and
   Physique — whose entire job was to re-list data the member had already
   logged somewhere else, sorted by her estimated cycle phase. A woman saw
   "Training Command" twice in her sidebar as a result.

   Estimated phase is a LENS, not a room. These three components are that
   lens, and they live here rather than in the women's room module so the core
   commands can render them without dragging the rooms' recovery engine,
   training-day hook and motion layer into their bundles. `views/women/ui.tsx`
   re-exports them, so there is still exactly one implementation.

   Presentation only. It sorts what she entered; it never interprets it, never
   links one thing to another, and never says a phase caused anything.
   ════════════════════════════════════════════════════════════════════════ */

export function WList({ children, className = "", label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <ul aria-label={label} className={`flex flex-col ${className}`}>
      {children}
    </ul>
  );
}

export function WRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <li className={`group ${className}`}>
      <span aria-hidden="true" className="block h-px bg-white/[0.06] group-first:hidden" />
      <div className="py-3 group-first:pt-0 group-last:pb-0">{children}</div>
    </li>
  );
}

/**
 * One row per estimated phase. A phase with too little evidence says so rather
 * than showing a number built from one entry.
 */
export function PhaseRows<T>({
  label,
  groups,
  need = 1,
  noun,
  read,
}: {
  label: string;
  groups: PhaseGroup<T>[];
  need?: number;
  noun: string;
  read: (items: T[]) => { primary: string; secondary?: string };
}) {
  return (
    <WList label={label}>
      {groups.map(({ phase, items }) => {
        const meta = CYCLE_PHASE_META[phase];
        const enough = items.length >= need;
        const facts = enough ? read(items) : null;
        return (
          <WRow key={phase}>
            <div className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 sm:grid-cols-[150px_minmax(0,1fr)]">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[#f2eee6]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
                {meta.label}
              </p>
              {facts ? (
                <div className="min-w-0">
                  <p className="tnum text-[13.5px] text-white/80">{facts.primary}</p>
                  {facts.secondary && <p className="tnum mt-0.5 text-[12px] leading-[1.5] text-white/50">{facts.secondary}</p>}
                </div>
              ) : (
                <p className="tnum text-[12.5px] text-white/50">
                  Evidence needed · {Math.min(items.length, need)} of {need} {noun}
                </p>
              )}
            </div>
          </WRow>
        );
      })}
    </WList>
  );
}
