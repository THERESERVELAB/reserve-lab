"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { ReserveDialRing, dialArcFrames, dialMotionNow, dialSpringMs, useDialMomentHold } from "@/components/ui/reserve/ReserveDial";
import { ReserveLiveNumber } from "@/components/ui/reserve/ReserveLiveNumber";
import { RESERVE } from "@/lib/design/tokens";
import type { MacroDial, MacroDials as MacroDialsModel, MacroState } from "@/lib/nutrition/nutrition-room";

/* ════════════════════════════════════════════════════════════════════════
   MACRO DIALS — protein, carbs, fat and calories logged today, against
   today's targets, with what is left said plainly.

   The same watch face as Apex's day scores (ReserveDial): thin arcs on a
   hairline track. The arc takes its colour from where the macro stands —
   steel on the way, green on target, amber over — never gold-filled.
   Values are the fuel plan's estimates for the meals the member logged
   ("est."). With nothing logged the dials show the day's targets on an empty
   track, never zeros painted as progress.

   Motion: when a meal is confirmed, the dials hold their old values while
   the log moment's light travels, then count and draw to the new ones as it
   lands — slow and calm. Reduced or paused motion shows the final values.
   Display only: nothing here is a control.
   ════════════════════════════════════════════════════════════════════════ */

const TONE: Record<MacroState, string> = {
  empty: "rgba(255,255,255,0.32)",
  under: RESERVE.steel,
  "on-target": RESERVE.green,
  over: RESERVE.amber,
};

const COUNT_MS = 1500;
const MEAL: readonly ["meal"] = ["meal"];

const sameDial = (a: MacroDial, b: MacroDial) => a.logged === b.logged && a.target === b.target && a.state === b.state;

export function MacroDials({ model, className = "" }: { model: MacroDialsModel; className?: string }) {
  const caption = model.empty
    ? "Nothing logged yet today · log a meal to start the count"
    : `${model.mealsLogged} of ${model.mealsPlanned} meals logged · est. from the plan's portions`;
  return (
    <div data-nutrition="macros" className={`min-w-0 ${className}`}>
      <div role="group" aria-label="Today's macros, estimated from logged meals" className="grid grid-cols-4 gap-2 sm:gap-3">
        {model.dials.map((dial) => (
          <MacroDialView
            key={dial.key}
            dial={dial}
            /* The protein dial is the room's protein read: the meal moment lands on its numeral. */
            testId={dial.key === "protein" ? "protein" : `macro-${dial.key}`}
            srNote={dial.key === "protein" ? `${model.mealsLogged} of ${model.mealsPlanned} meals logged · est.` : undefined}
          />
        ))}
      </div>
      <p data-nutrition="macros-caption" aria-hidden="true" className="mt-2.5 text-[11.5px] leading-snug text-white/60">
        {caption}
      </p>
    </div>
  );
}

function MacroDialView({ dial, testId, srNote }: { dial: MacroDial; testId: string; srNote?: string }) {
  const hold = useDialMomentHold(MEAL);

  /* What the dial shows: the reading, or the one it held while a meal's light
     was travelling. Adjusted during render (React's derived-state pattern). */
  const [held, setHeld] = useState<MacroDial>(dial);
  const [replay, setReplay] = useState<{ id: number; from: number } | null>(null);
  if (hold.landed !== null && replay?.id !== hold.landed) setReplay({ id: hold.landed, from: held.state === "empty" ? 0 : held.logged });
  if (!hold.holding && !sameDial(held, dial)) setHeld(dial);
  const shown = hold.holding ? held : dial;
  const empty = shown.state === "empty";

  const arcRef = useRef<SVGCircleElement>(null);
  /** The fraction last drawn (null while the dial was empty). */
  const drawn = useRef<number | null | undefined>(undefined);
  const landedSeen = useRef<number | null>(null);
  const fraction = empty ? null : shown.fraction;

  useLayoutEffect(() => {
    const before = drawn.current;
    drawn.current = fraction;
    /* First paint: show the value as it is. */
    if (before === undefined || before === fraction || fraction === null) return;
    const fromLanding = hold.landed !== null && landedSeen.current !== hold.landed;
    if (fromLanding) landedSeen.current = hold.landed;
    const arc = arcRef.current;
    if (!fromLanding || !arc || typeof arc.animate !== "function" || dialMotionNow() !== "full") return;
    const from = before ?? 0;
    arc.animate(dialArcFrames(from, fraction), { duration: dialSpringMs(from, fraction), easing: "linear" });
  }, [fraction, hold.landed]);

  const color = TONE[shown.state];
  return (
    <div
      role="group"
      aria-label={shown.ariaLabel}
      data-nutrition={testId}
      data-macro={dial.key}
      data-state={shown.state}
      className="flex min-w-0 flex-col items-center gap-2 text-center"
    >
      {srNote && <span className="sr-only">{srNote}</span>}
      <span className="relative block aspect-square w-full max-w-[84px]" aria-hidden="true">
        <ReserveDialRing fraction={fraction} color={color} arcRef={arcRef} />
        <span data-ring-face="" className="absolute inset-0 flex flex-col items-center justify-center">
          {/* The numeral stays mounted while the dial is empty, so a first log counts up from zero. */}
          <span hidden={empty} className="flex items-baseline font-display font-extrabold leading-none tracking-[-0.02em] text-[#f2eee6]">
            <ReserveLiveNumber value={empty ? 0 : shown.logged} replay={replay} countMs={COUNT_MS} className={shown.unit === "kcal" ? "text-[16px] sm:text-[19px]" : "text-[19px] sm:text-[21px]"} />
            {shown.unit === "g" && <span className="ml-0.5 text-[9.5px] font-semibold text-white/45">g</span>}
          </span>
          {!empty && (
            <span className="tnum mt-1 font-mono text-[7.5px] uppercase leading-none tracking-[0.16em] text-white/45">
              of {shown.target.toLocaleString("en-US")}
            </span>
          )}
          {empty && (
            <>
              <span className="tnum font-display text-[15px] font-extrabold leading-none text-white/55 sm:text-[17px]">{shown.target.toLocaleString("en-US")}</span>
              <span className="mt-1 font-mono text-[7px] uppercase leading-none tracking-[0.18em] text-white/40">{shown.unit} target</span>
            </>
          )}
        </span>
      </span>
      <span className="flex min-w-0 max-w-full flex-col items-center gap-1" aria-hidden="true">
        <span className="max-w-full truncate font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/55">
          {dial.label}
        </span>
        {!empty && (
          <span data-macro-remaining="" className="tnum max-w-full truncate text-[11px] font-semibold leading-none sm:text-[11.5px]" style={{ color }}>
            {shown.remaining}
          </span>
        )}
      </span>
    </div>
  );
}
