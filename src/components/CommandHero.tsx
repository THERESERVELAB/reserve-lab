"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

import { GlassPanel } from "./ui/GlassPanel";

const RADIUS = 76;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ReadinessRing({ value = 84 }: { value: number }) {
  const offset = CIRCUMFERENCE * (1 - value / 100);

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer ambient glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(ellipse, rgba(213,177,95,0.12) 0%, transparent 68%)",
          filter: "blur(20px)",
        }}
      />

      <svg
        width="188"
        height="188"
        viewBox="0 0 188 188"
        className="-rotate-90"
        aria-label={`Readiness: ${value}`}
        role="img"
      >
        <defs>
          <linearGradient id="ringGold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#c4a24e" />
            <stop offset="60%" stopColor="#d5b15f" />
            <stop offset="100%" stopColor="#e8c87a" />
          </linearGradient>
          <filter id="ringGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track */}
        <circle
          cx="94" cy="94" r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="7"
        />

        {/* Secondary track tick marks */}
        {[0, 25, 50, 75].map((pct) => {
          const angle = (pct / 100) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const x1 = 94 + (RADIUS - 10) * Math.cos(rad);
          const y1 = 94 + (RADIUS - 10) * Math.sin(rad);
          const x2 = 94 + (RADIUS + 3) * Math.cos(rad);
          const y2 = 94 + (RADIUS + 3) * Math.sin(rad);
          return (
            <line
              key={pct}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Progress arc */}
        <motion.circle
          cx="94" cy="94" r={RADIUS}
          fill="none"
          stroke="url(#ringGold)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          filter="url(#ringGlow)"
        />

        {/* End dot */}
        <motion.circle
          cx="94" cy={94 - RADIUS}
          r="4"
          fill="#e8c87a"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          style={{ filter: "drop-shadow(0 0 4px rgba(213,177,95,0.8))" }}
        />
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.strong
          className="font-black leading-none text-[#f2eee6]"
          style={{ fontSize: 40 }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {value}
        </motion.strong>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-[#d5b15f]/70">
          Readiness
        </p>
      </div>
    </div>
  );
}

const RING_STATS = [
  { label: "Recovery", value: "7.8h", color: "#6ee7b7" },
  { label: "Load", value: "79%", color: "#5fb7d5" },
  { label: "Sleep", value: "8.1h", color: "#a78bfa" },
];

const STATUS_CHIPS = [
  { label: "Performance OS", gold: true },
  { label: "● Nominal", green: true },
  { label: "W6 · Block Active", gold: false },
];

export function CommandHero() {
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springX = useSpring(rawX, { stiffness: 120, damping: 20 });
  const springY = useSpring(rawY, { stiffness: 120, damping: 20 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [4, -4]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-5, 5]);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    rawX.set((e.clientX - left) / width - 0.5);
    rawY.set((e.clientY - top) / height - 0.5);
  }
  function onMouseLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d", perspective: 1200 }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassPanel accent="#d5b15f" gradientBorder noPad className="overflow-hidden">
        {/* Inner radial glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at 30% 50%, rgba(213,177,95,0.06) 0%, transparent 60%)",
          }}
        />

        <div className="relative flex flex-col gap-8 p-6 lg:flex-row lg:items-center lg:gap-0">
          {/* ── Left: identity + stats ── */}
          <div className="flex-1">
            {/* Status chips */}
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_CHIPS.map(({ label, gold, green }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.2em]"
                  style={{
                    background: gold
                      ? "rgba(213,177,95,0.1)"
                      : green
                        ? "rgba(110,231,183,0.08)"
                        : "rgba(255,255,255,0.04)",
                    border: `1px solid ${gold ? "rgba(213,177,95,0.22)" : green ? "rgba(110,231,183,0.18)" : "rgba(255,255,255,0.08)"}`,
                    color: gold ? "#d5b15f" : green ? "#6ee7b7" : "rgba(255,255,255,0.45)",
                  }}
                >
                  {green && (
                    <span className="fba-pulse h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                  )}
                  {label}
                </span>
              ))}
            </div>

            {/* Title */}
            <motion.h1
              className="mt-4 font-black uppercase leading-[0.92] tracking-tight text-[#f2eee6]"
              style={{ fontSize: "clamp(32px, 4.5vw, 58px)" }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              The Reserve
              <br />
              <span style={{ color: "#d5b15f" }}>Method</span>
            </motion.h1>

            <p className="mt-3 max-w-sm text-[11px] leading-6 text-white/32">
              Tracking-only performance command center. No medical advice, protocols,
              or dosage recommendations.
            </p>

            {/* Stat row */}
            <div className="mt-5 flex flex-wrap gap-3">
              {RING_STATS.map(({ label, value, color }, i) => (
                <motion.div
                  key={label}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.25 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  style={{ backdropFilter: "blur(8px)" }}
                >
                  <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/30">{label}</p>
                  <strong className="mt-1 block font-mono text-lg font-bold" style={{ color }}>
                    {value}
                  </strong>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── Right: readiness ring ── */}
          <div className="flex flex-col items-center justify-center lg:w-[220px]">
            <ReadinessRing value={84} />
            <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.2em] text-white/22">
              Composite Score
            </p>
          </div>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
