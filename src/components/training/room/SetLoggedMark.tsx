"use client";

import { motion } from "framer-motion";

import { useAmbientMotion } from "@/lib/ui/use-ambient-motion";

/* ════════════════════════════════════════════════════════════════════════
   SET LOGGED — the cockpit answers a logged set.

   The logger closes on Log Set, so the confirmation lands where the member
   is looking next: the rest row. Keyed by the log, it plays once (~0.9s):

       0ms  a gold hairline sweeps along the rest row and fades
      80ms  the check draws itself
     160ms  the words settle in: "Set 2 logged · 185 × 10"

   The rest clock beside it is already running. The words hold briefly and
   the parent removes them. Reduced or static motion (reduced-motion, the
   member's pause, a hidden tab): the same check and words, still — nothing
   animates. The cockpit's own live region announces the log in every mode. No
   confetti, no celebration; nothing here takes a tap.
   ════════════════════════════════════════════════════════════════════════ */

const GOLD = "#d5b15f";
const EASE = [0.22, 1, 0.36, 1] as const;

export function SetLoggedMark({ id, line }: { id: string; line: string }) {
  const setting = useAmbientMotion();
  const animate = setting === "full";

  return (
    <span
      key={id}
      aria-hidden="true"
      data-training="set-confirm"
      data-motion={setting}
      className="pointer-events-none flex items-center gap-1.5 text-[12px] leading-none"
      style={{ color: GOLD }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0">
        {animate ? (
          <motion.path
            d="M3 8.5 6.5 12 13 4.5"
            stroke={GOLD}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.36, delay: 0.08, ease: EASE }}
          />
        ) : (
          <path d="M3 8.5 6.5 12 13 4.5" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      {animate ? (
        <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.32, delay: 0.16, ease: EASE }}>
          {line}
        </motion.span>
      ) : (
        <span>{line}</span>
      )}
    </span>
);
}

/** The gold hairline that sweeps the rest row once. Nothing in reduced or static motion. */
export function SetLoggedSweep({ id }: { id: string }) {
  const setting = useAmbientMotion();
  if (setting !== "full") return null;
  return (
    <motion.span
      key={id}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left"
      style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
      initial={{ scaleX: 0, opacity: 0.9 }}
      animate={{ scaleX: 1, opacity: 0 }}
      transition={{ scaleX: { duration: 0.55, ease: EASE }, opacity: { duration: 0.9, ease: "easeOut" } }}
    />
  );
}
