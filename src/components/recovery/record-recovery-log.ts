"use client";

import { recordLogMoment } from "@/components/ui/reserve/log-moment/log-moment-store";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { resolveRecoveryMoment } from "@/lib/log-moments/recovery";
import type { RecoveryLogKind } from "@/lib/recovery/log-rank";
import { localDateKey } from "@/lib/recovery/types";

/* ════════════════════════════════════════════════════════════════════════
   RECORD RECOVERY LOG — every recovery logging control goes through here.

   The write runs first and untouched. Then the before/after of the member's
   recovery record becomes a log moment (src/lib/log-moments/recovery.ts),
   played by the shell's one LogMomentHost: sleep lands in full, a glass of
   water or a mobility item is a quiet mark, and reaching the member's own
   target, a streak mark or a recovery-record rank lands in full with its
   headline. The rank is earned by days logged, never by what the numbers
   say, and a missed day is never mentioned.
   ════════════════════════════════════════════════════════════════════════ */

export function recordRecoveryLog(kind: RecoveryLogKind, write: () => void): void {
  recordLogMoment({
    read: () => useAthleteDashboardStore.getState().recoveryCommand,
    write,
    resolve: (before, after) => {
      const moment = resolveRecoveryMoment(kind, before, after, localDateKey());
      return moment ? { ...moment, key: `recovery:${kind}` } : null;
    },
  });
}
