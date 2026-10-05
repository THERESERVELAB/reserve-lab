"use client";

import { Baby } from "lucide-react";
import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE } from "@/lib/design/tokens";
import { addDaysISO } from "@/lib/women/cycle";
import { mealDayKeys } from "@/lib/women/evidence";
import { PREGNANCY_CARE_LINE, isRequirementMet, resolvePregnancy } from "@/lib/women/primary-actions";

import { RecordHero } from "../records/RecordHero";
import { ViewShell } from "../ViewShell";
import { CareRouting, TrackRow, WOMENS_ACCENT, WomensRequirements, heroAction, plural, useWomensModel, useWomensRunner, WList, WRow } from "./ui";

/**
 * PREGNANCY COMMAND — Utility, optional. The stage the member enters and the
 * sleep, water and meals she logs in the rooms that own them. Training and
 * nutrition decisions route to her clinician, midwife or OB.
 *
 * Removed: "First trimester" shown as her stage before she chose one, six
 * trimester "milestones" that read as lifestyle guidance ("prioritize sleep",
 * "anchor protein"), and adherence readouts with no logger.
 */
export function PregnancyCommandView() {
  const { today, womens, evidence, recoveryCommand, nutritionPrefs } = useWomensModel();
  const { run, sheets } = useWomensRunner(today);
  const update = useAthleteDashboardStore((s) => s.updatePregnancyModule);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const [confirmOff, setConfirmOff] = useState(false);

  const pregnancy = womens.pregnancy;
  const plan = resolvePregnancy(evidence);

  /* The last seven days, counted from her own logs. */
  const week = useMemo(() => {
    const from = addDaysISO(today, -6);
    const inWeek = (d: string) => d >= from && d <= today;
    const nights = new Set(recoveryCommand.sleepLogs.map((l) => l.date).filter(inWeek)).size;
    const waterDays = new Set(recoveryCommand.hydrationLogs.filter((l) => l.oz > 0).map((l) => l.date).filter(inWeek)).size;
    const mealDays = mealDayKeys({
      loggedMealIds: nutritionPrefs.loggedMealIds,
      nutritionLogDate: nutritionPrefs.nutritionLogDate,
      nutritionLogHistory: nutritionPrefs.nutritionLogHistory ?? {},
    }).filter(inWeek).length;
    const waterToday = recoveryCommand.hydrationLogs.filter((l) => l.date === today).reduce((s, l) => s + l.oz, 0);
    return { nights, waterDays, mealDays, waterToday };
  }, [today, recoveryCommand, nutritionPrefs]);

  return (
    <ViewShell
      label="Reserve Women · Optional"
      title="Pregnancy Command"
      icon={Baby}
      accentColor={WOMENS_ACCENT}
      roomHero
      command="An optional private record of your stage and what you log. Care decisions stay with your care team."
      disclaimer="A tracking record only. It gives no medical advice, calculates no due date and does not adjust training, nutrition or supplements. Check changes with your clinician, midwife or OB. In an emergency, call 911."
    >
      <RecordHero
        testId="womens-pregnancy"
        accent={WOMENS_ACCENT}
        eyebrow={pregnancy.enabled ? "Pregnancy · on" : "Pregnancy · optional"}
        statement={plan.statement}
        support={plan.support}
        reads={
          pregnancy.enabled
            ? [
                { label: "Nights logged · 7 days", value: week.nights > 0 ? String(week.nights) : null, empty: "None this week" },
                { label: "Water today", value: week.waterToday > 0 ? String(week.waterToday) : null, unit: "oz", empty: "Not logged today" },
                { label: "Meals today", value: evidence.mealsToday > 0 ? String(evidence.mealsToday) : null, empty: "Not logged today" },
              ]
            : []
        }
        action={heroAction(plan.action, run)}
        secondary={plan.secondary ? heroAction(plan.secondary, run) : undefined}
      />

      {/* Care first: it outranks every readout on this screen. */}
      <GlassPanel accent={RESERVE.steel} phone="flush">
        <ReserveSectionHeader label="Your care team" accent={RESERVE.steel} />
        {/* Said once: the hero's support line already carries the care line whenever it is shown. */}
        {!plan.support?.includes(PREGNANCY_CARE_LINE) && (
          <p className="mb-2 max-w-[72ch] text-[14px] leading-[1.6] text-white/80">{PREGNANCY_CARE_LINE}</p>
        )}
        <p className="max-w-[72ch] text-[12.5px] leading-[1.55] text-white/55">
          Training and Nutrition keep running your program as it was set. Reserve does not know what your care team advised, so review your sessions and meals with them.
        </p>
      </GlassPanel>

      {!plan.requirements.every(isRequirementMet) && (
        <WomensRequirements
          purpose="Pregnancy Command keeps the stage you enter and reads the sleep, water and meals you log in their own rooms. It needs to be switched on, your stage, and those logs."
          requirements={plan.requirements}
          run={run}
        />
      )}

      {pregnancy.enabled && (
        <GlassPanel accent={RESERVE.slate} phone="flush">
          <ReserveSectionHeader label="Your last seven days" accent={RESERVE.slate} />
          <WList label="What you logged in the last seven days">
            <TrackRow name="Sleep" value={`${plural(week.nights, "night")} logged`} detail="Logged in Recovery" actionLabel="Recovery" onOpen={() => setActiveView("recovery")} />
            <TrackRow name="Water" value={`Logged on ${plural(week.waterDays, "day")}`} detail="Logged in Recovery" actionLabel="Recovery" onOpen={() => setActiveView("recovery")} />
            <TrackRow name="Meals" value={`Logged on ${plural(week.mealDays, "day")}`} detail="Logged in Nutrition" actionLabel="Nutrition" onOpen={() => setActiveView("nutrition")} />
          </WList>
        </GlassPanel>
      )}

      <CareRouting reviewLine="Contact your clinician, midwife or OB about anything that worries you, including before changing training or nutrition." />

      {pregnancy.enabled && (
        <WList className="px-1" label="Pregnancy tracking">
          <WRow>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12.5px] leading-[1.55] text-white/50">Turning this off keeps your logs and the stage you entered.</p>
              {confirmOff ? (
                <ReserveButton
                  tier="danger"
                  size="sm"
                  onClick={() => {
                    update({ enabled: false });
                    setConfirmOff(false);
                  }}
                >
                  Confirm Turn Off
                </ReserveButton>
              ) : (
                <ReserveButton tier="quiet" size="sm" onClick={() => setConfirmOff(true)}>
                  Turn Off Pregnancy Tracking
                </ReserveButton>
              )}
            </div>
          </WRow>
        </WList>
      )}
      {sheets}
    </ViewShell>
  );
}
