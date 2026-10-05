"use client";

import { Check, Sprout } from "lucide-react";
import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { CYCLE_PHASE_META } from "@/lib/women/cycle";
import { TRACKABLE_FERTILITY_AREAS, isTrackableFertilityArea, mealDayKeys, type TrackableFertilityArea } from "@/lib/women/evidence";
import { isRequirementMet, resolveFertility } from "@/lib/women/primary-actions";
import { FERTILITY_FOCUS_LABELS } from "@/lib/women/types";

import { RecordHero } from "../records/RecordHero";
import { ViewShell } from "../ViewShell";
import { CareRouting, FERTILITY_AREAS_ID, WOMENS_ACCENT, WomensRequirements, heroAction, plural, useWomensModel, useWomensRunner, WList, WRow } from "./ui";

/**
 * FERTILITY COMMAND — Utility, optional. A private record of the member's
 * cycle dates and the lifestyle areas she chooses, each read from a log she
 * already keeps.
 *
 * Removed: a "Fertility Readiness Score" (areas chosen ÷ 7, 71% out of the
 * box from preselected areas), "fertility meal" ideas that paired food with
 * fertility, a free-text lab box that stored pasted results outside the
 * Bloodwork log, and two areas ("environment", "lifestyle habits") that had
 * nothing to log them. There is no fertile window anywhere on this track.
 */
export function FertilityCommandView() {
  const { today, womens, evidence, recoveryCommand, nutritionPrefs } = useWomensModel();
  const { run, sheets } = useWomensRunner(today);
  const update = useAthleteDashboardStore((s) => s.updateFertilityModule);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const [confirmNote, setConfirmNote] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const fertility = womens.fertility;
  const plan = resolveFertility(evidence);
  const c = evidence.cycle;
  const tracked = fertility.focusAreas.filter(isTrackableFertilityArea);

  /* What each area has actually received. Counts of her own logs. */
  const counts = useMemo<Record<TrackableFertilityArea, string>>(() => {
    const daysOf = (items: readonly { date: string }[]) => new Set(items.map((i) => i.date)).size;
    return {
      sleep: plural(daysOf(recoveryCommand.sleepLogs), "night") + " of sleep logged",
      hydration: `Water logged on ${plural(daysOf(recoveryCommand.hydrationLogs), "day")}`,
      stress: `${plural(recoveryCommand.stressCheckIns.length, "check-in")} · stress on ${plural(womens.cycleLogs.filter((l) => l.stress).length, "day note")}`,
      nutrition: `Meals logged on ${plural(
        mealDayKeys({ loggedMealIds: nutritionPrefs.loggedMealIds, nutritionLogDate: nutritionPrefs.nutritionLogDate, nutritionLogHistory: nutritionPrefs.nutritionLogHistory ?? {} }).length,
        "day",
      )}`,
      recovery: `${plural(recoveryCommand.mobilityLogs.length, "mobility session")} logged`,
    };
  }, [recoveryCommand, womens.cycleLogs, nutritionPrefs]);

  const toggle = (area: TrackableFertilityArea) =>
    update({ focusAreas: fertility.focusAreas.includes(area) ? fertility.focusAreas.filter((a) => a !== area) : [...fertility.focusAreas, area] });

  return (
    <ViewShell
      label="Reserve Women · Optional"
      title="Fertility Command"
      icon={Sprout}
      accentColor={WOMENS_ACCENT}
      roomHero
      command="An optional private record of your cycle dates and the lifestyle areas you choose."
      disclaimer="A tracking record only. It does not time conception, predict fertility, guide contraception, interpret labs or give medical advice. Phases are calendar estimates from your dates."
    >
      <RecordHero
        testId="womens-fertility"
        accent={WOMENS_ACCENT}
        eyebrow={fertility.enabled ? "Fertility · on" : "Fertility · optional"}
        statement={plan.statement}
        support={plan.support}
        reads={
          fertility.enabled
            ? [
                {
                  label: "Phase",
                  value: c.phase ? CYCLE_PHASE_META[c.phase].label : null,
                  provenance: "est.",
                  empty: c.entered ? "No estimate past your timing" : "Evidence needed · enter a period start",
                },
                { label: "Days logged", value: evidence.loggedDays > 0 ? String(evidence.loggedDays) : null, empty: "Nothing logged yet" },
                { label: "Areas tracked", value: tracked.length > 0 ? String(tracked.length) : null, empty: "None chosen" },
              ]
            : []
        }
        action={heroAction(plan.action, run)}
      />

      {!plan.requirements.every(isRequirementMet) && (
        <WomensRequirements
          purpose="Fertility Command keeps your cycle dates and reads the lifestyle logs you choose. It needs to be switched on, a period start, an area to track and a few logged days."
          requirements={plan.requirements}
          run={run}
        />
      )}

      {fertility.enabled && (
        <GlassPanel accent={WOMENS_ACCENT} phone="flush">
          <div id={FERTILITY_AREAS_ID} className="scroll-mt-4">
            <ReserveSectionHeader label={`Lifestyle areas you track · ${tracked.length} of ${TRACKABLE_FERTILITY_AREAS.length}`} accent={WOMENS_ACCENT} />
            <WList label="Lifestyle areas">
              {TRACKABLE_FERTILITY_AREAS.map((area) => {
                const on = tracked.includes(area);
                return (
                  <WRow key={area}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14.5px] font-semibold" style={{ color: on ? RESERVE.ivory : "rgba(255,255,255,0.7)" }}>
                          {FERTILITY_FOCUS_LABELS[area]}
                        </p>
                        <p className="tnum mt-0.5 text-[12.5px] leading-[1.5] text-white/50">{counts[area]}</p>
                      </div>
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={`Track ${FERTILITY_FOCUS_LABELS[area]}`}
                        onClick={() => toggle(area)}
                        className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-3 font-mono text-[11px] uppercase tracking-[0.14em] transition"
                        style={{ color: on ? alpha(RESERVE.green, 0.95) : "rgba(255,255,255,0.55)" }}
                      >
                        {on && <Check size={12} aria-hidden="true" />}
                        {on ? "Tracking" : "Track"}
                      </button>
                    </div>
                  </WRow>
                );
              })}
            </WList>
          </div>
        </GlassPanel>
      )}

      {fertility.providerLabsNote.trim() !== "" && (
        <GlassPanel accent={RESERVE.slate} phone="flush">
          <ReserveSectionHeader label="Your saved note" accent={RESERVE.slate} />
          <p className="max-w-[72ch] whitespace-pre-wrap break-words text-[13px] leading-[1.6] text-white/70">{fertility.providerLabsNote}</p>
          <p className="mt-3 max-w-[72ch] text-[12.5px] leading-[1.55] text-white/50">
            This screen no longer takes lab values. Results belong in the Bloodwork log, where each value keeps the range printed on your report.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ReserveButton tier="quiet" size="sm" onClick={() => setActiveView("bloodwork")}>
              Open Bloodwork
            </ReserveButton>
            {confirmNote ? (
              <ReserveButton
                tier="danger"
                size="sm"
                onClick={() => {
                  update({ providerLabsNote: "" });
                  setConfirmNote(false);
                }}
              >
                Confirm Delete Note
              </ReserveButton>
            ) : (
              <ReserveButton tier="quiet" size="sm" onClick={() => setConfirmNote(true)}>
                Delete Note
              </ReserveButton>
            )}
          </div>
        </GlassPanel>
      )}

      <CareRouting reviewLine="Questions about fertility, trying to conceive or contraception belong with a clinician." />

      {fertility.enabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-[12.5px] leading-[1.55] text-white/50">Turning this off keeps your cycle log and the areas you chose.</p>
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
              Turn Off Fertility Tracking
            </ReserveButton>
          )}
        </div>
      )}
      {sheets}
    </ViewShell>
  );
}
