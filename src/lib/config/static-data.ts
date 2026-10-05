export const READINESS_DATA = [
  { day: "Mon", readiness: 82, strain: 63 },
  { day: "Tue", readiness: 78, strain: 70 },
  { day: "Wed", readiness: 86, strain: 58 },
  { day: "Thu", readiness: 74, strain: 76 },
  { day: "Fri", readiness: 88, strain: 54 },
  { day: "Sat", readiness: 91, strain: 49 },
  { day: "Sun", readiness: 84, strain: 61 },
];

export const TRAINING_LOAD_DATA = [
  { block: "W1", load: 68, volume: 74 },
  { block: "W2", load: 72, volume: 78 },
  { block: "W3", load: 76, volume: 82 },
  { block: "W4", load: 64, volume: 66 },
  { block: "W5", load: 81, volume: 84 },
  { block: "W6", load: 79, volume: 80 },
];

export const BLOODWORK_MARKERS = [
  { name: "Testosterone", value: "624", unit: "ng/dL", trend: "up" },
  { name: "Hematocrit", value: "46.2", unit: "%", trend: "stable" },
  { name: "Ferritin", value: "88", unit: "ng/mL", trend: "up" },
  { name: "Vitamin D", value: "52", unit: "ng/mL", trend: "stable" },
];

export const ENHANCED_ROWS = [
  { label: "Compound log", note: "Observational only — no protocols", status: "Active" },
  { label: "Administration log", note: "No recommendations generated", status: "Locked" },
  { label: "Compound history", note: "Log entries only", status: "Active" },
  { label: "Blood panel sync", note: "Trend capture, no interpretation", status: "Active" },
];

export const SUPPORT_STACK = [
  { name: "Vitamin D3", frequency: "Daily", category: "Essential" },
  { name: "Omega-3", frequency: "Daily", category: "Essential" },
  { name: "Magnesium Glycinate", frequency: "Nightly", category: "Recovery" },
  { name: "Zinc", frequency: "Daily", category: "Essential" },
];

export const WATCH_ITEMS = [
  { label: "HRV trending up", signal: "positive", note: "3-day average above baseline" },
  { label: "Training load W6", signal: "neutral", note: "79% — within adaptive window" },
  { label: "Biomarkers due", signal: "watch", note: "Last panel 18 days ago" },
];

// ─── Training ───────────────────────────────────────────────────────────────

export const RECENT_SESSIONS = [
  { date: "May 20", focus: "Batman A — Upper Chest + Lats", volume: 22800, duration: "128 min", sets: 26 },
  { date: "May 19", focus: "Batman — Legs (Quad-Dom)",      volume: 28400, duration: "142 min", sets: 24 },
  { date: "May 18", focus: "Batman B — Upper Chest + Back", volume: 21600, duration: "125 min", sets: 24 },
  { date: "May 17", focus: "Batman — Delts + Arms",         volume: 17200, duration: "110 min", sets: 22 },
  { date: "May 16", focus: "Batman — Legs (Post Chain)",    volume: 26100, duration: "138 min", sets: 22 },
];

export const MOVEMENT_PATTERNS = [
  { pattern: "Horizontal Push", frequency: "2×/wk", status: "on-track" },
  { pattern: "Vertical Pull",   frequency: "2×/wk", status: "on-track" },
  { pattern: "Horizontal Pull", frequency: "2×/wk", status: "on-track" },
  { pattern: "Vertical Push",   frequency: "1×/wk", status: "watch" },
  { pattern: "Hip Hinge",       frequency: "2×/wk", status: "on-track" },
  { pattern: "Squat Pattern",   frequency: "1×/wk", status: "watch" },
  { pattern: "Carry / Core",    frequency: "3×/wk", status: "on-track" },
  { pattern: "Isolation Arm",   frequency: "2×/wk", status: "on-track" },
];

// ─── Recovery ───────────────────────────────────────────────────────────────

export const HRV_DATA = [
  { day: "May 5",  hrv: 58 },
  { day: "May 6",  hrv: 62 },
  { day: "May 7",  hrv: 65 },
  { day: "May 8",  hrv: 61 },
  { day: "May 9",  hrv: 67 },
  { day: "May 10", hrv: 64 },
  { day: "May 11", hrv: 68 },
  { day: "May 12", hrv: 70 },
  { day: "May 13", hrv: 66 },
  { day: "May 14", hrv: 71 },
  { day: "May 15", hrv: 69 },
  { day: "May 16", hrv: 73 },
  { day: "May 17", hrv: 71 },
  { day: "May 18", hrv: 74 },
];

export const SLEEP_DATA = [
  { day: "Mon", duration: 7.2, quality: 72 },
  { day: "Tue", duration: 6.8, quality: 65 },
  { day: "Wed", duration: 8.1, quality: 84 },
  { day: "Thu", duration: 7.4, quality: 76 },
  { day: "Fri", duration: 8.4, quality: 88 },
  { day: "Sat", duration: 8.6, quality: 91 },
  { day: "Sun", duration: 7.8, quality: 82 },
];

export const SORENESS_ZONES = [
  { zone: "Chest",      level: "mild" as const },
  { zone: "Back",       level: "moderate" as const },
  { zone: "Shoulders",  level: "none" as const },
  { zone: "Biceps",     level: "mild" as const },
  { zone: "Triceps",    level: "none" as const },
  { zone: "Quads",      level: "moderate" as const },
  { zone: "Hamstrings", level: "high" as const },
  { zone: "Glutes",     level: "mild" as const },
  { zone: "Calves",     level: "none" as const },
  { zone: "Core",       level: "mild" as const },
];

// ─── Nutrition ───────────────────────────────────────────────────────────────

export const DAILY_MACROS = {
  protein:  { current: 198, target: 220, unit: "g" },
  carbs:    { current: 285, target: 300, unit: "g" },
  fats:     { current: 62,  target: 75,  unit: "g" },
  calories: { current: 2534, target: 2700, unit: "kcal" },
  water:    { current: 3.2,  target: 4.0,  unit: "L" },
};

export const WEEKLY_NUTRITION = [
  { day: "Mon", protein: 88, carbs: 92, fats: 80, calories: 90 },
  { day: "Tue", protein: 95, carbs: 88, fats: 85, calories: 91 },
  { day: "Wed", protein: 82, carbs: 78, fats: 76, calories: 81 },
  { day: "Thu", protein: 91, carbs: 94, fats: 89, calories: 92 },
  { day: "Fri", protein: 88, carbs: 91, fats: 83, calories: 89 },
  { day: "Sat", protein: 76, carbs: 72, fats: 70, calories: 74 },
  { day: "Sun", protein: 90, carbs: 95, fats: 82, calories: 94 },
];

export const MEAL_LOG_TODAY = [
  { time: "7:30 AM",  meal: "Breakfast",   items: ["Oats 80g", "Eggs ×3", "Berries 100g"],              protein: 42, calories: 520 },
  { time: "12:15 PM", meal: "Lunch",        items: ["Chicken 200g", "Rice 150g", "Mixed veg 120g"],      protein: 58, calories: 680 },
  { time: "4:00 PM",  meal: "Pre-workout",  items: ["Whey 30g", "Banana"],                               protein: 28, calories: 280 },
  { time: "7:45 PM",  meal: "Dinner",       items: ["Salmon 180g", "Sweet potato 200g", "Broccoli"],    protein: 48, calories: 620 },
  { time: "9:30 PM",  meal: "Evening",      items: ["Casein 35g", "Peanut butter 20g"],                 protein: 32, calories: 290 },
];

// ─── Ticker ───────────────────────────────────────────────────────────────────

export const TICKER_ITEMS = [
  "READINESS · 84",
  "TRAINING LOAD · 79%",
  "SLEEP AVG · 7.8H",
  "HRV TREND · STABLE",
  "ACTIVE WEEK · W6",
  "NUTRITION LOG · UPDATED",
  "BODY WEIGHT · +1.8 LB / 30D",
  "RECOVERY SCORE · 7.8",
  "CHECK-INS · 18 PENDING",
  "BIOMARKERS · 12 TRACKED",
  "ENHANCED MODULE · OBSERVATIONAL ONLY",
  "BLOODWORK · LOG ONLY — NO MEDICAL ADVICE",
  "SUPPLEMENTS · LOG ONLY — NO DOSAGE GUIDANCE",
  "SYSTEM · NOMINAL",
];
