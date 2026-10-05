"use client";

import { useId, useMemo } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { formatLabValue } from "@/lib/cycle-review/lab-trends";
import { RESERVE, alpha } from "@/lib/design/tokens";
import type { LabSafetyBrief } from "@/lib/labs/lab-safety";
import { LAB_FLAG_LABEL } from "@/lib/labs/types";
import { RESEARCH_COPY } from "@/lib/research/copy";
import { buildLabResponse, listLabMarkers, type LabResponse, type ResponseEvent, type ResponsePoint } from "@/lib/research/lab-response";

import { formatDay, formatSigned } from "./format";

const SELECT =
  "mt-1 min-h-[44px] w-full max-w-[360px] rounded-[12px] border border-white/[0.08] bg-black/30 px-3 text-[16px] text-[#f2eee6] outline-none focus:border-[#5fb7d5]/60 sm:text-[13px]";

const EMPTY: never[] = [];

export function LabResponsePanel({
  labBrief,
  markerId,
  onMarkerChange,
}: {
  labBrief: LabSafetyBrief;
  markerId: string | null;
  onMarkerChange: (id: string) => void;
}) {
  const changeHistory = useAthleteDashboardStore((s) => s.changeHistory) ?? EMPTY;
  const cycles = useAthleteDashboardStore((s) => s.cyclePeriods) ?? EMPTY;
  const checkIns = useAthleteDashboardStore((s) => s.cycleCheckIns) ?? EMPTY;
  const selectId = useId();

  const markers = useMemo(() => listLabMarkers(labBrief), [labBrief]);
  const selected = markerId && markers.some((m) => m.id === markerId) ? markerId : markers[0]?.id ?? null;
  const response = useMemo(
    () => (selected ? buildLabResponse({ labBrief, markerId: selected, changeHistory, cycles, checkIns }) : null),
    [labBrief, selected, changeHistory, cycles, checkIns],
  );

  return (
    <GlassPanel accent={RESERVE.steel}>
      <section aria-label={RESEARCH_COPY.labResponse} className="flex flex-col gap-5">
        <div>
          <h3 className="type-section-title" style={{ color: RESERVE.ivory }}>{RESEARCH_COPY.labResponse}</h3>
          <p className="type-supporting mt-1.5 max-w-[620px] text-[12.5px]">{RESEARCH_COPY.labResponseExplainer}</p>
        </div>

        {markers.length === 0 || !response ? (
          <p className="text-[13px] text-white/60">{RESEARCH_COPY.labResponseEmpty}</p>
        ) : (
          <>
            <label htmlFor={selectId} className="block text-[11.5px] text-white/55">
              Marker
              <select id={selectId} value={selected ?? ""} onChange={(e) => onMarkerChange(e.target.value)} className={SELECT}>
                {markers.map((marker) => (
                  <option key={marker.id} value={marker.id}>
                    {marker.label} ({marker.readings})
                  </option>
                ))}
              </select>
            </label>

            <ResponseChart response={response} />

            {response.changeFromPrevious && (
              <p className="tnum text-[13px] text-white/75">
                Change from previous result ({formatDay(response.changeFromPrevious.from.date)}): {formatSigned(response.changeFromPrevious.delta)}
                {response.unit ? (response.unit.trim() === "%" ? "%" : ` ${response.unit}`) : ""}
                {response.changeFromPrevious.pct != null ? ` (${formatSigned(response.changeFromPrevious.pct)}%)` : ""}
              </p>
            )}

            {response.findings.length > 0 && (
              <ul aria-label="Results to review" className="flex flex-col gap-2">
                {response.findings.map((finding) => (
                  <li
                    key={`${finding.id}-${finding.latest.date}`}
                    className="rounded-[14px] px-3.5 py-3 text-[12.5px] leading-[1.55]"
                    style={{ background: alpha(finding.tier === "urgent" ? RESERVE.red : RESERVE.amber, 0.08), color: RESERVE.ivory }}
                  >
                    <p className="font-semibold">{finding.tier === "urgent" ? RESEARCH_COPY.findingUrgent : RESEARCH_COPY.findingDiscuss}</p>
                    {finding.reasons.map((reason) => (
                      <p key={reason} className="mt-0.5 text-white/70">{reason}</p>
                    ))}
                  </li>
                ))}
              </ul>
            )}

            <EventList events={response.events} />
            <ReadingsTable response={response} />
          </>
        )}
      </section>
    </GlassPanel>
  );
}

const W = 640;
const H = 260;
const PAD = { top: 14, right: 14, bottom: 14, left: 14 };

function pointColor(point: ResponsePoint): string {
  if (point.position === "above" || point.position === "below") return RESERVE.amber;
  if (point.position === "within") return RESERVE.steel;
  return RESERVE.slate;
}

function ResponseChart({ response }: { response: LabResponse }) {
  const drawn = response.points.filter((p) => p.value != null);
  if (drawn.length === 0) return null;

  const times = drawn.map((p) => Date.parse(`${p.date}T12:00:00`));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const values = [...drawn.map((p) => p.value!), response.range?.low, response.range?.high].filter((v): v is number => v != null);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.abs(hi) || 1;
  const yMin = lo - span * 0.12;
  const yMax = hi + span * 0.12;

  const x = (date: string) => {
    const t = Date.parse(`${date}T12:00:00`);
    if (t1 === t0) return (PAD.left + W - PAD.right) / 2;
    return PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  };
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
  const inside = (date: string) => {
    const t = Date.parse(`${date}T12:00:00`);
    return t >= t0 && t <= t1;
  };

  const path = drawn.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.date).toFixed(1)},${y(p.value!).toFixed(1)}`).join(" ");
  const { low, high } = response.range ?? {};

  return (
    <figure className="m-0">
      <div className="flex items-stretch gap-2">
        <div aria-hidden="true" className="tnum flex w-10 shrink-0 flex-col justify-between py-1 text-right text-[11px] text-white/50">
          <span>{Number(yMax.toFixed(1))}</span>
          <span>{Number(yMin.toFixed(1))}</span>
        </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${response.label} results over time`} className="h-auto min-w-0 flex-1">
        {(low != null || high != null) && (
          <rect
            x={PAD.left}
            width={W - PAD.left - PAD.right}
            y={y(high ?? yMax)}
            height={Math.max(0, y(low ?? yMin) - y(high ?? yMax))}
            fill={alpha(RESERVE.steel, 0.1)}
          />
        )}
        {response.events.filter((event) => inside(event.date)).map((event) => (
          <line key={event.id} x1={x(event.date)} x2={x(event.date)} y1={PAD.top} y2={H - PAD.bottom} stroke={alpha(RESERVE.ivory, 0.18)} strokeDasharray="3 4" />
        ))}
        <path d={path} fill="none" stroke={alpha(RESERVE.steel, 0.7)} strokeWidth={1.5} />
        {drawn.map((p) => (
          <circle key={`${p.recordId}-${p.date}`} cx={x(p.date)} cy={y(p.value!)} r={4} fill={pointColor(p)} />
        ))}
      </svg>
      </div>
      <div aria-hidden="true" className="tnum mt-1 flex justify-between pl-12 text-[11px] text-white/50">
        <span>{formatDay(drawn[0].date)}</span>
        {drawn.length > 1 && <span>{formatDay(drawn.at(-1)!.date)}</span>}
      </div>
      <figcaption className="mt-1 text-[11.5px] text-white/50">
        {response.range ? `Shaded: the range on your latest report (${response.range.text}). ` : ""}
        Dashed lines: plan changes and check-ins on those dates.
      </figcaption>
    </figure>
  );
}

function EventList({ events }: { events: ResponseEvent[] }) {
  return (
    <div>
      <h4 className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">Plan changes and check-ins on the same dates</h4>
      {events.length === 0 ? (
        <p className="mt-1.5 text-[12.5px] text-white/55">{RESEARCH_COPY.noEvents}</p>
      ) : (
        <ul aria-label="Plan changes and check-ins" className="mt-1.5 flex flex-col divide-y divide-white/[0.05] rounded-2xl bg-white/[0.02] px-4">
          {events.map((event) => (
            <li key={event.id} className="py-2.5">
              <p className="text-[12.5px]">
                <span className="tnum text-white/50">{formatDay(event.date)} · </span>
                <span style={{ color: RESERVE.ivory }}>{event.label}</span>
              </p>
              {event.details.map((detail) => (
                <p key={detail} className="tnum text-[12px] text-white/60">{detail}</p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReadingsTable({ response }: { response: LabResponse }) {
  const rows = [...response.points, ...response.otherUnit].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div>
      <h4 className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">Every result</h4>
      {response.otherUnit.length > 0 && <p className="mt-1 text-[12px] text-white/55">{RESEARCH_COPY.otherUnitNote}</p>}
      <div className="mt-1.5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[12.5px]">
          <thead className="text-white/45">
            <tr>
              <th scope="col" className="py-2 pr-3 font-normal">Date</th>
              <th scope="col" className="py-2 pr-3 font-normal">Result</th>
              <th scope="col" className="py-2 pr-3 font-normal">Range on report</th>
              <th scope="col" className="py-2 pr-3 font-normal">Lab flag</th>
              <th scope="col" className="py-2 font-normal">Lab</th>
            </tr>
          </thead>
          <tbody className="tnum text-white/80">
            {rows.map((row) => (
              <tr key={`${row.recordId}-${row.date}-${row.unit ?? ""}`} className="border-t border-white/[0.05]">
                <td className="py-2 pr-3">{formatDay(row.date)}</td>
                <td className="py-2 pr-3">{formatLabValue(row.valueText, row.unit)}</td>
                <td className="py-2 pr-3">{row.rangeText ?? "—"}</td>
                <td className="py-2 pr-3">{row.labFlag ? LAB_FLAG_LABEL[row.labFlag] : "—"}</td>
                <td className="py-2">{row.labName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
