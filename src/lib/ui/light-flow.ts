import type { Daypart } from "@/lib/brand/asset-manifest";
import { RESERVE } from "@/lib/design/tokens";
import type { AmbientMotion } from "@/lib/ui/ambient-motion";
import { LOG_MOMENT_ARRIVAL_MS } from "@/lib/ui/log-moment";

/* ════════════════════════════════════════════════════════════════════════
   LIGHT FLOW — the room's own light, running in its architecture.

   Reserve's rooms are dark. This is the light that moves through them: a
   thin luminous traveller with a bright head and a short falling tail runs
   one seam — the hero's own edge, the right frame, the horizon rail — and
   leaves the seam dark behind it. Behind that sits a far horizon: a still
   perspective grid on dark ground that breathes once every twenty seconds.

   The read is geometry and darkness. Not fog, not neon, not a lit outline
   around every card. At most one seam per room carries light at a time on a
   phone, three on a wide desktop, and for most of any minute the room is
   simply still.

   HOW IT IS BUILT (Design Bible §08 rule 1: "CSS-only for ambient motion …
   no JS animation loops for decoration"). Every path here is geometry,
   resolved when the viewport or the hero changes and at no other time. The
   movement itself is one CSS keyframe on `stroke-dashoffset`, exactly as the
   shipped horizon flow (§08 rule 8) already runs light along its lanes.
   There is no frame loop, no canvas and no per-frame React state anywhere in
   this feature.

   MOTION IS A READOUT (§08 rule 5). The layer is dimmer when the member's
   readiness is lower, quieter in the rooms the Bible lights lowest, and it
   answers a log the member just made. It never moves only to decorate.

   WHAT SILENCES IT, in order of precedence:

     paused / hidden   the member's ambient pause (WCAG 2.2.2), or a hidden tab
     reduced motion    the operating system asks for less movement
     live session      sets are being logged; nothing in the room may travel
     night             the member's own room is dark; the light rests
     settling          a screen has just arrived and must read as STILL
     log moment        a full log moment is running its own light to its own
                       readout; the room goes quiet rather than speaking over it

   The first five draw nothing at all — no seam, no horizon, no element. The
   last keeps the horizon and stops every traveller.

   Pure: no React, no DOM, no store.
   ════════════════════════════════════════════════════════════════════════ */

/* ─── Time ────────────────────────────────────────────────────────────────
   Ambient motion belongs to the Bible's atmosphere band: nothing loops
   faster than 9s, nothing at all is faster than 1.6s, and the cinematic
   token caps an ambient period at 20s (RESERVE_MOTION.cinematic). */

/** A screen must read as still when it settles: nothing is drawn before this. */
export const LIGHT_FLOW_SETTLE_MS = 1600;
/** The layer's fade-in once the screen has settled — felt, never announced (§09: ≥1s). */
export const LIGHT_FLOW_FADE_MS = 1400;
/** And the first pass waits longer still, so arrival is never an event. */
export const LIGHT_FLOW_FIRST_PASS_MS = 3200;
/** One pass along a seam. Inside the band, and slower than any interface motion. */
export const LIGHT_FLOW_TRAVEL_MS = 2400;
/** The horizon's breath: one cycle, far outside the eye's attention. */
export const LIGHT_FLOW_BREATH_MS = 20000;
/** A surge answers the member's tap almost at once… */
export const LIGHT_FLOW_SURGE_LEAD_MS = 60;
/** …or waits out the log moment's own landing when the moment owns the light. */
export const LIGHT_FLOW_SURGE_AFTER_MOMENT_MS = 260;
/** A surge is an answer, not weather: it travels faster than an ambient pass. */
export const LIGHT_FLOW_SURGE_MS = 900;
/** How long a surge element stays mounted before it is taken down. */
export const LIGHT_FLOW_SURGE_CLEAR_MS = LIGHT_FLOW_SURGE_MS + 400;

/** Shipped easings (log-moment-effects.ts), reused so the house reads as one hand. */
export const LIGHT_FLOW_EASING = {
  /** An ambient pass: enters fast, settles out. */
  pass: "cubic-bezier(0.45, 0, 0.25, 1)",
  /** A surge: the log moment's own out-ease. */
  surge: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

/* ─── Palette ─────────────────────────────────────────────────────────────
   The Reserve palette is closed (color.md). The body of a traveller is the
   room's own shipped accent; the core of a head is ivory and nothing else;
   cold seams are the room's steel or slate. No hue is introduced here. */

export type LightFlowPalette = {
  /** The warm lead — a room's own accent. */
  warm: string;
  /** Cold and secondary seams. */
  cold: string;
  /** The hot core of a head. Ivory only. */
  core: string;
};

const CORE = RESERVE.ivory;

/**
 * Per-room palette, keyed by the ambient layer's own room key, taken from the
 * Bible §09 destination table. A room cannot introduce a hue it does not
 * already own: Recovery leads violet, the vault and the lab lead steel,
 * Nutrition leads amber over green, everything else leads gold.
 */
export const LIGHT_FLOW_PALETTE: Record<string, LightFlowPalette> = {
  apex: { warm: RESERVE.gold, cold: RESERVE.steel, core: CORE },
  training: { warm: RESERVE.gold, cold: RESERVE.steel, core: CORE },
  nutrition: { warm: RESERVE.amber, cold: RESERVE.green, core: CORE },
  recovery: { warm: RESERVE.violet, cold: RESERVE.steel, core: CORE },
  schedule: { warm: RESERVE.gold, cold: RESERVE.steel, core: CORE },
  protocol: { warm: RESERVE.gold, cold: RESERVE.slate, core: CORE },
  studio: { warm: RESERVE.gold, cold: RESERVE.slate, core: CORE },
  community: { warm: RESERVE.gold, cold: RESERVE.slate, core: CORE },
  vault: { warm: RESERVE.steel, cold: RESERVE.slate, core: CORE },
  clinical: { warm: RESERVE.steel, cold: RESERVE.slate, core: CORE },
  instrument: { warm: RESERVE.slate, cold: RESERVE.steel, core: CORE },
  strategist: { warm: RESERVE.steel, cold: RESERVE.violet, core: CORE },
  violet: { warm: RESERVE.violet, cold: RESERVE.steel, core: CORE },
  neutral: { warm: RESERVE.gold, cold: RESERVE.slate, core: CORE },
};

export function paletteForRoom(room: string): LightFlowPalette {
  return LIGHT_FLOW_PALETTE[room] ?? LIGHT_FLOW_PALETTE.neutral;
}

/** `rgba()` from a `#rrggbb` token — an SVG stroke needs channels, not a hex pair. */
export function rgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  const n = Number.parseInt(full, 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(a * 1000) / 1000})`;
}

/* ─── The room's light budget (Design Bible §09) ──────────────────────────
   The Bible gives every destination a different amount of light. Recovery is
   the lowest light in the product; Bloodwork is minimal and precise; Schedule
   is gentle; Training may show the pulse band. A single uniform flow across
   every room would contradict that table, so each room gets its own budget:
   how many seams may carry light, how bright any of it may be, and how long
   a seam rests between passes. */

export type RoomLightBudget = {
  /** Seams that may carry light in this room. */
  seams: number;
  /** Multiplier on every alpha the layer draws. */
  alpha: number;
  /** Rest between passes on one seam, in milliseconds. Atmosphere band. */
  restMs: number;
};

export const ROOM_LIGHT_BUDGET: Record<string, RoomLightBudget> = {
  /* Mission control: the most light in the product. */
  apex: { seams: 3, alpha: 1, restMs: 12000 },
  /* Armed, decisive — but never while a set is being logged (gated above). */
  training: { seams: 2, alpha: 0.9, restMs: 13000 },
  /* A warm hearth with gentle motion. */
  nutrition: { seams: 2, alpha: 0.78, restMs: 14000 },
  /* The lowest light in the product: one seam, barely there, slowest rest. */
  recovery: { seams: 1, alpha: 0.45, restMs: 16500 },
  /* The planning desk: gentle. */
  schedule: { seams: 1, alpha: 0.62, restMs: 15500 },
  /* Minimal and precise. */
  clinical: { seams: 1, alpha: 0.52, restMs: 15500 },
  vault: { seams: 1, alpha: 0.52, restMs: 15500 },
  instrument: { seams: 1, alpha: 0.52, restMs: 15500 },
  protocol: { seams: 2, alpha: 0.68, restMs: 14000 },
  strategist: { seams: 2, alpha: 0.7, restMs: 13500 },
  studio: { seams: 1, alpha: 0.58, restMs: 15000 },
  /* Subtle. */
  community: { seams: 1, alpha: 0.52, restMs: 15500 },
  violet: { seams: 1, alpha: 0.52, restMs: 15500 },
  neutral: { seams: 1, alpha: 0.62, restMs: 14500 },
};

export function budgetForRoom(room: string): RoomLightBudget {
  return ROOM_LIGHT_BUDGET[room] ?? ROOM_LIGHT_BUDGET.neutral;
}

/* ─── The gate ───────────────────────────────────────────────────────────── */

export type LightFlowReason =
  | "live"
  | "paused"
  | "reduced"
  | "live-session"
  | "night"
  | "settling"
  | "log-moment";

export type LightFlowInput = {
  /** The one ambient motion gate (`resolveAmbientMotion`). */
  motion: AmbientMotion;
  /** The room key the ambient layer is painting. */
  room: string;
  /** The member's own daypart, or null before the client knows the clock. */
  daypart: Daypart | null;
  /** A live training session is running anywhere in the app. */
  liveSession: boolean;
  /** A full log moment is playing its own light. Its beat, not the room's. */
  logMomentBoom: boolean;
  /** The screen has been on long enough to have settled. */
  settled: boolean;
  viewportWidth: number;
  /** Readiness energy (§08 rule 5). The room's light is as bright as the member is ready. */
  energy: number;
  /** `navigator.hardwareConcurrency`, or 0 when the browser will not say. */
  cores: number;
  /** The connection asks for less data. */
  saveData: boolean;
};

export type LightFlowPlan = {
  /** Anything at all is drawn. The layer mounts only for this. */
  active: boolean;
  /** How many seams may carry light. 0 while a log moment holds the beat. */
  seams: number;
  /** The far horizon is drawn. */
  horizon: boolean;
  /** The horizon breathes (a still grid on the lowest-powered devices). */
  breath: boolean;
  /** Multiplier on every alpha: the room's budget scaled by readiness. */
  alpha: number;
  /** Rest between passes on a seam. */
  restMs: number;
  /** Why the layer is in this state. Published as `data-light-flow`. */
  reason: LightFlowReason;
};

const DARK: Omit<LightFlowPlan, "reason"> = {
  active: false,
  seams: 0,
  horizon: false,
  breath: false,
  alpha: 0,
  restMs: 0,
};

/** A low-end device: four cores or fewer, or a connection asking for less. */
export function isLowEnd(input: Pick<LightFlowInput, "cores" | "saveData">): boolean {
  return input.saveData || (input.cores > 0 && input.cores <= 4);
}

/**
 * How many seams the DEVICE will carry, before the room's own budget narrows
 * it further. A phone carries one, a laptop two, a wide desktop three — and a
 * low-end device carries one whatever its width.
 */
export function deviceSeamCap(input: Pick<LightFlowInput, "viewportWidth" | "cores" | "saveData">): number {
  if (isLowEnd(input)) return 1;
  if (input.viewportWidth < 640) return 1;
  if (input.viewportWidth < 1280) return 2;
  return 3;
}

/** The one answer to "may light move in this room right now?" */
export function resolveLightFlow(input: LightFlowInput): LightFlowPlan {
  if (input.motion === "static") return { ...DARK, reason: "paused" };
  if (input.motion === "reduced") return { ...DARK, reason: "reduced" };
  if (input.liveSession) return { ...DARK, reason: "live-session" };
  if (input.daypart === "night") return { ...DARK, reason: "night" };
  if (!input.settled) return { ...DARK, reason: "settling" };

  const lowEnd = isLowEnd(input);
  const budget = budgetForRoom(input.room);
  const energy = Number.isFinite(input.energy) ? Math.max(0, Math.min(1, input.energy)) : 1;
  const base = {
    active: true,
    horizon: true,
    breath: !lowEnd,
    /* The light is as bright as the member is ready, floored so a low
       readiness dims the room rather than emptying it. */
    alpha: Math.round(budget.alpha * (0.6 + 0.4 * energy) * 1000) / 1000,
    restMs: budget.restMs,
  };
  /* A log moment's own light is already travelling to its own readout. The
     room goes quiet underneath it rather than running a second light across
     the same beat: the horizon stays, every seam goes dark. */
  if (input.logMomentBoom) return { ...base, seams: 0, reason: "log-moment" };

  return { ...base, seams: Math.min(budget.seams, deviceSeamCap(input)), reason: "live" };
}

/* ─── Seams ───────────────────────────────────────────────────────────────
   The paths light runs are the room's ARCHITECTURE — the hero's own edge,
   the right frame, the horizon rail — never the outline of every card, which
   would flatten hierarchy (anti-patterns.md) and light the room everywhere.

   Geometry is viewport-derived, with one optional measured rectangle for the
   hero. It is resolved when the viewport or that rectangle changes, and at no
   other time. */

export type LightPoint = { x: number; y: number };
export type LightSeamKind = "hero" | "frame" | "base";
export type LightSeamTone = "warm" | "cold";

export type LightSeam = {
  id: LightSeamKind;
  tone: LightSeamTone;
  points: LightPoint[];
  /** Path length in pixels — the dash maths needs it and never measures the DOM for it. */
  length: number;
  /** SVG `d`. */
  d: string;
};

export type LightRect = { x: number; y: number; width: number; height: number };

export function distance(a: LightPoint, b: LightPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Total length of a polyline. */
export function pathLength(points: readonly LightPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1], points[i]);
  return total;
}

/** The point `t` (0–1) of the way along a polyline. */
export function pointAt(points: readonly LightPoint[], t: number): LightPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };
  const target = Math.max(0, Math.min(1, t)) * pathLength(points);
  let walked = 0;
  for (let i = 1; i < points.length; i += 1) {
    const segment = distance(points[i - 1], points[i]);
    if (segment === 0) continue;
    if (walked + segment >= target) {
      const local = segment === 0 ? 0 : (target - walked) / segment;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * local,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * local,
      };
    }
    walked += segment;
  }
  return { ...points[points.length - 1] };
}

/** A polyline as an SVG `d`, rounded to a tenth of a pixel. */
export function pathD(points: readonly LightPoint[]): string {
  if (points.length === 0) return "";
  const n = (v: number) => Math.round(v * 10) / 10;
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${n(p.x)} ${n(p.y)}`).join(" ");
}

/**
 * Corners the light turns rather than snaps. Each interior vertex becomes a
 * short arc at `radius`, which is what makes a traveller read as light
 * running IN a seam instead of a dot jumping between two edges.
 */
export function roundPolyline(points: readonly LightPoint[], radius = 18, segments = 4): LightPoint[] {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  const out: LightPoint[] = [{ ...points[0] }];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const here = points[i];
    const next = points[i + 1];
    const inLen = distance(prev, here);
    const outLen = distance(here, next);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (!(r > 0.5)) {
      out.push({ ...here });
      continue;
    }
    const start = { x: here.x + ((prev.x - here.x) / inLen) * r, y: here.y + ((prev.y - here.y) / inLen) * r };
    const end = { x: here.x + ((next.x - here.x) / outLen) * r, y: here.y + ((next.y - here.y) / outLen) * r };
    out.push(start);
    for (let s = 1; s < segments; s += 1) {
      const t = s / segments;
      const inv = 1 - t;
      /* One quadratic Bézier through the vertex: the corner's own curve. */
      out.push({
        x: inv * inv * start.x + 2 * inv * t * here.x + t * t * end.x,
        y: inv * inv * start.y + 2 * inv * t * here.y + t * t * end.y,
      });
    }
    out.push(end);
  }
  out.push({ ...points[points.length - 1] });
  return out;
}

function seam(id: LightSeamKind, tone: LightSeamTone, points: LightPoint[]): LightSeam {
  return { id, tone, points, length: Math.round(pathLength(points)), d: pathD(points) };
}

export type SeamInput = {
  width: number;
  height: number;
  phone: boolean;
  /** The measured hero block in viewport pixels, or null. */
  hero: LightRect | null;
};

/** Where the far horizon sits in the viewport. */
export function horizonY(input: Pick<SeamInput, "height" | "phone">): number {
  return Math.round(input.height * (input.phone ? 0.46 : 0.52));
}

/**
 * The seams of a screen, in the order light takes them: the hero first.
 *
 * Two or three, never more. A screen whose hero has not been measured still
 * has the frame and the rail, so a room is never featureless — but it never
 * guesses a hero edge that content might not sit on.
 */
export function seamPaths(input: SeamInput): LightSeam[] {
  const { width, height, phone, hero } = input;
  if (!(width > 0) || !(height > 0)) return [];
  /* The frame runs at the very edge of the screen, outside the page's own
     surfaces: a light channel in the wall, not a line drawn on a panel. */
  const gutter = phone ? 10 : 8;
  const seams: LightSeam[] = [];

  if (hero && hero.width > 40 && hero.height > 20 && hero.y < height) {
    /* Down the hero's own left edge, round the corner, out along its foot:
       the light arrives at the statement and leaves along the line under it. */
    const top = Math.max(0, hero.y + Math.min(24, hero.height * 0.25));
    const bottom = Math.min(height - 1, hero.y + hero.height);
    if (bottom - top > 20) {
      seams.push(
        seam(
          "hero",
          "warm",
          roundPolyline([
            { x: hero.x, y: top },
            { x: hero.x, y: bottom },
            { x: Math.min(width - gutter, hero.x + hero.width), y: bottom },
          ]),
        ),
      );
    }
  }

  /* The frame: one vertical run down the right edge of the screen, clear of
     the rail on desktop and of the thumb on a phone. */
  seams.push(
    seam("frame", "cold", [
      { x: width - gutter, y: Math.round(height * 0.16) },
      { x: width - gutter, y: Math.round(height * 0.84) },
    ]),
  );

  /* The horizon rail: the one seam that is also a drawn line. */
  const y = horizonY(input);
  seams.push(
    seam("base", "cold", [
      { x: 0, y },
      { x: width, y },
    ]),
  );

  return seams;
}

/** The seams that actually carry light, after the plan's own cap. */
export function litSeams(seams: readonly LightSeam[], plan: Pick<LightFlowPlan, "seams">): LightSeam[] {
  return seams.slice(0, Math.max(0, plan.seams));
}

/* ─── The pass ────────────────────────────────────────────────────────────
   A traveller is a dash on a seam: `stroke-dasharray: head, length` with an
   animated `stroke-dashoffset`. Its head runs the path once and the seam is
   dark behind it. Stacking three strokes whose dashes share one leading edge
   and grow backwards gives the falling tail without a single extra frame of
   JavaScript. */

export type PassStrokeRole = "bloom" | "core" | "body" | "tail";

export type PassStroke = {
  role: PassStrokeRole;
  /** Dash length in pixels. */
  dash: number;
  /** Stroke alpha before the plan's own multiplier. */
  alpha: number;
  /** Stroke width. */
  width: number;
  /** `stroke-dashoffset` at the start of the pass… */
  from: number;
  /** …and at the end of it. */
  to: number;
};

/* The head's length, and how far each layer falls behind it.

   The head is a fraction of its own seam, floored and capped: a short seam
   would otherwise be lit end to end by its own tail, which is the one thing a
   traveller must never do. */
export const PASS_HEAD = { fraction: 0.06, min: 26, max: 90 } as const;

export function passHeadPx(length: number): number {
  const longest = Math.max(...PASS_STROKES.map((stroke) => stroke.scale));
  /* The whole traveller — bloom, tails and all — stays under a quarter of its
     own seam, whatever the floor would otherwise ask for. */
  const share = (length * PASS_MAX_SEAM_SHARE) / longest;
  /* Floored, not rounded: rounding up can push the longest tail a hair
     past the share it is capped by. */
  return Math.floor(Math.min(Math.max(PASS_HEAD.min, Math.min(PASS_HEAD.max, length * PASS_HEAD.fraction)), share));
}

/**
 * The strokes of one traveller, in paint order.
 *
 * A wide, very faint bloom carries the light OFF the hairline so the head
 * reads as a lamp rather than a tick; two tail layers and a body fall away
 * behind it; the ivory core is the lamp itself and is painted last, so
 * nothing is ever drawn over the head. Only the core is ivory — everything
 * else is the room's own accent (color.md).
 */
export const PASS_STROKES: ReadonlyArray<{ role: PassStrokeRole; scale: number; alpha: number; width: number }> = [
  { role: "bloom", scale: 1.5, alpha: 0.09, width: 9 },
  { role: "tail", scale: 3.6, alpha: 0.09, width: 1.1 },
  { role: "tail", scale: 2.1, alpha: 0.2, width: 1.4 },
  { role: "body", scale: 1.35, alpha: 0.45, width: 1.8 },
  { role: "core", scale: 1, alpha: 0.95, width: 2.2 },
];

/** How much of a seam the whole traveller may ever cover. */
export const PASS_MAX_SEAM_SHARE = 0.25;

/**
 * One pass along a seam of `length` pixels.
 *
 * Each dash's LEADING edge sits at `dash - offset`, so giving every stroke the
 * same travel distance and starting it at its own dash length keeps all the
 * heads exactly together while the tails trail by their own lengths.
 */
export function passStrokes(length: number, head = passHeadPx(length)): PassStroke[] {
  const travel = length + head;
  return PASS_STROKES.map(({ role, scale, alpha, width }) => {
    const dash = Math.round(head * scale);
    return { role, dash, alpha, width, from: dash, to: dash - travel };
  });
}

/**
 * When each seam starts its pass, so two seams never light together.
 *
 * The first waits out the screen's own settle; the rest are spread across the
 * room's rest interval. Deterministic — a test can prove the stagger rather
 * than watch for it.
 */
export function passDelayMs(index: number, restMs: number): number {
  return LIGHT_FLOW_FIRST_PASS_MS + Math.round((index * restMs) / PASS_STAGGER_DIVISOR);
}

/** Seams are spread over a third of the rest interval each. */
export const PASS_STAGGER_DIVISOR = 3;

/**
 * The share of a seam's cycle spent travelling. A CSS keyframe selector
 * cannot be a custom property, so the TRAVEL is the fixed share and the
 * CYCLE is what varies per room: a room the Bible lights lower rests longer
 * AND moves its light more slowly, which is the same instruction twice.
 */
export const PASS_TRAVEL_PERCENT = 16;

/** The full cycle of one seam: its pass, then its rest. */
export function passCycleMs(restMs: number): number {
  return Math.round(restMs / (1 - PASS_TRAVEL_PERCENT / 100));
}

/* ─── The surge ───────────────────────────────────────────────────────────
   A member logs something. The room answers ONCE — never over the top of the
   log moment's own choreography, which already runs light from the row to the
   readout for the daily anchors. */

export type SurgeInput = {
  plan: LightFlowPlan;
  /**
   * The staged log moment will run its own light from the row to the readout
   * (`planLogMoment(...).flow`). When it does, the moment owns that beat.
   */
  momentFlow: boolean;
  /** The moment's own arrival, when it has one. */
  momentArrivalMs?: number;
};

export type SurgeDecision = {
  /** A traveller fires along the surge path. */
  traveller: boolean;
  /** The hero seam brightens once. */
  heroBrighten: boolean;
  /** How long after the log the answer starts. */
  delayMs: number;
};

export const NO_SURGE: SurgeDecision = { traveller: false, heroBrighten: false, delayMs: 0 };

/**
 * One log, one answer.
 *
 * When the log moment runs its own light (a full-tier daily anchor), this
 * layer fires NO traveller: the hero seam brightens once, after the moment has
 * landed, so the two read as one beat instead of two lights crossing. For a
 * mark-tier log — or a room with no moment at all — the layer's own traveller
 * IS the answer, and it leaves at once.
 *
 * Nothing at all is drawn when the layer is dark, so a log at night, in a live
 * session, under reduced motion or while paused is acknowledged by the moment's
 * own words and by nothing else.
 */
export function resolveSurge(input: SurgeInput): SurgeDecision {
  if (!input.plan.active) return NO_SURGE;
  if (input.momentFlow) {
    const arrival = input.momentArrivalMs ?? LOG_MOMENT_ARRIVAL_MS;
    return { traveller: false, heroBrighten: true, delayMs: arrival + LIGHT_FLOW_SURGE_AFTER_MOMENT_MS };
  }
  return { traveller: true, heroBrighten: true, delayMs: LIGHT_FLOW_SURGE_LEAD_MS };
}

/** The rail a surge climbs into: the hero seam's own horizontal run. */
export type SurgeRail = { y: number; x0: number; x1: number };

/** A surge always travels at least this much of the rail, so the answer is seen. */
export const SURGE_MIN_RAIL_PX = 160;

/**
 * The path a surge runs: out of the member's own press, up into the room's
 * hero rail, along it, and down onto the readout it lands on.
 *
 * It travels the architecture rather than cutting across the screen, for the
 * same reason the ambient passes do: a straight line between two points
 * inside two panels is a line nobody sees, and light that ignores the room it
 * is in reads as an overlay. Where the press and the readout are nearly above
 * one another, the entry point is pushed along the rail so there is always a
 * stretch of rail to travel. Both endpoints are measured ONCE, at the log.
 *
 * With no rail on screen the surge takes one turn instead. With no readout,
 * or one right under the member's thumb, there is no path at all and the hero
 * seam simply brightens.
 */
export function surgePath(from: LightPoint | null, to: LightPoint | null, rail: SurgeRail | null = null): LightSeam | null {
  if (!from || !to) return null;
  if (distance(from, to) < 24) return null;
  const clamp = (value: number) => Math.max(rail!.x0, Math.min(rail!.x1, value));
  const usable = rail !== null && rail.x1 - rail.x0 > 80 && Math.abs(from.y - rail.y) > 24 && Math.abs(to.y - rail.y) > 24;
  if (!usable) {
    /* One turn, taken on the room's own axes: across, then in. */
    return seam("hero", "warm", roundPolyline([from, { x: to.x, y: from.y }, to], 24, 5));
  }
  let entry = clamp(from.x);
  if (Math.abs(entry - to.x) < SURGE_MIN_RAIL_PX) {
    const away = entry >= to.x ? 1 : -1;
    entry = clamp(to.x + away * SURGE_MIN_RAIL_PX);
    /* The rail may not reach that far on that side; take the other one. */
    if (Math.abs(entry - to.x) < SURGE_MIN_RAIL_PX) entry = clamp(to.x - away * SURGE_MIN_RAIL_PX);
  }
  return seam(
    "hero",
    "warm",
    roundPolyline([from, { x: entry, y: rail!.y }, { x: to.x, y: rail!.y }, to], 24, 5),
  );
}

/* ─── The far horizon ─────────────────────────────────────────────────────
   A perspective grid on dark ground: the Tron read comes from geometry and
   darkness, never from fog. It is pure geometry, resolved once per size, and
   its only life is a CSS opacity breath on one group. */

export type HorizonGeometry = {
  y: number;
  /** The point every lane converges on. */
  vanish: LightPoint;
  /** Lane `d` strings, radiating from the vanishing point to the bottom edge. */
  lanes: string[];
  /** Receding rows below the horizon, as `d` strings. */
  rows: string[];
};

export function horizonGeometry(input: Pick<SeamInput, "width" | "height" | "phone">): HorizonGeometry {
  const y = horizonY(input);
  const bottom = input.height;
  const laneCount = input.phone ? 7 : 11;
  const rowCount = input.phone ? 4 : 6;
  const spread = input.width * (input.phone ? 0.34 : 0.26);
  const half = (laneCount - 1) / 2;
  const vanish = { x: input.width / 2, y };

  const lanes: string[] = [];
  for (let i = 0; i < laneCount; i += 1) {
    const x = input.width / 2 + (i - half) * spread;
    lanes.push(pathD([vanish, { x, y: bottom }]));
  }
  const rows: string[] = [];
  for (let j = 1; j <= rowCount; j += 1) {
    const ry = y + (bottom - y) * Math.pow(j / rowCount, 2.3);
    rows.push(pathD([{ x: 0, y: ry }, { x: input.width, y: ry }]));
  }
  return { y, vanish, lanes, rows };
}

/* ─── Alpha ceilings ──────────────────────────────────────────────────────
   Shipped ambient washes sit between 0.045 and 0.13 alpha; anything
   persistent above about 0.12 reads as glow rather than architecture. The
   horizon lives well under that; only a traveller's head — on screen for
   under a second at a time — goes bright. */

export const HORIZON_ALPHA = {
  /** The horizon line itself, at its brightest. */
  line: 0.13,
  /** A radiating lane, fading out away from the line. */
  lane: 0.06,
  /** A receding row. */
  row: 0.065,
} as const;

/** The horizon's breath swings between these two opacities, like `fba-room-breath`. */
export const HORIZON_BREATH = { from: 1, to: 0.72 } as const;
