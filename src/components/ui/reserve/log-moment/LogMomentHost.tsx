"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Fragment, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { ReserveLiveNumber } from "@/components/ui/reserve/ReserveLiveNumber";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import type { AmbientMotion } from "@/lib/ui/ambient-motion";
import { announcementText, isFigure, planLogMoment, type LogMomentPlan } from "@/lib/ui/log-moment";
import { planLogSound } from "@/lib/ui/log-sound";
import { useLogSoundStore } from "@/lib/ui/log-sound-store";
import { useAmbientMotion } from "@/lib/ui/use-ambient-motion";

import { runLogMomentEffects, type EffectRun } from "./log-moment-effects";
import { playLogSound } from "./log-sound-engine";
import { trackLogMomentPresses, useLogMomentStore, type StagedLogMoment } from "./log-moment-store";

/* ════════════════════════════════════════════════════════════════════════
   LOG MOMENT — the room answers a member's log.

   Mounted once, by the shell, so two moments can never stack. When the
   member logs, the moment waits until no dialog covers the room, then lands.

   Full tier (the daily anchor logs, ~1.5s):
       0ms  impact   the row presses toward its control on a spring, a gold
                     light sweeps it and locks in along its base, and the
                     check on its control draws itself
     150ms  flow     light leaves the row (or the place the member pressed,
                     when a sheet has closed) and travels an arc to the
                     readout, or to the words' plate when none is on screen
     250ms  words    one line: "Sleep logged · 7.4 h · 5 nights in a row"
     720ms  boom     the light lands: a flash, a shockwave, sparks, a bloom
                     in the room light; the room brightens once and the
                     figures count up
    ~1.7s   quiet    every effect is gone; the words hold, then leave

   Mark tier (the frequent small logs): the row presses lightly, the check
   draws itself, the light sweeps the row and the words show. No flow, no
   boom, a shorter hold. A clear (Undo) is the same small version, dimming.

   A milestone from the member's own record lands harder, adds a short
   headline and holds longer.

   The words sit on their own glass plate, centred over <main> above the
   bottom stack, and move to just under the top bar if they would cover the
   log's own controls or a guarded gold action. The light is drawn behind
   the plate, never across its letters.

   Sound (lib/ui/log-sound): a tone rides each beat, impact and arrival,
   from the member's own gesture. Off with the Settings switch, silent
   whenever the plan draws nothing, and a phone's silent switch wins.

   Reduced motion and static (paused or hidden) motion: the same plate with
   the words and a still check; the figures are simply true. Nothing
   animates, nothing is drawn, nothing vibrates. Every mode announces the log
   in a polite live region.

   It never blocks the room: everything is pointer-events: none, and a new
   log cancels whatever the last one was still drawing.
   ════════════════════════════════════════════════════════════════════════ */

const GOLD = "#d5b15f";
const IVORY = "#f2eee6";
const EASE = [0.22, 1, 0.36, 1] as const;

const noopSubscribe = () => () => {};

/** A dialog still covers the room (a logger sheet, a confirmation). */
const roomCovered = () => Boolean(document.querySelector('[aria-modal="true"]'));

/** Tag an element for tests: data-log-moment, plus data-meal-moment for a Nutrition meal. */
const hooks = (role: string, legacy: boolean) => (legacy ? { "data-log-moment": role, "data-meal-moment": role } : { "data-log-moment": role });

export function LogMomentHost() {
  const motionSetting = useAmbientMotion();
  const pending = useLogMomentStore((s) => s.pending);
  const fired = useLogMomentStore((s) => s.fired);
  const arrived = useLogMomentStore((s) => s.arrived);
  const announcement = useLogMomentStore((s) => s.announcement);
  const activeView = useAthleteDashboardStore((s) => s.activeView);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const layerRef = useRef<HTMLDivElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<EffectRun | null>(null);
  const motionRef = useRef<AmbientMotion>(motionSetting);

  useEffect(() => {
    motionRef.current = motionSetting;
  }, [motionSetting]);

  useEffect(() => {
    trackLogMomentPresses();
    void useLogSoundStore.persist.rehydrate();
    return () => {
      runRef.current?.cancel();
      useLogMomentStore.getState().reset();
    };
  }, []);

  /* Leaving the room a moment was logged in drops it. */
  useEffect(() => {
    const { pending: p, fired: f } = useLogMomentStore.getState();
    const stale = (m: StagedLogMoment | null) => Boolean(m && m.view && m.view !== activeView);
    if (stale(p) || stale(f)) {
      runRef.current?.cancel();
      runRef.current = null;
      useLogMomentStore.setState((s) => ({
        pending: stale(s.pending) ? null : s.pending,
        fired: stale(s.fired) ? null : s.fired,
        arrived: stale(s.fired) ? null : s.arrived,
      }));
    }
  }, [activeView]);

  /* Fire once nothing covers the room. */
  useEffect(() => {
    if (!pending) return;
    const tryFire = () => {
      if (!roomCovered()) useLogMomentStore.getState().fire();
    };
    const observer = new MutationObserver(tryFire);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-modal"] });
    const first = window.setTimeout(tryFire, 0);
    return () => {
      observer.disconnect();
      window.clearTimeout(first);
    };
  }, [pending]);

  /* Run the beats. */
  useEffect(() => {
    if (!fired) return;
    const plan = planLogMoment(fired, motionRef.current);
    runRef.current?.cancel();
    runRef.current = null;
    const layer = layerRef.current;
    if (layer && plan.visible) {
      runRef.current = runLogMomentEffects({
        layer,
        tier: fired.tier,
        tone: fired.tone,
        plan,
        targets: fired.targets,
        origin: fired.origin,
        pressed: fired.pressed,
        pressedRow: fired.pressedRow,
        kind: fired.kind,
        legacy: fired.legacy,
        /* Off-screen readout: the light lands on the plate's gold hairline,
           and its ring opens behind the plate, around the words. */
        fallbackTarget: () => {
          const el = wordsRef.current;
          const plate = el?.getBoundingClientRect();
          if (el && plate && plate.width > 0) {
            el.dataset.landing = "plate";
            return { x: plate.left + plate.width / 2, y: plate.top };
          }
          return { x: window.innerWidth / 2, y: window.innerHeight - 120 };
        },
      });
    }
    const store = useLogMomentStore.getState();
    /* Sound follows the plan: what is drawn is what sounds. */
    const sound = useLogSoundStore.getState().enabled ? planLogSound(fired, plan) : null;
    const chime = sound?.arrival ?? null;
    if (sound?.impact) playLogSound(sound.impact);
    const ring = chime ? window.setTimeout(() => playLogSound(chime), plan.arrivalMs) : 0;
    const arrive = window.setTimeout(() => store.arrive(fired.id), plan.arrivalMs);
    const settle = window.setTimeout(() => store.settle(fired.id), plan.arrivalMs + plan.holdMs);
    return () => {
      window.clearTimeout(ring);
      window.clearTimeout(arrive);
      window.clearTimeout(settle);
    };
  }, [fired]);

  if (!mounted) return null;

  const plan = fired ? planLogMoment(fired, motionSetting) : null;
  const showWords = Boolean(fired && plan?.visible);
  const legacy = (fired ?? announcement)?.legacy === "meal";

  return createPortal(
    <>
      <p role="status" aria-live="polite" {...hooks("announcer", true)} className="sr-only">
        {announcement ? <span key={announcement.id}>{announcementText(announcement)}</span> : null}
      </p>
      <div
        ref={layerRef}
        aria-hidden="true"
        {...hooks("overlay", true)}
        data-motion={motionSetting}
        data-kind={fired?.kind ?? ""}
        data-legacy={legacy ? "meal" : ""}
        className="pointer-events-none fixed inset-0 z-[35] overflow-hidden"
      >
        {/* A plate replaced by a newer log leaves at once, so two never show
            together. `mode="wait"` makes that structural rather than a matter
            of timing: the outgoing plate is out of the DOM before the next one
            mounts, so a mark that becomes a milestone — a glass of water that
            reaches the day's target — can never show two plates for a frame. */}
        <AnimatePresence mode="wait" custom={Boolean(showWords)}>
          {showWords && fired && plan && (
            <MomentWords key={fired.id} moment={fired} plan={plan} arrived={arrived?.id === fired.id} wordsRef={wordsRef} />
          )}
        </AnimatePresence>
      </div>
    </>,
    document.body,
  );
}

const PLATE_GAP = 16;

type Box = { left: number; top: number; right: number; bottom: number };

function overlapArea(a: Box, b: Box, pad: number): number {
  const w = Math.min(a.right + pad, b.right) - Math.max(a.left - pad, b.left);
  const h = Math.min(a.bottom + pad, b.bottom) - Math.max(a.top - pad, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The controls a moment's plate must never cover: the row's own, its guard list, and anything tagged. */
function guardedSelector(moment: StagedLogMoment): string {
  const parts = ["[data-log-moment-guard]"];
  const { source, control, guard, fallbackSource } = moment.targets;
  if (source) parts.push(`${source} button`, `${source} input`, `${source} [role="slider"]`);
  if (source && control) parts.push(`${source} ${control}`);
  if (fallbackSource) parts.push(`${fallbackSource} button`);
  if (guard) parts.push(guard);
  return parts.join(", ");
}

/**
 * Centre the plate over <main>, above the shell's bottom stack. If that would
 * cover a guarded control, take the clear spot under the top bar instead
 * (whichever covers less, if neither is fully clear).
 */
function placePlate(el: HTMLDivElement | null, guarded: string, extra: Element | null, extraRow: Element | null) {
  if (!el) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const main = document.querySelector("main")?.getBoundingClientRect();
  const centre = main && main.width > 0 ? main.left + main.width / 2 : vw / 2;
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const half = width / 2;
  const x = Math.min(Math.max(centre, half + 8), vw - half - 8);

  const stack = document.querySelector('[data-shell="bottom-stack"]')?.getBoundingClientRect();
  const floor = stack && stack.height > 0 && stack.top < vh ? stack.top : vh;
  const header = Array.from(document.querySelectorAll("header"))
    .map((h) => h.getBoundingClientRect())
    .filter((r) => r.height > 0 && r.top <= 1 && r.bottom > 0)
    .reduce((max, r) => Math.max(max, r.bottom), 0);

  const lowTop = floor - PLATE_GAP - height;
  const highTop = header + PLATE_GAP;
  let found: HTMLElement[] = [];
  try {
    found = Array.from(document.querySelectorAll<HTMLElement>(guarded));
  } catch {
    found = [];
  }
  /* The control the member pressed, and the row it sits in. */
  if (extra instanceof HTMLElement && extra.isConnected) {
    found.push(extra);
    const row = extra.closest<HTMLElement>("[data-log-row]");
    if (row) found.push(row);
  }
  if (extraRow instanceof HTMLElement && extraRow.isConnected) found.push(extraRow);
  /* Only controls the member can actually see: not ones behind the top bar or the bottom stack. */
  const controls = found
    .map((c) => c.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0 && r.bottom > header && r.top < floor);
  const cover = (top: number) => {
    const plate = { left: x - half, right: x + half, top, bottom: top + height };
    return controls.reduce((sum, r) => sum + overlapArea(plate, r, 8), 0);
  };
  const low = cover(lowTop);
  const top = low === 0 ? lowTop : cover(highTop) < low ? highTop : lowTop;

  el.style.left = `${x}px`;
  el.style.top = `${Math.max(0, top)}px`;
  el.dataset.place = top === lowTop ? "low" : "high";
}

function MomentWords({
  moment,
  plan,
  arrived,
  wordsRef,
}: {
  moment: StagedLogMoment;
  plan: LogMomentPlan;
  arrived: boolean;
  wordsRef: React.RefObject<HTMLDivElement | null>;
}) {
  const animate = plan.animateWords;
  const log = moment.tone === "log";
  const landed = arrived || !plan.countUp;
  const delay = (ms: number) => ms / 1000;
  const plateRef = useRef<HTMLDivElement | null>(null);
  const legacy = moment.legacy === "meal";
  const mark = moment.tier === "mark";
  const guarded = guardedSelector(moment);

  /* Placed before paint, and again whenever the room scrolls or resizes
     beneath it, so a control scrolled under the plate is uncovered at once. */
  useLayoutEffect(() => {
    const place = () => placePlate(plateRef.current, guarded, moment.pressed, moment.pressedRow);
    place();
    document.addEventListener("scroll", place, { capture: true, passive: true });
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
    };
  }, [moment.id, moment.pressed, moment.pressedRow, guarded]);

  const hairline = log ? GOLD : "rgba(236,232,223,0.55)";
  /* The words come in with the light: a mark arrives almost at once. */
  const wordsAt = mark ? 80 : 220;
  const milestoneKey = moment.milestone?.key ?? "";
  const strongest = (moment.milestone?.intensity ?? 0) >= 1.7;

  return (
    <motion.div
      ref={(el: HTMLDivElement | null) => {
        wordsRef.current = el;
        plateRef.current = el;
      }}
      {...hooks("status", legacy)}
      data-kind={moment.kind}
      data-tier={moment.tier}
      data-tone={moment.tone}
      data-milestone={milestoneKey}
      className="group absolute z-[1] flex w-max min-w-[min(300px,calc(100vw-32px))] max-w-[calc(100vw-32px)] flex-col items-center overflow-hidden rounded-[16px] px-6 pb-3.5 pt-4 text-center sm:px-8"
      style={{
        x: "-50%",
        /* Near-opaque glass: whatever sits beneath is blurred past reading. */
        background: "linear-gradient(180deg, rgba(20,19,22,0.96) 0%, rgba(9,10,13,0.98) 100%)",
        backdropFilter: "blur(24px) saturate(1.1)",
        WebkitBackdropFilter: "blur(24px) saturate(1.1)",
        /* Hairline edge, then a soft dark feather so the room's text fades out
           around the plate instead of being sliced by its edge. */
        boxShadow: `inset 0 0 0 1px ${log ? "rgba(213,177,95,0.22)" : "rgba(236,232,223,0.12)"}, inset 0 1px 0 rgba(255,244,214,0.06), 0 2px 10px rgba(0,0,0,0.5), 0 0 56px 30px rgba(6,7,10,0.8)`,
      }}
      initial={animate ? { opacity: 0, y: 8, scale: 0.985 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      variants={{
        exit: (replaced: boolean) =>
          animate && !replaced ? { opacity: 0, y: 4, transition: { duration: 0.3, ease: "easeIn" } } : { opacity: 0, transition: { duration: 0 } },
      }}
      exit="exit"
      transition={{ delay: animate ? delay(wordsAt) : 0, duration: 0.28, ease: EASE }}
    >
      {/* The gold hairline along the plate's top edge; it draws out from the centre. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-5 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${hairline} 30%, ${hairline} 70%, transparent)` }}
        initial={animate ? { scaleX: 0 } : false}
        animate={{ scaleX: 1 }}
        transition={{ delay: animate ? delay(wordsAt + 40) : 0, duration: 0.5, ease: EASE }}
      />
      {/* When the light lands on the plate (the readout is off screen), the
          hairline flares once. Full motion only. */}
      {animate && arrived && plan.boom && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 hidden h-10 group-data-[landing=plate]:block">
          <motion.span
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse 50% 100% at 50% 0%, rgba(236,206,140,0.32), rgba(213,177,95,0.08) 55%, transparent 80%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.1, times: [0, 0.18, 1], ease: "easeOut" }}
          />
        </span>
      )}

      {moment.milestone && (
        <motion.p
          {...hooks("headline", legacy)}
          className="relative mb-2 font-display text-[22px] font-black uppercase leading-none tracking-[-0.01em] sm:text-[28px]"
          style={{ color: strongest ? GOLD : IVORY }}
          initial={animate ? { opacity: 0, scale: 1.08, letterSpacing: "0.12em", textShadow: `0 0 28px ${GOLD}` } : false}
          animate={{ opacity: 1, scale: 1, letterSpacing: "-0.01em", textShadow: `0 0 0px ${GOLD}00` }}
          transition={{ delay: animate ? delay(plan.arrivalMs + 60) : 0, duration: 0.6, ease: EASE }}
        >
          {moment.milestone.headline}
        </motion.p>
      )}

      <span className="relative flex min-w-0 max-w-full items-center gap-2">
        <svg viewBox="0 0 16 16" width="16" height="16" className="shrink-0" aria-hidden="true" data-log-moment="check">
          <motion.path
            d={log ? "M3 8.5 L6.5 12 L13 4.5" : "M3.5 8 L12.5 8"}
            fill="none"
            stroke={log ? GOLD : "rgba(236,232,223,0.7)"}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={animate ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ delay: animate ? delay(wordsAt + 100) : 0, duration: 0.34, ease: EASE }}
          />
        </svg>
        <span {...hooks("lead", legacy)} className="truncate text-[15px] font-semibold tracking-[0.01em] text-[#f2eee6] sm:text-[16px]">
          {moment.lead}
        </span>
      </span>

      {moment.detail.length > 0 && (
        <p {...hooks("detail", legacy)} className="tnum relative mt-1.5 max-w-full truncate whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.16em] text-white/70">
          {moment.detail.map((part, i) =>
            isFigure(part) ? (
              <ReserveLiveNumber
                key={i}
                value={landed ? part.value : part.from}
                decimals={part.decimals}
                replay={arrived && plan.countUp && part.from !== part.value ? { id: moment.id, from: part.from } : null}
                className="text-[#f2eee6]"
              />
            ) : (
              <Fragment key={i}>{part}</Fragment>
            ),
          )}
        </p>
      )}
    </motion.div>
  );
}
