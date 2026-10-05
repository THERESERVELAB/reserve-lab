"use client";

import { useActiveProgram } from "@/lib/hooks/useActiveProgram";
import { useAthleteDashboardStore } from "@/lib/athlete-store";

export function BottomTicker() {
  const { resolution } = useActiveProgram();
  const sessionMode = useAthleteDashboardStore((state) => state.trainingSession.sessionMode);
  const recovery = useAthleteDashboardStore((state) => state.recoveryCommand);
  const items = [
    `SESSION · ${sessionMode === "live" ? "LIVE" : sessionMode === "closed" || sessionMode === "complete" ? "CLOSED" : "STAGED"}`,
    resolution ? `ACTIVE PROGRAM · ${resolution.protocolName}` : "ACTIVE PROGRAM · NOT SELECTED",
    resolution ? `PROGRAM WEEK · W${resolution.currentWeekNumber}` : "PROGRAM WEEK · EVIDENCE NEEDED",
    resolution ? `PROGRAM PHASE · ${resolution.currentPhaseName}` : "PROGRAM PHASE · EVIDENCE NEEDED",
    recovery.sleepLogs.length > 0 ? "SLEEP · LOGGED" : "SLEEP · NOT LOGGED",
    recovery.stressCheckIns.length > 0 ? "RECOVERY CHECK-IN · LOGGED" : "RECOVERY CHECK-IN · EVIDENCE NEEDED",
    "HRV · NOT CONNECTED",
    "BLOODWORK · LOG ONLY — NO MEDICAL ADVICE",
    "COMPOUNDS · LOG ONLY — NO DOSAGE GUIDANCE",
  ];
  const trackItems = [...items, ...items];

  return (
    <div
      className="flex h-8 flex-shrink-0 items-center overflow-hidden border-t border-white/[0.06] bg-[#08090e]"
      style={{ boxShadow: "inset 0 1px 0 rgba(213,177,95,0.05)" }}
    >
      {/* LIVE badge */}
      <div className="flex flex-shrink-0 items-center gap-1.5 border-r border-white/[0.08] px-3">
        <span className="fba-pulse h-1.5 w-1.5 rounded-full bg-[#d5b15f]" />
        <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#d5b15f]/80">
          Live
        </span>
      </div>

      {/* Scrolling track with edge fades */}
      <div className="relative flex-1 overflow-hidden">
        {/* Left fade */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10"
          style={{ background: "linear-gradient(90deg, #08090e 0%, transparent 100%)" }}
        />
        {/* Right fade */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10"
          style={{ background: "linear-gradient(270deg, #08090e 0%, transparent 100%)" }}
        />

        <div className="fba-ticker-track flex whitespace-nowrap will-change-transform">
          {trackItems.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-4 px-6 font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/25"
            >
              {item}
              <span className="inline-block h-[3px] w-[3px] rounded-full bg-[#d5b15f]/25" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
