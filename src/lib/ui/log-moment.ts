import type { AmbientMotion } from "@/lib/ui/ambient-motion";

/* ════════════════════════════════════════════════════════════════════════
   LOG MOMENT — how the system answers a member's own log, anywhere.

   One vocabulary for every room. A log becomes a moment: a lead ("Sleep
   logged"), a detail line of plain facts ("7.4 h · 5 nights in a row"), and
   at most one milestone taken from the member's own record. The shell's one
   host (src/components/ui/reserve/log-moment) plays it.

   Two tiers:
     full   the daily anchor logs: the row presses, light travels to the
            readout, the landing booms once, the room brightens, the numbers
            count, the words hold on their glass plate
     mark   the frequent small logs: the row presses lightly, the check draws
            itself, a light sweeps the row, the words show; no flow, no boom

   Words are calm, specific and neutral. No praise, no judgement of a body
   measurement's direction, no health claim, no promise. A compound or
   supplement mark is only ever "Logged": no milestone, no streak.

   Pure: no React, no store, no DOM.
   ════════════════════════════════════════════════════════════════════════ */

export type LogMomentKind =
  | "meal"
  | "sleep"
  | "water"
  | "check-in"
  | "mobility"
  | "weight"
  | "measurement"
  | "photo"
  | "training"
  | "journal"
  | "schedule"
  | "compound"
  | "activity";

export type LogMomentTier = "full" | "mark";
export type LogMomentTone = "log" | "clear";

/** A number in the detail line that counts from `from` to `value` when the light lands. */
export type LogMomentFigure = { value: number; from: number; decimals: number };
export type LogMomentDetailPart = string | LogMomentFigure;

export type LogMilestone = {
  /** Stable key, e.g. "day-fueled", "streak-7". Read by tests and data-milestone. */
  key: string;
  /** Short headline: "Hydration target reached." */
  headline: string;
  /** How much harder the landing hits: 1.4 for a milestone, up to 1.7 for the day's biggest. */
  intensity: number;
};

export type LogMomentContent = {
  kind: LogMomentKind;
  tier: LogMomentTier;
  tone: LogMomentTone;
  /** "Sleep logged" */
  lead: string;
  /** "7.4 h · 5 nights in a row" as parts, figures counting on arrival. */
  detail: LogMomentDetailPart[];
  milestone: LogMilestone | null;
};

export const isFigure = (part: LogMomentDetailPart): part is LogMomentFigure => typeof part !== "string";

/** A figure formatted as its final value. */
export function formatFigure(figure: LogMomentFigure): string {
  return figure.value.toFixed(figure.decimals);
}

/** The detail line as the member reads it at rest. */
export function detailText(content: Pick<LogMomentContent, "detail">): string {
  return content.detail.map((part) => (isFigure(part) ? formatFigure(part) : part)).join("");
}

/** What the polite live region says: "Sleep logged. 7.4 h. 5 nights in a row." */
export function announcementText(content: Pick<LogMomentContent, "lead" | "detail" | "milestone">): string {
  const detail = detailText(content);
  return `${content.lead}.${detail ? ` ${detail}.` : ""}${content.milestone ? ` ${content.milestone.headline}` : ""}`;
}

/** A plain figure part. */
export const figure = (value: number, decimals = 0, from = value): LogMomentFigure => ({ value, from, decimals });

/** Join detail parts with the plate's " · " separator, dropping empty ones. */
export function joinDetail(...groups: Array<LogMomentDetailPart[] | string | null | undefined | false>): LogMomentDetailPart[] {
  const out: LogMomentDetailPart[] = [];
  for (const group of groups) {
    if (!group) continue;
    const parts = typeof group === "string" ? [group] : group;
    if (parts.length === 0) continue;
    if (out.length > 0) out.push(" · ");
    out.push(...parts);
  }
  return out;
}

/* ─── Choreography ─────────────────────────────────────────────────────── */

export type LogMomentPlan = {
  /** Anything drawn at all (the words included). */
  visible: boolean;
  /** Row press, light sweep, the check drawing itself on the row's control. */
  impact: boolean;
  /** Light travelling from the row to the readout. */
  flow: boolean;
  /** Flash, shockwave, sparks, bloom and the room brightening. */
  boom: boolean;
  /** Figures count in time with the arrival. */
  countUp: boolean;
  /** The words animate in (otherwise they are simply there). */
  animateWords: boolean;
  /** navigator.vibrate pattern at impact, and at arrival. */
  haptics: { impact: number[]; arrival: number[] } | null;
  /** When the flow lands, from the moment firing. */
  arrivalMs: number;
  /** How long the words stay on screen. */
  holdMs: number;
  /** Size of the boom and weight of the press: 1 for a log, larger for a milestone. */
  intensity: number;
};

export const LOG_MOMENT_ARRIVAL_MS = 720;
export const MARK_MOMENT_ARRIVAL_MS = 120;

/**
 * How much of the moment runs under each motion setting.
 *   full     everything the tier allows; a milestone lands harder and holds longer
 *   reduced  no motion: the words and a still check, the numbers already true
 *   static   the same (paused motion or a hidden tab): nothing animates, nothing
 *            is drawn, nothing vibrates
 * Every mode announces the log.
 */
export function planLogMoment(moment: Pick<LogMomentContent, "tier" | "tone" | "milestone">, motion: AmbientMotion): LogMomentPlan {
  const log = moment.tone === "log";
  const milestone = log && moment.milestone !== null;
  const mark = moment.tier === "mark";
  const holdMs = milestone ? 3400 : !log ? 2200 : mark ? 2200 : 2600;
  if (motion === "reduced" || motion === "static") {
    return { visible: true, impact: false, flow: false, boom: false, countUp: false, animateWords: false, haptics: null, arrivalMs: 0, holdMs, intensity: 0 };
  }
  if (mark || !log) {
    return {
      visible: true,
      impact: true,
      flow: false,
      boom: false,
      countUp: true,
      animateWords: true,
      haptics: { impact: [8], arrival: [] },
      arrivalMs: MARK_MOMENT_ARRIVAL_MS,
      holdMs,
      intensity: milestone ? (moment.milestone?.intensity ?? 1) : 1,
    };
  }
  return {
    visible: true,
    impact: true,
    flow: true,
    boom: true,
    countUp: true,
    animateWords: true,
    haptics: { impact: [10], arrival: milestone ? [18, 60, 26] : [16] },
    arrivalMs: LOG_MOMENT_ARRIVAL_MS,
    holdMs,
    intensity: milestone ? (moment.milestone?.intensity ?? 1.4) : 1,
  };
}

/* ─── Words the moment may never say ───────────────────────────────────── */

/**
 * Praise, judgement and health language a log moment must never carry. The
 * resolvers' tests run every line they can produce through this list.
 */
export const LOG_MOMENT_BANNED_WORDS: readonly RegExp[] = [
  /!/,
  /\bsafe(ly|ty)?\b/i,
  /\bhealth(y|ier)?\b/i,
  /\bgreat\b/i,
  /\bnice\b/i,
  /\bawesome\b/i,
  /\bamazing\b/i,
  /\bwell done\b/i,
  /\bgood job\b/i,
  /\bproud\b/i,
  /\bcrush(ed|ing)?\b/i,
  /\bkill(ed|ing)? it\b/i,
  /\bimprov(e|ed|ing|ement)\b/i,
  /\bbetter\b/i,
  /\bworse\b/i,
  /\bprogress\b/i,
  /\bgain(ed)?\b/i,
  /\blost\b/i,
  /\bloss\b/i,
  /\bdown\b/i,
  /\bup\b/i,
  /\bguarantee/i,
  /\bresults?\b/i,
  /\bcured?\b/i,
  /\bprotect/i,
  /\brecommend/i,
  /\bdose\b/i,
];

/** The first banned pattern a line trips, or null. */
export function bannedWordIn(text: string): RegExp | null {
  return LOG_MOMENT_BANNED_WORDS.find((re) => re.test(text)) ?? null;
}

/* ─── Spring ───────────────────────────────────────────────────────────── */

/**
 * A damped spring sampled at a fixed frame rate: position from `from` toward
 * `to`, starting at rest. Used to write Web Animations keyframes so a press
 * settles with real spring physics on the compositor, with no JS frame loop.
 */
export function springSamples({
  from,
  to,
  stiffness = 260,
  damping = 16,
  mass = 1,
  fps = 60,
  maxMs = 1200,
  velocity = 0,
}: {
  from: number;
  to: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  fps?: number;
  maxMs?: number;
  velocity?: number;
}): number[] {
  const dt = 1 / fps;
  let x = from - to;
  let v = velocity;
  const out: number[] = [from];
  const steps = Math.ceil((maxMs / 1000) * fps);
  for (let i = 0; i < steps; i += 1) {
    const a = (-stiffness * x - damping * v) / mass;
    v += a * dt;
    x += v * dt;
    out.push(to + x);
    if (Math.abs(x) < 0.001 && Math.abs(v) < 0.01) break;
  }
  out[out.length - 1] = to;
  return out;
}
