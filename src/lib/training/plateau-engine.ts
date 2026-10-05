/* ════════════════════════════════════════════════════════════════════════
   PLATEAU PREVENTION + MOVEMENT INTELLIGENCE ENGINE

   Reads the resolved workout template (movement-templates.ts), the member's
   weak-point focus (Physique V2), and recovery reserve (Recovery V2) and
   produces training intelligence: movement-pattern mapping, equipment
   classification, exercise-exposure + plateau risk, rotation suggestions,
   superset opportunities/avoids, and weak-point support signals.

   Deterministic + behavioral only. No real session history is fabricated —
   exposure is sample/estimated and clearly labeled until logged history is
   wired in. No medical claims, no compound/supplement guidance.
   ════════════════════════════════════════════════════════════════════════ */

import type { TemplateMovement, WorkoutTemplate } from "./workout-templates";
import { MOVEMENT_POOLS, poolForMuscle } from "./workout-templates";
import type { WeakPoint } from "@/lib/physique/types";
import type { GoalKey } from "@/lib/nutrition/types";
import { prescribeMovement } from "./prescription-engine";
import { GYM_ENVIRONMENT_LABEL, type UserTrainingProfile } from "./gym-environment";

const COLOR = {
  green: "#6ee7b7", steel: "#5fb7d5", gold: "#d5b15f", amber: "#e8c87a", red: "#ef7d55", slate: "#8ea0b8", violet: "#a78bfa",
};

/* ─── Movement patterns ───────────────────────────────────────────────── */
export type MovementPattern =
  | "Horizontal Press" | "Incline Press" | "Vertical Press"
  | "Horizontal Pull" | "Vertical Pull"
  | "Hip Hinge" | "Squat Pattern" | "Lunge Pattern" | "Knee Flexion" | "Hip Extension"
  | "Lateral Raise" | "Rear Delt" | "Curl" | "Triceps Extension" | "Calf Raise"
  | "Core Brace" | "Conditioning" | "Isolation";

export function classifyMovementPattern(name: string, muscle: string): MovementPattern {
  const n = name.toLowerCase();
  const m = muscle.toLowerCase();
  if (/lateral raise|side delt|y-raise|lean-away/.test(n)) return "Lateral Raise";
  if (/rear.delt|reverse (pec|fly)|face pull/.test(n)) return "Rear Delt";
  if (/curl/.test(n) && m.includes("bicep")) return "Curl";
  if (/pressdown|pushdown|triceps|skull|overhead.*extension|close-grip|dip/.test(n)) return "Triceps Extension";
  if (/calf|heel raise/.test(n)) return "Calf Raise";
  if (/leg curl|nordic|hamstring curl/.test(n)) return "Knee Flexion";
  if (/hip thrust|glute bridge|back extension|pull-through|hyperextension/.test(n)) return "Hip Extension";
  if (/romanian|stiff.leg|deadlift|good morning|rdl/.test(n)) return "Hip Hinge";
  if (/lunge|split squat|step-up|cossack/.test(n)) return "Lunge Pattern";
  if (/adductor|abductor/.test(n)) return "Isolation";
  if (/squat|hack|pendulum|leg press|leg extension/.test(n)) return "Squat Pattern";
  if (/incline/.test(n) && !/curl|row|fly/.test(n)) return "Incline Press";
  if (/overhead press|shoulder press|ohp|military/.test(n)) return "Vertical Press";
  if (/pec|chest fly|cable fly|reverse fly/.test(n)) return "Horizontal Press";
  if (/pulldown|pull-up|pullup|chin/.test(n)) return "Vertical Pull";
  if (/row|pullover/.test(n)) return "Horizontal Pull";
  if (/bench|chest press|converging|dip|push-up/.test(n) || (/press/.test(n) && m.includes("chest"))) return "Horizontal Press";
  if (/crunch|plank|pallof|carry|ab |knee raise|rollout/.test(n)) return "Core Brace";
  if (/treadmill|bike|stair|row(er)?|conditioning|sled/.test(n)) return "Conditioning";
  return "Isolation";
}

/* ─── Equipment intelligence ──────────────────────────────────────────── */
export type EquipmentType =
  | "Dumbbell" | "Barbell" | "Cable" | "Machine" | "Smith" | "Plate-Loaded" | "Bodyweight" | "Band" | "Specialty";

const PREMIUM_BRANDS = ["prime", "atlantis", "hammer strength", "panatta", "arsenal", "nautilus", "life fitness", "technogym", "cybex", "pendulum"];

export function classifyEquipment(equipment: string, name = ""): EquipmentType {
  const e = `${equipment} ${name}`.toLowerCase();
  if (PREMIUM_BRANDS.some((b) => e.includes(b))) return "Plate-Loaded";
  if (e.includes("smith")) return "Smith";
  if (e.includes("plate-loaded") || e.includes("plate loaded")) return "Plate-Loaded";
  if (e.includes("dumbbell")) return "Dumbbell";
  if (e.includes("barbell") || e.includes("ez-bar") || e.includes("t-bar")) return "Barbell";
  if (e.includes("cable")) return "Cable";
  if (e.includes("band")) return "Band";
  if (e.includes("bodyweight") || e.includes("pull-up") || e.includes("dip") || e.includes("push-up")) return "Bodyweight";
  if (e.includes("machine") || e.includes("pec deck") || e.includes("hack") || e.includes("pendulum") || e.includes("leg press")) return "Machine";
  return "Specialty";
}

export function isPremiumEquipment(equipment: string, name = ""): boolean {
  const e = `${equipment} ${name}`.toLowerCase();
  return PREMIUM_BRANDS.some((b) => e.includes(b));
}

/* ─── Plateau status + exposure ───────────────────────────────────────── */
export type PlateauStatus =
  | "progressing" | "stable" | "watch" | "plateau-risk" | "rotation-candidate" | "recovery-limited" | "data-limited";

const PLATEAU_META: Record<PlateauStatus, { label: string; color: string }> = {
  progressing: { label: "Progressing", color: COLOR.green },
  stable: { label: "Stable", color: COLOR.steel },
  watch: { label: "Watch", color: COLOR.amber },
  "plateau-risk": { label: "Plateau Risk", color: COLOR.red },
  "rotation-candidate": { label: "Rotation Candidate", color: COLOR.gold },
  "recovery-limited": { label: "Recovery Limited", color: COLOR.amber },
  "data-limited": { label: "Data Limited", color: COLOR.slate },
};

export function plateauLabel(s: PlateauStatus): string { return PLATEAU_META[s].label; }
export function plateauColor(s: PlateauStatus): string { return PLATEAU_META[s].color; }

export type ExposureTrend = "progressing" | "flat" | "declining" | "unknown";

export type ExerciseExposure = {
  movementId: string;
  name: string;
  pattern: MovementPattern;
  equipment: EquipmentType;
  premium: boolean;
  weeksActive: number;
  exposureCount: number;
  trend: ExposureTrend;
  status: PlateauStatus;
  /** True when weeks/trend are estimated, not from logged history. */
  sample: boolean;
  suggestion: string;
  alternatives: string[];
  weakPointRelevant: boolean;
  /** Gym-aware prescription (present when a training profile is supplied). */
  why?: string;
  premiumUpgrade?: string;
  homeOption?: string;
  recoveryFriendly?: string;
};

function seedFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/* ─── Weak-point → pattern/pool relevance ─────────────────────────────── */
const WEAK_POINT_POOLS: Record<WeakPoint, string[]> = {
  "upper-chest": ["upper-chest-press"],
  delts: ["side-delts", "shoulder-press", "rear-delts"],
  arms: ["biceps", "triceps"],
  "back-width": ["back-width", "lat-iso"],
  "back-thickness": ["back-thickness"],
  abs: ["core"],
  waist: ["core"],
  glutes: ["glutes"],
  hamstrings: ["hamstrings"],
  quads: ["quads"],
  calves: ["calves"],
};

const WEAK_POINT_LABEL: Record<WeakPoint, string> = {
  "upper-chest": "Upper Chest", delts: "Delts", arms: "Arms", "back-width": "Back Width",
  "back-thickness": "Back Thickness", abs: "Abs", waist: "Waist", glutes: "Glutes",
  hamstrings: "Hamstrings", quads: "Quads", calves: "Calves",
};

const WEAK_POINT_SIGNAL: Partial<Record<WeakPoint, string>> = {
  "upper-chest": "Incline press pattern should stay early in the session.",
  delts: "Delt priority active — keep lateral raise exposure strict and progressive.",
  arms: "Curl and triceps detail should stay clean and high-quality.",
  "back-width": "Vertical pull width work should stay a priority.",
  "back-thickness": "Row thickness work should stay controlled and paused.",
  glutes: "Hip extension volume should stay on the board.",
  hamstrings: "Keep a hinge and a knee-flexion exposure progressing.",
  quads: "Keep squat-pattern output early before fatigue.",
  calves: "Calf raise exposure should stay strict and frequent.",
  abs: "Core brace work supports the waist/abs target.",
  waist: "Core brace work supports the waist/abs target.",
};

function movementMatchesWeakPoint(muscle: string, weakPoints: WeakPoint[]): boolean {
  const pool = poolForMuscle(muscle);
  if (!pool) return false;
  return weakPoints.some((wp) => WEAK_POINT_POOLS[wp]?.includes(pool));
}

/* ─── Exposure (sample) for one movement ──────────────────────────────── */
function buildExposure(mv: TemplateMovement, weakPoints: WeakPoint[], recoveryLimited: boolean, profile: UserTrainingProfile | undefined, goal: GoalKey): ExerciseExposure {
  const seed = seedFrom(mv.id);
  const weeksActive = 2 + (seed % 8); // 2–9 weeks (sample)
  const exposureCount = weeksActive + (seed >> 3) % 4;
  const trendRoll = (seed >> 5) % 10;
  const trend: ExposureTrend = trendRoll < 5 ? "progressing" : trendRoll < 8 ? "flat" : "declining";
  const weakPointRelevant = movementMatchesWeakPoint(mv.targetMuscle, weakPoints);

  let status: PlateauStatus;
  if (recoveryLimited && mv.phase === "primary-output") status = "recovery-limited";
  else if (trend === "progressing") status = weeksActive >= 8 ? "watch" : "progressing";
  else if (trend === "flat") status = weeksActive >= 7 ? "rotation-candidate" : weeksActive >= 5 ? "watch" : "stable";
  else status = weeksActive >= 6 ? "plateau-risk" : "watch";

  const pattern = classifyMovementPattern(mv.name, mv.targetMuscle);
  // Gym-aware prescription when a profile is supplied; otherwise template subs.
  const rx = profile ? prescribeMovement({ pattern, target: mv.targetMuscle, profile, goal, recoveryLimited, weakPointRelevant }) : null;
  const pool = poolForMuscle(mv.targetMuscle);
  const alternatives = (rx && rx.alternatives.length
    ? rx.alternatives.map((a) => a.name)
    : (mv.substitutions.length ? mv.substitutions : (pool ? MOVEMENT_POOLS[pool] : [])))
    .filter((n) => n.toLowerCase() !== mv.name.toLowerCase())
    .slice(0, 4);

  const suggestion =
    status === "rotation-candidate" || status === "plateau-risk"
      ? `Output is ${trend}. Rotate to a same-pattern alternative for the next block.`
      : status === "watch"
        ? "Keep if performance is moving. Rotate only if output stalls another block."
        : status === "recovery-limited"
          ? "Recovery is limited — hold load and protect quality before pushing this."
          : "Progressing — keep the current progression clean.";

  return {
    movementId: mv.id, name: mv.name,
    pattern,
    equipment: classifyEquipment(mv.equipment, mv.name),
    premium: isPremiumEquipment(mv.equipment, mv.name),
    weeksActive, exposureCount, trend, status, sample: true,
    suggestion, alternatives, weakPointRelevant,
    why: rx?.why,
    premiumUpgrade: rx?.premiumUpgrade?.name,
    homeOption: rx?.homeOption?.name,
    recoveryFriendly: rx?.recoveryFriendly?.name,
  };
}

/* ─── Rotation suggestions ────────────────────────────────────────────── */
export type RotationSuggestion = { movementId: string; name: string; reason: string; alternatives: string[] };

/* ─── Superset intelligence ───────────────────────────────────────────── */
export type SupersetKind = "good" | "avoid";
export type SupersetSuggestion = { kind: SupersetKind; a: string; b: string; type: string; why: string };

function findByPattern(exps: ExerciseExposure[], pattern: MovementPattern): ExerciseExposure | undefined {
  return exps.find((e) => e.pattern === pattern);
}
function findByName(movs: TemplateMovement[], re: RegExp): TemplateMovement | undefined {
  return movs.find((m) => re.test(m.name.toLowerCase()));
}

function buildSupersets(movs: TemplateMovement[], exps: ExerciseExposure[], recoveryLimited: boolean): { good: SupersetSuggestion[]; avoid: SupersetSuggestion[] } {
  const good: SupersetSuggestion[] = [];
  const avoid: SupersetSuggestion[] = [];

  const lat = findByPattern(exps, "Lateral Raise");
  const rear = findByPattern(exps, "Rear Delt");
  if (lat && rear) good.push({ kind: "good", a: lat.name, b: rear.name, type: "Pump Superset", why: "High pump value with low performance risk." });

  const curl = findByPattern(exps, "Curl");
  const tri = findByPattern(exps, "Triceps Extension");
  if (curl && tri) good.push({ kind: "good", a: curl.name, b: tri.name, type: "Antagonist Superset", why: "Opposing arms — pump both without compromising either." });

  const legExt = findByName(movs, /leg extension/);
  const legCurl = findByName(movs, /leg curl/);
  if (legExt && legCurl) good.push({ kind: "good", a: legExt.name, b: legCurl.name, type: "Antagonist Superset", why: "Quads + hamstrings isolation pairs cleanly." });

  const calf = findByPattern(exps, "Calf Raise");
  const tib = findByName(movs, /tibialis|toe raise/);
  if (calf && tib) good.push({ kind: "good", a: calf.name, b: tib.name, type: "Pump Superset", why: "Lower-leg antagonists — efficient finisher." });

  // Avoid: stacked heavy compounds (primary-output, systemic patterns).
  const heavyPatterns: MovementPattern[] = ["Squat Pattern", "Hip Hinge", "Horizontal Press", "Vertical Pull", "Horizontal Pull", "Incline Press", "Vertical Press"];
  const heavy = exps.filter((e) => heavyPatterns.includes(e.pattern) && (e.equipment === "Barbell" || e.equipment === "Plate-Loaded" || e.equipment === "Smith"));
  const squat = findByPattern(exps, "Squat Pattern");
  const hinge = findByPattern(exps, "Hip Hinge");
  if (squat && hinge) avoid.push({ kind: "avoid", a: squat.name, b: hinge.name, type: "Avoid Heavy Compound Pairing", why: "Too much systemic fatigue for primary output." });
  else if (heavy.length >= 2) avoid.push({ kind: "avoid", a: heavy[0].name, b: heavy[1].name, type: "Avoid Heavy Compound Pairing", why: "Stacking heavy compounds early compromises primary output." });

  if (recoveryLimited && good.length > 0) {
    good.forEach((g) => { g.why = `${g.why} Keep volume honest — recovery is limited today.`; });
  }
  return { good: good.slice(0, 3), avoid: avoid.slice(0, 2) };
}

/* ─── Weak-point priority ─────────────────────────────────────────────── */
export type WeakPointPriority = { id: WeakPoint; label: string; signal: string; supportedToday: boolean };

/* ─── Snapshot ────────────────────────────────────────────────────────── */
export type TrainingIntelCard = {
  key: string;
  title: string;
  status: string;
  statusColor: string;
  why: string;
  actionLabel?: string;
  actionTarget?: string;
};

export type TrainingIntelligenceSnapshot = {
  hasSession: boolean;
  confidence: "sample" | "logged" | "data-limited";
  plateauStatus: PlateauStatus;
  recoveryLimited: boolean;
  cards: TrainingIntelCard[];
  exposures: ExerciseExposure[];
  rotation: RotationSuggestion[];
  supersets: { good: SupersetSuggestion[]; avoid: SupersetSuggestion[] };
  weakPoints: WeakPointPriority[];
};

export type TrainingIntelInput = {
  template: WorkoutTemplate | null;
  movements: TemplateMovement[];
  weakPoints: WeakPoint[];
  recoveryReserve: number | null;
  recoveryHasData: boolean;
  /** Gym environment + equipment profile — enables gym-aware prescriptions. */
  profile?: UserTrainingProfile;
  goal?: GoalKey;
};

const STATUS_ORDER: PlateauStatus[] = ["plateau-risk", "rotation-candidate", "recovery-limited", "watch", "stable", "progressing", "data-limited"];

export function buildTrainingIntelligence(input: TrainingIntelInput): TrainingIntelligenceSnapshot {
  const { template, movements, weakPoints, recoveryReserve, recoveryHasData, profile } = input;
  const goal: GoalKey = input.goal ?? "recomp";
  const recoveryLimited = recoveryHasData && recoveryReserve != null && recoveryReserve < 62;

  if (!template || movements.length === 0) {
    return {
      hasSession: false, confidence: "data-limited", plateauStatus: "data-limited", recoveryLimited,
      cards: [{ key: "session", title: "Session", status: "Data Limited", statusColor: COLOR.slate, why: "Select or generate today's session to activate training intelligence.", actionLabel: undefined, actionTarget: undefined }],
      exposures: [], rotation: [], supersets: { good: [], avoid: [] }, weakPoints: [],
    };
  }

  const exposures = movements.map((mv) => buildExposure(mv, weakPoints, recoveryLimited, profile, goal));

  // Overall plateau status = worst across the session.
  const worst = STATUS_ORDER.find((s) => exposures.some((e) => e.status === s)) ?? "stable";

  // Rotation candidates.
  const rotation: RotationSuggestion[] = exposures
    .filter((e) => e.status === "rotation-candidate" || e.status === "plateau-risk")
    .map((e) => ({ movementId: e.movementId, name: e.name, reason: `${e.weeksActive}-week exposure · ${e.trend} output`, alternatives: e.alternatives }))
    .slice(0, 3);

  // Movement variety = distinct patterns.
  const patterns = new Set(exposures.map((e) => e.pattern));
  const varietyStatus = patterns.size >= 6 ? "Strong" : patterns.size >= 4 ? "Balanced" : "Narrow";
  const varietyColor = patterns.size >= 6 ? COLOR.green : patterns.size >= 4 ? COLOR.steel : COLOR.amber;

  // Weak-point support.
  const weakPointPriorities: WeakPointPriority[] = weakPoints.map((wp) => {
    const supported = exposures.some((e) => e.weakPointRelevant && WEAK_POINT_POOLS[wp]?.includes(poolForMuscle(movements.find((m) => m.id === e.movementId)?.targetMuscle ?? "") ?? ""));
    return { id: wp, label: WEAK_POINT_LABEL[wp], signal: WEAK_POINT_SIGNAL[wp] ?? `${WEAK_POINT_LABEL[wp]} priority is active — keep relevant work progressive.`, supportedToday: supported };
  });

  const supersets = buildSupersets(movements, exposures, recoveryLimited);

  /* Cards */
  const cards: TrainingIntelCard[] = [];

  cards.push({
    key: "plateau", title: "Plateau Risk",
    status: plateauLabel(worst), statusColor: plateauColor(worst),
    why: worst === "plateau-risk" ? "A primary movement is stalling — rotate the pattern next block."
      : worst === "rotation-candidate" ? "A movement is flat across exposures — a same-pattern swap is worth it."
        : worst === "recovery-limited" ? "Recovery is limiting primary output — hold load and protect quality."
          : worst === "watch" ? "Exposure is stable. Keep progression clean before rotating."
            : "Progression is moving across the session.",
    actionLabel: rotation.length ? "Review Alternatives" : undefined,
  });

  const topExp = [...exposures].sort((a, b) => b.weeksActive - a.weeksActive)[0];
  cards.push({
    key: "exposure", title: "Exercise Exposure",
    status: topExp ? `${plateauLabel(topExp.status)} · ${topExp.weeksActive}w` : "Data Limited", statusColor: topExp ? plateauColor(topExp.status) : COLOR.slate,
    why: topExp ? `${topExp.name} is your longest-running exposure (${topExp.weeksActive} weeks, sample).` : "No movements to track.",
  });

  cards.push({
    key: "variety", title: "Movement Variety",
    status: varietyStatus, statusColor: varietyColor,
    why: `${patterns.size} distinct movement patterns in today's session.`,
  });

  if (weakPointPriorities.length > 0) {
    const supportedCount = weakPointPriorities.filter((w) => w.supportedToday).length;
    cards.push({
      key: "weak-point", title: "Weak Point Support",
      status: supportedCount > 0 ? "Active" : "Not Today", statusColor: supportedCount > 0 ? COLOR.violet : COLOR.amber,
      why: supportedCount > 0
        ? `${weakPointPriorities.filter((w) => w.supportedToday).map((w) => w.label).join(" · ")} supported in this session.`
        : `${weakPointPriorities.map((w) => w.label).join(" · ")} focus active, but today's split doesn't emphasize it.`,
      actionLabel: "Open Physique", actionTarget: "physique",
    });
  } else {
    cards.push({ key: "weak-point", title: "Weak Point Support", status: "None Set", statusColor: COLOR.slate, why: "Set a weak-point focus in Physique Command to prioritize relevant movements.", actionLabel: "Open Physique", actionTarget: "physique" });
  }

  cards.push({
    key: "superset", title: "Superset Opportunity",
    status: supersets.good.length ? supersets.good[0].type : "None Ideal", statusColor: supersets.good.length ? COLOR.green : COLOR.slate,
    why: supersets.good.length ? `${supersets.good[0].a} + ${supersets.good[0].b} — ${supersets.good[0].why}` : "No low-risk superset pairing stands out in this split.",
  });

  cards.push({
    key: "recovery", title: "Recovery Limitation",
    status: recoveryLimited ? "Limited" : recoveryHasData ? "Clear" : "Data Limited", statusColor: recoveryLimited ? COLOR.amber : recoveryHasData ? COLOR.green : COLOR.slate,
    why: recoveryLimited ? "Recovery reserve is low — respect rest windows and avoid junk volume." : recoveryHasData ? "Recovery supports today's primary output." : "Log a recovery check-in to factor reserve into load.",
    actionLabel: "Open Recovery", actionTarget: "recovery",
  });

  cards.push({
    key: "rotation", title: "Rotation Suggestion",
    status: rotation.length ? `${rotation.length} Candidate${rotation.length > 1 ? "s" : ""}` : "Hold", statusColor: rotation.length ? COLOR.gold : COLOR.green,
    why: rotation.length ? `${rotation[0].name} — ${rotation[0].reason}.` : "No rotation needed — keep progressing the current movements.",
  });

  cards.push({
    key: "gym", title: "Gym Environment",
    status: profile ? (profile.configured ? GYM_ENVIRONMENT_LABEL[profile.gymEnvironment] : "Setup Needed") : "Data Limited",
    statusColor: profile?.configured ? COLOR.green : COLOR.amber,
    why: !profile
      ? "Set up your training profile to select movements for your gym."
      : !profile.configured
        ? "Prescriptions use a default setup. Confirm your gym + equipment for accurate movement selection."
      : `Movements selected for your ${GYM_ENVIRONMENT_LABEL[profile.gymEnvironment].toLowerCase()}${profile.premiumBrands.length ? " with premium machines" : ""}.`,
    actionLabel: profile?.configured ? undefined : "Complete Training Profile",
  });

  return {
    hasSession: true, confidence: "sample", plateauStatus: worst, recoveryLimited,
    cards, exposures, rotation, supersets, weakPoints: weakPointPriorities,
  };
}
