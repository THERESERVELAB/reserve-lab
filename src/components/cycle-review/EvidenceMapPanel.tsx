"use client";

import { Library } from "lucide-react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveDisclosure } from "@/components/ui/reserve";
import type { EvidenceMap } from "@/lib/cycle-review/evidence-map";
import { RESERVE, alpha } from "@/lib/design/tokens";

const GRADE_COLOR: Record<string, string> = {
  "well-studied": RESERVE.green,
  some: RESERVE.ivory,
  limited: "rgba(242,238,230,0.6)",
  "not-shown": RESERVE.slate,
  uncertain: RESERVE.slate,
};

/**
 * What the library shows for every area the member's compounds affect, on one
 * screen. Alphabetical within an area and never ranked; the member adds what
 * they choose from the library.
 */
export function EvidenceMapPanel({ map, onBrowse }: { map: EvidenceMap; onBrowse: () => void }) {
  return (
    <GlassPanel>
      <EvidenceMapBody map={map} onBrowse={onBrowse} />
    </GlassPanel>
  );
}

/** The map without its panel, for a sheet. */
export function EvidenceMapBody({ map, onBrowse }: { map: EvidenceMap; onBrowse: () => void }) {
  return (
      <section aria-label="Evidence for your cycle" className="flex flex-col gap-4">
        <div>
          <p className="type-whisper" style={{ color: alpha(RESERVE.green, 0.9) }}>Evidence for your cycle</p>
          <h3 className="type-section-title mt-1.5" style={{ color: RESERVE.ivory }}>What the evidence shows, area by area</h3>
          <p className="type-supporting mt-1.5 max-w-[640px] text-[12.5px]">
            For each area the compounds you logged affect: the supplements in Reserve&apos;s library, alphabetical, with their evidence grade. None has been studied in people using anabolic steroids. You choose what to add.
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-white/[0.05]">
          {map.areas.map((area) => (
            <li key={area.area} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:gap-4">
              <div className="shrink-0 sm:w-[170px]">
                <p className="text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>{area.label}</p>
                {area.compoundNames.length > 0 && <p className="mt-0.5 text-[11px] leading-[1.4] text-white/40">{area.compoundNames.join(", ")}</p>}
              </div>
              <div className="min-w-0 flex-1">
                <ul className="flex flex-col gap-1">
                  {area.options.map((option) => (
                    <li key={option.key} className="text-[12.5px] leading-[1.5]">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span style={{ color: RESERVE.ivory }}>{option.title}</span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: GRADE_COLOR[option.grade] }}>{option.gradeLabel}</span>
                      </span>
                      {option.caution && <span className="block text-[11.5px]" style={{ color: RESERVE.amber }}>{option.caution}</span>}
                    </li>
                  ))}
                </ul>
                {area.note && <p className="mt-1.5 text-[11.5px] leading-[1.5] text-white/50">{area.note}</p>}
              </div>
            </li>
          ))}
        </ul>

        {map.nothingShown.length > 0 && (
          <div className="rounded-[12px] px-3.5 py-3" style={{ background: alpha(RESERVE.slate, 0.08) }}>
            <p className="text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>
              Nothing has been shown to help: {map.nothingShown.map((a) => a.label.toLowerCase()).join(", ")}
            </p>
            <p className="mt-1 text-[12px] leading-[1.5] text-white/55">For these, the protection is monitoring and care: your own labs, and a clinician, telehealth visit or urgent care when something changes.</p>
          </div>
        )}

        <div>
          <p className="type-whisper" style={{ color: alpha(RESERVE.amber, 0.9) }}>Worth knowing before you add anything</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {map.hazards.map((hazard) => (
              <li key={hazard.title} className="text-[12.5px] leading-[1.5] text-white/70">
                <span className="font-semibold" style={{ color: RESERVE.ivory }}>{hazard.title}.</span> {hazard.text}
              </li>
            ))}
          </ul>
        </div>

        <ReserveDisclosure summary="Habits with the strongest evidence aren't supplements" accent={RESERVE.green}>
          <ul className="flex flex-col gap-1.5">
            {map.habits.map((habit) => (
              <li key={habit} className="text-[12.5px] leading-[1.5] text-white/70">{habit}</li>
            ))}
          </ul>
        </ReserveDisclosure>

        <div>
          <ReserveButton tier="secondary" size="sm" icon={Library} onClick={onBrowse}>
            Browse and add supplements
          </ReserveButton>
        </div>
      </section>
  );
}
