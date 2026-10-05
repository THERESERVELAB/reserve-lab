/* ════════════════════════════════════════════════════════════════════════
   LOCAL DEVELOPMENT SCENARIO — synthetic demo records only.

   Marcus Hale (Premium Coach) with three connected athletes and one
   pending invitation. Every record is flagged isDemo and every image is a
   generated SVG placeholder — no real people, no real photos, ever.
   Seeding happens once per browser profile and never overwrites edits.
   ════════════════════════════════════════════════════════════════════════ */

import { dateKeyOffset, newId, nowIso, todayKey } from "./ids";
import { FULL_ACCESS_PERMISSIONS, NO_ACCESS_PERMISSIONS, clonePermissions, normalizeCoachingPermissions } from "./permissions";
import { buildAdaptedDay } from "./live-day/engine";
import { buildPlannedDay } from "./live-day/day-plan";
import type { CoachingDatabase, CoachingStore } from "./storage";
import type {
  CoachPrescription,
  CoachingPermissions,
  PhotoPose,
  PhysiquePhotoRecord,
  WeightEntry,
} from "./types";

export const DEMO_SCENARIO_ID = "reserve-coaching-demo-v1";

export const DEMO_IDS = {
  coach: "member-marcus-hale",
  anthony: "member-anthony-rivera",
  jasmine: "member-jasmine-carter",
  luis: "member-luis-bennett",
  noah: "member-noah-williams",
} as const;

/* ─── Placeholder imagery (synthetic SVG, clearly non-photographic) ───── */

function placeholderPhoto(pose: PhotoPose, hue: number, week: string): string {
  const poseLabel = pose.replace(/_/g, " ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue},14%,12%)"/>
      <stop offset="1" stop-color="hsl(${hue},18%,6%)"/>
    </linearGradient>
  </defs>
  <rect width="360" height="480" fill="url(#g)"/>
  <ellipse cx="180" cy="150" rx="46" ry="52" fill="hsl(${hue},10%,22%)"/>
  <rect x="118" y="205" width="124" height="170" rx="48" fill="hsl(${hue},10%,20%)"/>
  <rect x="132" y="378" width="38" height="86" rx="18" fill="hsl(${hue},10%,18%)"/>
  <rect x="190" y="378" width="38" height="86" rx="18" fill="hsl(${hue},10%,18%)"/>
  <text x="180" y="452" text-anchor="middle" font-family="monospace" font-size="13" fill="rgba(255,255,255,0.42)" letter-spacing="2">${poseLabel.toUpperCase()}</text>
  <text x="180" y="30" text-anchor="middle" font-family="monospace" font-size="11" fill="rgba(213,177,95,0.55)" letter-spacing="3">DEMO PLACEHOLDER · ${week}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ─── Weight series generator (deterministic per athlete) ─────────────── */

function weightSeries(
  athleteId: string,
  startLb: number,
  dailyDrift: number,
  days: number,
  wobbleSeed: number,
): WeightEntry[] {
  const today = todayKey();
  const entries: WeightEntry[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    // Deterministic pseudo-wobble — no Math.random so reseeds are stable.
    const wobble = Math.sin((days - i) * wobbleSeed) * 0.7;
    entries.push({
      id: newId("wt"),
      athleteId,
      date: dateKeyOffset(today, -i),
      weightLb: Number((startLb + (days - i) * dailyDrift + wobble).toFixed(1)),
    });
  }
  return entries;
}

/* ─── Scenario assembly ───────────────────────────────────────────────── */

export function buildDemoScenario(db: CoachingDatabase): void {
  const now = nowIso();
  const today = todayKey();

  /* Members */
  db.members.push(
    {
      id: DEMO_IDS.coach, name: "Marcus Hale", email: "marcus.hale@reserve.demo",
      tier: "premium_coach", handle: "marcushale", createdAt: now, isDemo: true,
    },
    {
      id: DEMO_IDS.anthony, name: "Anthony Rivera", email: "anthony.rivera@reserve.demo",
      tier: "premium_personal", createdAt: now, isDemo: true,
    },
    {
      id: DEMO_IDS.jasmine, name: "Jasmine Carter", email: "jasmine.carter@reserve.demo",
      tier: "premium_personal", createdAt: now, isDemo: true,
    },
    {
      id: DEMO_IDS.luis, name: "Luis Bennett", email: "luis.bennett@reserve.demo",
      tier: "premium_personal", createdAt: now, isDemo: true,
    },
    {
      id: DEMO_IDS.noah, name: "Noah Williams", email: "noah.williams@reserve.demo",
      tier: "premium_personal", createdAt: now, isDemo: true,
    },
  );

  db.coachProfiles.push({
    memberId: DEMO_IDS.coach,
    displayName: "Marcus Hale",
    headline: "Physique preparation · performance operations",
    coachCode: "HALE-2291",
    specialties: ["Mass phases", "Recomposition", "Contest logistics"],
    acceptingClients: true,
  });

  db.athleteProfiles.push(
    {
      memberId: DEMO_IDS.anthony, goal: "Lean mass accrual", phase: "Mass Phase",
      phaseWeek: 5, phaseTotalWeeks: 12, currentProgramName: "Reserve Mass Block II",
      startingWeightLb: 176,
    },
    {
      memberId: DEMO_IDS.jasmine, goal: "Body recomposition", phase: "Recomposition",
      phaseWeek: 3, phaseTotalWeeks: 10, currentProgramName: "Recomp Foundation",
      startingWeightLb: 143,
    },
    {
      memberId: DEMO_IDS.luis, goal: "Performance capacity", phase: "Performance Phase",
      phaseWeek: 8, phaseTotalWeeks: 9, currentProgramName: "Output Progression",
      startingWeightLb: 191,
    },
    {
      memberId: DEMO_IDS.noah, goal: "Structured training foundation", phase: "Foundation Phase",
      phaseWeek: 0, phaseTotalWeeks: 8, currentProgramName: null,
    },
  );

  /* Relationships */
  const jasminePermissions: CoachingPermissions = normalizeCoachingPermissions({
    training: "manage",
    nutrition: "suggest",
    schedule: "suggest",
    recovery: "view",
    checkIns: "manage",
    weightTrends: "view",
    measurements: "none",
    biomarkers: "none",
    messaging: "manage",
    liveDayOverrides: "suggest",
    supplements: "suggest",
    dailyDirective: "manage",
    physiquePhotos: { access: "none", mayRequestUploads: false, mayDownloadOriginals: false },
  });
  const luisPermissions: CoachingPermissions = normalizeCoachingPermissions({
    training: "manage",
    nutrition: "manage",
    schedule: "suggest",
    recovery: "view",
    checkIns: "manage",
    weightTrends: "view",
    measurements: "view",
    biomarkers: "none",
    messaging: "manage",
    liveDayOverrides: "suggest",
    // Athlete C scenario: clinician-coordinated record with explicit,
    // LIMITED consent — the coach may view, never modify.
    clinicalRecords: "view",
    physiquePhotos: { access: "view", mayRequestUploads: true, mayDownloadOriginals: false },
  });
  const anthonyPermissions = clonePermissions(FULL_ACCESS_PERMISSIONS);
  anthonyPermissions.physiquePhotos = { access: "full", mayRequestUploads: true, mayDownloadOriginals: true };

  const relAnthony = {
    id: "rel-anthony", coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.anthony,
    status: "active" as const, permissions: anthonyPermissions,
    overrideAuthority: "coach_can_apply" as const,
    startedAt: new Date(Date.now() - 35 * 86_400_000).toISOString(), updatedAt: now,
    initiatedBy: "coach" as const,
  };
  const relJasmine = {
    id: "rel-jasmine", coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.jasmine,
    status: "active" as const, permissions: jasminePermissions,
    overrideAuthority: "coach_suggests" as const,
    startedAt: new Date(Date.now() - 21 * 86_400_000).toISOString(), updatedAt: now,
    initiatedBy: "athlete" as const,
  };
  const relLuis = {
    id: "rel-luis", coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.luis,
    status: "active" as const, permissions: luisPermissions,
    overrideAuthority: "coach_suggests" as const,
    startedAt: new Date(Date.now() - 56 * 86_400_000).toISOString(), updatedAt: now,
    initiatedBy: "coach" as const,
  };
  db.relationships.push(relAnthony, relJasmine, relLuis);
  db.permissionAudit.push(
    {
      id: newId("aud"), relationshipId: relAnthony.id, grantedByMemberId: DEMO_IDS.anthony,
      grantedToMemberId: DEMO_IDS.coach, at: relAnthony.startedAt, action: "granted",
      snapshot: clonePermissions(anthonyPermissions),
    },
    {
      id: newId("aud"), relationshipId: relJasmine.id, grantedByMemberId: DEMO_IDS.jasmine,
      grantedToMemberId: DEMO_IDS.coach, at: relJasmine.startedAt, action: "granted",
      snapshot: clonePermissions(jasminePermissions),
    },
    {
      id: newId("aud"), relationshipId: relLuis.id, grantedByMemberId: DEMO_IDS.luis,
      grantedToMemberId: DEMO_IDS.coach, at: relLuis.startedAt, action: "granted",
      snapshot: clonePermissions(luisPermissions),
    },
  );

  /* Pending invitation — Noah Williams */
  db.invitations.push({
    id: "inv-noah",
    coachId: DEMO_IDS.coach,
    athleteMemberId: DEMO_IDS.noah,
    athleteName: "Noah Williams",
    athleteEmail: "noah.williams@reserve.demo",
    requestedPermissions: clonePermissions({
      ...NO_ACCESS_PERMISSIONS,
      training: "manage", nutrition: "manage", checkIns: "manage", messaging: "manage",
      weightTrends: "view", schedule: "suggest", liveDayOverrides: "suggest",
      physiquePhotos: { access: "view", mayRequestUploads: true, mayDownloadOriginals: false },
    }),
    welcomeNote: "Looking forward to building your next block together.",
    connectionCode: "RSV-N4WX",
    invitationLink: "https://reserve.app/connect/rsv-n4wx",
    status: "sent",
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    expiresAt: new Date(Date.now() + 12 * 86_400_000).toISOString(),
    direction: "coach_to_athlete",
    initiatedBy: "coach",
  });

  /* Weight histories */
  db.weightEntries.push(
    ...weightSeries(DEMO_IDS.anthony, 181.6, 0.055, 28, 1.7), // controlled surplus
    ...weightSeries(DEMO_IDS.jasmine, 141.8, -0.02, 21, 2.3), // recomp, near-flat
    ...weightSeries(DEMO_IDS.luis, 194.2, -0.34, 16, 1.1), // dropping faster than intended
  );

  /* Check-ins */
  db.checkIns.push(
    {
      id: "ci-anthony-latest", athleteId: DEMO_IDS.anthony, relationshipId: relAnthony.id,
      weekOf: dateKeyOffset(today, -7), submittedAt: new Date(Date.now() - 1 * 86_400_000).toISOString(),
      weightLb: 183.2, weeklyAvgWeightLb: 182.8, trainingAdherencePct: 94, nutritionAdherencePct: 88,
      sleepQuality: 4, energy: 4, recovery: 4, stress: 2, hunger: 3, digestion: 4,
      painObservations: "None to report", cardioCompleted: "2 of 2 sessions", stepsAvg: 8900,
      update: "Strong week. Top sets moving well, appetite is high but manageable.",
      questionsForCoach: "", photoSetId: "set-anthony-w5",
    },
    {
      id: "ci-jasmine-old", athleteId: DEMO_IDS.jasmine, relationshipId: relJasmine.id,
      weekOf: dateKeyOffset(today, -14), submittedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
      weightLb: 141.4, weeklyAvgWeightLb: 141.9, trainingAdherencePct: 82, nutritionAdherencePct: 76,
      sleepQuality: 3, energy: 3, recovery: 3, stress: 3, hunger: 3, digestion: 3,
      painObservations: "", cardioCompleted: "1 of 2 sessions", stepsAvg: 7100,
      update: "Busy work stretch — kept most sessions but meal prep slipped mid-week.",
      questionsForCoach: "",
    },
    {
      id: "ci-luis-latest", athleteId: DEMO_IDS.luis, relationshipId: relLuis.id,
      weekOf: dateKeyOffset(today, -7), submittedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      weightLb: 192.6, weeklyAvgWeightLb: 193.1, trainingAdherencePct: 68, nutritionAdherencePct: 71,
      sleepQuality: 2, energy: 2, recovery: 2, stress: 4, hunger: 4, digestion: 3,
      painObservations: "Left knee felt irritable on lunges — nothing sharp.",
      cardioCompleted: "1 of 3 sessions", stepsAvg: 6400,
      update: "Rough week — two sessions missed, sleep broken by travel.",
      questionsForCoach: "Should we pull intensity back until sleep stabilizes?",
    },
  );

  /* Photos — Anthony (full access) + Luis (view) */
  const anthonyPoses: PhotoPose[] = ["front_relaxed", "side_relaxed", "back_relaxed"];
  const mkSet = (
    athleteId: string, setId: string, daysAgo: number, week: string, hue: number,
    weight: number, phase: string, poses: PhotoPose[],
  ): PhysiquePhotoRecord[] =>
    poses.map((pose) => ({
      id: newId("ph"), setId, athleteId,
      date: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
      checkInWeek: week, pose, bodyweightLb: weight, phase,
      lighting: "consistent" as const, src: placeholderPhoto(pose, hue, week),
    }));
  db.photos.push(
    ...mkSet(DEMO_IDS.anthony, "set-anthony-w5", 1, "Week 5", 210, 183.2, "Mass Phase", anthonyPoses),
    ...mkSet(DEMO_IDS.anthony, "set-anthony-w1", 29, "Week 1", 212, 178.4, "Mass Phase", anthonyPoses),
    ...mkSet(DEMO_IDS.luis, "set-luis-w6", 17, "Week 6", 30, 195.8, "Performance Phase", ["front_relaxed", "side_relaxed"]),
  );

  /* Conversations + messages */
  const mkThread = (relId: string, coachId: string, athleteId: string, id: string) => ({
    id, relationshipId: relId, coachId, athleteId,
    createdAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    lastMessageAt: null as string | null, lastMessagePreview: null as string | null,
    lastReadAt: { [coachId]: now, [athleteId]: now } as Record<string, string>,
  });
  const thrAnthony = mkThread(relAnthony.id, DEMO_IDS.coach, DEMO_IDS.anthony, "thr-anthony");
  const thrJasmine = mkThread(relJasmine.id, DEMO_IDS.coach, DEMO_IDS.jasmine, "thr-jasmine");
  const thrLuis = mkThread(relLuis.id, DEMO_IDS.coach, DEMO_IDS.luis, "thr-luis");
  db.conversations.push(thrAnthony, thrJasmine, thrLuis);

  const msg = (
    threadId: string, senderId: string, minutesAgo: number, body: string,
    action?: CoachingDatabase["messages"][number]["action"],
  ) => ({
    id: newId("msg"), threadId, senderId,
    sentAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    body, action,
  });
  db.messages.push(
    msg("thr-anthony", DEMO_IDS.anthony, 260, "Rough start — overslept badly and work moved my morning. Training has to move to tonight."),
    msg("thr-anthony", DEMO_IDS.coach, 240, "No problem. Report it through Adjust Today and I'll review the rebuilt day this afternoon."),
    msg("thr-anthony", DEMO_IDS.anthony, 190, "", {
      kind: "live_day_detected", title: "LIVE DAY CHANGE DETECTED",
      rows: [
        { label: "Wake time", value: "8:10 AM" },
        { label: "Proposed training", value: "8:00 PM" },
        { label: "Potential impact", value: "Meal timing · Training demand · Recovery window" },
      ],
      ctaLabel: "REVIEW DAY", ctaTarget: "live_day", status: "pending",
    }),
    msg("thr-jasmine", DEMO_IDS.coach, 2900, "Check-in window opens tomorrow — same format as last week."),
    msg("thr-jasmine", DEMO_IDS.jasmine, 2600, "Got it. Weight has been steady, will get photos done Sunday."),
    msg("thr-luis", DEMO_IDS.luis, 3100, "Travel wrecked my sleep this week. Knee is a bit irritable on lunges too."),
    msg("thr-luis", DEMO_IDS.coach, 3000, "Logged. Keep lunges out until we review the check-in — swap the leg-press pattern in. If the knee keeps talking, get it looked at."),
  );
  const lastByThread = new Map<string, { at: string; preview: string }>();
  for (const m of db.messages) {
    const prev = lastByThread.get(m.threadId);
    if (!prev || m.sentAt > prev.at) {
      lastByThread.set(m.threadId, { at: m.sentAt, preview: m.action ? m.action.title : m.body.slice(0, 80) });
    }
  }
  for (const thread of db.conversations) {
    const last = lastByThread.get(thread.id);
    if (last) {
      thread.lastMessageAt = last.at;
      thread.lastMessagePreview = last.preview;
    }
  }
  // Anthony's live-day card is unread for the coach.
  thrAnthony.lastReadAt[DEMO_IDS.coach] = new Date(Date.now() - 200 * 60_000).toISOString();

  /* Prescriptions */
  const rxTraining: CoachPrescription = {
    id: "rx-anthony-training", lineageId: "rxl-anthony-training", version: 2,
    coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.anthony, category: "training",
    title: "Reserve Mass Block II",
    summaryOfChanges: ["Week 5–8 progression applied", "Rear-delt volume +2 sets", "Deload confirmed for week 9"],
    reason: "Planned mid-block progression",
    status: "active",
    payload: {
      category: "training",
      training: {
        programName: "Reserve Mass Block II", durationWeeks: 12, splitName: "Chest/Back · Legs · Arms rotation",
        daysPerWeek: 5, progressionStrategy: "Double progression, top set + back-offs", deloadWeek: 9,
        coachingNotes: "Hold RIR honest on top sets — the back-offs create the volume.",
        days: [
          {
            dayLabel: "Monday", title: "Chest / Back — High Output", focus: "Horizontal press + row emphasis",
            demand: "high",
            exercises: [
              { name: "Incline Barbell Press", sets: 4, reps: "6-8", rir: "1-2 RIR", restSeconds: 150 },
              { name: "Chest-Supported Row", sets: 4, reps: "8-10", rir: "1-2 RIR", restSeconds: 120 },
              { name: "Weighted Dip", sets: 3, reps: "8-10", rir: "2 RIR", restSeconds: 120, substitution: "Machine dip" },
              { name: "Lat Pulldown", sets: 3, reps: "10-12", rir: "1 RIR", restSeconds: 90 },
              { name: "Rear-Delt Fly", sets: 3, reps: "12-15", rir: "0-1 RIR", restSeconds: 60 },
            ],
          },
          {
            dayLabel: "Tuesday", title: "Legs — Elite Volume", focus: "Quad-dominant with hinge support",
            demand: "elite",
            exercises: [
              { name: "High-Bar Squat", sets: 4, reps: "5-7", rir: "1-2 RIR", tempo: "3-0-1", restSeconds: 180 },
              { name: "Romanian Deadlift", sets: 3, reps: "8-10", rir: "2 RIR", restSeconds: 150 },
              { name: "Leg Press", sets: 3, reps: "10-12", rir: "1 RIR", restSeconds: 120 },
              { name: "Seated Leg Curl", sets: 3, reps: "10-12", rir: "0-1 RIR", restSeconds: 90 },
              { name: "Standing Calf Raise", sets: 4, reps: "10-12", rir: "1 RIR", restSeconds: 60 },
            ],
          },
          { dayLabel: "Wednesday", title: "Recovery", focus: "Steps + mobility", demand: "recovery", exercises: [], isRest: true },
          {
            dayLabel: "Thursday", title: "Shoulders / Arms", focus: "Lateral head + arm volume", demand: "standard",
            exercises: [
              { name: "Seated DB Press", sets: 4, reps: "8-10", rir: "1-2 RIR", restSeconds: 120 },
              { name: "Lateral Raise", sets: 4, reps: "12-15", rir: "0-1 RIR", restSeconds: 60 },
              { name: "EZ-Bar Curl", sets: 3, reps: "8-10", rir: "1 RIR", restSeconds: 90 },
              { name: "Overhead Triceps Extension", sets: 3, reps: "10-12", rir: "1 RIR", restSeconds: 90 },
            ],
          },
          {
            dayLabel: "Friday", title: "Full Body — Output", focus: "Compound density", demand: "high",
            exercises: [
              { name: "Trap-Bar Deadlift", sets: 4, reps: "5-6", rir: "2 RIR", restSeconds: 180 },
              { name: "Flat DB Press", sets: 3, reps: "8-10", rir: "1 RIR", restSeconds: 120 },
              { name: "Pull-Up", sets: 3, reps: "AMRAP -2", rir: "2 RIR", restSeconds: 120 },
            ],
            cardio: "20 min incline walk post-session",
          },
        ],
      },
    },
    createdAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
    effectiveDate: dateKeyOffset(today, -7),
    audit: [
      { at: new Date(Date.now() - 9 * 86_400_000).toISOString(), actorId: DEMO_IDS.coach, event: "draft_created" },
      { at: new Date(Date.now() - 8 * 86_400_000).toISOString(), actorId: DEMO_IDS.coach, event: "sent_for_approval" },
      { at: new Date(Date.now() - 8 * 86_400_000).toISOString(), actorId: DEMO_IDS.anthony, event: "accepted_by_athlete" },
    ],
  };
  const rxNutrition: CoachPrescription = {
    id: "rx-anthony-nutrition", lineageId: "rxl-anthony-nutrition", version: 3,
    coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.anthony, category: "nutrition",
    title: "Mass Phase Nutrition — Week 5 Adjustment",
    summaryOfChanges: ["Training-day carbohydrate +25 g", "Meal 4 moved into the post-training window"],
    reason: "Weekly average weight tracking at the low end of the target band",
    status: "sent",
    payload: {
      category: "nutrition",
      nutrition: {
        planName: "Mass Phase Nutrition v3", mode: "hybrid",
        trainingDay: { kcal: 3350, protein: 195, carbs: 400, fat: 92, fiber: 38, waterLiters: 4, mealCount: 5, sodiumNote: "Salt to taste around training" },
        restDay: { kcal: 3000, protein: 195, carbs: 320, fat: 96, fiber: 38, waterLiters: 3.5, mealCount: 4 },
        meals: [
          {
            name: "Meal 1", timeWindow: "7:30–8:15 AM",
            foods: [{ food: "Oats", portion: "100 g" }, { food: "Whey isolate", portion: "40 g" }, { food: "Blueberries", portion: "150 g" }],
            estMacros: { kcal: 640, protein: 48, carbs: 88, fat: 12 }, tags: ["flexible"],
          },
          {
            name: "Meal 2", timeWindow: "11:30 AM–12:15 PM",
            foods: [{ food: "Chicken breast", portion: "200 g" }, { food: "Jasmine rice", portion: "250 g cooked" }, { food: "Olive oil", portion: "10 g" }],
            estMacros: { kcal: 720, protein: 52, carbs: 92, fat: 16 },
          },
          {
            name: "Meal 3 — Pre-training", timeWindow: "90 min before session",
            foods: [{ food: "Lean beef", portion: "180 g" }, { food: "White potato", portion: "300 g" }],
            estMacros: { kcal: 640, protein: 46, carbs: 78, fat: 14 }, tags: ["pre-training"],
          },
          {
            name: "Meal 4 — Post-training", timeWindow: "Within 60 min after session",
            foods: [{ food: "Whey isolate", portion: "50 g" }, { food: "Cream of rice", portion: "90 g" }, { food: "Banana", portion: "1" }],
            estMacros: { kcal: 620, protein: 50, carbs: 96, fat: 6 }, tags: ["post-training"],
          },
          {
            name: "Meal 5", timeWindow: "60–90 min before bed",
            foods: [{ food: "Greek yogurt", portion: "250 g" }, { food: "Almond butter", portion: "20 g" }, { food: "Honey", portion: "15 g" }],
            estMacros: { kcal: 480, protein: 34, carbs: 42, fat: 18 },
          },
        ],
        coachingNotes: "Hit the post-training meal consistently on late-training days — that is the slot that slips.",
      },
    },
    createdAt: new Date(Date.now() - 6 * 3_600_000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 3_600_000).toISOString(),
    effectiveDate: dateKeyOffset(today, 1),
    sentAt: new Date(Date.now() - 6 * 3_600_000).toISOString(),
    audit: [
      { at: new Date(Date.now() - 7 * 3_600_000).toISOString(), actorId: DEMO_IDS.coach, event: "draft_created" },
      { at: new Date(Date.now() - 6 * 3_600_000).toISOString(), actorId: DEMO_IDS.coach, event: "sent_for_approval" },
    ],
  };
  db.prescriptions.push(rxTraining, rxNutrition);

  /* Live day — Anthony woke late; Reserve rebuilt; awaiting review */
  const anthonyOriginal = buildPlannedDay({
    wakeTime: "05:15", bedTime: "21:30", trainingTime: "06:00",
    sessionTitle: "Chest / Back — High Output", sessionDemand: "high",
    mealTimes: [
      { label: "Meal 1", time: "07:30" }, { label: "Meal 2", time: "11:30" },
      { label: "Meal 3", time: "14:30" }, { label: "Meal 4", time: "17:00" },
      { label: "Meal 5", time: "20:00" },
    ],
    cardio: { label: "Incline walk · 20 min", time: "18:00" },
    workBlocks: [{ label: "Work block", time: "09:00", durationMinutes: 480 }],
  });
  const adapted = buildAdaptedDay({
    original: anthonyOriginal,
    nowTime: "08:20",
    reason: "late_wake",
    actualWakeTime: "08:10",
    newTrainingTime: "20:00",
    completedEntryIds: [],
    energyLevel: "ok",
    bedtimeFixed: false,
    createdBy: "reserve",
  });
  db.activeDayPlans.push({
    id: "day-anthony-today", athleteId: DEMO_IDS.anthony, date: today,
    originalVersion: anthonyOriginal, liveVersion: anthonyOriginal,
    status: "awaiting_approval",
    lastUpdatedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    lastUpdatedBy: "reserve",
    activeOverrideId: "ovr-anthony-today",
  });
  db.liveDayOverrides.push({
    id: "ovr-anthony-today", athleteId: DEMO_IDS.anthony, date: today,
    source: "athlete", createdBy: DEMO_IDS.anthony, reason: "late_wake",
    originalSnapshot: anthonyOriginal, proposedSnapshot: adapted.proposed,
    status: "proposed",
    explanation: adapted.explanation, impactSummary: adapted.impactSummary,
    warnings: adapted.warnings,
    createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  });
  db.liveDayEvents.push(
    { id: newId("lde"), athleteId: DEMO_IDS.anthony, date: today, at: new Date(Date.now() - 3.2 * 3_600_000).toISOString(), actor: "athlete", actorId: DEMO_IDS.anthony, summary: "Athlete reported late wake time (8:10 AM)" },
    { id: newId("lde"), athleteId: DEMO_IDS.anthony, date: today, at: new Date(Date.now() - 3.1 * 3_600_000).toISOString(), actor: "reserve", actorId: "reserve", summary: "Reserve prepared a revised day" },
    { id: newId("lde"), athleteId: DEMO_IDS.anthony, date: today, at: new Date(Date.now() - 3 * 3_600_000).toISOString(), actor: "athlete", actorId: DEMO_IDS.anthony, summary: "Athlete proposed training at 8:00 PM — sent to coach" },
  );

  /* Coach notes */
  db.notes.push(
    {
      id: newId("note"), coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.luis,
      createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      category: "recovery", visibility: "private",
      body: "Monitor left-knee observation next week. Do not increase lower-body volume until sleep stabilizes.",
      linkedCheckInId: "ci-luis-latest",
    },
    {
      id: newId("note"), coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.anthony,
      createdAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
      category: "nutrition", visibility: "private",
      body: "Reassess calorie target after Sunday weekly average — trending low end of band.",
    },
  );

  /* Templates */
  db.templates.push(
    {
      id: "tpl-mass-block", coachId: DEMO_IDS.coach, category: "training_program",
      name: "Mass Block — 5-Day Rotation", description: "12-week mass framework, double progression, week-9 deload.",
      createdAt: new Date(Date.now() - 40 * 86_400_000).toISOString(), updatedAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
      archived: false,
      payload: { category: "training_program", training: (rxTraining.payload as { category: "training"; training: import("./types").TrainingPrescription }).training },
    },
    {
      id: "tpl-recomp-nutrition", coachId: DEMO_IDS.coach, category: "nutrition_plan",
      name: "Recomposition Nutrition Base", description: "Hybrid macro + meal-structure starting point for recomp clients.",
      createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(), updatedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      archived: false,
      payload: { category: "nutrition_plan", nutrition: (rxNutrition.payload as { category: "nutrition"; nutrition: import("./types").NutritionPrescription }).nutrition },
    },
    {
      id: "tpl-weekly-checkin", coachId: DEMO_IDS.coach, category: "checkin_form",
      name: "Standard Weekly Check-In", description: "Weight, adherence, recovery scales, pain observations, photos.",
      createdAt: new Date(Date.now() - 60 * 86_400_000).toISOString(), updatedAt: new Date(Date.now() - 60 * 86_400_000).toISOString(),
      archived: false,
      payload: { category: "checkin_form", fields: ["Weight", "Weekly average", "Training adherence", "Nutrition adherence", "Sleep", "Energy", "Recovery", "Stress", "Pain observations", "Photos", "Questions"] },
    },
    {
      id: "tpl-recovery-week", coachId: DEMO_IDS.coach, category: "recovery_routine",
      name: "Recovery Reset Week", description: "Deload-adjacent recovery block: mobility, walks, sleep anchors.",
      createdAt: new Date(Date.now() - 25 * 86_400_000).toISOString(), updatedAt: new Date(Date.now() - 25 * 86_400_000).toISOString(),
      archived: false,
      payload: { category: "recovery_routine", description: "Seven days of reduced output with protected sleep windows.", tasks: ["Daily 30-min walk", "10-min evening mobility", "Fixed wake anchor", "No training past 8 PM"] },
    },
  );

  /* Activity feed */
  db.activity.push(
    { id: newId("act"), coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.anthony, at: new Date(Date.now() - 3 * 3_600_000).toISOString(), kind: "checkin_submitted", summary: "Anthony proposed a live-day change — awaiting review" },
    { id: newId("act"), coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.anthony, at: new Date(Date.now() - 1 * 86_400_000).toISOString(), kind: "checkin_submitted", summary: "Anthony submitted his week-5 check-in" },
    { id: newId("act"), coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.anthony, at: new Date(Date.now() - 1 * 86_400_000).toISOString(), kind: "photos_uploaded", summary: "Anthony uploaded a new photo set (Week 5)" },
    { id: newId("act"), coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.luis, at: new Date(Date.now() - 3 * 86_400_000).toISOString(), kind: "checkin_submitted", summary: "Luis submitted his week-8 check-in" },
    { id: newId("act"), coachId: DEMO_IDS.coach, athleteId: null, at: new Date(Date.now() - 2 * 86_400_000).toISOString(), kind: "invitation_sent", summary: "Invitation sent to Noah Williams" },
    { id: newId("act"), coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.anthony, at: new Date(Date.now() - 8 * 86_400_000).toISOString(), kind: "program_published", summary: "Reserve Mass Block II activated for Anthony" },
  );

  db.seededScenario = DEMO_SCENARIO_ID;
}

function upgradeDemoScenario(db: CoachingDatabase): void {
  if (!db.members.some((member) => member.id === DEMO_IDS.noah)) {
    db.members.push({
      id: DEMO_IDS.noah,
      name: "Noah Williams",
      email: "noah.williams@reserve.demo",
      tier: "premium_personal",
      createdAt: nowIso(),
      isDemo: true,
    });
  }
  const noahProfile = db.athleteProfiles.find((profile) => profile.memberId === DEMO_IDS.noah);
  if (!noahProfile) {
    db.athleteProfiles.push({
      memberId: DEMO_IDS.noah,
      goal: "Structured training foundation",
      phase: "Foundation Phase",
      phaseWeek: 0,
      phaseTotalWeeks: 8,
      currentProgramName: null,
    });
  } else if (noahProfile.phase === "Connection Pending") {
    noahProfile.phase = "Foundation Phase";
  }
  const invite = db.invitations.find((item) => item.id === "inv-noah");
  if (invite) {
    invite.athleteMemberId = DEMO_IDS.noah;
    invite.initiatedBy = "coach";
  }
}

/** Idempotent: seeds only an untouched database and evolves safe demo fixtures in place. */
export function ensureDemoScenario(store: CoachingStore): void {
  const db = store.read();
  if (db.seededScenario === DEMO_SCENARIO_ID) {
    const noahProfile = db.athleteProfiles.find((profile) => profile.memberId === DEMO_IDS.noah);
    const noahInvite = db.invitations.find((item) => item.id === "inv-noah");
    if (
      !db.members.some((member) => member.id === DEMO_IDS.noah) ||
      !noahProfile ||
      noahProfile.phase === "Connection Pending" ||
      !noahInvite?.athleteMemberId ||
      !noahInvite.initiatedBy
    ) {
      store.write((data) => upgradeDemoScenario(data));
    }
    return;
  }
  if (db.members.length > 0 || db.relationships.length > 0) return;
  store.write((d) => {
    buildDemoScenario(d);
    upgradeDemoScenario(d);
  });
}
