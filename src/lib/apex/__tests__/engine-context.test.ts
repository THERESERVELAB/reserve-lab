import { describe, expect, it } from "vitest";

import { buildStrategistBriefing, type StrategistContext } from "@/lib/ai-strategist/engine";
import { DEFAULT_PHYSIQUE_COMMAND } from "@/lib/physique/types";
import { DEFAULT_RECOVERY_COMMAND } from "@/lib/recovery/types";
import { DEFAULT_SCHEDULE_PROFILE } from "@/lib/schedule/types";
import { DEFAULT_WOMENS_STATE } from "@/lib/women/types";
import { buildApexView } from "../engine";

/** Tuesday 15 September 2026, 5:45 PM — inside the 5:30–7:00 PM training window. */
const NOW = new Date(2026, 8, 15, 17, 45);

const MOVED_AWAY = { trainingPlanned: false, direction: "moved-away" } as const;

/** A member on the store's default slices (athlete-store initial state), training 5:30–7:00 PM. */
function context(over: Partial<StrategistContext> = {}): StrategistContext {
  return {
    schedule: { ...DEFAULT_SCHEDULE_PROFILE, preferredTrainingStart: "17:30", preferredTrainingEnd: "19:00" },
    recovery: DEFAULT_RECOVERY_COMMAND,
    physique: DEFAULT_PHYSIQUE_COMMAND,
    womens: DEFAULT_WOMENS_STATE,
    enhancedLogOnly: false,
    trainingSessionMode: "pre",
    now: NOW,
    ...over,
  };
}

describe("training context reaches the Apex and Strategist engines", () => {
  it("keeps today's default when no training context is passed", () => {
    expect(buildApexView(context()).nextMove.title).toBe("Start Training");
  });

  it("never stages Start Training once the session moved off today", () => {
    expect(buildApexView(context({ trainingContext: MOVED_AWAY })).nextMove.title).not.toBe("Start Training");
  });

  it("stops the strategist ranking Start Training once the session moved off today", () => {
    // The default slices carry no logs, and a data-limited briefing always ranks the
    // recovery check-in first. One sleep log (with the other logs and physique entries
    // pinned empty) reaches the schedule-driven ranking this context changes.
    const recovery = { ...DEFAULT_RECOVERY_COMMAND, sleepLogs: [{ date: "2026-09-14", hours: 8 }], hydrationLogs: [], mobilityLogs: [], stressCheckIns: [] };
    const physique = { ...DEFAULT_PHYSIQUE_COMMAND, entries: [], photoCheckIns: [] };

    expect(buildStrategistBriefing(context({ recovery, physique })).highestRoiAction.title).toBe("Start Training");
    expect(buildStrategistBriefing(context({ recovery, physique, trainingContext: MOVED_AWAY })).highestRoiAction.title).not.toBe("Start Training");
  });
});
