/* ════════════════════════════════════════════════════════════════════════
   ROOM LIGHT — the living rooms follow the member's day (Design Bible §08/§09, V1.2).
   Apex first; Training and Recovery joined it on 2026-09-14, Nutrition and Schedule on 2026-09-15.

   Three still readouts, all pure:

     daypart   dawn / day / night from the member's own wake and sleep targets
     energy    plate brightness from readiness, on the Bible's shipped thresholds
     drift     2–4px of depth between plate and light as the page scrolls

   Nothing here moves on its own. The renderer cross-fades between results
   over ≥1s; reduced motion and a live session resolve drift to zero.
   ════════════════════════════════════════════════════════════════════════ */

import type { Daypart } from "@/lib/brand/asset-manifest";

export const DEFAULT_WAKE_MIN = 6 * 60 + 30;
export const DEFAULT_SLEEP_MIN = 22 * 60 + 30;

/** Dawn opens this long before wake… */
export const DAWN_BEFORE_WAKE_MIN = 60;
/** …and closes this long after it. */
export const DAWN_AFTER_WAKE_MIN = 90;
/** Night begins this long before the sleep target. */
export const NIGHT_BEFORE_SLEEP_MIN = 120;

/** The room's cross-fade between dayparts and light levels. Bible §09: ≥1s. */
export const ROOM_CROSSFADE_MS = 1400;

const DAY = 1440;
const mod = (v: number) => ((v % DAY) + DAY) % DAY;

/** "06:30" → 390. Anything unreadable is null. */
export function parseClock(hhmm: string | null | undefined): number | null {
  const match = typeof hhmm === "string" ? /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim()) : null;
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? h * 60 + m : null;
}

export type DaypartSchedule = { wakeTime?: string | null; sleepTarget?: string | null };

/**
 * The daypart for a wall-clock minute (0–1439), from the member's schedule.
 * Handles a sleep target after midnight. A missing or degenerate schedule
 * falls back to 06:30 wake and 22:30 sleep.
 */
export function resolveDaypart(nowMin: number, schedule: DaypartSchedule | null | undefined): Daypart {
  let wake = parseClock(schedule?.wakeTime) ?? DEFAULT_WAKE_MIN;
  let sleep = parseClock(schedule?.sleepTarget) ?? DEFAULT_SLEEP_MIN;
  if (wake === sleep) {
    wake = DEFAULT_WAKE_MIN;
    sleep = DEFAULT_SLEEP_MIN;
  }

  const awake = mod(sleep - wake);
  const since = mod(Math.floor(Number.isFinite(nowMin) ? nowMin : 0) - wake);
  const dawnEnd = Math.min(DAWN_AFTER_WAKE_MIN, awake);
  /* Pre-wake dawn never reaches back past the sleep target. */
  const dawnStart = DAY - Math.min(DAWN_BEFORE_WAKE_MIN, DAY - awake);
  const nightStart = Math.max(dawnEnd, awake - NIGHT_BEFORE_SLEEP_MIN);

  if (since < dawnEnd || since >= dawnStart) return "dawn";
  if (since >= nightStart) return "night";
  return "day";
}

/** Bible §08 rule 5: readiness ≥78 → 1.0, 62–77 → 0.78, below → 0.55, no data → 0.6. */
export function readinessEnergy(readiness: number | null | undefined): number {
  if (readiness === null || readiness === undefined || !Number.isFinite(readiness)) return 0.6;
  if (readiness >= 78) return 1;
  if (readiness >= 62) return 0.78;
  return 0.55;
}

export type RoomLight = { daypart: Daypart; energy: number };

export function resolveRoomLight(input: {
  now: Date;
  schedule: DaypartSchedule | null | undefined;
  readiness: number | null;
}): RoomLight {
  return {
    daypart: resolveDaypart(input.now.getHours() * 60 + input.now.getMinutes(), input.schedule),
    energy: readinessEnergy(input.readiness),
  };
}

/* ─── Living rooms ────────────────────────────────────────────────────────
   The rooms whose environment follows the member's day. Every other room is
   a fixed still at full plate strength. Adding a room is one entry here. */

export type LivingRoomProfile = {
  /**
   * Strength of the dawn tint, 0–1, before room light scales it. Recovery is
   * the lowest light in the product (Bible §09), so its dawn barely warms.
   */
  dawnTint: number;
};

export const LIVING_ROOM_PROFILES = {
  apex: { dawnTint: 1 },
  training: { dawnTint: 1 },
  /* Bible §09 lights Nutrition as a warm hearth with gentle motion: its dawn warms
     clearly more than Recovery's (the lowest light in the product) and stays under
     Apex and Training, whose full dawn stages a decisive or armed room. */
  nutrition: { dawnTint: 0.7 },
  /* Schedule is the planning desk. Bible §09 Morning is "the day is staged", and
     staging the day is this room's whole job, so its dawn warms more than the
     Nutrition hearth. It stays under Apex and Training, whose full dawn lights a
     decisive or armed room rather than a desk where the day is read and set. */
  schedule: { dawnTint: 0.85 },
  recovery: { dawnTint: 0.4 },
} as const satisfies Record<string, LivingRoomProfile>;

export type LivingRoom = keyof typeof LIVING_ROOM_PROFILES;

export const LIVING_ROOMS = Object.keys(LIVING_ROOM_PROFILES) as readonly LivingRoom[];

export function isLivingRoom(room: string): room is LivingRoom {
  return (LIVING_ROOMS as readonly string[]).includes(room);
}

/**
 * The light a living room shows. While `stilled` (a live session in a room
 * whose contract pauses it), the light held when the session began stays on
 * screen, so nothing cross-fades or shifts behind the set being logged. With
 * nothing held yet, the current light is what gets held.
 */
export function holdRoomLight(
  held: RoomLight | null,
  next: RoomLight | null,
  stilled: boolean,
): RoomLight | null {
  return stilled ? (held ?? next) : next;
}

export type LivingRoomInput = {
  room: string;
  /** The light to show, after `holdRoomLight`. Null until the client knows the time. */
  light: RoomLight | null;
  /** Client conditions have been read (no drift on server-render defaults). */
  measured: boolean;
  reducedMotion: boolean;
  /** The member's ambient-motion pause. */
  motionPaused: boolean;
  /** A live session is running anywhere in the app. */
  liveSession: boolean;
};

export type LivingRoomState = {
  living: boolean;
  /** Plate brightness multiplier. Always 1 outside a living room. */
  energy: number;
  /** Opacity of the dawn tint layer. 0 outside dawn and outside a living room. */
  dawnTintOpacity: number;
  /** Whether scroll depth drift runs. */
  drift: boolean;
};

export function resolveLivingRoom(input: LivingRoomInput): LivingRoomState {
  if (!isLivingRoom(input.room)) {
    return { living: false, energy: 1, dawnTintOpacity: 0, drift: false };
  }
  const profile: LivingRoomProfile = LIVING_ROOM_PROFILES[input.room];
  const energy = input.light?.energy ?? 1;
  return {
    living: true,
    energy,
    dawnTintOpacity: input.light?.daypart === "dawn" ? energy * profile.dawnTint : 0,
    drift: input.measured && !input.reducedMotion && !input.liveSession && !input.motionPaused,
  };
}

/* ─── Depth drift ──────────────────────────────────────────────────────── */

export const DEPTH_DRIFT = {
  /** The plate is farthest and moves least. */
  platePx: 24,
  /** The light layer sits between plate and glass. */
  lightPx: 40,
  /** Scroll distance over which the drift reaches its full travel. Owner
     2026-09-18: the rooms read stale on a phone at 2–4px; the room now
     travels with the page over its first two screens. */
  rangePx: 1400,
} as const;

/**
 * Upward offsets (≤ 0 px) for the plate and light layers at a scroll
 * position. The glass scrolls with the page; these barely do, which is the
 * depth. Zero under reduced motion and during a live session.
 */
export function resolveDepthDrift(input: {
  scrollTop: number;
  reducedMotion: boolean;
  liveSession: boolean;
}): { platePx: number; lightPx: number } {
  if (input.reducedMotion || input.liveSession || !Number.isFinite(input.scrollTop) || input.scrollTop <= 0) {
    return { platePx: 0, lightPx: 0 };
  }
  const p = Math.min(1, input.scrollTop / DEPTH_DRIFT.rangePx);
  const step = (px: number) => -Math.round(px * p * 10) / 10 || 0;
  return { platePx: step(DEPTH_DRIFT.platePx), lightPx: step(DEPTH_DRIFT.lightPx) };
}
