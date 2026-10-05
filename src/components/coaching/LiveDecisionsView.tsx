"use client";

/* LIVE DECISIONS — every client's day on one screen. Conflicts and changes
   waiting on the coach open first; days on plan stay folded. */

import { useCallback, useEffect, useMemo, useState } from "react";

import { ReserveDisclosure } from "@/components/ui/reserve";
import { useCoachingStore } from "@/lib/coaching/store";
import { resolveLiveBrief } from "@/lib/coaching/workspace-brief";
import { clearCoachIntent, focusCoachTarget, peekCoachIntent, useCoachDecisionInput } from "./coach-actions";
import { CoachOverridePanel } from "./CoachOverridePanel";
import { ConflictResolver, LiveDayEventLog, OriginalLiveToggle, OverrideDetails } from "./LiveDayShared";
import { CoachHero, CoachPage, CoachSection, CommandButton, EmptyState, StatusChip, dayLabel } from "./ui";

export function LiveDecisionsView() {
  const db = useCoachingStore((s) => s.db);
  const allClients = useCoachingStore((s) => s.clients);
  const clients = useMemo(() => allClients.filter((c) => c.status === "active"), [allClients]);
  const openClient = useCoachingStore((s) => s.openClient);
  const input = useCoachDecisionInput();
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const closeOverride = useCallback(() => setOverrideFor(null), []);

  useEffect(() => {
    const target = peekCoachIntent("live");
    if (target) focusCoachTarget(`live-${target.athleteId}`, "button");
    clearCoachIntent("live");
  }, []);

  const rank = (s: string | undefined) => (s === "conflict" ? 0 : s === "awaiting_approval" ? 1 : s === "original" ? 3 : s ? 2 : 4);
  const rows = clients
    .map((client) => {
      const day = db.activeDayPlans
        .filter((p) => p.athleteId === client.athleteId)
        .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
      const overrides = day
        ? db.liveDayOverrides.filter((o) => o.athleteId === client.athleteId && o.date === day.date)
        : [];
      return { client, day, overrides };
    })
    .sort((a, b) => rank(a.day?.status) - rank(b.day?.status));

  const withDay = rows.filter((r) => r.day).length;
  const brief = resolveLiveBrief(input, withDay);

  return (
    <CoachPage screen="live">
      <CoachHero
        title="Live Decisions"
        brief={brief}
        reads={[
          { label: "Waiting", value: String(input.liveDecisions.length) },
          { label: "Live days", value: String(withDay) },
        ]}
        onPrimary={() => {
          const action = brief.primary;
          if (action && (action.kind === "resolve-conflict" || action.kind === "review-live-change")) {
            focusCoachTarget(`live-${action.athleteId}`, "button");
          }
        }}
      />

      <CoachSection label="Today">
        {rows.length === 0 ? (
          <EmptyState
            title="No live days"
            body="A live day starts when a connected client opens their day."
            requirements={["An active client", "The client opens today in Reserve"]}
          />
        ) : (
          <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-white/[0.06]">
            {rows.map(({ client, day, overrides }) => {
              const pending = overrides.find((o) => o.id === day?.activeOverrideId && o.status === "proposed") ?? null;
              return (
                <li key={client.athleteId} id={`live-${client.athleteId}`} tabIndex={-1} className="scroll-mt-24 py-4 outline-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-semibold text-[#f2eee6]">{client.name}</h3>
                      <p className="tnum text-[12px] text-white/55">{day ? dayLabel(day.date, { weekday: "short", month: "short", day: "numeric" }) : "No live day yet"}</p>
                    </div>
                    <LiveStatus status={day?.status ?? null} />
                  </div>

                  {day && (
                    <div className="mt-3">
                      {day.status === "conflict" ? (
                        <ConflictResolver day={day} overrides={overrides} />
                      ) : pending ? (
                        <OverrideDetails override={pending} viewer="coach" />
                      ) : (
                        <ReserveDisclosure summary="Today's plan">
                          <OriginalLiveToggle day={day} />
                        </ReserveDisclosure>
                      )}
                      <LiveDayEventLog athleteId={client.athleteId} date={day.date} collapsed />
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <CommandButton variant="ghost" onClick={() => openClient(client.athleteId)}>
                      Open {client.name.split(" ")[0]}
                    </CommandButton>
                    {day && (
                      <CommandButton variant="teal" onClick={() => setOverrideFor(client.athleteId)}>
                        Adjust today
                      </CommandButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CoachSection>

      {overrideFor && <CoachOverridePanel athleteId={overrideFor} onClose={closeOverride} />}
    </CoachPage>
  );
}

export function LiveStatus({ status }: { status: string | null }) {
  if (status === "awaiting_approval") return <StatusChip tone="teal">Awaiting review</StatusChip>;
  if (status === "conflict") return <StatusChip tone="red">Conflict</StatusChip>;
  if (status === "adapted") return <StatusChip tone="teal">Adapted</StatusChip>;
  if (status === "coach_override") return <StatusChip tone="champagne">Coach adjusted</StatusChip>;
  if (status === "original") return <StatusChip tone="neutral">On plan</StatusChip>;
  return <StatusChip tone="neutral">No live day</StatusChip>;
}
