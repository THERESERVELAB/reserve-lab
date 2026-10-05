"use client";

import React from "react";

import { RESERVE, alpha } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   RECORD ROWS — a dated list that is not a wall of cards.

   Every record screen in this wave used to render its history as bordered,
   rounded tiles inside an already-bordered panel: a card inside a card at
   every width (constitution components.md rule 1, the single most common
   defect in the product). These rows separate with a hairline and spacing
   instead — light, not lines — so a list of forty entries still reads as
   one surface.

   Nothing here draws a border box or a radius, which is also what keeps the
   redesign spec's nesting assertion true.
   ════════════════════════════════════════════════════════════════════════ */

/** A hairline-separated list. The only separation is a 1px line that is not a box. */
export function RecordList({
  children,
  className = "",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  /** Accessible name for the list. */
  label?: string;
}) {
  return (
    <ul aria-label={label} className={`flex flex-col divide-y divide-white/[0.06] ${className}`}>
      {children}
    </ul>
  );
}

export function RecordRow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  /* py-3 keeps the density floor (spacing.md rule 4) and gives any control
     inside the row room to reach its 44px target. */
  return <li className={`py-3 first:pt-0 last:pb-0 ${className}`}>{children}</li>;
}

/**
 * A label / value pair inside a row. Values are tabular so a column of
 * numbers aligns (typography.md: `.tnum` on every counter).
 */
export function RecordFact({
  label,
  value,
  accent,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">{label}</p>
      <p className="tnum mt-1 text-[15px] font-semibold leading-tight" style={{ color: accent ?? RESERVE.ivory }}>
        {value}
      </p>
    </div>
  );
}

/**
 * Display-only status. A `<span>`, never a button: only navigable elements
 * may look interactive (Bible §11, no fake buttons).
 */
export function RecordTag({
  children,
  accent = RESERVE.slate,
  className = "",
}: {
  children: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.14em] ${className}`}
      style={{ color: alpha(accent, 0.9) }}
    >
      {children}
    </span>
  );
}

/**
 * The state a record screen shows before the member has logged anything.
 * It names what is missing and offers the real log — never a sample entry.
 */
export function RecordEmpty({
  headline,
  body,
  action,
}: {
  headline: string;
  body: string;
  /** The real action, already rendered by the caller so its tier stays the caller's decision. */
  action?: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <p className="text-[15px] font-semibold" style={{ color: RESERVE.ivory }}>
        {headline}
      </p>
      <p className="mt-1.5 max-w-[64ch] text-[12.5px] leading-[1.55] text-white/55">{body}</p>
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}
