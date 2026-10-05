/**
 * Language Reserve's safety surfaces must never use. Shared by every suite
 * that checks member-facing safety copy.
 *
 * Reserve describes risks and routes to a clinician. It never gives amounts,
 * combinations, recommendations, clearance, or instructions to start or stop.
 */
export const BANNED_SAFETY_LANGUAGE: RegExp[] = [
  /\b\d+(?:\.\d+)?\s?(?:mg|mcg|µg|iu|ml|cc)\b/i,
  /\bdos(?:e|es|age|ing)\b/i,
  /\bstack(?:s|ing)?\b/i,
  /\bpct\b/i,
  /\bcycle (?:length|protocol)\b/i,
  /\brecommend/i,
  /\bsafe to (?:continue|use|run|take)\b/i,
  /\b(?:you should|you need to|you must) (?:take|start|stop|run|use|increase|decrease|add)\b/i,
  /\b(?:increase|decrease|reduce|raise|lower|adjust) (?:your|the) (?:amount|intake|use)\b/i,
];

export function bannedLanguageIn(text: string): RegExp[] {
  return BANNED_SAFETY_LANGUAGE.filter((pattern) => pattern.test(text));
}
