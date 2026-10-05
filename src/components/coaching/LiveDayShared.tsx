"use client";

/* Shared live-day surfaces: day timelines, original/live diffing, override
   review details, conflict resolution. Used by both athlete and coach.
   Rimless rows throughout — these always sit inside a section. */

import { useMemo, useState } from "react";

import { ReserveDisclosure } from "@/components/ui/reserve";
import { diffDayPlans } from "@/lib/coaching/live-day/engine";
import { formatTime } from "@/lib/coaching/ids";
import { canManage } from "@/lib/coaching/permissions";
import { useCoachingStore } from "@/lib/coaching/store";
import type { ActiveDayPlan, DayPlanVersion, LiveDayOverride } from "@/lib/coaching/types";
import { CommandButton, DiffRow, MicroLabel, SegmentedControl, StatusChip, relativeTime } from "./ui";

/* ─── Day timeline ────────────────────────────────────────────────────── */

export function DayTimelineView({ plan, compact = false }: { plan: DayPlanVersion; compact?: boolean }) {
  return (
    <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-white/[0.04]">
      {plan.entries.map((entry) => (
        <li key={entry.id} className={`flex items-center gap-3 ${compact ? "py-1" : "py-1.5"} ${entry.completed ? "opacity-55" : ""}`}>
          <span className="tnum w-[70px] flex-shrink-0 font-mono text-[11px] text-white/60">{formatTime(entry.time)}</span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-white/75">{entry.label}</span>
          {entry.completed && <StatusChip tone="green">Done</StatusChip>}
          {entry.detail && !entry.completed && <span className="hidden text-[11px] text-white/50 sm:block">{entry.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ─── Original / Live toggle ──────────────────────────────────────────── */

export function OriginalLiveToggle({ day }: { day: ActiveDayPlan }) {
  const adapted = day.liveVersion.id !== day.originalVersion.id;
  const [mode, setMode] = useState<"live" | "original">(adapted ? "live" : "original");
  const changes = diffDayPlans(day.originalVersion, day.liveVersion);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label="Which version of today"
          options={[
            { value: "original", label: "Original" },
            { value: "live", label: "Live" },
          ]}
          value={mode}
          onChange={setMode}
        />
        <MicroLabel>
          Updated {relativeTime(day.lastUpdatedAt)} by {day.lastUpdatedBy}
        </MicroLabel>
      </div>
      <DayTimelineView plan={mode === "live" ? day.liveVersion : day.originalVersion} />
      {adapted && mode === "live" && changes.length > 0 && (
        <div className="flex flex-col">
          <MicroLabel className="mt-1">Changes from original</MicroLabel>
          {changes.map((change) => (
            <DiffRow
              key={`${change.label}-${change.from}`}
              label={change.label}
              from={formatMaybeTime(change.from)}
              to={formatMaybeTime(change.to)}
              removed={change.kind === "removed"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatMaybeTime(value: string): string {
  return /^\d{2}:\d{2}$/.test(value) ? formatTime(value) : value;
}

/* ─── Override details (proposal review) ──────────────────────────────── */

export function OverrideDetails({
  override,
  viewer,
  onAfterAction,
  showStatus = true,
}: {
  override: LiveDayOverride;
  viewer: "athlete" | "coach";
  onAfterAction?: () => void;
  /** False where the section around it already shows the day's status chip. */
  showStatus?: boolean;
}) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const relationship = useCoachingStore((s) =>
    s.db.relationships.find(
      (candidate) => candidate.coachId === s.actorId && candidate.athleteId === override.athleteId && candidate.status === "active",
    ) ?? null,
  );
  const changes = diffDayPlans(override.originalSnapshot, override.proposedSnapshot);
  const mayAccept =
    viewer === "athlete"
      ? actorId === override.athleteId
      : override.source !== "coach" && canManage(relationship, "liveDayOverrides");

  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex flex-wrap items-center gap-2">
        {showStatus && <StatusChip tone="teal">{override.status === "proposed" ? "Awaiting review" : override.status}</StatusChip>}
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
          {override.source} · {override.reason.replace(/_/g, " ")} · {relativeTime(override.createdAt)}
        </span>
      </p>

      {changes.length > 0 && (
        <div className="flex flex-col">
          {changes.map((change) => (
            <DiffRow
              key={`${change.label}-${change.from}`}
              label={change.label}
              from={formatMaybeTime(change.from)}
              to={formatMaybeTime(change.to)}
              removed={change.kind === "removed"}
            />
          ))}
        </div>
      )}

      {override.explanation.length > 0 && (
        <ReserveDisclosure summary={`Why this changed · ${override.explanation.length}`}>
          <ul className="flex flex-col gap-1">
            {override.explanation.map((line) => (
              <li key={line} className="flex items-start gap-2 text-[12px] leading-[1.45] text-white/65">
                <span aria-hidden="true" className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[#5fb7d5]/60" />
                {line}
              </li>
            ))}
          </ul>
        </ReserveDisclosure>
      )}

      {override.warnings.length > 0 && (
        <div className="border-l-2 border-[#e8c87a]/40 pl-3">
          {override.warnings.map((warning) => (
            <p key={warning} className="text-[12px] leading-[1.45] text-white/75">{warning}</p>
          ))}
        </div>
      )}

      {override.status === "proposed" && (
        <div className="flex flex-wrap gap-1.5">
          <CommandButton
            variant="teal"
            disabled={!mayAccept}
            disabledReason="This change is waiting on the other side's approval"
            onClick={() => {
              void run((r) => r.liveDay.acceptOverride(override.id, actorId)).then(onAfterAction);
            }}
          >
            {viewer === "athlete" ? "Apply live plan" : "Approve change"}
          </CommandButton>
          <CommandButton
            variant="ghost"
            onClick={() => {
              void run((r) => r.liveDay.rejectOverride(override.id, actorId)).then(onAfterAction);
            }}
          >
            {viewer === "athlete" ? "Keep original" : "Decline"}
          </CommandButton>
        </div>
      )}
    </div>
  );
}

/* ─── Conflict resolution ─────────────────────────────────────────────── */

export function ConflictResolver({
  day,
  overrides,
  onAfterAction,
}: {
  day: ActiveDayPlan;
  overrides: LiveDayOverride[];
  onAfterAction?: () => void;
}) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const open = overrides.filter((o) => o.status === "proposed");

  return (
    <div className="border-l-2 border-[#ef7d55]/45 pl-3.5">
      <MicroLabel className="text-[#ef7d55]">Two versions of today</MicroLabel>
      <p className="mt-1 text-[12.5px] leading-[1.5] text-white/70">
        Both are kept. Choose which becomes the live plan, or keep the original day.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {open.map((override) => (
          <div key={override.id} className="flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <StatusChip tone={override.source === "coach" ? "champagne" : "teal"}>
                {override.source === "coach" ? "Coach version" : "Athlete version"}
              </StatusChip>
              <MicroLabel>{relativeTime(override.createdAt)}</MicroLabel>
            </div>
            <div className="mt-1.5 flex flex-col">
              {diffDayPlans(override.originalSnapshot, override.proposedSnapshot).slice(0, 4).map((change) => (
                <DiffRow
                  key={`${change.label}-${change.from}`}
                  label={change.label}
                  from={formatMaybeTime(change.from)}
                  to={formatMaybeTime(change.to)}
                  removed={change.kind === "removed"}
                />
              ))}
            </div>
            <CommandButton
              className="mt-2 w-full"
              onClick={() => {
                void run((r) => r.liveDay.resolveConflict(day.athleteId, day.date, override.id, actorId)).then(onAfterAction);
              }}
            >
              Use the {override.source === "coach" ? "coach" : "athlete"} version
            </CommandButton>
          </div>
        ))}
      </div>
      <CommandButton
        variant="ghost"
        className="mt-2 w-full"
        onClick={() => {
          void run((r) => r.liveDay.revertToOriginal(day.athleteId, day.date, actorId)).then(onAfterAction);
        }}
      >
        Keep the original day
      </CommandButton>
    </div>
  );
}

/* ─── Operational timeline ────────────────────────────────────────────── */

export function LiveDayEventLog({ athleteId, date, collapsed = false }: { athleteId: string; date: string; collapsed?: boolean }) {
  const liveDayEvents = useCoachingStore((s) => s.db.liveDayEvents);
  const events = useMemo(
    () => liveDayEvents.filter((e) => e.athleteId === athleteId && e.date === date),
    [liveDayEvents, athleteId, date],
  );
  if (events.length === 0) return null;
  const list = (
    <ol className="flex flex-col">
      {[...events]
        .sort((a, b) => a.at.localeCompare(b.at))
        .map((event) => (
          <li key={event.id} className="flex items-start gap-3 border-l border-white/[0.1] pb-2.5 pl-3 last:pb-0">
            <span aria-hidden="true" className="-ml-[17px] mt-1 h-2 w-2 flex-shrink-0 rounded-full border border-white/25 bg-[#0b0c12]" />
            <div>
              <span className="tnum font-mono text-[10px] text-white/50">
                {new Date(event.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
              <p className="text-[12px] leading-[1.45] text-white/70">{event.summary}</p>
            </div>
          </li>
        ))}
    </ol>
  );
  if (collapsed) return <ReserveDisclosure summary={`Day log · ${events.length}`}>{list}</ReserveDisclosure>;
  return (
    <div>
      <MicroLabel className="mb-1.5">Day log</MicroLabel>
      {list}
    </div>
  );
}
