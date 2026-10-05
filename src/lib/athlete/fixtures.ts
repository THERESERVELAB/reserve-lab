/* ════════════════════════════════════════════════════════════════════════
   DEVELOPMENT ATHLETE FIXTURES

   Clearly fictional athletes used by the architecture inspector and the test
   suite to prove the engine reasons about real people rather than keywords.

   These describe TRAINING CIRCUMSTANCES, not people. No fixture encodes an
   assumption from sex, age, or name — where sex is set it is because a
   women's-performance architecture is being exercised, and every capacity
   value is stated explicitly rather than inferred.
   ════════════════════════════════════════════════════════════════════════ */

import type { AthleteActivity } from "@/lib/schedule/activity-reconciliation";
import { buildAthleteSnapshot, type AthleteContextSnapshot, type AthleteSnapshotInput } from "./snapshot";

export type AthleteFixture = {
  id: string;
  label: string;
  /** What this fixture is designed to prove about the engine. */
  proves: string;
  input: AthleteSnapshotInput;
};

/** The Friday 5:45 AM lower-body class the mission requires as a fixture. */
export const FRIDAY_LOWER_CLASS: AthleteActivity = {
  id: "fixture-friday-lower-class",
  title: "Friday Lower-Body Group Class",
  source: "athlete-added",
  recurrence: "weekly",
  dayOfWeek: 4, // Friday
  startTime: "05:45",
  durationMinutes: 60,
  location: "studio",
  activityType: "group-fitness",
  focusAreas: ["lower body", "legs", "glutes", "quads"],
  intensity: "high",
  relationship: "reserve-decides",
  notes: "Recurring high-intensity lower-body class.",
};

const FIXED_CAPTURE = "2026-07-22T08:00:00.000Z";

/** Recent weigh-ins helper — newest last, spaced weekly. */
function weighIns(startLb: number, weeklyDeltaLb: number, count = 5): Array<{ date: string; weightLb: number }> {
  const out: Array<{ date: string; weightLb: number }> = [];
  const base = Date.parse(FIXED_CAPTURE) - (count - 1) * 7 * 86_400_000;
  for (let i = 0; i < count; i += 1) {
    out.push({
      date: new Date(base + i * 7 * 86_400_000).toISOString().slice(0, 10),
      weightLb: Math.round((startLb + weeklyDeltaLb * i) * 10) / 10,
    });
  }
  return out;
}

export const ATHLETE_FIXTURES: AthleteFixture[] = [
  {
    id: "advanced-physique",
    label: "Advanced physique athlete",
    proves: "High capacity and a physique goal should reach a specialization-capable architecture at high frequency.",
    input: {
      athleteId: "fixture-advanced-physique",
      capturedAt: FIXED_CAPTURE,
      ageYears: 31, sex: "male", heightIn: 71, bodyWeightLb: 198, bodyFatPercent: 12,
      primaryGoal: "Classic physique — upper chest, delts, back width",
      secondaryGoals: ["Waist control", "Proportion"],
      targetWeightLb: 205, goalPriority: "single-focus",
      trainingAgeYears: 9, experienceLevel: "advanced", currentSplit: "Push / Pull / Legs",
      availableDays: 6, sessionDurationMinutes: 75, preferredTrainingTime: "17:30",
      strengthMarkers: { bench: 275, squat: 365, deadlift: 425 },
      conditioningBackground: "regular low-intensity",
      weakPoints: ["upper-chest", "delts"],
      recoveryCapacity: "high", averageSleepHours: 8, sleepConsistency: "consistent",
      readinessScore: 78, lifestyleDemand: "sedentary",
      nutritionPhase: "lean gain", proteinGrams: 180, adherence: 0.9,
      recentWeightsLb: weighIns(196, 0.5),
      equipment: ["barbell", "dumbbells", "machines", "cables"],
    },
  },
  {
    id: "higher-bodyweight-fat-loss",
    label: "Higher-body-weight fat-loss athlete",
    proves: "Higher body mass with no running history must receive impact-aware conditioning — not more training because the scale is higher.",
    input: {
      athleteId: "fixture-higher-bodyweight-fat-loss",
      capturedAt: FIXED_CAPTURE,
      ageYears: 38, sex: "male", heightIn: 70, bodyWeightLb: 268, bodyFatPercent: 33,
      primaryGoal: "Fat loss while keeping strength",
      secondaryGoals: ["Conditioning", "Joint comfort"],
      targetWeightLb: 225, goalPriority: "single-focus",
      trainingAgeYears: 2, experienceLevel: "intermediate",
      availableDays: 4, sessionDurationMinutes: 60, preferredTrainingTime: "06:30",
      conditioningBackground: "limited", runningBackground: "none",
      recoveryCapacity: "moderate", averageSleepHours: 6.5,
      currentPain: [{ region: "knees", severity: 3, note: "Athlete-reported after long walks." }],
      lifestyleDemand: "sedentary",
      nutritionPhase: "cut", adherence: 0.75,
      recentWeightsLb: weighIns(272, -1),
      equipment: ["barbell", "dumbbells", "machines", "cables"],
    },
  },
  {
    id: "powerbuilding",
    label: "Powerbuilding athlete",
    proves: "Logged strength markers plus a strength-and-size goal should reach a primary-lift architecture, not a bodybuilding split.",
    input: {
      athleteId: "fixture-powerbuilding",
      capturedAt: FIXED_CAPTURE,
      ageYears: 27, sex: "male", heightIn: 70, bodyWeightLb: 205, bodyFatPercent: 16,
      primaryGoal: "Strength on squat, bench, and deadlift with size",
      secondaryGoals: ["Muscle gain", "Primary-lift progression"],
      goalPriority: "performance-led",
      trainingAgeYears: 5, experienceLevel: "advanced",
      availableDays: 5, sessionDurationMinutes: 80,
      strengthMarkers: { squat: 405, bench: 285, deadlift: 495, press: 165 },
      recoveryCapacity: "high", averageSleepHours: 7.5,
      lifestyleDemand: "sedentary",
      nutritionPhase: "maintenance", adherence: 0.85,
      recentWeightsLb: weighIns(204, 0.2),
      equipment: ["barbell", "power rack", "dumbbells", "machines"],
    },
  },
  {
    id: "endurance-physique",
    label: "Endurance–physique athlete",
    proves: "A running background plus a retention goal should reach an endurance-priority architecture with interference management.",
    input: {
      athleteId: "fixture-endurance-physique",
      capturedAt: FIXED_CAPTURE,
      ageYears: 34, sex: "male", heightIn: 72, bodyWeightLb: 176, bodyFatPercent: 11,
      primaryGoal: "Half marathon endurance without losing muscle",
      secondaryGoals: ["Muscle retention", "Aerobic base"],
      goalPriority: "performance-led",
      trainingAgeYears: 7, experienceLevel: "advanced",
      availableDays: 6, sessionDurationMinutes: 70,
      conditioningBackground: "regular", runningBackground: "consistent weekly running for 4 years",
      recoveryCapacity: "moderate", averageSleepHours: 7,
      lifestyleDemand: "active",
      nutritionPhase: "maintenance", adherence: 0.85,
      recentWeightsLb: weighIns(176, 0),
      equipment: ["barbell", "dumbbells", "machines"],
    },
  },
  {
    id: "recovery-limited",
    label: "Recovery-limited athlete",
    proves: "Poor sleep and high work stress must cap the recommended frequency regardless of stated motivation.",
    input: {
      athleteId: "fixture-recovery-limited",
      capturedAt: FIXED_CAPTURE,
      ageYears: 41, sex: "male", heightIn: 69, bodyWeightLb: 190, bodyFatPercent: 22,
      primaryGoal: "Build muscle and get stronger",
      secondaryGoals: ["Consistency"],
      goalPriority: "balanced",
      trainingAgeYears: 4, experienceLevel: "intermediate",
      // Wants six days. Reserve should not give six days.
      availableDays: 6, sessionDurationMinutes: 45,
      recoveryCapacity: "low", averageSleepHours: 5, sleepConsistency: "irregular",
      readinessScore: 48, lifestyleDemand: "physical",
      nutritionPhase: "maintenance", adherence: 0.6,
      recentWeightsLb: weighIns(190, 0),
      equipment: ["barbell", "dumbbells", "machines"],
    },
  },
  {
    id: "beginner",
    label: "Beginner athlete",
    proves: "An early training age with a maximum-results goal must not receive advanced specialization volume.",
    input: {
      athleteId: "fixture-beginner",
      capturedAt: FIXED_CAPTURE,
      ageYears: 24, sex: "male", heightIn: 70, bodyWeightLb: 165,
      // Deliberately aggressive goal language — the engine must not take the bait.
      primaryGoal: "Maximum results — build muscle fast",
      secondaryGoals: ["Learn to lift"],
      goalPriority: "balanced",
      trainingAgeYears: 0.4, experienceLevel: "beginner",
      availableDays: 3, sessionDurationMinutes: 50,
      recoveryCapacity: "moderate", averageSleepHours: 7.5,
      lifestyleDemand: "sedentary",
      nutritionPhase: "maintenance",
      equipment: ["barbell", "dumbbells", "machines"],
    },
  },
  {
    id: "home-gym",
    label: "Home-gym athlete",
    proves: "A load ceiling must change the progression model, not only the exercise substitutions.",
    input: {
      athleteId: "fixture-home-gym",
      capturedAt: FIXED_CAPTURE,
      ageYears: 33, sex: "female", heightIn: 65, bodyWeightLb: 148, bodyFatPercent: 26,
      primaryGoal: "Build muscle at home",
      secondaryGoals: ["Consistency"],
      goalPriority: "balanced",
      trainingAgeYears: 3, experienceLevel: "intermediate",
      availableDays: 4, sessionDurationMinutes: 45,
      recoveryCapacity: "moderate", averageSleepHours: 7,
      lifestyleDemand: "active",
      nutritionPhase: "recomp", adherence: 0.8,
      recentWeightsLb: weighIns(148, 0),
      equipment: ["dumbbells", "bands", "bodyweight"],
    },
  },
  {
    id: "womens-performance",
    label: "Women's performance athlete",
    proves: "A performance and strength goal must reach a performance architecture — not a lower-body-only plan by default.",
    input: {
      athleteId: "fixture-womens-performance",
      capturedAt: FIXED_CAPTURE,
      ageYears: 29, sex: "female", heightIn: 67, bodyWeightLb: 143, bodyFatPercent: 21,
      primaryGoal: "Strength and athletic performance with physique development",
      secondaryGoals: ["Lower-body strength", "Conditioning", "Posture"],
      goalPriority: "performance-led",
      trainingAgeYears: 5, experienceLevel: "advanced",
      availableDays: 5, sessionDurationMinutes: 70,
      conditioningBackground: "regular",
      recoveryCapacity: "high", averageSleepHours: 8,
      lifestyleDemand: "sedentary",
      nutritionPhase: "recomp", adherence: 0.9,
      recentWeightsLb: weighIns(143, 0),
      equipment: ["barbell", "dumbbells", "machines", "cables"],
    },
  },
  {
    id: "grand-touring-with-friday-class",
    label: "Hybrid athlete with a recurring Friday class",
    proves: "A recurring lower-body class must be treated as real training load and reduce the recommended frequency.",
    input: {
      athleteId: "fixture-grand-touring",
      capturedAt: FIXED_CAPTURE,
      ageYears: 30, sex: "male", heightIn: 72, bodyWeightLb: 190, bodyFatPercent: 14,
      primaryGoal: "Hybrid performance — physique with distance capacity",
      secondaryGoals: ["Physique development", "Endurance", "Conditioning"],
      goalPriority: "balanced",
      trainingAgeYears: 6, experienceLevel: "advanced",
      availableDays: 6, sessionDurationMinutes: 70, preferredTrainingTime: "06:00",
      conditioningBackground: "regular", runningBackground: "consistent weekly running for 2 years",
      recoveryCapacity: "moderate", averageSleepHours: 7,
      lifestyleDemand: "sedentary",
      nutritionPhase: "maintenance", adherence: 0.85,
      recentWeightsLb: weighIns(190, 0),
      equipment: ["barbell", "dumbbells", "machines", "cables"],
      recurringActivities: [FRIDAY_LOWER_CLASS],
    },
  },
  {
    id: "minimal-data",
    label: "Athlete with almost no data",
    proves: "Missing information must produce explicit assumptions and low confidence — never invented values or a broken program.",
    input: {
      athleteId: "fixture-minimal-data",
      capturedAt: FIXED_CAPTURE,
      primaryGoal: "Get in shape",
    },
  },
];

export function getFixture(id: string): AthleteFixture | null {
  return ATHLETE_FIXTURES.find((f) => f.id === id) ?? null;
}

export function fixtureSnapshot(id: string): AthleteContextSnapshot | null {
  const f = getFixture(id);
  return f ? buildAthleteSnapshot(f.input) : null;
}

/** All fixture snapshots, built once. */
export function allFixtureSnapshots(): Array<{ fixture: AthleteFixture; snapshot: AthleteContextSnapshot }> {
  return ATHLETE_FIXTURES.map((fixture) => ({ fixture, snapshot: buildAthleteSnapshot(fixture.input) }));
}
