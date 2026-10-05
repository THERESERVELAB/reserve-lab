"use client";

import { ArrowRight, Phone } from "lucide-react";
import { useMemo } from "react";

import { useSafetyToolsVisible } from "@/components/authz/CapabilitiesProvider";
import { focusRecoverySleepLog } from "@/components/recovery/sleep-log-anchor";
import { EscalationList } from "@/components/safety/EscalationList";
import { useClientNow } from "@/components/safety/useClientNow";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveDisclosure, ReserveSectionHeader } from "@/components/ui/reserve";
import { RecordList, RecordRow } from "@/components/views/records/RecordRows";
import { canAccessView } from "@/lib/apex/source-to-view";
import { useAthleteDashboardStore, type EnhancementEntry } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { ROOM_COPY, resolveEnhancedRoomContext, type EnhancedRoom, type RoomRoute } from "@/lib/enhanced/room-context";
import { safetyAccess } from "@/lib/safety/acknowledgement";
import { escalationForSymptoms } from "@/lib/safety/escalation";

/* ════════════════════════════════════════════════════════════════════════
   ENHANCED ROOM CONTEXT — one quiet section per daily room.

   Where a member has logged compounds or stated a cycle, Apex, Training,
   Nutrition and Recovery say what the member's own records hold for that
   room (`lib/enhanced/room-context.ts`). Nothing renders otherwise: Reserve
   does not ask whether a member is enhanced, and does not assume it.

   PROMOTION CANDIDATE: this generalises `views/records/EnhancedContext` for
   the rooms. It reuses the same building blocks — `useSafetyToolsVisible`,
   the acknowledgement access check, `EscalationList`, `RecordList` — and the
   lead may fold the two together.

   GATING — split, and never loosened:
     · LIVE for every member with records: their active logged entries by
       name, exactly what Apex's Logbook already shows live (active, not
       paused; no launch switch, no acknowledgement, no tier).
     · BEHIND `useSafetyToolsVisible()` AND a current safety acknowledgement
       (18+ included): the cycle and its week, checkpoints, latest draw,
       symptoms, lab flags and every escalation route. Under-age profiles
       see none of it.

   ONE GOLD ACTION STAYS THE ROOM'S. This section never asks for the
   acknowledgement itself — the gate's Continue is a gold button, and a
   second gold action in a room breaks Bible §11. Where the member has not
   accepted it yet, one line says where it lives.

   NOT A CARD IN A CARD. One GlassPanel, flush on phones; everything inside
   separates with hairlines. The escalation ladder draws its own surface, so
   it stays a sibling of the panel.
   ════════════════════════════════════════════════════════════════════════ */

const EMPTY_ENTRIES: EnhancementEntry[] = [];
const SYMPTOM_CHECK_SELECTOR = '[data-record="symptom-check"]';

/**
 * Opens the Bloodwork Log and brings its symptom check into view. The check
 * renders there for exactly this member — safety tools visible, acknowledgement
 * accepted, a compound or cycle logged — which is the condition this route
 * appears under. It waits for the view to mount rather than guessing a delay.
 */
function openSymptomCheck(setActiveView: (view: "bloodwork") => void) {
  setActiveView("bloodwork");
  if (typeof window === "undefined") return;
  const deadline = Date.now() + 5000;
  const seek = () => {
    const host = document.querySelector<HTMLElement>(SYMPTOM_CHECK_SELECTOR);
    if (host) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      host.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      host.querySelector<HTMLElement>("input")?.focus({ preventScroll: true });
      return;
    }
    if (Date.now() < deadline) window.setTimeout(seek, 120);
  };
  window.setTimeout(seek, 60);
}

/**
 * The section's standing note, as one line plus a disclosure. The note's
 * first sentence stays on screen; the rest of it — every word, unchanged —
 * sits behind "How Reserve reads this". A 240-character footnote on every
 * room was the section's longest paragraph.
 */
function RoomNote({ note }: { note: string | undefined }) {
  if (!note) return null;
  const cut = note.search(/[.!?]\s/);
  const lead = cut === -1 ? note : note.slice(0, cut + 1);
  const rest = cut === -1 ? "" : note.slice(cut + 1).trim();
  return (
    <div className="mt-3" data-enhanced="note">
      <p className="max-w-[72ch] text-[12px] leading-[1.6] text-white/50">{lead}</p>
      {rest && (
        <ReserveDisclosure summary="How Reserve reads this" accent={RESERVE.steel}>
          <p className="max-w-[72ch] text-[12px] leading-[1.6] text-white/50">{rest}</p>
        </ReserveDisclosure>
      )}
    </div>
  );
}

export function EnhancedRoomContext({ room }: { room: EnhancedRoom }) {
  const now = useClientNow();
  const visible = useSafetyToolsVisible();
  const entries = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog) ?? EMPTY_ENTRIES;
  const cycles = useAthleteDashboardStore((s) => s.cyclePeriods);
  const labRecords = useAthleteDashboardStore((s) => s.bloodworkLogs);
  const redFlagReports = useAthleteDashboardStore((s) => s.redFlagReports);
  const checkIns = useAthleteDashboardStore((s) => s.cycleCheckIns);
  const acknowledgement = useAthleteDashboardStore((s) => s.safetyAcknowledgement);
  const profileAge = useAthleteDashboardStore((s) => s.setupProfile.age);
  const tier = useAthleteDashboardStore((s) => s.subscriptionTier);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);

  const context = useMemo(
    () => (now ? resolveEnhancedRoomContext(room, { now, entries, cycles, labRecords, redFlagReports, checkIns }) : null),
    [room, now, entries, cycles, labRecords, redFlagReports, checkIns],
  );

  if (!context) return null;

  const access = safetyAccess(acknowledgement, profileAge);
  const showGated = visible && access === "open";
  const { live, gated } = context;
  if (!showGated && !live) return null;

  /* Visible, not yet accepted: say where the acknowledgement lives. Under 18
     or switch off: say nothing about what is hidden. */
  const awaitingAcknowledgement = visible && access === "acknowledge";

  const routeLabel = (route: RoomRoute) => {
    const view = route.kind === "view" ? route.view : route.kind === "symptom-check" ? "bloodwork" : null;
    return view && !canAccessView(tier, view) ? `${route.label} · Reserve Black` : route.label;
  };
  const runRoute = (route: RoomRoute) => {
    if (route.kind === "view") setActiveView(route.view);
    else if (route.kind === "symptom-check") openSymptomCheck(setActiveView);
    else focusRecoverySleepLog();
  };
  const routes = showGated ? gated.routes : (live?.routes ?? []);

  /* ── Apex: one line and one link ─────────────────────────────────────── */
  if (room === "apex") {
    const line = showGated ? context.apexLine.gated : context.apexLine.live;
    if (!line) return null;
    const route = routes[0];
    return (
      <div data-enhanced-room="apex" data-enhanced-part={showGated ? "gated" : "live"}>
      <GlassPanel accent={RESERVE.steel} phone="flush">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-5">
          <p className="shrink-0 font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: alpha(RESERVE.steel, 0.75) }}>
            {showGated ? ROOM_COPY.cycleHeading : ROOM_COPY.logHeading}
          </p>
          <p data-enhanced="statement" className="tnum min-w-0 flex-1 text-[13.5px] font-semibold leading-[1.45] [text-wrap:pretty]" style={{ color: RESERVE.ivory }}>
            {line}
          </p>
          {route && (
            <div className="shrink-0">
              {/* Quiet buttons carry side padding for their 44px target; on phones the label lines up with the text above. */}
              <ReserveButton tier="quiet" size="sm" accent={RESERVE.steel} iconAfter={ArrowRight} className="-ml-3 md:ml-0" onClick={() => runRoute(route)}>
                {routeLabel(route)}
              </ReserveButton>
            </div>
          )}
        </div>
      </GlassPanel>
      </div>
    );
  }

  /* ── Training, Recovery, Nutrition ───────────────────────────────────── */
  const hasLinked = gated.facts.some((fact) => fact.id === "linked");
  const escalations = showGated && room !== "nutrition" ? escalationForSymptoms(gated.recentRedFlags) : [];

  return (
    <div data-enhanced-room={room} data-enhanced-part={showGated ? "gated" : "live"} className="flex flex-col gap-4 md:gap-5">
      {escalations.length > 0 && <EscalationList items={escalations} label={ROOM_COPY.escalationLabel} />}

      <GlassPanel accent={RESERVE.steel} phone="flush">
        <ReserveSectionHeader
          label={showGated ? (room === "nutrition" ? ROOM_COPY.nutritionHeading : ROOM_COPY.cycleHeading) : ROOM_COPY.logHeading}
          accent={RESERVE.steel}
        />

        {showGated ? (
          <>
            <p data-enhanced="statement" className="tnum text-[15px] font-semibold leading-snug" style={{ color: RESERVE.ivory }}>
              {gated.statement}
            </p>
            {gated.detail && <p className="tnum mt-1 max-w-[72ch] text-[12.5px] leading-[1.6] text-white/60">{gated.detail}</p>}

            {gated.pastEndNotice && (
              <p className="mt-3 max-w-[72ch] text-[12.5px] leading-[1.6]" style={{ color: alpha(RESERVE.amber, 0.9) }}>
                {gated.pastEndNotice}
              </p>
            )}

            <RecordList label={room === "nutrition" ? "Your lab dates" : "Your cycle context"} className="mt-3.5">
              {gated.facts.map((fact) => (
                <RecordRow key={fact.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[13.5px] font-semibold text-[#f2eee6]">{fact.label}</p>
                    <p className="tnum text-[13px] text-white/65">{fact.value}</p>
                  </div>
                </RecordRow>
              ))}
              {room !== "nutrition" && !hasLinked && live && (
                <RecordRow>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[13.5px] font-semibold text-[#f2eee6]">{ROOM_COPY.activeInLog}</p>
                    <p className="text-[13px] text-white/65">{live.entryNames.join(" · ")}</p>
                  </div>
                </RecordRow>
              )}
            </RecordList>

            {gated.labFlags.length > 0 && (
              <>
                <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">{ROOM_COPY.labFlagsHeading}</p>
                <RecordList label="Results flagged on your own report" className="mt-2">
                  {gated.labFlags.map((flag) => (
                    <RecordRow key={flag.id}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="text-[13.5px] font-semibold text-[#f2eee6]">{flag.marker}</p>
                        <p className="tnum text-[13px] text-white/70">{flag.reading}</p>
                      </div>
                      <p className="tnum mt-1 text-[12.5px] leading-[1.5] text-white/55">
                        {flag.range} · {flag.flag}
                      </p>
                      <p
                        className="mt-0.5 text-[12.5px] font-semibold"
                        style={{ color: flag.critical ? alpha(RESERVE.amber, 0.95) : alpha(RESERVE.steel, 0.9) }}
                      >
                        {flag.route}
                      </p>
                    </RecordRow>
                  ))}
                </RecordList>
                {gated.moreLabFlags > 0 && (
                  <p className="tnum mt-2 text-[12px] text-white/50">
                    {ROOM_COPY.moreLabFlags(gated.moreLabFlags)}
                  </p>
                )}
              </>
            )}
          </>
        ) : (
          live && (
            <>
              <p data-enhanced="statement" className="tnum text-[15px] font-semibold leading-snug" style={{ color: RESERVE.ivory }}>
                {live.statement}
              </p>
              <p className="mt-1 max-w-[72ch] text-[13px] leading-[1.6] text-white/65">{live.entryNames.join(" · ")}</p>
              {awaitingAcknowledgement && (
                <p className="mt-3 max-w-[72ch] text-[12.5px] leading-[1.6] text-white/55">
                  {ROOM_COPY.awaitingAcknowledgement}
                </p>
              )}
            </>
          )
        )}

        {routes.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {routes.map((route, i) => (
              <ReserveButton
                key={route.label}
                tier={i === 0 ? "secondary" : "quiet"}
                size="sm"
                accent={RESERVE.steel}
                iconAfter={route.kind === "sleep-log" ? undefined : ArrowRight}
                onClick={() => runRoute(route)}
              >
                {routeLabel(route)}
              </ReserveButton>
            ))}
          </div>
        )}

        {showGated && room !== "nutrition" && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4" aria-label={ROOM_COPY.contactsLabel}>
            <a
              href="tel:911"
              className="inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] font-semibold text-white/70 underline-offset-4 hover:underline"
            >
              <Phone size={12} aria-hidden="true" style={{ color: alpha(RESERVE.red, 0.85) }} />
              {ROOM_COPY.emergency}
            </a>
            <a
              href="tel:988"
              className="inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] font-semibold text-white/70 underline-offset-4 hover:underline"
            >
              <Phone size={12} aria-hidden="true" style={{ color: alpha(RESERVE.red, 0.85) }} />
              {ROOM_COPY.crisis}
            </a>
          </div>
        )}

        <RoomNote note={showGated ? gated.note : live?.note} />
      </GlassPanel>
    </div>
  );
}
