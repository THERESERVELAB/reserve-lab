"use client";

import { springSamples, type LogMomentPlan, type LogMomentTier, type LogMomentTone } from "@/lib/ui/log-moment";

import type { LogMomentTargets } from "./log-moment-store";

/* ════════════════════════════════════════════════════════════════════════
   LOG MOMENT EFFECTS — the physical beats of a log moment, run imperatively.

   Transform, opacity and one bounded canvas. Nothing here changes layout:
   the row and the readout are pressed and lit with the Web Animations API on
   the elements that already exist, the light is drawn on a fixed canvas that
   exists only while it runs, and every animation is cancelled by one
   `cancel()` so a second log cleanly replaces the first.

   Every Web Animation is given an id starting "log-moment" (a Nutrition meal:
   "meal-moment") so tests can prove none run under reduced motion.
   ════════════════════════════════════════════════════════════════════════ */

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";

export type Point = { x: number; y: number };

export type EffectRun = {
  cancel: () => void;
};

type Ctx = {
  prefix: string;
  tag: (el: Element, role: string) => void;
  animations: Animation[];
  timers: number[];
  frames: number[];
  nodes: Element[];
  cancelled: boolean;
};

function animate(ctx: Ctx, el: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions, id: string): Animation | null {
  if (!el || typeof (el as HTMLElement).animate !== "function") return null;
  try {
    const a = (el as HTMLElement).animate(keyframes, options);
    a.id = `${ctx.prefix}-${id}`;
    ctx.animations.push(a);
    return a;
  } catch {
    return null;
  }
}

function later(ctx: Ctx, ms: number, run: () => void) {
  ctx.timers.push(window.setTimeout(() => { if (!ctx.cancelled) run(); }, ms));
}

export function inViewport(rect: DOMRect | null | undefined, margin = 0): boolean {
  if (!rect || rect.width === 0 || rect.height === 0) return false;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  return rect.bottom > margin && rect.top < vh - margin && rect.right > 0 && rect.left < vw;
}

function vibrate(pattern: number[] | undefined) {
  if (!pattern || pattern.length === 0) return;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    /* Haptics are a courtesy. */
  }
}

/* ─── Beat 1: impact ───────────────────────────────────────────────────── */

/** Press the row in 3D toward its control, then let a spring settle it. */
function pressKeyframes(weight: number): { keyframes: Keyframe[]; duration: number } {
  const pressMs = 110;
  const rx = springSamples({ from: 5 * weight, to: 0, stiffness: 220, damping: 12, maxMs: 900 });
  const ry = springSamples({ from: 3.6 * weight, to: 0, stiffness: 220, damping: 12, maxMs: 900 });
  const sc = springSamples({ from: 1 - 0.025 * weight, to: 1, stiffness: 280, damping: 14, maxMs: 900 });
  const n = Math.max(rx.length, ry.length, sc.length);
  const settleMs = ((n - 1) / 60) * 1000;
  const duration = pressMs + settleMs;
  const at = (arr: number[], i: number) => arr[Math.min(i, arr.length - 1)];
  const frame = (x: number, y: number, s: number) => `perspective(900px) rotateX(${x.toFixed(3)}deg) rotateY(${y.toFixed(3)}deg) scale(${s.toFixed(4)})`;
  const keyframes: Keyframe[] = [
    { offset: 0, transform: frame(0, 0, 1), easing: "cubic-bezier(0.3, 0, 0.6, 1)" },
  ];
  for (let i = 0; i < n; i += 1) {
    keyframes.push({ offset: (pressMs + (i / 60) * 1000) / duration, transform: frame(at(rx, i), at(ry, i), at(sc, i)) });
  }
  keyframes[keyframes.length - 1].offset = 1;
  return { keyframes, duration };
}

function sweepBox(ctx: Ctx, layer: HTMLElement, rect: DOMRect, tone: LogMomentTone, underline: boolean) {
  const box = document.createElement("div");
  ctx.tag(box, "sweep");
  Object.assign(box.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    overflow: "hidden",
    pointerEvents: "none",
    borderRadius: "10px",
    boxShadow: tone === "log" ? "inset 0 0 0 1px rgba(213,177,95,0.55), inset 0 0 28px rgba(213,177,95,0.16), 0 0 26px rgba(213,177,95,0.14)" : "inset 0 0 0 1px rgba(236,232,223,0.18)",
    opacity: "0",
  } satisfies Partial<CSSStyleDeclaration>);

  const bar = document.createElement("div");
  const log = tone === "log";
  Object.assign(bar.style, {
    position: "absolute",
    top: "-20%",
    bottom: "-20%",
    left: "0",
    width: "38%",
    background: log
      ? "linear-gradient(90deg, transparent 0%, rgba(213,177,95,0.10) 30%, rgba(236,206,140,0.34) 52%, rgba(255,244,214,0.55) 56%, rgba(236,206,140,0.22) 62%, transparent 100%)"
      : "linear-gradient(90deg, transparent 0%, rgba(142,160,184,0.10) 40%, rgba(236,232,223,0.16) 55%, transparent 100%)",
    transform: "translate3d(-120%,0,0) skewX(-18deg)",
    willChange: "transform, opacity",
    mixBlendMode: "screen",
  } satisfies Partial<CSSStyleDeclaration>);
  box.appendChild(bar);

  let line: HTMLDivElement | null = null;
  if (underline) {
    line = document.createElement("div");
    Object.assign(line.style, {
      position: "absolute",
      left: "0",
      right: "0",
      bottom: "0",
      height: "1px",
      background: "linear-gradient(90deg, transparent, rgba(213,177,95,0.55) 35%, rgba(236,206,140,0.95) 88%, rgba(255,244,214,1))",
      boxShadow: "0 0 10px rgba(213,177,95,0.55)",
      transformOrigin: "100% 50%",
      transform: "scaleX(0)",
    } satisfies Partial<CSSStyleDeclaration>);
    box.appendChild(line);
  }

  /* A log lights from the control across the row; a clear dims back toward it. */
  const from = log ? "translate3d(-120%,0,0) skewX(-18deg)" : "translate3d(300%,0,0) skewX(-18deg)";
  const to = log ? "translate3d(300%,0,0) skewX(-18deg)" : "translate3d(-120%,0,0) skewX(-18deg)";
  layer.appendChild(box);
  ctx.nodes.push(box);
  /* The frame locks on hard, then lets go slowly. */
  animate(ctx, box, [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 0.7, offset: 0.45 }, { opacity: 0 }], { duration: log ? 1250 : 700, easing: "ease-out", fill: "both" }, "frame");
  animate(ctx, bar, [{ transform: from, opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.75 }, { transform: to, opacity: 0 }], { duration: log ? 620 : 520, easing: EASE_IN_OUT, fill: "both" }, "sweep");
  if (line) {
    animate(ctx, line, [
      { transform: "scaleX(0)", opacity: 1 },
      { transform: "scaleX(1)", opacity: 1, offset: 0.45 },
      { transform: "scaleX(1)", opacity: 0 },
    ], { duration: 1150, delay: 30, easing: EASE_OUT, fill: "both" }, "lock-line");
  }
  return box;
}

/** The check on the row's control draws itself: its ring, then its tick. */
function drawIcon(ctx: Ctx, svg: SVGSVGElement | null) {
  if (!svg) return;
  const parts = Array.from(svg.querySelectorAll<SVGGeometryElement>("path, circle, polyline"));
  parts.forEach((part, i) => {
    let len = 60;
    try {
      len = Math.max(1, part.getTotalLength());
    } catch {
      /* Not measurable: fall back to a generous length. */
    }
    animate(ctx, part, [
      { strokeDasharray: `${len} ${len}`, strokeDashoffset: `${len}` },
      { strokeDasharray: `${len} ${len}`, strokeDashoffset: "0" },
    ], { duration: i === 0 ? 420 : 300, delay: i === 0 ? 60 : 300, easing: EASE_OUT, fill: "backwards" }, "check-draw");
  });
  animate(ctx, svg, [
    { transform: "scale(1.45)", filter: "drop-shadow(0 0 6px rgba(213,177,95,0.9))" },
    { transform: "scale(0.94)", offset: 0.55 },
    { transform: "scale(1)", filter: "drop-shadow(0 0 0 rgba(213,177,95,0))" },
  ], { duration: 620, easing: EASE_OUT }, "check-pop");
}

/* ─── Beat 2 + 3: flow and boom, on one canvas ─────────────────────────── */

type Particle = { delay: number; dur: number; p0: Point; p1: Point; p2: Point; size: number; hue: number };
type Spark = { vx: number; vy: number; life: number; size: number };

function glowSprite(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,246,220,1)");
    grad.addColorStop(0.18, "rgba(240,212,150,0.85)");
    grad.addColorStop(0.45, "rgba(213,177,95,0.28)");
    grad.addColorStop(1, "rgba(213,177,95,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return c;
}

const bezier = (a: Point, b: Point, c: Point, t: number): Point => {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * b.x + t * t * c.x, y: u * u * a.y + 2 * u * t * b.y + t * t * c.y };
};
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function runCanvas(ctx: Ctx, layer: HTMLElement, opts: { source: Point | null; target: () => Point; plan: LogMomentPlan }) {
  const { plan } = opts;
  const canvas = document.createElement("canvas");
  ctx.tag(canvas, "canvas");
  canvas.setAttribute("aria-hidden", "true");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  Object.assign(canvas.style, { position: "fixed", left: "0", top: "0", width: `${w}px`, height: `${h}px`, pointerEvents: "none" } satisfies Partial<CSSStyleDeclaration>);
  layer.appendChild(canvas);
  ctx.nodes.push(canvas);
  const g = canvas.getContext("2d");
  if (!g) return;
  g.scale(dpr, dpr);
  const sprite = glowSprite();

  const departMs = 150;
  const arrival = plan.arrivalMs;
  const target = opts.target();
  const intensity = plan.intensity;

  const particles: Particle[] = [];
  if (plan.flow && opts.source) {
    const s = opts.source;
    const dx = target.x - s.x;
    const dy = target.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    /* Bow the path outward, toward the middle of the screen. */
    let nx = -dy / dist;
    let ny = dx / dist;
    const mid = { x: (s.x + target.x) / 2, y: (s.y + target.y) / 2 };
    if ((w / 2 - mid.x) * nx + (h / 2 - mid.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const bow = Math.min(220, dist * 0.32);
    const count = Math.round(18 * Math.min(intensity, 1.6));
    for (let i = 0; i < count; i += 1) {
      const spread = (Math.random() - 0.5) * 2;
      const lead = i / count;
      particles.push({
        delay: departMs + lead * 200,
        dur: Math.max(260, arrival - departMs - lead * 200 + (Math.random() * 60 - 20)),
        p0: { x: s.x + (Math.random() - 0.5) * 18, y: s.y + (Math.random() - 0.5) * 10 },
        p1: { x: mid.x + nx * (bow + spread * 34), y: mid.y + ny * (bow + spread * 34) },
        p2: { x: target.x + (Math.random() - 0.5) * 6, y: target.y + (Math.random() - 0.5) * 6 },
        size: 7 + Math.random() * 9 * (i === 0 ? 1.6 : 1),
        hue: Math.random(),
      });
    }
  }

  const sparks: Spark[] = [];
  if (plan.boom) {
    const count = Math.round(22 * intensity);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = (160 + Math.random() * 260) * Math.sqrt(intensity);
      sparks.push({ vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 480 + Math.random() * 380, size: 0.8 + Math.random() * 1.4 });
    }
  }

  const endMs = arrival + (plan.boom ? 1000 : 200);
  const start = performance.now();
  let lastT = 0;

  const draw = (now: number) => {
    if (ctx.cancelled) return;
    const t = now - start;
    lastT = t;
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";

    /* Flow: light travels the arc and gathers into the readout. */
    for (const p of particles) {
      const local = (t - p.delay) / p.dur;
      if (local <= 0 || local >= 1.08) continue;
      const k = easeInOutSine(clamp01(local));
      const head = bezier(p.p0, p.p1, p.p2, k);
      const tail = bezier(p.p0, p.p1, p.p2, Math.max(0, k - 0.16));
      const fade = local > 1 ? 1 - (local - 1) / 0.08 : Math.min(1, local * 5);
      const grad = g.createLinearGradient(tail.x, tail.y, head.x, head.y);
      grad.addColorStop(0, "rgba(196,150,84,0)");
      grad.addColorStop(1, `rgba(${p.hue > 0.5 ? "236,206,140" : "213,177,95"},${0.75 * fade})`);
      g.strokeStyle = grad;
      g.lineWidth = 1.4;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(tail.x, tail.y);
      g.lineTo(head.x, head.y);
      g.stroke();
      g.globalAlpha = fade;
      g.drawImage(sprite, head.x - p.size / 2, head.y - p.size / 2, p.size, p.size);
      g.globalAlpha = 1;
    }

    if (plan.boom && t >= arrival) {
      const b = t - arrival;
      /* The flash where the light lands. */
      const flash = clamp01(b / 300);
      if (flash < 1) {
        const size = 170 * intensity * (0.6 + 0.4 * easeOutCubic(flash));
        g.globalAlpha = Math.pow(1 - flash, 2) * 0.6;
        g.drawImage(sprite, target.x - size / 2, target.y - size / 2, size, size);
        g.globalAlpha = 1;
      }
      /* The shockwave: one ring, two on a milestone. */
      const rings = intensity > 1 ? 2 : 1;
      for (let r = 0; r < rings; r += 1) {
        const rp = clamp01((b - r * 130) / (720 + r * 160));
        if (rp <= 0 || rp >= 1) continue;
        const radius = 30 + easeOutCubic(rp) * (130 + r * 110) * intensity;
        g.strokeStyle = `rgba(240,214,156,${Math.pow(1 - rp, 1.6) * (r === 0 ? 0.85 : 0.5)})`;
        g.lineWidth = 1.8 * (1 - rp) + 0.5;
        g.beginPath();
        g.arc(target.x, target.y, radius, 0, Math.PI * 2);
        g.stroke();
      }
      /* Sparks: fast out, dragged to rest, gone. */
      for (const s of sparks) {
        const life = b / s.life;
        if (life >= 1) continue;
        const sec = b / 1000;
        const drag = (1 - Math.exp(-4.2 * sec)) / 4.2;
        const x = target.x + s.vx * drag;
        const y = target.y + s.vy * drag;
        const v = Math.exp(-4.2 * sec);
        g.strokeStyle = `rgba(240,212,150,${(1 - life) * 0.85})`;
        g.lineWidth = s.size;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - s.vx * v * 0.028, y - s.vy * v * 0.028);
        g.stroke();
      }
    }

    g.globalCompositeOperation = "source-over";
    if (t < endMs) ctx.frames.push(requestAnimationFrame(draw));
    else g.clearRect(0, 0, w, h);
  };
  ctx.frames.push(requestAnimationFrame(draw));
  /* A hidden tab suspends frames: the canvas still leaves on time. */
  later(ctx, endMs + 400, () => {
    if (lastT < endMs) g.clearRect(0, 0, w, h);
    canvas.remove();
  });
}

/* ─── The sequence ─────────────────────────────────────────────────────── */

const visibleMatch = (selector: string | undefined, margin = 0): HTMLElement | undefined => {
  if (!selector) return undefined;
  try {
    return Array.from(document.querySelectorAll<HTMLElement>(selector)).find((el) => inViewport(el.getBoundingClientRect(), margin));
  } catch {
    return undefined;
  }
};

export function runLogMomentEffects(input: {
  layer: HTMLElement;
  tier: LogMomentTier;
  tone: LogMomentTone;
  plan: LogMomentPlan;
  targets: LogMomentTargets;
  /** Where the member last pressed, used when the row has gone (a closed sheet). */
  origin: Point | null;
  /** The control the member pressed, used as the row when no source is named. */
  pressed: Element | null;
  /** The tagged row it sat in, still used when the control itself was replaced (a "Completed" chip). */
  pressedRow: Element | null;
  /** The moment's kind: a readout tagged data-log-readout="<kind>" receives the light. */
  kind: string;
  /** "meal" keeps Nutrition's data-meal-moment hooks. */
  legacy: "meal" | null;
  /** Where the light lands when the readout is off screen. */
  fallbackTarget: () => Point;
}): EffectRun {
  const legacy = input.legacy === "meal";
  const ctx: Ctx = {
    prefix: legacy ? "meal-moment" : "log-moment",
    tag: (el, role) => {
      el.setAttribute("data-log-moment", role);
      if (legacy) el.setAttribute("data-meal-moment", role);
    },
    animations: [],
    timers: [],
    frames: [],
    nodes: [],
    cancelled: false,
  };
  const { plan, tone, layer, targets } = input;
  const cancel = () => {
    ctx.cancelled = true;
    ctx.timers.forEach((t) => window.clearTimeout(t));
    ctx.frames.forEach((f) => cancelAnimationFrame(f));
    ctx.animations.forEach((a) => { try { a.cancel(); } catch { /* already gone */ } });
    ctx.nodes.forEach((n) => n.remove());
  };
  if (!plan.visible || !plan.impact) return { cancel };

  /* The named row, or else the control the member pressed (inside the row it belongs to, if tagged). */
  const pressed = input.pressed instanceof HTMLElement && input.pressed.isConnected ? input.pressed : null;
  const taggedRow = input.pressedRow instanceof HTMLElement && input.pressedRow.isConnected ? input.pressedRow : null;
  const pressedRow = pressed ? (pressed.closest<HTMLElement>("[data-log-row]") ?? pressed) : (taggedRow ?? undefined);
  const row =
    visibleMatch(targets.source) ??
    (targets.source ? document.querySelector<HTMLElement>(targets.source) ?? undefined : undefined) ??
    pressedRow;
  const rowRect = row?.getBoundingClientRect();
  const rowVisible = inViewport(rowRect);
  const heroAction = visibleMatch(targets.fallbackSource);
  const log = tone === "log";
  const full = input.tier === "full";

  vibrate(plan.haptics?.impact);

  /* Impact: the row presses toward its control and locks in with light. */
  /* The control whose check draws: the named one, the pressed one, or (when the
     pressed control was replaced by its saved state) whatever the row now shows. */
  const control = targets.control ? row?.querySelector<HTMLElement>(targets.control) : row && row === pressedRow ? (pressed ?? row) : null;
  if (row && rowVisible && rowRect) {
    const { keyframes, duration } = pressKeyframes(full ? 1 : 0.6);
    animate(ctx, row, keyframes, { duration, easing: "linear" }, "press");
    sweepBox(ctx, layer, rowRect, tone, log);
    if (log) drawIcon(ctx, control?.querySelector<SVGSVGElement>("svg") ?? null);
  } else if (heroAction && log) {
    sweepBox(ctx, layer, heroAction.getBoundingClientRect(), tone, false);
  }
  /* The panel the row lives in carries its edge light once. */
  const panelEdge = row?.closest('[data-surface], .relative')?.querySelector<HTMLElement>(".fba-edge-light");
  if (rowVisible) animate(ctx, panelEdge, [{ transform: "translate3d(-100%,0,0)", opacity: 1 }, { transform: "translate3d(500%,0,0)", opacity: 1 }], { duration: 900, delay: 60, easing: EASE_IN_OUT }, "edge");

  const sourceRect = rowVisible ? (control ?? row)?.getBoundingClientRect() : heroAction?.getBoundingClientRect();
  const source = sourceRect ? { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 } : input.origin;

  const readout = visibleMatch(targets.readout ?? `[data-log-readout~="${input.kind}"]`, 8);
  const target = (): Point => {
    if (readout) {
      const r = readout.getBoundingClientRect();
      return { x: r.left + Math.min(r.width, 60) / 2, y: r.top + r.height / 2 };
    }
    return input.fallbackTarget();
  };

  if (plan.flow || plan.boom) runCanvas(ctx, layer, { source, target, plan });

  later(ctx, plan.arrivalMs, () => {
    vibrate(plan.haptics?.arrival);
    if (!plan.boom) return;
    const at = target();

    /* Bloom: the room light swells where the energy landed. */
    const bloom = document.createElement("div");
    ctx.tag(bloom, "bloom");
    const size = Math.round(720 * plan.intensity);
    Object.assign(bloom.style, {
      position: "fixed",
      left: `${at.x - size / 2}px`,
      top: `${at.y - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      pointerEvents: "none",
      background: "radial-gradient(circle, rgba(236,206,140,0.42) 0%, rgba(213,177,95,0.16) 30%, rgba(110,231,183,0.05) 52%, transparent 70%)",
      mixBlendMode: "screen",
      opacity: "0",
      willChange: "transform, opacity",
    } satisfies Partial<CSSStyleDeclaration>);
    layer.appendChild(bloom);
    ctx.nodes.push(bloom);
    const a = animate(ctx, bloom, [
      { opacity: 0, transform: "scale(0.3)" },
      { opacity: 1, transform: "scale(1)", offset: 0.28 },
      { opacity: 0, transform: "scale(1.45)" },
    ], { duration: 1000 + 200 * (plan.intensity - 1), easing: EASE_OUT, fill: "both" }, "bloom");
    if (a) a.onfinish = () => bloom.remove();

    /* The room itself brightens for a breath: the plate, the loop and the awake light. */
    const room = document.querySelector<HTMLElement>('[data-ambient-layer="room"]');
    animate(ctx, room, [
      { filter: "brightness(1) saturate(1)" },
      { filter: `brightness(${(1 + 0.28 * plan.intensity).toFixed(2)}) saturate(1.12)`, offset: 0.22 },
      { filter: "brightness(1) saturate(1)" },
    ], { duration: 1200, easing: EASE_OUT }, "room");

    /* The readout receives it: a settle on a spring, with a brief warm glow. */
    if (readout) {
      const numberBlock = readout.parentElement ?? readout;
      numberBlock.style.transformOrigin = "0% 70%";
      const s = springSamples({ from: 1.1, to: 1, stiffness: 320, damping: 14, maxMs: 700 });
      animate(ctx, numberBlock, s.map((v, i) => ({
        offset: i / (s.length - 1),
        transform: `scale(${v.toFixed(4)})`,
        textShadow: `0 0 ${Math.round(22 * (1 - i / (s.length - 1)))}px rgba(236,206,140,${(0.75 * (1 - i / (s.length - 1))).toFixed(3)})`,
      })), { duration: ((s.length - 1) / 60) * 1000, easing: "linear" }, "readout");
      const heroEdge = readout.closest('[data-nutrition="hero"]')?.parentElement?.querySelector<HTMLElement>(".fba-edge-light");
      animate(ctx, heroEdge, [{ transform: "translate3d(-100%,0,0)" }, { transform: "translate3d(500%,0,0)" }], { duration: 1000, easing: EASE_IN_OUT }, "hero-edge");
    }

    /* The protein meter fills (a CSS transition in the hero) and flares once. */
    const meter = visibleMatch(targets.meter);
    animate(ctx, meter, [
      { boxShadow: "0 0 0 rgba(236,206,140,0)" },
      { boxShadow: "0 0 14px rgba(236,206,140,0.95)", offset: 0.35 },
      { boxShadow: "0 0 0 rgba(236,206,140,0)" },
    ], { duration: 1100, easing: EASE_OUT }, "meter");
  });

  return { cancel };
}
