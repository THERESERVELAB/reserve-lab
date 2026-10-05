"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { ReserveBottomSheet, ReserveButton } from "@/components/ui/reserve";
import { RESERVE, alpha } from "@/lib/design/tokens";
import type { TodaySlot } from "@/components/enhancement/command/TodayDay";

/* ════════════════════════════════════════════════════════════════════════
   LOG THE ADD-ONS, IN ONE GO — the owner, 2026-09-24: "a fast action button
   to log the add-ons all at once. Or the ability to remove one from the all
   selected."

   Everything still waiting on today is ticked when the sheet opens. The
   member unticks whatever they did not take, and one action records the
   rest. Nothing is logged until they press it: the sheet never marks a dose
   on the member's behalf.
   ════════════════════════════════════════════════════════════════════════ */

export type AddOnToLog = { id: string; name: string; time: string; slot: TodaySlot };

export function LogAddOnsSheet({
  open,
  items,
  onClose,
  onLog,
}: {
  open: boolean;
  /** Today's add-ons that are not logged yet. */
  items: AddOnToLog[];
  onClose: () => void;
  onLog: (slots: TodaySlot[]) => void;
}) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  /* Every time the sheet opens, everything waiting starts ticked again. Derived
     during render rather than in an effect, so the first paint is already right. */
  const [openedFor, setOpenedFor] = useState(open);
  if (openedFor !== open) {
    setOpenedFor(open);
    if (open) setExcluded(new Set());
  }

  const chosen = items.filter((item) => !excluded.has(item.id));
  const toggle = (id: string) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ReserveBottomSheet open={open} onClose={onClose} title="Log add-ons" accent={RESERVE.green}>
      <div className="flex flex-col gap-4" data-log-add-ons>
        <p className="text-[12.5px] leading-[1.55] text-white/60">
          Everything still waiting on today is ticked. Untick anything you did not take, then log the rest.
        </p>

        <ul className="flex flex-col divide-y divide-white/[0.05]">
          {items.map((item) => {
            const on = !excluded.has(item.id);
            return (
              <li key={item.id}>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 py-1 text-[13px]">
                  <input type="checkbox" checked={on} onChange={() => toggle(item.id)} className="h-4 w-4 accent-[#6ee7b7]" />
                  <span className={on ? "" : "text-white/40 line-through"} style={on ? { color: RESERVE.ivory } : undefined}>{item.name}</span>
                  <span className="ml-auto shrink-0 text-[11.5px] text-white/45">{item.time}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          {chosen.length === 0 ? (
            <ReserveButton tier="primary" disabled disabledReason="Tick at least one add-on to log.">
              Log add-ons
            </ReserveButton>
          ) : (
            <ReserveButton
              tier="primary"
              icon={CheckCircle2}
              onClick={() => {
                onLog(chosen.map((item) => item.slot));
                onClose();
              }}
            >
              Log {chosen.length} add-on{chosen.length === 1 ? "" : "s"}
            </ReserveButton>
          )}
          <ReserveButton tier="quiet" onClick={onClose}>Cancel</ReserveButton>
        </div>

        <p className="text-[11.5px] leading-[1.5]" style={{ color: alpha(RESERVE.ivory, 0.45) }}>
          Each one is recorded at its own planned time, exactly as logging it from its own marker would.
        </p>
      </div>
    </ReserveBottomSheet>
  );
}
