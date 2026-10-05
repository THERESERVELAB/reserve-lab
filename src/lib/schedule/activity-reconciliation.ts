/* ════════════════════════════════════════════════════════════════════════
   LIVE SCHEDULE RECONCILIATION — life is not static.

   When an athlete adds or changes a real-life activity (a group class, a
   spontaneous run, a sport session, a studio class), Reserve evaluates the
   change against the planned week and proposes an intelligent adjustment
   instead of treating every deviation as noncompliance.

   The engine is PURE and DETERMINISTIC. It reads a lightweight snapshot of the
   planned week (day identities + focus) and the added activity, and returns a
   proposal the athlete confirms. It never mutates the week itself — the store /
   TrainingOverride layer applies the athlete's decision.

   Organization / training-structure only. No medical claims, no dosing, no
   rehab prescription. Language stays advisory: "recommended adjustment",
   "consider", "protect", "keep at the lower end".
   ════════════════════════════════════════════════════════════════════════ */

/* ─── Activity model ──────────────────────────────────────────────────────── */

export type ActivitySource = "reserve" | "athlete-added" | "coach-added" | "calendar-import";
export type ActivityRecurrence = "one-time" | "weekly" | "biweekly" | "custom";
export type ActivityLocation =
  | "commercial-gym" | "studio" | "home" | "outdoor" | "track" | "field" | "pool" | "custom";
export type ActivityType =
  | "lifting" | "group-fitness" | "running" | "conditioning" | "sport" | "mobility" | "recovery" | "custom";
export type ActivityIntensity = "low" | "moderate" | "high" | "unknown";
export type ActivityRelationship = "replace" | "supplement" | "reschedule" | "reserve-decides";

/** Estimated physiological load contribution, each 0–10. */
export type ActivityStress = {
  lowerBody: number;
  upperBody: number;
  cardiovascular: number;
  joint: number;
  systemic: number;
};

export type AthleteActivity = {
  id: string;
  title: string;
  source: ActivitySource;
  recurrence: ActivityRecurrence;
  /** ISO date (YYYY-MM-DD) for one-time; optional for recurring. */
  date?: string;
  /** 0 = Mon … 6 = Sun. Primary scheduling key the engine reasons on. */
  dayOfWeek?: number;
  /** "HH:MM" 24h. */
  startTime?: string;
  durationMinutes: number;
  location: ActivityLocation;
  activityType: ActivityType;
  /** Free tags — muscle regions / focuses, e.g. ["lower body", "legs"]. */
  focusAreas: string[];
  intensity: ActivityIntensity;
  relationship: ActivityRelationship;
  /** Optional explicit stress override; otherwise the engine estimates it. */
  expectedStress?: Partial<ActivityStress>;
  notes?: string;
};

/* ─── Planned-week snapshot (lite — decoupled from ResolvedDay) ────────────── */

export type PlannedDay = {
  /** 0 = Mon … 6 = Sun. */
  dayIndex: number;
  dayName: string;
  title: string;
  /** Muscle / focus tokens for this planned session (empty on recovery). */
  focusAreas: string[];
  recovery: boolean;
  /** Coarse intent for surrounding-session awareness. */
  intent?: "strength" | "hypertrophy" | "power" | "conditioning" | "tone" | "sport" | "recovery" | "mobility" | "logged" | string;
};

/* ─── Proposal ────────────────────────────────────────────────────────────── */

export type AdjustmentRiskLevel = "low" | "moderate" | "high";
/** How Reserve reads the activity relative to the planned session. */
export type ResolvedRelationship = "replace" | "supplement" | "reschedule";

export type ScheduleAdjustmentProposal = {
  /** One-line headline recommendation. */
  recommendation: string;
  /** Why — concise, advisory bullets. */
  rationale: string[];
  /** Reserve's resolved read of the relationship (esp. when "reserve-decides"). */
  resolvedRelationship: ResolvedRelationship;
  /** Day names (Mon…Sun) the proposal touches. */
  affectedDays: string[];
  preserve: string[];
  replace: string[];
  move: string[];
  reduce: string[];
  nutritionChanges: string[];
  recoveryChanges: string[];
  riskLevel: AdjustmentRiskLevel;
  requiresAthleteConfirmation: boolean;
  /** Estimated stress of the added activity (surfaced for the UI). */
  estimatedStress: ActivityStress;
  /** Overlap 0–1 between the activity and the planned session on its day. */
  overlapWithPlanned: number;
};

/* ─── Focus classification ────────────────────────────────────────────────── */

const LOWER_TOKENS = ["quad", "hamstring", "glute", "calf", "calve", "adductor", "abductor", "leg", "lower", "posterior", "hip"];
const UPPER_TOKENS = ["chest", "back", "lat", "delt", "shoulder", "arm", "bicep", "tricep", "trap", "upper", "push", "pull", "press"];
const CONDITIONING_TOKENS = ["condition", "cardio", "distance", "endurance", "interval", "zone", "sprint", "engine", "capacity", "sport"];

function tokenHit(tokens: string[], haystack: string[]): boolean {
  const joined = haystack.join(" ").toLowerCase();
  return tokens.some((t) => joined.includes(t));
}

function countTokenHits(tokens: string[], haystack: string[]): number {
  const joined = haystack.join(" ").toLowerCase();
  return tokens.reduce((n, t) => (joined.includes(t) ? n + 1 : n), 0);
}

const INTENSITY_WEIGHT: Record<ActivityIntensity, number> = { low: 0.45, moderate: 0.7, high: 1.0, unknown: 0.65 };

/** Estimate an activity's physiological stress when it isn't supplied. Pure,
    deterministic, 0–10 per axis — organization only, never a medical claim. */
export function estimateActivityStress(a: AthleteActivity): ActivityStress {
  const w = INTENSITY_WEIGHT[a.intensity];
  const durationFactor = Math.min(1.2, Math.max(0.5, a.durationMinutes / 60));
  const isLower = tokenHit(LOWER_TOKENS, a.focusAreas);
  const isUpper = tokenHit(UPPER_TOKENS, a.focusAreas);
  const isConditioningType = a.activityType === "running" || a.activityType === "conditioning" || a.activityType === "sport";
  const isCardioFocus = isConditioningType || tokenHit(CONDITIONING_TOKENS, a.focusAreas);
  const strengthType = a.activityType === "lifting" || a.activityType === "group-fitness";

  const base = 10 * w * durationFactor;
  const lowerBody = isLower ? base * (strengthType ? 0.9 : 0.7) : isCardioFocus ? base * 0.45 : base * 0.2;
  const upperBody = isUpper ? base * (strengthType ? 0.85 : 0.6) : base * 0.15;
  const cardiovascular = isCardioFocus ? base * 0.9 : strengthType ? base * 0.35 : base * 0.4;
  const joint = base * (a.activityType === "running" ? 0.6 : strengthType ? 0.55 : 0.35) * (a.intensity === "high" ? 1.1 : 1);
  const systemic = Math.max(lowerBody, upperBody, cardiovascular) * 0.85 + base * 0.1;

  const clamp = (n: number) => Math.round(Math.min(10, Math.max(0, n)) * 10) / 10;
  const merged = {
    lowerBody: clamp(lowerBody),
    upperBody: clamp(upperBody),
    cardiovascular: clamp(cardiovascular),
    joint: clamp(joint),
    systemic: clamp(systemic),
  };
  // Explicit overrides win per-axis.
  const e = a.expectedStress;
  if (!e) return merged;
  return {
    lowerBody: e.lowerBody ?? merged.lowerBody,
    upperBody: e.upperBody ?? merged.upperBody,
    cardiovascular: e.cardiovascular ?? merged.cardiovascular,
    joint: e.joint ?? merged.joint,
    systemic: e.systemic ?? merged.systemic,
  };
}

/** Overlap 0–1 between an activity's focus and a planned session's focus.
    Weighted toward shared region (lower/upper) because that drives interference. */
export function focusOverlap(activityFocus: string[], plannedFocus: string[]): number {
  if (plannedFocus.length === 0) return 0;
  const aLower = tokenHit(LOWER_TOKENS, activityFocus);
  const pLower = tokenHit(LOWER_TOKENS, plannedFocus);
  const aUpper = tokenHit(UPPER_TOKENS, activityFocus);
  const pUpper = tokenHit(UPPER_TOKENS, plannedFocus);
  let score = 0;
  if (aLower && pLower) score += 0.7;
  if (aUpper && pUpper) score += 0.7;
  // Token-level agreement adds a little precision (shared "glute", "quad", …).
  const shared = countTokenHits(plannedFocus.map((s) => s.toLowerCase()), activityFocus);
  score += Math.min(0.3, shared * 0.1);
  return Math.min(1, Math.round(score * 100) / 100);
}

/* ─── The reconciliation engine ───────────────────────────────────────────── */

export type ReconcileInput = {
  activity: AthleteActivity;
  /** The current planned week (7 entries, Mon…Sun). */
  week: PlannedDay[];
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function dayName(i: number): string {
  return DAY_NAMES[((i % 7) + 7) % 7];
}

/** Upcoming lower-body / distance exposures after a day (for interference).
    Forward-only — a session that already happened cannot be un-fatigued — and
    wrapped around the cyclical week, so a Friday load reaches the next Monday's
    outdoor run. Within three days is the meaningful lower-body recovery window. */
function upcomingLowerLoad(week: PlannedDay[], dayIndex: number): { day: PlannedDay; offset: number }[] {
  const out: { day: PlannedDay; offset: number }[] = [];
  for (const offset of [1, 2, 3]) {
    const idx = (((dayIndex + offset) % 7) + 7) % 7;
    const day = week.find((d) => d.dayIndex === idx);
    if (!day || day.recovery) continue;
    const lower = tokenHit(LOWER_TOKENS, day.focusAreas);
    const distance = tokenHit(["distance", "outdoor", "run"], [day.title, ...day.focusAreas]) || day.intent === "conditioning";
    if (lower || distance) out.push({ day, offset });
  }
  return out;
}

export function reconcileActivity(input: ReconcileInput): ScheduleAdjustmentProposal {
  const { activity, week } = input;
  const stress = estimateActivityStress(activity);
  const dayIndex = activity.dayOfWeek ?? 0;
  const planned = week.find((d) => d.dayIndex === dayIndex) ?? null;
  const plannedFocus = planned?.focusAreas ?? [];
  const overlap = planned && !planned.recovery ? focusOverlap(activity.focusAreas, plannedFocus) : 0;

  const highIntensity = activity.intensity === "high";
  const conditioningDominant =
    stress.cardiovascular >= stress.lowerBody && stress.cardiovascular >= stress.upperBody;
  const strengthDominant = !conditioningDominant && (stress.lowerBody >= 4 || stress.upperBody >= 4);

  // ── Resolve the relationship. Explicit athlete choice wins; "reserve-decides"
  //    is inferred from overlap + intensity + whether there's a real planned session.
  let resolved: ResolvedRelationship;
  if (activity.relationship === "replace") resolved = "replace";
  else if (activity.relationship === "supplement") resolved = "supplement";
  else if (activity.relationship === "reschedule") resolved = "reschedule";
  else {
    // reserve-decides
    if (!planned || planned.recovery) resolved = "supplement";
    else if (overlap >= 0.6 && strengthDominant) resolved = "replace";
    else if (overlap >= 0.6 && conditioningDominant) resolved = "supplement";
    else if (overlap >= 0.4) resolved = "replace";
    else resolved = "supplement";
  }

  const affected = new Set<string>();
  const preserve: string[] = [];
  const replace: string[] = [];
  const move: string[] = [];
  const reduce: string[] = [];
  const rationale: string[] = [];
  const nutritionChanges: string[] = [];
  const recoveryChanges: string[] = [];

  const thisDay = dayName(dayIndex);
  affected.add(thisDay);

  // ── Primary-day handling.
  if (planned && !planned.recovery) {
    if (resolved === "replace") {
      replace.push(`${thisDay} · ${planned.title}`);
      rationale.push(
        overlap >= 0.6
          ? `The class overlaps with ${thisDay}'s ${planned.title.toLowerCase()} — use it as ${thisDay}'s primary ${tokenHit(LOWER_TOKENS, activity.focusAreas) ? "lower-body" : "training"} exposure.`
          : `The class covers enough of ${thisDay}'s work to stand in as ${thisDay}'s session.`,
      );
    } else if (resolved === "supplement") {
      preserve.push(`${thisDay} · ${planned.title}`);
      rationale.push(
        conditioningDominant
          ? `The class is conditioning-dominant rather than ${planned.title.toLowerCase()} work — keep ${thisDay}'s session and add the class alongside it.`
          : `The class adds to ${thisDay} rather than replacing it — keep the planned session.`,
      );
      if (strengthDominant && overlap >= 0.4) {
        rationale.push(`Keeping both stacks lower-body load — consider shortening ${thisDay}'s session or moving it.`);
      }
    } else {
      move.push(`${thisDay} · ${planned.title}`);
      rationale.push(`Move ${thisDay}'s ${planned.title.toLowerCase()} to a nearby open day so the class owns ${thisDay}.`);
    }
  } else {
    preserve.push(`${thisDay} was open — the class adds a session without displacing planned work.`);
    rationale.push(`${thisDay} had no planned lift, so the class is a clean addition.`);
  }

  // ── Surrounding-session interference (lower-body / distance stacking).
  const activityIsLower = tokenHit(LOWER_TOKENS, activity.focusAreas) || stress.lowerBody >= 5;
  if (activityIsLower && (resolved === "replace" || resolved === "supplement")) {
    for (const { day } of upcomingLowerLoad(week, dayIndex)) {
      const name = dayName(day.dayIndex);
      const isDistance = day.intent === "conditioning" || tokenHit(["distance", "outdoor", "run"], [day.title, ...day.focusAreas]);
      if (isDistance) {
        reduce.push(`${name} · ${day.title} — keep at the lower end of its range`);
        rationale.push(`Keep ${name}'s ${day.title.toLowerCase()} at the lower end until readiness is confirmed — the class already loaded the legs.`);
        recoveryChanges.push(`${name} distance work: start conservative, confirm readiness first.`);
      } else {
        const pct = highIntensity ? 20 : 10;
        reduce.push(`${name} · ${day.title} — reduce volume ~${pct}% if legs are still fatigued`);
        rationale.push(`Reduce ${name}'s ${day.title.toLowerCase()} by ~${pct}% if the class ran high-intensity, then rebuild.`);
        recoveryChanges.push(`${name} lower-body readiness may be lower — auto-adjust volume, protect knees and calves.`);
      }
      affected.add(name);
    }
  }

  // ── Preserve clearly-unrelated sessions (opposite region), so the athlete sees
  //    Reserve is surgical, not rewriting the week.
  for (const d of week) {
    if (d.recovery || d.dayIndex === dayIndex) continue;
    const dLower = tokenHit(LOWER_TOKENS, d.focusAreas);
    const dUpper = tokenHit(UPPER_TOKENS, d.focusAreas);
    const unrelated = activityIsLower ? dUpper && !dLower : dLower && !dUpper;
    if (unrelated && !affected.has(dayName(d.dayIndex))) {
      preserve.push(`${dayName(d.dayIndex)} · ${d.title} (unchanged)`);
    }
  }

  // ── Nutrition (daily distribution only — phase stays authoritative elsewhere).
  const earlyMorning = !!activity.startTime && Number(activity.startTime.slice(0, 2)) < 8;
  if (earlyMorning) nutritionChanges.push("Early-morning session: light easy-digesting carbs before, full protein + carb meal after.");
  if (activityIsLower || strengthDominant) nutritionChanges.push(`${thisDay}: protect carbs around the session to support output.`);
  if (stress.cardiovascular >= 5 || activity.activityType === "running") nutritionChanges.push(`${thisDay}: raise hydration and electrolytes for the added cardiovascular load.`);
  nutritionChanges.push("Overall nutrition phase is unchanged — only today's distribution shifts.");

  // ── Recovery.
  recoveryChanges.unshift(`${thisDay}: expect elevated ${activityIsLower ? "lower-body" : "training"} strain — protect sleep and hydration tonight.`);
  if (activityIsLower) recoveryChanges.push("Calf and ankle recovery: add light mobility if the class was high-impact.");

  // ── Risk + confirmation.
  const nearbyLowerCount = activityIsLower ? upcomingLowerLoad(week, dayIndex).length : 0;
  let riskLevel: AdjustmentRiskLevel = "low";
  if (highIntensity && activityIsLower && nearbyLowerCount >= 2) riskLevel = "high";
  else if ((highIntensity && activityIsLower) || nearbyLowerCount >= 1 || stress.systemic >= 7) riskLevel = "moderate";

  // Meaningful changes always require confirmation; a clean, low-risk addition to
  // an open day can apply without a gate.
  const meaningful = replace.length > 0 || move.length > 0 || reduce.length > 0 || riskLevel !== "low";
  const requiresAthleteConfirmation = meaningful || activity.recurrence !== "one-time";

  // ── Headline recommendation.
  const recommendation =
    resolved === "replace"
      ? `Use ${activity.title} as ${thisDay}'s ${activityIsLower ? "lower-body" : "primary"} session${reduce.length ? `, and ease ${reduce.length === 1 ? "the next lower day" : "the surrounding lower work"}.` : "."}`
      : resolved === "supplement"
        ? `Keep ${thisDay}'s planned session and add ${activity.title} alongside it${reduce.length ? `, easing the surrounding lower work.` : "."}`
        : `Move ${thisDay}'s planned session and let ${activity.title} take ${thisDay}.`;

  return {
    recommendation,
    rationale,
    resolvedRelationship: resolved,
    affectedDays: [...affected],
    preserve,
    replace,
    move,
    reduce,
    nutritionChanges,
    recoveryChanges,
    riskLevel,
    requiresAthleteConfirmation,
    estimatedStress: stress,
    overlapWithPlanned: overlap,
  };
}

// DAY_NAMES kept for callers that want the index→label map without importing twice.
export { DAY_NAMES };
