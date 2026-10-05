/* ─── Elite tier observational data scaffolding ─────────────────────────── */
/* All data here is for log-only / trend observation. No diagnoses, no medical
 * recommendations, no protocols, no dosage guidance.                         */

/**
 * DEMO DATA ONLY. Everything in this file is fabricated showcase content and
 * must NEVER render for a real member. Views consuming these constants gate
 * on this flag and show honest empty states in production.
 */
export const ELITE_DEMO_DATA_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "true";

/* ── Physique Intelligence ──────────────────────────────────────────────── */

export type SymmetryZone = {
  zone: string;
  side: "left" | "right" | "center";
  score: number; // 0-100 observational
  trend: "up" | "stable" | "down";
};

export const SYMMETRY_ZONES: SymmetryZone[] = [
  { zone: "Upper Chest", side: "left",   score: 82, trend: "up" },
  { zone: "Upper Chest", side: "right",  score: 84, trend: "up" },
  { zone: "Lat Spread",  side: "left",   score: 78, trend: "stable" },
  { zone: "Lat Spread",  side: "right",  score: 76, trend: "stable" },
  { zone: "Lateral Delt", side: "left",  score: 71, trend: "up" },
  { zone: "Lateral Delt", side: "right", score: 74, trend: "up" },
  { zone: "Bicep Peak",  side: "left",   score: 68, trend: "down" },
  { zone: "Bicep Peak",  side: "right",  score: 72, trend: "stable" },
  { zone: "Quad Sweep",  side: "left",   score: 81, trend: "up" },
  { zone: "Quad Sweep",  side: "right",  score: 79, trend: "up" },
  { zone: "Calf",        side: "left",   score: 64, trend: "stable" },
  { zone: "Calf",        side: "right",  score: 66, trend: "stable" },
];

export const LAGGING_GROUPS = [
  { group: "Calves",        priority: "high",   note: "Below symmetry baseline 14 days" },
  { group: "Lateral Delts", priority: "medium", note: "Trending up — continue current frequency" },
  { group: "Hamstrings",    priority: "medium", note: "Vol observed below program target" },
];

export const PHYSIQUE_TIMELINE = [
  { date: "Mar 02", weight: 192.4, bodyFat: 12.8, condition: "Off-season" },
  { date: "Mar 16", weight: 193.1, bodyFat: 12.4, condition: "Off-season" },
  { date: "Mar 30", weight: 193.8, bodyFat: 12.1, condition: "Mini-cut" },
  { date: "Apr 13", weight: 192.6, bodyFat: 11.6, condition: "Mini-cut" },
  { date: "Apr 27", weight: 191.2, bodyFat: 11.2, condition: "Lean phase" },
  { date: "May 11", weight: 189.8, bodyFat: 10.7, condition: "Lean phase" },
];

/* ── Mesocycle Planner ──────────────────────────────────────────────────── */

export type MesocycleBlock = {
  week: string;
  phase: "Accumulation" | "Intensification" | "Realization" | "Deload";
  rpe: number;
  volume: number;
  intensity: number;
  status: "complete" | "active" | "upcoming";
};

export const MESOCYCLE_BLOCKS: MesocycleBlock[] = [
  { week: "W1", phase: "Accumulation",    rpe: 7,   volume: 78, intensity: 68, status: "complete" },
  { week: "W2", phase: "Accumulation",    rpe: 7.5, volume: 82, intensity: 72, status: "complete" },
  { week: "W3", phase: "Accumulation",    rpe: 8,   volume: 86, intensity: 76, status: "complete" },
  { week: "W4", phase: "Deload",           rpe: 6,   volume: 58, intensity: 62, status: "complete" },
  { week: "W5", phase: "Intensification", rpe: 8.5, volume: 80, intensity: 84, status: "complete" },
  { week: "W6", phase: "Intensification", rpe: 9,   volume: 76, intensity: 88, status: "active"   },
  { week: "W7", phase: "Realization",     rpe: 9.5, volume: 64, intensity: 94, status: "upcoming" },
  { week: "W8", phase: "Deload",           rpe: 5,   volume: 50, intensity: 58, status: "upcoming" },
];

export const SPECIALIZATION_BLOCKS = [
  { focus: "Upper Chest",   weeks: "W1–W4", status: "complete", note: "Frequency 3×/wk, isolation primary" },
  { focus: "Lateral Delts", weeks: "W5–W8", status: "active",   note: "Frequency 3×/wk, high-rep accumulation" },
  { focus: "Posterior Chain", weeks: "W9–W12", status: "queued", note: "Hinge variants + RDLs primary" },
];

export const FATIGUE_SIGNALS = [
  { signal: "HRV deviation",       value: "Within band",   status: "ok" as const },
  { signal: "Subjective recovery", value: "8.2 / 10",       status: "ok" as const },
  { signal: "Bar speed velocity",  value: "-3% vs baseline", status: "watch" as const },
  { signal: "Sleep quality",       value: "82%",            status: "ok" as const },
  { signal: "Joint soreness",      value: "Moderate",       status: "watch" as const },
  { signal: "Session RPE drift",   value: "+0.4 RPE",       status: "watch" as const },
];

/* ── Biomarker Intelligence ─────────────────────────────────────────────── */
/* Observational log only. No diagnoses, no medical recommendations.        */

export type BiomarkerEntry = {
  marker: string;
  value: string;
  unit: string;
  status: "logged" | "trend-up" | "trend-down" | "stable";
  lastUpdated: string;
};

export type BiomarkerPanel = {
  panel: string;
  category: "hematology" | "metabolic" | "hormonal" | "lipid" | "thyroid" | "inflammation";
  accent: string;
  markers: BiomarkerEntry[];
};

export const BIOMARKER_PANELS: BiomarkerPanel[] = [
  {
    panel: "Complete Blood Count (CBC)",
    category: "hematology",
    accent: "#ef7d55",
    markers: [
      { marker: "RBC",         value: "5.42", unit: "10⁶/µL", status: "stable",     lastUpdated: "Apr 28" },
      { marker: "Hemoglobin",  value: "15.6", unit: "g/dL",   status: "stable",     lastUpdated: "Apr 28" },
      { marker: "Hematocrit",  value: "46.2", unit: "%",       status: "trend-up",   lastUpdated: "Apr 28" },
      { marker: "WBC",         value: "6.4",  unit: "10³/µL", status: "stable",     lastUpdated: "Apr 28" },
      { marker: "Platelets",   value: "242",  unit: "10³/µL", status: "stable",     lastUpdated: "Apr 28" },
    ],
  },
  {
    panel: "Comprehensive Metabolic (CMP)",
    category: "metabolic",
    accent: "#5fb7d5",
    markers: [
      { marker: "Glucose",     value: "92",   unit: "mg/dL", status: "stable",     lastUpdated: "Apr 28" },
      { marker: "BUN",         value: "18",   unit: "mg/dL", status: "stable",     lastUpdated: "Apr 28" },
      { marker: "Creatinine",  value: "1.12", unit: "mg/dL", status: "stable",     lastUpdated: "Apr 28" },
      { marker: "eGFR",        value: ">90",  unit: "mL/min", status: "stable",    lastUpdated: "Apr 28" },
      { marker: "ALT",         value: "28",   unit: "U/L",    status: "stable",     lastUpdated: "Apr 28" },
      { marker: "AST",         value: "24",   unit: "U/L",    status: "stable",     lastUpdated: "Apr 28" },
      { marker: "HbA1c",       value: "5.2",  unit: "%",       status: "stable",     lastUpdated: "Apr 14" },
      { marker: "Insulin",     value: "5.4",  unit: "µIU/mL", status: "trend-down", lastUpdated: "Apr 14" },
    ],
  },
  {
    panel: "Hormonal Panel",
    category: "hormonal",
    accent: "#d5b15f",
    markers: [
      { marker: "Testosterone, Total", value: "742", unit: "ng/dL", status: "trend-up", lastUpdated: "Apr 28" },
      { marker: "Testosterone, Free",  value: "18.4", unit: "pg/mL", status: "trend-up", lastUpdated: "Apr 28" },
      { marker: "Estradiol (E2)",       value: "32",   unit: "pg/mL", status: "stable",   lastUpdated: "Apr 28" },
      { marker: "SHBG",                 value: "28",   unit: "nmol/L", status: "stable",  lastUpdated: "Apr 28" },
      { marker: "LH",                   value: "4.8",  unit: "mIU/mL", status: "stable",  lastUpdated: "Apr 28" },
      { marker: "FSH",                  value: "3.2",  unit: "mIU/mL", status: "stable",  lastUpdated: "Apr 28" },
    ],
  },
  {
    panel: "Lipid Panel",
    category: "lipid",
    accent: "#a78bfa",
    markers: [
      { marker: "Total Cholesterol", value: "182", unit: "mg/dL", status: "stable",     lastUpdated: "Apr 28" },
      { marker: "LDL-C",              value: "102", unit: "mg/dL", status: "trend-down", lastUpdated: "Apr 28" },
      { marker: "HDL-C",              value: "58",  unit: "mg/dL", status: "trend-up",   lastUpdated: "Apr 28" },
      { marker: "Triglycerides",      value: "88",  unit: "mg/dL", status: "stable",     lastUpdated: "Apr 28" },
      { marker: "ApoB",                value: "78",  unit: "mg/dL", status: "stable",     lastUpdated: "Apr 28" },
    ],
  },
  {
    panel: "Thyroid Panel",
    category: "thyroid",
    accent: "#34d399",
    markers: [
      { marker: "TSH",       value: "1.8",  unit: "µIU/mL", status: "stable", lastUpdated: "Mar 22" },
      { marker: "Free T3",   value: "3.4",  unit: "pg/mL",  status: "stable", lastUpdated: "Mar 22" },
      { marker: "Free T4",   value: "1.3",  unit: "ng/dL",  status: "stable", lastUpdated: "Mar 22" },
      { marker: "Reverse T3", value: "16",  unit: "ng/dL",  status: "stable", lastUpdated: "Mar 22" },
    ],
  },
  {
    panel: "Micronutrients & Inflammation",
    category: "inflammation",
    accent: "#6ee7b7",
    markers: [
      { marker: "Ferritin",       value: "112", unit: "ng/mL", status: "stable",     lastUpdated: "Apr 28" },
      { marker: "Vitamin D, 25-OH", value: "54", unit: "ng/mL", status: "trend-up",   lastUpdated: "Apr 28" },
      { marker: "hs-CRP",         value: "0.6", unit: "mg/L",   status: "stable",     lastUpdated: "Apr 28" },
      { marker: "Homocysteine",    value: "8.4", unit: "µmol/L", status: "stable",   lastUpdated: "Apr 28" },
    ],
  },
];

/* ── Performance Intelligence (compound log architecture) ───────────────── */

export type CompoundLogEntry = {
  date: string;
  category: "primary" | "support" | "ancillary";
  observation: string;
  subjective: string;
};

export const COMPOUND_LOG: CompoundLogEntry[] = [
  { date: "May 16", category: "primary",   observation: "Standard administration logged.", subjective: "Energy elevated. Sleep quality 84%." },
  { date: "May 12", category: "support",    observation: "Routine entry — no change.",      subjective: "Mood stable. HRV +3 vs baseline." },
  { date: "May 09", category: "ancillary",  observation: "Standard entry logged.",          subjective: "No subjective changes reported." },
  { date: "May 05", category: "primary",   observation: "Standard administration logged.", subjective: "Recovery score normalized." },
  { date: "May 02", category: "support",    observation: "Routine entry — no change.",      subjective: "Soreness trending down." },
];

export const OBSERVATION_NOTES = [
  { tag: "Recovery",     entry: "Sleep latency reduced — 12 min average this week.", date: "May 18" },
  { tag: "Performance",  entry: "Bar speed velocity trending up at 80% loads.",       date: "May 16" },
  { tag: "Subjective",   entry: "Joint comfort improved post-deload.",                 date: "May 14" },
  { tag: "Recovery",     entry: "HRV variance narrowed — consistent baseline.",        date: "May 12" },
];

/* ── Peak Physique Mode ─────────────────────────────────────────────────── */

export const PEAK_WEEK_TASKS = [
  { day: "T-7", task: "Last full training session", status: "complete" as const },
  { day: "T-6", task: "Sodium tracking baseline",   status: "complete" as const },
  { day: "T-5", task: "Water front-load — log 4L+",  status: "active"   as const },
  { day: "T-4", task: "Carb response observation",   status: "upcoming" as const },
  { day: "T-3", task: "Posing rehearsal — 45 min",   status: "upcoming" as const },
  { day: "T-2", task: "Sodium gradient adjustment",  status: "upcoming" as const },
  { day: "T-1", task: "Final physique check log",    status: "upcoming" as const },
  { day: "T-0", task: "Show / target date",          status: "upcoming" as const },
];

export const PEAK_METRICS = {
  hydration:  { current: 3.8, target: 4.5, unit: "L"  },
  sodium:     { current: 4200, target: 5000, unit: "mg" },
  carbs:      { current: 285, target: 320,   unit: "g"  },
  bodyWeight: { current: 188.4, target: 187.0, unit: "lb" },
};

/* ── AI Performance Strategist ──────────────────────────────────────────── */

export const STRATEGIST_INSIGHTS = [
  {
    horizon: "Today",
    title: "Readiness window is favorable",
    body: "Composite readiness 84 sits 5 points above 7-day average. Upper-heavy session aligns with current HRV and sleep signal.",
    confidence: 87,
    tone: "positive" as const,
  },
  {
    horizon: "This Week",
    title: "Volume capacity trending up",
    body: "Three consecutive sessions logged at planned RPE with no fatigue accumulation flagged. Capacity envelope is widening — current loading is sustainable.",
    confidence: 82,
    tone: "positive" as const,
  },
  {
    horizon: "This Block",
    title: "Posterior chain volume below baseline",
    body: "Observed volume on hip-hinge patterns is 18% below the 12-week mean. Symmetry scoring shows hamstrings trending stable — review with your programming approach.",
    confidence: 73,
    tone: "watch" as const,
  },
  {
    horizon: "Long Horizon",
    title: "Body composition curve is on track",
    body: "Trailing 12-week trend shows lean mass preserved while body fat moved from 12.8% to 10.7%. Pace and direction match your goal-set objective.",
    confidence: 79,
    tone: "positive" as const,
  },
];

export const STRATEGIST_OBSERVATIONS = [
  "Sleep consistency above 80% for 11 of last 14 days.",
  "Training session adherence at 96% vs. plan.",
  "Macro adherence trending 91% — protein on target 12/14 days.",
  "Recovery composite trending +6 vs. previous mesocycle average.",
  "Body weight variance within 1.2% — strong consistency signal.",
];
