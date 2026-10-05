"use client";

/* COACH COMMAND home — one statement about the roster, the one decision
   that comes next, then the decisions waiting and the roster as rows.
   Recent activity waits behind a disclosure. */

import { ChevronRight } from "lucide-react";

import { ReserveDisclosure } from "@/components/ui/reserve";
import { useCoachingStore } from "@/lib/coaching/store";
import type { ClientAlert } from "@/lib/coaching/types";
import { clientsNeedingDecision, resolveCoachCommand } from "@/lib/coaching/workspace-brief";
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

const VISIBLE_DECISIONS = 4;

export function CoachDashboard() {
  const clients = useCoachingStore((s) => s.clients);
  const alerts = useCoachingStore((s) => s.alerts);
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const openClient = useCoachingStore((s) => s.openClient);
  const input = useCoachDecisionInput();
  const run = useRunCoachAction();
  const brief = resolveCoachCommand(input);

  const active = clients.filter((c) => c.status === "active");
  const priority = alerts.filter((a) => a.status === "open" && a.severity !== "info");
  const activity = db.activity.filter((a) => a.coachId === actorId).slice(0, 8);
  const unread = input.unreadThreads.reduce((sum, t) => sum + t.unread, 0);

  const alertAction = (alertId: string) => run({ kind: "alert-action", label: "", alertId });

  return (
    <CoachPage screen="command">
      <CoachHero
        title="Command"
        brief={brief}
        reads={[
          { label: "Active clients", value: active.length > 0 ? String(active.length) : null, empty: "None yet" },
          { label: "Need a decision", value: active.length > 0 ? String(clientsNeedingDecision(input)) : null, empty: "No clients" },
          { label: "Unread", value: active.length > 0 ? String(unread) : null, empty: "No channels" },
        ]}
        onPrimary={() => brief.primary && run(brief.primary)}
      />

      {priority.length > 0 && (
        <CoachSection label={`Needs attention · ${priority.length}`}>
          <RowList label="Alerts needing attention">
            {priority.slice(0, VISIBLE_DECISIONS).map((alert) => (
              <AlertRow key={alert.id} alert={alert} onAct={() => alertAction(alert.id)} />
            ))}
          </RowList>
          {priority.length > VISIBLE_DECISIONS && (
            <ReserveDisclosure summary={`${priority.length - VISIBLE_DECISIONS} more`}>
              <RowList label="More alerts">
                {priority.slice(VISIBLE_DECISIONS).map((alert) => (
                  <AlertRow key={alert.id} alert={alert} onAct={() => alertAction(alert.id)} />
                ))}
              </RowList>
            </ReserveDisclosure>
          )}
        </CoachSection>
      )}

      <CoachSection label="Roster">
        {active.length === 0 ? (
          <EmptyState
            title="No clients connected"
            body="Coaching starts when an athlete accepts your invitation."
            requirements={["The athlete's name and email", "The athlete approves the access you ask for"]}
          />
        ) : (
          <RowList label="Active clients">
            {active.map((client) => (
              <li key={client.relationshipId}>
                <button
                  type="button"
                  onClick={() => openClient(client.athleteId)}
                  className="group flex min-h-[56px] w-full items-center justify-between gap-3 py-2.5 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-[#f2eee6]">{client.name}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-white/60">
                      {client.phase} · Week {client.phaseWeek} of {client.phaseTotalWeeks}
                      {client.adherencePct !== null ? ` · ${client.adherencePct}% adherence` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {client.liveDayState === "conflict" && <StatusChip tone="red">Conflict</StatusChip>}
                    {client.liveDayState === "awaiting_review" && <StatusChip tone="teal">Live review</StatusChip>}
                    {client.unreadMessages > 0 && <StatusChip tone="teal">{client.unreadMessages} unread</StatusChip>}
                    <ChevronRight size={14} aria-hidden="true" className="text-white/35 transition-colors group-hover:text-[#d5b15f]" />
                  </span>
                </button>
              </li>
            ))}
          </RowList>
        )}
      </CoachSection>

      {activity.length > 0 && (
        <CoachSection label="Operations">
          <ReserveDisclosure summary={`Recent activity · ${activity.length}`}>
            <RowList label="Recent activity">
              {activity.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-[12.5px] leading-[1.45] text-white/70">{event.summary}</span>
                  <span className="tnum shrink-0 font-mono text-[10px] text-white/45">{relativeTime(event.at)}</span>
                </li>
              ))}
            </RowList>
          </ReserveDisclosure>
        </CoachSection>
      )}
    </CoachPage>
  );
}

function AlertRow({
  alert,
  onAct,
}: {
  alert: ClientAlert;
  onAct: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <StatusChip tone={SEVERITY_TONE[alert.severity]}>{SEVERITY_LABELS[alert.severity]}</StatusChip>
          <span className="tnum font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">{relativeTime(alert.createdAt)}</span>
        </div>
        <p className="mt-1.5 text-[13px] font-semibold text-[#f2eee6]">{alert.headline}</p>
        {alert.evidence[0] && <p className="mt-0.5 text-[12px] text-white/60">{alert.evidence[0]}</p>}
      </div>
      <CommandButton className="shrink-0 self-start sm:self-center" onClick={onAct}>
        {alert.recommendedAction.label}
      </CommandButton>
    </li>
  );
}
