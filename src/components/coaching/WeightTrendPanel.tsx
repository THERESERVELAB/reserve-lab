"use client";

/* Weight-trend section for Client Command. Describes trends and context —
   interpretation belongs to the coach, never to Reserve. */

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { WeightEntry } from "@/lib/coaching/types";
import { EmptyState, MicroLabel, Panel, PanelHeader, StatTile } from "./ui";

export function WeightTrendPanel({
  entries,
  phaseLabel,
  goalNote,
}: {
  entries: WeightEntry[];
  phaseLabel: string;
  goalNote?: string;
}) {
  const { chart, weeklyAvg, prevAvg, delta } = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const chart = sorted.map((e, i) => {
      const window = sorted.slice(Math.max(0, i - 6), i + 1);
      const avg = window.reduce((s, w) => s + w.weightLb, 0) / window.length;
      return {
        date: e.date.slice(5),
        weight: e.weightLb,
        avg: Number(avg.toFixed(1)),
      };
    });
    const avgOf = (xs: WeightEntry[]) =>
      xs.length ? xs.reduce((s, w) => s + w.weightLb, 0) / xs.length : null;
    const weeklyAvg = avgOf(sorted.slice(-7));
    const prevAvg = avgOf(sorted.slice(-14, -7));
    const delta = weeklyAvg !== null && prevAvg !== null ? weeklyAvg - prevAvg : null;
    return { chart, weeklyAvg, prevAvg, delta };
  }, [entries]);

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No weight data"
        body="No weight entries have been logged yet. Trend context will build as daily entries arrive."
      />
    );
  }

  const latest = entries[entries.length - 1];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Latest entry" value={`${latest.weightLb.toFixed(1)} lb`} sub={latest.date} />
        <StatTile
          label="Weekly average"
          value={weeklyAvg !== null ? `${weeklyAvg.toFixed(1)} lb` : "—"}
          sub="Last 7 entries"
        />
        <StatTile
          label="Previous week"
          value={prevAvg !== null ? `${prevAvg.toFixed(1)} lb` : "—"}
          sub="Entries 8–14"
        />
        <StatTile
          label="Rate of change"
          value={delta !== null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} lb/wk` : "—"}
          accent={delta !== null && Math.abs(delta) > 2 ? "#e8c87a" : "#5fb7d5"}
          sub={phaseLabel}
        />
      </div>

      <Panel>
        <PanelHeader label="Trend" title="Daily weight and 7-day average" />
        <div className="h-[220px] px-2 py-3">
          {/* initialDimension keeps the chart from measuring a hidden container as 0×0 */}
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 220 }}>
            <AreaChart data={chart} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="wtFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d5b15f" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#d5b15f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["dataMin - 1.5", "dataMax + 1.5"]}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  background: "#0d0e14",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  fontSize: 11,
                }}
                labelStyle={{ color: "rgba(255,255,255,0.5)", fontFamily: "monospace", fontSize: 9 }}
              />
              {weeklyAvg !== null && (
                <ReferenceLine y={weeklyAvg} stroke="rgba(95,183,213,0.35)" strokeDasharray="4 4" />
              )}
              <Area
                type="monotone"
                dataKey="weight"
                stroke="rgba(213,177,95,0.35)"
                strokeWidth={1}
                fill="url(#wtFill)"
                dot={false}
                name="Daily"
              />
              <Area
                type="monotone"
                dataKey="avg"
                stroke="#5fb7d5"
                strokeWidth={2}
                fill="none"
                dot={false}
                name="7-day avg"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {goalNote && (
          <div className="border-t border-white/[0.05] px-4 py-2.5">
            <MicroLabel>Context</MicroLabel>
            <p className="mt-0.5 text-[11px] text-white/50">{goalNote}</p>
          </div>
        )}
      </Panel>
    </div>
  );
}
