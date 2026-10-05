/* ════════════════════════════════════════════════════════════════════════
   FIELD OP — today's lifestyle mission: a walk, daylight and a wind-down.

   Built from the member's own schedule, age, check-ins and training day:
     · walk duration from the weekly aerobic guideline and today's load
     · distance from a typical brisk pace
     · a heart-rate range from age, or heart-rate reserve when a resting
       heart rate is logged
     · outdoor daylight, placed early in the member's day
     · a wind-down marker before their bedtime

   Harm prevention comes first. A check-in blood pressure in the stage 2
   range, a flagged hematocrit, or a warning-sign symptom takes the intensity
   target away and routes the reading to care; a reading in the crisis range
   replaces the op with getting care today. Reserve never sets a harder
   target on a day a reading needs a look.
   ════════════════════════════════════════════════════════════════════════ */

import type { ProfileSource } from "@/lib/compound-intelligence/risk-profiles";

export const FIELD_OP_VERSION = "2026.09.16";

/** About 100 steps a minute marks moderate-intensity walking for adults. */
export const STEPS_PER_BRISK_MINUTE = 100;

/** A typical brisk walking pace; CDC counts walking at 3 mph or faster as moderate intensity. */
export const BRISK_PACE_MPH = 3;

export const FIELD_OP_SOURCES = {
  hhs: { label: "U.S. Department of Health and Human Services: Physical Activity Guidelines for Americans, 2nd edition", url: "https://health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines" },
  tanaka: { label: "Tanaka H, Monahan KD, Seals DR. Age-predicted maximal heart rate revisited. Journal of the American College of Cardiology, 2001." },
  acsm: { label: "American College of Sports Medicine: heart rate reserve method for moderate-intensity exercise" },
  cdcIntensity: { label: "CDC: Measuring physical activity intensity" },
  paluch: { label: "Paluch AE, et al. Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts. Lancet Public Health, 2022." },
  tudorLocke: { label: "Tudor-Locke C, et al. Walking cadence (steps per minute) and intensity in adults. Applied Physiology, Nutrition, and Metabolism, 2019." },
  aha: { label: "American Heart Association: Understanding blood pressure readings", url: "https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings" },
  nhlbiSleep: { label: "NIH National Heart, Lung, and Blood Institute: Healthy sleep habits", url: "https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits" },
} satisfies Record<string, ProfileSource>;

export type FieldOpInput = {
  today: string;
  age?: number;
  wakeTime?: string;
  sleepTime?: string;
  trainingTime?: string;
  isTrainingDay: boolean;
  cardioDaysPerWeek?: number;
  /** Latest check-in within the last 14 days. */
  latestCheckIn?: { date: string; systolic?: number; diastolic?: number; restingHr?: number } | null;
  hematocritFlagged: boolean;
  warningSignsReported: boolean;
  /** Minutes already walked today, from the member's own logs. */
  walkedMinutesToday: number;
  /** Today's step count as the member entered it, if any. */
  stepsToday?: number;
};

export type FieldOpGate = "clear" | "easy-only" | "care-today";

export type FieldOp = {
  gate: FieldOpGate;
  /** Why the gate is not clear, in plain words. */
  gateReason: string | null;
  walk: {
    startTime: string | null;
    minutes: number;
    miles: number;
    heartRate: { low: number; high: number; method: "heart-rate-reserve" | "age-predicted" } | null;
    why: string;
  } | null;
  daylight: { startTime: string | null; minutes: number; text: string };
  windDown: { time: string | null; text: string };
  steps: {
    target: { low: number; high: number } | null;
    today: number | null;
    /** About how many steps the walk adds, at a brisk cadence. */
    walkAdds: number | null;
    text: string;
  };
  done: boolean;
  sources: ProfileSource[];
};

function minutesOf(time?: string): number | null {
  const m = time ? /^(\d{1,2}):(\d{2})$/.exec(time) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function toTime(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

const roundTo5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

export function buildFieldOp(input: FieldOpInput): FieldOp {
  const sys = input.latestCheckIn?.systolic;
  const dia = input.latestCheckIn?.diastolic;
  const sources: ProfileSource[] = [FIELD_OP_SOURCES.hhs, FIELD_OP_SOURCES.cdcIntensity, FIELD_OP_SOURCES.nhlbiSleep];

  /* ── Gate: harm prevention before any target ── */
  let gate: FieldOpGate = "clear";
  let gateReason: string | null = null;
  if (input.warningSignsReported) {
    gate = "care-today";
    gateReason = "A warning-sign symptom was reported recently. Get care today before a workout — call 911 if it is happening now.";
  } else if ((sys ?? 0) >= 180 || (dia ?? 0) >= 120) {
    gate = "care-today";
    gateReason = `Your latest check-in blood pressure, ${sys}/${dia}, is in the range the American Heart Association says needs medical care right away. Get it checked today instead of training.`;
    sources.push(FIELD_OP_SOURCES.aha);
  } else if ((sys ?? 0) >= 140 || (dia ?? 0) >= 90) {
    gate = "easy-only";
    gateReason = `Your latest check-in blood pressure, ${sys}/${dia}, is in the stage 2 range. Today's op is an easy walk with no heart-rate target. Get this reading reviewed — a clinician, urgent care or a telehealth visit.`;
    sources.push(FIELD_OP_SOURCES.aha);
  } else if (input.hematocritFlagged) {
    gate = "easy-only";
    gateReason = "Your latest hematocrit is outside the range on your report. Today's op is an easy walk with no heart-rate target. Get this result reviewed — a clinician, urgent care or a telehealth visit.";
  }

  const wake = minutesOf(input.wakeTime);
  const sleep = minutesOf(input.sleepTime);
  const training = minutesOf(input.trainingTime);

  /* ── Walk ── */
  let walk: FieldOp["walk"] = null;
  if (gate !== "care-today") {
    const cardioDays = Math.min(7, Math.max(1, input.cardioDaysPerWeek ?? 4));
    /* 150 weekly minutes of moderate activity spread over the member's cardio days, shorter on a training day. */
    const base = roundTo5(150 / cardioDays);
    const planned = input.isTrainingDay ? roundTo5(Math.max(20, base * 0.6)) : Math.min(60, base);
    const minutes = gate === "easy-only" ? Math.min(planned, 30) : planned;
    const miles = Math.round((minutes / 60) * BRISK_PACE_MPH * 10) / 10;

    let heartRate: NonNullable<FieldOp["walk"]>["heartRate"] = null;
    if (gate === "clear" && input.age && input.age >= 18 && input.age <= 90) {
      const max = Math.round(208 - 0.7 * input.age);
      const resting = input.latestCheckIn?.restingHr;
      if (resting && resting >= 35 && resting < max - 40) {
        heartRate = { low: Math.round(resting + (max - resting) * 0.4), high: Math.round(resting + (max - resting) * 0.59), method: "heart-rate-reserve" };
        sources.push(FIELD_OP_SOURCES.acsm);
      } else {
        heartRate = { low: Math.round(max * 0.5), high: Math.round(max * 0.7), method: "age-predicted" };
      }
      sources.push(FIELD_OP_SOURCES.tanaka);
    }

    /* Early in the day, clear of a morning training slot. */
    let start = wake !== null ? wake + 30 : null;
    if (start !== null && training !== null && Math.abs(training - start) < 90) start = training + 120;
    const why = input.isTrainingDay
      ? "A shorter easy walk on a training day adds aerobic minutes without taking from your session."
      : "Rest days carry more of your weekly aerobic minutes: the guideline is 150 a week of moderate activity.";
    walk = { startTime: start !== null ? toTime(start) : null, minutes, miles, heartRate, why };
  }

  /* ── Daylight and wind-down ── */
  const daylight = {
    startTime: wake !== null ? toTime(wake + 30) : null,
    minutes: 30,
    text: "Natural daylight outdoors, ideally early in your day. The NIH suggests at least 30 minutes a day for healthy sleep. Your walk can cover it — use sun protection for longer exposure.",
  };
  /* Steps: where the benefit levelled off in the largest pooled cohort analysis, by age group. */
  const olderAdult = (input.age ?? 0) >= 60;
  const stepTarget = gate === "care-today" ? null : olderAdult ? { low: 6000, high: 8000 } : { low: 8000, high: 10000 };
  const steps = {
    target: stepTarget,
    today: typeof input.stepsToday === "number" ? input.stepsToday : null,
    walkAdds: walk ? walk.minutes * STEPS_PER_BRISK_MINUTE : null,
    text: stepTarget
      ? `In a pooled analysis of 15 cohorts, the benefit of more daily steps levelled off around ${stepTarget.low.toLocaleString("en-US")}–${stepTarget.high.toLocaleString("en-US")} for adults ${olderAdult ? "60 and over" : "under 60"}. Enter today's count from your phone or watch.`
      : "Steps can wait until the reading above has been looked at.",
  };
  if (stepTarget) sources.push(FIELD_OP_SOURCES.paluch, FIELD_OP_SOURCES.tudorLocke);

  const windDown = {
    time: sleep !== null ? toTime(sleep - 60) : null,
    text: "Screens down and lights low about an hour before the bedtime in your schedule.",
  };

  return {
    gate,
    gateReason,
    walk,
    daylight,
    windDown,
    steps,
    done: walk !== null && input.walkedMinutesToday >= walk.minutes,
    sources: [...new Map(sources.map((s) => [s.label, s])).values()],
  };
}

/** Where a heart-rate reading sits against the op's range. */
export function heartRateStatus(bpm: number, range: { low: number; high: number }): "below" | "in-range" | "above" {
  return bpm < range.low ? "below" : bpm > range.high ? "above" : "in-range";
}
