"use client";

import React from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveSectionHeader } from "@/components/ui/reserve";
import { RESERVE, alpha } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   COMMAND ROWS — Compound Command's places, said as rows.

   Every place used to be a grid of bordered cards, and every card held a
   grid of bordered fact tiles: a card inside a card inside a panel. Here a
   place is ONE panel (flush on phones), its entries are hairline rows, and
   the facts inside a row are plain label/value text. Nothing below draws a
   border box, a fill or a shadow, so a row can never become a card.

   Local to Compound Command: the shared primitives are frozen during the
   redesign waves (program-redesign spec, file ownership rules).
   ════════════════════════════════════════════════════════════════════════ */

/** One place: a single glass panel with a section header. Flush on phones. */
export function CommandPanel({
  label,
  action,
  accent = RESERVE.steel,
  children,
  record,
}: {
  label: string;
  action?: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
  /** Becomes `data-compound`, so a spec can find the place. */
  record?: string;
}) {
  return (
    <GlassPanel accent={accent} phone="flush">
      <section aria-label={label} data-compound={record}>
        <ReserveSectionHeader label={label} action={action} accent={accent} />
        {children}
      </section>
    </GlassPanel>
  );
}

/** A hairline-separated list. */
export function RowList({ children, label }: { children: React.ReactNode; label?: string }) {
  return <ul aria-label={label} className="flex flex-col divide-y divide-white/[0.06]">{children}</ul>;
}

/** A row: the member's entry on the left, its quiet controls on the right. */
export function Row({
  title,
  status,
  meta,
  children,
  actions,
  record,
  leading,
}: {
  title: string;
  /** Display-only status word, never a button. */
  status?: { label: string; color: string };
  /** One whisper line under the title: class, route, source. */
  meta?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  record?: string;
  /** A small object that identifies the row at a glance — the compound's own
      vial, drawn at its logged level. Decoration would not earn this slot; a
      thing the member recognises off their shelf does. */
  leading?: React.ReactNode;
}) {
  return (
    <li className="py-3.5 first:pt-1 last:pb-1" data-compound-row={record}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-[260px] items-start gap-3">
          {leading && <span className="mt-0.5 flex shrink-0 items-start">{leading}</span>}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <span className="text-[15px] font-semibold leading-snug text-[#f2eee6]">{title}</span>
              {status && <StatusWord label={status.label} color={status.color} />}
            </p>
            {meta && <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">{meta}</p>}
            {children}
          </div>
        </div>
        {actions && <div className="-ml-3 flex shrink-0 flex-wrap items-center gap-1 sm:ml-0">{actions}</div>}
      </div>
    </li>
  );
}

/** Status in the canonical word set, carried by text so colour is never alone. */
export function StatusWord({ label, color }: { label: string; color: string }) {
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: alpha(color, 0.92) }}>
      {label}
    </span>
  );
}

/** Label / value pairs as plain text. Replaces the bordered fact tiles. */
export function Facts({ items }: { items: Array<[label: string, value: React.ReactNode]> }) {
  return (
    <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">{label}</dt>
          <dd className="tnum text-[12.5px] leading-[1.45] text-white/75">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A group label inside a panel: "Due now · 2". */
export function GroupLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.2em] first:mt-0" style={{ color: color ?? "rgba(255,255,255,0.45)" }}>
      {children}
    </p>
  );
}

/** A one-line note in a place. Keep it under two lines. */
export function PlaceNote({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 max-w-[70ch] text-[12.5px] leading-[1.55] text-white/55">{children}</p>;
}

/** An amber line for something the member should look at. Text, not a callout box. */
export function ReviewLine({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <p className="mt-2 text-[12px] leading-[1.5] text-white/60">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: RESERVE.amber }}>
        {label}
      </span>
      {children ? <> · {children}</> : null}
    </p>
  );
}
