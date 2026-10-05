"use client";

import { ClipboardCheck, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveDisclosure, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore, type DashboardView } from "@/lib/athlete-store";
import { allMet, firstUnmet, type Requirement } from "@/lib/records/requirements";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { measurementTrends } from "@/lib/physique/engine";
import {
  formatDay,
  formatDayFull,
  loggedWeightSeries,
  measurementRecord,
  photoRecord,
  physiqueEvidence,
  signed,
} from "@/lib/physique/record-summary";

import { RecordEmpty, RecordList, RecordRow } from "./records/RecordRows";
import { RecordHero } from "./records/RecordHero";
import { RequirementsPanel } from "./records/Requirements";
import { ViewShell } from "./ViewShell";

/* ════════════════════════════════════════════════════════════════════════
   PHYSIQUE COCKPIT — the member's own trend, and nothing past it.

   REMOVED IN THIS PASS, and why each one had to go:

     · The body-change PROJECTION. The chart ran three dashed points into
       the future (188.4 lb → 187.0 → 185.6, and 10.2% → 9.7% → 9.2% body
       fat) with a "Goal" reference line. A forecast of how a body will
       change is a guaranteed-results claim (CLAUDE.md), and none of those
       numbers came from the member.
     · "Target 185 lb · 9.2%" and "ETA Jun 22" — an invented goal and an
       invented arrival date for it.
     · "Bilateral Balance 97%", the "Composite Symmetry Index 84 / 100",
       the twelve-zone left/right heatmap and its Elite / Good / Fair / Flag
       legend. These scored a body from photographs, which DESIGN_BIBLE §02
       forbids outright, and no member ever earned any of the numbers.
     · "Lagging Group Analysis" — Reserve's own judgement of which of the
       member's muscles are behind, with a priority chip. §02 again: a weak
       point comes from the member's own selection, never from Reserve.
     · The Posing Practice Log — eight poses with invented dates and weekly
       rep counts, logged by nobody.
     · "Trend (14d) +2.1" and "Zones Tracked 12", both fabricated.

   What replaces them is the honest version of the same question: how many
   dated check-ins there are, over what span, and what changed between them.
   The chart plots only logged points. There is no line past the last one.
   ════════════════════════════════════════════════════════════════════════ */

const TOOLTIP_STYLE = {
  background: "#0a0b10",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  color: RESERVE.foreground,
  fontSize: 12,
  boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
};

/** Recharts needs a measured box; this holds the height so arrival shifts nothing. */
function ChartViewport({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setReady(true);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="h-full min-h-0 min-w-0">
      {ready ? children : <div className="h-full rounded-xl bg-black/20" />}
    </div>
  );
}

export function PhysiqueIntelligenceView() {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const physique = useAthleteDashboardStore((s) => s.physiqueCommand);

  const evidence = useMemo(() => physiqueEvidence(physique), [physique]);
  const record = useMemo(() => measurementRecord(physique), [physique]);
  const photos = useMemo(() => photoRecord(physique), [physique]);
  const series = useMemo(() => loggedWeightSeries(physique), [physique]);
  const trends = useMemo(() => measurementTrends(physique), [physique]);

  const waistTrend = trends.find((row) => row.site === "waist") ?? null;

  /* With little logged, the requirement list IS this cockpit's first screen:
     what it reads, what it still needs, and how far the member has got. */
  const requirements: Requirement[] = [
    {
      id: "check-ins",
      label: "Two check-ins",
      have: Math.min(evidence.entryCount, 2),
      need: 2,
      noun: "check-ins",
      detail: "Two dated entries make a change. One is only a value.",
      action: "Log a Check-In",
      view: "physique",
    },
    {
      id: "sites",
      label: "A site measured twice",
      have: Math.min(trends.length, 1),
      need: 1,
      noun: "site",
      detail: "The same site on two check-ins. Sites measured once are left out.",
      action: "Open Measurements",
      view: "measurements",
    },
    {
      id: "photos",
      label: "A photo check-in",
      have: Math.min(photos.checkInCount, 1),
      need: 1,
      noun: "photo check-in",
      detail: "A dated set. Reserve records date and poses, never the image.",
      action: "Add Progress Photo",
      view: "progress-photos",
    },
  ];
  const next = firstUnmet(requirements);
  const ready = allMet(requirements);

  return (
    <ViewShell
      label="Physique Intelligence"
      title="Physique Cockpit"
      icon={User}
      accentColor={RESERVE.gold}
      badge="Reserve Black"
      roomHero
      command="What changed between your own dated check-ins."
    >
      <RecordHero
        testId="physique-intelligence"
        accent={RESERVE.gold}
        eyebrow={evidence.line}
        statement={
          evidence.enough
            ? `${evidence.entryCount} check-ins to compare`
            : evidence.entryCount === 1
              ? "One check-in on file"
              : "No check-ins on file"
        }
        support={
          evidence.enough
            ? "The difference between your own entries. No forecast."
            : "A trend needs two dated check-ins. Until then this shows only what you logged."
        }
        reads={[
          {
            label: "Body weight",
            value: record.newest ? String(record.newest.bodyWeightLb) : null,
            unit: "lb",
            detail:
              record.weightDeltaLb !== null && record.previous
                ? `${signed(record.weightDeltaLb, "lb")} since ${formatDay(record.previous.date)}`
                : undefined,
            empty: "Evidence needed · log a check-in",
          },
          {
            label: "Waist",
            value: waistTrend ? String(waistTrend.latestIn) : null,
            unit: "in",
            detail: waistTrend ? `${signed(waistTrend.deltaIn, "in")} since ${formatDay(waistTrend.firstDate)}` : undefined,
            empty: "Evidence needed · two check-ins",
          },
          {
            label: "Photo check-ins",
            value: photos.checkInCount > 0 ? String(photos.checkInCount) : null,
            detail: photos.newest ? `last ${formatDay(photos.newest.date)}` : undefined,
            empty: "Evidence needed",
          },
        ]}
        action={
          next
            ? { label: next.action, icon: ClipboardCheck, onClick: () => setActiveView(next.view as DashboardView) }
            : { label: "Log a Check-In", icon: ClipboardCheck, onClick: () => setActiveView("physique") }
        }
      />

      {!ready && (
        <RequirementsPanel
          purpose="Reads the distance between your own dated check-ins. It does not forecast, score or estimate."
          requirements={requirements}
          onOpen={(view) => setActiveView(view)}
          accent={RESERVE.gold}
        />
      )}

      {/* ── Logged weight. Only points the member entered. ── */}
      <GlassPanel accent={RESERVE.steel} phone="flush">
        <ReserveSectionHeader label="Body weight you logged" accent={RESERVE.steel} />
        {series.length >= 2 ? (
          <>
            <div className="h-[220px]">
              <ChartViewport>
                <ResponsiveContainer width="100%" height="100%">
                  {/* No negative left margin: it pulled the axis off-canvas and
                      clipped the leading digit of every tick on a phone. */}
                  <LineChart data={series} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="rgba(255,255,255,0.18)"
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.18)"
                      tickLine={false}
                      width={52}
                      domain={["dataMin - 2", "dataMax + 2"]}
                      tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) => [`${value} lb`, "Logged"]}
                      labelFormatter={(label) => `Check-in ${label}`}
                    />
                    <Line
                      dataKey="bodyWeightLb"
                      name="Logged"
                      stroke={RESERVE.steel}
                      strokeWidth={2}
                      dot={{ r: 3, fill: RESERVE.steel, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartViewport>
            </div>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/40">
              {series.length} logged points · the line ends at your last check-in
            </p>
          </>
        ) : (
          <RecordEmpty
            headline="Not enough points to draw a line"
            body="Two dated check-ins are the minimum. Reserve will not interpolate between them, and it will never extend a line past your last entry."
            action={
              <ReserveButton tier="secondary" size="md" accent={RESERVE.steel} icon={ClipboardCheck} onClick={() => setActiveView("physique")}>
                Log a Check-In
              </ReserveButton>
            }
          />
        )}
      </GlassPanel>

      {/* ── Measurement change, first → latest, between real entries only. ── */}
      <GlassPanel accent={RESERVE.gold} phone="flush">
        <ReserveSectionHeader
          label={trends.length > 0 ? `Measurement change · ${trends.length} sites` : "Measurement change"}
          accent={RESERVE.gold}
        />
        {trends.length > 0 ? (
          <RecordList label="Measurement change by site">
            {trends.map((row) => (
              <RecordRow key={row.site}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-[14.5px] font-semibold text-[#f2eee6]">{row.label}</p>
                  <p className="tnum text-[15px] font-semibold text-[#f2eee6]">
                    {row.latestIn} <span className="text-[12px] font-medium text-white/50">in</span>
                    <span
                      className="ml-2.5 font-mono text-[11px] uppercase tracking-[0.12em]"
                      style={{ color: alpha(RESERVE.slate, 0.95) }}
                    >
                      {signed(row.deltaIn, "in")}
                    </span>
                  </p>
                </div>
                <p className="tnum mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white/45">
                  {row.firstIn} in on {formatDay(row.firstDate)} → {row.latestIn} in on {formatDay(row.latestDate)} ·{" "}
                  {row.entries} check-ins
                </p>
              </RecordRow>
            ))}
          </RecordList>
        ) : (
          <RecordEmpty
            headline="No site has two readings yet"
            body="A change appears once the same site is measured on two dated check-ins. Sites measured only once are left out rather than guessed at."
            action={
              <ReserveButton tier="secondary" size="md" icon={ClipboardCheck} onClick={() => setActiveView("measurements")}>
                Open Measurements
              </ReserveButton>
            }
          />
        )}
      </GlassPanel>

      {/* ── The dated timeline of check-ins. ── */}
      {record.entryCount > 0 && (
        <GlassPanel accent={RESERVE.violet} phone="flush">
          <ReserveSectionHeader label={`Check-in timeline · ${record.entryCount}`} accent={RESERVE.violet} />
          <RecordList label="Check-in timeline">
            {record.history.map((entry) => {
              const siteCount = Object.keys(entry.measurements).length;
              const photo = photos.history.find((checkIn) => checkIn.date === entry.date);
              return (
                <RecordRow key={entry.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="tnum text-[14.5px] font-semibold text-[#f2eee6]">{formatDayFull(entry.date)}</p>
                    <p className="tnum text-[13px] text-white/60">
                      {entry.bodyWeightLb} lb · {siteCount} {siteCount === 1 ? "site" : "sites"}
                      {photo ? ` · ${photo.poses.length} ${photo.poses.length === 1 ? "pose" : "poses"} captured` : ""}
                    </p>
                  </div>
                  {entry.notes && <p className="mt-1 max-w-[66ch] text-[12.5px] leading-[1.55] text-white/60">{entry.notes}</p>}
                </RecordRow>
              );
            })}
          </RecordList>
        </GlassPanel>
      )}

      {/* The old "will not do" callout and the footer said the same thing
          twice, in a box inside a panel. One whisper line now, and the full
          sentence behind it. */}
      <footer data-physique-cockpit="limits" className="pt-1">
        <ReserveDisclosure summary="No forecast, no score · what this cockpit will not do">
          <p className="max-w-[70ch] text-[12.5px] leading-[1.55] text-white/55">
            Reserve does not project a future weight or body-fat figure, set a target or a date you did not set, score
            symmetry, rank a muscle group, or assess a photograph.
          </p>
          <p className="mt-1.5 max-w-[70ch] text-[12.5px] leading-[1.55] text-white/55">
            Every figure is from check-ins you logged: the distance between two entries, and the conclusion stays yours.
          </p>
        </ReserveDisclosure>
      </footer>
    </ViewShell>
  );
}
