"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import { useClientNow } from "@/components/safety/useClientNow";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { buildDayTimeline, inWords, type TimelineKind, type TimelineMark } from "@/lib/cycle/day-timeline";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { formatTime12 } from "@/lib/schedule/engine";
import { useAmbientMotion } from "@/lib/ui/use-ambient-motion";

const KIND_COLOR: Record<TimelineKind, string> = {
  compound: RESERVE.gold,
  meal: RESERVE.green,
  training: RESERVE.steel,
  wake: "rgba(242,238,230,0.5)",
  "wind-down": RESERVE.violet,
  sleep: "rgba(242,238,230,0.5)",
};

const KIND_LABEL: Record<TimelineKind, string> = {
  compound: "Compound",
  meal: "Meal",
  training: "Training",
  wake: "Wake",
  "wind-down": "Wind down",
  sleep: "Lights out",
};

const EASE = [0.22, 1, 0.36, 1] as const;

export type DayTimelineSlot = {
  id: string;
  slotId: string;
  label: string;
  at: string | null;
  state: TimelineMark["state"];
  detail?: string;
};

/**
 * THE DAY, ON ONE TRACK — compounds, meals, the session and the night, placed
 * by time with the current moment moving across them. Tapping a mark says what
 * it is; a compound that is due can be logged from where it sits.
 *
 * It reads the same schedule the hero and Today read, so a compound is never
 * due here and upcoming there. Motion follows the member's ambient setting:
 * the track draws in once, the moment breathes, and nothing moves while a
 * member is reading in reduced or static mode.
 */
export function DayTimeline({
  compounds,
  meals,
  training,
  wakeTime,
  windDownTime,
  sleepTime,
  onLog,
}: {
  compounds: DayTimelineSlot[];
  meals: Array<{ id: string; label: string; at: string | null }>;
  training: { label: string; at: string | null } | null;
  wakeTime?: string;
  windDownTime?: string;
  sleepTime?: string;
  onLog?: (slotId: string) => void;
}) {
  const now = useClientNow();
  const motionSetting = useAmbientMotion();
  const [selectedId, setSelected] = useState<string | null>(null);

  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const timeline = useMemo(
    () => buildDayTimeline({ nowMin, compounds, meals, training, wakeTime, windDownTime, sleepTime }),
    [nowMin, compounds, meals, training, wakeTime, windDownTime, sleepTime],
  );

  if (!now || (timeline.marks.length === 0 && timeline.unplaced.length === 0)) return null;

  const animate = motionSetting === "full";
  const selected = timeline.marks.find((m) => m.id === selectedId) ?? null;
  const headline = selected
    ? `${KIND_LABEL[selected.kind]} · ${formatTime12(selected.at)}`
    : timeline.next
      ? `Next: ${timeline.next.mark.label} at ${formatTime12(timeline.next.mark.at)} · ${inWords(timeline.next.inMinutes)}`
      : "Nothing left on the clock today";

  return (
    <GlassPanel accent={RESERVE.gold}>
      <section aria-label="Your day" className="flex flex-col gap-3" data-day-timeline>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="type-whisper" style={{ color: alpha(RESERVE.gold, 0.9) }}>
            Your day · {timeline.logged.done} of {timeline.logged.total} logged
          </p>
          <p className="text-[11px] text-white/40">{formatTime12(timeline.now.label)}</p>
        </div>

        {/* The track. Marks are buttons: a tap names one, and a due compound can be logged from it. */}
        <div className="relative h-[74px] w-full">
          <div className="absolute left-0 right-0 top-[34px] h-px" style={{ background: "rgba(255,255,255,0.09)" }} />
          <motion.div
            className="absolute left-0 top-[34px] h-px origin-left"
            style={{ width: `${timeline.now.pct * 100}%`, background: alpha(RESERVE.gold, 0.5) }}
            initial={animate ? { scaleX: 0 } : false}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: EASE }}
          />
          {/* Now. It breathes in full motion, and simply sits still otherwise. */}
          <motion.div
            className="absolute top-[26px] h-[18px] w-[2px] rounded-full"
            style={{ left: `${timeline.now.pct * 100}%`, background: RESERVE.gold }}
            animate={animate ? { opacity: [1, 0.45, 1] } : { opacity: 1 }}
            transition={animate ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : undefined}
            data-day-now
          />
          {timeline.marks.map((mark, i) => {
            const on = mark.id === selectedId;
            const done = mark.state === "done";
            const missed = mark.state === "missed";
            const dim = mark.state === "passed" || done;
            const color = missed ? RESERVE.red : KIND_COLOR[mark.kind];
            const size = mark.kind === "compound" ? 11 : 7;
            /* The button is a clear 24px touch target; the dot inside it is the mark.
               A mark is a place on the day, never the screen's gold action. */
            return (
              <motion.button
                key={mark.id}
                type="button"
                onClick={() => setSelected(on ? null : mark.id)}
                aria-label={`${mark.label} at ${formatTime12(mark.at)}`}
                aria-pressed={on}
                className="absolute flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40"
                style={{ left: `${mark.pct * 100}%`, top: 22, background: "transparent" }}
                initial={animate ? { scale: 0, opacity: 0 } : false}
                animate={{ scale: on ? 1.5 : 1, opacity: dim && !on ? 0.45 : 1 }}
                transition={{ duration: 0.4, delay: animate ? Math.min(0.5, i * 0.03) : 0, ease: EASE }}
                data-day-mark={mark.kind}
              >
                <span
                  aria-hidden="true"
                  className="block rounded-full"
                  style={{
                    height: size,
                    width: size,
                    background: done ? "transparent" : color,
                    boxShadow: done ? `inset 0 0 0 1.5px ${color}` : on ? "0 0 0 3px rgba(255,255,255,0.14)" : undefined,
                  }}
                />
              </motion.button>
            );
          })}
          {/* The ends of the window, so the track reads as a day rather than a bar. */}
          <p className="absolute left-0 top-[46px] text-[10px] text-white/30">{formatTime12(hhmmOf(timeline.startMin))}</p>
          <p className="absolute right-0 top-[46px] text-[10px] text-white/30">{formatTime12(hhmmOf(timeline.endMin))}</p>
        </div>

        <div className="min-h-[46px]">
          <p className="text-[13px] font-semibold" style={{ color: RESERVE.ivory }} data-day-headline>
            {selected ? selected.label : headline}
          </p>
          <p className="mt-0.5 text-[12px] leading-[1.5] text-white/55">
            {selected
              ? `${headline}${selected.detail ? ` · ${selected.detail}` : ""}${selected.state === "missed" ? " · past its time" : selected.state === "done" ? " · logged" : ""}`
              : "Tap a mark to see what it is. Compounds are gold, meals green, your session steel."}
          </p>
          {selected?.kind === "compound" && selected.slotId && onLog && selected.state !== "done" && (
            <div className="mt-2">
              <ReserveButton
                tier="secondary"
                size="sm"
                onClick={() => {
                  onLog(selected.slotId!);
                  setSelected(null);
                }}
              >
                Log {selected.label}
              </ReserveButton>
            </div>
          )}
        </div>

        {timeline.unplaced.length > 0 && (
          <p className="text-[11.5px] leading-[1.5] text-white/45" data-day-unplaced>
            No time set: {timeline.unplaced.map((u) => u.label).join(", ")}. Give them a time in the compound editor and they join the track.
          </p>
        )}
      </section>
    </GlassPanel>
  );
}

function hhmmOf(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
