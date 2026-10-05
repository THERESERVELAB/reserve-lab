"use client";

import { AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { FullBriefing } from "@/components/apex/briefing/FullBriefing";
import { WatchEvidencePanel } from "@/components/apex/briefing/WatchEvidencePanel";
import { HardassPrepStandard } from "@/components/accountability/HardassPrepStandard";
import { EnhancedRoomContext } from "@/components/enhanced/EnhancedRoomContext";
import { FIXED_NOON, formatClock } from "@/components/apex/model/apex-format";
import { useApexModel } from "@/components/apex/model/useApexModel";
import { useApexToday } from "@/components/apex/model/useApexToday";
import { ReserveWeekRail } from "@/components/training/ReserveWeekRail";
import { ReserveActionBar, ReserveButton, ReserveShellPortal } from "@/components/ui/reserve";
import { canAccessView } from "@/lib/apex/source-to-view";
import type { ApexAction, ApexLaneItem } from "@/lib/apex/today-types";
import { MealConfirmationDrawer } from "@/components/views/nutrition/MealConfirmationDrawer";
import { goalKeyFromString } from "@/lib/nutrition/adapter";
import { fuelPlanForConfirmation, macroDials } from "@/lib/nutrition/nutrition-room";
import type { DietStyleKey } from "@/lib/nutrition/types";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { useIsPhone } from "@/lib/hooks/useMediaQuery";
import { beginSystemsOnline } from "@/lib/ui/systems-online";
import { FUEL_REFERENCE_BODYWEIGHT_LB, summarizeLoggedProtein } from "@/lib/nutrition/fuel-plan";
import { formatTime12, localScheduleDateKey } from "@/lib/schedule/engine";
import { formatSplitDistance } from "@/lib/training/split-customization";
import { buildDayScores, readinessParts, type DayRingId, type FuelMealState, type SessionState } from "@/lib/apex/day-scores";
import { pickMotivation } from "@/lib/apex/motivation";
import { RESERVE_WEIGHTS } from "@/lib/recovery/engine";
import { momentMeals, recordMealChange } from "@/components/nutrition/meal-moment/meal-moment-store";
import { AdjustTodaySheet } from "./AdjustTodaySheet";
import { ApexHeroes } from "./ApexHeroes";
import { ConditionColumn } from "./ConditionColumn";
import { DayRingSheet, type DayRingDetail, type SleepNight } from "./DayRingSheet";
import { DayLine, DayScores } from "./DayScores";
import { DayTimeline } from "./DayTimeline";
import { LaneItemSheet } from "./LaneItemSheet";
import { LogbookPanel } from "./LogbookPanel";
import { NextMovePanel, RISK_TONE, type BlockingMove } from "./NextMovePanel";
import { NowSpine } from "./NowSpine";
import { StatusBus, type StatusReadout } from "./StatusBus";
import { useApexActions } from "./useApexActions";

const RESET_ACTIONS = new Set(["session_reset", "not_ready", "accidental_start"]);

/** Where an Apex meal moment lands: the Fuel dial (its face is the readout the light reaches). */
const APEX_MEAL_TARGETS = {
  readout: '[data-day-ring="fuel"] [data-ring-face]',
};

/* ════════════════════════════════════════════════════════════════════════
   THE PIT WALL — Apex Command as an instrument, not a document.

   One clock. The day runs left to right under a live now-marker; the member's
   condition sits beside it; the one gold action hangs off the marker.

   Desktop ≥1280: condition column | timeline → next move → week.
   Tablet:        condition row, then the same stack full width.
   Phone:         statement → today's scores → next move → now spine → week,
                  with the gold action docked at the true bottom of the screen.

   Below the line: the member's logbook (log-only content never sits above the
   fold), the Watch List with Evidence Needed, then the closed Full briefing.
   ════════════════════════════════════════════════════════════════════════ */

export function PitWallView({ blocking }: { blocking: BlockingMove | null }) {
  const model = useApexModel();
  const today = useApexToday(model);
  const runAction = useApexActions(model.now);
  const isPhone = useIsPhone();
  const subscriptionTier = useAthleteDashboardStore((s) => s.subscriptionTier);
  const [sheetItems, setSheetItems] = useState<ApexLaneItem[] | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  /* Stable closers: a sheet re-runs its focus effect whenever `onClose` changes,
     and this view re-renders every minute with the clock. */
  const closeItemSheet = useCallback(() => setSheetItems(null), []);
  const closeAdjust = useCallback(() => setAdjustOpen(false), []);
  const [openRing, setOpenRing] = useState<DayRingId | null>(null);
  const closeRing = useCallback(() => setOpenRing(null), []);

  /* Systems online: the first Apex open of a browser session settles in once
     (src/lib/ui/systems-online.ts). Never delays the gold action. */
  useEffect(() => beginSystemsOnline(), []);

  /* A meal counts only once the member confirms it, in the same confirmation the
     Nutrition hero opens. Every "Log Meal" on this screen opens it; none logs on tap. */
  const [confirmMealId, setConfirmMealId] = useState<string | null>(null);
  const closeConfirm = useCallback(() => setConfirmMealId(null), []);
  const act = useCallback(
    (action: ApexAction) => {
      if (action.kind === "log-meal") setConfirmMealId(action.mealId);
      else runAction(action);
    },
    [runAction],
  );
  const dietStyle = useAthleteDashboardStore((s) => s.nutritionPrefs.dietStyle);
  const profileGoal = useAthleteDashboardStore((s) => s.profile.goal);
  const confirmMealLog = useAthleteDashboardStore((s) => s.confirmMealLog);
  const undoLastMealLog = useAthleteDashboardStore((s) => s.undoLastMealLog);
  const engagement = useAthleteDashboardStore((s) => s.engagement);

  const { now, clock, recovery, recoverySnapshot: snap, schedule, nutritionPlan, loggedMealIds, trainingSessionMode, todayResolved } = model;

  const confirmPlan = useMemo(
    () => fuelPlanForConfirmation({ plan: nutritionPlan, loggedMealIds, dietStyle: dietStyle as DietStyleKey, date: localScheduleDateKey(clock) }),
    [nutritionPlan, loggedMealIds, dietStyle, clock],
  );
  const confirmTarget = confirmMealId ? (confirmPlan.meals.find((meal) => meal.id === confirmMealId) ?? null) : null;

  /* ── Instruments ───────────────────────────────────────────────────── */
  /* The top bar keeps what the dials do not carry: output and water. Protein
     and sleep now live in today's scores. */
  const hydration: StatusReadout = {
    label: "Hydration",
    value: recovery.hydrationLogs.length ? String(snap.hydrationTodayOz) : null,
    numeric: Number.isInteger(snap.hydrationTodayOz) ? { value: snap.hydrationTodayOz } : undefined,
    unit: `/ ${snap.hydrationTargetOz} oz`,
    title: recovery.hydrationLogs.length ? "Logged hydration today." : "Evidence needed · no hydration logged.",
  };
  const outputLabel = trainingSessionMode === "live" ? "Live" : trainingSessionMode === "complete" || trainingSessionMode === "closed" ? "Closed" : "Staged";
  const output: StatusReadout = { label: "Output", value: outputLabel, title: `Output capacity · training session ${outputLabel.toLowerCase()}` };

  const sleepNights = useMemo<SleepNight[]>(() => {
    const byDate = new Map<string, number>();
    for (const log of [...recovery.sleepLogs].sort((a, b) => a.date.localeCompare(b.date))) byDate.set(log.date, log.hours);
    return Array.from(byDate, ([date, hours]) => ({ date, hours })).slice(-7);
  }, [recovery.sleepLogs]);

  /* ── Today's scores ────────────────────────────────────────────────── */
  const todayKey = localScheduleDateKey(clock);
  const proteinLogged = summarizeLoggedProtein(nutritionPlan.meals, loggedMealIds);
  const fuelLane = today.lanes.find((l) => l.id === "fuel");
  const trainingLane = today.lanes.find((l) => l.id === "training");
  const mealState = useCallback(
    (mealId: string): FuelMealState => {
      if (loggedMealIds.includes(mealId)) return "logged";
      const status = fuelLane?.items.find((item) => item.id === `meal-${mealId}`)?.status;
      return status === "past-due" ? "past-due" : status === "due-now" || status === "due-next" ? "due" : "upcoming";
    },
    [loggedMealIds, fuelLane],
  );
  const sessionStatus = trainingLane?.items.find((item) => item.id === "session")?.status;
  const session: SessionState = todayResolved.recovery
    ? "rest"
    : !today.trainingPlanned
      ? "off"
      : trainingSessionMode === "live"
        ? "live"
        : trainingSessionMode === "complete" || trainingSessionMode === "closed"
          ? "done"
          : sessionStatus === "past-due"
            ? "past-due"
            : sessionStatus === "due-now"
              ? "due"
              : "staged";
  const scores = useMemo(
    () =>
      buildDayScores({
        readiness: { hasData: snap.hasData, hasLogs: snap.hasLogs, reserve: snap.reserve },
        sleep: { logs: recovery.sleepLogs, targetHours: recovery.sleepTargetHours, today: todayKey },
        fuel: {
          meals: nutritionPlan.meals.map((meal) => ({ id: meal.id, state: mealState(meal.id) })),
          loggedProteinG: proteinLogged,
          proteinTargetG: nutritionPlan.targets.proteinG,
        },
        session,
        recovery: { hasData: snap.hasData, debt: snap.debt.overall },
        hydration: { todayOz: snap.hydrationTodayOz, targetOz: snap.hydrationTargetOz },
        schedule: { sleepCompression: today.risk.level === "Sleep compression" },
      }),
    [snap, recovery.sleepLogs, recovery.sleepTargetHours, todayKey, nutritionPlan, mealState, proteinLogged, session, today.risk.level],
  );
  const openRingModel = openRing ? (scores.rings.find((ring) => ring.id === openRing) ?? null) : null;
  const ringDetail: DayRingDetail = {
    readiness: {
      parts: readinessParts({
        weights: RESERVE_WEIGHTS,
        logged: snap.inputsLogged,
        sleepAvg7: snap.sleepAvg7,
        sleepTargetHours: recovery.sleepTargetHours,
        hydrationAdherence: snap.hydrationAdherence,
        mobilityThisWeek: snap.mobilityThisWeek,
        mobilityWeeklyTarget: snap.mobilityWeeklyTarget,
        stressLoadLabel: snap.stressLoadLabel,
      }),
      trendWord: snap.momentum === "data-limited" ? null : snap.momentum === "stable" ? "steady" : snap.momentum,
      projectedQuality: model.projectedQuality,
      loggedKinds: snap.inputsLogged,
    },
    sleep: { nights: sleepNights, targetHours: recovery.sleepTargetHours },
    fuel: {
      meals: nutritionPlan.meals.map((meal) => {
        const state = mealState(meal.id);
        return {
          id: meal.id,
          label: meal.windowLabel,
          time: meal.time ? formatTime12(meal.time) : null,
          proteinG: meal.macros.proteinG,
          status: state === "logged" ? "Logged" : state === "past-due" ? "Past due" : state === "due" ? "Due now" : "Upcoming",
          logged: state === "logged",
        };
      }),
      loggedG: proteinLogged,
      targetG: nutritionPlan.targets.proteinG,
      /* All four macros, the read Nutrition's dials show. */
      macros: macroDials({ meals: nutritionPlan.meals, loggedMealIds, targets: nutritionPlan.targets }),
      referenceWeight:
        nutritionPlan.targets.basis === "reference-weight"
          ? `No bodyweight on file, so the estimate uses a ${FUEL_REFERENCE_BODYWEIGHT_LB} lb reference until you log your weight.`
          : null,
    },
  };

  const weekDone = model.apexWeek.filter((d) => d.status === "complete").length;
  const weekPlanned = model.apexWeek.filter((d) => !d.recovery).length;
  const dayLine = useMemo(
    () =>
      pickMotivation({
        today: todayKey,
        checkIn: { currentStreak: engagement.currentStreak ?? 0, lastCheckInDate: engagement.lastCheckInDate ?? null },
        sessions: { done: weekDone, planned: weekPlanned },
        sleepLogs: recovery.sleepLogs,
        sleepTargetHours: recovery.sleepTargetHours,
        hydrationLogs: recovery.hydrationLogs,
        hydrationTargetOz: recovery.hydrationTargetOz,
      }),
    [todayKey, engagement.currentStreak, engagement.lastCheckInDate, weekDone, weekPlanned, recovery.sleepLogs, recovery.sleepTargetHours, recovery.hydrationLogs, recovery.hydrationTargetOz],
  );

  /* A meal confirmed here plays the same log moment Nutrition plays, landing
     on the Fuel dial: the dial holds until the light arrives, then moves. */
  const recordMeal = (write: () => void) =>
    recordMealChange({ meals: momentMeals(nutritionPlan.meals), proteinTargetG: nutritionPlan.targets.proteinG, write, targets: APEX_MEAL_TARGETS });

  /* ── Day identity ──────────────────────────────────────────────────── */
  const todayOverride = now ? model.trainingOverrides[localScheduleDateKey(now)] : undefined;
  const flexNotice = !todayOverride
    ? null
    : RESET_ACTIONS.has(todayOverride.action)
      ? "Session reset. No training data recorded. Choose your next action in Training."
      : todayOverride.action === "rescheduled"
        ? `${todayOverride.originalSessionTitle} was rescheduled. Reserve is protecting your split.`
        : null;

  const sessionLabel = todayResolved.activity?.label ?? todayResolved.sessionName;
  /* The member's own distance goal rides the session line, e.g. "Track Session · 3 mi". */
  const distanceGoal = formatSplitDistance(todayResolved.activity?.distance);
  const headline = today.trainingPlanned
    ? `${sessionLabel}${distanceGoal ? ` · ${distanceGoal}` : ""} · ${formatTime12(todayResolved.activity?.startTime ?? schedule.preferredTrainingStart)}`
    : todayResolved.recovery
      ? /^no session$/i.test(todayResolved.sessionName.trim())
        ? "Recovery day"
        : `Recovery day · ${todayResolved.sessionName}`
      : today.lanes.find((l) => l.id === "training")?.empty?.message ?? "No session today";
  const dayLabel = now ? clock.toLocaleDateString("en-US", { weekday: "long" }) : "Today";
  const greeting = `${model.greetWord}${model.memberName ? ` · ${model.memberName}` : ""}`;
  const splitLine =
    [model.activeResolution || model.activeProtocol ? model.executionTimelineLabel : null, model.executionPhaseLabel]
      .filter(Boolean)
      .join(" · ") || null;
  const logbook = today.lanes.find((l) => l.id === "logbook") ?? null;

  /* ── The one action ────────────────────────────────────────────────── */
  const primaryLabel = blocking ? blocking.actionLabel : today.nextMove.action?.label ?? null;
  const onPrimary = () => {
    if (blocking) blocking.onAction();
    else if (today.nextMove.action) act(today.nextMove.action);
  };

  const nextMove = (className: string) => (
    <NextMovePanel
      className={className}
      nextMove={today.nextMove}
      risk={today.risk}
      then={today.then}
      blocking={blocking}
      onPrimary={onPrimary}
    />
  );

  return (
    <div data-room-sections className="flex flex-col gap-4 md:gap-5">
      <ReserveShellPortal slot="topbar">
        <StatusBus readouts={[output, hydration]} />
      </ReserveShellPortal>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-8">
        <ConditionColumn
          greeting={greeting}
          statement={model.statement}
          splitName={model.splitIdentity}
          splitLine={splitLine}
          instrument={<DayScores scores={scores} ready={now !== null} onOpen={setOpenRing} />}
          compounds={<ApexHeroes now={now} />}
          line={<DayLine line={dayLine} />}
        />

        <div className="flex min-w-0 flex-col gap-4">
          {/* Phone reads the move before the day; desktop reads the day first. */}
          {nextMove("md:hidden")}
          <DayTimeline
            className="hidden md:block"
            today={today}
            dayLabel={dayLabel}
            headline={headline}
            flexNotice={flexNotice}
            onOpenItems={setSheetItems}
            onAction={act}
            onAdjust={() => setAdjustOpen(true)}
          />
          <NowSpine className="md:hidden" today={today} onOpenItems={setSheetItems} onAction={act} />
          {nextMove("hidden md:block")}
          <ReserveWeekRail
            week={model.apexWeek}
            sleepTarget={formatClock(schedule.sleepTarget)}
            onOpenTraining={() => model.setActiveView("training")}
            now={now ?? FIXED_NOON}
          />
        </div>
      </div>

      {/* ── Below the line ─────────────────────────────────────────────── */}
      {/* Today's standard — renders only when the member chose the Hardass Prep coach voice. */}
      <HardassPrepStandard model={model} onLogMeal={setConfirmMealId} />
      {/* The member's own cycle, in one line — renders only when they logged one or a compound. */}
      <EnhancedRoomContext room="apex" />
      {logbook && <LogbookPanel lane={logbook} onAction={act} />}

      <WatchEvidencePanel
        hurting={model.briefing.hurting}
        evidence={model.evidence}
        confidenceLevel={model.briefing.confidence.level}
        onNavigate={model.setActiveView}
      />

      <FullBriefing
        smartBrief={model.smartBrief}
        confidenceLevel={model.briefing.confidence.level}
        intakeSummary={model.intakeSummary}
        onNavigate={model.setActiveView}
        weakPointLabels={model.weakPointLabels}
        momentum={model.mission.physique}
        checkInCadence={model.checkInCadence}
        physiqueEvidence={model.physiqueEvidence}
        biomarkers={model.biomarkers}
        measurementReview={model.measurementReview}
        photoReview={model.photoReview}
        enhanced={model.enhanced}
        enhancedLogOnly={model.enhancedLogOnly}
        onEnableEnhanced={() => model.setEnhancedLogOnly(true)}
        canAccessEnhanced={canAccessView(subscriptionTier, "supplements")}
        canAccessMonitor={canAccessView(subscriptionTier, "enhanced-monitor")}
        systems={model.briefing.systemMatrix}
        nutritionAlignment={model.nutritionAlignment}
      />

      <LaneItemSheet items={sheetItems} onClose={closeItemSheet} onAction={act} />
      {now && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {confirmTarget && (
            <MealConfirmationDrawer
              key={`apex-meal-confirm-${confirmTarget.id}`}
              target={confirmTarget}
              plan={confirmPlan}
              schedule={schedule}
              goal={goalKeyFromString(profileGoal)}
              trainingComplete={trainingSessionMode === "complete" || trainingSessionMode === "closed"}
              loggedIds={loggedMealIds}
              nowMinutes={now.getHours() * 60 + now.getMinutes()}
              onConfirm={(event) => recordMeal(() => confirmMealLog(event))}
              onUndo={() => recordMeal(() => undoLastMealLog())}
              onClose={closeConfirm}
              onPickMeal={(id) => setConfirmMealId(id)}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
      <DayRingSheet ring={openRingModel} detail={ringDetail} onClose={closeRing} onNavigate={model.setActiveView} />
      <AdjustTodaySheet open={adjustOpen} onClose={closeAdjust} flexNotice={flexNotice} onNavigate={model.setActiveView} />

      {isPhone && primaryLabel && !confirmTarget && (
        <ReserveActionBar className="fba-so-action">
          {!blocking && (
            <div className="min-w-0 flex-1" data-apex="risk">
              <p className="font-mono text-[7.5px] uppercase tracking-[0.22em] text-white/40">Risk</p>
              <p className="truncate text-[12.5px] font-semibold" style={{ color: RISK_TONE[today.risk.level] }}>
                {today.risk.level}
              </p>
            </div>
          )}
          <ReserveButton tier="primary" size="lg" sheen iconAfter={ArrowRight} onClick={onPrimary} className={blocking ? "flex-1" : ""}>
            {primaryLabel}
          </ReserveButton>
        </ReserveActionBar>
      )}
    </div>
  );
}
