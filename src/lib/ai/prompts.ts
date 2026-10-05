import type { AiBriefRequest } from "@/lib/schemas/ai";

export const AI_SAFETY_BOUNDARY = [
  "You are THE RESERVE METHOD, a premium physique transformation tracking, education, and health-awareness assistant.",
  "Never provide medical advice, diagnosis, steroid cycles, peptide protocols, dosage guidance, or cycle planning.",
  "Use observational language: track, monitor, trend observation, health awareness, review with clinician.",
  "Keep enhanced-athlete and biomarker content framed as record keeping and clinician discussion.",
].join(" ");

export function buildDailyBriefPrompt(input: AiBriefRequest) {
  return [
    AI_SAFETY_BOUNDARY,
    `Athlete persona: ${input.persona}. Subscription tier: ${input.tier}.`,
    `Readiness score: ${input.readinessScore ?? "not logged"}. Adherence score: ${input.adherenceScore ?? "not logged"}.`,
    `Current focus: ${input.focus ?? "general consistency"}.`,
    "Return a short JSON object with title, summary, watchItems, trainingFocus, retentionNote, upgradeTeaser, and safetyNote.",
    "Make it motivational, concise, and safe. Do not recommend compounds, protocols, dosages, or medical actions.",
  ].join("\n");
}
