"use client";

import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RED_FLAGS, type RedFlagKey } from "@/lib/compound-intelligence/risk-profiles";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { escalationForSymptoms, type EscalationItem } from "@/lib/safety/escalation";

import { EscalationList } from "./EscalationList";

const ALL_FLAGS = Object.keys(RED_FLAGS) as RedFlagKey[];

/**
 * "Are you having any of these right now?" Warning signs tied to the member's
 * logged compounds come first. Answering routes straight to 911, 988 or
 * same-day care, and the report is kept for the member's clinician summary.
 */
export function RedFlagCheck({ relevant }: { relevant: RedFlagKey[] }) {
  const addRedFlagReport = useAthleteDashboardStore((s) => s.addRedFlagReport);
  const [selected, setSelected] = useState<RedFlagKey[]>([]);
  const [result, setResult] = useState<EscalationItem[] | null>(null);

  const relevantSet = useMemo(() => new Set(relevant), [relevant]);
  const ordered = useMemo(
    () => [...ALL_FLAGS.filter((flag) => relevantSet.has(flag)), ...ALL_FLAGS.filter((flag) => !relevantSet.has(flag))],
    [relevantSet],
  );

  const toggle = (flag: RedFlagKey) =>
    setSelected((current) => (current.includes(flag) ? current.filter((f) => f !== flag) : [...current, flag]));

  const submit = () => {
    addRedFlagReport(selected);
    setResult(escalationForSymptoms(selected));
  };

  return (
    <GlassPanel accent={RESERVE.steel}>
      <div className="flex flex-col gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: alpha(RESERVE.red, 0.9) }}>
            <AlertTriangle size={11} aria-hidden="true" />
            Symptom check
          </p>
          <h3 className="mt-1 text-[15px] font-bold" style={{ color: RESERVE.ivory }}>
            Are you having any of these right now?
          </h3>
          {relevant.length > 0 && (
            <p className="mt-1 text-[12px] text-white/50">Warning signs linked to compounds you logged are listed first.</p>
          )}
        </div>

        {result ? (
          <div className="flex flex-col gap-3">
            <EscalationList items={result} label="What to do now" />
            <div>
              <ReserveButton
                tier="quiet"
                size="sm"
                onClick={() => {
                  setResult(null);
                  setSelected([]);
                }}
              >
                Check again
              </ReserveButton>
            </div>
          </div>
        ) : (
          <>
            <fieldset className="grid gap-1.5 sm:grid-cols-2">
              <legend className="sr-only">Symptoms</legend>
              {ordered.map((flag) => {
                const checked = selected.includes(flag);
                return (
                  <label
                    key={flag}
                    className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2 text-[12.5px] leading-[1.35] transition-colors"
                    style={{
                      border: `1px solid ${checked ? alpha(RESERVE.red, 0.5) : "rgba(255,255,255,0.07)"}`,
                      background: checked ? alpha(RESERVE.red, 0.08) : "rgba(255,255,255,0.02)",
                      color: checked ? RESERVE.ivory : "rgba(255,255,255,0.7)",
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(flag)} className="h-4 w-4 shrink-0 accent-[#ef7d55]" />
                    <span className="min-w-0 flex-1">{RED_FLAGS[flag].label}</span>
                    {relevantSet.has(flag) && (
                      <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.14em] text-white/40">Linked</span>
                    )}
                  </label>
                );
              })}
            </fieldset>
            <div>
              {selected.length > 0 ? (
                <ReserveButton tier="danger" size="sm" onClick={submit}>
                  See what to do
                </ReserveButton>
              ) : (
                <ReserveButton tier="danger" size="sm" disabled disabledReason="Select a symptom first.">
                  See what to do
                </ReserveButton>
              )}
            </div>
          </>
        )}
      </div>
    </GlassPanel>
  );
}
