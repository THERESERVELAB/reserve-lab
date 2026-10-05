"use client";

import { ArrowRight, Phone } from "lucide-react";
import React from "react";

import { ReserveButton } from "@/components/ui/reserve";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { CLINICAL_COPY } from "@/lib/records/clinical-records";

/* ════════════════════════════════════════════════════════════════════════
   CLINICAL ROWS — a whole enhanced block, said in one line.

   The cycle context, the commonly watched markers and the symptom check each
   used to be a panel of their own. Here each is one hairline row inside the
   screen's single panel: a whisper label, the member's own line, and one
   quiet control that opens the detail (a sheet) or the screen that holds it.

   Nothing here draws a box, so a row never becomes a card inside a card.
   ════════════════════════════════════════════════════════════════════════ */

export function ContextRow({
  label,
  line,
  detail,
  action,
  labelColor,
  record,
  children,
}: {
  /** Whisper label: what kind of row this is. */
  label: string;
  /** The member's own line. */
  line: string;
  detail?: React.ReactNode;
  /** One quiet control. `link` rows navigate and carry an arrow. */
  action?: { label: string; onClick: () => void; link?: boolean; /** Read after the label by screen readers: "Check" → "Check warning signs". */ srSuffix?: string };
  labelColor?: string;
  /** Becomes `data-record`, so another screen or a spec can find the row. */
  record?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="py-3 first:pt-0 last:pb-0" data-record={record}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0 flex-1 basis-[240px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: labelColor ?? "rgba(255,255,255,0.55)" }}>
            {label}
          </p>
          <p className="tnum mt-1 text-[14px] font-semibold leading-snug text-[#f2eee6] [text-wrap:pretty]">{line}</p>
          {detail && <div className="tnum mt-1 max-w-[72ch] text-[12.5px] leading-[1.5] text-white/60">{detail}</div>}
        </div>
        {action && (
          /* Quiet buttons carry side padding for their 44px target; on phones
             the label lines up with the text above. */
          <div className="-ml-3 shrink-0 sm:ml-0">
            <ReserveButton
              tier="quiet"
              size="sm"
              accent={RESERVE.steel}
              iconAfter={action.link ? ArrowRight : undefined}
              onClick={action.onClick}
            >
              {action.label}
              {action.srSuffix && <span className="sr-only"> {action.srSuffix}</span>}
            </ReserveButton>
          </div>
        )}
      </div>
      {children}
    </li>
  );
}

/**
 * 911 and 988 as real tap-to-call links. Never behind a disclosure: this line
 * stays on screen wherever a warning sign or a critical lab can appear.
 */
export function EmergencyLine({ className = "" }: { className?: string }) {
  return (
    <div
      role="group"
      aria-label={CLINICAL_COPY.contactsLabel}
      data-record="emergency-line"
      className={`flex flex-wrap items-center gap-x-5 ${className}`}
    >
      <a
        href="tel:911"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] font-semibold text-white/75 underline-offset-4 hover:underline"
      >
        <Phone size={12} aria-hidden="true" style={{ color: alpha(RESERVE.red, 0.85) }} />
        {CLINICAL_COPY.emergency}
      </a>
      <a
        href="tel:988"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] font-semibold text-white/75 underline-offset-4 hover:underline"
      >
        <Phone size={12} aria-hidden="true" style={{ color: alpha(RESERVE.red, 0.85) }} />
        {CLINICAL_COPY.crisis}
      </a>
    </div>
  );
}
