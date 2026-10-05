"use client";

import { ArrowRight } from "lucide-react";

import { ReserveBottomSheet, ReserveButton } from "@/components/ui/reserve";
import type { DashboardView } from "@/lib/athlete-store";

/**
 * The day's edits, in one place. Each row says exactly where it goes — there
 * is no "rebuild" button that quietly opens the same screen as another.
 */
export function AdjustTodaySheet({
  open,
  onClose,
  flexNotice,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  flexNotice: string | null;
  onNavigate: (view: DashboardView) => void;
}) {
  const go = (view: DashboardView) => {
    onNavigate(view);
    onClose();
  };

  return (
    <ReserveBottomSheet open={open} onClose={onClose} title="Adjust Today">
      {flexNotice && <p className="mb-4 text-[13px] leading-[1.55] text-white/60">{flexNotice}</p>}
      <div className="flex flex-col gap-2.5">
        <ReserveButton tier="secondary" size="md" fullWidth iconAfter={ArrowRight} onClick={() => go("training")}>
          Reschedule or skip today&apos;s session
        </ReserveButton>
        <ReserveButton tier="secondary" size="md" fullWidth iconAfter={ArrowRight} onClick={() => go("schedule-command")}>
          Adjust your schedule
        </ReserveButton>
        <ReserveButton tier="secondary" size="md" fullWidth iconAfter={ArrowRight} onClick={() => go("settings")}>
          Update your profile
        </ReserveButton>
      </div>
    </ReserveBottomSheet>
  );
}
