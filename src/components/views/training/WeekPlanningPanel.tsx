"use client";

import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  ReserveButton,
  ReserveDisclosure,
  ReserveNotice,
  ReserveSectionHeader,
  ReserveSelect,
  type ReserveSelectOption,
} from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE } from "@/lib/design/tokens";
import { useMemberSplit } from "@/lib/hooks/useMemberSplit";
import { splitPreviewWeek } from "@/lib/training/member-split";
import { MORNING_ROUTE_LABEL, morningDaysLabel, type MorningRoute } from "@/lib/training/double-day";
import { SPLIT_ACTIVITIES, splitActivity, type SplitActivityKey } from "@/lib/training/split-activities";
import { buildWeekGuidance, titleIsHeavyLower, titleIsLower, type GuidanceDay, type GuidanceSeverity } from "@/lib/training/week-guidance";
import { COMMITMENT_MAX_PER_WEEK, WEEKDAY_SHORT, type WeekdayIndex } from "@/lib/training/weekly-commitments";

/**
 * THE WEEK YOU ALREADY HAVE
 *
 * Purpose: capture the standing facts about a member's week — the Pilates
 * classes, the track day, the morning cardio — BEFORE Reserve places her
 * sessions, and report the collisions between them.
 *
 * Dominant region: the guidance. Everything else is progressive disclosure.
 * There is no gold action here: the Split Architect above owns the screen's
 * one primary action, and a second would compete with it.
 *
 * It reports. It never rearranges her week — that is the whole point.
 */

const DAY_OPTIONS = WEEKDAY_SHORT.map((name, i) => ({ value: i as WeekdayIndex, label: name.slice(0, 2), a11y: name }));

const SEVERITY_ACCENT: Record<GuidanceSeverity, string> = {
  conflict: RESERVE.amber,
  attention: RESERVE.steel,
  note: RESERVE.slate,
};

const SEVERITY_LABEL: Record<GuidanceSeverity, string> = {
  conflict: "Worth changing",
  attention: "Worth knowing",
  note: "For information",
};

/**
 * A row of choices, not a chip cloud: fixed slots that read as one control.
 *
 * Deliberately NOT ReserveSegmented. That control wraps its buttons in a
 * rounded, filled, bordered `role="tablist"` track, and the training room's
 * nesting rule counts a tablist as a surface — so inside this glass panel it
 * reads as a card in a card. Its buttons are each exempt as controls, so the
 * row carries the paint and no wrapper does.
 */
function ChoiceRow<T extends string | number>({
  options,
  selected,
  onPick,
  label,
  accent,
}: {
  options: { value: T; label: string; a11y?: string }[];
  /** A set for multi-select (the days), a single value for a pick-one. */
  selected: readonly T[];
  onPick: (value: T) => void;
  label: string;
  accent: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={on}
            aria-label={option.a11y ?? option.label}
            onClick={() => onPick(option.value)}
            className="min-h-[44px] flex-1 rounded-xl text-[11px] font-semibold tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-[34px]"
            style={{
              background: on ? `${accent}1f` : "rgba(255,255,255,0.03)",
              color: on ? accent : "rgba(255,255,255,0.45)",
              outlineColor: accent,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function WeekPlanningPanel({
  pausedTrack,
  chosenLegDays,
  onClearSplit,
}: {
  /** Set when a split chosen by name has displaced a women's physique track. */
  pausedTrack?: { architectureName: string; lowerDays: number } | null;
  chosenLegDays?: number | null;
  onClearSplit?: () => void;
} = {}) {
  const commitments = useAthleteDashboardStore((s) => s.weeklyCommitments);
  const addCommitment = useAthleteDashboardStore((s) => s.addWeeklyCommitment);
  const removeCommitment = useAthleteDashboardStore((s) => s.removeWeeklyCommitment);
  const doubleDay = useAthleteDashboardStore((s) => s.doubleDay);
  const setDoubleDay = useAthleteDashboardStore((s) => s.setDoubleDay);
  const toggleDoubleDayDay = useAthleteDashboardStore((s) => s.toggleDoubleDayDay);

  const memberSplit = useMemberSplit();

  /* Draft commitment — nothing is written until she adds it. */
  const [draftActivity, setDraftActivity] = useState<SplitActivityKey>("pilates");
  const [draftTimes, setDraftTimes] = useState(2);
  const [draftDays, setDraftDays] = useState<WeekdayIndex[]>([]);

  const guidanceWeek = useMemo<GuidanceDay[]>(() => {
    if (!memberSplit) return [];
    return splitPreviewWeek(memberSplit).map((d) => ({
      dayIndex: d.dayIndex,
      title: d.sessionName,
      recovery: d.recovery,
      heavyLower: titleIsHeavyLower(d.sessionName),
      lower: titleIsLower(d.sessionName),
    }));
  }, [memberSplit]);

  const guidance = useMemo(
    () => buildWeekGuidance({ week: guidanceWeek, commitments, doubleDay }),
    [guidanceWeek, commitments, doubleDay],
  );

  const activityOptions: ReserveSelectOption<string>[] = SPLIT_ACTIVITIES.map((a) => ({ value: a.key, label: a.label }));
  const routeOptions: ReserveSelectOption<string>[] = (Object.keys(MORNING_ROUTE_LABEL) as MorningRoute[]).map((r) => ({
    value: r,
    label: MORNING_ROUTE_LABEL[r],
  }));

  const canAdd = draftDays.length <= draftTimes;
  const addReason = canAdd ? undefined : `You named ${draftDays.length} days but said ${draftTimes}× a week.`;

  return (
    <GlassPanel accent={RESERVE.steel} phone="flush">
      <ReserveSectionHeader label="The week you already have" accent={RESERVE.steel} />

      {pausedTrack && (
        <ReserveNotice tone="warning" title={`${pausedTrack.architectureName} is running instead of your protocol week`} className="mb-4">
          Your protocol week trains legs {pausedTrack.lowerDays}× — {pausedTrack.architectureName} trains them{" "}
          {chosenLegDays ?? "fewer"}×. Your choice stands; clearing the split puts the protocol week back.
          {onClearSplit && (
            <button
              type="button"
              onClick={onClearSplit}
              className="mt-2 block min-h-[44px] text-[12px] font-semibold underline decoration-white/30 underline-offset-4 transition-colors hover:text-white sm:min-h-0"
            >
              Go back to the protocol week
            </button>
          )}
        </ReserveNotice>
      )}

      <p className="max-w-[68ch] text-[12.5px] leading-[1.6] text-white/60">
        Tell Reserve what already happens every week and it plans around it instead of over it. Nothing here moves a
        session on its own.
      </p>

      {/* ── The dominant read: what the week actually totals, and what collides ── */}
      <p className="mt-4 text-[14.5px] font-semibold leading-[1.45] text-[#f2eee6] tabular-nums">{guidance.loadLine}</p>

      {guidance.notes.length === 0 ? (
        <p className="mt-2 max-w-[64ch] text-[12.5px] leading-[1.6] text-white/50">
          Nothing in the week collides. Add a standing commitment or a morning session and Reserve checks the placement
          against your split.
        </p>
      ) : (
        <ul className="mt-3 space-y-3" aria-label="How to run this week">
          {guidance.notes.map((note) => (
            <li key={note.id} className="border-l pl-3" style={{ borderColor: `${SEVERITY_ACCENT[note.severity]}59` }}>
              <p
                className="font-mono text-[8px] uppercase tracking-[0.18em]"
                style={{ color: `${SEVERITY_ACCENT[note.severity]}cc` }}
              >
                {SEVERITY_LABEL[note.severity]}
              </p>
              <p className="mt-1 text-[13.5px] font-semibold leading-[1.4] text-[#f2eee6]">{note.title}</p>
              <p className="mt-1 max-w-[70ch] text-[12.5px] leading-[1.6] text-white/60">{note.detail}</p>
            </li>
          ))}
        </ul>
      )}

      {/* ── Everything below is progressive disclosure ── */}
      <div className="mt-5 space-y-2">
        <ReserveDisclosure
          summary={
            commitments.length === 0
              ? "Standing commitments — none set"
              : `Standing commitments — ${commitments.length} set`
          }
          accent={RESERVE.steel}
        >
          {commitments.length > 0 && (
            <ul className="mb-4 space-y-2" aria-label="Your standing commitments">
              {commitments.map((commitment) => {
                const def = splitActivity(commitment.activity);
                const days =
                  commitment.days.length > 0
                    ? commitment.days
                        .slice()
                        .sort((a, b) => a - b)
                        .map((d) => WEEKDAY_SHORT[d])
                        .join(", ")
                    : "Days flexible";
                return (
                  <li key={commitment.id} className="flex items-baseline justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-[#f2eee6]">
                        {def?.label ?? commitment.activity}
                        <span className="ml-2 font-mono text-[11px] font-normal text-white/45 tabular-nums">
                          {commitment.timesPerWeek}× a week
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-white/45">{days}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCommitment(commitment.id)}
                      className="min-h-[44px] shrink-0 text-[11.5px] font-semibold text-white/45 transition-colors hover:text-white/80 sm:min-h-0"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <ReserveSelect
              label="Activity"
              value={draftActivity}
              options={activityOptions}
              onChange={(v) => setDraftActivity(v as SplitActivityKey)}
            />
            <ReserveSelect
              label="Times a week"
              value={String(draftTimes)}
              options={Array.from({ length: COMMITMENT_MAX_PER_WEEK }, (_, i) => ({
                value: String(i + 1),
                label: `${i + 1}× a week`,
              }))}
              onChange={(v) => {
                const next = Number(v);
                setDraftTimes(next);
                setDraftDays((days) => days.slice(0, next));
              }}
            />
          </div>

          <div className="mt-3">
            <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/35">
              Fixed days — optional
            </p>
            <ChoiceRow
              label="Days this commitment lands on"
              options={DAY_OPTIONS}
              selected={draftDays}
              accent={RESERVE.steel}
              onPick={(d) =>
                setDraftDays((days) => (days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b)))
              }
            />
            <p className="mt-1.5 text-[11.5px] leading-[1.5] text-white/45">
              Leave these blank if the days move week to week. A Tuesday class is fixed; four cardio sessions usually are
              not.
            </p>
          </div>

          <div className="mt-4">
            {canAdd ? (
              <ReserveButton
                tier="secondary"
                onClick={() => {
                  addCommitment({ activity: draftActivity, timesPerWeek: draftTimes, days: draftDays });
                  setDraftDays([]);
                }}
              >
                Add This Commitment
              </ReserveButton>
            ) : (
              <ReserveButton tier="secondary" disabled disabledReason={addReason!}>
                Add This Commitment
              </ReserveButton>
            )}
          </div>
        </ReserveDisclosure>

        <ReserveDisclosure
          summary={doubleDay.enabled ? `Double Day — ${morningDaysLabel(doubleDay)}` : "Double Day — off"}
          accent={RESERVE.gold}
        >
          <p className="max-w-[68ch] text-[12.5px] leading-[1.6] text-white/60">
            A morning session in front of the same day&apos;s lift. Pick the mornings you actually run — Reserve places
            the rest of the week around them and tells you when one lands in front of a heavy lower day.
          </p>

          <div className="mt-3">
            <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/35">Mornings</p>
            <ChoiceRow
              label="Mornings a second session runs"
              options={DAY_OPTIONS}
              selected={doubleDay.days}
              accent={RESERVE.gold}
              onPick={toggleDoubleDayDay}
            />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ReserveSelect
              label="Morning session"
              value={doubleDay.activity}
              options={activityOptions}
              onChange={(v) => setDoubleDay({ activity: v as SplitActivityKey })}
            />
            <ReserveSelect label="Route" value={doubleDay.route} options={routeOptions} onChange={(v) => setDoubleDay({ route: v as MorningRoute })} />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/35">Length</p>
              <ChoiceRow
                label="Morning session length"
                options={[15, 20, 25, 30, 45].map((m) => ({ value: m, label: `${m}m`, a11y: `${m} minutes` }))}
                selected={[doubleDay.minutes]}
                onPick={(m) => setDoubleDay({ minutes: m })}
                accent={RESERVE.gold}
              />
            </div>
            <div>
              <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/35">Before food</p>
              <ChoiceRow
                label="Trained before food"
                options={[
                  { value: "no", label: "After a meal" },
                  { value: "yes", label: "Before food" },
                ]}
                selected={[doubleDay.fasted ? "yes" : "no"]}
                onPick={(v) => setDoubleDay({ fasted: v === "yes" })}
                accent={RESERVE.gold}
              />
            </div>
          </div>

          {doubleDay.enabled && doubleDay.fasted && (
            <ReserveNotice tone="info" className="mt-3">
              Reserve records that you train before food so your first meal lands after the session. It makes no claim
              about what training fasted does — that is your call and your clinician&apos;s.
            </ReserveNotice>
          )}
        </ReserveDisclosure>
      </div>
    </GlassPanel>
  );
}
