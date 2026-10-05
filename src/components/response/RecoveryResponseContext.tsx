"use client";

import { AlertTriangle, Moon } from "lucide-react";

import { useResponseSurfaceResolution } from "@/lib/hooks/useResponseSurfaceResolution";
import { presentRecoveryResponse } from "@/lib/response-model/surfaces";

export function RecoveryResponseContext() {
  const resolution = useResponseSurfaceResolution({
    domains: ["recovery", "conditioning", "volume", "pain"],
    recoveryContexts: ["session-spacing", "conditioning-proximity", "sleep", "local-fatigue", "systemic-demand", "pain"],
  });
  const view = presentRecoveryResponse(resolution);

  return (
    <section
      data-testid="recovery-response-context"
      data-model-version={resolution.modelVersion}
      data-insight-id={view?.insightId ?? ""}
      /* A leading accent rail, not a second card: this sits inside Recovery's
         own panel, and a bordered rounded box here is card-in-card
         (constitution components.md rule 1). */
      className="border-l-2 border-[#6ee7b7]/40 bg-[#6ee7b7]/[0.035] py-3.5 pl-4 pr-3.5 sm:pr-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {view?.label === "Professional review" ? <AlertTriangle size={13} className="text-[#ef7d55]" /> : <Moon size={13} className="text-[#6ee7b7]" />}
          <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#6ee7b7]/70">{view?.label ?? "Response context"}</p>
        </div>
        <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-white/30">{view?.confidence ?? "insufficient"}</span>
      </div>
      {view ? (
        <div className="mt-2.5">
          <p className="text-[11px] leading-[1.6] text-white/70">{view.observed}</p>
          <p className="mt-1.5 text-[10.5px] leading-[1.55] text-white/45">{view.meaning}</p>
        </div>
      ) : (
        <div className="mt-2.5">
          <p className="text-[11px] leading-[1.6] text-white/58">No repeated recovery-response pattern is eligible to display yet.</p>
          <p className="mt-1 text-[10px] leading-[1.5] text-white/35">{resolution.missingData[0] ?? "Reserve needs comparable recorded sessions before making a claim."}</p>
        </div>
      )}
    </section>
  );
}
