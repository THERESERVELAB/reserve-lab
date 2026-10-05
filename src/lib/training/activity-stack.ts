/* ════════════════════════════════════════════════════════════════════════
   ACTIVITY STACK — lifestyle / outside-training context.

   Reserve knows the member does more than lift. The activity stack lets a
   member declare their weekly movement mix so the protocol preview can frame
   how Pilates, yoga, and sport fit — and so the plan can ease fatigue when
   outside load is high. Pure data + framing helpers. No medical claims, no
   prescriptions, no dosing.
   ════════════════════════════════════════════════════════════════════════ */

export type ActivityStack =
  | "gym-only"
  | "gym-pilates"
  | "gym-yoga"
  | "gym-sports"
  | "pilates-yoga"
  | "gym-pilates-yoga"
  | "gym-pilates-sports"
  | "full-hybrid";

export type SportType =
  | "pickleball"
  | "tennis"
  | "running"
  | "cycling"
  | "dance"
  | "soccer"
  | "basketball"
  | "recreational";

/** Outside-training load — "high" tells the plan to ease added fatigue. */
export type ActivityLoad = "low" | "moderate" | "high";

export type ActivityStackOption = {
  key: ActivityStack;
  label: string;
  /** One-line description of the weekly mix. */
  blurb: string;
  load: ActivityLoad;
  includesPilates: boolean;
  includesYoga: boolean;
  includesSport: boolean;
};

export const ACTIVITY_STACKS: ActivityStackOption[] = [
  { key: "gym-only", label: "Gym Only", blurb: "Training is the whole week — full recovery budget for the plan.", load: "low", includesPilates: false, includesYoga: false, includesSport: false },
  { key: "gym-pilates", label: "Gym + Pilates", blurb: "Pilates supports core, posture, and low-fatigue volume.", load: "moderate", includesPilates: true, includesYoga: false, includesSport: false },
  { key: "gym-yoga", label: "Gym + Yoga", blurb: "Yoga supports recovery, mobility, and breath control.", load: "moderate", includesPilates: false, includesYoga: true, includesSport: false },
  { key: "gym-sports", label: "Gym + Sports", blurb: "Sport adds conditioning load and some leg fatigue.", load: "high", includesPilates: false, includesYoga: false, includesSport: true },
  { key: "pilates-yoga", label: "Pilates + Yoga", blurb: "A low-impact mix — mobility, posture, and recovery led.", load: "low", includesPilates: true, includesYoga: true, includesSport: false },
  { key: "gym-pilates-yoga", label: "Gym + Pilates + Yoga", blurb: "Strength plus recovery-forward movement through the week.", load: "moderate", includesPilates: true, includesYoga: true, includesSport: false },
  { key: "gym-pilates-sports", label: "Gym + Pilates + Sports", blurb: "Strength, core support, and sport conditioning combined.", load: "high", includesPilates: true, includesYoga: false, includesSport: true },
  { key: "full-hybrid", label: "Full Hybrid Week", blurb: "Gym, Pilates, yoga, and sport — a high outside-load week.", load: "high", includesPilates: true, includesYoga: true, includesSport: true },
];

export const SPORT_OPTIONS: { key: SportType; label: string }[] = [
  { key: "pickleball", label: "Pickleball" },
  { key: "tennis", label: "Tennis" },
  { key: "running", label: "Running" },
  { key: "cycling", label: "Cycling" },
  { key: "dance", label: "Dance" },
  { key: "soccer", label: "Soccer" },
  { key: "basketball", label: "Basketball" },
  { key: "recreational", label: "Recreational Sport" },
];

const STACK_BY_KEY = new Map(ACTIVITY_STACKS.map((s) => [s.key, s]));

export function getActivityStack(key: ActivityStack | null | undefined): ActivityStackOption | null {
  if (!key) return null;
  return STACK_BY_KEY.get(key) ?? null;
}

export function activityLoad(key: ActivityStack | null | undefined): ActivityLoad {
  return getActivityStack(key)?.load ?? "low";
}

/**
 * Framing language for the protocol preview, composed from the member's stack
 * (and chosen sport). Pilates → core / posture / low-fatigue volume; yoga →
 * recovery / mobility / breath; sport → conditioning + leg-fatigue awareness.
 * High outside load adds an "ease added fatigue" note. No medical claims.
 */
export function activityStackLanguage(
  key: ActivityStack | null | undefined,
  sport?: SportType | null,
): string {
  const opt = getActivityStack(key);
  if (!opt || opt.key === "gym-only") {
    return "Gym only — the plan keeps the full recovery budget. Add Pilates, yoga, or sport if your week includes more than lifting.";
  }
  const parts: string[] = [];
  if (opt.includesPilates) parts.push("Pilates supports core, posture, and low-fatigue volume");
  if (opt.includesYoga) parts.push("yoga supports recovery, mobility, and breath control");
  if (opt.includesSport) {
    const sportLabel = sport ? SPORT_OPTIONS.find((s) => s.key === sport)?.label ?? "sport" : "sport";
    parts.push(`${sportLabel.toLowerCase()} adds conditioning and some leg fatigue`);
  }
  const clauses = parts.length ? parts : [opt.blurb];
  const first = clauses[0].charAt(0).toUpperCase() + clauses[0].slice(1);
  let sentence = [first, ...clauses.slice(1)].join("; ") + ".";
  if (opt.load === "high") {
    sentence += " With outside load running high, the plan eases training fatigue so recovery stays protected.";
  }
  return sentence;
}
