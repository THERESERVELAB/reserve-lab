"use client";

import { ReserveBottomSheet, ReserveButton } from "@/components/ui/reserve";
import type { TimePatch } from "@/lib/compound-command/give-it-a-time";
import { RESERVE, alpha } from "@/lib/design/tokens";

import { GiveItATimeFields } from "./GiveItATimeFields";

/* ════════════════════════════════════════════════════════════════════════
   WHEN DO YOU TAKE IT? — the one question that puts an add-on in the day.

   The member answers with one of their own anchors or a clock time. Reserve
   never offers an amount and never suggests a time: it writes down theirs.
   ════════════════════════════════════════════════════════════════════════ */

export function GiveItATimeSheet({
  open,
  name,
  onClose,
  onSave,
}: {
  open: boolean;
  name: string | null;
  onClose: () => void;
  onSave: (patch: TimePatch) => void;
}) {
  return (
    <ReserveBottomSheet open={open} onClose={onClose} title={name ? `When do you take ${name}?` : "When do you take it?"} accent={RESERVE.steel}>
      <div className="flex flex-col gap-4">
        <p className="text-[12.5px] leading-[1.55] text-white/60">
          Pick when it belongs in your day and it joins Today with everything else. You can change it whenever you like.
        </p>

        <GiveItATimeFields
          resetKey={`${open}:${name ?? ""}`}
          secondary={<ReserveButton tier="quiet" size="sm" onClick={onClose}>Cancel</ReserveButton>}
          onSubmit={(patch) => {
            onSave(patch);
            onClose();
          }}
        />

        <p className="text-[11.5px] leading-[1.5]" style={{ color: alpha(RESERVE.ivory, 0.45) }}>
          It repeats daily until you change it. Reserve never sets an amount, and never decides what you take.
        </p>
      </div>
    </ReserveBottomSheet>
  );
}
