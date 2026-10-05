"use client";

import { Moon } from "lucide-react";

import { SleepLoggerCard } from "@/components/recovery/SleepLoggerCard";
import { RECOVERY_SLEEP_LOG_ID } from "@/components/recovery/sleep-log-anchor";
import { EnhancedRoomContext } from "@/components/enhanced/EnhancedRoomContext";
import { RecoveryResponseContext } from "@/components/response/RecoveryResponseContext";
import { RecoveryPhasePanels } from "@/components/women/phase-panels";
import { RESERVE } from "@/lib/design/tokens";
import { HorizonRecoveryDemandPanel } from "./recovery/HorizonRecoveryDemandPanel";
import { MobilityCommand } from "./recovery/MobilityCommand";
import { RecoveryCommandV2 } from "./recovery/RecoveryCommandV2";
import { ViewShell } from "./ViewShell";

/**
 * Recovery Command deliberately renders only two evidence classes:
 *   1. demand derived from the active Program Horizon, and
 *   2. member-entered lifestyle/recovery logs.
 *
 * The previous static HRV/readiness/recovery-score showcase was removed from
 * the live member surface because those values were not connected evidence.
 *
 * ── Page order (minimal, owner direction 2026-09-19) ─────────────────────
 * The hero, one row of readouts, one Log section (sleep and water), and
 * everything else behind a single "Recovery detail" disclosure.
 *
 * ── Earlier page order (the Pit Wall treatment) ─────────────────────────
 * The hero leads: the Reserve dial, the one gold action, and tonight's
 * horizon toward sleep lock. It sits inside the first screen at 1440×1000
 * and 390×844. Program Horizon demand used to open the page and pushed the
 * action below the fold on phones; it is still the first thing under the
 * hero, now in a supporting position. Then the command sections, then the
 * logging layer (what you record), with mobility behind disclosure — it is a
 * planned action, not a status the member opens the screen to read.
 *
 * The accent is violet. Green is the FUEL lead in the Bible's destination
 * table (§09); recovery and sleep lead steel→violet.
 */
export function RecoveryView() {
  return (
    <ViewShell
      label="Recovery"
      title="Recovery Command"
      icon={Moon}
      accentColor={RESERVE.violet}
      roomHero
      command="What your current block is asking of you, and what you have logged against it."
      disclaimer="Recovery Command tracks lifestyle, behavior, adherence, and Program Horizon demand only. It does not diagnose, treat, or fabricate health metrics. Review health concerns with a qualified clinician."
    >
      <RecoveryCommandV2
        /* The member's own cycle, symptoms and the symptom-check route — only when they logged a cycle or compound. */
        afterHero={<EnhancedRoomContext room="recovery" />}
        sleepLog={
          /* The hero's "Log Last Night's Sleep" brings this into view and focuses its first field. */
          <div id={RECOVERY_SLEEP_LOG_ID} tabIndex={-1} className="scroll-mt-4 rounded-[22px] outline-none">
            <SleepLoggerCard detail />
          </div>
        }
        detail={
          <>
            <HorizonRecoveryDemandPanel />
            <RecoveryResponseContext />
            {/* Her own sleep and energy, sorted by estimated phase. Renders
                nothing without a logged period start. Replaces the separate
                Women's Recovery room. */}
            <RecoveryPhasePanels />
            <MobilityCommand />
          </>
        }
      />
    </ViewShell>
  );
}
