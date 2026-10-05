"use client";

import { useMemo } from "react";

import { compoundIdentity } from "@/components/safety/useSafetyContext";
import { GlassPanel } from "@/components/ui/GlassPanel";
import type { EnhancementEntry } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import type { LabSafetyBrief } from "@/lib/labs/lab-safety";
import { LAB_FLAG_LABEL } from "@/lib/labs/types";
import { buildBurdenMap, type BurdenMapRow } from "@/lib/research/burden-map";
import { RESEARCH_COPY } from "@/lib/research/copy";

import { formatAge } from "./format";

export function BurdenMapPanel({ compounds, labBrief, today }: { compounds: EnhancementEntry[]; labBrief: LabSafetyBrief; today: string }) {
  const rows = useMemo(
    () =>
      buildBurdenMap({
        compounds: compounds.map((entry) => ({ ...compoundIdentity(entry), id: entry.id, isActive: entry.isActive, pausedAt: entry.pausedAt })),
        labBrief,
        today,
      }),
    [compounds, labBrief, today],
  );
  const loaded = rows.filter((row) => row.compounds.length > 0);
  const unloaded = rows.filter((row) => row.compounds.length === 0);

  return (
    <GlassPanel accent={RESERVE.steel}>
      <section aria-label={RESEARCH_COPY.burdenMap} className="flex flex-col gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="type-section-title" style={{ color: RESERVE.ivory }}>{RESEARCH_COPY.burdenMap}</h3>
            <span className="rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em]" style={{ background: alpha(RESERVE.amber, 0.1), color: RESERVE.amber }}>
              {RESEARCH_COPY.burdenPending}
            </span>
          </div>
          <p className="type-supporting mt-1.5 max-w-[620px] text-[12.5px]">{RESEARCH_COPY.burdenMapExplainer}</p>
        </div>

        {loaded.length === 0 && <p className="text-[13px] text-white/60">{RESEARCH_COPY.noRunning}</p>}

        <ul aria-label="Body systems" className="flex flex-col gap-3">
          {[...loaded, ...unloaded].map((row) => (
            <SystemRow key={row.system} row={row} />
          ))}
        </ul>
      </section>
    </GlassPanel>
  );
}

function SystemRow({ row }: { row: BurdenMapRow }) {
  const loaded = row.compounds.length > 0;
  return (
    <li className="rounded-2xl bg-white/[0.02] px-4 py-3.5">
      <section aria-label={row.label}>
        <h4 className="text-[14px] font-semibold" style={{ color: loaded ? RESERVE.ivory : alpha(RESERVE.ivory, 0.6) }}>{row.label}</h4>

        {loaded ? (
          <ul aria-label={`Compounds for ${row.label}`} className="mt-2 flex flex-col gap-1.5">
            {row.compounds.map((compound) => (
              <li key={compound.id} className="text-[12.5px] leading-[1.5]">
                <span className="font-semibold" style={{ color: RESERVE.ivory }}>{compound.name}</span>
                {compound.loads.map((load) => (
                  <span key={load.burden} className="text-white/65">
                    {" · "}
                    {load.label} <span style={{ color: RESERVE.steel }}>({load.gradeLabel})</span>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[12.5px] text-white/50">{RESEARCH_COPY.noLoad}</p>
        )}

        {(row.markers.length > 0 || row.signals.length > 0) && (
          <div className="mt-2.5 flex flex-col gap-1">
            {row.markers.length > 0 && (
              <ul aria-label={`Markers watched for ${row.label}`} className="flex flex-wrap gap-x-4 gap-y-1">
                {row.markers.map((marker) => (
                  <li key={marker.key} className="tnum text-[12px] text-white/60">
                    {marker.label}:{" "}
                    {marker.latest ? (
                      <>
                        <span style={{ color: RESERVE.ivory }}>{marker.latest.valueText}</span>
                        {marker.latest.labFlag ? ` (${LAB_FLAG_LABEL[marker.latest.labFlag]})` : ""} · {formatAge(marker.ageDays ?? 0)}
                      </>
                    ) : (
                      RESEARCH_COPY.notTested
                    )}
                  </li>
                ))}
              </ul>
            )}
            {row.signals.length > 0 && <p className="text-[12px] text-white/50">Check-in: {row.signals.join(", ")}</p>}
          </div>
        )}
      </section>
    </li>
  );
}
