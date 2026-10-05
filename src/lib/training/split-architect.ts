/* ════════════════════════════════════════════════════════════════════════
   SPLIT ARCHITECT — Reserve's split-system catalog + recommendation engine.

   Few, strong, high-status split systems. Reserve recommends ONE, offers at
   most two Reserve alternatives, and a custom identity lane. The member never
   shops through a long generic split menu.

   Weak points shape emphasis INSIDE a complete split — they never become the
   split itself. No outcome guarantees anywhere. Pure deterministic helpers;
   no store access.
   ════════════════════════════════════════════════════════════════════════ */

export type SplitSystemKey =
  | "reserve-physique"
  | "advanced-hypertrophy-rotation"
  | "classic-symmetry"
  | "lean-mass"
  | "recomp-performance"
  | "event-ready"
  // Named architectures — directly selectable from the deeper catalog.
  | "arnold"
  | "ppl"
  | "ppl-ul"
  | "upper-lower"
  | "powerbuilding"
  | "strength-hypertrophy"
  | "hybrid-athlete"
  | "high-frequency"
  | "recovery-constrained"
  | "elite-six"
  | "contest-prep"
  | "pplula"
  | "bro-split"
  | "full-body-3"
  | "hybrid-bodybuilder"
  | "hybrid-runner"
  // Lower-led — the women's lane.
  | "lower-priority-ul"
  | "glute-priority"
  | "runway-athletic"
  | "glute-crown-six";

export type SplitSystem = {
  key: SplitSystemKey;
  name: string;
  /** One confident premium line. */
  tagline: string;
  /** Who the system is designed for. */
  designedFor: string;
  /** What the week leans into. */
  emphasis: string;
  /** High-demand systems suit advanced members with strong recovery. */
  demand: "standard" | "high";
  /** Who the system is offered to. Absent = everyone. "womens" keeps it out of
      a male member's catalog, recommendation and deeper disclosure. */
  audience?: "womens";
};

export const SPLIT_SYSTEMS: SplitSystem[] = [
  {
    key: "reserve-physique",
    name: "Reserve Physique Split",
    tagline: "Premium default. Balanced aesthetic hypertrophy for a complete physique.",
    designedFor: "Members who want size, shape, proportion, and consistency.",
    emphasis: "Complete development — every region progresses together, week after week.",
    demand: "standard",
  },
  {
    key: "advanced-hypertrophy-rotation",
    name: "Advanced Hypertrophy Rotation",
    tagline: "High-output rotation for experienced lifters with strong recovery.",
    designedFor: "Advanced members chasing maximum hypertrophy. More demanding. More volume. More precision.",
    emphasis: "High weekly output with deliberate recovery placement to keep quality from slipping.",
    demand: "high",
  },
  {
    key: "classic-symmetry",
    name: "Classic Symmetry Split",
    tagline: "Aesthetic proportion — push, pull, legs, delts and arms, and a detail wave.",
    designedFor: "Members building the classic look. Not one weak-point gimmick — the full physique.",
    emphasis: "Proportion first: upper/lower balance, shoulder-to-waist line, and finishing detail.",
    demand: "standard",
  },
  {
    key: "lean-mass",
    name: "Lean Mass Split",
    tagline: "Muscle-building structure with enough recovery to keep performance climbing.",
    designedFor: "Members prioritizing new size without sloppy fatigue.",
    emphasis: "Progressive overload on the anchor lifts with recovery protected around them.",
    demand: "standard",
  },
  {
    key: "recomp-performance",
    name: "Recomp Performance Split",
    tagline: "A leaner structure balancing fat loss, strength retention, conditioning, and recovery.",
    designedFor: "Members getting leaner while holding strength and output.",
    emphasis: "Strength retention under a controlled deficit, with conditioning placed where it doesn't steal recovery.",
    demand: "standard",
  },
  {
    key: "event-ready",
    name: "Event-Ready Split",
    tagline: "For a real deadline — vacation, photoshoot, wedding, or a summer target.",
    designedFor: "Members training toward a date. No transformation guarantees — just intelligent structure.",
    emphasis: "Timeline-aware structure: output now, recovery protected, peak sharpness near the date.",
    demand: "standard",
  },
  /* ── Named architectures — the coach-designed structural library ── */
  {
    key: "elite-six",
    name: "Elite Six-Day Architecture",
    tagline: "Chest/Back · Legs · Conditioning · Arms/Delts · Legs · Chest/Back — the athlete standard.",
    designedFor: "Advanced athletes who train six days and recover like professionals.",
    emphasis: "Two upper-torso waves, two lower waves, one dedicated engine day.",
    demand: "high",
  },
  {
    key: "arnold",
    name: "Arnold Split",
    tagline: "The classic antagonist pairing — chest/back, shoulders/arms, legs, twice through.",
    designedFor: "Members chasing the golden-era density and pump quality.",
    emphasis: "Antagonist supersets and twice-weekly frequency for every region.",
    demand: "high",
  },
  {
    key: "contest-prep",
    name: "Contest Prep Architecture",
    tagline: "Chest/Back, legs, delts and arms, posterior detail, a detail wave and conditioning — for a stage date.",
    designedFor: "Competitors in a prep who want chest and back paired.",
    emphasis: "Strength retention, stage detail, and conditioning placed clear of the lifting days.",
    demand: "high",
  },
  {
    key: "ppl",
    name: "Push / Pull / Legs",
    tagline: "The modern standard — every pattern twice weekly across six clean days.",
    designedFor: "Members who like clear pattern-based days with simple recovery logic.",
    emphasis: "Pattern purity: pressing, pulling, and lower work never compete.",
    demand: "high",
  },
  {
    key: "ppl-ul",
    name: "PPL + Upper / Lower",
    tagline: "Five quality days — PPL through mid-week, dense composites to finish.",
    designedFor: "Members wanting twice-weekly frequency inside a 5-day week.",
    emphasis: "PPL precision plus composite density where it counts.",
    demand: "standard",
  },
  {
    key: "upper-lower",
    name: "Upper / Lower",
    tagline: "Four decisive days — strength waves early, volume waves late.",
    designedFor: "Members with four real training days and a full life around them.",
    emphasis: "Strength then volume for both halves, recovery guaranteed between.",
    demand: "standard",
  },
  {
    key: "powerbuilding",
    name: "Powerbuilding",
    tagline: "Top-set strength up front, hypertrophy volume behind it.",
    designedFor: "Members who want visible strength numbers AND a physique.",
    emphasis: "Heavy top sets on the anchors, back-off and volume days for size.",
    demand: "standard",
  },
  {
    key: "strength-hypertrophy",
    name: "Strength-Hypertrophy",
    tagline: "A strength wave then a hypertrophy wave — every week.",
    designedFor: "Members progressing load and size in the same block.",
    emphasis: "Heavy composites early; growth-range volume late.",
    demand: "high",
  },
  {
    key: "hybrid-athlete",
    name: "Hybrid Athlete",
    tagline: "Strength plus a real engine — conditioning has its own days.",
    designedFor: "Members who compete, run, or refuse to choose between strong and conditioned.",
    emphasis: "Full-body strength, dedicated engine days, recovery managed across both.",
    demand: "standard",
  },
  {
    key: "high-frequency",
    name: "High-Frequency Physique",
    tagline: "Three upper waves, two lower waves, one detail wave — six days.",
    designedFor: "Advanced members whose progress runs on frequency.",
    emphasis: "Short, sharp, frequent exposures with a weak-point closing wave.",
    demand: "high",
  },
  {
    key: "recovery-constrained",
    name: "Recovery-Constrained Split",
    tagline: "Four sessions, wide spacing — for seasons when recovery is the limiter.",
    designedFor: "Members under heavy life load, travel, or a recovery-limited phase.",
    emphasis: "Complete sessions with programmed recovery between every exposure.",
    demand: "standard",
  },
  {
    key: "pplula",
    name: "Push / Pull / Legs / Arms / Upper / Lower",
    tagline: "Push, pull, legs, an arm day, then upper and lower — around the rest day you choose.",
    designedFor: "Bodybuilders and hybrid athletes who train six days.",
    emphasis: "Pattern days first, arms on their own day, composite density to close the cycle.",
    demand: "high",
  },
  {
    key: "bro-split",
    name: "Classic Bodybuilding Split",
    tagline: "Chest, back, legs, shoulders, arms — one region per day.",
    designedFor: "Members who train each region to completion once a week.",
    emphasis: "Full session volume per region, with a full week of recovery before it returns.",
    demand: "standard",
  },
  {
    key: "full-body-3",
    name: "Full Body ×3",
    tagline: "Three complete sessions — every pattern, every time.",
    designedFor: "Members with three real training days, or returning to training.",
    emphasis: "Frequency through complete sessions, with a full day between each.",
    demand: "standard",
  },
  {
    key: "hybrid-bodybuilder",
    name: "Hybrid Bodybuilder",
    tagline: "Push, pull, a track day, legs, upper, and a full-body finisher.",
    designedFor: "Physique athletes who also sprint, run, or train for sport.",
    emphasis: "Speed work placed on fresh legs, with the lifting built around it.",
    demand: "high",
  },
  {
    key: "hybrid-runner",
    name: "Hybrid Runner",
    tagline: "Upper, lower and full-body strength around a run and a long run.",
    designedFor: "Members who run seriously and want to keep their strength.",
    emphasis: "Strength work placed well clear of the long run.",
    demand: "standard",
  },
  /* ── The lower-led lane. Every other system here opens on chest, back or
     push; these open on the glutes while the reserve is full. ── */
  {
    key: "lower-priority-ul",
    name: "Crown Four",
    tagline: "Two glute days and two upper days, in four sessions.",
    designedFor: "Members who want glutes to lead on a four-day week.",
    emphasis: "Glute strength then glute shape, with the upper line kept balanced.",
    demand: "standard",
    audience: "womens",
  },
  {
    key: "glute-priority",
    name: "Crown Five",
    tagline: "Three glute exposures — strength, shape, then density.",
    designedFor: "Members whose primary goal is glute development.",
    emphasis: "Each glute day trains a different quality; two upper days frame the waist.",
    demand: "standard",
    audience: "womens",
  },
  {
    key: "runway-athletic",
    name: "Runway Athletic",
    tagline: "Glute strength, posterior-chain power, and a density circuit.",
    designedFor: "Members who want shape and real athletic output in one week.",
    emphasis: "Heavy, explosive and dense lower work, with low-impact conditioning to close.",
    demand: "high",
    audience: "womens",
  },
  {
    key: "glute-crown-six",
    name: "Crown Six",
    tagline: "Three glute exposures across six days, with an arm day.",
    designedFor: "Members with the recovery and the schedule for six sessions.",
    emphasis: "Maximum glute priority without losing the shoulder line or the waist.",
    demand: "high",
    audience: "womens",
  },
];

const SYSTEM_BY_KEY = new Map(SPLIT_SYSTEMS.map((s) => [s.key, s]));

export function getSplitSystem(key: string | null | undefined): SplitSystem | null {
  if (!key) return null;
  return SYSTEM_BY_KEY.get(key as SplitSystemKey) ?? null;
}

export function isSplitSystemKey(key: string): key is SplitSystemKey {
  return SYSTEM_BY_KEY.has(key as SplitSystemKey);
}

/* ─── Recommendation ──────────────────────────────────────────────────────── */
export type SplitArchitectInput = {
  /** Free-text goal (active protocol goal, else profile goal). */
  goal: string;
  /** Member's physique archetype key, when set (e.g. "classic-physique"). */
  physiqueArchetype?: string;
  /** Advanced experience (member-set experience level / persona). */
  advanced: boolean;
  /** Member's own fatigue-sensitivity setting suggests recovery headroom. */
  recoveryStrong: boolean;
  trainingDaysPerWeek: number;
  /** Formatted weak-point labels (e.g. "Delts", "Upper Chest"). */
  weakPointLabels: string[];
  /** A member-entered timeline/deadline exists (setup profile). */
  hasDeadline: boolean;
  /** The member is on the women's path (female identity, or Reserve Women
      enabled). The Architect used to receive no gender signal at all, which is
      why a member whose whole goal was glutes was recommended an Arnold split. */
  womensPath?: boolean;
};

export type SplitConfidence = "high" | "moderate" | "calibrating";

export type SplitRecommendation = {
  recommended: SplitSystem;
  /** "Built for …" — composed only from real inputs. */
  reason: string;
  /** How weak points are emphasised INSIDE the split. */
  weakPointEmphasis: string;
  /** How much real member data informed this read. */
  confidence: SplitConfidence;
  confidenceNote: string;
  /** Honest demand read for THIS member. */
  recoveryDemand: string;
  /** How the member's schedule carries the structure. */
  scheduleFit: string;
  /** At most two Reserve alternatives. */
  alternatives: SplitSystem[];
  /** Remaining systems — kept deeper, behind a quiet disclosure. */
  deeper: SplitSystem[];
  /** Why the strongest alternatives were set aside — concise, honest. */
  rejected: Array<{ name: string; reason: string }>;
};

type GoalRead = { key: SplitSystemKey; clause: string };

function readGoal(input: SplitArchitectInput): GoalRead {
  const g = input.goal.toLowerCase();
  const archetype = (input.physiqueArchetype ?? "").toLowerCase();

  /* The lower-led reads sit at the very top for a member on the women's path.
     "Grow my glutes" used to match /grow/ and land on a mass split, and
     "shape" matched nothing at all — there was no read for either. Gated on
     womensPath so the lane is never recommended to a member it is not for. */
  if (input.womensPath) {
    const glutes = /\b(glute|glutes|booty|butt|hourglass|curves?)\b/.test(g);
    const shape = /\b(shape|sculpt|sculpted|tone|toned|runway|swim|resort|bikini|lean legs)\b/.test(g);
    if (glutes || shape) {
      const clause = glutes
        ? "your goal puts the glutes first"
        : "your goal is shape and the line it builds";
      if (/\b(sport|athletic|athlete|power|explosive|performance)\b/.test(g)) {
        return { key: "runway-athletic", clause: `${clause} and you want real athletic output with it` };
      }
      if (input.trainingDaysPerWeek >= 6) return { key: "glute-crown-six", clause: `${clause}, and your week carries six sessions` };
      if (input.trainingDaysPerWeek <= 4) return { key: "lower-priority-ul", clause: `${clause} on a four-day week` };
      return { key: "glute-priority", clause: clause };
    }
  }
  if (input.hasDeadline || /event|photoshoot|photo shoot|wedding|vacation|summer|deadline|peak week/.test(g)) {
    return { key: "event-ready", clause: "your timeline points at a real date" };
  }
  /* Hybrid reads sit ABOVE the recomp read on purpose: "conditioning" would
     otherwise match `condition` and send a runner to a recomp split. Word
     boundaries keep "trackable" or "rerun" from matching. */
  if (/\b(run|runs|runner|running|marathon|half marathon|5k|10k|endurance)\b/.test(g)) {
    return { key: "hybrid-runner", clause: "you run seriously and want to keep your strength" };
  }
  if (/\b(hybrid|track|sprint|sprinting|sprinter|speed)\b/.test(g)) {
    return { key: "hybrid-bodybuilder", clause: "you train for physique and for speed" };
  }
  if (/\b(ppl|push pull|push\/pull|bodybuilding|bodybuilder)\b/.test(g)) {
    return { key: "pplula", clause: "you train like a bodybuilder, six days, every region twice" };
  }
  if (/recomp|cut|shred|fat loss|lean out|leaner|condition/.test(g)) {
    return { key: "recomp-performance", clause: "your goal favors getting leaner while holding strength" };
  }
  if (/classic|symmetry|proportion|aesthetic/.test(g) || archetype.includes("classic")) {
    return { key: "classic-symmetry", clause: "your goal favors proportion and the classic line" };
  }
  if (/bulk|mass|size|gain|muscle|grow/.test(g)) {
    if (input.advanced && input.recoveryStrong) {
      return { key: "advanced-hypertrophy-rotation", clause: "your goal is maximum muscle and your recovery can carry high output" };
    }
    return { key: "lean-mass", clause: "your goal prioritizes new size with recovery protected" };
  }
  if (input.advanced && input.recoveryStrong && /hypertrophy|output|advanced|max/.test(g)) {
    return { key: "advanced-hypertrophy-rotation", clause: "your experience and recovery can carry a high-output rotation" };
  }
  return { key: "reserve-physique", clause: "your goal favors balanced, complete development" };
}

/** Two Reserve alternatives per recommendation — always complete systems. */
const ALTERNATIVES: Partial<Record<SplitSystemKey, [SplitSystemKey, SplitSystemKey]>> = {
  "reserve-physique": ["classic-symmetry", "lean-mass"],
  "advanced-hypertrophy-rotation": ["lean-mass", "reserve-physique"],
  "classic-symmetry": ["reserve-physique", "lean-mass"],
  "lean-mass": ["reserve-physique", "advanced-hypertrophy-rotation"],
  "recomp-performance": ["reserve-physique", "classic-symmetry"],
  "event-ready": ["recomp-performance", "reserve-physique"],
  pplula: ["bro-split", "lean-mass"],
  "bro-split": ["pplula", "reserve-physique"],
  "hybrid-bodybuilder": ["hybrid-runner", "pplula"],
  "hybrid-runner": ["hybrid-bodybuilder", "full-body-3"],
  "lower-priority-ul": ["glute-priority", "runway-athletic"],
  "glute-priority": ["glute-crown-six", "runway-athletic"],
  "runway-athletic": ["glute-priority", "glute-crown-six"],
  "glute-crown-six": ["glute-priority", "runway-athletic"],
};
const DEFAULT_ALTERNATIVES: [SplitSystemKey, SplitSystemKey] = ["reserve-physique", "classic-symmetry"];

/* Splits that pair chest with back. Members who want one choose it by name
   from the full catalog; Reserve never recommends or suggests them. */
const OPT_IN_ONLY = new Set<SplitSystemKey>(["arnold", "elite-six", "contest-prep"]);

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function buildSplitRecommendation(input: SplitArchitectInput): SplitRecommendation {
  const read = readGoal(input);
  let recommendedKey = read.key;

  // High-demand systems require the recovery to carry them — otherwise step
  // down to the complete standard-demand structure.
  if (recommendedKey === "advanced-hypertrophy-rotation" && !(input.advanced && input.recoveryStrong)) {
    recommendedKey = "lean-mass";
  }
  // Frequency step-down: a high-output rotation also needs the training days to
  // carry it. Fewer than five real days → the complete standard structure.
  if (recommendedKey === "advanced-hypertrophy-rotation" && input.trainingDaysPerWeek < 5) {
    recommendedKey = "reserve-physique";
  }
  /* The six-day bodybuilding and hybrid structures step down the same way: a
     week that cannot carry six sessions gets a five-day structure that still
     matches the member's identity, not a generic default. */
  if (recommendedKey === "pplula" && input.trainingDaysPerWeek < 6) {
    recommendedKey = input.trainingDaysPerWeek >= 5 ? "bro-split" : "reserve-physique";
  }
  if (recommendedKey === "hybrid-bodybuilder" && input.trainingDaysPerWeek < 6) {
    recommendedKey = "hybrid-runner";
  }

  const recommended = SYSTEM_BY_KEY.get(recommendedKey)!;
  let alternatives = (ALTERNATIVES[recommendedKey] ?? DEFAULT_ALTERNATIVES).map((k) => SYSTEM_BY_KEY.get(k)!);
  // Never offer the high-demand rotation to members it doesn't fit.
  if (!(input.advanced && input.recoveryStrong)) {
    alternatives = alternatives.map((a) =>
      a.key === "advanced-hypertrophy-rotation" ? SYSTEM_BY_KEY.get("classic-symmetry")! : a,
    );
    // De-duplicate if the swap collided with the other alternative.
    if (alternatives[0].key === alternatives[1].key) {
      alternatives[1] = SYSTEM_BY_KEY.get(alternatives[1].key === "reserve-physique" ? "lean-mass" : "reserve-physique")!;
    }
  }
  alternatives = alternatives.filter((a) => a.key !== recommendedKey && !OPT_IN_ONLY.has(a.key)).slice(0, 2);

  /* Audience gate. The lower-led lane is authored for the women's path; a
     member not on it never sees those systems anywhere in the Architect. */
  const offered = (sys: SplitSystem) => !sys.audience || (sys.audience === "womens" && Boolean(input.womensPath));
  alternatives = alternatives.filter(offered);

  const shown = new Set<SplitSystemKey>([recommendedKey, ...alternatives.map((a) => a.key)]);
  /* Lower-led systems lead the deeper catalog for a member on the women's
     path, so the lane is the first thing she reads rather than the last. */
  const deeper = SPLIT_SYSTEMS.filter((s) => !shown.has(s.key) && offered(s)).sort((a, b) => {
    if (!input.womensPath) return 0;
    return Number(b.audience === "womens") - Number(a.audience === "womens");
  });

  const scheduleClause = input.trainingDaysPerWeek >= 5
    ? `your schedule supports ${input.trainingDaysPerWeek} quality training days`
    : `your schedule fits ${input.trainingDaysPerWeek} training days with recovery protection`;

  const weakPoints = input.weakPointLabels.slice(0, 2);
  const emphasisClause = weakPoints.length
    ? `${formatList(weakPoints).toLowerCase()} can take extra emphasis inside it`
    : "the structure keeps the full physique progressing together";

  const reason = `Built for ${read.clause} — ${scheduleClause}, and ${emphasisClause}.`;

  const weakPointEmphasis = weakPoints.length
    ? `${formatList(weakPoints)} receive extra attention inside the split — the split itself stays complete.`
    : "Balanced emphasis — no weak points flagged, so every region carries equal priority.";

  /* Confidence — counts the real signals that informed this read. */
  const goalSpecific = recommendedKey !== "reserve-physique" || /balanc|physique|complete|consisten/.test(input.goal.toLowerCase());
  const signals = [goalSpecific, input.weakPointLabels.length > 0, input.trainingDaysPerWeek > 0, input.hasDeadline].filter(Boolean).length;
  const confidence: SplitConfidence = signals >= 3 ? "high" : signals === 2 ? "moderate" : "calibrating";
  const confidenceNote = confidence === "high"
    ? "Read from your goal, schedule, and physique priorities."
    : confidence === "moderate"
      ? "Read from your goal and schedule — physique priorities sharpen it further."
      : "Default read — set your goal and weak points to sharpen the recommendation.";

  /* Recovery demand — the system's demand against THIS member's recovery. */
  const recoveryDemand = recommended.demand === "high"
    ? "High output — your recovery settings can carry it. Sleep and meals stay non-negotiable."
    : input.recoveryStrong
      ? "Moderate — recovery days are built in and your settings carry it comfortably."
      : "Moderate — paced for protected recovery, matching your fatigue settings.";

  /* Schedule fit — the member's real week against the structure. */
  const scheduleFit = input.trainingDaysPerWeek >= 6
    ? `${input.trainingDaysPerWeek} training days — full structure runs as designed.`
    : input.trainingDaysPerWeek >= 4
      ? `${input.trainingDaysPerWeek} training days — strong fit with recovery protected.`
      : `${input.trainingDaysPerWeek} training days — sessions carry more per day; recovery stays wide.`;

  /* Explainability — why the strongest alternatives were set aside. */
  const rejectionReason = (s: SplitSystem): string => {
    if (s.demand === "high" && !(input.advanced && input.recoveryStrong)) {
      return "higher recovery demand than your current settings carry";
    }
    if (s.demand === "high" && input.trainingDaysPerWeek < 5) {
      return "built for more training days than your week has";
    }
    return "a strong fit — the recommendation edged it on your goal and schedule";
  };
  const rejected = [...alternatives, ...deeper.slice(0, 1)]
    .filter((s) => s.key !== recommendedKey)
    .slice(0, 2)
    .map((s) => ({ name: s.name, reason: rejectionReason(s) }));

  return { recommended, reason, weakPointEmphasis, confidence, confidenceNote, recoveryDemand, scheduleFit, alternatives, deeper, rejected };
}
