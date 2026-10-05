/* ════════════════════════════════════════════════════════════════════════
   MEMBER SPLIT EXPLANATION

   When a member chose their split, the program explanation must stop
   describing the program's own week. The lines about the week — the
   summary, what the split does, the weekly logic and why the frequency
   fits — are rewritten from the member's split and rest day. The program's
   guidance on body composition, recovery, nutrition, monitoring and change
   stays, because the program still sets phase, volume and progression.

   Pure and deterministic.
   ════════════════════════════════════════════════════════════════════════ */

import { buildArchitectureResolvedWeek } from "./daily-context";
import { memberSplitWeekStructure, type MemberSplit } from "./member-split";
import type { PersonalizedProtocolExplanation } from "./protocol-explanation";

const NUM_WORD = ["zero", "one", "two", "three", "four", "five", "six", "seven"];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const NO_CHEST = { active: false, upperChest: false };

const numWord = (n: number) => NUM_WORD[n] ?? String(n);

/** "a", "a and b", "a, b and c" */
function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function legLine(split: MemberSplit, hasLegsDay: boolean, legsLead: string | undefined): string | null {
  if (!hasLegsDay) return null;
  if (legsLead === "full") return "Legs trains the whole lower body, because it is the only lower-body day in the week.";
  const priorities = split.musclePriority.map((p) => p.toLowerCase());
  if (priorities.some((p) => /glute|hamstring|posterior/.test(p))) {
    return "Legs leads with hamstrings and glutes every week, because you marked them as a weak point.";
  }
  if (priorities.some((p) => /quad/.test(p))) {
    return "Legs leads with quads every week, because you marked them as a weak point.";
  }
  return "Legs changes its lead week to week — quads first one week, hamstrings and glutes the next — so the lower body develops evenly.";
}

export function explainWithMemberSplit(
  explanation: PersonalizedProtocolExplanation,
  input: { split: MemberSplit; programName: string; availableDays: number | null; weekNumber: number },
): PersonalizedProtocolExplanation {
  const { split, programName, availableDays, weekNumber } = input;
  const name = split.architecture.name;

  const week = buildArchitectureResolvedWeek(split.architecture, NO_CHEST, weekNumber, {
    restDayIndex: split.restDayIndex,
    musclePriority: split.musclePriority,
  });
  const trainingDays = week.filter((d) => !d.recovery);
  const restDays = week.flatMap((d, i) => (d.recovery ? [WEEKDAYS[i]] : []));
  const count = trainingDays.length;
  const titles = [...new Set(trainingDays.map((d) => d.title))];

  /* Muscles trained twice or more, in the split's own order. */
  const authored = memberSplitWeekStructure({ ...split, restDayIndex: null }, weekNumber);
  const exposures = new Map<string, number>();
  for (const day of authored) for (const muscle of day.emphasis) exposures.set(muscle, (exposures.get(muscle) ?? 0) + 1);
  const twicePlus = [...exposures].filter(([, n]) => n >= 2).map(([m]) => m);

  const legsDay = trainingDays.find((d) => d.legLead);
  const hasFinishers = trainingDays.some((d) => d.splitKey === "push" || d.splitKey === "pull");

  const restPhrase = restDays.length ? `, with ${listOf(restDays)} for recovery` : "";
  const summary = [
    `You chose ${name}: ${numWord(count)} training days — ${listOf(titles)}${restPhrase}.`,
    `${programName} keeps setting the phase, weekly volume and progression inside those days.`,
  ].join(" ");

  const whatThisSplitDoes = [
    twicePlus.length
      ? `Across the week, ${listOf(twicePlus.slice(0, 5))} each get at least two sessions.`
      : "Every region is trained once across the week.",
    ...(hasFinishers ? ["Push and Pull days end with abs, cardio and an optional sauna."] : []),
    ...[legLine(split, Boolean(legsDay), legsDay?.legLead)].filter((line): line is string => Boolean(line)),
  ];

  const weeklyLogic = [
    restDays.length === 1
      ? `The rotation turns around ${restDays[0]}, so the order of the days never changes.`
      : restDays.length > 1
        ? `The rotation turns around your rest days, ${listOf(restDays)}, so the order of the days never changes.`
        : "Every day of the week trains, in the split's own order.",
  ];

  const whyThisProtocol =
    availableDays == null
      ? [`The split trains ${numWord(count)} days. Reserve does not know how many days you have available yet.`]
      : count <= availableDays
        ? [count === availableDays
            ? `The split uses all ${numWord(count)} of the days you said you have.`
            : `The split uses ${numWord(count)} of the ${numWord(availableDays)} days you said you have.`]
        : [`The split trains ${numWord(count)} days and you said you have ${numWord(availableDays)}. Reserve keeps your split as chosen — that gap is the main compromise in running it.`];

  return {
    ...explanation,
    headline: `${name} · ${numWord(count)} days · ${programName}`,
    summary,
    whatThisSplitDoes,
    weeklyLogic,
    whyThisProtocol,
  };
}
