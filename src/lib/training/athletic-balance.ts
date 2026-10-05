/* ════════════════════════════════════════════════════════════════════════
   RESERVE ATHLETE — ATHLETIC BALANCE ENGINE
   docs/RESERVE_ATHLETE_INTELLIGENCE.md § 3.4

   Seven pillars (muscularity, conditioning, explosiveness, aerobic, recovery,
   mobility, movement-quality) composed from systems that already exist —
   physique momentum, the athletic-progression capacity board, and the
   Recovery Command snapshot. No new tracking is invented; a pillar with no
   real signal reads "data-limited" honestly.

   Muscularity always wins a tie for the laggard: a physique gap outranks a
   conditioning gap, per the Reserve rule.

   Pure + deterministic. Observational framing only.
   ════════════════════════════════════════════════════════════════════════ */

import type { AthleticAssessment } from "@/lib/training/athletic-progression";
import type { PhysiqueMomentum } from "@/lib/physique/engine";

export type AthleticPillar =
  | "muscularity" | "conditioning" | "explosiveness" | "aerobic" | "recovery" | "mobility" | "movement-quality";

export const ATHLETIC_PILLARS: AthleticPillar[] = [
  "muscularity", "conditioning", "explosiveness", "aerobic", "recovery", "mobility", "movement-quality",
];

export const ATHLETIC_PILLAR_LABEL: Record<AthleticPillar, string> = {
  muscularity: "Muscularity",
  conditioning: "Conditioning",
  explosiveness: "Explosiveness",
  aerobic: "Aerobic",
  recovery: "Recovery",
  mobility: "Mobility",
  "movement-quality": "Movement Quality",
};

export type PillarRead = {
  pillar: AthleticPillar;
  score: number | null; // 0..100, null = data-limited
  label: string;
  note: string;
};

export type AthleticBalanceResult = {
  pillars: PillarRead[];
  laggard: PillarRead | null;
  recommendation: string;
};

const MOMENTUM_SCORE: Record<PhysiqueMomentum, number | null> = {
  improving: 85,
  holding: 65,
  stalling: 35,
  "needs-data": null,
};

function avgQualityScore(board: AthleticAssessment[], keys: string[]): number | null {
  const rows = board.filter((a) => keys.includes(a.quality));
  const scored = rows.filter((a) => a.status !== "baseline");
  if (scored.length === 0) return null;
  const statusScore = { progressing: 85, hold: 60, "back-off": 40, baseline: 50 } as const;
  return Math.round(scored.reduce((s, a) => s + statusScore[a.status], 0) / scored.length);
}

export type AthleticBalanceInput = {
  physiqueMomentum?: PhysiqueMomentum;
  athleticBoard: AthleticAssessment[];
  recoveryHasData: boolean;
  recoveryReserve: number | null;
  mobilityThisWeek?: number;
  mobilityWeeklyTarget?: number;
};

export function evaluateAthleticBalance(input: AthleticBalanceInput): AthleticBalanceResult {
  const conditioningScore = avgQualityScore(input.athleticBoard, ["work-capacity", "threshold"]);
  const explosivenessScore = avgQualityScore(input.athleticBoard, ["power", "speed"]);
  const aerobicScore = avgQualityScore(input.athleticBoard, ["aerobic-base", "tempo"]);
  const recoveryScore = input.recoveryHasData && input.recoveryReserve !== null ? input.recoveryReserve : null;
  const mobilityScore = input.mobilityWeeklyTarget && input.mobilityWeeklyTarget > 0 && input.mobilityThisWeek != null
    ? Math.round(Math.min(100, (input.mobilityThisWeek / input.mobilityWeeklyTarget) * 100))
    : null;

  const pillars: PillarRead[] = [
    { pillar: "muscularity", score: input.physiqueMomentum ? MOMENTUM_SCORE[input.physiqueMomentum] : null, label: ATHLETIC_PILLAR_LABEL.muscularity, note: "From physique momentum — the pillar the whole system protects." },
    { pillar: "conditioning", score: conditioningScore, label: ATHLETIC_PILLAR_LABEL.conditioning, note: "From logged work-capacity and threshold efforts." },
    { pillar: "explosiveness", score: explosivenessScore, label: ATHLETIC_PILLAR_LABEL.explosiveness, note: "From logged power and speed efforts." },
    { pillar: "aerobic", score: aerobicScore, label: ATHLETIC_PILLAR_LABEL.aerobic, note: "From logged aerobic-base and tempo efforts." },
    { pillar: "recovery", score: recoveryScore, label: ATHLETIC_PILLAR_LABEL.recovery, note: "From the Recovery Reserve snapshot." },
    { pillar: "mobility", score: mobilityScore, label: ATHLETIC_PILLAR_LABEL.mobility, note: "From this week's mobility adherence." },
    { pillar: "movement-quality", score: null, label: ATHLETIC_PILLAR_LABEL["movement-quality"], note: "Not logged yet — no movement-quality signal exists today." },
  ];

  const scored = pillars.filter((p) => p.score !== null);
  const muscularity = pillars[0];
  // Muscularity always wins the laggard tie — physique gap outranks a conditioning gap.
  let laggard: PillarRead | null = null;
  if (muscularity.score !== null && muscularity.score <= 45) {
    laggard = muscularity;
  } else if (scored.length > 0) {
    laggard = scored.reduce((min, p) => (p.score! < min.score! ? p : min), scored[0]);
  }

  const recommendation = !laggard
    ? "Not enough logged data yet to name a laggard — log training and recovery to activate this read."
    : laggard.pillar === "muscularity"
      ? "Muscularity is the laggard — physique work takes priority over every other pillar until it turns over."
      : `${laggard.label} is the laggard. A small, controlled adjustment there closes the gap without disturbing the rest of the board.`;

  return { pillars, laggard, recommendation };
}
