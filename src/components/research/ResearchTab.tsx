"use client";

import { Microscope } from "lucide-react";
import { useCallback, useState } from "react";

import { EscalationList } from "@/components/safety/EscalationList";
import { SafetyAcknowledgementGate } from "@/components/safety/SafetyAcknowledgementGate";
import { useClientNow } from "@/components/safety/useClientNow";
import { useSafetyContext } from "@/components/safety/useSafetyContext";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveLoading, ReserveSegmented } from "@/components/ui/reserve";
import { dateKeyOf } from "@/lib/cycle/cycle-period";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { RESEARCH_COPY } from "@/lib/research/copy";

import { BurdenMapPanel } from "./BurdenMapPanel";
import { LabResponsePanel } from "./LabResponsePanel";
import { N1ReviewPanel } from "./N1ReviewPanel";

/* ════════════════════════════════════════════════════════════════════════
   RESEARCH — the member's records side by side: Lab Response, Burden Map
   and N=1 Review. Live for every member by owner direction, behind the
   safety acknowledgement (including 18+). Open safety alerts always come
   first; Reserve places things in time and never says what caused what.
   ════════════════════════════════════════════════════════════════════════ */

export const ResearchIcon = Microscope;

type Panel = "lab-response" | "burden-map" | "n1";

export function ResearchTab() {
  const now = useClientNow();
  if (!now) return <ReserveLoading label="Loading research" />;
  return (
    <SafetyAcknowledgementGate>
      <ResearchBody now={now} />
    </SafetyAcknowledgementGate>
  );
}

function ResearchBody({ now }: { now: Date }) {
  const ctx = useSafetyContext(now);
  const [panel, setPanel] = useState<Panel>("lab-response");
  const [markerId, setMarkerId] = useState<string | null>(null);
  const history = ctx.labBrief.history;

  const openMarker = useCallback((id: string) => {
    setMarkerId(id);
    setPanel("lab-response");
  }, []);
  const hasMarker = useCallback((id: string) => (history[id]?.length ?? 0) > 0, [history]);

  return (
    <section aria-label="Research" className="grid gap-4">
      <EscalationList items={ctx.escalation} />

      <GlassPanel accent={RESERVE.steel}>
        <div className="flex flex-col gap-4">
          <div>
            <p className="type-whisper" style={{ color: alpha(RESERVE.steel, 0.9) }}>{RESEARCH_COPY.tab}</p>
            <h3 className="type-section-title mt-1.5" style={{ color: RESERVE.ivory }}>{RESEARCH_COPY.heading}</h3>
            <p className="type-supporting mt-1.5 max-w-[620px] text-[12.5px]">{RESEARCH_COPY.intro}</p>
          </div>
          <ReserveSegmented<Panel>
            label="Research panel"
            value={panel}
            onChange={setPanel}
            accent={RESERVE.steel}
            segments={[
              { value: "lab-response", label: RESEARCH_COPY.labResponse },
              { value: "burden-map", label: RESEARCH_COPY.burdenMap },
              { value: "n1", label: RESEARCH_COPY.n1Review },
            ]}
          />
        </div>
      </GlassPanel>

      {panel === "lab-response" && <LabResponsePanel labBrief={ctx.labBrief} markerId={markerId} onMarkerChange={setMarkerId} />}
      {panel === "burden-map" && <BurdenMapPanel compounds={ctx.compounds} labBrief={ctx.labBrief} today={dateKeyOf(now)} />}
      {panel === "n1" && <N1ReviewPanel onOpenMarker={openMarker} hasMarker={hasMarker} />}
    </section>
  );
}
