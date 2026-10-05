"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { Daypart } from "@/lib/brand/asset-manifest";
import type { AmbientMotion } from "@/lib/ui/ambient-motion";
import {
  HORIZON_ALPHA,
  LIGHT_FLOW_SETTLE_MS,
  horizonGeometry,
  litSeams,
  passCycleMs,
  passDelayMs,
  passStrokes,
  paletteForRoom,
  resolveLightFlow,
  rgba,
  seamPaths,
  type LightRect,
  type LightSeam,
} from "@/lib/ui/light-flow";
import { getShellScrollTop, isShellScrollEvent } from "@/lib/ui/shell-scroll";

import { LightFlowSurge } from "./LightFlowSurge";

/* ════════════════════════════════════════════════════════════════════════
   LIGHT FLOW LAYER — the renderer.

   One <svg> inside the room layer, behind every surface, taking no clicks.
   It draws exactly two things:

     the far horizon   a still perspective grid on dark ground, dissolving
                       toward the viewer, breathing once every 20s
     the seams         the hero's own edge, the right frame, the horizon
                       rail — each carrying at most one traveller at a time

   Every decision comes from `src/lib/ui/light-flow.ts`; this file only
   carries it out. There is no frame loop here and no canvas: the movement is
   a CSS keyframe on `stroke-dashoffset` (Bible §08 rule 1), and geometry is
   resolved only when the viewport, the room or the hero changes.

   NOTHING IS DRAWN ON ARRIVAL. The layer stays unmounted for the screen's
   first 1.6s, so a room reads as still when it settles; the first pass waits
   longer still.
   ════════════════════════════════════════════════════════════════════════ */

export type LightFlowLayerProps = {
  /** The ambient layer's own room key. */
  room: string;
  /** The one motion gate. */
  motion: AmbientMotion;
  /** The member's daypart, or null before the client knows the clock. */
  daypart: Daypart | null;
  /** A live training session is running. */
  liveSession: boolean;
  /** Readiness energy (§08 rule 5). */
  energy: number;
  /** The measured viewport class. */
  phone: boolean;
};

/* ─── Device ──────────────────────────────────────────────────────────────
   Read once, on the client, and never again: a low-end device carries one
   seam and a still horizon for as long as it is on this page. The server
   snapshot says nothing is known, which resolves to the safe default. */
type Device = { cores: number; saveData: boolean };

const SERVER_DEVICE: Device = { cores: 0, saveData: false };
const subscribeToNothing = () => () => undefined;
let measuredDevice: Device | null = null;

function readDevice(): Device {
  if (!measuredDevice) {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    measuredDevice = {
      cores: typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : 0,
      saveData: Boolean(connection?.saveData),
    };
  }
  return measuredDevice;
}

function useDevice(): Device {
  return useSyncExternalStore(subscribeToNothing, readDevice, () => SERVER_DEVICE);
}

/**
 * The screen has been on long enough to have settled.
 *
 * The layer is keyed by room, so arriving in a room mounts this fresh and the
 * wait starts again — no reset to write, and no frame in which a new room
 * inherits the last one's light.
 */
function useSettled(): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), LIGHT_FLOW_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return settled;
}

type Size = { width: number; height: number };

/**
 * How long the layer keeps looking for a usable measurement after it mounts.
 *
 * A room's hero can arrive after the layer does — a slow first compile, a
 * late state, a font that resizes the statement — and the layer's own box can
 * read zero for the frame it is inserted in. A ResizeObserver reports
 * CHANGES, and a fixed full-viewport layer never changes size again, so a
 * single bad first reading would otherwise be permanent: the room would sit
 * at "settling" with no light for the life of the page. These few looks cost
 * nothing and close that door.
 */
const MEASURE_RETRY_MS = [0, 120, 320, 720, 1500, 3000] as const;

/** The hero block a seam traces, in the layer's own coordinates. */
function heroRect(root: HTMLElement, node: HTMLElement | null, size: Size): LightRect | null {
  if (!node || size.width === 0) return null;
  const rect = node.getBoundingClientRect();
  if (rect.width < 40 || rect.height < 20) return null;
  /* The layer is fixed at the viewport origin; a box that has not been laid
     out yet reads zero, and zero is the right offset for it. */
  const box = root.getBoundingClientRect();
  const left = box.width > 0 ? box.left : 0;
  const top = box.width > 0 ? box.top : 0;
  /* The seam runs just outside the statement's left edge and then out along
     its foot to the far side of the page — the rail the room's own hero sits
     on, not the outline of its glyphs. */
  const page = node.closest(".fba-page") ?? node.closest("main");
  const right = page ? page.getBoundingClientRect().right : rect.right;
  const x = Math.max(4, rect.left - left - 14);
  return {
    x,
    y: rect.top - top,
    width: Math.max(rect.width + 14, right - left - x),
    /* A phone steps the statement down to a single 22px title line
       (typography.md: no second hero). The block the seam traces is the
       hero's own clearance, not its cap height, so it keeps a lead-in worth
       travelling even there. */
    height: Math.max(rect.height + 12, 48),
  };
}

/**
 * The layer's own box and the hero inside it.
 *
 * Measured on mount, on every viewport change, and on a short schedule of
 * looks afterwards — never on a frame, and never on scroll. Measuring is NOT
 * gated on the settle: the settle decides when light may be drawn, not when
 * the room may be looked at, and gating both on it made one early reading
 * final.
 *
 * The hero seam is drawn only while the room is at its top, because a fixed
 * layer cannot follow a block that has scrolled away: rather than let the
 * light drift off the edge it was tracing, the seam goes dark until the
 * member comes back to the top.
 */
function useGeometry() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [hero, setHero] = useState<LightRect | null>(null);
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const doc = root.ownerDocument;
    const view = doc.defaultView;
    if (!view) return;

    /* The room's ONE h1 is its statement (the Bible allows a room no second
       hero), so it is the block the seam traces. `[data-room-statement]` is
       not interchangeable with it: some rooms tag a line inside a panel with
       it, and a seam behind a panel is a seam nobody sees. */
    const heroNode = () =>
      doc.querySelector<HTMLElement>("main h1") ?? doc.querySelector<HTMLElement>("[data-room-statement]");

    /* The layer is a fixed, full-viewport box, so the viewport is a truthful
       reading of it whenever its own box has not been laid out yet. */
    const readSize = (): Size => {
      const box = root.getBoundingClientRect();
      return box.width > 0 && box.height > 0
        ? { width: Math.round(box.width), height: Math.round(box.height) }
        : { width: Math.round(view.innerWidth), height: Math.round(view.innerHeight) };
    };

    let observed: HTMLElement | null = null;
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);

    /** One look. True once there is something worth drawing. */
    const measure = (): boolean => {
      const next = readSize();
      setSize((current) => (current.width === next.width && current.height === next.height ? current : next));
      const node = heroNode();
      if (node !== observed) {
        if (observed) observer.unobserve(observed);
        observed = node;
        if (node) observer.observe(node);
      }
      const rect = heroRect(root, node, next);
      setHero((current) =>
        current && rect && current.x === rect.x && current.y === rect.y && current.width === rect.width && current.height === rect.height
          ? current
          : rect,
      );
      return next.width > 0 && rect !== null;
    };

    /* A few looks, stopping as soon as one lands. */
    const timers: number[] = [];
    let index = 0;
    const look = () => {
      if (measure() || index >= MEASURE_RETRY_MS.length) return;
      const wait = MEASURE_RETRY_MS[index];
      index += 1;
      timers.push(view.setTimeout(look, wait));
    };
    look();

    /* matchMedia and a ResizeObserver do not fire for every viewport change
       (programmatic metric overrides and some mobile chrome resizes are
       silent), which is why the plate renderer listens for this too. */
    const onResize = () => measure();
    view.addEventListener("resize", onResize);

    /* Scroll changes one boolean and nothing else: no geometry, no layout
       write, and at most one render per excursion past the threshold. */
    const syncTop = () => {
      const top = getShellScrollTop() < 48;
      setAtTop((current) => (current === top ? current : top));
    };
    syncTop();
    const onScroll = (event: Event) => {
      if (isShellScrollEvent(event)) syncTop();
    };
    doc.addEventListener("scroll", onScroll, { capture: true, passive: true });

    return () => {
      observer.disconnect();
      for (const timer of timers) view.clearTimeout(timer);
      view.removeEventListener("resize", onResize);
      doc.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, []);

  return { rootRef, size, hero: atTop ? hero : null };
}

/* ─── The pass ────────────────────────────────────────────────────────────
   Three strokes sharing one leading edge: the ivory core, the accent body,
   and the tail falling away behind them. */

function Pass({
  seam,
  color,
  core,
  alpha,
  restMs,
  index,
}: {
  seam: LightSeam;
  color: string;
  core: string;
  alpha: number;
  restMs: number;
  index: number;
}) {
  const strokes = passStrokes(seam.length);
  const cycle = passCycleMs(restMs);
  const delay = passDelayMs(index, restMs);
  return (
    <g data-light-flow-seam={seam.id}>
      {strokes.map((stroke, i) => (
        <path
          key={`${stroke.role}-${i}`}
          className="fba-lf-pass"
          data-light-flow-stroke={stroke.role}
          d={seam.d}
          fill="none"
          /* The head's core is ivory and nothing else; the bloom around it and
             everything falling behind it are the room's own accent. */
          stroke={rgba(stroke.role === "core" ? core : color, stroke.alpha * alpha)}
          strokeWidth={stroke.width}
          strokeLinecap="round"
          strokeDasharray={`${stroke.dash} ${seam.length + stroke.dash}`}
          style={
            {
              "--lf-from": `${stroke.from}px`,
              "--lf-to": `${stroke.to}px`,
              "--lf-cycle": `${cycle}ms`,
              "--lf-delay": `${delay}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </g>
  );
}

/* ─── The far horizon ─────────────────────────────────────────────────── */

function Horizon({
  size,
  phone,
  color,
  alpha,
  breath,
  maskId,
  lineId,
}: {
  size: Size;
  phone: boolean;
  color: string;
  alpha: number;
  breath: boolean;
  maskId: string;
  lineId: string;
}) {
  const geometry = useMemo(
    () => horizonGeometry({ width: size.width, height: size.height, phone }),
    [size.width, size.height, phone],
  );
  return (
    <g className={breath ? "fba-lf-breath" : undefined} data-light-flow-part="horizon">
      <defs>
        {/* The grid dissolves toward the viewer — brightest at the line, gone
            long before it reaches the content below (§06: never a trapped
            gradient, never a hard edge). */}
        <linearGradient id={maskId} x1="0" y1={geometry.y} x2="0" y2={size.height} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${maskId}-m`}>
          <rect x="0" y={geometry.y} width={size.width} height={size.height - geometry.y} fill={`url(#${maskId})`} />
        </mask>
        {/* The line itself feathers out at both edges of the screen. */}
        <linearGradient id={lineId} x1="0" y1="0" x2={size.width} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={color} stopOpacity="0" />
          <stop offset="0.5" stopColor={color} stopOpacity="1" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <g mask={`url(#${maskId}-m)`}>
        {geometry.lanes.map((d, i) => (
          <path key={`lane-${i}`} d={d} fill="none" stroke={rgba(color, HORIZON_ALPHA.lane * alpha)} strokeWidth="1" />
        ))}
        {geometry.rows.map((d, i) => (
          <path key={`row-${i}`} d={d} fill="none" stroke={rgba(color, HORIZON_ALPHA.row * alpha)} strokeWidth="1" />
        ))}
      </g>
      <path
        d={`M0 ${geometry.y} L${size.width} ${geometry.y}`}
        fill="none"
        stroke={`url(#${lineId})`}
        strokeWidth="1"
        opacity={HORIZON_ALPHA.line * alpha}
      />
    </g>
  );
}

/* ─── The layer ───────────────────────────────────────────────────────── */

export function LightFlowLayer({ room, motion, daypart, liveSession, energy, phone }: LightFlowLayerProps) {
  const device = useDevice();
  const settled = useSettled();
  const { rootRef, size, hero } = useGeometry();
  const [boom, setBoom] = useState(false);
  const ids = useId().replace(/[^a-zA-Z0-9-]/g, "");

  const plan = resolveLightFlow({
    motion,
    room,
    daypart,
    liveSession,
    logMomentBoom: boom,
    settled: settled && size.width > 0 && size.height > 0,
    viewportWidth: size.width || 0,
    energy,
    cores: device.cores,
    saveData: device.saveData,
  });

  /* Published for the shell's own tests and for anything that needs to know
     why the room is dark. One attribute, written only when it changes. */
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.lightFlow = plan.reason;
    return () => {
      delete root.dataset.lightFlow;
    };
  }, [plan.reason]);

  const palette = paletteForRoom(room);
  const seams = useMemo(
    () => (plan.active ? seamPaths({ width: size.width, height: size.height, phone, hero }) : []),
    [plan.active, size.width, size.height, phone, hero],
  );
  const lit = litSeams(seams, plan);
  const heroSeam = seams.find((seam) => seam.id === "hero") ?? null;

  return (
    <div ref={rootRef} className="absolute inset-0" aria-hidden="true">
      {plan.active && size.width > 0 && (
        <svg
          data-light-flow="layer"
          className="fba-lf absolute inset-0"
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          fill="none"
          focusable="false"
          aria-hidden="true"
        >
          {plan.horizon && (
            <Horizon
              size={size}
              phone={phone}
              color={palette.cold}
              alpha={plan.alpha}
              breath={plan.breath}
              maskId={`lf-fade-${ids}`}
              lineId={`lf-line-${ids}`}
            />
          )}
          {lit.map((seam, index) => (
            <Pass
              key={seam.id}
              seam={seam}
              index={index}
              color={seam.tone === "warm" ? palette.warm : palette.cold}
              core={palette.core}
              alpha={plan.alpha}
              restMs={plan.restMs}
            />
          ))}
        </svg>
      )}
      <LightFlowSurge
        plan={plan}
        motion={motion}
        palette={palette}
        size={size}
        heroSeam={heroSeam}
        onBoomChange={setBoom}
      />
    </div>
  );
}
