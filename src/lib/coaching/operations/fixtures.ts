/* ════════════════════════════════════════════════════════════════════════
   PERFORMANCE OPERATIONS — additive demo layer (synthetic only).

   Seeds on top of the base coaching scenario without touching existing
   records. Athlete A (Anthony): structured hypertrophy operation, high
   adherence. Athlete B (Jasmine): fat-loss with shift work, budget-bound
   grocery, repeated disruption. Athlete C (Luis): clinician-coordinated
   record under explicit LIMITED consent — the coach views, never edits.
   ════════════════════════════════════════════════════════════════════════ */

import { dateKeyOffset, newId, nowIso, todayKey } from "../ids";
import type { CoachingDatabase, CoachingStore } from "../storage";
import { DEMO_IDS } from "../fixtures";
import { CLINICAL_ACKNOWLEDGEMENT } from "./types";
import type {
  LifestyleEvent,
  Meal,
  SupplementProtocolItem,
} from "./types";

export const OPERATIONS_DEMO_ID = "reserve-operations-demo-v1";

const item = (
  id: string,
  productName: string,
  category: SupplementProtocolItem["category"],
  servingDescription: string,
  moment: SupplementProtocolItem["moment"],
  frequency: SupplementProtocolItem["frequency"],
  purpose: string,
  withFood: SupplementProtocolItem["withFood"] = "either",
  extra: Partial<SupplementProtocolItem> = {},
): SupplementProtocolItem => ({
  id,
  productName,
  isCustomProduct: false,
  category,
  servingDescription,
  moment,
  frequency,
  purpose,
  withFood,
  purchaseStatus: "owned",
  runningLow: false,
  reminderEnabled: true,
  ...extra,
});

const meal = (
  id: string,
  name: string,
  timeWindow: string,
  ingredients: Array<[string, string, Meal["ingredients"][number]["groceryCategory"]]>,
  est: { kcal: number; protein: number; carbs: number; fat: number },
  extra: Partial<Meal> = {},
): Meal => ({
  id,
  name,
  timeWindow,
  mealType: "exact",
  ingredients: ingredients.map(([n, portion, groceryCategory]) => ({ name: n, portion, groceryCategory })),
  estMacros: est,
  alternatives: [],
  batchPrepEligible: true,
  ...extra,
});

const event = (
  id: string,
  day: string,
  title: string,
  category: LifestyleEvent["category"],
  start: string,
  end: string,
  extra: Partial<LifestyleEvent> = {},
): LifestyleEvent => ({
  id,
  title,
  category,
  day,
  start,
  end,
  priority: "standard",
  flexibility: "movable",
  required: true,
  reminderEnabled: false,
  ...extra,
});

export function buildOperationsDemo(db: CoachingDatabase): void {
  const now = nowIso();
  const today = todayKey();
  const monday = dateKeyOffset(today, -((new Date().getDay() + 6) % 7));

  /* ══ ATHLETE A — Anthony: structured hypertrophy operation ══════════ */

  db.supplementProtocols.unshift({
    id: "prot-anthony", relationshipId: "rel-anthony", athleteId: DEMO_IDS.anthony,
    coachId: DEMO_IDS.coach, status: "active", version: 2,
    createdAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    effectiveAt: dateKeyOffset(today, -6), createdBy: DEMO_IDS.coach,
    athleteDecision: "accepted",
    auditEvents: [
      { at: new Date(Date.now() - 20 * 86_400_000).toISOString(), actorId: DEMO_IDS.coach, event: "draft_created" },
      { at: new Date(Date.now() - 7 * 86_400_000).toISOString(), actorId: DEMO_IDS.coach, event: "sent_for_athlete_review" },
      { at: new Date(Date.now() - 6 * 86_400_000).toISOString(), actorId: DEMO_IDS.anthony, event: "accepted_and_activated" },
    ],
    name: "Mass Phase Support — Block II",
    objective: "Support training output, hydration, and sleep through the mass block.",
    coachRationale: "Ordinary wellness products only — timed around the early session so nothing is missed on work days.",
    reviewDate: dateKeyOffset(today, 15), endDate: null,
    items: [
      item("pi-a1", "Electrolyte mix", "hydration", "1 serving in 500 ml water", "upon_waking", "daily", "Morning hydration before the early session"),
      item("pi-a2", "Creatine monohydrate", "performance", "1 level scoop (5 g)", "post_training", "daily", "Strength and training-volume support", "either"),
      item("pi-a3", "Whey protein", "post_training", "1 scoop in water", "post_training", "training_days", "Post-session protein target support", "either"),
      item("pi-a4", "Vitamin D3", "micronutrient", "1 capsule", "first_meal", "daily", "Coach-noted low sun exposure this block", "with_food"),
      item("pi-a5", "Magnesium glycinate", "sleep", "As labeled on product", "before_sleep", "daily", "Evening wind-down support", "either", { remainingSupplyEstimate: "~10 days", runningLow: true }),
      item("pi-a6", "Omega-3 fish oil", "general_wellness", "As labeled on product", "first_meal", "daily", "General wellness support", "with_food"),
    ],
    trainingDayItemIds: ["pi-a3"], restDayItemIds: [],
  });
  const yesterday = dateKeyOffset(today, -1);
  for (const [itemId, mark] of [["pi-a1", "taken"], ["pi-a2", "taken"], ["pi-a3", "taken"], ["pi-a4", "taken"], ["pi-a5", "skipped"], ["pi-a6", "taken"]] as const) {
    db.protocolAdherence.push({ id: newId("adh"), protocolId: "prot-anthony", athleteId: DEMO_IDS.anthony, itemId, date: yesterday, mark, at: now });
  }

  db.nutritionArchitectures.unshift({
    id: "arch-anthony", relationshipId: "rel-anthony", athleteId: DEMO_IDS.anthony, coachId: DEMO_IDS.coach,
    status: "active", version: 1,
    createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    effectiveAt: dateKeyOffset(today, -10), createdBy: DEMO_IDS.coach,
    athleteDecision: "accepted",
    auditEvents: [
      { at: new Date(Date.now() - 14 * 86_400_000).toISOString(), actorId: DEMO_IDS.coach, event: "draft_created" },
      { at: new Date(Date.now() - 10 * 86_400_000).toISOString(), actorId: DEMO_IDS.anthony, event: "accepted_and_activated" },
    ],
    name: "Mass Block Architecture",
    trainingDay: { kcal: 3100, protein: 230, carbs: 396, fat: 66, fiber: 38, waterLiters: 4, mealCount: 5, feedingWindow: "7:30–21:00", sodiumNote: "Salt training-day meals to taste — morning session sweats heavily." },
    restDay: { kcal: 2800, protein: 230, carbs: 310, fat: 70, fiber: 38, waterLiters: 3.5, mealCount: 4, feedingWindow: "8:00–20:30" },
    travelDayNote: "Hold protein, let carbs float to what's available; hotel breakfast anchors the day.",
    refeedNote: "Not used this block — surplus is already programmed.",
    flexibleMealRules: "Post-training slot may move ±60 min; keep the pre-bed meal light.",
    restaurantRules: "Order protein-first; one plate, no appetizer round.",
    emergencyFallback: "Shaker + oats packet + banana kept in the training bag.",
    preferences: {
      likedFoods: ["Rice", "Beef", "Blueberries", "Greek yogurt"],
      dislikedFoods: ["Salmon"],
      allergies: [],
      cookingSkill: "confident",
      appliances: ["Oven", "Stovetop", "Rice cooker", "Air fryer"],
      groceryFrequency: "weekly",
      prepAvailability: "Sunday afternoon + Wednesday evening top-up",
      hydrationStrategy: "500 ml on waking, 1 L across the session, steady after.",
    },
  });

  const anthonyMeals: Meal[] = [
    meal("m-a1", "Oats, Whey & Blueberries", "7:30–8:15 AM",
      [["Oats", "100 g", "carbohydrates"], ["Whey protein", "1 scoop", "supplements"], ["Blueberries", "150 g", "produce"]],
      { kcal: 640, protein: 48, carbs: 88, fat: 12 }),
    meal("m-a2", "Chicken & Jasmine Rice Bowl", "11:30 AM–12:15 PM",
      [["Chicken breast", "200 g", "protein"], ["Jasmine rice", "250 g cooked", "carbohydrates"], ["Olive oil", "10 g", "fats"], ["Broccoli", "150 g", "produce"]],
      { kcal: 720, protein: 52, carbs: 92, fat: 16 },
      { prepInstructions: "Batch-cook in the oven with rice on the stovetop.", storageGuidance: "Refrigerate up to 4 days.", reheatingGuidance: "Microwave 2 minutes with a splash of water." }),
    meal("m-a3", "Beef & Potato Plate", "3:00–3:45 PM",
      [["Lean beef (93/7)", "180 g", "protein"], ["White potato", "300 g", "carbohydrates"], ["Green beans", "120 g", "produce"]],
      { kcal: 640, protein: 46, carbs: 78, fat: 14 },
      { prepInstructions: "Oven-roast potatoes; pan-sear beef.", batchPrepEligible: true }),
    meal("m-a4", "Post-Training Shake & Cream of Rice", "Within 60 min after training",
      [["Whey protein", "1.5 scoops", "supplements"], ["Cream of rice", "90 g", "carbohydrates"], ["Banana", "1", "produce"]],
      { kcal: 620, protein: 50, carbs: 96, fat: 6 }, { mealType: "flexible", batchPrepEligible: false }),
    meal("m-a5", "Greek Yogurt Bowl", "60–90 min before bed",
      [["Greek yogurt 2%", "250 g", "dairy_alternatives"], ["Almond butter", "20 g", "fats"], ["Honey", "15 g", "pantry"]],
      { kcal: 480, protein: 34, carbs: 42, fat: 18 }, { batchPrepEligible: false }),
  ];
  db.mealPlans.unshift({
    id: "mp-anthony", relationshipId: "rel-anthony", athleteId: DEMO_IDS.anthony, coachId: DEMO_IDS.coach,
    status: "active", version: 1,
    createdAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    effectiveAt: dateKeyOffset(today, -10), createdBy: DEMO_IDS.coach,
    athleteDecision: "accepted",
    auditEvents: [
      { at: new Date(Date.now() - 12 * 86_400_000).toISOString(), actorId: DEMO_IDS.coach, event: "draft_created" },
      { at: new Date(Date.now() - 10 * 86_400_000).toISOString(), actorId: DEMO_IDS.anthony, event: "accepted_and_activated" },
    ],
    name: "Mass Block — 5-Meal Training Day",
    scope: "seven_day",
    architectureId: "arch-anthony",
    meals: anthonyMeals,
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((dayLabel) => ({
      dayLabel, mealIds: anthonyMeals.map((m) => m.id),
    })),
    coachNote: "Post-training slot is the one that slips on late days — protect it.",
  });

  db.mealPrepSessions.unshift({
    id: "prep-anthony-sun", relationshipId: "rel-anthony", athleteId: DEMO_IDS.anthony, coachId: DEMO_IDS.coach,
    prepDate: dateKeyOffset(monday, -1), cookingWindow: "14:00–16:30", planId: "mp-anthony",
    servingsByMeal: { "m-a2": 4, "m-a3": 4 },
    preparedMeals: [
      { id: "pm-a1", sessionId: "prep-anthony-sun", mealId: "m-a2", mealName: "Chicken & Jasmine Rice Bowl", servings: 4, container: "Glass 1–4", storage: "refrigerator", state: "consumed", expiresOn: dateKeyOffset(monday, 3) },
      { id: "pm-a2", sessionId: "prep-anthony-sun", mealId: "m-a3", mealName: "Beef & Potato Plate", servings: 4, container: "Glass 5–8", storage: "refrigerator", state: "packed", expiresOn: dateKeyOffset(monday, 3) },
    ],
    status: "complete", createdAt: now, updatedAt: now,
  });
  db.mealPrepSessions.unshift({
    id: "prep-anthony-wed", relationshipId: "rel-anthony", athleteId: DEMO_IDS.anthony, coachId: DEMO_IDS.coach,
    prepDate: dateKeyOffset(monday, 2), cookingWindow: "18:30–20:00", planId: "mp-anthony",
    servingsByMeal: { "m-a2": 3, "m-a3": 3 },
    preparedMeals: [
      { id: "pm-a3", sessionId: "prep-anthony-wed", mealId: "m-a2", mealName: "Chicken & Jasmine Rice Bowl", servings: 3, storage: "refrigerator", state: "planned", expiresOn: dateKeyOffset(monday, 6) },
      { id: "pm-a4", sessionId: "prep-anthony-wed", mealId: "m-a3", mealName: "Beef & Potato Plate", servings: 3, storage: "refrigerator", state: "planned", expiresOn: dateKeyOffset(monday, 6) },
    ],
    status: "planned", createdAt: now, updatedAt: now,
  });

  db.pantryItems.push(
    { id: newId("pan"), athleteId: DEMO_IDS.anthony, name: "Jasmine rice", quantity: "2 kg bag", runningLow: false, updatedAt: now },
    { id: newId("pan"), athleteId: DEMO_IDS.anthony, name: "Olive oil", quantity: "500 ml", runningLow: false, updatedAt: now },
    { id: newId("pan"), athleteId: DEMO_IDS.anthony, name: "Honey", quantity: "Half jar", runningLow: true, updatedAt: now },
  );
  db.storeProfiles.push(
    { id: "store-a1", athleteId: DEMO_IDS.anthony, name: "Weekly warehouse run", kind: "warehouse_club", note: "Proteins in bulk" },
    { id: "store-a2", athleteId: DEMO_IDS.anthony, name: "Neighborhood grocery", kind: "general_grocery" },
  );
  db.groceryPlans.unshift({
    id: "gp-anthony", relationshipId: "rel-anthony", athleteId: DEMO_IDS.anthony, coachId: DEMO_IDS.coach,
    weekOf: monday, sourcePlanId: "mp-anthony", storeProfileId: "store-a1",
    budgetTarget: undefined, estimatedSpend: "$95–110",
    items: [
      { id: newId("gi"), name: "Chicken breast", quantity: "200 g × 7", category: "protein", usedIn: ["Chicken & Jasmine Rice Bowl"], addedBy: "plan", required: false, state: "purchased", carryover: false },
      { id: newId("gi"), name: "Lean beef (93/7)", quantity: "180 g × 7", category: "protein", usedIn: ["Beef & Potato Plate"], addedBy: "plan", required: false, state: "purchased", carryover: false },
      { id: newId("gi"), name: "Blueberries", quantity: "150 g × 5", category: "produce", usedIn: ["Oats, Whey & Blueberries"], addedBy: "plan", required: false, state: "purchased", carryover: false },
      { id: newId("gi"), name: "White potato", quantity: "300 g × 7", category: "carbohydrates", usedIn: ["Beef & Potato Plate"], addedBy: "plan", required: false, state: "needed", carryover: false },
      { id: newId("gi"), name: "Greek yogurt 2%", quantity: "250 g × 7", category: "dairy_alternatives", usedIn: ["Greek Yogurt Bowl"], addedBy: "plan", required: false, state: "needed", carryover: false },
      { id: newId("gi"), name: "Magnesium glycinate", quantity: "1 bottle", category: "supplements", usedIn: [], addedBy: "coach", required: true, state: "needed", carryover: false, preferredBrand: "Current brand on hand" },
    ],
    status: "shopping", createdAt: now, updatedAt: now,
  });

  const anthonyWeek: LifestyleEvent[] = [];
  for (const day of ["Mon", "Tue", "Thu", "Fri"]) {
    anthonyWeek.push(
      event(`la-${day}-wake`, day, "Wake", "wake", "05:15", "05:25", { priority: "anchor", flexibility: "fixed" }),
      event(`la-${day}-train`, day, "Training — Mass Block", "training", "06:00", "07:15", { priority: "anchor", travelBufferMinutes: 15 }),
      event(`la-${day}-m1`, day, "Meal 1", "meal", "07:45", "08:10"),
      event(`la-${day}-work`, day, "Work block", "work", "09:00", "17:00", { flexibility: "fixed" }),
      event(`la-${day}-m4`, day, "Post-work meal", "meal", "17:30", "18:00"),
      event(`la-${day}-walk`, day, "Evening walk", "walking", "19:00", "19:30", { required: false, priority: "optional" }),
      event(`la-${day}-wind`, day, "Wind-down", "sleep_prep", "20:45", "21:15", { required: false }),
      event(`la-${day}-bed`, day, "Bedtime", "bedtime", "21:30", "21:30", { priority: "anchor" }),
    );
  }
  anthonyWeek.push(
    event("la-Sun-prep", "Sun", "Meal preparation", "meal_prep", "14:00", "16:30", { priority: "anchor" }),
    event("la-Sun-grocery", "Sun", "Grocery run", "grocery", "11:00", "12:00"),
    event("la-Wed-prep", "Wed", "Top-up meal prep", "meal_prep", "18:30", "20:00"),
  );
  db.lifestylePlans.unshift({
    id: "life-anthony", relationshipId: "rel-anthony", athleteId: DEMO_IDS.anthony, coachId: DEMO_IDS.coach,
    status: "active", version: 1,
    createdAt: new Date(Date.now() - 15 * 86_400_000).toISOString(), updatedAt: now,
    effectiveAt: dateKeyOffset(today, -14), createdBy: DEMO_IDS.coach,
    athleteDecision: "accepted",
    auditEvents: [{ at: new Date(Date.now() - 15 * 86_400_000).toISOString(), actorId: DEMO_IDS.coach, event: "draft_created" }],
    name: "Mass Block Operating Week", weekKind: "standard",
    events: anthonyWeek, exceptions: [],
  });

  db.directivePreferences.push({
    relationshipId: "rel-anthony", athleteId: DEMO_IDS.anthony, coachId: DEMO_IDS.coach,
    enabled: true, tone: "measured", focus: "training_execution", frequency: "daily",
    deliveryWindow: "morning", length: "standard", athleteSensitivity: "standard",
    includeQuotation: "none",
    privateCoachInstruction: "Anthony responds to precision, not hype. Keep it operational.",
    updatedAt: now,
  });
  db.dailyDirectives.push({
    id: "dir-anthony-today", relationshipId: "rel-anthony", athleteId: DEMO_IDS.anthony, coachId: DEMO_IDS.coach,
    date: today,
    body: "Today is about exact execution, not intensity for its own sake. Protect the training window and finish every planned working set with honest effort. Today holds: Training — Chest / Back · 5 meals planned. Momentum is real — 94% training adherence last week. Bank another day like it.",
    tone: "measured", focus: "training_execution",
    basis: ["Tone: measured", "Focus: training_execution", "Today's schedule", "Recent win"],
    status: "delivered", createdAt: now, approvedAt: now,
  });

  /* ══ ATHLETE B — Jasmine: fat-loss, shift work, budget, disruption ══ */

  db.nutritionArchitectures.unshift({
    id: "arch-jasmine", relationshipId: "rel-jasmine", athleteId: DEMO_IDS.jasmine, coachId: DEMO_IDS.coach,
    status: "active", version: 2,
    createdAt: new Date(Date.now() - 25 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    effectiveAt: dateKeyOffset(today, -9), createdBy: DEMO_IDS.coach,
    athleteDecision: "accepted",
    auditEvents: [
      { at: new Date(Date.now() - 25 * 86_400_000).toISOString(), actorId: DEMO_IDS.coach, event: "draft_created" },
      { at: new Date(Date.now() - 9 * 86_400_000).toISOString(), actorId: DEMO_IDS.jasmine, event: "accepted_and_activated" },
    ],
    name: "Recomp Architecture — Shift Rotation",
    trainingDay: { kcal: 1850, protein: 150, carbs: 175, fat: 55, fiber: 30, waterLiters: 3, mealCount: 4, feedingWindow: "Flexible around shift" },
    restDay: { kcal: 1650, protein: 150, carbs: 130, fat: 55, fiber: 30, waterLiters: 3, mealCount: 3 },
    travelDayNote: "Not applicable this phase.",
    flexibleMealRules: "Shift days: any two meals may swap order; protein target is the only fixed line.",
    restaurantRules: "Grilled protein + visible starch; sauces on the side.",
    emergencyFallback: "Cottage cheese cup + fruit from the hospital shop.",
    preferences: {
      likedFoods: ["Eggs", "Turkey", "Rice bowls"],
      dislikedFoods: ["Oily fish"],
      allergies: [],
      digestiveLimitations: "Large late meals sit poorly before early shifts.",
      weeklyBudget: "$70 weekly",
      cookingSkill: "basic",
      appliances: ["Stovetop", "Sheet pan", "Microwave at work"],
      groceryFrequency: "weekly",
      prepAvailability: "Wednesday late afternoon only",
      hydrationStrategy: "Bottle refills on shift breaks — track by cap marks.",
    },
  });

  const jasmineMeals: Meal[] = [
    meal("m-j1", "Egg White Veggie Scramble", "Within 1h of waking",
      [["Egg whites", "250 g", "protein"], ["Spinach", "80 g", "produce"], ["Sourdough", "1 slice", "carbohydrates"]],
      { kcal: 340, protein: 32, carbs: 34, fat: 8 }, { mealType: "flexible" }),
    meal("m-j2", "Turkey Rice Bowl", "Mid-shift break",
      [["Ground turkey 93/7", "150 g", "protein"], ["White rice", "180 g cooked", "carbohydrates"], ["Mixed vegetables (frozen)", "150 g", "frozen"]],
      { kcal: 480, protein: 38, carbs: 52, fat: 12 },
      { batchPrepEligible: true, storageGuidance: "Refrigerate up to 4 days — take to shift in a cooler bag.", alternatives: [{ kind: "budget", description: "Swap turkey for canned tuna on tight weeks." }] }),
    meal("m-j3", "Cottage Cheese & Fruit", "Post-shift",
      [["Cottage cheese 2%", "200 g", "dairy_alternatives"], ["Apple", "1", "produce"]],
      { kcal: 260, protein: 26, carbs: 28, fat: 5 }, { mealType: "flexible", batchPrepEligible: false }),
    meal("m-j4", "Sheet-Pan Chicken & Potatoes", "Evening meal",
      [["Chicken thighs", "160 g", "protein"], ["Baby potatoes", "220 g", "carbohydrates"], ["Zucchini", "120 g", "produce"]],
      { kcal: 520, protein: 38, carbs: 46, fat: 20 },
      { batchPrepEligible: true, alternatives: [{ kind: "restaurant", description: "Grilled-protein plate with a starch side; skip fried options." }] }),
  ];
  db.mealPlans.unshift({
    id: "mp-jasmine", relationshipId: "rel-jasmine", athleteId: DEMO_IDS.jasmine, coachId: DEMO_IDS.coach,
    status: "sent", version: 2,
    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 3_600_000).toISOString(),
    effectiveAt: dateKeyOffset(today, 2), createdBy: DEMO_IDS.coach,
    supersedesId: undefined,
    athleteDecision: "pending",
    auditEvents: [
      { at: new Date(Date.now() - 3 * 86_400_000).toISOString(), actorId: DEMO_IDS.coach, event: "draft_created" },
      { at: new Date(Date.now() - 8 * 3_600_000).toISOString(), actorId: DEMO_IDS.coach, event: "sent_for_athlete_review" },
    ],
    name: "Recomp — Shift-Week Structure v2",
    scope: "rotating_two_week",
    architectureId: "arch-jasmine",
    meals: jasmineMeals,
    days: [
      { dayLabel: "Shift Day", mealIds: ["m-j1", "m-j2", "m-j3"] },
      { dayLabel: "Off Day", mealIds: ["m-j1", "m-j4", "m-j3"] },
    ],
    coachNote: "Built around the rotating shift — flexible slots where the schedule is least predictable.",
  });

  db.groceryPlans.unshift({
    id: "gp-jasmine", relationshipId: "rel-jasmine", athleteId: DEMO_IDS.jasmine, coachId: DEMO_IDS.coach,
    weekOf: monday, sourcePlanId: "mp-jasmine", storeProfileId: "store-j1",
    budgetTarget: "$70 weekly", estimatedSpend: "$64",
    items: [
      { id: newId("gi"), name: "Egg whites", quantity: "250 g × 5", category: "protein", usedIn: ["Egg White Veggie Scramble"], addedBy: "plan", required: false, state: "purchased", carryover: false },
      { id: newId("gi"), name: "Ground turkey 93/7", quantity: "150 g × 5", category: "protein", usedIn: ["Turkey Rice Bowl"], addedBy: "plan", required: false, state: "unavailable", replacementNote: "Store out of stock — approved tuna swap used", carryover: false },
      { id: newId("gi"), name: "Mixed vegetables (frozen)", quantity: "150 g × 5", category: "frozen", usedIn: ["Turkey Rice Bowl"], addedBy: "plan", required: false, state: "purchased", carryover: false },
      { id: newId("gi"), name: "Cottage cheese 2%", quantity: "200 g × 4", category: "dairy_alternatives", usedIn: ["Cottage Cheese & Fruit"], addedBy: "plan", required: false, state: "needed", carryover: true },
      { id: newId("gi"), name: "Chicken thighs", quantity: "160 g × 3", category: "protein", usedIn: ["Sheet-Pan Chicken & Potatoes"], addedBy: "plan", required: false, state: "needed", carryover: false },
    ],
    status: "shopping", createdAt: now, updatedAt: now,
  });
  db.storeProfiles.push({ id: "store-j1", athleteId: DEMO_IDS.jasmine, name: "Discount grocery", kind: "general_grocery", note: "Budget target $70/week" });

  const jasmineWeek: LifestyleEvent[] = [
    // Early-shift days
    event("lj-Mon-wake", "Mon", "Wake", "wake", "04:45", "04:55", { priority: "anchor", flexibility: "fixed" }),
    event("lj-Mon-shift", "Mon", "Hospital shift", "work", "06:00", "18:30", { flexibility: "fixed", travelBufferMinutes: 30 }),
    event("lj-Mon-train", "Mon", "Training — Recomp B", "training", "19:15", "20:15", { travelBufferMinutes: 20 }),
    event("lj-Mon-bed", "Mon", "Bedtime", "bedtime", "22:00", "22:00", { priority: "anchor" }),
    event("lj-Tue-wake", "Tue", "Wake", "wake", "04:45", "04:55", { priority: "anchor", flexibility: "fixed" }),
    event("lj-Tue-shift", "Tue", "Hospital shift", "work", "06:00", "18:30", { flexibility: "fixed", travelBufferMinutes: 30 }),
    event("lj-Tue-bed", "Tue", "Bedtime", "bedtime", "21:45", "21:45", { priority: "anchor" }),
    // Off days
    event("lj-Wed-wake", "Wed", "Wake", "wake", "07:30", "07:40", { priority: "anchor" }),
    event("lj-Wed-train", "Wed", "Training — Recomp A", "training", "09:30", "10:30"),
    event("lj-Wed-prep", "Wed", "Batch prep for shift days", "meal_prep", "16:00", "17:30", { priority: "anchor" }),
    event("lj-Wed-bed", "Wed", "Bedtime", "bedtime", "22:30", "22:30", { priority: "anchor" }),
  ];
  db.lifestylePlans.unshift({
    id: "life-jasmine", relationshipId: "rel-jasmine", athleteId: DEMO_IDS.jasmine, coachId: DEMO_IDS.coach,
    status: "active", version: 3,
    createdAt: new Date(Date.now() - 18 * 86_400_000).toISOString(), updatedAt: now,
    effectiveAt: dateKeyOffset(today, -7), createdBy: DEMO_IDS.coach,
    athleteDecision: "accepted",
    auditEvents: [{ at: now, actorId: DEMO_IDS.coach, event: "shift_rotation_updated" }],
    name: "Shift Rotation Week", weekKind: "shift_work",
    events: jasmineWeek, exceptions: [],
  });

  db.directivePreferences.push({
    relationshipId: "rel-jasmine", athleteId: DEMO_IDS.jasmine, coachId: DEMO_IDS.coach,
    enabled: true, tone: "reassuring", focus: "consistency", frequency: "daily",
    deliveryWindow: "morning", length: "brief", athleteSensitivity: "gentle",
    includeQuotation: "none",
    privateCoachInstruction: "Shift weeks are heavy — direction, not pressure.",
    updatedAt: now,
  });

  /* ══ ATHLETE C — Luis: clinician-coordinated record, limited consent ═ */

  db.clinicalConsents.push({
    id: "consent-luis", relationshipId: "rel-luis", athleteId: DEMO_IDS.luis, coachId: DEMO_IDS.coach,
    scope: "view",
    grantedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    acknowledgement: CLINICAL_ACKNOWLEDGEMENT,
    history: [{ at: new Date(Date.now() - 30 * 86_400_000).toISOString(), scope: "view", actorId: DEMO_IDS.luis }],
  });
  db.clinicalRecords.unshift({
    id: "clin-luis-1", relationshipId: "rel-luis", athleteId: DEMO_IDS.luis,
    disclosedName: "Clinician-directed hormone therapy (athlete-disclosed)",
    category: "hormone_therapy",
    clinicianOrPractice: "Private men's-health practice (athlete-managed)",
    prescriptionStatus: "prescribed",
    startDate: dateKeyOffset(today, -60), reviewDate: dateKeyOffset(today, 30),
    athleteReportedSchedule: "As directed by clinician — athlete manages administration",
    athleteReportedRoute: "Per clinician instruction",
    documentationStatus: "documented",
    monitoringRequirements: "Quarterly lab panel per clinician; blood pressure checks weekly",
    labReminderDate: dateKeyOffset(today, 12), followUpDate: dateKeyOffset(today, 30),
    status: "active",
    createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    createdBy: DEMO_IDS.luis,
    acknowledgement: CLINICAL_ACKNOWLEDGEMENT,
    auditEvents: [{ at: new Date(Date.now() - 30 * 86_400_000).toISOString(), actorId: DEMO_IDS.luis, event: "record_created" }],
  });
  db.clinicalObservations.push(
    {
      id: newId("obs"), recordId: "clin-luis-1", athleteId: DEMO_IDS.luis, authorId: DEMO_IDS.luis,
      authorRole: "athlete", at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      kind: "sleep", note: "Sleep shorter than usual this week with travel.", severity: "routine",
    },
    {
      id: newId("obs"), recordId: "clin-luis-1", athleteId: DEMO_IDS.luis, authorId: DEMO_IDS.luis,
      authorRole: "athlete", at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      kind: "blood_pressure", note: "Home reading 128/82 after rest day.", severity: "routine",
    },
  );
  db.clinicalAccessLog.push({
    id: newId("cal"), recordScopeAthleteId: DEMO_IDS.luis, accessorId: DEMO_IDS.coach,
    at: new Date(Date.now() - 4 * 86_400_000).toISOString(), action: "viewed",
  });

  db.seededOperations = OPERATIONS_DEMO_ID;
}

/** Additive + idempotent: seeds only when the base scenario exists and the
    operations layer hasn't been seeded. Never touches existing records. */
export function ensureOperationsDemo(store: CoachingStore): void {
  const db = store.read();
  if (db.seededOperations === OPERATIONS_DEMO_ID) return;
  if (!db.seededScenario) return;
  if (!db.relationships.some((r) => r.id === "rel-anthony")) return;
  store.write((d) => buildOperationsDemo(d));
}
