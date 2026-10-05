"use client";

/* ════════════════════════════════════════════════════════════════════════
   OPERATIONS HUB — Performance Operations inside Client Command.

   One destination, six sections: the executive Command surface first,
   then Protocols, Fuel, Lifestyle, Directive, and the consent-gated
   Clinical area — kept deliberately last and visually separated.
   ════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";

import type { OperationsSectionId } from "@/lib/coaching/operations/overview";
import type { CoachingRelationship } from "@/lib/coaching/types";
import { ClinicalPanel } from "./ClinicalPanel";
import { DirectivePanel } from "./DirectivePanel";
import { FuelOpsPanel } from "./FuelOpsPanel";
import { LifestylePanel } from "./LifestylePanel";
import { OperationsOverview } from "./OperationsOverview";
import { ProtocolsPanel } from "./ProtocolsPanel";

const SECTIONS: Array<{ id: OperationsSectionId; label: string }> = [
  { id: "command", label: "Command" },
  { id: "protocols", label: "Protocols" },
  { id: "fuel", label: "Fuel" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "directive", label: "Directive" },
  { id: "clinical", label: "Clinical" },
];

export function OperationsHub({
  athleteId,
  athleteName,
  phaseLabel,
  relationship,
}: {
  athleteId: string;
  athleteName: string;
  phaseLabel: string;
  relationship: CoachingRelationship | null;
}) {
  const [section, setSection] = useState<OperationsSectionId>("command");

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Performance Operations sections" className="flex flex-wrap items-center gap-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-current={section === s.id ? "true" : undefined}
            onClick={() => setSection(s.id)}
            className={`rounded-full px-3.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#d5b15f]/40 ${
              section === s.id
                ? "border border-[#d5b15f]/35 bg-[#d5b15f]/12 text-[#d5b15f]"
                : s.id === "clinical"
                  ? "border border-white/[0.07] text-white/35 hover:text-white/60"
                  : "border border-transparent text-white/40 hover:bg-white/[0.04] hover:text-white/70"
            } ${s.id === "clinical" ? "ml-auto" : ""}`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {section === "command" && (
        <OperationsOverview
          athleteId={athleteId}
          athleteName={athleteName}
          phaseLabel={phaseLabel}
          onNavigate={setSection}
        />
      )}
      {section === "protocols" && <ProtocolsPanel athleteId={athleteId} relationship={relationship} />}
      {section === "fuel" && <FuelOpsPanel athleteId={athleteId} relationship={relationship} />}
      {section === "lifestyle" && <LifestylePanel athleteId={athleteId} relationship={relationship} />}
      {section === "directive" && <DirectivePanel athleteId={athleteId} relationship={relationship} />}
      {section === "clinical" && <ClinicalPanel athleteId={athleteId} relationship={relationship} />}
    </div>
  );
}
