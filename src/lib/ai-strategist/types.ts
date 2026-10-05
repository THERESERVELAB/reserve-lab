/* ────────────────────────────────────────────────────────────────────────────
   AI STRATEGIST V1 — TYPES

   The strategist is a deterministic intelligence layer that reads the Reserve
   Lab operating system and converts logged data into one clear direction.
   NOT a chatbot, NOT medical advice. No fake certainty — when data is thin it
   says "data limited". Careful language only.
   ──────────────────────────────────────────────────────────────────────── */

export type MissionStatus =
  | "locked-in"
  | "building-momentum"
  | "on-track"
  | "recovery-limited"
  | "nutrition-limited"
  | "schedule-conflict"
  | "physique-check-in-due"
  | "plateau-watch"
  | "data-limited"
  | "needs-attention";

export type ConfidenceLevel = "high" | "moderate" | "limited";

export type SourceSystem =
  | "Schedule"
  | "Training"
  | "Nutrition"
  | "Recovery"
  | "Physique"
  | "Strategist"
  | "Bloodwork"
  | "Compound"
  | "Women's Performance"
  | "Cycle"
  | "Fertility"
  | "Pregnancy";

export type SignalSeverity = "low" | "moderate" | "high";

export type StrategistSignal = {
  id: string;
  title: string;
  detail: string;
  source: SourceSystem;
  confidence: ConfidenceLevel;
  severity?: SignalSeverity;
};

export type HighestRoiAction = {
  title: string;
  reason: string;
  source: SourceSystem;
  confidence: ConfidenceLevel;
  buttonLabel: string;
  /** DashboardView key to route to, if available. */
  target?: string;
};

export type SystemMatrixStatus =
  | "strong"
  | "on-track"
  | "watch"
  | "needs-input"
  | "data-limited"
  | "log-only"
  | "lifestyle-only"
  | "estimate-only"
  | "locked";

export type SystemSignal = {
  system: SourceSystem;
  status: SystemMatrixStatus;
  note: string;
  target?: string;
  actionLabel?: string;
};

export type BriefingType = "morning" | "midday" | "night";

export type StrategicBrief = {
  type: BriefingType;
  label: string;
  body: string;
  active: boolean;
};

export type StrategicQuestionId =
  | "holding-back"
  | "focus-today"
  | "progressing"
  | "helping-most"
  | "hurting-most"
  | "recovery-impact"
  | "schedule-impact"
  | "protect-tonight"
  | "missing-data"
  | "next-action";

export type StrategicQuestion = {
  id: StrategicQuestionId;
  label: string;
};

export type StrategicAnswer = {
  questionId: StrategicQuestionId;
  answer: string;
  nextAction: string;
  confidence: ConfidenceLevel;
};

export type StrategistConfidence = {
  level: ConfidenceLevel;
  reason: string;
  /** 0–100 coverage of available systems. */
  coverage: number;
};

export type StrategistQuickAction = {
  label: string;
  target: string;
  enabled: boolean;
};

export type StrategistHeroMetric = {
  label: string;
  value: string;
  color: string;
};

export type StrategistBriefing = {
  hasData: boolean;
  missionStatus: MissionStatus;
  missionLabel: string;
  missionColor: string;
  heroBrief: string;
  heroMetrics: StrategistHeroMetric[];
  primaryLimiter: string;
  highestRoiAction: HighestRoiAction;
  helping: StrategistSignal[];
  hurting: StrategistSignal[];
  systemMatrix: SystemSignal[];
  briefs: StrategicBrief[];
  questions: StrategicQuestion[];
  confidence: StrategistConfidence;
  quickActions: StrategistQuickAction[];
};

export const STRATEGIC_QUESTIONS: StrategicQuestion[] = [
  { id: "holding-back", label: "What is holding me back?" },
  { id: "focus-today", label: "What should I focus on today?" },
  { id: "progressing", label: "Am I progressing?" },
  { id: "helping-most", label: "What is helping most?" },
  { id: "hurting-most", label: "What is hurting most?" },
  { id: "recovery-impact", label: "How is recovery affecting results?" },
  { id: "schedule-impact", label: "Is my schedule helping or hurting?" },
  { id: "protect-tonight", label: "What should I protect tonight?" },
  { id: "missing-data", label: "What data is missing?" },
  { id: "next-action", label: "What is my next best action?" },
];
