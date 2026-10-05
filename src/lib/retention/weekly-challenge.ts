/* ════════════════════════════════════════════════════════════════════════
   WEEKLY CHALLENGE — one earned, useful challenge per week.
   ------------------------------------------------------------------------
   Deterministic rotation keyed by the game-plan week so every member gets a
   fresh, relevant reason to open the app — training standards, recovery
   habits, fuel discipline. Lifestyle/behavior only: no medical content, no
   outcome guarantees.
   ════════════════════════════════════════════════════════════════════════ */

export type WeeklyChallenge = {
  id: string;
  title: string;
  detail: string;
  category: "training" | "recovery" | "fuel" | "discipline";
};

const CHALLENGES: WeeklyChallenge[] = [
  { id: "beat-one-lift", category: "training", title: "Beat one lift by a rep", detail: "Pick one compound and beat last week's top set by a single clean rep. One rep, full control — that's real progression." },
  { id: "sleep-anchor", category: "recovery", title: "Hold your sleep anchor 5 nights", detail: "Same wind-down time five nights this week. Recovery is built at night; the anchor is the habit that carries every session." },
  { id: "protein-first", category: "fuel", title: "Protein anchor at every meal", detail: "Open every plate with the protein source. Simple ordering discipline that keeps the day's target honest." },
  { id: "walk-after-lift", category: "recovery", title: "10-minute walk after every session", detail: "Every training day ends with a 10-minute cooldown walk. Low cost, real downshift." },
  { id: "log-every-set", category: "training", title: "Fully log two sessions", detail: "Log every working set in at least two sessions. Full data unlocks real progression targets next week." },
  { id: "hydration-floor", category: "fuel", title: "Hit the hydration floor daily", detail: "Reach your daily water target every day this week — set the bottle out the night before." },
  { id: "tempo-week", category: "training", title: "Own the eccentric", detail: "Every accessory this week: 3-second lowering phase. Same load feels new — control is the challenge." },
  { id: "phone-free-lifts", category: "discipline", title: "Phone-free working sets", detail: "Phone stays down between the first and last working set of each session. Presence is a performance tool." },
  { id: "early-wind-down", category: "recovery", title: "Screens off 30 minutes early", detail: "Close screens 30 minutes before your sleep target every night. The easiest recovery upgrade there is." },
  { id: "one-new-meal", category: "fuel", title: "Cook one new meal", detail: "Build one new custom meal in your kitchen this week and log it. Variety keeps the plan sustainable." },
  { id: "weak-point-first", category: "training", title: "Weak point goes first", detail: "Put your priority muscle's first movement at the top of the session while output is highest." },
  { id: "sunday-reset", category: "discipline", title: "Run the Sunday reset", detail: "Ten minutes on Sunday: review the week's sessions, pick the one thing to beat, prep the first meal." },
];

/** The week's challenge — deterministic by game-plan week. */
export function challengeForWeek(weekNumber: number): WeeklyChallenge {
  const idx = Math.abs(Math.round(weekNumber) - 1) % CHALLENGES.length;
  return CHALLENGES[idx];
}

/** Stable completion key: one completion per challenge per ISO week. */
export function challengeKey(challenge: WeeklyChallenge, now: Date = new Date()): string {
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((now.getTime() - start.getTime()) / 86_400_000 + start.getDay() + 1) / 7);
  return `${year}-w${week}-${challenge.id}`;
}
