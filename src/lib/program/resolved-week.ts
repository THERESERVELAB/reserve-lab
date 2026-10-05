/* ════════════════════════════════════════════════════════════════════════
   THE MEMBER'S PROGRAM, AS A WEEK.

   A program the member authored or imported already decided what every day
   is. Only the cockpit knew: `resolveProgramDayForDate` was called for ONE
   date, inside TrainingView, and nothing else ever saw it. So the 7-day rail,
   Apex and Nutrition rendered whatever the split resolver had produced, and
   one screen carried two weeks:

       7-DAY SPLIT        TUE  Pull   TODAY
       hero               CHEST DAY.
       honesty line       Your program · Chest Day · Member created

   Same Tuesday, two names. A member's change to a date fixed it for that
   date (#168) and left every other day disagreeing.

   This turns the program's own rotation into the same ResolvedDay[] shape the
   rest of Reserve reads, so there is one week again.

   WHAT IT DOES NOT INVENT. A program day names a session; it does not carry a
   Reserve template. `resolveSplitKey` is asked what engine key the member's
   own title matches, and when it matches nothing the day keeps the title and
   carries a null key — which is exactly how the cockpit already says "No
   workout template for X yet". A rest day is a rest day. Nothing here
   substitutes a generic workout for a day the member authored.

   Pure and deterministic. Dates in, days out.
   ════════════════════════════════════════════════════════════════════════ */

import { RESERVE_WEEK_SPLIT } from "@/lib/training/weekly-split";
import { resolveSplitKey } from "@/lib/training/workout-templates";
import { splitActivity, type SplitActivityKey } from "@/lib/training/split-activities";
import type { ResolvedDay } from "@/lib/training/daily-context";

import { resolveProgramDayForDate } from "./engine";
import type {
  ProgramDayDefinition,
  ProgramDayOverride,
  ProgramDaySessionType,
  ProgramDefinition,
} from "./types";
import type { WeekAssignment } from "@/lib/lifestyle/types";

/** Session types that are a day of training rather than a gym session. The
    member's own program says so; Reserve does not reclassify their day. */
const SESSION_TYPE_ACTIVITY: Partial<Record<ProgramDaySessionType, SplitActivityKey>> = {
  track: "track",
  sprint: "track",
  conditioning: "conditioning",
  sport: "sport",
  mobility: "mobility",
};

const SESSION_TYPE_RESTS: ProgramDaySessionType[] = ["rest", "recovery"];

/** A parsed date key at local noon, clear of DST edges. */
function atNoon(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

function programDayToResolved(base: (typeof RESERVE_WEEK_SPLIT)[number], day: ProgramDayDefinition): ResolvedDay {
  const title = day.title.trim() || base.title;
  const objective = day.sessionObjective?.trim() || "";
  const targets = [...day.primaryTargets, ...day.secondaryTargets].filter(Boolean).join(" · ");

  if (SESSION_TYPE_RESTS.includes(day.sessionType)) {
    return {
      ...base,
      title,
      displayTitle: title,
      splitKey: "recovery",
      transform: "none",
      chestUpper: false,
      recovery: true,
      goal: objective || "Rest day — set by your program",
      reason: `${title} is a rest day in your program.`,
      protect: "Keep it restful. The next session is built tonight.",
    };
  }

  const activityKey = SESSION_TYPE_ACTIVITY[day.sessionType];
  const activityDef = activityKey ? splitActivity(activityKey) : null;
  if (activityDef) {
    return {
      ...base,
      title,
      displayTitle: title,
      /* No lifting template: an activity day must never load a gym session,
         whatever its title happens to match. */
      splitKey: null,
      transform: "none",
      chestUpper: false,
      recovery: false,
      activity: {
        key: activityDef.key,
        label: title,
        load: activityDef.load,
        durationMinutes: day.expectedDurationMinutes ?? activityDef.defaultMinutes,
      },
      goal: objective || activityDef.goal,
      reason: `${title} is your program's ${base.dayLong} session.`,
      protect:
        activityDef.load === "high"
          ? "A hard session — fuel and sleep for it like a lifting day."
          : "Keep the next lifting session in view.",
    };
  }

  /* A lifting day. The engine key comes from the member's own title, and a
     title Reserve has no template for keeps its name and carries null —
     the cockpit then says so rather than loading something else. */
  return {
    ...base,
    title,
    displayTitle: title,
    splitKey: resolveSplitKey(title),
    transform: "none",
    chestUpper: false,
    recovery: false,
    goal: objective || targets || "Your program's session",
    reason: `${title} is your program's ${base.dayLong} session.`,
    protect: "Protect tomorrow's output — quality volume, no junk sets.",
  };
}

/**
 * The member's program as the week Reserve renders.
 *
 * `weekDates` are the seven YYYY-MM-DD keys of the week being shown, Monday
 * first (`weekDateKeys` in split-customization). Each is resolved through the
 * program engine, so today-only overrides, member-authored days and Reserve's
 * optimized versions all land exactly as the cockpit resolves them.
 *
 * Returns null when no program governs any of those dates — the caller then
 * keeps whatever it resolved before, unchanged.
 */
export function buildProgramResolvedWeek(input: {
  programs: ProgramDefinition[];
  activeProgramId: string | null;
  assignments: WeekAssignment[];
  overrides: ProgramDayOverride[];
  weekDates: string[];
}): ResolvedDay[] | null {
  if (input.programs.length === 0) return null;

  const resolved = RESERVE_WEEK_SPLIT.map((base) => {
    const dateKey = input.weekDates[base.dayIndex];
    const date = dateKey ? atNoon(dateKey) : null;
    if (!date) return null;
    return resolveProgramDayForDate({
      programs: input.programs,
      activeProgramId: input.activeProgramId,
      assignments: input.assignments,
      overrides: input.overrides,
      date,
    });
  });

  /* Nothing resolved for any day of this week — the member has programs but
     none of them governs it. Say nothing rather than half a week. */
  if (resolved.every((entry) => entry === null)) return null;

  return RESERVE_WEEK_SPLIT.map((base, i) => {
    const entry = resolved[i];
    /* A gap inside a governed week is honest: the program has no day at this
       rotation position, so nothing is planned and nothing can be missed. */
    if (!entry) {
      return {
        ...base,
        title: "No session",
        displayTitle: "No session",
        unprogrammed: true,
        splitKey: "recovery",
        transform: "none",
        chestUpper: false,
        recovery: true,
        goal: "Not in your program",
        reason: "Your program has no session at this position. Reserve did not substitute one.",
        protect: "Add a day to your program, or rest.",
      };
    }
    return programDayToResolved(base, entry.day);
  });
}
