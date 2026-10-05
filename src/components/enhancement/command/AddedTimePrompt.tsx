"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { ReserveButton } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";

import { GiveItATimeFields } from "./GiveItATimeFields";

/* ════════════════════════════════════════════════════════════════════════
   ASKED THE MOMENT IT'S ADDED — a supplement the member just chose is in
   their log, but an untimed entry never lands on a day. So the question
   comes here, where they are, instead of waiting to be found later.

   Answering is optional: "Not now" leaves it exactly as the library left
   it. Reserve never picks the time, and never sets an amount.
   ════════════════════════════════════════════════════════════════════════ */

export function AddedTimePrompt({ entryId, name, onDone }: { entryId: string; name: string; onDone: () => void }) {
  const updateEnhancementEntry = useAthleteDashboardStore((s) => s.updateEnhancementEntry);
  const [saved, setSaved] = useState<string | null>(null);

  return (
    <section
      aria-label={`When you take ${name}`}
      className="flex flex-col gap-2.5 rounded-[14px] px-3.5 py-3"
      style={{ background: alpha(RESERVE.steel, 0.07), boxShadow: `inset 0 0 0 1px ${alpha(RESERVE.steel, 0.22)}` }}
    >
      {saved ? (
        <>
          <p role="status" className="flex items-start gap-1.5 text-[13px] leading-[1.5]" style={{ color: RESERVE.ivory }}>
            <Check size={14} aria-hidden="true" style={{ color: RESERVE.green, marginTop: 2, flexShrink: 0 }} />
            <span>
              {name} is in your day, {saved}. It repeats daily until you change it.
            </span>
          </p>
          <div>
            <ReserveButton tier="quiet" size="sm" onClick={onDone}>Done</ReserveButton>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] leading-[1.5]" style={{ color: RESERVE.ivory }}>
            It&apos;s in your log. When do you take it?
          </p>
          <GiveItATimeFields
            resetKey={entryId}
            secondary={<ReserveButton tier="quiet" size="sm" onClick={onDone}>Not now</ReserveButton>}
            onSubmit={(patch, label) => {
              updateEnhancementEntry(entryId, patch);
              setSaved(label);
            }}
          />
          <p className="text-[11.5px] leading-[1.5] text-white/45">
            Not now keeps it in your log — you can set a time in Compound Command whenever you like.
          </p>
        </>
      )}
    </section>
  );
}
