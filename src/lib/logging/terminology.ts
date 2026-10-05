/**
 * FINAL BOSS ATHLETE — Training Terminology Glossary
 *
 * Maps technical shorthand to plain-English labels with definitions and examples.
 * Used in:
 * - Education modals
 * - Exercise prescription displays
 * - Science Intelligence Panel
 * - Tooltip overlays
 *
 * Design principle: Never make the user feel dumb for not knowing the jargon.
 * Always show the label next to the shorthand.
 */

export type TermCategory = "training" | "nutrition" | "recovery" | "physique" | "science";

export type TermEntry = {
  shorthand: string;       // e.g. "RIR"
  label: string;           // e.g. "Reps Left in Reserve"
  definition: string;      // 1-2 sentence explanation
  example: string;         // concrete example
  category: TermCategory;
  relatedTerms?: string[]; // other shorthands
};

/* ─── Glossary ───────────────────────────────────────── */

export const TERMINOLOGY: TermEntry[] = [
  /* ── Training ── */
  {
    shorthand: "RIR",
    label: "Reps Left in Reserve",
    definition:
      "How many more reps you could complete before reaching complete muscular failure. RIR 2 means you stopped with 2 reps still available. The primary intensity gauge used in evidence-based programming.",
    example:
      "You complete 10 reps and stop — but you could have done 12 with clean form. Your RIR = 2.",
    category: "training",
    relatedTerms: ["RPE"],
  },
  {
    shorthand: "RPE",
    label: "Effort Score (1–10)",
    definition:
      "Rate of Perceived Exertion on a 1–10 scale. RPE 10 = absolute failure, nothing left. RPE 7 = moderately hard with several reps in reserve. Complement to RIR.",
    example:
      "A set of 5 at RPE 8 feels hard but you could have done 2 more clean reps (RIR ≈ 2).",
    category: "training",
    relatedTerms: ["RIR"],
  },
  {
    shorthand: "MEV",
    label: "Minimum Effective Volume",
    definition:
      "The lowest number of weekly sets for a muscle group that produces measurable growth over time. Below MEV, training produces maintenance at best — no new tissue is added.",
    example:
      "Lat MEV = 8 sets/week. Training with 6 sets maintains current size but does not add new width.",
    category: "science",
    relatedTerms: ["MAV", "MRV"],
  },
  {
    shorthand: "MAV",
    label: "Best Growth Volume Range",
    definition:
      "Maximum Adaptive Volume — the range of weekly sets per muscle that produces the fastest rate of growth. The target zone for accumulation and intensification phases.",
    example:
      "Quad MAV = 16–20 sets/week. Programming in this range maximizes growth for most training blocks.",
    category: "science",
    relatedTerms: ["MEV", "MRV"],
  },
  {
    shorthand: "MRV",
    label: "Maximum Recoverable Volume",
    definition:
      "The highest number of weekly sets for a muscle that you can fully recover from. Exceeding MRV leads to performance drops, joint stress accumulation, and overreaching.",
    example:
      "Upper chest MRV = 22 sets/week. Programming above this without a deload = accumulated fatigue and regression.",
    category: "science",
    relatedTerms: ["MEV", "MAV"],
  },
  {
    shorthand: "S:F",
    label: "Stimulus-to-Fatigue Score",
    definition:
      "A measure of how much muscle growth stimulus an exercise generates relative to the total fatigue it creates. Higher S:F = more efficient exercise selection for hypertrophy.",
    example:
      "Cable fly: S:F ≈ 3.8 (high stimulus, low systemic fatigue). Barbell squat: S:F ≈ 2.1 (high fatigue, broad stimulus across many muscles).",
    category: "science",
    relatedTerms: ["MEV", "MRV"],
  },
  {
    shorthand: "Tempo",
    label: "Rep Speed Code",
    definition:
      "A four-number code: Eccentric (lowering) – Pause at bottom – Concentric (lifting) – Pause at top. X = explosive. Measured in seconds.",
    example:
      "3-1-X-1 = lower for 3 seconds, 1 second pause at stretch, explosive up, 1 second hold at top.",
    category: "training",
  },
  {
    shorthand: "Zone 2",
    label: "Zone 2 Cardio",
    definition:
      "Aerobic training at 60–70% of max heart rate. Fat oxidation is maximized, conversational pace is maintained, and CNS stress is minimal. Builds the aerobic base over time.",
    example:
      "Incline treadmill walk at 130–145 bpm for 20 minutes = Zone 2. You can speak in full sentences.",
    category: "training",
    relatedTerms: ["CNS"],
  },
  {
    shorthand: "Meso",
    label: "Training Block (Mesocycle)",
    definition:
      "A structured training period of 4–8 weeks with a specific goal. Volume and intensity systematically change each week. Followed by a deload before the next mesocycle.",
    example:
      "Week 6 of 8 Intensification Mesocycle: load is at weekly high, volume is held, recovery is closely monitored.",
    category: "training",
  },
  {
    shorthand: "1RM",
    label: "One-Rep Maximum",
    definition:
      "The maximum weight you can lift for exactly one complete rep with proper form. Used to calculate training percentages. Estimated 1RM = never test on compound lifts without spotters.",
    example:
      "If your 5-rep max on bench is 225 lbs, estimated 1RM ≈ 253 lbs (Epley formula).",
    category: "training",
  },
  {
    shorthand: "PR",
    label: "Personal Record",
    definition:
      "Your personal best performance — highest weight, reps, or volume for a given exercise. Setting PRs indicates progressive overload is working.",
    example:
      "PR on Hip Thrust: 5×10 at 315 lbs, up from 295 lbs last mesocycle.",
    category: "training",
  },

  /* ── Recovery ── */
  {
    shorthand: "HRV",
    label: "Heart Rate Variability",
    definition:
      "The variation in time between individual heartbeats. Higher HRV trends correlate with better autonomic recovery. Lower HRV may indicate accumulated fatigue, illness, or chronic stress. Directional trend matters more than single readings.",
    example:
      "HRV 74ms = strong readiness signal. HRV 52ms = elevated fatigue — consider modifying today's intensity.",
    category: "recovery",
    relatedTerms: ["CNS"],
  },
  {
    shorthand: "CNS",
    label: "Nervous System",
    definition:
      "The central nervous system (brain + spinal cord) coordinates all muscle activation. Heavy compound training stresses it significantly. CNS fatigue can persist 48–72 hours after maximal effort even when muscles feel recovered.",
    example:
      "Post-max-effort deadlift session: muscles may feel okay after 24h, but CNS output is still reduced. This is why deloads exist.",
    category: "recovery",
    relatedTerms: ["HRV"],
  },
  {
    shorthand: "RHR",
    label: "Resting Heart Rate",
    definition:
      "Heart rate measured at complete rest (typically on waking). Chronically elevated RHR can indicate overtraining, illness, or insufficient recovery. Trend direction matters more than any single measurement.",
    example:
      "Normal RHR 52 bpm. After two consecutive hard weeks without deload: RHR 62 bpm = recovery signal.",
    category: "recovery",
    relatedTerms: ["HRV"],
  },

  /* ── Nutrition ── */
  {
    shorthand: "TDEE",
    label: "Total Daily Calorie Burn",
    definition:
      "Total Daily Energy Expenditure — all calories burned in 24 hours including base metabolism, training, and daily activity. The reference point for setting caloric targets.",
    example:
      "TDEE 3,200 kcal: eating 2,800 = 400 kcal deficit (fat loss). Eating 3,600 = 400 kcal surplus (muscle building).",
    category: "nutrition",
  },
  {
    shorthand: "MPS",
    label: "Muscle Protein Synthesis",
    definition:
      "The biological process of building new muscle protein. Triggered by training stimulus AND protein intake. Requires adequate leucine content per meal to activate the mTOR pathway.",
    example:
      "Post-workout: whey provides fast leucine → activates MPS within 30 min. Casein is slower but sustains MPS longer.",
    category: "nutrition",
    relatedTerms: ["Leucine"],
  },
  {
    shorthand: "Leucine",
    label: "Leucine (Muscle Trigger Amino Acid)",
    definition:
      "A branched-chain amino acid involved in muscle protein synthesis signaling. Track intake patterns for nutrition context; review supplement questions with a qualified clinician.",
    example:
      "One scoop of whey protein (25g) contains ~2.5g leucine — the minimum threshold for MPS activation.",
    category: "nutrition",
    relatedTerms: ["MPS"],
  },

  /* ── Physique ── */
  {
    shorthand: "BF%",
    label: "Body Fat Percentage",
    definition:
      "The proportion of total body weight that is fat mass. Trend direction over 4+ weeks is meaningful. Single-point measurements have ±3–4% error across most consumer methods.",
    example:
      "Trending from 14% to 12% over 8 weeks = 2% reduction in fat mass while maintaining LBM.",
    category: "physique",
    relatedTerms: ["LBM"],
  },
  {
    shorthand: "LBM",
    label: "Lean Body Mass",
    definition:
      "Total body weight minus fat mass. Includes muscle, bone, organs, water, and connective tissue. The primary objective in recomposition is to increase or maintain LBM while reducing fat.",
    example:
      "Bodyweight 192 lbs at 10% BF = LBM of ~173 lbs. Goal: reach 185 lbs at 9% BF = LBM of ~168.5 lbs (trim fat, hold muscle).",
    category: "physique",
    relatedTerms: ["BF%"],
  },
  {
    shorthand: "FFMI",
    label: "Fat-Free Mass Index",
    definition:
      "Fat-Free Mass Index normalizes lean body mass for height. Useful for tracking physique progress over time independent of fat changes. Calculated as: LBM (kg) / height (m)².",
    example:
      "FFMI 22 = natty-range upper. FFMI 25+ = very advanced development. Above 26 is exceptional.",
    category: "physique",
    relatedTerms: ["LBM"],
  },
];

/* ─── Lookup Helpers ─────────────────────────────────── */

/** Fast lookup map — O(1) by shorthand (case-insensitive) */
export const GLOSSARY_MAP: Record<string, TermEntry> = Object.fromEntries(
  TERMINOLOGY.map((t) => [t.shorthand.toUpperCase(), t]),
);

export function getTerm(shorthand: string): TermEntry | null {
  return GLOSSARY_MAP[shorthand.toUpperCase()] ?? null;
}

export function getTermLabel(shorthand: string): string {
  return getTerm(shorthand)?.label ?? shorthand;
}

export function getTermsByCategory(category: TermCategory): TermEntry[] {
  return TERMINOLOGY.filter((t) => t.category === category);
}

export function searchTerms(query: string): TermEntry[] {
  const q = query.toLowerCase();
  return TERMINOLOGY.filter(
    (t) =>
      t.shorthand.toLowerCase().includes(q) ||
      t.label.toLowerCase().includes(q) ||
      t.definition.toLowerCase().includes(q),
  );
}

/**
 * Returns a display string: "RIR (Reps Left in Reserve)"
 * Used inline next to any shorthand in the UI.
 */
export function formatShorthand(shorthand: string): string {
  const entry = getTerm(shorthand);
  if (!entry) return shorthand;
  return `${shorthand} (${entry.label})`;
}
