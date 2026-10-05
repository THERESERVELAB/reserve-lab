/* ════════════════════════════════════════════════════════════════════════
   SPLIT ACTIVITIES — non-lifting days that live inside a split.

   Hybrid members do not run a pure lifting week. A bodybuilder on Push / Pull
   / Legs still has a track day, a Saturday run, or a 5:45 AM group class that
   stands in for leg day. Those are real training days with real load, and
   they belong in the split itself rather than in a separate calendar.

   Leaf module on purpose: no imports, so the architecture library, the
   customization layer and the UI can all share it without a cycle.

   EVERY LABEL HERE MUST RESOLVE TO NO LIFTING TEMPLATE. The template layer
   matches day titles by substring (`resolveSplitKey`), so a label like
   "Leg Class" would silently load a gym leg session on a class day. The
   split-customization test suite asserts this for every entry.
   ════════════════════════════════════════════════════════════════════════ */

export type SplitActivityKey =
  | "track"
  | "run"
  | "long-run"
  | "group-class"
  | "sport"
  | "conditioning"
  | "zone2"
  | "swim"
  | "cycling"
  | "yoga"
  | "mobility"
  /* Pilates existed as a SessionArchetype and inside ACTIVITY_STACKS, but not
     here — so a member who does Pilates twice a week had to file it as a
     "Group Class", which this module rates a HIGH load. It is the most common
     women's modality in the product and it was the one it could not name. */
  | "pilates"
  /* Reformer is a different session from mat work and members name it that
     way; filing it under the same key loses the distinction they care about. */
  | "reformer-pilates"
  | "barre"
  | "walk"
  | "hike"
  | "strength-class";

/** Honest training-load read for planning copy — never a prescription. */
export type SplitActivityLoad = "low" | "moderate" | "high";

export type SplitActivityDef = {
  key: SplitActivityKey;
  label: string;
  goal: string;
  load: SplitActivityLoad;
  defaultMinutes: number;
};

export const SPLIT_ACTIVITIES: SplitActivityDef[] = [
  { key: "track", label: "Track Session", goal: "Sprint and speed work", load: "high", defaultMinutes: 60 },
  { key: "run", label: "Run", goal: "Aerobic running", load: "moderate", defaultMinutes: 40 },
  { key: "long-run", label: "Long Run", goal: "Distance and aerobic base", load: "moderate", defaultMinutes: 75 },
  { key: "group-class", label: "Group Class", goal: "Studio or group fitness session", load: "high", defaultMinutes: 60 },
  { key: "sport", label: "Sport Session", goal: "Game, match, or practice", load: "high", defaultMinutes: 90 },
  { key: "conditioning", label: "Conditioning", goal: "Intervals or circuit work", load: "moderate", defaultMinutes: 30 },
  { key: "zone2", label: "Zone 2 Cardio", goal: "Easy steady-state cardio", load: "low", defaultMinutes: 45 },
  { key: "swim", label: "Swim", goal: "Pool session", load: "moderate", defaultMinutes: 45 },
  { key: "cycling", label: "Cycling", goal: "Bike session", load: "moderate", defaultMinutes: 60 },
  { key: "yoga", label: "Yoga", goal: "Mobility and control", load: "low", defaultMinutes: 45 },
  { key: "mobility", label: "Mobility", goal: "Joint prep and range work", load: "low", defaultMinutes: 20 },
  { key: "pilates", label: "Pilates", goal: "Core control, posture and breath", load: "low", defaultMinutes: 50 },
  { key: "reformer-pilates", label: "Reformer Pilates", goal: "Spring-loaded control and range", load: "moderate", defaultMinutes: 50 },
  { key: "barre", label: "Barre", goal: "Low-load endurance and posture", load: "moderate", defaultMinutes: 55 },
  { key: "walk", label: "Walk", goal: "Easy steady-state movement", load: "low", defaultMinutes: 40 },
  { key: "hike", label: "Hike", goal: "Long outdoor effort on varied ground", load: "moderate", defaultMinutes: 90 },
  { key: "strength-class", label: "Strength Class", goal: "Coached group strength session", load: "high", defaultMinutes: 55 },
];

const BY_KEY = new Map(SPLIT_ACTIVITIES.map((a) => [a.key, a]));

export function splitActivity(key: string | null | undefined): SplitActivityDef | null {
  if (!key) return null;
  return BY_KEY.get(key as SplitActivityKey) ?? null;
}
