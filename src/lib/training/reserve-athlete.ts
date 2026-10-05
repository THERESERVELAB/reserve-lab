/* ════════════════════════════════════════════════════════════════════════
   RESERVE ATHLETE METHOD — identity, hierarchy, and signature-day content.

   The Reserve Athlete Method is bodybuilder first, athlete second. Athletic
   capacity, conditioning, and recovery are layered AROUND a protected
   bodybuilding core — never replacing lifting volume. This module holds the
   framework's typed guardrails (the hierarchy + physique floor) and the
   content for its two signature days: the Wednesday Recovery-Athlete day and
   the Saturday Reserve Athlete Day.

   Pure data + deterministic helpers. No store access, no UI. Observational
   framing only — no medical claims, no dosing, no cycle/stack/compound copy.
   ════════════════════════════════════════════════════════════════════════ */

/* ─── The hierarchy (the spine of every Reserve Athlete decision) ─────────── */
export const RESERVE_ATHLETE_PILLARS = ["physique", "strength", "athletic", "recovery", "longevity"] as const;
export type ReserveAthletePillar = (typeof RESERVE_ATHLETE_PILLARS)[number];

export const PILLAR_LABEL: Record<ReserveAthletePillar, string> = {
  physique: "Elite Physique",
  strength: "Strength",
  athletic: "Athletic Capacity",
  recovery: "Recovery",
  longevity: "Longevity",
};

/** One-line principle per pillar, in priority order. Physique/strength win every conflict. */
export const PILLAR_PRINCIPLE: Record<ReserveAthletePillar, string> = {
  physique: "Mass, density, proportion, and condition come first — never sacrificed for performance.",
  strength: "Heavy compounds and progressive overload feed the physique.",
  athletic: "Speed, power, and work capacity sharpen the look — they never replace lifting volume.",
  recovery: "A scheduled, load-adaptive training component, not an afterthought.",
  longevity: "Health, durability, and capability that last decades.",
};

/**
 * Weekly emphasis target — bodybuilding / athletic / conditioning / recovery.
 * INTERNAL authoring guide only. Never surfaced as a member-facing metric; the
 * member experience stays premium, not mathematical (product decision 2026-06-29).
 */
export const RESERVE_ATHLETE_WEEKLY_RATIO = {
  bodybuilding: 0.7,
  athletic: 0.15,
  conditioning: 0.1,
  recovery: 0.05,
} as const;

/* ─── The physique floor (what the week-resolver must never violate) ──────── */
export type PhysiqueFloor = {
  /** Lifting days that may never be displaced by athletic work. */
  minHypertrophyDays: number;
  /** Lower-body sessions protected so leg development never erodes. */
  minLowerSessions: number;
  /** priority:1 lifting days are immovable. */
  protectPriorityLifts: true;
};

/** Hybrid archetype: 4 lifts (2 upper, 2 lower) are the floor. */
export const RESERVE_ATHLETE_PHYSIQUE_FLOOR: PhysiqueFloor = {
  minHypertrophyDays: 4,
  minLowerSessions: 2,
  protectPriorityLifts: true,
};

/* ─── Identity helpers ────────────────────────────────────────────────────── */
/** True when a protocol category / id belongs to the Reserve Athlete Method. */
export function isReserveAthlete(category?: string | null, protocolId?: string | null): boolean {
  return category === "reserve-athlete" || (protocolId?.startsWith("reserve-athlete") ?? false);
}

/* ─── Signature-day content ───────────────────────────────────────────────── */
export type ReserveAthleteSessionBlock = {
  label: string;
  detail: string;
  /** Every block carries a programming purpose — never "random cardio". */
  purpose: string;
};

export type ReserveAthleteSession = {
  id: "recovery-athlete" | "reserve-athlete-day";
  weekday: "wednesday" | "saturday";
  /** dayIndex 0=Mon … 6=Sun (matches the blueprint week). */
  dayIndex: number;
  title: string;
  identity: string;
  blocks: ReserveAthleteSessionBlock[];
  note: string;
};

/** Wednesday — strict no-lift Recovery-Athlete day (product decision 2026-06-29). */
export const RECOVERY_ATHLETE_DAY: ReserveAthleteSession = {
  id: "recovery-athlete",
  weekday: "wednesday",
  dayIndex: 2,
  title: "Recovery Athlete",
  identity: "Mid-week reset that restores output without spending the physique. No lifting.",
  blocks: [
    { label: "Mobility flow", detail: "Full-body guided mobility · 15 min", purpose: "Restore range and prepare the back-half lifting block." },
    { label: "Zone 2 engine", detail: "Easy conversational pace · 30–45 min", purpose: "Aerobic base, fat oxidation, and recovery blood flow — no CNS cost." },
    { label: "Tissue quality", detail: "Soft-tissue + stretch work", purpose: "Manage accumulated fatigue from the heavy lower day." },
    { label: "Heat work", detail: "Sauna · if hydrated", purpose: "Supports relaxation and recovery; trend observation only." },
    { label: "Breathwork", detail: "Down-regulation breathing", purpose: "Shift toward parasympathetic recovery before the second half of the week." },
  ],
  note: "Strict recovery — no lifting. Heat and conditioning are observational supports, not prescriptions.",
};

/** Saturday — the Reserve Athlete Day (athletic expression, layered on the physique). */
export const RESERVE_ATHLETE_DAY: ReserveAthleteSession = {
  id: "reserve-athlete-day",
  weekday: "saturday",
  dayIndex: 5,
  title: "Reserve Athlete Day",
  identity: "Athletic capacity layered on top of the physique — explosive, fast, and capable.",
  blocks: [
    { label: "Plyometrics", detail: "Low-volume jumps · high quality", purpose: "Recruit fast-twitch fibers and elastic power." },
    { label: "Farmer carries", detail: "Heavy loaded carries", purpose: "Grip, trunk stability, and work capacity with low joint impact." },
    { label: "Hill sprints", detail: "Short, full-quality efforts", purpose: "Acceleration and posterior-chain power without long mileage." },
    { label: "Med ball throws", detail: "Rotational + overhead throws", purpose: "Express power through the trunk and hips." },
    { label: "Battle ropes", detail: "Interval bursts", purpose: "Conditioning engine work that spares the legs." },
    { label: "Core circuit", detail: "Anti-rotation + bracing", purpose: "Reinforce the trunk that protects every lift." },
    { label: "Mobility + heat finish", detail: "Mobility flow · optional sauna", purpose: "Down-shift into Sunday's recovery." },
  ],
  note: "Athletic work serves the physique. Volume stays controlled so it never erodes muscle or recovery.",
};

export const RESERVE_ATHLETE_SESSIONS: ReserveAthleteSession[] = [RECOVERY_ATHLETE_DAY, RESERVE_ATHLETE_DAY];

/** Look up signature-day content by blueprint day index (Wed=2, Sat=5), else null. */
export function getReserveAthleteSession(dayIndex: number): ReserveAthleteSession | null {
  return RESERVE_ATHLETE_SESSIONS.find((s) => s.dayIndex === dayIndex) ?? null;
}
