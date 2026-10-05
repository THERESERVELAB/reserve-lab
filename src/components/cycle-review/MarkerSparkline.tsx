"use client";

import { daysBetween } from "@/lib/cycle/cycle-period";
import type { MarkerTrend, TimelineEvent } from "@/lib/cycle-review/lab-trends";
import { RESERVE, alpha } from "@/lib/design/tokens";

const W = 120;
const H = 32;
const PAD_X = 3;
const PAD_TOP = 4;
const PLOT_BOTTOM = 24;

function formatShort(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * One marker's draws across time, with the cycle underneath: a dashed hairline
 * where the cycle started and short ticks where compounds were added or
 * paused. Timing only — the chart never implies a cause.
 */
export function MarkerSparkline({
  trend,
  events,
  color,
  className = "h-7 w-[56px] sm:h-8 sm:w-[120px]",
}: {
  trend: MarkerTrend;
  events: TimelineEvent[];
  color: string;
  className?: string;
}) {
  const points = trend.points.filter((p): p is typeof p & { value: number } => p.value !== null);
  if (points.length === 0) return null;

  const start = events.find((e) => e.kind === "cycle-start");
  const dates = [...points.map((p) => p.date), ...(start ? [start.date] : [])].sort();
  const from = dates[0];
  const to = dates.at(-1)!;
  const span = Math.max(1, daysBetween(from, to));
  const x = (date: string) => PAD_X + (daysBetween(from, date) / span) * (W - PAD_X * 2);

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.2 || Math.abs(max) * 0.05 || 1;
  const y = (v: number) => PAD_TOP + (1 - (v - (min - pad)) / (max + pad - (min - pad))) * (PLOT_BOTTOM - PAD_TOP);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = events.filter((e) => (e.kind === "compound-added" || e.kind === "compound-paused") && e.date >= from && e.date <= to);
  const last = points.at(-1)!;

  const label = `${trend.label}: ${points.map((p) => `${p.valueText}${trend.unit ? ` ${trend.unit}` : ""} on ${formatShort(p.date)}`).join(", ")}.${start ? ` Cycle started ${formatShort(start.date)}.` : ""}${ticks.length ? ` ${ticks.map((t) => `${t.label} ${formatShort(t.date)}`).join(", ")}.` : ""}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`block shrink-0 ${className}`} role="img" aria-label={label} preserveAspectRatio="none">
      {start && (
        <line x1={x(start.date)} x2={x(start.date)} y1={1} y2={H - 1} stroke={alpha(RESERVE.slate, 0.7)} strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      )}
      {ticks.map((tick) => (
        <line key={`${tick.kind}-${tick.date}-${tick.label}`} x1={x(tick.date)} x2={x(tick.date)} y1={PLOT_BOTTOM + 2} y2={H - 1} stroke={alpha(RESERVE.steel, 0.85)} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      ))}
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last.date)} cy={y(last.value)} r={2.2} fill={color} />
    </svg>
  );
}
