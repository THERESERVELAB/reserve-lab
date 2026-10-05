"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import React from "react";

import { RADIUS, RESERVE, alpha } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE DATA PRIMITIVES — one presentation for every number.

   A metric rendered three different ways on three screens is how a product
   stops feeling like one product. These components are the single
   presentation for: a metric, a trend, provenance, and a status.

   PROVENANCE IS NOT OPTIONAL (Bible §12). `ReserveMetric` requires an
   explicit `provenance` value, so a derived or estimated number cannot be
   rendered as a measured one by omission. "Fabricated certainty is the
   cheapest thing software can do."
   ════════════════════════════════════════════════════════════════════════ */

/* ─── Provenance ──────────────────────────────────────────────────────────
   Every number the member sees is one of these four things, and it says
   which. `none` means "no evidence yet" and renders the logging prompt
   instead of a value — never a guess, never an interpolation. */

export type Provenance = "logged" | "derived" | "estimated" | "none";

const PROVENANCE_LABEL: Record<Provenance, string | null> = {
  logged: null, // A member-entered value needs no qualifier.
  derived: "derived",
  estimated: "est.",
  none: null,
};

/* ─── ReserveMetric ───────────────────────────────────────────────────────
   One number, presented as an object rather than a table cell.

   Sizes map to hierarchy, not to taste:
     jewel   the single dominant number on the screen. One per screen.
     large   a headline metric inside a section.
     compact a supporting metric in a group. */

export type ReserveMetricProps = {
  label: string;
  /** The value. `null` renders the evidence-needed state, never a zero. */
  value: string | number | null;
  unit?: string;
  provenance: Provenance;
  size?: "jewel" | "large" | "compact";
  accent?: string;
  trend?: ReserveTrendDirection;
  /** What the member does when there is no value. Required when value is null. */
  emptyAction?: string;
  className?: string;
};

export function ReserveMetric({
  label,
  value,
  unit,
  provenance,
  size = "compact",
  accent = RESERVE.gold,
  trend,
  emptyAction = "Evidence needed",
  className = "",
}: ReserveMetricProps) {
  const qualifier = PROVENANCE_LABEL[provenance];
  const missing = value === null || provenance === "none";

  const valueClass =
    size === "jewel" ? "type-jewel" : size === "large" ? "type-metric" : "tnum text-[22px] font-extrabold leading-none tracking-[-0.02em]";

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[8px] uppercase tracking-[0.24em] text-white/40">
          {label}
        </span>
        {qualifier && !missing && (
          <span
            className="font-mono text-[7.5px] uppercase tracking-[0.14em]"
            style={{ color: alpha(RESERVE.slate, 0.6) }}
          >
            {qualifier}
          </span>
        )}
      </div>

      {missing ? (
        /* No value. The screen says so and says what to do about it. The one
           thing it must never do is render a plausible-looking number. */
        <p className="mt-1.5 text-[12px] font-medium text-white/45">{emptyAction}</p>
      ) : (
        <div className="mt-1.5 flex items-end gap-2">
          <strong className={valueClass} style={{ color: RESERVE.ivory }}>
            {value}
          </strong>
          {unit && (
            <span className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
              {unit}
            </span>
          )}
          {trend && <ReserveTrend direction={trend} accent={accent} className="mb-1" />}
        </div>
      )}
    </div>
  );
}

/* ─── ReserveTrend ────────────────────────────────────────────────────────
   Direction only. Deliberately NOT a verdict: a trend glyph describes which
   way the member's own data moved, and nothing about whether that is good.
   In the clinical domain that distinction is the compliance boundary. */

export type ReserveTrendDirection = "rising" | "falling" | "steady";

const TREND_META: Record<
  ReserveTrendDirection,
  { icon: React.ComponentType<{ size?: number }>; label: string }
> = {
  rising: { icon: ArrowUpRight, label: "trend rising" },
  falling: { icon: ArrowDownRight, label: "trend falling" },
  steady: { icon: ArrowRight, label: "trend steady" },
};

export function ReserveTrend({
  direction,
  accent = RESERVE.slate,
  className = "",
}: {
  direction: ReserveTrendDirection;
  accent?: string;
  className?: string;
}) {
  const { icon: Icon, label } = TREND_META[direction];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} style={{ color: alpha(accent, 0.75) }}>
      <Icon size={12} aria-hidden="true" />
      {/* Never colour alone — the direction is in the text too. */}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* ─── ReserveStatusChip ───────────────────────────────────────────────────
   Display-only status. Renders as a <span>, never a button: only navigable
   elements may look interactive (Bible §11). The canonical word set is
   fixed so status language cannot drift screen to screen. */

export type ReserveStatus =
  | "due-now"
  | "due-next"
  | "past-due"
  | "completed"
  | "skipped"
  | "logged"
  | "log-only";

const STATUS_META: Record<ReserveStatus, { label: string; color: string }> = {
  "due-now": { label: "Due Now", color: RESERVE.gold },
  "due-next": { label: "Due Next", color: RESERVE.amber },
  "past-due": { label: "Past Due", color: RESERVE.red },
  completed: { label: "Completed", color: RESERVE.green },
  skipped: { label: "Skipped", color: RESERVE.slate },
  logged: { label: "Logged", color: RESERVE.green },
  "log-only": { label: "Log Only", color: RESERVE.slate },
};

export function ReserveStatusChip({
  status,
  className = "",
}: {
  status: ReserveStatus;
  className?: string;
}) {
  const { label, color } = STATUS_META[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] ${className}`}
      style={{
        borderRadius: RADIUS.chip,
        border: `1px solid ${alpha(color, 0.26)}`,
        background: alpha(color, 0.08),
        color: alpha(color, 0.9),
      }}
    >
      {label}
    </span>
  );
}

/* ─── ReserveConfidence ───────────────────────────────────────────────────
   How much the system trusts its own read. Three levels, in the closed
   palette — never a green/yellow/red spectrum, which would make it a
   dashboard gauge (color.md). */

export function ReserveConfidence({
  level,
  className = "",
}: {
  level: "low" | "moderate" | "high";
  className?: string;
}) {
  const filled = level === "high" ? 3 : level === "moderate" ? 2 : 1;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[3px] w-3 rounded-full"
            style={{
              background: i < filled ? alpha(RESERVE.gold, 0.75) : "rgba(255,255,255,0.09)",
            }}
          />
        ))}
      </span>
      <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/40">
        {level} confidence
      </span>
    </span>
  );
}
