"use client";

import { ReserveDisclosure } from "@/components/ui/reserve";
import { RESERVE } from "@/lib/design/tokens";
import { CARE_OPTIONS } from "@/lib/safety/care-options";

/**
 * Who can review a result, symptom or plan — with or without a regular
 * clinician. Most urgent first. Reserve names people, never treatments.
 */
export function CareOptions({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <ReserveDisclosure summary="No clinician? Who can review this" accent={RESERVE.steel} defaultOpen={defaultOpen}>
      <ul className="flex flex-col gap-2.5" aria-label="Who can review this">
        {CARE_OPTIONS.map((option) => (
          <li key={option.key}>
            <p className="text-[13px] font-semibold" style={{ color: option.key === "emergency" ? RESERVE.red : RESERVE.ivory }}>{option.title}</p>
            <p className="mt-0.5 text-[12.5px] leading-[1.5] text-white/60">{option.forWhat}</p>
          </li>
        ))}
      </ul>
    </ReserveDisclosure>
  );
}
