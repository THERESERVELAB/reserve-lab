"use client";

import { useEffect, useState } from "react";

import { FIXED_NOON } from "@/components/apex/model/apex-format";

/* ════════════════════════════════════════════════════════════════════════
   RECOVERY CLOCK — the one clock the Recovery screen reads.

   The server render and the first client render both see `null`, and the
   engines read the same fixed reference Apex uses, so the two renders match.
   The real clock arrives after mount and then ticks on the wall-clock minute.
   Nothing on the screen moves faster than that.
   ════════════════════════════════════════════════════════════════════════ */

/** Server-render reference for the engines, replaced by the real clock after mount. */
export const RECOVERY_REFERENCE_CLOCK = FIXED_NOON;

export function useRecoveryClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    /* setTimeout, not rAF: rAF suspends in background and headless tabs and
       would leave the screen on the reference clock. */
    const boot = setTimeout(() => setNow(new Date()), 0);
    let interval: ReturnType<typeof setInterval> | null = null;
    const current = new Date();
    const msToNextMinute = (60 - current.getSeconds()) * 1000 - current.getMilliseconds() + 50;
    const align = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, Math.max(250, msToNextMinute));
    return () => {
      clearTimeout(boot);
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, []);

  return now;
}
