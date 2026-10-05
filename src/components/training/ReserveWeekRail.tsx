"use client";

import { Activity, ArrowRight, Dumbbell, Moon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  ReserveBottomSheet,
  ReserveButton,
  ReserveDisclosure,
  ReserveNotice,
  ReserveSegmented,
  useDirtySnapshot,
  useReportDirty,
} from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { SPLIT_ACTIVITIES, splitActivity } from "@/lib/training/split-activities";
import {
  SPLIT_SESSIONS,
  WEEKDAY_NAMES,
  describeSplitDayEdit,
  formatSplitDistance,
  localDateKey,
  movableSessionKey,
  nextDay,
  parseSplitDistance,
  planMoveToTomorrow,
  sameSplitDayEdit,
  splitSession,
  suggestRecurringEdits,
  weekDateKeys,
  type SplitDayEdit,
  type SplitDistanceUnit,
  type SplitEditScope,
} from "@/lib/training/split-customization";
import type { DayProtocol, TrainingWeekDay } from "@/lib/training/weekly-split";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE WEEK RAIL — the seven-day shape of the week, in one row.

   REPLACES a horizontally-scrolling carousel of seven mini-cards. That
   composition failed on its own terms: at 158px minimum per card it could
   not fit a 1440px viewport without scrolling, every session name was
   `truncate`d, the supporting text ran at 6.5–9px, and each day rendered up
   to SIX protocol chips — up to 35 badges in one region, which is a chip
   cloud, not a schedule.

   The rail shows exactly what a member scans a week for:

     day · activity · time · status · ONE modifier

   THREE TEMPORAL WEIGHTS carry the reading, instead of borders:
   completed days recede, today takes the only accent in the row, and future
   days stay legible but quiet.

   THE MEMBER OWNS THE WEEK. Opening a day offers "Change this day": a
   lifting session, an activity (track, run, a 5:45 AM group class) or rest,
   for just that date or for every week. The change is applied inside the
   training resolver, so the rail, Training Command and the workout Reserve
   loads all agree. When the same one-off change keeps recurring, the sheet
   offers to make it permanent — the member still decides.
   ════════════════════════════════════════════════════════════════════════ */

type Modifier = { label: string; detail: string };

/**
 * The day's support stack, ordered by how much it changes the member's
 * planning — not by how the data happens to be shaped.
 *
 * Sauna leads because it drives hydration the day before. Posing is
 * specialization work that has to be scheduled around. Abs and cardio are
 * near-daily, so they carry the least information and sort last.
 */
function dayModifiers(protocol: DayProtocol, recovery: boolean): Modifier[] {
  const out: Modifier[] = [];
  if (protocol.sauna) out.push({ label: "Sauna", detail: protocol.sauna });
  if (protocol.posing) out.push({ label: "Posing", detail: protocol.posing });
  if (protocol.abs) out.push({ label: "Abs", detail: protocol.abs });
  if (protocol.cardio) out.push({ label: "Cardio", detail: protocol.cardio });
  if (protocol.mobility) out.push({ label: "Mobility", detail: protocol.mobility });
  /* On a recovery day mobility IS the session, so surfacing it as a modifier
     of itself is noise. */
  return recovery ? out.filter((m) => m.label !== "Mobility") : out;
}

/** "05:45" → "5:45 AM". Returns null for anything that is not a clock time. */
function formatClockTime(hhmm: string | undefined): string | null {
  if (!hhmm) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${match[2]} ${suffix}`;
}

function statusLabel(day: TrainingWeekDay): string {
  /* The member's own distance goal is the most useful thing to scan for on an
     activity day, so it rides along with Today or the start time. */
  const distance = formatSplitDistance(day.activity?.distance);
  if (day.isToday) return distance ? `Today · ${distance}` : "Today";
  /* No program yet: nothing was planned, so nothing is done or missed. */
  if (day.status === "none") return "Not planned";
  if (day.status === "complete") return "Done";
  if (day.status === "missed") return "Missed";
  const time = formatClockTime(day.activity?.startTime);
  if (time) return distance ? `${time} · ${distance}` : time;
  if (distance) return distance;
  if (day.activity?.durationMinutes) return `${day.activity.durationMinutes} min`;
  if (day.durationMin != null) return `${day.durationMin} min`;
  return day.recovery ? "Recovery" : "Planned";
}

function DayIcon({ day }: { day: TrainingWeekDay }) {
  const color = day.isToday ? RESERVE.gold : "rgba(255,255,255,0.35)";
  const className = "mt-[3px] shrink-0";
  if (day.activity) return <Activity size={11} className={className} style={{ color }} aria-hidden="true" />;
  if (day.recovery) return <Moon size={11} className={className} style={{ color }} aria-hidden="true" />;
  return <Dumbbell size={11} className={className} style={{ color }} aria-hidden="true" />;
}

function DayColumn({
  day,
  onOpen,
  showRule,
}: {
  day: TrainingWeekDay;
  onOpen: () => void;
  showRule: boolean;
}) {
  // An activity IS the day — support modifiers from the weekday template would
  // only be noise on a track session or a class.
  const modifiers = day.activity ? [] : dayModifiers(day.protocol, day.recovery);
  const primary = modifiers[0] ?? null;
  const overflow = Math.max(0, modifiers.length - 1);
  const past = day.status === "complete" || day.status === "missed" || day.status === "none";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${day.day} · ${day.sessionName} · ${statusLabel(day)}${day.memberEdit ? " · changed by you" : ""}. Open details.`}
      className="relative flex min-h-[92px] min-w-0 flex-col items-start px-2 py-3 text-left transition-colors duration-200 hover:bg-white/[0.03] sm:px-2.5"
      style={{
        /* Today is the only accent in the row. A 2px top rule rather than a
           border or a fill, so the emphasis reads as light on an instrument
           rather than as a selected card. */
        boxShadow: day.isToday ? `inset 0 2px 0 ${RESERVE.gold}` : undefined,
        background: day.isToday ? alpha(RESERVE.gold, 0.05) : undefined,
        /* Completed and missed days recede. They are context, not decisions. */
        opacity: past ? 0.42 : 1,
      }}
    >
      {/* Hairline separator that stops short of the column edges, so the row
          reads as one continuous rail and never as a table. */}
      {showRule && (
        <span
          className="pointer-events-none absolute inset-y-3 left-0 w-px"
          style={{ background: "rgba(255,255,255,0.07)" }}
          aria-hidden="true"
        />
      )}

      <span className="flex w-full items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
        {day.day.slice(0, 3)}
        {/* The member's own change — a quiet mark, named in the accessible label. */}
        {day.memberEdit && (
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: alpha(RESERVE.gold, 0.85) }}
            aria-hidden="true"
          />
        )}
        {/* The session mark rides the day row, so a narrow column gives the name
            its full width instead of breaking "Recovery" mid-word. */}
        <span className="ml-auto" aria-hidden="true">
          <DayIcon day={day} />
        </span>
      </span>

      <span className="mt-1.5 flex w-full min-w-0 items-start gap-1.5">
        {/* Wraps. Never truncates — a schedule the member cannot read is not
            a schedule, and these names are short by construction. */}
        <span
          className="min-w-0 break-words text-[12.5px] font-bold leading-[1.15] sm:text-[13px]"
          style={{ color: day.isToday ? RESERVE.gold : RESERVE.ivory }}
        >
          {day.sessionName}
        </span>
      </span>

      <span className="tnum mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
        {statusLabel(day)}
      </span>

      {primary && (
        <span className="mt-auto pt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">
          {primary.label}
          {overflow > 0 && <span className="text-white/22"> +{overflow}</span>}
        </span>
      )}
    </button>
  );
}

/* ─── Change this day ─────────────────────────────────────────────────── */

function OptionButton({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="min-h-[44px] rounded-[12px] px-3 py-2 text-left text-[12.5px] font-semibold transition-colors duration-150"
      style={{
        border: `1px solid ${selected ? alpha(RESERVE.gold, 0.6) : "rgba(255,255,255,0.08)"}`,
        background: selected ? alpha(RESERVE.gold, 0.12) : "rgba(255,255,255,0.02)",
        color: selected ? RESERVE.gold : RESERVE.ivory,
      }}
    >
      {label}
    </button>
  );
}

const FIELD_CLASS =
  "mt-1 min-h-[44px] w-full rounded-[12px] border border-white/[0.1] bg-black/30 px-3 text-[16px] text-[#f2eee6] outline-none focus:border-[#d5b15f]/60";

/** Tomorrow as the rail knows it — null when tomorrow falls in next week. */
type TomorrowPreview = { sessionName: string; recovery: boolean } | null;

function DayEditor({
  day,
  dateKey,
  isToday,
  tomorrow,
  onDone,
  onDirtyChange,
}: {
  day: TrainingWeekDay;
  dateKey: string;
  /** The sheet is open on today's date — the only day a session can be moved from. */
  isToday: boolean;
  tomorrow: TomorrowPreview;
  onDone: () => void;
  /** Told whether a change is picked but not saved, so the sheet guards its close. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const setSplitDayEdit = useAthleteDashboardStore((s) => s.setSplitDayEdit);
  const setSplitDayEdits = useAthleteDashboardStore((s) => s.setSplitDayEdits);
  const weekday = WEEKDAY_NAMES[day.dayIndex] ?? day.day;

  /* "No Push today — move it to tomorrow." Offered on today only, and only
     when today is a lifting session. */
  const movable = isToday ? movableSessionKey({ ...day, title: day.sessionName }) : null;
  const movableLabel = movable ? splitSession(movable)?.label ?? day.sessionName : "";
  const tomorrowInfo = nextDay(dateKey);
  const tomorrowWeekday = tomorrowInfo ? WEEKDAY_NAMES[tomorrowInfo.dayIndex] ?? "Tomorrow" : "Tomorrow";

  const [mode, setMode] = useState<"change" | "move">("change");
  const [scope, setScope] = useState<SplitEditScope>(day.memberEdit?.scope ?? "once");
  const [pending, setPending] = useState<SplitDayEdit | null>(null);
  const [startTime, setStartTime] = useState("");
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [unit, setUnit] = useState<SplitDistanceUnit>("mi");
  useReportDirty(useDirtySnapshot({ scope, pending, startTime, minutes, distance, unit }), onDirtyChange);
  /* The report above lands a render after the change; a tap outside in that
     gap would still close the sheet. So every edit marks the sheet dirty in the
     same event, and the report settles it (clean again if nothing differs). */
  const edited = <T,>(set: (value: T) => void) => (value: T) => {
    onDirtyChange?.(true);
    set(value);
  };
  const pick = edited(setPending);

  const patterns = SPLIT_SESSIONS.filter((s) => s.group === "pattern");
  const regions = SPLIT_SESSIONS.filter((s) => s.group === "region");
  const isPicked = (edit: SplitDayEdit) => sameSplitDayEdit(pending, edit);

  const parsedDistance = pending?.kind === "activity" ? parseSplitDistance(distance, unit) : undefined;
  const distanceInvalid = parsedDistance === null;

  /** The picked choice with its time, minutes and distance filled in. */
  const buildEdit = (): SplitDayEdit | null => {
    if (!pending) return null;
    if (pending.kind !== "activity") return pending;
    const parsedMinutes = Number(minutes);
    return {
      ...pending,
      startTime: startTime || undefined,
      durationMinutes:
        minutes && Number.isFinite(parsedMinutes) ? Math.max(5, Math.min(480, Math.round(parsedMinutes))) : undefined,
      ...(parsedDistance ? { distance: parsedDistance } : {}),
    };
  };

  const save = () => {
    const edit = buildEdit();
    if (!edit || distanceInvalid) return;
    if (mode === "move") {
      const plan = planMoveToTomorrow({ day: { ...day, title: day.sessionName }, todayKey: dateKey, replacement: edit });
      if (!plan) return;
      setSplitDayEdits([plan.today, plan.tomorrow]);
    } else {
      setSplitDayEdit({ dayIndex: day.dayIndex, dateKey, scope, edit });
    }
    onDone();
  };

  const backToPlan = () => {
    if (!day.memberEdit) return;
    setSplitDayEdit({ dayIndex: day.dayIndex, dateKey, scope: day.memberEdit.scope, edit: null });
    onDone();
  };

  const switchMode = (next: "change" | "move") => {
    // A half-made pick never carries across: a session is not a valid
    // "today becomes" choice in move mode.
    setMode(next);
    setPending(null);
    if (next === "move") setScope("once");
  };

  const saveLabel = pending
    ? mode === "move"
      ? `Today: ${describeSplitDayEdit(pending)} · Tomorrow: ${movableLabel}`
      : scope === "weekly"
        ? `Every ${weekday}: ${describeSplitDayEdit(pending)}`
        : `This ${day.day}: ${describeSplitDayEdit(pending)}`
    : "Save change";
  const disabledReason = !pending
    ? mode === "move"
      ? "Choose what today becomes first."
      : "Choose a session, an activity, or rest first."
    : distanceInvalid
      ? "Distance goal must be a number from 0.1 to 100."
      : null;

  /* One plain line so nothing about tomorrow is a surprise. */
  const tomorrowLine = tomorrow
    ? tomorrow.recovery
      ? `Tomorrow's rest day becomes ${movableLabel} for that day.`
      : `Tomorrow's ${tomorrow.sessionName} moves off the plan for that day.`
    : `${tomorrowWeekday}'s planned day moves off the plan for that day.`;

  const activityOptions = (
    <div role="group" aria-label="Activities">
      <p className="mb-1.5 text-[11px] text-white/45">Activity</p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {SPLIT_ACTIVITIES.map((a) => {
          const edit: SplitDayEdit = { kind: "activity", activity: a.key };
          return <OptionButton key={a.key} label={a.label} selected={isPicked(edit)} onSelect={() => pick(edit)} />;
        })}
      </div>
    </div>
  );

  const activityFields =
    pending?.kind === "activity" ? (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] text-white/45">Start time (optional)</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => edited(setStartTime)(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-white/45">Minutes</span>
            <input
              type="number"
              inputMode="numeric"
              min={5}
              max={480}
              value={minutes}
              placeholder={String(splitActivity(pending.activity)?.defaultMinutes ?? "")}
              onChange={(e) => edited(setMinutes)(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 items-end gap-2">
          <label className="block">
            <span className="text-[11px] text-white/45">Distance goal (optional)</span>
            <input
              type="number"
              inputMode="decimal"
              min={0.1}
              max={100}
              step="any"
              value={distance}
              onChange={(e) => edited(setDistance)(e.target.value)}
              aria-invalid={distanceInvalid || undefined}
              className={FIELD_CLASS}
            />
          </label>
          <ReserveSegmented<SplitDistanceUnit>
            label="Distance unit"
            value={unit}
            onChange={edited(setUnit)}
            segments={[
              { value: "mi", label: "mi" },
              { value: "km", label: "km" },
            ]}
          />
        </div>
        {distanceInvalid && (
          <p className="text-[11px] text-white/55" role="status">
            Distance goal must be a number from 0.1 to 100.
          </p>
        )}
      </div>
    ) : null;

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {disabledReason ? (
        <ReserveButton tier="primary" size="sm" disabled disabledReason={disabledReason}>
          {saveLabel}
        </ReserveButton>
      ) : (
        <ReserveButton tier="primary" size="sm" onClick={save}>
          {saveLabel}
        </ReserveButton>
      )}
      {mode === "move" ? (
        <ReserveButton tier="quiet" size="sm" onClick={() => switchMode("change")}>
          Cancel move
        </ReserveButton>
      ) : (
        day.memberEdit && (
          <ReserveButton tier="quiet" size="sm" onClick={backToPlan}>
            Back to plan
          </ReserveButton>
        )
      )}
    </div>
  );

  const rule = (
    <span
      className="h-px"
      style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.09), rgba(255,255,255,0.01))" }}
      aria-hidden="true"
    />
  );

  if (mode === "move") {
    return (
      <section aria-label={`Move ${movableLabel} to tomorrow`} className="flex flex-col gap-3.5">
        {rule}
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
          Move {movableLabel} to tomorrow
        </p>
        <p className="text-[12.5px] leading-[1.5] text-white/60">
          {movableLabel} moves to {tomorrowWeekday}. Choose what today becomes.
        </p>

        {activityOptions}
        <OptionButton label="Rest day" selected={isPicked({ kind: "rest" })} onSelect={() => pick({ kind: "rest" })} />
        {activityFields}

        <p className="text-[12px] leading-[1.5] text-white/55">{tomorrowLine}</p>
        {actions}
      </section>
    );
  }

  return (
    <section aria-label="Change this day" className="flex flex-col gap-3.5">
      {rule}
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">Change this day</p>

      {movable && (
        <ReserveButton tier="secondary" size="sm" fullWidth onClick={() => switchMode("move")}>
          Move {movableLabel} to tomorrow
        </ReserveButton>
      )}

      <ReserveSegmented<SplitEditScope>
        label={`How often ${weekday} changes`}
        value={scope}
        onChange={edited(setScope)}
        segments={[
          { value: "once", label: `Just this ${day.day}` },
          { value: "weekly", label: `Every ${weekday}` },
        ]}
      />

      <div role="group" aria-label="Lifting sessions">
        <p className="mb-1.5 text-[11px] text-white/45">Train</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {patterns.map((s) => {
            const edit: SplitDayEdit = { kind: "session", session: s.key };
            return <OptionButton key={s.key} label={s.label} selected={isPicked(edit)} onSelect={() => pick(edit)} />;
          })}
        </div>
        <div className="mt-1">
          <ReserveDisclosure summary="Body-part days">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {regions.map((s) => {
                const edit: SplitDayEdit = { kind: "session", session: s.key };
                return <OptionButton key={s.key} label={s.label} selected={isPicked(edit)} onSelect={() => pick(edit)} />;
              })}
            </div>
          </ReserveDisclosure>
        </div>
      </div>

      {activityOptions}

      <OptionButton label="Rest day" selected={isPicked({ kind: "rest" })} onSelect={() => pick({ kind: "rest" })} />

      {activityFields}

      {actions}
    </section>
  );
}

/* ─── Rail ────────────────────────────────────────────────────────────── */

export function ReserveWeekRail({
  week,
  sleepTarget,
  onOpenTraining,
  now,
}: {
  week: TrainingWeekDay[];
  sleepTarget: string;
  onOpenTraining: () => void;
  /** The screen's reference time, so dates here match the rest of the page. */
  now?: Date;
}) {
  const [inspect, setInspect] = useState<TrainingWeekDay | null>(null);
  /* Stable: the sheet re-runs its focus effect whenever onClose changes. */
  const closeInspect = useCallback(() => setInspect(null), []);
  /* A change picked in the day editor but not saved: the sheet then ignores
     an outside click and asks before discarding (FormCloseGuard). */
  const [editorDirty, setEditorDirty] = useState(false);
  const splitCustomization = useAthleteDashboardStore((s) => s.splitCustomization);
  const setSplitDayEdit = useAthleteDashboardStore((s) => s.setSplitDayEdit);
  /* Inside Training Command the rail is already in Training: "Open Training"
     would go nowhere, so it is not offered (no dead CTAs). */
  const inTraining = useAthleteDashboardStore((s) => s.activeView === "training");

  const done = week.filter((d) => d.status === "complete").length;
  const ahead = week.filter((d) => !d.recovery && d.status === "upcoming").length;
  const changed = week.filter((d) => d.memberEdit).length;

  /* Dates and suggestions only feed the sheet, which never renders on the
     server — so reading the clock here cannot cause a hydration mismatch. */
  const dates = useMemo(() => weekDateKeys(now ?? new Date()), [now]);
  const todayKey = useMemo(() => localDateKey(now ?? new Date()), [now]);
  const suggestions = useMemo(
    () => suggestRecurringEdits(splitCustomization, now ?? new Date()),
    [splitCustomization, now],
  );

  /* Mobile shows a three-day window centred on today rather than seven
     columns. At 375px seven columns give each day 47px, which cannot hold an
     activity name. */
  const windowed = useMemo(() => {
    const todayIdx = Math.max(0, week.findIndex((d) => d.isToday));
    const start = Math.min(Math.max(todayIdx - 1, 0), Math.max(week.length - 3, 0));
    return week.slice(start, start + 3);
  }, [week]);

  const inspectModifiers = inspect && !inspect.activity ? dayModifiers(inspect.protocol, inspect.recovery) : [];
  const inspectDate = inspect ? dates[inspect.dayIndex] : null;
  const inspectIsPast = Boolean(inspectDate && inspectDate < todayKey);
  const inspectSuggestion = inspect ? suggestions.find((s) => s.dayIndex === inspect.dayIndex) ?? null : null;
  const inspectWeekday = inspect ? WEEKDAY_NAMES[inspect.dayIndex] ?? inspect.day : "";
  /* Tomorrow inside this week, for the move line. Sunday's tomorrow is next
     week's Monday, which this rail does not hold, so it stays unnamed. */
  const inspectTomorrowDay = inspect ? week.find((d) => d.dayIndex === inspect.dayIndex + 1) ?? null : null;
  const inspectTomorrow = inspectTomorrowDay
    ? { sessionName: inspectTomorrowDay.sessionName, recovery: inspectTomorrowDay.recovery }
    : null;

  return (
    <GlassPanel accent={RESERVE.gold} phone="flush">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h2 className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: alpha(RESERVE.gold, 0.8) }}>
          7-Day Split
        </h2>
        <span className="tnum font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
          {week.every((d) => d.status === "none" || d.isToday) && done === 0
            ? "Nothing planned yet"
            : `${done} done · ${ahead} ahead${changed > 0 ? ` · ${changed} changed by you` : ""}`}
        </span>
        {!inTraining && (
          <button
            type="button"
            onClick={onOpenTraining}
            className="ml-auto inline-flex min-h-[44px] items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/65 transition-colors hover:text-white/75"
          >
            Open Training
            <ArrowRight size={11} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Desktop (lg+) — all seven, no horizontal scroll at any width. */}
      <div className="hidden grid-cols-7 lg:grid" role="group" aria-label="Seven day training split">
        {week.map((day, i) => (
          <DayColumn key={day.day} day={day} showRule={i > 0} onOpen={() => setInspect(day)} />
        ))}
      </div>

      {/* Phone and tablet — three-day window, plus the full week on request. Seven
          columns under ~96px wide broke day names mid-word. */}
      <div className="lg:hidden">
        <div className="grid grid-cols-3" role="group" aria-label="Training split around today">
          {windowed.map((day, i) => (
            <DayColumn key={day.day} day={day} showRule={i > 0} onOpen={() => setInspect(day)} />
          ))}
        </div>
        <div className="mt-2">
          <ReserveDisclosure summary="Full week">
            <div className="flex flex-col">
              {week.map((day) => {
                const mods = day.activity ? [] : dayModifiers(day.protocol, day.recovery);
                return (
                  <button
                    key={day.day}
                    type="button"
                    onClick={() => setInspect(day)}
                    className="flex min-h-[44px] items-center gap-3 py-2 text-left"
                    style={{ opacity: day.status === "complete" || day.status === "missed" ? 0.42 : 1 }}
                  >
                    <span className="w-9 shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                      {day.day.slice(0, 3)}
                    </span>
                    <span
                      className="min-w-0 flex-1 text-[13px] font-bold"
                      style={{ color: day.isToday ? RESERVE.gold : RESERVE.ivory }}
                    >
                      {day.sessionName}
                    </span>
                    <span className="tnum shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
                      {mods[0] ? `${mods[0].label}${mods.length > 1 ? ` +${mods.length - 1}` : ""} · ` : ""}
                      {statusLabel(day)}
                    </span>
                  </button>
                );
              })}
            </div>
          </ReserveDisclosure>
        </div>
      </div>

      {/* INSPECTOR — the detail that used to be crammed into every card, and
          the place the member changes their own day. A sheet rather than a
          navigation, so the rail keeps its place. */}
      <ReserveBottomSheet
        open={inspect !== null}
        onClose={closeInspect}
        dirty={editorDirty}
        title={inspect ? `${inspect.day} · ${inspect.sessionName}` : ""}
        accent={RESERVE.gold}
        footer={
          /* Secondary: "Save change" inside the editor owns the sheet's one
             primary action. */
          inTraining ? undefined : (
            <ReserveButton tier="secondary" size="sm" fullWidth onClick={onOpenTraining}>
              Open Training Command
            </ReserveButton>
          )
        }
      >
        {inspect && (
          <div className="flex flex-col gap-4 pt-1">
            {inspect.memberEdit && (
              <p className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: alpha(RESERVE.gold, 0.85) }}>
                {inspect.memberEdit.scope === "weekly"
                  ? `Every ${inspectWeekday} · your change`
                  : `This ${inspect.day} only · your change`}
              </p>
            )}

            <p className="text-[13px] leading-[1.55] text-white/65">{inspect.focus}</p>

            {inspect.activity && (
              <p className="text-[12.5px] leading-[1.5] text-white/60">
                <span style={{ color: RESERVE.ivory }}>{inspect.activity.label}</span>
                {formatClockTime(inspect.activity.startTime) ? ` · ${formatClockTime(inspect.activity.startTime)}` : ""}
                {inspect.activity.durationMinutes ? ` · ${inspect.activity.durationMinutes} min` : ""}
                {formatSplitDistance(inspect.activity.distance) ? ` · ${formatSplitDistance(inspect.activity.distance)}` : ""}
              </p>
            )}

            {inspect.muscles.length > 0 && !inspect.activity && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">Targets</p>
                <p className="mt-1 text-[13px]" style={{ color: RESERVE.ivory }}>
                  {inspect.muscles.join(" · ")}
                </p>
              </div>
            )}

            {inspectModifiers.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">Support stack</p>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {inspectModifiers.map((m) => (
                    <p key={m.label} className="text-[12.5px] leading-[1.5] text-white/60">
                      <span style={{ color: RESERVE.ivory }}>{m.label}</span> · {m.detail}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Today's handoff detail — the block that previously lived inside
                the today card and forced it wider than every sibling. */}
            {inspect.isToday && !inspect.activity && (
              <div className="flex flex-col gap-1.5">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">Handoff</p>
                <p className="text-[12.5px] leading-[1.5] text-white/60">
                  <span style={{ color: RESERVE.ivory }}>After session</span> · {inspect.protocol.afterSession}
                </p>
                <p className="text-[12.5px] leading-[1.5] text-white/60">
                  <span style={{ color: RESERVE.ivory }}>Recovery</span> · {inspect.protocol.recoveryNote}
                </p>
                <p className="text-[12.5px] leading-[1.5] text-white/60">
                  <span style={{ color: RESERVE.ivory }}>Fuel</span> · {inspect.protocol.nutritionFocus}
                </p>
                <p className="text-[12.5px] leading-[1.5] text-white/60">
                  <span style={{ color: RESERVE.ivory }}>Sleep</span> · {sleepTarget} target
                </p>
              </div>
            )}

            {inspect.advanced && (
              <p className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: RESERVE.amber }}>
                Reserve Black session
              </p>
            )}

            {/* LEARNED — offered, never applied. */}
            {inspectSuggestion && inspectDate && !inspectIsPast && (
              <ReserveNotice
                tone="info"
                title="A pattern in your weeks"
                action={
                  <ReserveButton
                    tier="secondary"
                    size="sm"
                    onClick={() => {
                      setSplitDayEdit({
                        dayIndex: inspectSuggestion.dayIndex,
                        dateKey: inspectDate,
                        scope: "weekly",
                        edit: inspectSuggestion.edit,
                      });
                      setInspect(null);
                    }}
                  >
                    Make it every {inspectWeekday}
                  </ReserveButton>
                }
              >
                <p>
                  You changed {inspectWeekday} to {describeSplitDayEdit(inspectSuggestion.edit)} in{" "}
                  {inspectSuggestion.weeks} of the last {inspectSuggestion.windowWeeks} weeks.
                </p>
              </ReserveNotice>
            )}

            {inspectDate && !inspectIsPast ? (
              <DayEditor
                /* Remount per day so a half-made choice never carries over. */
                key={`${inspect.dayIndex}-${inspectDate}`}
                day={inspect}
                dateKey={inspectDate}
                isToday={inspectDate === todayKey}
                tomorrow={inspectTomorrow}
                onDone={() => setInspect(null)}
                onDirtyChange={setEditorDirty}
              />
            ) : (
              <p className="text-[12px] leading-[1.5] text-white/45">
                Past days keep what actually happened. Change today or any day ahead.
              </p>
            )}
          </div>
        )}
      </ReserveBottomSheet>
    </GlassPanel>
  );
}
