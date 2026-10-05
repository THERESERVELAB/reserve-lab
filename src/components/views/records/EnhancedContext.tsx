"use client";

import { useCallback, useState } from "react";

import { CareOptions } from "@/components/safety/CareOptions";
import { EscalationList } from "@/components/safety/EscalationList";
import { RedFlagCheck } from "@/components/safety/RedFlagCheck";
import { SafetyAcknowledgementGate } from "@/components/safety/SafetyAcknowledgementGate";
import { useClientNow } from "@/components/safety/useClientNow";
import { useSafetyContext } from "@/components/safety/useSafetyContext";
import { useSafetyToolsVisible } from "@/components/authz/CapabilitiesProvider";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveBottomSheet, ReserveDisclosure, ReserveSectionHeader } from "@/components/ui/reserve";
import { canAccessView } from "@/lib/apex/source-to-view";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { CYCLE_PHASE_LABEL } from "@/lib/cycle/cycle-period";
import { hasCurrentSafetyAcknowledgement } from "@/lib/safety/acknowledgement";
import { ESCALATION_LABEL, type EscalationItem } from "@/lib/safety/escalation";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { formatDayFull } from "@/lib/physique/record-summary";
import {
  CLINICAL_COPY,
  cycleRowLine,
  noCycleLine,
  symptomRowLine,
  watchedGroups,
  watchedMarkerStatus,
  watchedRowLine,
} from "@/lib/records/clinical-records";

import { ContextRow, EmergencyLine } from "./ClinicalRows";
import { RecordList, RecordRow } from "./RecordRows";

/* ════════════════════════════════════════════════════════════════════════
   ENHANCED CONTEXT — the record screens recognise an enhanced athlete.

   Where the member has logged a cycle or compounds, their clinical record
   screens say so: the cycle they stated beside the labs they drew, the
   markers commonly watched for what they logged, a symptom check, and a
   route to a human.

   COMPACT BY DESIGN (clinical records wave, 2026-09-16). This used to be four
   panels repeated on three screens — about 70% of each. It is now one panel
   of rows, one line each; the detail opens in a sheet (or, on the Enhanced
   Monitor index, on the screen that holds it). What never moves behind a
   tap: urgent escalations (their own ladder above the panel), every review
   route, and 911 / 988. Only the symptom checklist itself moves into a sheet.

   IT IS ALL REUSE. `useSafetyContext`, `SafetyAcknowledgementGate`,
   `RedFlagCheck` (wrapped in a sheet, props unchanged), `EscalationList`,
   `CareOptions` and the cycle state are the shipped, reviewed parts.

   GATING IS UNCHANGED (CLAUDE.md launch switch):
     · `useSafetyToolsVisible()` — production hides review-pending safety
       tools until clinician and counsel sign-off.
     · `SafetyAcknowledgementGate` — the member accepts what Reserve is, and
       confirms they are 18 or older, before any of it appears.
     · Nothing renders at all unless the member logged a compound or cycle.

   COMPLIANCE: timing, never cause. It never states an amount, a schedule or
   a combination, never says to start, stop or change anything, never says a
   cycle is safe or that anything protects against harm, and never names a
   condition.
   ════════════════════════════════════════════════════════════════════════ */

/** Urgent items keep their own full ladder, with tap-to-call, above the rows. */
const URGENT = new Set<EscalationItem["level"]>(["crisis", "emergency", "contact-clinician-today"]);

export function EnhancedContext({
  /** Bloodwork already renders the lab safety panel, which covers these. */
  showWatchedMarkers = true,
  showLabEscalations = true,
  /**
   * Whether this surface may ASK for the safety acknowledgement.
   *
   * Bloodwork passes `false`: the lab safety panel above already carries the
   * gate, and two acknowledgement panels on one screen is both a worse screen
   * and an ambiguous one. There it renders only once the member has already
   * accepted, elsewhere it asks.
   */
  gate = true,
  /**
   * `sheet` opens each row's detail in place. `link` sends the cycle and
   * watched-marker rows to the screen that holds them (Compound Command,
   * Bloodwork) — for an index screen. The symptom check always opens in
   * place: nobody should have to change screens to report a warning sign.
   */
  rowAction = "sheet",
  /**
   * Where the screen already routes each flagged result itself (the Biomarker
   * Cockpit's marker table), the lab "Get this reviewed" rows would repeat it.
   * `false` drops those; a critical lab's same-day item always stays.
   */
  showLabReviewRow = true,
  /** A screen that already shows 911 / 988 unconditionally may pass `false`. */
  showEmergencyLine = true,
}: {
  showWatchedMarkers?: boolean;
  showLabEscalations?: boolean;
  gate?: boolean;
  rowAction?: "sheet" | "link";
  showLabReviewRow?: boolean;
  showEmergencyLine?: boolean;
}) {
  const visible = useSafetyToolsVisible();
  const now = useClientNow();
  const compounds = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog);
  const cycles = useAthleteDashboardStore((s) => s.cyclePeriods);
  const acknowledgement = useAthleteDashboardStore((s) => s.safetyAcknowledgement);
  const profileAge = useAthleteDashboardStore((s) => s.setupProfile.age);

  if (!visible || !now) return null;

  /* Reserve does not ask whether a member is enhanced, and does not assume
     it. Nothing here — not even the acknowledgement — appears until they
     have logged a compound or a cycle of their own. */
  if ((compounds?.length ?? 0) === 0 && cycles.length === 0) return null;

  const body = (
    <EnhancedBody
      now={now}
      showWatchedMarkers={showWatchedMarkers}
      showLabEscalations={showLabEscalations}
      rowAction={rowAction}
      showLabReviewRow={showLabReviewRow}
      showEmergencyLine={showEmergencyLine}
    />
  );

  if (!gate) return hasCurrentSafetyAcknowledgement(acknowledgement, profileAge) ? body : null;
  return <SafetyAcknowledgementGate>{body}</SafetyAcknowledgementGate>;
}

type SheetKey = "cycle" | "watched" | "symptoms" | null;

function EnhancedBody({
  now,
  showWatchedMarkers,
  showLabEscalations,
  rowAction,
  showLabReviewRow,
  showEmergencyLine,
}: {
  now: Date;
  showWatchedMarkers: boolean;
  showLabEscalations: boolean;
  rowAction: "sheet" | "link";
  showLabReviewRow: boolean;
  showEmergencyLine: boolean;
}) {
  const context = useSafetyContext(now);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const tier = useAthleteDashboardStore((s) => s.subscriptionTier);
  const [sheet, setSheet] = useState<SheetKey>(null);
  /* Stable: the sheet re-runs its focus effect whenever onClose changes. */
  const closeSheet = useCallback(() => setSheet(null), []);

  const { cycleState, riskBrief, labBrief, activeCompounds, compounds } = context;

  /* Nothing logged that makes this member enhanced — the screen stays as it
     was. Reserve does not ask, and does not assume. */
  if (compounds.length === 0 && !cycleState) return null;

  const watched = showWatchedMarkers && labBrief.untested.length > 0;
  const escalations = context.escalation.filter((item) => {
    if (item.source !== "lab") return true;
    if (!showLabEscalations) return false;
    /* The watched-markers row below says this, once. */
    if (item.id === "lab-untested" && watched) return false;
    return showLabReviewRow || URGENT.has(item.level);
  });
  const urgent = escalations.filter((item) => URGENT.has(item.level));
  const review = escalations.filter((item) => !URGENT.has(item.level));

  const link = (view: "supplements" | "bloodwork", label: string) => ({
    label: canAccessView(tier, view) ? label : `${label} · Reserve Black`,
    link: true,
    onClick: () => setActiveView(view),
  });

  return (
    <>
      {/* Urgent routes keep their full ladder and tap-to-call links, as a
          sibling of the panel rather than a card inside it (components.md rule 1). */}
      <EscalationList items={urgent} label="Safety alerts" />

      <div data-record="enhanced-context">
        <GlassPanel accent={RESERVE.steel} phone="flush">
          <ReserveSectionHeader label="Your cycle and safety" accent={RESERVE.steel} />

          <RecordList label="Your cycle and safety">
            {review.map((item) => (
              <ContextRow
                key={item.id}
                record={`escalation-${item.id}`}
                label={ESCALATION_LABEL[item.level]}
                labelColor={item.level === "discuss-with-clinician" ? alpha(RESERVE.amber, 0.9) : undefined}
                line={item.title}
                detail={item.body}
              />
            ))}

            <ContextRow
              record="cycle-context"
              label={CLINICAL_COPY.cycleLabel}
              line={cycleState ? cycleRowLine(cycleState) : noCycleLine(activeCompounds.length)}
              action={
                rowAction === "link"
                  ? link("supplements", CLINICAL_COPY.openCompoundCommand)
                  : cycleState
                    ? { label: CLINICAL_COPY.cycleSheetAction, srSuffix: "of your cycle", onClick: () => setSheet("cycle") }
                    : link("supplements", CLINICAL_COPY.openCompoundCommand)
              }
            />

            {watched && (
              <ContextRow
                record="commonly-watched"
                label={CLINICAL_COPY.watchedLabel}
                line={watchedRowLine(labBrief.untested.length)}
                action={
                  rowAction === "link"
                    ? link("bloodwork", CLINICAL_COPY.openBloodwork)
                    : { label: CLINICAL_COPY.watchedSheetAction, srSuffix: "commonly watched markers", onClick: () => setSheet("watched") }
                }
              />
            )}

            {riskBrief.unprofiledNames.length > 0 && (
              <ContextRow
                record="no-profile"
                label={CLINICAL_COPY.noProfileLabel}
                line={riskBrief.unprofiledNames.join(" · ")}
                detail={CLINICAL_COPY.noProfileBody}
              />
            )}

            {/* The row EnhancedRoomContext's "Open Symptom Check" scrolls to. */}
            <ContextRow
              record="symptom-check"
              label={CLINICAL_COPY.symptomLabel}
              labelColor={alpha(RESERVE.red, 0.9)}
              line={CLINICAL_COPY.symptomQuestion}
              detail={symptomRowLine(riskBrief.redFlags.length)}
              action={{ label: CLINICAL_COPY.symptomAction, srSuffix: "warning signs", onClick: () => setSheet("symptoms") }}
            />
          </RecordList>

          {review.length > 0 && (
            <div className="mt-4">
              <CareOptions />
            </div>
          )}

          <p className="mt-3 text-[12px] leading-[1.6] text-white/50">{CLINICAL_COPY.endsHere}</p>
          {showEmergencyLine && <EmergencyLine className="mt-1" />}
        </GlassPanel>
      </div>

      {/* ── Sheets. Each is role="dialog" aria-modal with its title as its name. ── */}

      <ReserveBottomSheet open={sheet === "symptoms"} onClose={closeSheet} title={CLINICAL_COPY.symptomLabel} accent={RESERVE.red}>
        <RedFlagCheck relevant={riskBrief.redFlags} />
        <EmergencyLine className="mt-3" />
      </ReserveBottomSheet>

      {cycleState && (
        <ReserveBottomSheet open={sheet === "cycle"} onClose={closeSheet} title={CLINICAL_COPY.cycleLabel} accent={RESERVE.steel}>
          <p className="text-[15px] font-semibold" style={{ color: RESERVE.ivory }}>
            {cycleState.cycle.name} · {CYCLE_PHASE_LABEL[cycleState.phase]}
          </p>
          <p className="tnum mt-1 text-[12.5px] leading-[1.6] text-white/60">
            Week {cycleState.weekNumber} of {cycleState.totalWeeks} by the dates you entered · started{" "}
            {formatDayFull(cycleState.cycle.startDate)} · planned end {formatDayFull(cycleState.plannedEnd)}
          </p>
          <RecordList label="Cycle context" className="mt-3">
            <SheetFact
              label="Compounds you linked"
              value={cycleState.compounds.length > 0 ? cycleState.compounds.map((compound) => compound.name).join(" · ") : "None linked to this cycle"}
            />
            <SheetFact
              label="Lab checkpoint you set"
              value={
                cycleState.nextCheckpoint
                  ? `${cycleState.nextCheckpoint.label} · ${formatDayFull(cycleState.nextCheckpoint.date)} · ${cycleState.nextCheckpoint.status}`
                  : "None set"
              }
            />
            {labBrief.latestLabDate && <SheetFact label="Latest draw" value={formatDayFull(labBrief.latestLabDate)} />}
          </RecordList>
          {cycleState.stillActivePastEnd && (
            <p className="mt-3 text-[12.5px] leading-[1.6]" style={{ color: alpha(RESERVE.amber, 0.9) }}>
              {cycleState.activePastEndNames.join(", ")} · {CLINICAL_COPY.pastEndNote}
            </p>
          )}
          <p className="mt-3 text-[12px] leading-[1.6] text-white/50">{CLINICAL_COPY.timingNote}</p>
        </ReserveBottomSheet>
      )}

      {watched && (
        <ReserveBottomSheet open={sheet === "watched"} onClose={closeSheet} title={CLINICAL_COPY.watchedLabel} accent={RESERVE.steel}>
          <div className="flex flex-col gap-5">
            {watchedGroups(labBrief.untested).map((group) => (
              <section key={group.heading} aria-label={group.heading}>
                <h3 className="text-[14px] font-semibold" style={{ color: RESERVE.ivory }}>
                  {group.heading}
                </h3>
                <RecordList label={group.heading} className="mt-2">
                  {group.markers.map((marker) => (
                    <SheetFact key={marker.key} label={marker.label} value={watchedMarkerStatus(marker)} />
                  ))}
                </RecordList>
              </section>
            ))}
          </div>
          <div className="mt-4">
            <ReserveDisclosure summary={CLINICAL_COPY.sourcesSummary} accent={RESERVE.steel}>
              <p className="text-[12.5px] leading-[1.6] text-white/60">{CLINICAL_COPY.sourcesBody}</p>
            </ReserveDisclosure>
          </div>
        </ReserveBottomSheet>
      )}
    </>
  );
}

function SheetFact({ label, value }: { label: string; value: string }) {
  return (
    <RecordRow className="py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[13.5px] font-semibold text-[#f2eee6]">{label}</p>
        <p className="tnum text-[13px] text-white/65">{value}</p>
      </div>
    </RecordRow>
  );
}
