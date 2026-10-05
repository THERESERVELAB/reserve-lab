"use client";

import { Check, Circle, Minus, Phone, X, type LucideIcon } from "lucide-react";
import { useMemo } from "react";

import type { ApexModel } from "@/components/apex/model/useApexModel";
import { useSafetyToolsVisible } from "@/components/authz/CapabilitiesProvider";
import { focusRecoverySleepLog } from "@/components/recovery/sleep-log-anchor";
import { EscalationList } from "@/components/safety/EscalationList";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { DETAIL_BAND_BLEED, ReserveButton, ReserveDetailImage, ReserveSectionHeader } from "@/components/ui/reserve";
import { RecordList, RecordRow } from "@/components/views/records/RecordRows";
import {
  HARDASS_COPY,
  resolveHardassPrep,
  type StandardCheck,
  type StandardLogger,
  type StandardStatus,
} from "@/lib/accountability/hardass-prep";
import { useAthleteDashboardStore, type EnhancementEntry } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { summarizeLoggedProtein } from "@/lib/nutrition/fuel-plan";
import { RECOVERY_WATER_OZ } from "@/lib/recovery/primary-action";
import { localDateKey } from "@/lib/recovery/types";
import { safetyAccess } from "@/lib/safety/acknowledgement";
import { escalationForSymptoms } from "@/lib/safety/escalation";
import { isTrainingPlannedToday } from "@/lib/training/training-planned";

/* ════════════════════════════════════════════════════════════════════════
   HARDASS PREP — today's standard on Apex.

   Renders only when the member chose the Hardass Prep coach voice in
   Settings. Every check reads a log the member already keeps
   (`lib/accountability/hardass-prep.ts`); a missed or open check carries a
   quiet action only where a working logger exists.

   ONE GOLD ACTION STAYS APEX'S. Nothing here is a primary button.

   NOT A CARD IN A CARD. One GlassPanel, flush on phones; the gym and
   outside groups separate with space and hairlines. Status is carried by a
   glyph and a word, never colour alone. The escalation ladder draws its own
   surface, so it stays a sibling of the panel.

   GATING. The On a Cycle headline and zero-grace wording follow the live rule
   (entries active in the Logbook). The cycle week, lab checkpoint, clinician
   line, warning signs and 911 / 988 render only when the safety tools are
   visible AND the member holds a current safety acknowledgement (18+).
   ════════════════════════════════════════════════════════════════════════ */

const EMPTY_ENTRIES: EnhancementEntry[] = [];

const STATUS: Record<StandardStatus, { icon: LucideIcon; color: string }> = {
  met: { icon: Check, color: RESERVE.green },
  missed: { icon: X, color: RESERVE.amber },
  open: { icon: Circle, color: RESERVE.steel },
  "not-due": { icon: Minus, color: alpha(RESERVE.slate, 0.8) },
};

/** Opens Recovery and focuses its Sleep Log once the view has mounted. */
function openSleepLog(setActiveView: (view: "recovery") => void) {
  setActiveView("recovery");
  if (typeof window === "undefined") return;
  const deadline = Date.now() + 5000;
  const seek = () => {
    if (focusRecoverySleepLog()) return;
    if (Date.now() < deadline) window.setTimeout(seek, 120);
  };
  window.setTimeout(seek, 60);
}

export function HardassPrepStandard({ model, onLogMeal }: { model: ApexModel; onLogMeal: (mealId: string) => void }) {
  const coachStyle = useAthleteDashboardStore((s) => s.profile.aiCoachStyle);
  const sessionHistory = useAthleteDashboardStore((s) => s.trainingSession.sessionHistory);
  const nutritionLogDate = useAthleteDashboardStore((s) => s.nutritionPrefs.nutritionLogDate);
  const entries = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog) ?? EMPTY_ENTRIES;
  const cycles = useAthleteDashboardStore((s) => s.cyclePeriods);
  const labRecords = useAthleteDashboardStore((s) => s.bloodworkLogs);
  const redFlagReports = useAthleteDashboardStore((s) => s.redFlagReports);
  const cycleCheckIns = useAthleteDashboardStore((s) => s.cycleCheckIns);
  const acknowledgement = useAthleteDashboardStore((s) => s.safetyAcknowledgement);
  const profileAge = useAthleteDashboardStore((s) => s.setupProfile.age);
  const logHydration = useAthleteDashboardStore((s) => s.logHydration);
  const visible = useSafetyToolsVisible();

  const { now, trainingContext, todayResolved, nutritionPlan, loggedMealIds, recovery, schedule, setActiveView } = model;

  const standard = useMemo(() => {
    if (!now || coachStyle !== "hardass-prep") return null;
    const today = localDateKey(now);
    /* A meal log that belongs to another day does not count today. */
    const todaysMeals = nutritionLogDate && nutritionLogDate !== today ? [] : loggedMealIds;
    return resolveHardassPrep({
      now,
      training: {
        planned: isTrainingPlannedToday(trainingContext, todayResolved.recovery),
        sessionName: todayResolved.activity?.label ?? todayResolved.sessionName,
        completedSessionDates: (sessionHistory ?? []).map((card) => card.date),
      },
      meals: { plannedMealIds: nutritionPlan.meals.map((meal) => meal.id), loggedMealIds: todaysMeals },
      protein: {
        loggedG: summarizeLoggedProtein(nutritionPlan.meals, todaysMeals),
        /* A target the member owns — their own bodyweight, or their own meal plan.
           Never the reference-weight stand-in. */
        targetG: nutritionPlan.targets.basis === "reference-weight" ? null : nutritionPlan.targets.proteinG,
      },
      sleep: { logs: recovery.sleepLogs, targetHours: recovery.sleepTargetHours, wakeTime: schedule.wakeTime, sleepTime: schedule.sleepTarget },
      water: { logs: recovery.hydrationLogs, targetOz: recovery.hydrationTargetOz },
      /* The app has no recovery check-in logger yet, so the check is left out rather than shown unmeetable. */
      checkIns: null,
      records: { entries, cycles, labRecords, redFlagReports, checkIns: cycleCheckIns },
    });
  }, [now, coachStyle, nutritionLogDate, loggedMealIds, trainingContext, todayResolved, sessionHistory, nutritionPlan, recovery, schedule, entries, cycles, labRecords, redFlagReports, cycleCheckIns]);

  if (!standard || !now) return null;

  const onCycle = standard.onCycle;
  const showGated = Boolean(onCycle) && visible && safetyAccess(acknowledgement, profileAge) === "open";
  const escalations = showGated && onCycle ? escalationForSymptoms(onCycle.gated.recentRedFlags) : [];

  const runLogger = (logger: StandardLogger) => {
    switch (logger.kind) {
      case "training":
        setActiveView("training");
        return;
      case "meal":
        onLogMeal(logger.mealId);
        return;
      case "sleep":
        openSleepLog(setActiveView);
        return;
      case "water":
        logHydration({ date: localDateKey(new Date()), oz: RECOVERY_WATER_OZ });
        return;
    }
  };
  const loggerLabel = (logger: StandardLogger) =>
    logger.kind === "water" ? HARDASS_COPY.loggerLabel.water(RECOVERY_WATER_OZ) : HARDASS_COPY.loggerLabel[logger.kind];

  const group = (where: StandardCheck["where"], heading: string) => {
    const checks = standard.checks.filter((c) => c.where === where);
    if (checks.length === 0) return null;
    return (
      <div data-hardass-group={where} className="min-w-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">{heading}</p>
        <RecordList label={heading} className="mt-2.5">
          {checks.map((c) => {
            const { icon: Icon, color } = STATUS[c.status];
            const word = c.status === "open" && onCycle ? HARDASS_COPY.statusOwed : HARDASS_COPY.status[c.status];
            return (
              <RecordRow key={c.id}>
                <div data-hardass-check={c.id} data-status={c.status} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center"
                    style={{ color }}
                  >
                    <Icon size={14} strokeWidth={c.status === "open" ? 2 : 2.6} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className="text-[13.5px] font-semibold text-[#f2eee6]">{c.label}</p>
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color }}>
                        {word}
                      </p>
                    </div>
                    <p className="tnum mt-0.5 max-w-[60ch] text-[12.5px] leading-[1.55] text-white/65 [text-wrap:pretty]">{c.line}</p>
                    {c.logger && (
                      <ReserveButton tier="quiet" size="sm" accent={RESERVE.steel} className="-ml-3 mt-0.5" onClick={() => runLogger(c.logger!)}>
                        {loggerLabel(c.logger)}
                      </ReserveButton>
                    )}
                  </div>
                </div>
              </RecordRow>
            );
          })}
        </RecordList>
      </div>
    );
  };

  return (
    <div data-hardass-prep data-on-cycle={onCycle ? "true" : "false"} data-hardass-part={showGated ? "gated" : "live"} className="flex flex-col gap-4 md:gap-5">
      {escalations.length > 0 && <EscalationList items={escalations} label={HARDASS_COPY.escalationLabel} />}

      <GlassPanel accent={RESERVE.gold} phone="flush">
        {/* The room's objects set the standard's tone: the prep journal, or the gym before dawn when on a cycle. */}
        <ReserveDetailImage id={onCycle ? "dawn-gym" : "prep-journal"} className={DETAIL_BAND_BLEED} />
        <ReserveSectionHeader label={HARDASS_COPY.sectionLabel} accent={RESERVE.gold} />

        <p data-hardass="headline" className="text-[15px] font-semibold leading-snug [text-wrap:balance]" style={{ color: RESERVE.ivory }}>
          {standard.headline}
        </p>
        <p data-hardass="verdict" className="tnum mt-1 max-w-[72ch] text-[12.5px] leading-[1.6] text-white/60">
          {standard.verdict}
        </p>

        {onCycle && (
          <div data-hardass="on-cycle" className="mt-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: alpha(RESERVE.gold, 0.8) }}>
              {onCycle.live.heading}
            </p>
            <p className="mt-1.5 text-[13.5px] font-semibold text-[#f2eee6]">{onCycle.live.line}</p>
            <p className="mt-0.5 max-w-[72ch] text-[12.5px] leading-[1.6] text-white/60">
              {onCycle.live.basis} {onCycle.live.outside}
            </p>
          </div>
        )}

        <div className="mt-5 grid gap-6 md:grid-cols-2 md:gap-8">
          {group("gym", HARDASS_COPY.gymHeading)}
          {group("outside", HARDASS_COPY.outsideHeading)}
        </div>

        {showGated && onCycle && (
          <div data-hardass="cycle" className="mt-6">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">{HARDASS_COPY.cycleHeading}</p>
            <RecordList label={HARDASS_COPY.cycleHeading} className="mt-2.5">
              <RecordRow>
                <p className="tnum text-[13.5px] font-semibold text-[#f2eee6]">{onCycle.gated.cycleLine}</p>
              </RecordRow>
              {onCycle.gated.checkpointLine && (
                <RecordRow>
                  <p className="tnum text-[13px] text-white/70">{onCycle.gated.checkpointLine}</p>
                </RecordRow>
              )}
              <RecordRow>
                <p className="text-[13px] font-semibold" style={{ color: alpha(RESERVE.steel, 0.95) }}>
                  {onCycle.gated.clinicianLine}
                </p>
              </RecordRow>
            </RecordList>
            <div className="mt-2 flex flex-wrap items-center gap-x-4" aria-label={HARDASS_COPY.contactsLabel}>
              <a href="tel:911" className="inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] font-semibold text-white/70 underline-offset-4 hover:underline">
                <Phone size={12} aria-hidden="true" style={{ color: alpha(RESERVE.red, 0.85) }} />
                {HARDASS_COPY.emergency}
              </a>
              <a href="tel:988" className="inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] font-semibold text-white/70 underline-offset-4 hover:underline">
                <Phone size={12} aria-hidden="true" style={{ color: alpha(RESERVE.red, 0.85) }} />
                {HARDASS_COPY.crisis}
              </a>
            </div>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
