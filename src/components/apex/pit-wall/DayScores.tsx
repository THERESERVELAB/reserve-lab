"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { DIAL_R, ReserveDialRing, dialArcFrames, dialMotionNow, dialSpringMs, useDialMomentHold } from "@/components/ui/reserve/ReserveDial";
import { ReserveLiveNumber } from "@/components/ui/reserve/ReserveLiveNumber";
import type { DayRing, DayRingId, DayRingReading, DayScores as DayScoresModel, ScoreTone, SystemTone } from "@/lib/apex/day-scores";
import type { MotivationLine } from "@/lib/apex/motivation";
import { RESERVE, alpha } from "@/lib/design/tokens";
import type { LogMomentKind } from "@/lib/ui/log-moment";
import { msSinceLastSignal } from "@/lib/ui/signal-bus";

/* ════════════════════════════════════════════════════════════════════════
   TODAY'S SCORES — three dials, one row of system states, one quiet line.

   A watch face, not a toy: thin arcs on a hairline track, a faint hour ring,
   one numeral each. The arcs take the state's colour from the closed palette
   (green ready, steel steady, amber worth a look, grey no read); nothing here
   is gold-filled and nothing is red. Every dial is a button that opens what
   it is made of.

   Motion (Bible §08, the ambient gate):
     arrival   the dials draw from empty on a slow, over-damped spring while
               the numerals count with them (ReserveLiveNumber replays)
     full      a full dial earns one gold glint travelling the ring, once
     log       while a member's log moment is still travelling, the dial it
               feeds holds its old reading; when the light lands it moves
     reduced / paused / hidden: final values, drawn at once, nothing moves
   ════════════════════════════════════════════════════════════════════════ */

const TONE: Record<ScoreTone, string> = {
  ready: RESERVE.green,
  steady: RESERVE.steel,
  attention: RESERVE.amber,
  idle: "rgba(255,255,255,0.32)",
};

const DOT: Record<SystemTone, string> = {
  ready: RESERVE.green,
  attention: RESERVE.amber,
  idle: "rgba(255,255,255,0.26)",
};

/** Systems whose state word the dials already carry. */
const DIALLED = new Set<string>(["sleep", "fuel"]);

/** Which member logs feed which dial (log-moment kinds). */
const FEEDS: Record<DayRingId, readonly LogMomentKind[]> = {
  readiness: ["sleep", "water", "mobility", "check-in"],
  sleep: ["sleep"],
  fuel: ["meal"],
};

/* The draw spring, the ring and the log-moment hold are shared with Nutrition's
   macro dials (src/components/ui/reserve/ReserveDial.tsx). */
const DRAW_CASCADE_MS = 110;
const COUNT_MS = 1500;
const GLINT_MS = 1700;

type Arrival = "pending" | "wait" | "draw" | "still";

/** The longest a draw waits for its room to come on screen. */
const ARRIVAL_WAIT_MAX_MS = 1600;

/** The instrument is laid out and its room has come in (every ancestor nearly opaque and unblurred). */
function onScreen(el: HTMLElement | null): boolean {
  if (!el) return false;
  const box = el.getBoundingClientRect();
  if (box.width === 0 || box.bottom < 0 || box.top > window.innerHeight) return false;
  let opacity = 1;
  for (let node: HTMLElement | null = el; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    opacity *= Number(style.opacity) || 0;
    if (opacity < 0.92) return false;
    /* The room's entrance also clears a blur: wait until it has. */
    const blur = /blur\(([\d.]+)px\)/.exec(style.filter);
    if (blur && Number(blur[1]) > 0.5) return false;
  }
  return true;
}

const sameReading = (a: DayRingReading | null, b: DayRingReading | null) =>
  a === b || Boolean(a && b && a.value === b.value && a.fraction === b.fraction && a.unit === b.unit && a.decimals === b.decimals);

export function DayScores({
  scores,
  ready,
  onOpen,
  className = "",
}: {
  scores: DayScoresModel;
  /** The screen's clock has its real time: before that, "today" is a placeholder day and the dials wait. */
  ready: boolean;
  onOpen: (id: DayRingId) => void;
  className?: string;
}) {
  const [arrival, setArrival] = useState<Arrival>("pending");
  const rootRef = useRef<HTMLDivElement>(null);

  /* Decide on mount: draw, or show the final values at once. Until then the
     dials read empty and their numerals wait (globals.css). A draw waits for
     the room to be on screen: the room comes in around it (the view
     transition, the systems-online settle), and a draw played behind that is
     a draw nobody sees. Timers, not frames, bound the wait: frames stop in a
     hidden tab, and the dials must never be left empty. */
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    const started = performance.now();
    const check = () => {
      if (onScreen(rootRef.current) || performance.now() - started > ARRIVAL_WAIT_MAX_MS) {
        setArrival("draw");
        return;
      }
      frame = requestAnimationFrame(check);
    };
    const decide = window.setTimeout(() => {
      if (dialMotionNow() !== "full") {
        setArrival("still");
        return;
      }
      setArrival("wait");
      frame = requestAnimationFrame(check);
    }, 0);
    const fallback = window.setTimeout(() => setArrival((a) => (a === "wait" ? "draw" : a === "pending" ? "still" : a)), ARRIVAL_WAIT_MAX_MS + 200);
    return () => {
      window.clearTimeout(decide);
      window.clearTimeout(fallback);
      cancelAnimationFrame(frame);
    };
  }, [ready]);

  return (
    <div
      data-day-scores=""
      ref={rootRef}
      data-arrival={arrival}
      className={`flex min-w-0 flex-col gap-5 ${className}`}
    >
      <div role="group" aria-label="Today's scores" className="grid grid-cols-3 gap-2 sm:gap-4">
        {scores.rings.map((ring, i) => (
          <Dial key={ring.id} ring={ring} arrival={arrival} delayMs={i * DRAW_CASCADE_MS} onOpen={() => onOpen(ring.id)} />
        ))}
      </div>

      {/* The dials already say how sleep and fuel stand; the row carries the rest. */}
      <ul aria-label="How ready everything else is" className="grid grid-cols-4 gap-x-3" data-apex="systems">
        {scores.systems.filter((s) => !DIALLED.has(s.id)).map((s) => (
          <li key={s.id} title={s.source} className="flex min-w-0 flex-col gap-1" data-system={s.id} data-tone={s.tone}>
            <span className="truncate font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/45">{s.label}</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: DOT[s.tone], boxShadow: s.tone === "idle" ? "none" : `0 0 6px ${alpha(DOT[s.tone], 0.55)}` }} />
              <span className="truncate text-[11.5px] font-semibold leading-none" style={{ color: s.tone === "idle" ? "rgba(255,255,255,0.5)" : "rgba(242,238,230,0.86)" }}>
                {s.word}
              </span>
            </span>
          </li>
        ))}
      </ul>

    </div>
  );
}

/* ─── One dial ─────────────────────────────────────────────────────────── */

function Dial({ ring, arrival, delayMs, onOpen }: { ring: DayRing; arrival: Arrival; delayMs: number; onOpen: () => void }) {
  const hold = useDialMomentHold(FEEDS[ring.id]);

  /* What the dial shows: the reading, or the one it held while a log was
     travelling. Adjusted during render (React's derived-state pattern). */
  const [held, setHeld] = useState<DayRingReading | null>(ring.reading);
  /* The count the numeral plays: from zero on arrival, from the held value
     when a log's light lands (once per moment id; arrival is id 0). */
  const [replay, setReplay] = useState<{ id: number; from: number } | null>(null);
  if (hold.landed !== null && replay?.id !== hold.landed) setReplay({ id: hold.landed, from: held?.value ?? 0 });
  else if (arrival === "draw" && replay === null) setReplay({ id: 0, from: 0 });
  if (!hold.holding && !sameReading(held, ring.reading)) setHeld(ring.reading);
  const shown = hold.holding ? held : ring.reading;
  const complete = Boolean(shown && shown.fraction >= 1 && ring.complete);

  const arcRef = useRef<SVGCircleElement>(null);
  const glintRef = useRef<SVGCircleElement>(null);
  /** The fraction last drawn, or undefined before arrival. */
  const drawn = useRef<number | undefined>(undefined);
  const landedSeen = useRef<number | null>(null);
  const fraction = shown?.fraction ?? 0;

  useLayoutEffect(() => {
    if (arrival === "pending" || arrival === "wait") return;
    const arc = arcRef.current;
    const canAnimate = Boolean(arc && typeof arc.animate === "function");
    const glint = (afterMs: number) => {
      const el = glintRef.current;
      if (!el || typeof el.animate !== "function") return;
      el.animate(
        [
          { strokeDashoffset: "0", opacity: 0 },
          { strokeDashoffset: "-18", opacity: 0.95, offset: 0.2 },
          { strokeDashoffset: "-82", opacity: 0.7, offset: 0.8 },
          { strokeDashoffset: "-100", opacity: 0 },
        ],
        { duration: GLINT_MS, delay: afterMs, easing: "cubic-bezier(0.45, 0, 0.25, 1)", fill: "none" },
      );
    };

    /* Arrival: draw from empty, and glint once when full. */
    if (drawn.current === undefined) {
      drawn.current = fraction;
      if (arrival !== "draw" || !shown || !canAnimate) return;
      arc!.animate(dialArcFrames(0, fraction), { duration: dialSpringMs(0, fraction), delay: delayMs, easing: "linear", fill: "backwards" });
      if (complete) glint(delayMs + dialSpringMs(0, 1) * 0.7);
      return;
    }

    /* A change after arrival: a member's log moves the dial as its light lands;
       anything else (a clock tick, a cloud restore) simply shows the new value. */
    const before = drawn.current;
    drawn.current = fraction;
    if (before === fraction || !shown) return;
    const fromLanding = hold.landed !== null && landedSeen.current !== hold.landed;
    if (fromLanding) landedSeen.current = hold.landed;
    if (!canAnimate || dialMotionNow() !== "full" || !(fromLanding || msSinceLastSignal() <= 1500)) return;
    arc!.animate(dialArcFrames(before, fraction), { duration: dialSpringMs(before, fraction), easing: "linear" });
    if (complete && before < 1) glint(dialSpringMs(before, 1) * 0.6);
  }, [arrival, fraction, shown, complete, hold.landed, delayMs]);

  const color = TONE[ring.tone];
  const provenance = ring.qualifier ?? (ring.provenance === "logged" ? null : ring.provenance);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={ring.ariaLabel}
      aria-haspopup="dialog"
      data-day-ring={ring.id}
      data-apex={ring.id === "readiness" ? "readiness" : undefined}
      data-tone={ring.tone}
      data-empty={shown ? undefined : ""}
      className="group flex min-h-[44px] min-w-0 flex-col items-center gap-2.5 rounded-[14px] px-0.5 py-1 text-center outline-none transition-transform duration-200 focus-visible:ring-1 focus-visible:ring-white/35 active:scale-[0.985]"
    >
      <span className="relative block aspect-square w-full max-w-[92px]">
        <ReserveDialRing fraction={shown ? shown.fraction : null} color={color} arcRef={arcRef}>
          {ring.complete && (
            <circle
              ref={glintRef}
              data-ring-glint=""
              cx="50"
              cy="50"
              r={DIAL_R}
              fill="none"
              stroke={RESERVE.amber}
              strokeWidth="3.6"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="7 93"
              transform="rotate(-90 50 50)"
              opacity={0}
              style={{ filter: `drop-shadow(0 0 5px ${alpha(RESERVE.gold, 0.9)})` }}
            />
          )}
        </ReserveDialRing>
        <span data-ring-face="" className="absolute inset-0 flex flex-col items-center justify-center">
          {/* The numeral stays mounted while the dial is empty, so the count that
              fills it on a landing plays from its held value. */}
          <span hidden={!shown} data-ring-reading="" className="flex items-baseline font-display font-extrabold leading-none tracking-[-0.02em] text-[#f2eee6]">
            <ReserveLiveNumber value={shown?.value ?? 0} decimals={shown?.decimals ?? 0} replay={replay} countMs={COUNT_MS} className="text-[21px] sm:text-[23px]" />
            {shown?.unit && <span className="ml-0.5 text-[10px] font-semibold text-white/45">{shown.unit}</span>}
          </span>
          {shown && provenance && <span data-ring-reading="" className="mt-1.5 font-mono text-[7px] uppercase leading-none tracking-[0.2em] text-white/40">{provenance}</span>}
          {!shown && (
            <span className="max-w-[9ch] font-mono text-[7.5px] uppercase leading-[1.5] tracking-[0.18em] text-white/55 transition-colors group-hover:text-white/80">
              {ring.empty?.prompt}
            </span>
          )}
        </span>
      </span>
      <span className="flex min-w-0 max-w-full flex-col items-center gap-1">
        <span className="max-w-full truncate font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/50">{ring.label}</span>
        <span className="max-w-full truncate text-[12px] font-semibold leading-none" style={{ color: ring.tone === "idle" ? "rgba(255,255,255,0.5)" : color }}>
          {ring.word}
        </span>
      </span>
    </button>
  );
}

/* ─── The day's line ──────────────────────────────────────────────────────
   One sentence from the member's own record (src/lib/apex/motivation.ts),
   with a tiny mark that turns in the atmosphere band. Never gold-filled,
   never a control: it sits below the instrument, away from the gold action. */

export function DayLine({ line, className = "" }: { line: MotivationLine; className?: string }) {
  return (
    <p data-apex="motivation" data-source={line.source} className={`flex min-w-0 items-center gap-2.5 text-[12px] leading-[1.45] text-white/55 ${className}`}>
      <OrbitMark />
      <span className="min-w-0">{line.text}</span>
    </p>
  );
}

/* ─── The line's mark: a hairline orbit, turning once every 36s ────────── */

function OrbitMark() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="shrink-0 overflow-visible">
      <circle cx="6" cy="6" r="4.6" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="0.9" />
      <g className="fba-orbit">
        {/* A short tail behind the head, which sits at twelve o'clock and leads clockwise. */}
        <circle cx="6" cy="6" r="4.6" fill="none" stroke={RESERVE.gold} strokeOpacity="0.7" strokeWidth="0.9" strokeLinecap="round" pathLength={100} strokeDasharray="18 82" strokeDashoffset={18} transform="rotate(-90 6 6)" />
        <circle cx="6" cy="1.4" r="0.9" fill={RESERVE.amber} />
      </g>
    </svg>
  );
}
