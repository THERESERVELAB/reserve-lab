"use client";

import { Check } from "lucide-react";

import { DETAIL_BAND_BLEED, ReserveButton, ReserveDetailImage, ReserveSectionHeader } from "@/components/ui/reserve";
import { GlassPanel } from "@/components/ui/GlassPanel";
import type { DashboardView } from "@/lib/athlete-store";
import type { DetailImageId } from "@/lib/brand/asset-manifest";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { isMet, progressFraction, progressLabel, readinessLine, type Requirement } from "@/lib/records/requirements";

import { RecordList, RecordRow } from "./RecordRows";

/* ════════════════════════════════════════════════════════════════════════
   WHAT THIS COCKPIT NEEDS — the first screen when there is little to read.

   This is the answer to "the higher tiers don't work — there's not much
   info in there". Rather than one waiting-for-data sentence, a cockpit with
   no data shows what it does, exactly what it needs, how far the member has
   got toward each line, and a way into each one.

   Nothing here is a preview of the finished screen and nothing is sample
   data. The requirement list IS the content, and every count is the
   member's own.
   ════════════════════════════════════════════════════════════════════════ */

export function RequirementsPanel({
  title,
  purpose,
  requirements,
  onOpen,
  accent = RESERVE.gold,
  detail,
}: {
  /** What this cockpit does, in one line, from the member's side. */
  purpose: string;
  title?: string;
  requirements: Requirement[];
  onOpen: (view: DashboardView) => void;
  accent?: string;
  /** The room's detail image, as a band at the top, when this panel is the room's first section. */
  detail?: DetailImageId;
}) {
  return (
    <GlassPanel accent={accent} phone="flush">
      {detail && <ReserveDetailImage id={detail} className={DETAIL_BAND_BLEED} />}
      {/* The readiness count rides on the header whatever the title, so a
          screen can never name its requirements without saying how far the
          member has actually got. */}
      <ReserveSectionHeader label={`${title ?? "What this needs"} · ${readinessLine(requirements)}`} accent={accent} />
      <p className="max-w-[72ch] text-[13.5px] leading-[1.6] text-white/70">{purpose}</p>

      <RecordList label="What this cockpit needs" className="mt-3.5">
        {requirements.map((requirement) => {
          const met = isMet(requirement);
          const fraction = progressFraction(requirement);
          return (
            <RecordRow key={requirement.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5">
                    <p className="text-[14.5px] font-semibold text-[#f2eee6]">{requirement.label}</p>
                    <span
                      className="tnum font-mono text-[11px] uppercase tracking-[0.14em]"
                      style={{ color: met ? alpha(RESERVE.green, 0.9) : "rgba(255,255,255,0.55)" }}
                    >
                      {met && <Check size={11} className="mr-1 inline align-[-1px]" aria-hidden="true" />}
                      {progressLabel(requirement)}
                    </span>
                  </div>

                  {/* A real ratio of the member's own count. Never a fabricated meter. */}
                  <div
                    className="mt-2 h-[3px] w-full max-w-[280px] overflow-hidden rounded-full bg-white/[0.07]"
                    role="progressbar"
                    aria-label={`${requirement.label}: ${progressLabel(requirement)}`}
                    aria-valuemin={0}
                    aria-valuemax={requirement.need}
                    aria-valuenow={Math.min(requirement.have, requirement.need)}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(fraction * 100)}%`,
                        background: met ? alpha(RESERVE.green, 0.7) : alpha(accent, 0.7),
                      }}
                    />
                  </div>

                  <p className="mt-2 max-w-[64ch] text-[12.5px] leading-[1.55] text-white/55">{requirement.detail}</p>
                </div>

                <ReserveButton tier="quiet" size="sm" onClick={() => onOpen(requirement.view as DashboardView)}>
                  {requirement.action}
                </ReserveButton>
              </div>
            </RecordRow>
          );
        })}
      </RecordList>
    </GlassPanel>
  );
}
