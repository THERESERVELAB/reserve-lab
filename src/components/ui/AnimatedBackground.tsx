"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { useAthleteDashboardStore, type DashboardView } from "@/lib/athlete-store";
import { castRoomPlate, hasDaypartPlates, type Daypart } from "@/lib/brand/asset-manifest";
import type { MotionPreference } from "@/lib/cinematic/environments";
import {
  ROOM_CROSSFADE_MS,
  holdRoomLight,
  isLivingRoom,
  resolveDepthDrift,
  resolveLivingRoom,
  resolveRoomLight,
  type RoomLight,
} from "@/lib/cinematic/room-light";
import { resolveShellCinematic, taskStillsRoom } from "@/lib/cinematic/view-environment";
import { useAmbientMotionStore } from "@/lib/ui/ambient-motion-store";
import { useAmbientMotion } from "@/lib/ui/use-ambient-motion";
import { getShellScrollTop, isShellScrollEvent } from "@/lib/ui/shell-scroll";
import { buildRecoverySnapshot } from "@/lib/recovery/engine";
import { phoneLoopDataAllowed, type LoopConnection } from "@/lib/cinematic/loop-network";
import { LightFlowLayer } from "./reserve/light-flow";
import { ApexRotation } from "./ApexRotation";
import { ReserveEnvironment } from "./ReserveEnvironment";

/* ════════════════════════════════════════════════════════════════════════
   ANIMATED BACKGROUND — the one ambient system (Design Bible §09).
   Renders a different "weather" per destination so each command room feels
   like a distinct space inside the same OS — same brand, different
   atmosphere. The persistent base (void, grid, noise, vignette) never moves;
   only the room wash + motif change, and they fade in over ≥1s so the shift
   is felt, never announced. CSS-only, reduced-motion safe, GPU-cheap.

   THE LIVING ROOMS (Bible V1.2–V1.6). Apex, Training, Nutrition, Recovery and Schedule
   follow the member's day with three still readouts, never a loop
   (LIVING_ROOM_PROFILES in room-light.ts is the set):
     - daypart: dawn tints the day plate gold from screen-left (warmly in
       Nutrition, a little more at the Schedule planning desk, faintly in Recovery, the lowest
       light in the product); night serves the room's
       approved night plate where one exists. Both cross-fade over ≥1s.
     - room light: plate brightness follows readiness energy (§08 rule 5).
     - depth drift: plate and light shift 2–4px apart as the page scrolls.
       Off under reduced motion, while paused, and during a live session.
   Training during a live session is stilled outright by its cinematic
   contract: the light held when the session began stays on screen, so no
   daypart cross-fade, energy shift or tint change reaches the set being logged.
   ════════════════════════════════════════════════════════════════════════ */

type RoomKey =
  | "apex"
  | "training"
  | "nutrition"
  | "recovery"
  | "protocol"
  | "vault"
  | "clinical"
  | "studio"
  | "instrument"
  | "schedule"
  | "strategist"
  | "community"
  | "violet"
  | "neutral";

type RoomEnv = {
  /** Top-left ambient blob. */
  a: string;
  /** Bottom-right ambient blob. */
  b: string;
  /** Hero spotlight (top-center). */
  spot: string;
  /** Motif overlay rendered above the grid. */
  motif?: "radar" | "mech" | "hearth" | "dusk" | "scanlines" | "studio" | "instrument" | "document";
  /**
   * Visual asset manifest id. NOT a raw path — the manifest owns the focal
   * point, the required scrim, the ambient loop, and the APPROVED gates.
   *
   * This field used to be a raw `image` path, and that was a real defect:
   * the plate came from this map while the focal point came from the
   * cinematic config's view→environment map, which has no entry for
   * schedule, physique, progress-photos, peak-physique or community. Those
   * five rooms rendered their own plate anchored to the APEX plate's focal
   * point. One id now resolves the plate, its focal point and its loop, so
   * they cannot disagree again.
   */
  asset?: string;

  /**
   * A room cast from a PAIR of plates: `[preferred, fallback]`, resolved per
   * daypart by `castRoomPlate`. The two plates are the same room in the
   * product — the newer empty-room set and the plate it is replacing — and
   * the cast picks whichever one actually moves at this hour. They cannot be
   * resolved once at module scope like `asset`, because the answer depends on
   * the member's clock.
   */
  cast?: readonly [preferred: string, fallback: string];
};

/**
 * The plate a room renders at this hour. A cast room asks the manifest per
 * daypart; a fixed room is the same around the clock.
 *
 * Callers must gate this on `plateReady`, which holds a cast or clock-bound
 * room until the clock is known — resolving at "day" first and correcting on
 * the next tick would announce the change as a visible swap.
 */
function roomAsset(env: RoomEnv, daypart: Daypart | undefined): string | undefined {
  if (!env.cast) return env.asset;
  return castRoomPlate(env.cast[0], env.cast[1], daypart ?? "day");
}

/* Each room's palette lead + motif. Colors stay inside the Bible palette:
   gold #d5b15f · amber #e8c87a · steel #5fb7d5 · green #6ee7b7 · violet #a78bfa.

   `asset` is the casting: which registered plate this room renders. Owner
   direction 2026-09-17 cast the five living rooms onto the empty-room set
   (command-room, training-floor, chef-kitchen, recovery-suite,
   penthouse-study) — but the rooms must keep moving, and a loop's first
   frame is its own plate. So each room is cast through `castRoomPlate`: the
   new plate the moment it carries an APPROVED clip of its own, and until then
   the previous plate (apex-command, training-command, nutrition-command,
   recovery-chamber, schedule-command) with its approved loop. Approving a
   clip in the manifest is what flips a room; nothing here changes.

   From 2026-09-24 the cast is asked PER DAYPART and so cannot be resolved
   here — the pair is recorded and `roomAsset` resolves it against the
   member's clock. The empty-room set carries the night clips and the older
   plates carry the day clips, so a room that would otherwise freeze after
   dark is cast to whichever of its two plates moves at this hour. */
const ROOM_ENV: Record<RoomKey, RoomEnv> = {
  apex:       { a: "rgba(213,177,95,0.13)", b: "rgba(95,183,213,0.07)", spot: "rgba(213,177,95,0.07)", motif: "radar", cast: ["command-room", "apex-command"] },
  training:   { a: "rgba(213,177,95,0.10)", b: "rgba(95,183,213,0.09)", spot: "rgba(213,177,95,0.06)", motif: "mech", cast: ["training-floor", "training-command"] },
  nutrition:  { a: "rgba(232,200,122,0.10)", b: "rgba(110,231,183,0.08)", spot: "rgba(232,200,122,0.05)", motif: "hearth", cast: ["chef-kitchen", "nutrition-command"] },
  recovery:   { a: "rgba(167,139,250,0.10)", b: "rgba(95,183,213,0.09)", spot: "rgba(167,139,250,0.05)", motif: "dusk", cast: ["recovery-suite", "recovery-chamber"] },
  protocol:   { a: "rgba(213,177,95,0.11)", b: "rgba(142,160,184,0.05)", spot: "rgba(213,177,95,0.05)", motif: "document" },
  /* Compound Command and Enhanced Monitor. Plateless until 2026-09-24: the
     wellness suite was generated for this room in 2026-09-18 but was delivered
     at 1280×720 with no still to open on, so it sat in the library unusable
     while the room rendered on the void. The 1920×1080 take has its own plate
     and its own clip, so the room finally exists. 16:9 only — a phone holds
     the still until a 9:16 composition of it is cut. */
  vault:      { a: "rgba(95,183,213,0.07)", b: "rgba(95,183,213,0.05)", spot: "rgba(95,183,213,0.04)", motif: "scanlines", asset: "compound-suite" },
  clinical:   { a: "rgba(95,183,213,0.08)", b: "rgba(142,160,184,0.05)", spot: "rgba(95,183,213,0.04)", motif: "scanlines", asset: "biomarkers-lab" },
  studio:     { a: "rgba(236,232,223,0.05)", b: "rgba(213,177,95,0.05)", spot: "rgba(236,232,223,0.05)", motif: "studio", asset: "physique-scanner" },
  instrument: { a: "rgba(142,160,184,0.06)", b: "rgba(95,183,213,0.05)", spot: "rgba(142,160,184,0.04)", motif: "instrument" },
  schedule:   { a: "rgba(213,177,95,0.09)", b: "rgba(95,183,213,0.07)", spot: "rgba(213,177,95,0.05)", cast: ["penthouse-study", "schedule-command"] },
  strategist: { a: "rgba(167,139,250,0.09)", b: "rgba(95,183,213,0.06)", spot: "rgba(167,139,250,0.05)", motif: "radar", asset: "intelligence-command" },
  community:  { a: "rgba(213,177,95,0.08)", b: "rgba(167,139,250,0.05)", spot: "rgba(213,177,95,0.05)", asset: "entrance-gallery" },
  violet:     { a: "rgba(167,139,250,0.11)", b: "rgba(95,183,213,0.07)", spot: "rgba(167,139,250,0.05)", motif: "dusk" },
  neutral:    { a: "rgba(213,177,95,0.11)", b: "rgba(95,183,213,0.07)", spot: "rgba(213,177,95,0.055)" },
};

const VIEW_ROOM: Partial<Record<DashboardView, RoomKey>> = {
  dashboard: "apex",
  training: "training",
  "mesocycle-planner": "training",
  "performance-intelligence": "training",
  nutrition: "nutrition",
  recovery: "recovery",
  "protocol-command": "protocol",
  supplements: "vault",
  "enhanced-monitor": "vault",
  bloodwork: "clinical",
  "biomarker-intelligence": "clinical",
  measurements: "instrument",
  "progress-photos": "studio",
  physique: "studio",
  "physique-intelligence": "studio",
  "peak-physique": "studio",
  "schedule-command": "schedule",
  "ai-strategist": "strategist",
  community: "community",
  /* Reserve Women — map by domain so the atmosphere still reads as a room. */
  "womens-cycle": "violet",
  "womens-fertility": "violet",
  "womens-pregnancy": "violet",
};

/** Bible §09 Morning: low warm dawn from screen-left, gold ramping up. */
const DAWN_TINT =
  "radial-gradient(120% 90% at 0% 30%, rgba(232,200,122,0.11) 0%, rgba(213,177,95,0.045) 42%, transparent 72%)";

function Motif({ kind, animate }: { kind: NonNullable<RoomEnv["motif"]>; animate: boolean }) {
  switch (kind) {
    case "radar":
      return (
        <div
          className={`${animate ? "fba-orbit-breath " : ""}absolute left-1/2 top-[-120px] h-[760px] w-[760px] -translate-x-1/2`}
          style={{
            background:
              "repeating-radial-gradient(circle at center, transparent 0 78px, rgba(213,177,95,0.05) 78px 79px, transparent 79px 158px)",
            maskImage: "radial-gradient(circle at center, #000 0%, transparent 62%)",
            WebkitMaskImage: "radial-gradient(circle at center, #000 0%, transparent 62%)",
          }}
        />
      );
    case "mech":
      return <div className={`${animate ? "fba-mech-lines " : ""}absolute inset-0 opacity-90`} />;
    case "instrument":
      return <div className={`${animate ? "fba-fine-grid " : ""}absolute inset-0 opacity-80`} />;
    case "scanlines":
      return <div className={`${animate ? "fba-scanlines " : ""}absolute inset-0 opacity-90`} />;
    case "hearth":
      return (
        <div
          className="absolute inset-x-0 bottom-[-120px] h-[440px]"
          style={{ background: "radial-gradient(ellipse at bottom, rgba(232,200,122,0.07) 0%, transparent 70%)", filter: "blur(40px)" }}
        />
      );
    case "dusk":
      return (
        <div
          className="absolute inset-x-0 top-0 h-[420px]"
          style={{ background: "radial-gradient(ellipse at top, rgba(167,139,250,0.08) 0%, transparent 72%)", filter: "blur(46px)" }}
        />
      );
    case "studio":
      return (
        <div
          className="absolute left-1/2 top-[8%] h-[540px] w-[760px] -translate-x-1/2"
          style={{ background: "radial-gradient(ellipse at center, rgba(236,232,223,0.055) 0%, transparent 64%)", filter: "blur(38px)" }}
        />
      );
    case "document":
      return (
        <div
          className="absolute inset-y-0 left-0 w-[58%]"
          style={{ background: "linear-gradient(105deg, rgba(213,177,95,0.05) 0%, transparent 64%)", filter: "blur(30px)" }}
        />
      );
    default:
      return null;
  }
}

/* ─── Environment conditions ──────────────────────────────────────────────
   Viewport, motion preference and low-power are read from the platform, not
   guessed. Each listens for change so the shell re-quiets without a reload.

   `measured` stays false until the first real read. The defaults below are
   only what the server can render with, and a loop must never start on a
   default: a phone would be handed the desktop loop, and a reduced-motion or
   save-data viewer a download, before the truth arrived. */
function useEnvironmentConditions() {
  const [conditions, setConditions] = useState({
    viewport: "desktop" as "desktop" | "mobile",
    motionPreference: "full" as MotionPreference,
    lowPower: false,
    offscreen: false,
    measured: false,
  });

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Safari/Chrome expose a data-saver hint; absent elsewhere, which is fine.
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection;

    const sync = () =>
      setConditions({
        viewport: mobile.matches ? "mobile" : "desktop",
        motionPreference: reduced.matches ? "reduced" : "full",
        lowPower: Boolean(connection?.saveData),
        offscreen: document.visibilityState === "hidden",
        measured: true,
      });

    sync();
    mobile.addEventListener("change", sync);
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    /* A matchMedia change event is not guaranteed for every viewport change
       (programmatic metric overrides and some mobile chrome resizes do not
       emit one), which left the desktop composition on a phone-width screen
       until a reload. `resize` closes that gap. */
    window.addEventListener("resize", sync);
    return () => {
      mobile.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return conditions;
}

/* ─── Room clock ──────────────────────────────────────────────────────────
   The living room reads the wall clock once a minute, aligned to the minute,
   and only while it is on screen. Null until the client knows the time: the
   server cannot know the member's daypart. setTimeout, never rAF — rAF
   suspends in background and headless tabs. */
function useMinuteClock(enabled: boolean): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const boot = setTimeout(() => setNow(new Date()), 0);
    const toNextMinute = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds() + 50;
    const align = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, Math.max(250, toNextMinute));
    return () => {
      clearTimeout(boot);
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, [enabled]);

  return enabled ? now : null;
}

export function AnimatedBackground() {
  const activeView = useAthleteDashboardStore((s) => s.activeView);
  const sessionMode = useAthleteDashboardStore((s) => s.trainingSession.sessionMode);
  const wakeTime = useAthleteDashboardStore((s) => s.scheduleProfile?.wakeTime);
  const sleepTarget = useAthleteDashboardStore((s) => s.scheduleProfile?.sleepTarget);
  const recovery = useAthleteDashboardStore((s) => s.recoveryCommand);
  const room: RoomKey = VIEW_ROOM[activeView] ?? "neutral";
  const env = ROOM_ENV[room];

  const { measured, ...conditions } = useEnvironmentConditions();
  const liveSession = sessionMode === "live";
  const reducedMotion = conditions.motionPreference === "reduced";

  /* ── The living room's clock ──────────────────────────────────────────
     The clock is read FIRST, because from 2026-09-24 it chooses the plate: a
     cast room renders whichever of its two plates moves at this hour, and the
     cinematic decision below has to be made for the plate that wins. */
  const livingRoom = isLivingRoom(room);
  /* A plate with daypart variants depends on the clock, so it waits for it:
     painting the day plate first and then fading to night on every evening
     load would announce the change the Bible says must only be felt. A cast
     room is clock-bound if EITHER of its plates is. */
  const clockBound = env.cast
    ? env.cast.some((id) => hasDaypartPlates(id))
    : env.asset
      ? hasDaypartPlates(env.asset)
      : false;
  const now = useMinuteClock(livingRoom || clockBound);

  const currentLight = useMemo<RoomLight | null>(() => {
    if (!now) return null;
    const snapshot = livingRoom ? buildRecoverySnapshot(recovery, now) : null;
    return resolveRoomLight({
      now,
      schedule: { wakeTime, sleepTarget },
      readiness: snapshot?.hasData ? snapshot.reserve : null,
    });
  }, [now, livingRoom, recovery, wakeTime, sleepTarget]);

  /* A room its contract stills during a live session (Training) holds the
     light it had when the session began. Adjusted during render, not in an
     effect, so no frame ever shows the light it is holding back.

     Asked through `taskStillsRoom` rather than through the full decision
     below: that decision needs the plate, the plate needs the daypart, and the
     daypart is carried by this light. The question depends only on the view
     and the session, so asking it on its own breaks the cycle. */
  const stilledByTask = taskStillsRoom(activeView, liveSession);
  const [heldLight, setHeldLight] = useState<RoomLight | null>(null);
  const light = holdRoomLight(heldLight, currentLight, stilledByTask);
  const nextHeld = stilledByTask ? light : null;
  if (nextHeld !== heldLight) setHeldLight(nextHeld);

  /* The plate this room renders at this hour. Held back by `plateReady` below
     until the clock is in, so a cast room never paints its day plate and then
     corrects itself. */
  const asset = roomAsset(env, light?.daypart);

  /* The cinematic contract decides focal point, plate opacity, whether
     decorative motion runs, and whether the room's loop plays. Logging sets
     is the case that matters most: the background dims and stops moving so
     nothing competes with the set. The loop is resolved from the SAME asset
     id AND the same daypart the plate below is drawn from — a decision made
     for another hour would name another hour's file, and the renderer refuses
     a decision that does not name the loop it would mount. */
  const cinematicInput = {
    view: activeView,
    assetId: asset ?? null,
    daypart: light?.daypart ?? "day",
    liveSessionActive: liveSession,
    ...conditions,
  };
  /* The member's pause (WCAG 2.2.2) resolves exactly like a static motion
     preference: no loop, no decorative drift, the still plate stays. Whether
     anything WOULD move is read from the unpaused decision, so the top bar's
     control only appears when it does something. */
  const motionPaused = useAmbientMotionStore((s) => s.paused);
  const setMotionAvailable = useAmbientMotionStore((s) => s.setAvailable);
  /* The one motion gate: "static" (the pause, or a hidden tab) stills every
     room's loop and drift; reduced motion reaches the loop through
     `conditions`, measured on the client. */
  const ambientMotion = useAmbientMotion();
  const unpaused = resolveShellCinematic(cinematicInput);
  const cinematic = ambientMotion === "static"
    ? resolveShellCinematic({ ...cinematicInput, motionPreference: "static" })
    : unpaused;
  const motionAvailable = measured && (unpaused.animate || unpaused.playback.playVideo);

  useEffect(() => {
    void useAmbientMotionStore.persist.rehydrate();
  }, []);
  useEffect(() => {
    setMotionAvailable(motionAvailable);
  }, [motionAvailable, setMotionAvailable]);

  /* Awake light (globals.css): the shell's ambient loops run only while this
     room animates AND the one motion gate is "full" — so the member's pause,
     reduced motion and a hidden tab each stop them, and the pause control is
     on screen whenever they could run (motionAvailable above). */
  const ambientLive = measured && cinematic.animate && ambientMotion === "full";
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.ambient = ambientLive ? "live" : ambientMotion;
    return () => {
      delete root.dataset.ambient;
    };
  }, [ambientLive, ambientMotion]);

  /* ── The living room ─────────────────────────────────────────────────── */
  const living = resolveLivingRoom({ room, light, measured, reducedMotion, motionPaused, liveSession });
  /* No plate before the viewport is measured: the server default is desktop,
     and a phone must never download the 16:9 plate before its 9:16 one. */
  const plateReady = measured && (!clockBound || light !== null);
  /* Readiness still sets the room's light, over a narrower band (0.82–1):
     the owner could barely see the loop at the old 0.55–0.6 floor. */
  const energy = 0.6 + 0.4 * living.energy;

  /* Depth drift writes two custom properties straight onto this element:
     scrolling never re-renders React, and the plate never animates itself. */
  const rootRef = useRef<HTMLDivElement>(null);
  const drift = living.drift;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    /* Scroll-linked work is two custom-property writes, and only when a value
       actually changes: the drift is clamped, so past its range a scroll
       writes nothing and restyles nothing. The layers move by transform alone
       (compositor only); nothing here reads layout or touches the loop. */
    let last = "";
    const apply = (scrollTop: number) => {
      const offset = resolveDepthDrift({ scrollTop, reducedMotion: !drift, liveSession: false });
      const next = `${offset.platePx}|${offset.lightPx}`;
      if (next === last) return;
      last = next;
      root.style.setProperty("--fba-drift-plate", `${offset.platePx}px`);
      root.style.setProperty("--fba-drift-light", `${offset.lightPx}px`);
    };
    if (!drift) {
      apply(0);
      return;
    }
    /* Phones scroll the document; from md up the shell scrolls <main>.
       Element scroll events do not bubble, but they do pass through a
       capturing listener on the document, which also hears the document's
       own scroll. */
    apply(getShellScrollTop());
    const onScroll = (event: Event) => {
      if (isShellScrollEvent(event)) apply(getShellScrollTop());
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [drift]);

  const driftStyle = (property: string): CSSProperties | undefined =>
    drift ? { transform: `translate3d(0, var(${property}, 0px), 0)`, willChange: "transform" } : undefined;

  return (
    /* Fixed to the screen: on phones the document scrolls, and the room must
       stay put behind it rather than scroll away with the page. Sized to the
       LARGE viewport (lvh), so a phone's collapsing URL bar never resizes the
       layer and never re-lays-out the plate or the loop mid-scroll; `contain`
       keeps anything inside from invalidating the page's layout. */
    <div
      ref={rootRef}
      data-ambient-layer="room"
      className="pointer-events-none fixed inset-x-0 top-0 h-lvh overflow-hidden [contain:strict]"
      aria-hidden="true"
    >
      {/* ── Persistent base: the void never moves ── */}
      <div className="absolute inset-0 bg-[#07080c]" />

      {/* ── Room wash: rises in over the base on every destination change ── */}
      <div key={room} className={`${cinematic.animate ? "fba-room-in " : ""}absolute inset-0`}>
        {/* Cinematic environment plate. One renderer, one manifest: the asset
            id resolves the source, the viewport-specific focal point, the
            scrim and the loop together, so the crop can never be anchored to
            a different plate's composition.

            `priority` — exactly one plate is visible at a time and it is the
            largest paint on the screen, so it must not be lazy-loaded into
            the LCP.

            The wrapper overhangs 8px top and bottom so depth drift never
            uncovers an edge. A clock-bound plate mounts after hydration and
            rises in like the room itself. */}
        {asset && plateReady && (
          <div
            className={`${clockBound && cinematic.animate ? "fba-room-in " : ""}absolute inset-x-0 -top-2 -bottom-8`}
            style={driftStyle("--fba-drift-plate")}
          >
            <ReserveEnvironment
              assetId={asset}
              viewport={conditions.viewport}
              /* Room light: the plate is as bright as the member is ready. */
              opacity={cinematic.plateQuieting * energy}
              /* Withheld until the conditions are measured (see
                 useEnvironmentConditions). The renderer still mounts a loop only
                 when this plays AND the manifest approves one. */
              playback={measured ? cinematic.playback : undefined}
              daypart={light?.daypart}
              priority
              motionOverlay={
                room === "apex" ? (
                  <ApexRotation
                    /* The room's own playback decision: the pause, reduced
                       motion, Save-Data, a hidden tab and a live session all
                       keep Apex on its room. A phone also needs a connection
                       fast enough for its loops. */
                    active={
                      measured &&
                      cinematic.playback.playVideo &&
                      (conditions.viewport === "desktop" ||
                        phoneLoopDataAllowed((navigator as Navigator & { connection?: LoopConnection }).connection))
                    }
                    viewport={conditions.viewport}
                  />
                ) : null
              }
            />
            {living.living && (
              <div
                className="absolute inset-0"
                style={{
                  background: DAWN_TINT,
                  opacity: living.dawnTintOpacity,
                  transition: `opacity ${ROOM_CROSSFADE_MS}ms ease`,
                }}
              />
            )}
          </div>
        )}
        <div className="absolute inset-0" style={driftStyle("--fba-drift-light")}>
          {/* Lead ambient blob — top-left */}
          <div
            className={cinematic.animate ? "fba-ambient-a absolute" : "absolute"}
            style={{
              top: "-200px",
              left: "-150px",
              width: "700px",
              height: "500px",
              background: `radial-gradient(ellipse at center, ${env.a} 0%, transparent 68%)`,
              filter: "blur(48px)",
            }}
          />
          {/* Counter ambient blob — bottom-right */}
          <div
            className={cinematic.animate ? "fba-ambient-b absolute" : "absolute"}
            style={{
              bottom: "-180px",
              right: "-200px",
              width: "600px",
              height: "450px",
              background: `radial-gradient(ellipse at center, ${env.b} 0%, transparent 65%)`,
              filter: "blur(56px)",
            }}
          />
          {/* Hero spotlight — top-center. Breathes slowly while ambient motion is live. */}
          <div
            className="fba-room-breath absolute"
            style={{
              top: "-80px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "900px",
              height: "400px",
              background: `radial-gradient(ellipse at top, ${env.spot} 0%, transparent 60%)`,
              filter: "blur(32px)",
            }}
          />
          {/* Room motif — the signature texture of this space */}
          {env.motif && <Motif kind={env.motif} animate={cinematic.animate} />}
        </div>
      </div>

      {/* Dot grid */}
      <div className="fba-grid absolute inset-0 opacity-100" />

      {/* ── Light flow ──────────────────────────────────────────────────
          The room's own light: a traveller running one seam at a time, over
          a far horizon. Behind the dots and under the noise, so it reads as
          light INSIDE the room rather than an overlay on it. The layer decides
          for itself whether anything may move (lib/ui/light-flow) and draws
          nothing at all while the screen is still settling, during a live
          session, at night, or under reduced or paused motion. */}
      {measured && (
        <LightFlowLayer
          /* Keyed by room: a new room starts its own settle rather than
             inheriting the light of the one before it. Namespaced, because
             the room wash above is a SIBLING keyed by the bare room: two
             siblings sharing a key leave React free to keep the old room's
             wash — and the loops inside it — mounted after the member leaves. */
          key={`light-flow:${room}`}
          room={room}
          motion={ambientMotion}
          daypart={light?.daypart ?? null}
          liveSession={liveSession}
          energy={energy}
          phone={conditions.viewport === "mobile"}
        />
      )}

      {/* Noise */}
      <div className="fba-noise absolute inset-0" />

      {/* Vignette — darkens edges */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(3,4,8,0.55) 100%)",
        }}
      />
    </div>
  );
}
