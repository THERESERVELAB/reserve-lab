"use client";

/* CLIENT ALERTS — derived from clients' own entries, most severe first.
   The gold action is the top alert's own action; every row keeps its action
   and "Reviewed", with the rarer dispositions one tap further in. */

import { useCoachingStore } from "@/lib/coaching/store";
import type { ClientAlert } from "@/lib/coaching/types";
import { resolveAlertsBrief } from "@/lib/coaching/workspace-brief";
import { useCoachDecisionInput, useRunCoachAction } from "./coach-actions";
import {
  CoachHero,
  CoachPage,
  CoachSection,
  CommandButton,
  EmptyState,
  RowList,
  SEVERITY_LABELS,
  SEVERITY_TONE,
  StatusChip,
  relativeTime,
} from "./ui";

const SEVERITY_RANK: Record<ClientAlert["severity"], number> = { urgent: 0, priority: 1, attention: 2, info: 3 };

export function AlertsView() {
  const alerts = useCoachingStore((s) => s.alerts);
  const clients = useCoachingStore((s) => s.clients);
  const input = useCoachDecisionInput();
  const run = useRunCoachAction();

  const sorted = [...alerts].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const open = sorted.filter((a) => a.status === "open");
  const closed = sorted.filter((a) => a.status !== "open");
  const brief = resolveAlertsBrief(input, closed.length);
  const nameOf = (athleteId: string) => clients.find((c) => c.athleteId === athleteId)?.name ?? null;

  return (
    <CoachPage screen="alerts">
      <CoachHero
        title="Alerts"
        brief={brief}
        reads={[
          { label: "Open", value: String(open.length) },
          { label: "Handled", value: String(closed.length) },
        ]}
        onPrimary={() => brief.primary && run(brief.primary)}
      />

      <CoachSection label={`Open · ${open.length}`}>
        {open.length === 0 ? (
          <EmptyState
            title="No open alerts"
            body={clients.length === 0 ? "Alerts come from connected clients' own entries." : "Nothing in your clients' entries is flagged."}
          />
        ) : (
          <RowList label="Open alerts">
            {open.map((alert) => (
              <AlertRow key={alert.id} alert={alert} clientName={nameOf(alert.athleteId)} onAct={() => run({ kind: "alert-action", label: alert.recommendedAction.label, alertId: alert.id })} />
            ))}
          </RowList>
        )}
      </CoachSection>

      {closed.length > 0 && (
        <CoachSection label={`Handled · ${closed.length}`}>
          <RowList label="Handled alerts">
            {closed.map((alert) => (
              <AlertRow key={alert.id} alert={alert} clientName={nameOf(alert.athleteId)} onAct={() => run({ kind: "alert-action", label: alert.recommendedAction.label, alertId: alert.id })} />
            ))}
          </RowList>
        </CoachSection>
      )}
    </CoachPage>
  );
}

function AlertRow({ alert, clientName, onAct }: { alert: ClientAlert; clientName: string | null; onAct: () => void }) {
  const setAlertState = useCoachingStore((s) => s.setAlertState);
  const isOpen = alert.status === "open";
  return (
    <li className={`flex flex-col gap-2.5 py-3 lg:flex-row lg:items-center lg:justify-between ${isOpen ? "" : "opacity-70"}`}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <StatusChip tone={SEVERITY_TONE[alert.severity]}>{SEVERITY_LABELS[alert.severity]}</StatusChip>
          {!isOpen && <StatusChip tone="neutral">{alert.status}</StatusChip>}
          <span className="tnum font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">{relativeTime(alert.createdAt)}</span>
        </p>
        <p className="mt-1.5 text-[13px] font-semibold text-[#f2eee6]">{alert.headline}</p>
        {alert.evidence.length > 0 && (
          <p className="mt-0.5 text-[12px] leading-[1.45] text-white/60">
            {alert.evidence.slice(0, 2).join(" · ")}
            {alert.evidence.length > 2 ? ` · ${alert.evidence.length - 2} more` : ""}
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
        <CommandButton onClick={onAct} ariaLabel={clientName ? `${alert.recommendedAction.label} for ${clientName}` : undefined}>
          {alert.recommendedAction.label}
        </CommandButton>
        {isOpen ? (
          <>
            <CommandButton variant="ghost" onClick={() => setAlertState(alert.id, "reviewed")}>Reviewed</CommandButton>
            <details className="group relative">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center rounded-[10px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/60 hover:text-white/90 md:min-h-[40px]">
                More
                <span className="sr-only"> actions for {alert.headline}</span>
              </summary>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <CommandButton variant="ghost" onClick={() => setAlertState(alert.id, "snoozed")}>Snooze</CommandButton>
                <CommandButton variant="ghost" onClick={() => setAlertState(alert.id, "resolved")}>Resolve</CommandButton>
                <CommandButton variant="ghost" onClick={() => setAlertState(alert.id, "dismissed")}>Dismiss</CommandButton>
              </div>
            </details>
          </>
        ) : (
          <CommandButton variant="ghost" onClick={() => setAlertState(alert.id, "open")}>Reopen</CommandButton>
        )}
      </div>
    </li>
  );
}
