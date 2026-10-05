/* ════════════════════════════════════════════════════════════════════════
   SESSION HORIZON — today's session, as blocks on one clock.

   The Training room's version of the Apex horizon (Bible §13). Every block
   comes from the member's real session: the mobility primer, the lifting
   phases of today's queue, the support phases the session mode includes,
   and the post-workout meal window. Nothing is invented to fill the strip.

   Times are estimates and say so: lifting blocks share the template's own
   `estimatedDurationMin` in proportion to their sets and rest, and support
   phases use their authored duration text. Once the session is live, the
   block in progress is pinned to now, so the strip never claims the member
   is further along than the logged sets show.

   Geometry reuses `horizon-projection.ts` unchanged. `layoutHorizonTrack`
   adds the one thing a session needs that the Apex lanes do not: a run of
   back-to-back blocks, each a readable, non-overlapping control.

   Pure: no React, no DOM, no store.
   ════════════════════════════════════════════════════════════════════════ */

import { projectMinute, type HorizonFrame } from "@/lib/apex/horizon-projection";

export type SessionHorizonMode = "pre" | "live" | "complete" | "closed";
export type SessionHorizonKind = "primer" | "work" | "support" | "cooldown" | "handoff" | "post-window";
/** Bible §11 canonical status set. */
export type SessionHorizonStatus = "due-now" | "due-next" | "upcoming" | "past-due" | "completed" | "skipped";
export type SupportPhaseKey = "core" | "conditioning" | "recovery" | "handoff";
/** The support-slot states Training already computes (`buildSupportPhaseSlots`). */
export type SupportSlotStatus =
  | "pending"
  | "due-now"
  | "completed"
  | "skipped"
  | "reduced"
  | "optional"
  | "recommended-if-hydrated"
  | "not-included";

export type SessionHorizonInput = {
  mode: SessionHorizonMode;
  now: Date;
  /** The member's planned training start, "17:30". */
  plannedStart: string | null;
  startedAt: string | null;
  endedAt: string | null;
  /** The mobility primer's authored time, "5–10 min". Pre-session only. */
  primerTime: string | null;
  /** The template's own estimate for the lifting work. */
  estimatedLiftingMin: number | null;
  /** Lifting phases in session order, with today's queue and logged sets. */
  work: ReadonlyArray<{
    phase: string;
    label: string;
    movements: ReadonlyArray<{ id: string; sets: number; restSeconds: number; loggedSets: number }>;
  }>;
  support: ReadonlyArray<{ key: SupportPhaseKey; label: string; included: boolean; duration: string; status: SupportSlotStatus }>;
};

export type SessionHorizonBlock = {
  id: string;
  kind: SessionHorizonKind;
  label: string;
  sub: string | null;
  /** Minutes from today's midnight. */
  startMin: number;
  endMin: number;
  status: SessionHorizonStatus;
  /** Work blocks: the phase key. */
  phase: string | null;
  /** Support blocks: which support phase. */
  supportKey: SupportPhaseKey | null;
  /** Work blocks: the first movement in the phase with sets still open. */
  firstOpenMovementId: string | null;
};

export type SessionHorizon = {
  mode: SessionHorizonMode;
  nowMin: number;
  /** When the session itself begins (after the primer). */
  startMin: number;
  /** Where that start came from: the member's plan, now (plan already passed), or the real start. */
  startSource: "planned" | "now" | "started";
  /** End of the last block, the post-workout window included. */
  endMin: number;
  blocks: SessionHorizonBlock[];
};

export const SESSION_HORIZON = {
  /** Working time per set, before rest. Used only to share the template estimate between phases. */
  workSecondsPerSet: 45,
  primerFallbackMin: 8,
  supportFallbackMin: 10,
  /** Post-workout window — the same rule Training's day planner uses. */
  postWindowLeadMin: 5,
  postWindowMin: 90,
  lateSessionPostWindowMin: 120,
} as const;

/* ─── Small readers ────────────────────────────────────────────────────── */

/** "17:30" → 1050. Null for anything that is not a clock time. */
export function clockToMinutes(hhmm: string | null | undefined): number | null {
  const match = hhmm ? /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim()) : null;
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes from the local midnight of `dayOf`. An instant on another day falls outside 0–1439. */
export function minutesSinceMidnight(at: Date | string, dayOf: Date): number | null {
  const instant = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(instant.getTime())) return null;
  const midnight = new Date(dayOf.getTime());
  midnight.setHours(0, 0, 0, 0);
  return Math.floor((instant.getTime() - midnight.getTime()) / 60_000);
}

/** "8–10 min" → 9, "20 min" → 20, "8–12 min optional" → 10. Null when no minutes are written. */
export function parseDurationMinutes(text: string | null | undefined): number | null {
  if (!text) return null;
  const range = /(\d+(?:\.\d+)?)\s*(?:–|—|-|to)\s*(\d+(?:\.\d+)?)/.exec(text);
  if (range) return Math.max(1, Math.round((Number(range[1]) + Number(range[2])) / 2));
  const single = /(\d+(?:\.\d+)?)/.exec(text);
  return single ? Math.max(1, Math.round(Number(single[1]))) : null;
}

/** The post-workout meal window after a session: a short lead, then 90 minutes (120 for evening sessions). */
export function postSessionWindow(sessionEndMin: number, sessionStartMin: number): { startMin: number; endMin: number } {
  const startHour = Math.floor((((sessionStartMin % 1440) + 1440) % 1440) / 60);
  const length = startHour >= 18 || startHour < 4 ? SESSION_HORIZON.lateSessionPostWindowMin : SESSION_HORIZON.postWindowMin;
  return { startMin: sessionEndMin + SESSION_HORIZON.postWindowLeadMin, endMin: sessionEndMin + length };
}

/* ─── The sequence ─────────────────────────────────────────────────────── */

type Step = Omit<SessionHorizonBlock, "startMin" | "endMin" | "status"> & {
  minutes: number;
  /** Share already done, 0–1 (logged sets for work). */
  done: number;
  settled: "completed" | "skipped" | null;
};

type Placed = Step & { startMin: number; endMin: number };

const SUPPORT_KIND: Record<SupportPhaseKey, SessionHorizonKind> = {
  core: "support",
  conditioning: "support",
  recovery: "cooldown",
  handoff: "handoff",
};

function workSteps(input: SessionHorizonInput): Step[] {
  const phases = input.work.filter((w) => w.movements.length > 0);
  const rawSeconds = phases.map((w) =>
    w.movements.reduce((sum, m) => sum + Math.max(0, m.sets) * (SESSION_HORIZON.workSecondsPerSet + Math.max(0, m.restSeconds)), 0),
  );
  const rawTotalMin = rawSeconds.reduce((a, b) => a + b, 0) / 60;
  const scale = input.estimatedLiftingMin && input.estimatedLiftingMin > 0 && rawTotalMin > 0 ? input.estimatedLiftingMin / rawTotalMin : 1;

  return phases.map((w, i) => {
    const sets = w.movements.reduce((sum, m) => sum + Math.max(0, m.sets), 0);
    const logged = w.movements.reduce((sum, m) => sum + Math.min(Math.max(0, m.loggedSets), Math.max(0, m.sets)), 0);
    const count = w.movements.length;
    const inProgress = input.mode !== "pre" && logged > 0 && logged < sets;
    return {
      id: `work-${w.phase}`,
      kind: "work",
      label: w.label,
      sub: inProgress ? `${logged} of ${sets} sets logged` : `${count} ${count === 1 ? "movement" : "movements"} · ${sets} sets`,
      phase: w.phase,
      supportKey: null,
      firstOpenMovementId: w.movements.find((m) => m.loggedSets < m.sets)?.id ?? null,
      minutes: Math.max(1, Math.round((rawSeconds[i] / 60) * scale)),
      done: sets > 0 ? logged / sets : 0,
      settled: sets > 0 && logged >= sets ? "completed" : null,
    };
  });
}

function supportSteps(input: SessionHorizonInput): Step[] {
  return input.support
    .filter((s) => s.included && s.status !== "not-included")
    .map((s) => ({
      id: `support-${s.key}`,
      kind: SUPPORT_KIND[s.key],
      label: s.label,
      sub: s.duration || null,
      phase: null,
      supportKey: s.key,
      firstOpenMovementId: null,
      minutes: parseDurationMinutes(s.duration) ?? SESSION_HORIZON.supportFallbackMin,
      done: s.status === "completed" || s.status === "skipped" ? 1 : 0,
      settled: s.status === "completed" ? "completed" : s.status === "skipped" ? "skipped" : null,
    }));
}

function placeSequential(steps: readonly Step[], startMin: number): Placed[] {
  let cursor = startMin;
  return steps.map((step) => {
    const placed = { ...step, startMin: cursor, endMin: cursor + step.minutes };
    cursor = placed.endMin;
    return placed;
  });
}

/**
 * Places a sequence that is under way. Settled blocks keep their plan unless
 * the member is behind it, in which case they share the time actually spent.
 * The block in progress holds now: its logged share sits behind the gate and
 * its remaining share ahead of it. Everything after follows from there.
 */
function placeUnderway(steps: readonly Step[], startMin: number, nowMin: number): Placed[] {
  const planned = placeSequential(steps, startMin);
  const f = steps.findIndex((s) => s.settled === null);
  if (f < 0) return planned;

  const current = steps[f];
  const currentStart = Math.max(planned[f].startMin, nowMin - current.done * current.minutes);
  const currentEnd = currentStart + current.minutes;
  const out: Placed[] = [];

  if (f > 0) {
    const plannedSpan = planned[f].startMin - startMin;
    const actualSpan = currentStart - startMin;
    const stretch = plannedSpan > 0 ? actualSpan / plannedSpan : 1;
    for (let i = 0; i < f; i += 1) {
      out.push({
        ...planned[i],
        startMin: startMin + (planned[i].startMin - startMin) * stretch,
        endMin: startMin + (planned[i].endMin - startMin) * stretch,
      });
    }
    out.push({ ...current, startMin: currentStart, endMin: currentEnd });
  } else {
    /* Time since the start counts toward the first block, so no gap opens behind it. */
    out.push({ ...current, startMin, endMin: Math.max(currentEnd, startMin + current.minutes) });
  }
  return [...out, ...placeSequential(steps.slice(f + 1), out[out.length - 1].endMin)];
}

function statusesInOrder(placed: readonly Placed[], mode: SessionHorizonMode, nowMin: number): SessionHorizonStatus[] {
  let open = 0;
  return placed.map((p) => {
    if (p.settled) return p.settled;
    open += 1;
    if (mode === "pre") return open === 1 ? (nowMin >= p.startMin ? "due-now" : "due-next") : "upcoming";
    return open === 1 ? "due-now" : open === 2 ? "due-next" : "upcoming";
  });
}

const roundMin = (v: number) => Math.round(v);

export function buildSessionHorizon(input: SessionHorizonInput): SessionHorizon | null {
  const nowMin = minutesSinceMidnight(input.now, input.now) ?? 0;
  const work = workSteps(input);
  if (work.length === 0) return null;
  const support = supportSteps(input);

  let startMin: number;
  let startSource: SessionHorizon["startSource"];
  let placed: Placed[];

  if (input.mode === "pre") {
    const primerMin = input.primerTime ? (parseDurationMinutes(input.primerTime) ?? SESSION_HORIZON.primerFallbackMin) : 0;
    const planned = clockToMinutes(input.plannedStart);
    const earliest = nowMin + primerMin;
    if (planned !== null && planned >= earliest) {
      startMin = planned;
      startSource = "planned";
    } else {
      startMin = earliest;
      startSource = "now";
    }
    const primer: Placed[] = primerMin > 0
      ? [{
          id: "primer",
          kind: "primer",
          label: "Mobility Primer",
          sub: input.primerTime,
          phase: null,
          supportKey: null,
          firstOpenMovementId: null,
          minutes: primerMin,
          done: 0,
          settled: null,
          startMin: startMin - primerMin,
          endMin: startMin,
        }]
      : [];
    placed = [...primer, ...placeSequential([...work, ...support], startMin)];
  } else {
    const started = input.startedAt ? minutesSinceMidnight(input.startedAt, input.now) : null;
    startMin = started ?? nowMin;
    startSource = started === null ? "now" : "started";

    if (input.mode === "live") {
      placed = placeUnderway([...work, ...support], startMin, nowMin);
    } else {
      /* Closed out: the lifting happened between the start and the close. */
      const ended = input.endedAt ? minutesSinceMidnight(input.endedAt, input.now) : null;
      const plannedWork = placeSequential(work, startMin);
      const liftEnd = Math.max(startMin + 1, ended ?? plannedWork[plannedWork.length - 1].endMin);
      const span = plannedWork[plannedWork.length - 1].endMin - startMin;
      const stretch = span > 0 ? (liftEnd - startMin) / span : 1;
      const closedWork = plannedWork.map((p) => ({
        ...p,
        settled: p.done > 0 ? ("completed" as const) : ("skipped" as const),
        startMin: startMin + (p.startMin - startMin) * stretch,
        endMin: startMin + (p.endMin - startMin) * stretch,
      }));
      placed = [...closedWork, ...placeUnderway(support, liftEnd, nowMin)];
    }
  }

  const statuses = statusesInOrder(placed, input.mode, nowMin);
  const blocks: SessionHorizonBlock[] = placed.map((p, i) => ({
    id: p.id,
    kind: p.kind,
    label: p.label,
    sub: p.sub,
    startMin: roundMin(p.startMin),
    endMin: Math.max(roundMin(p.startMin) + 1, roundMin(p.endMin)),
    status: statuses[i],
    phase: p.phase,
    supportKey: p.supportKey,
    firstOpenMovementId: p.firstOpenMovementId,
  }));

  const sessionEnd = blocks[blocks.length - 1].endMin;
  const post = postSessionWindow(sessionEnd, startMin);
  const othersSettled = blocks.every((b) => b.status === "completed" || b.status === "skipped");
  blocks.push({
    id: "post-window",
    kind: "post-window",
    label: "Post-Workout Meal",
    sub: "Fuel window",
    startMin: post.startMin,
    endMin: post.endMin,
    status: nowMin > post.endMin ? "past-due" : nowMin >= post.startMin ? "due-now" : othersSettled ? "due-next" : "upcoming",
    phase: null,
    supportKey: null,
    firstOpenMovementId: null,
  });

  return { mode: input.mode, nowMin, startMin: roundMin(startMin), startSource, endMin: post.endMin, blocks };
}

/* ─── The track ────────────────────────────────────────────────────────── */

/**
 * The visible range of the strip. Before the session it opens just behind
 * now; when the session is hours away it opens at the session instead, so
 * the blocks are not crushed into the far end. Once under way it keeps the
 * last 45 minutes behind the gate.
 */
export function sessionHorizonWindow(horizon: SessionHorizon): { startMin: number; endMin: number } {
  const first = horizon.blocks[0];
  const endMin = Math.max(horizon.endMin + 10, horizon.nowMin + 30);
  if (horizon.mode === "pre") {
    const lead = first.startMin - horizon.nowMin;
    return { startMin: lead > 120 ? first.startMin - 30 : Math.min(horizon.nowMin, first.startMin) - 15, endMin };
  }
  return { startMin: Math.min(horizon.nowMin, Math.max(first.startMin - 10, horizon.nowMin - 45)), endMin };
}

export const HORIZON_TRACK = {
  /** A block needs this width to carry a short name at 11px. Hit height is 44px regardless. */
  minChipPx: 64,
  gapPx: 4,
} as const;

export type HorizonTrackItem = {
  /** Index into the blocks passed in. */
  index: number;
  leftPx: number;
  widthPx: number;
  /** Mean projected depth across the block: 1 at the gate, 0 at the far end. */
  depth: number;
};

export type HorizonTrackLayout = {
  items: HorizonTrackItem[];
  /** Blocks that ended before the window opened. */
  hiddenBefore: number;
  /** False when the blocks cannot all be drawn readable and apart at this width. */
  fits: boolean;
};

/**
 * Lays back-to-back blocks along the projected track. Each block starts at
 * its projected minute unless the block before needs the room; each is at
 * least `minChipPx` wide; none overlaps another or leaves the track. When
 * that cannot hold at this width, `fits` is false and the view lists instead.
 */
export function layoutHorizonTrack(
  blocks: ReadonlyArray<{ startMin: number; endMin: number }>,
  frame: HorizonFrame,
  options: { minChipPx?: number; gapPx?: number } = {},
): HorizonTrackLayout {
  const minPx = options.minChipPx ?? HORIZON_TRACK.minChipPx;
  const gap = options.gapPx ?? HORIZON_TRACK.gapPx;
  const w = frame.trackPx;

  const items: HorizonTrackItem[] = [];
  let hiddenBefore = 0;
  let cursor = 0;
  blocks.forEach((block, index) => {
    if (block.endMin <= frame.startMin) {
      hiddenBefore += 1;
      return;
    }
    const from = projectMinute(Math.max(block.startMin, frame.startMin), frame);
    const to = projectMinute(block.endMin, frame);
    const leftPx = Math.max(from.x * w, cursor);
    const widthPx = Math.max(minPx, to.x * w - leftPx);
    items.push({ index, leftPx, widthPx, depth: Math.round(((from.depth + to.depth) / 2) * 1000) / 1000 });
    cursor = leftPx + widthPx + gap;
  });

  /* Back from the far end: nothing may run past the track. */
  let limit = w;
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    const right = Math.min(item.leftPx + item.widthPx, limit);
    item.leftPx = Math.min(item.leftPx, right - minPx);
    item.widthPx = right - item.leftPx;
    limit = item.leftPx - gap;
  }

  for (const item of items) {
    item.leftPx = Math.round(item.leftPx);
    item.widthPx = Math.floor(item.widthPx);
  }
  const fits = items.every(
    (item, i) => item.leftPx >= 0 && item.widthPx >= minPx - 1 && (i === 0 || item.leftPx >= items[i - 1].leftPx + items[i - 1].widthPx + gap - 1),
  );
  return { items, hiddenBefore, fits };
}
