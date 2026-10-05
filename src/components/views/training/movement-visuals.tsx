"use client";

/* ════════════════════════════════════════════════════════════════════════
   MOVEMENT VISUALS — the illustrated system the session screens draw with.

   Lifted out of TrainingView unchanged: the visual spec for each movement,
   the equipment and silhouette illustrations, and the chamber that frames
   them. Same markup, same palette, same behaviour.
   ════════════════════════════════════════════════════════════════════════ */

import { useReducedMotion } from "framer-motion";
import { Move, Scan, Target } from "lucide-react";

import { MovementVisualMedia } from "@/components/training/MovementVisualPanel";
import { useStillMotion } from "@/components/training/room/still-motion";
import { getMovementVisual, selectMediaVariant } from "@/lib/training/movement-visuals";
import type { EquipmentKind, SessionMovement as Movement } from "@/lib/training/session-movement";
import { GOLD, RED, STEEL, VIOLET } from "./palette";

export type SilhouetteGender = "male" | "female" | "neutral";

export type MovementVisualSpec = {
  visualId: string;
  viewAngle: string;
  bodyPosition: string;
  movementPath: string;
  pathArrowDirection: "up" | "down" | "in" | "out" | "arc-up" | "arc-down" | "press" | "pull";
  setupCue: string;
  commonError: string;
  visualStyle: "incline-press" | "incline-db-press" | "machine-press" | "incline-fly" | "smith-press" | "pulldown" | "row-supported" | "row-landmine" | "cable-row" | "pullover-machine" | "rear-fly" | "core-flexion" | "core-hang" | "core-anti-rotation" | "core-vacuum" | "cardio-walk" | "cardio-cooldown" | "cardio-zone2" | "recovery-sauna" | "recovery-hydration" | "recovery-cooldown" | "recovery-breath";
};

export const MOVEMENT_VISUALS: Record<string, MovementVisualSpec> = {
  "low-incline-barbell": {
    visualId: "v-low-incline-bb",
    viewAngle: "Side · Incline Bench 15-30°",
    bodyPosition: "Lying incline · feet planted",
    movementPath: "Bar travels from upper-chest line up toward chin line",
    pathArrowDirection: "press",
    setupCue: "Scaps pinned · ribs stacked · elbows 45°",
    commonError: "Shoulders take over · elbows flare wide",
    visualStyle: "incline-press",
  },
  "hammer-incline": {
    visualId: "v-hammer-incline",
    viewAngle: "Side · Plate-Loaded Incline",
    bodyPosition: "Seated · handles at mid-clavicle",
    movementPath: "Press up and slightly in along fixed arc",
    pathArrowDirection: "press",
    setupCue: "Seat height aligns handles with upper chest",
    commonError: "Elbow flare or shoulder roll forward",
    visualStyle: "machine-press",
  },
  "low-incline-db": {
    visualId: "v-low-incline-db",
    viewAngle: "Side · Incline Bench 15-30°",
    bodyPosition: "Lying incline · dumbbells in hand",
    movementPath: "Deep stretch then press toward eye line",
    pathArrowDirection: "press",
    setupCue: "Wrists stacked · ribs down · neutral path",
    commonError: "Dumbbells drift too low or too wide",
    visualStyle: "incline-db-press",
  },
  "low-to-high-cable-fly": {
    visualId: "v-low-high-fly",
    viewAngle: "Front · Dual Cable Stack",
    bodyPosition: "Standing · split stance · forward lean",
    movementPath: "Sweep from low ribs up to upper-chest line",
    pathArrowDirection: "arc-up",
    setupCue: "Cables low · open chest · soft elbows",
    commonError: "Front-delt raise pattern · traps engage",
    visualStyle: "incline-fly",
  },
  "incline-smith-backoff": {
    visualId: "v-smith-incline",
    viewAngle: "Side · Smith Machine + Bench",
    bodyPosition: "Lying incline · bar on fixed rail",
    movementPath: "Fixed vertical path · same touch point each rep",
    pathArrowDirection: "press",
    setupCue: "Rail aligned with upper chest · elbows under bar",
    commonError: "Touch point drifts · rep path changes",
    visualStyle: "smith-press",
  },
  "wide-pulldown": {
    visualId: "v-wide-pulldown",
    viewAngle: "Front · Pulldown Tower",
    bodyPosition: "Seated · thighs locked · slight lean",
    movementPath: "Elbows drive down and back toward pockets",
    pathArrowDirection: "down",
    setupCue: "Depress scaps first · chest up · eyes forward",
    commonError: "Biceps-led pull · top-end shrug",
    visualStyle: "pulldown",
  },
  "chest-supported-row": {
    visualId: "v-cs-row",
    viewAngle: "Side · Chest-Supported Row",
    bodyPosition: "Chest pinned to pad · neutral spine",
    movementPath: "Row elbows back and slightly down · pause",
    pathArrowDirection: "pull",
    setupCue: "Chest pad pinned · handles at lower ribs",
    commonError: "Chest lifts off pad to finish reps",
    visualStyle: "row-supported",
  },
  "meadows-row": {
    visualId: "v-meadows",
    viewAngle: "Side · Landmine · Staggered Stance",
    bodyPosition: "Perpendicular · hips back · free hand braced",
    movementPath: "Elbow drives high toward the hip · slight rotation",
    pathArrowDirection: "pull",
    setupCue: "Hips back · free hand brace · neutral spine",
    commonError: "Bicep-dominant finish · elbow drops low",
    visualStyle: "row-landmine",
  },
  "single-arm-cable-lat-row": {
    visualId: "v-sa-cable-row",
    viewAngle: "Side · Low Cable",
    bodyPosition: "Standing · hips square · one handle",
    movementPath: "Reach long · drive elbow to back pocket",
    pathArrowDirection: "pull",
    setupCue: "Cable low · hips square · ribs quiet",
    commonError: "Torso rotates to move the stack",
    visualStyle: "cable-row",
  },
  "machine-pullover": {
    visualId: "v-pullover",
    viewAngle: "Side · Pullover Machine Arc",
    bodyPosition: "Seated · ribs stacked · elbows lead",
    movementPath: "Arc elbows down and slightly in",
    pathArrowDirection: "arc-down",
    setupCue: "Seat aligns elbow with pivot · ribs quiet",
    commonError: "Becomes a triceps pushdown · ribs flare",
    visualStyle: "pullover-machine",
  },
  "reverse-fly": {
    visualId: "v-reverse-fly",
    viewAngle: "Front · Reverse Pec Deck",
    bodyPosition: "Chest pressed to pad · arms slightly bent",
    movementPath: "Sweep wide · pause at peak",
    pathArrowDirection: "out",
    setupCue: "Chest pad pinned · handles at shoulder height",
    commonError: "Traps take over · shoulders shrug",
    visualStyle: "rear-fly",
  },
};


/* ────────────────────────────────────────────────────────────────────────────
   ILLUSTRATED VISUAL SYSTEM (preserved)
   ──────────────────────────────────────────────────────────────────────── */

export function EquipmentIllustration({ kind, accent }: { kind: EquipmentKind; accent: string }) {
  const gradId = `bar-${accent.replace("#", "")}`;
  if (kind === "barbell") {
    return (
      <svg viewBox="0 0 120 60" className="h-12 w-full">
        <defs><linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={`${accent}40`} /><stop offset="50%" stopColor={`${accent}90`} /><stop offset="100%" stopColor={`${accent}40`} /></linearGradient></defs>
        <rect x="6" y="20" width="14" height="20" rx="2" fill={`${accent}55`} />
        <rect x="22" y="24" width="6" height="12" rx="1" fill={`${accent}70`} />
        <line x1="28" y1="30" x2="92" y2="30" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" />
        <rect x="92" y="24" width="6" height="12" rx="1" fill={`${accent}70`} />
        <rect x="100" y="20" width="14" height="20" rx="2" fill={`${accent}55`} />
      </svg>
    );
  }
  if (kind === "dumbbell") {
    return (
      <svg viewBox="0 0 120 60" className="h-12 w-full">
        <rect x="14" y="18" width="14" height="24" rx="3" fill={`${accent}60`} />
        <rect x="28" y="26" width="6" height="8" rx="1" fill={`${accent}80`} />
        <line x1="34" y1="30" x2="56" y2="30" stroke={`${accent}90`} strokeWidth="2.5" strokeLinecap="round" />
        <rect x="64" y="26" width="6" height="8" rx="1" fill={`${accent}80`} />
        <line x1="70" y1="30" x2="86" y2="30" stroke={`${accent}90`} strokeWidth="2.5" strokeLinecap="round" />
        <rect x="86" y="26" width="6" height="8" rx="1" fill={`${accent}80`} />
        <rect x="92" y="18" width="14" height="24" rx="3" fill={`${accent}60`} />
      </svg>
    );
  }
  if (kind === "cable") {
    return (
      <svg viewBox="0 0 120 60" className="h-12 w-full">
        <rect x="50" y="6" width="20" height="14" rx="2" fill={`${accent}50`} stroke={`${accent}80`} strokeWidth="0.8" />
        <line x1="60" y1="20" x2="60" y2="38" stroke={`${accent}88`} strokeWidth="1.2" strokeDasharray="2 1.5" />
        <rect x="40" y="38" width="40" height="4" rx="1.5" fill={`${accent}85`} />
        <circle cx="42" cy="40" r="2" fill={`${accent}cc`} />
        <circle cx="78" cy="40" r="2" fill={`${accent}cc`} />
      </svg>
    );
  }
  if (kind === "smith") {
    return (
      <svg viewBox="0 0 120 60" className="h-12 w-full">
        <line x1="14" y1="8" x2="14" y2="52" stroke={`${accent}55`} strokeWidth="1.2" />
        <line x1="106" y1="8" x2="106" y2="52" stroke={`${accent}55`} strokeWidth="1.2" />
        <line x1="20" y1="30" x2="100" y2="30" stroke={`${accent}90`} strokeWidth="3" strokeLinecap="round" />
        <rect x="24" y="22" width="6" height="16" rx="1" fill={`${accent}70`} />
        <rect x="90" y="22" width="6" height="16" rx="1" fill={`${accent}70`} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 60" className="h-12 w-full">
      <rect x="22" y="14" width="76" height="32" rx="5" fill={`${accent}25`} stroke={`${accent}70`} strokeWidth="1" />
      <rect x="32" y="24" width="56" height="4" rx="1.5" fill={`${accent}80`} />
      <circle cx="42" cy="38" r="3" fill={`${accent}60`} />
      <circle cx="78" cy="38" r="3" fill={`${accent}60`} />
    </svg>
  );
}

export function MovementIllustration({ movement, accent }: { movement: Movement; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4" style={{ borderColor: `${accent}1a`, background: "linear-gradient(180deg, rgba(8,9,14,0.92), rgba(6,7,11,0.96))" }}>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/30">Equipment</p>
        <span className="font-mono text-[7px] uppercase tracking-[0.18em]" style={{ color: `${accent}aa` }}>{movement.mode}</span>
      </div>
      <EquipmentIllustration kind={movement.equipmentKind} accent={accent} />
      <p className="mt-1 text-[11px] font-semibold text-[#f2eee6]">{movement.equipmentName}</p>
      <p className="mt-1 font-mono text-[8px] leading-4 text-white/35">{movement.setupNote}</p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   MOVEMENT VISUAL CHAMBER
   High-end illustrated visual showing equipment + body position + path + target
   ──────────────────────────────────────────────────────────────────────── */

export function MovementVisualScene({ style, accent, gender }: { style: MovementVisualSpec["visualStyle"]; accent: string; gender: SilhouetteGender }) {
  const M = useStillMotion();
  // body width adapts to gender
  const shoulderOffset = gender === "male" ? 14 : gender === "female" ? 10 : 12;
  const torsoColor = "rgba(242,238,230,0.42)";
  const torsoStroke = "rgba(242,238,230,0.6)";

  if (style === "incline-press") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* bench */}
        <line x1="40" y1="120" x2="200" y2="80" stroke={`${accent}90`} strokeWidth="3" strokeLinecap="round" />
        <line x1="40" y1="120" x2="40" y2="138" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
        <line x1="200" y1="80" x2="200" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
        {/* angle marker */}
        <path d="M 50 122 A 14 14 0 0 0 64 116" fill="none" stroke={`${accent}80`} strokeWidth="0.8" strokeDasharray="2 1.5" />
        <text x="68" y="120" fontSize="7" fill={`${accent}b0`} fontFamily="monospace">15-30°</text>
        {/* athlete: head + torso + arms */}
        <ellipse cx="180" cy="78" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        {/* torso */}
        <path d={`M ${175 - shoulderOffset} 86 Q ${175 - shoulderOffset - 4} 92 ${175 - shoulderOffset - 8} 110 L ${175 + shoulderOffset - 4} 122 Q ${175 + shoulderOffset} 122 ${175 + shoulderOffset} 116 L ${175 + shoulderOffset - 2} 88 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* highlighted upper chest */}
        <M.ellipse cx="170" cy="92" rx="13" ry="6" fill={`${GOLD}66`} stroke={`${GOLD}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
        {/* arms holding bar */}
        <line x1="162" y1="92" x2="120" y2="52" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="178" y1="92" x2="136" y2="52" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        {/* barbell */}
        <line x1="86" y1="52" x2="170" y2="52" stroke={`${accent}d8`} strokeWidth="3" strokeLinecap="round" />
        <rect x="80" y="44" width="8" height="16" rx="1" fill={`${accent}b0`} />
        <rect x="168" y="44" width="8" height="16" rx="1" fill={`${accent}b0`} />
        <rect x="74" y="40" width="8" height="24" rx="1.5" fill={`${accent}55`} />
        <rect x="174" y="40" width="8" height="24" rx="1.5" fill={`${accent}55`} />
        {/* path arrow */}
        <M.g animate={{ y: [-6, 4, -6] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}>
          <path d="M 128 76 L 128 60 M 124 64 L 128 60 L 132 64" stroke={`${GOLD}d0`} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </M.g>
      </svg>
    );
  }

  if (style === "incline-db-press") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* low incline bench */}
        <line x1="40" y1="122" x2="202" y2="82" stroke={`${accent}90`} strokeWidth="3" strokeLinecap="round" />
        <line x1="42" y1="122" x2="42" y2="140" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
        <line x1="198" y1="82" x2="198" y2="102" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
        <path d="M 50 124 A 14 14 0 0 0 64 118" fill="none" stroke={`${accent}80`} strokeWidth="0.8" strokeDasharray="2 1.5" />
        <text x="66" y="122" fontSize="7" fill={`${accent}b0`} fontFamily="monospace">low incline</text>
        {/* athlete */}
        <ellipse cx="180" cy="78" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${175 - shoulderOffset} 86 Q ${175 - shoulderOffset - 4} 94 ${175 - shoulderOffset - 9} 112 L ${175 + shoulderOffset - 4} 123 Q ${175 + shoulderOffset} 123 ${175 + shoulderOffset} 116 L ${175 + shoulderOffset - 2} 88 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        <M.ellipse cx="169" cy="92" rx="13" ry="6" fill={`${GOLD}66`} stroke={`${GOLD}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
        {/* arms and separate dumbbells */}
        <line x1="162" y1="94" x2="116" y2="64" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="178" y1="94" x2="146" y2="58" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        <g transform="translate(110 58) rotate(-22)">
          <rect x="-14" y="-3" width="28" height="6" rx="2" fill={`${accent}b8`} />
          <rect x="-19" y="-7" width="7" height="14" rx="1.5" fill={`${accent}66`} />
          <rect x="12" y="-7" width="7" height="14" rx="1.5" fill={`${accent}66`} />
        </g>
        <g transform="translate(148 52) rotate(-12)">
          <rect x="-14" y="-3" width="28" height="6" rx="2" fill={`${accent}b8`} />
          <rect x="-19" y="-7" width="7" height="14" rx="1.5" fill={`${accent}66`} />
          <rect x="12" y="-7" width="7" height="14" rx="1.5" fill={`${accent}66`} />
        </g>
        {/* independent press paths */}
        <M.g animate={{ y: [-5, 5, -5], opacity: [0.65, 1, 0.65] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}>
          <path d="M 112 84 L 108 66 M 105 70 L 108 66 L 112 69" stroke={`${GOLD}d0`} strokeWidth="1.3" strokeLinecap="round" fill="none" />
          <path d="M 150 80 L 146 62 M 143 66 L 146 62 L 150 65" stroke={`${GOLD}d0`} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </M.g>
        {/* bottom-range cue */}
        <path d="M 104 86 Q 128 96 154 82" fill="none" stroke={`${STEEL}70`} strokeWidth="1" strokeDasharray="3 3" />
        <text x="120" y="146" fontSize="7" fill={`${STEEL}c0`} fontFamily="monospace" textAnchor="middle">Per hand · deeper range · wrists stacked</text>
      </svg>
    );
  }

  if (style === "smith-press") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* smith rails */}
        <line x1="60" y1="20" x2="60" y2="146" stroke={`${accent}60`} strokeWidth="1.6" />
        <line x1="180" y1="20" x2="180" y2="146" stroke={`${accent}60`} strokeWidth="1.6" />
        <line x1="60" y1="146" x2="180" y2="146" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        {/* bench */}
        <line x1="40" y1="118" x2="200" y2="82" stroke={`${accent}90`} strokeWidth="3" strokeLinecap="round" />
        {/* athlete */}
        <ellipse cx="172" cy="78" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${168 - shoulderOffset} 86 Q ${168 - shoulderOffset - 4} 94 ${168 - shoulderOffset - 8} 110 L ${168 + shoulderOffset - 4} 120 Q ${168 + shoulderOffset} 120 ${168 + shoulderOffset} 114 L ${168 + shoulderOffset - 2} 88 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        <M.ellipse cx="164" cy="92" rx="13" ry="6" fill={`${GOLD}66`} stroke={`${GOLD}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
        {/* arms */}
        <line x1="156" y1="92" x2="118" y2="60" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="172" y1="92" x2="134" y2="60" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        {/* bar with locks */}
        <line x1="60" y1="60" x2="180" y2="60" stroke={`${accent}d8`} strokeWidth="3.5" strokeLinecap="round" />
        <rect x="56" y="52" width="8" height="16" rx="1" fill={`${accent}b0`} />
        <rect x="176" y="52" width="8" height="16" rx="1" fill={`${accent}b0`} />
        {/* fixed-path arrow */}
        <M.g animate={{ y: [-8, 4, -8] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}>
          <path d="M 122 80 L 122 64 M 118 68 L 122 64 L 126 68" stroke={`${GOLD}d0`} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </M.g>
        <text x="186" y="86" fontSize="6" fill="rgba(255,255,255,0.4)" fontFamily="monospace">Fixed path</text>
      </svg>
    );
  }

  if (style === "machine-press") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* machine frame */}
        <rect x="60" y="50" width="120" height="84" rx="6" fill="rgba(255,255,255,0.02)" stroke={`${accent}50`} strokeWidth="1.2" />
        {/* seat + back pad */}
        <rect x="142" y="92" width="42" height="34" rx="3" fill={`${accent}28`} stroke={`${accent}70`} strokeWidth="0.8" />
        <rect x="174" y="64" width="14" height="60" rx="2" fill={`${accent}30`} stroke={`${accent}80`} strokeWidth="0.8" />
        {/* athlete seated */}
        <ellipse cx="166" cy="76" rx="8" ry="9" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${162 - 6} 86 Q ${162 - 8} 96 ${162 - 6} 116 L ${162 + 6} 124 Q ${162 + 10} 120 ${162 + 8} 100 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        <M.ellipse cx="158" cy="92" rx="10" ry="5" fill={`${GOLD}66`} stroke={`${GOLD}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
        {/* handles + arms */}
        <line x1="156" y1="92" x2="96" y2="88" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="156" y1="98" x2="96" y2="102" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        <rect x="84" y="84" width="14" height="22" rx="3" fill={`${accent}80`} />
        {/* path arrow */}
        <M.g animate={{ x: [-4, 4, -4] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}>
          <path d="M 118 94 L 102 94 M 106 90 L 102 94 L 106 98" stroke={`${GOLD}d0`} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </M.g>
        {/* weight stack */}
        <rect x="64" y="64" width="16" height="60" rx="2" fill="rgba(255,255,255,0.04)" stroke={`${accent}40`} strokeWidth="0.6" />
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1="64" y1={70 + i * 12} x2="80" y2={70 + i * 12} stroke={`${accent}50`} strokeWidth="0.6" />
        ))}
      </svg>
    );
  }

  if (style === "incline-fly") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* cable towers */}
        <rect x="22" y="20" width="14" height="120" rx="2" fill="rgba(255,255,255,0.025)" stroke={`${accent}50`} strokeWidth="1" />
        <rect x="204" y="20" width="14" height="120" rx="2" fill="rgba(255,255,255,0.025)" stroke={`${accent}50`} strokeWidth="1" />
        {/* pulleys low */}
        <circle cx="29" cy="118" r="3" fill={`${accent}90`} />
        <circle cx="211" cy="118" r="3" fill={`${accent}90`} />
        {/* cables */}
        <M.line x1="29" y1="118" x2="100" y2="72" stroke={`${accent}c0`} strokeWidth="1.2" strokeDasharray="3 2" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.2, repeat: Infinity }} />
        <M.line x1="211" y1="118" x2="140" y2="72" stroke={`${accent}c0`} strokeWidth="1.2" strokeDasharray="3 2" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.2, repeat: Infinity }} />
        {/* handles */}
        <circle cx="100" cy="72" r="4" fill={`${accent}d8`} />
        <circle cx="140" cy="72" r="4" fill={`${accent}d8`} />
        {/* athlete front view */}
        <ellipse cx="120" cy="46" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${120 - shoulderOffset} 56 Q ${120 - shoulderOffset - 2} 70 ${120 - 8} 110 L ${120 + 8} 110 Q ${120 + shoulderOffset + 2} 70 ${120 + shoulderOffset} 56 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        <M.path d={`M ${120 - 12} 60 Q 120 56 ${120 + 12} 60 L ${120 + 10} 72 Q 120 70 ${120 - 10} 72 Z`} fill={`${GOLD}66`} stroke={`${GOLD}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity }} />
        {/* arms to handles */}
        <line x1="110" y1="64" x2="100" y2="72" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="130" y1="64" x2="140" y2="72" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        {/* arc-up arrows */}
        <M.g animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.4, repeat: Infinity }}>
          <path d="M 96 84 Q 110 60 120 56" fill="none" stroke={`${GOLD}c0`} strokeWidth="1.2" strokeDasharray="2 2" />
          <path d="M 144 84 Q 130 60 120 56" fill="none" stroke={`${GOLD}c0`} strokeWidth="1.2" strokeDasharray="2 2" />
          <path d="M 117 58 L 120 54 L 123 58" stroke={`${GOLD}d8`} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </M.g>
      </svg>
    );
  }

  if (style === "pulldown") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* tower */}
        <rect x="108" y="14" width="24" height="20" rx="3" fill="rgba(255,255,255,0.04)" stroke={`${accent}60`} strokeWidth="0.8" />
        <line x1="120" y1="34" x2="120" y2="60" stroke={`${accent}b0`} strokeWidth="1.4" strokeDasharray="3 2" />
        {/* wide bar */}
        <line x1="68" y1="60" x2="172" y2="60" stroke={`${accent}d8`} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 68 60 L 60 70" stroke={`${accent}c0`} strokeWidth="2" strokeLinecap="round" />
        <path d="M 172 60 L 180 70" stroke={`${accent}c0`} strokeWidth="2" strokeLinecap="round" />
        {/* athlete: seated, thighs locked */}
        <ellipse cx="120" cy="86" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${120 - shoulderOffset} 96 Q ${120 - shoulderOffset - 2} 110 ${120 - 10} 134 L ${120 + 10} 134 Q ${120 + shoulderOffset + 2} 110 ${120 + shoulderOffset} 96 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* lats highlighted */}
        <M.path d={`M ${120 - 18} 104 Q ${120 - 22} 116 ${120 - 14} 128 L ${120 - 8} 128 L ${120 - 8} 102 Z`} fill={`${STEEL}66`} stroke={`${STEEL}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity }} />
        <M.path d={`M ${120 + 18} 104 Q ${120 + 22} 116 ${120 + 14} 128 L ${120 + 8} 128 L ${120 + 8} 102 Z`} fill={`${STEEL}66`} stroke={`${STEEL}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity, delay: 0.3 }} />
        {/* thigh pad */}
        <rect x="100" y="136" width="40" height="8" rx="2" fill={`${accent}30`} stroke={`${accent}70`} strokeWidth="0.6" />
        {/* arms up to bar */}
        <line x1="108" y1="98" x2="76" y2="62" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="132" y1="98" x2="164" y2="62" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        {/* down arrow */}
        <M.g animate={{ y: [-3, 6, -3] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
          <path d="M 60 90 L 60 110 M 56 106 L 60 110 L 64 106" stroke={`${GOLD}d0`} strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M 180 90 L 180 110 M 176 106 L 180 110 L 184 106" stroke={`${GOLD}d0`} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </M.g>
      </svg>
    );
  }

  if (style === "row-supported") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* incline chest pad */}
        <path d="M 60 130 L 200 70 L 200 86 L 64 144 Z" fill={`${accent}28`} stroke={`${accent}70`} strokeWidth="1" />
        {/* athlete prone */}
        <ellipse cx="186" cy="62" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${170} 74 L ${170 + shoulderOffset + 4} 64 L ${186 + 12} 110 L ${178} 116 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* mid back highlighted */}
        <M.rect x="158" y="84" width="30" height="14" rx="3" fill={`${STEEL}66`} stroke={`${STEEL}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity }} />
        {/* handles + arms */}
        <line x1="172" y1="92" x2="118" y2="80" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="172" y1="100" x2="118" y2="106" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        <rect x="106" y="76" width="12" height="34" rx="3" fill={`${accent}80`} />
        {/* row arrow */}
        <M.g animate={{ x: [-3, 4, -3] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}>
          <path d="M 138 90 L 158 90 M 154 86 L 158 90 L 154 94" stroke={`${GOLD}d0`} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </M.g>
      </svg>
    );
  }

  if (style === "row-landmine") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* landmine pivot */}
        <circle cx="220" cy="142" r="4" fill={`${accent}c0`} />
        <line x1="220" y1="142" x2="100" y2="80" stroke={`${accent}d8`} strokeWidth="3" strokeLinecap="round" />
        {/* plate stack */}
        <rect x="86" y="68" width="8" height="24" rx="1" fill={`${accent}b0`} />
        <rect x="78" y="62" width="10" height="36" rx="1.5" fill={`${accent}80`} />
        {/* athlete staggered stance */}
        <ellipse cx="120" cy="56" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${120 - shoulderOffset} 66 Q ${120 - shoulderOffset - 4} 76 ${120 - 14} 110 L ${120 - 4} 130 L ${120 + 8} 130 L ${120 + shoulderOffset + 4} 78 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* lat highlighted */}
        <M.path d={`M ${120 - 16} 78 Q ${120 - 22} 96 ${120 - 14} 110 L ${120 - 6} 110 L ${120 - 6} 76 Z`} fill={`${STEEL}66`} stroke={`${STEEL}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity }} />
        {/* arm pulling bar */}
        <line x1="108" y1="80" x2="92" y2="76" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        {/* high elbow arrow */}
        <M.path d="M 96 72 L 110 60 M 104 60 L 110 60 L 110 66" stroke={`${GOLD}d0`} strokeWidth="1.4" fill="none" strokeLinecap="round" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.2, repeat: Infinity }} />
      </svg>
    );
  }

  if (style === "cable-row") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* low cable tower */}
        <rect x="22" y="100" width="18" height="40" rx="2" fill="rgba(255,255,255,0.025)" stroke={`${accent}50`} strokeWidth="0.8" />
        <circle cx="31" cy="116" r="3" fill={`${accent}d8`} />
        {/* cable */}
        <M.line x1="31" y1="116" x2="116" y2="100" stroke={`${accent}c0`} strokeWidth="1.4" strokeDasharray="3 2" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.2, repeat: Infinity }} />
        {/* handle */}
        <circle cx="116" cy="100" r="4" fill={`${accent}d8`} />
        {/* athlete standing single-arm */}
        <ellipse cx="160" cy="58" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${160 - shoulderOffset} 68 Q ${160 - shoulderOffset - 4} 84 ${160 - 12} 130 L ${160 + 12} 130 Q ${160 + shoulderOffset + 4} 84 ${160 + shoulderOffset} 68 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* lat highlight */}
        <M.path d={`M ${160 - 16} 80 Q ${160 - 22} 100 ${160 - 14} 116 L ${160 - 6} 116 L ${160 - 6} 78 Z`} fill={`${STEEL}66`} stroke={`${STEEL}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity }} />
        {/* pulling arm */}
        <line x1="150" y1="80" x2="116" y2="100" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        {/* pull arrow */}
        <M.g animate={{ x: [-3, 4, -3] }} transition={{ duration: 2.4, repeat: Infinity }}>
          <path d="M 124 100 L 146 100 M 142 96 L 146 100 L 142 104" stroke={`${GOLD}d0`} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </M.g>
      </svg>
    );
  }

  if (style === "pullover-machine") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* machine arc */}
        <path d="M 80 110 Q 130 18 200 64" fill="none" stroke={`${accent}80`} strokeWidth="2" strokeDasharray="3 2" />
        {/* pivot */}
        <circle cx="200" cy="64" r="5" fill={`${accent}b0`} />
        {/* arm/lever */}
        <line x1="200" y1="64" x2="120" y2="60" stroke={`${accent}c0`} strokeWidth="2.5" strokeLinecap="round" />
        {/* athlete seated */}
        <ellipse cx="140" cy="80" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${140 - shoulderOffset} 90 Q ${140 - shoulderOffset - 2} 110 ${140 - 8} 130 L ${140 + 8} 130 Q ${140 + shoulderOffset + 2} 110 ${140 + shoulderOffset} 90 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* lats highlighted */}
        <M.path d={`M ${140 - 16} 100 Q ${140 - 22} 116 ${140 - 12} 128 L ${140 - 4} 128 L ${140 - 4} 96 Z`} fill={`${STEEL}66`} stroke={`${STEEL}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity }} />
        <M.path d={`M ${140 + 16} 100 Q ${140 + 22} 116 ${140 + 12} 128 L ${140 + 4} 128 L ${140 + 4} 96 Z`} fill={`${STEEL}66`} stroke={`${STEEL}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity, delay: 0.3 }} />
        {/* elbows to lever */}
        <line x1="130" y1="92" x2="120" y2="60" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="150" y1="92" x2="120" y2="64" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        {/* arc arrow */}
        <M.path d="M 124 50 Q 110 80 100 110" fill="none" stroke={`${GOLD}c0`} strokeWidth="1.4" strokeDasharray="2 2" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.2, repeat: Infinity }} />
        <path d="M 96 104 L 100 110 L 106 108" stroke={`${GOLD}d0`} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  if (style === "rear-fly") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* machine frame */}
        <rect x="50" y="30" width="140" height="106" rx="6" fill="rgba(255,255,255,0.02)" stroke={`${accent}50`} strokeWidth="1.2" />
        {/* chest pad */}
        <rect x="106" y="62" width="28" height="46" rx="3" fill={`${accent}30`} stroke={`${accent}80`} strokeWidth="0.8" />
        {/* athlete (back view) */}
        <ellipse cx="120" cy="46" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${120 - shoulderOffset} 56 Q ${120 - shoulderOffset - 2} 76 ${120 - 14} 120 L ${120 + 14} 120 Q ${120 + shoulderOffset + 2} 76 ${120 + shoulderOffset} 56 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* rear delts highlighted */}
        <M.ellipse cx={`${120 - shoulderOffset - 2}`} cy="62" rx="8" ry="6" fill={`${GOLD}66`} stroke={`${GOLD}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity }} />
        <M.ellipse cx={`${120 + shoulderOffset + 2}`} cy="62" rx="8" ry="6" fill={`${GOLD}66`} stroke={`${GOLD}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity, delay: 0.3 }} />
        {/* arms sweep wide */}
        <M.line x1="108" y1="62" x2="70" y2="64" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" animate={{ x1: [108, 104, 108] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
        <M.line x1="132" y1="62" x2="170" y2="64" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" animate={{ x1: [132, 136, 132] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
        {/* outward arrows */}
        <M.g animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.4, repeat: Infinity }}>
          <path d="M 78 50 L 60 50 M 64 46 L 60 50 L 64 54" stroke={`${GOLD}d0`} strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M 162 50 L 180 50 M 176 46 L 180 50 L 176 54" stroke={`${GOLD}d0`} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </M.g>
      </svg>
    );
  }

  if (style === "core-flexion") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* cable tower top */}
        <rect x="180" y="14" width="14" height="22" rx="2" fill="rgba(255,255,255,0.04)" stroke={`${accent}50`} strokeWidth="0.8" />
        <M.line x1="187" y1="36" x2="130" y2="58" stroke={`${accent}c0`} strokeWidth="1.4" strokeDasharray="3 2" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.2, repeat: Infinity }} />
        <circle cx="130" cy="58" r="4" fill={`${accent}d8`} />
        {/* kneeling crunch silhouette */}
        <ellipse cx="100" cy="60" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d="M 90 70 Q 76 86 90 110 L 120 110 Q 134 86 110 70 Z" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* abs highlighted */}
        <M.rect x="92" y="80" width="20" height="22" rx="2" fill={`${GOLD}66`} stroke={`${GOLD}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.2, repeat: Infinity }} />
        {/* knees */}
        <rect x="80" y="118" width="60" height="14" rx="3" fill={`${accent}20`} stroke={`${accent}50`} strokeWidth="0.5" />
        {/* flexion arrow */}
        <M.path d="M 80 56 Q 60 80 80 110" fill="none" stroke={`${GOLD}c0`} strokeWidth="1.4" strokeDasharray="2 2" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.2, repeat: Infinity }} />
      </svg>
    );
  }

  if (style === "core-hang") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* bar */}
        <line x1="60" y1="22" x2="180" y2="22" stroke={`${accent}d8`} strokeWidth="3" strokeLinecap="round" />
        <rect x="56" y="14" width="6" height="18" rx="1" fill={`${accent}80`} />
        <rect x="178" y="14" width="6" height="18" rx="1" fill={`${accent}80`} />
        {/* arms */}
        <line x1="110" y1="22" x2="110" y2="44" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="130" y1="22" x2="130" y2="44" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        {/* torso */}
        <ellipse cx="120" cy="48" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d="M 110 58 Q 104 76 110 100 L 130 100 Q 136 76 130 58 Z" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* lower abs highlight */}
        <M.rect x="112" y="76" width="16" height="22" rx="2" fill={`${GOLD}66`} stroke={`${GOLD}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.2, repeat: Infinity }} />
        {/* tucked knees (animated lift) */}
        <M.g animate={{ y: [0, -10, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}>
          <rect x="106" y="102" width="28" height="14" rx="3" fill={`${accent}25`} stroke={`${accent}60`} strokeWidth="0.6" />
          <line x1="112" y1="116" x2="112" y2="130" stroke={torsoStroke} strokeWidth="2" strokeLinecap="round" />
          <line x1="128" y1="116" x2="128" y2="130" stroke={torsoStroke} strokeWidth="2" strokeLinecap="round" />
        </M.g>
        {/* up arrow */}
        <M.path d="M 90 100 L 90 80 M 86 84 L 90 80 L 94 84" stroke={`${GOLD}d0`} strokeWidth="1.4" fill="none" strokeLinecap="round" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.2, repeat: Infinity }} />
      </svg>
    );
  }

  if (style === "core-anti-rotation") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* cable tower (side) */}
        <rect x="20" y="40" width="14" height="80" rx="2" fill="rgba(255,255,255,0.025)" stroke={`${accent}50`} strokeWidth="0.8" />
        <circle cx="27" cy="70" r="3" fill={`${accent}d8`} />
        {/* cable + handle */}
        <M.line x1="27" y1="70" x2="120" y2="80" stroke={`${accent}c0`} strokeWidth="1.4" strokeDasharray="3 2" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.2, repeat: Infinity }} />
        <circle cx="120" cy="80" r="4" fill={`${accent}d8`} />
        {/* athlete standing perpendicular */}
        <ellipse cx="170" cy="50" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${170 - shoulderOffset} 60 Q ${170 - shoulderOffset - 2} 84 ${170 - 12} 130 L ${170 + 12} 130 Q ${170 + shoulderOffset + 2} 84 ${170 + shoulderOffset} 60 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* obliques highlight */}
        <M.path d={`M ${170 - 12} 76 L ${170 - 4} 96 L ${170 + 4} 96 L ${170 + 12} 76 Z`} fill={`${VIOLET}66`} stroke={`${VIOLET}cc`} strokeWidth="0.8" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.2, repeat: Infinity }} />
        {/* arms gripping handle (pressed out) */}
        <line x1="160" y1="78" x2="120" y2="80" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="160" y1="84" x2="120" y2="80" stroke={torsoStroke} strokeWidth="2.5" strokeLinecap="round" />
        {/* pulling force arrow */}
        <M.g animate={{ x: [-2, 4, -2] }} transition={{ duration: 2.4, repeat: Infinity }}>
          <path d="M 96 72 L 78 72 M 82 68 L 78 72 L 82 76" stroke={`${RED}d0`} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </M.g>
        <text x="42" y="68" fontSize="6.5" fill="rgba(255,255,255,0.42)" fontFamily="monospace">Resist rotation</text>
      </svg>
    );
  }

  if (style === "core-vacuum") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* standing athlete */}
        <ellipse cx="120" cy="32" rx="10" ry="11" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${120 - shoulderOffset} 44 Q ${120 - shoulderOffset - 4} 70 ${120 - 8} 90 L ${120 + 8} 90 Q ${120 + shoulderOffset + 4} 70 ${120 + shoulderOffset} 44 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* lower torso/waist */}
        <path d={`M ${120 - 8} 90 L ${120 - 12} 138 L ${120 + 12} 138 L ${120 + 8} 90 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* vacuum hollow effect: dashed contracting circle on belly */}
        <M.ellipse cx="120" cy="110" rx="14" ry="14" fill="none" stroke={`${VIOLET}cc`} strokeWidth="1.2" strokeDasharray="3 2" animate={{ rx: [14, 9, 14], ry: [14, 9, 14], opacity: [0.6, 1, 0.6] }} transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }} />
        <M.ellipse cx="120" cy="110" rx="10" ry="10" fill={`${VIOLET}30`} animate={{ rx: [10, 5, 10], ry: [10, 5, 10], opacity: [0.35, 0.7, 0.35] }} transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }} />
        <text x="148" y="112" fontSize="7" fill={`${VIOLET}c0`} fontFamily="monospace">Ribs ↑ in</text>
      </svg>
    );
  }

  if (style === "cardio-walk" || style === "cardio-zone2") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* treadmill belt */}
        <path d="M 30 130 L 200 80 L 220 86 L 50 138 Z" fill="rgba(255,255,255,0.04)" stroke={`${accent}50`} strokeWidth="1" />
        <line x1="34" y1="128" x2="216" y2="84" stroke={`${accent}50`} strokeWidth="0.6" strokeDasharray="3 3" />
        {/* incline angle */}
        <text x="34" y="148" fontSize="7" fill={`${accent}b0`} fontFamily="monospace">12-15° incline</text>
        {/* athlete walking */}
        <ellipse cx="160" cy="52" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${160 - shoulderOffset} 62 Q ${160 - shoulderOffset - 2} 80 ${160 - 10} 100 L ${160 + 10} 100 Q ${160 + shoulderOffset + 2} 80 ${160 + shoulderOffset} 62 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* legs in stride */}
        <M.line x1="155" y1="100" x2="146" y2="126" stroke={torsoStroke} strokeWidth="2.6" strokeLinecap="round" animate={{ x2: [144, 152, 144] }} transition={{ duration: 1.4, repeat: Infinity }} />
        <M.line x1="165" y1="100" x2="172" y2="124" stroke={torsoStroke} strokeWidth="2.6" strokeLinecap="round" animate={{ x2: [174, 166, 174] }} transition={{ duration: 1.4, repeat: Infinity }} />
        {/* arm swing */}
        <M.line x1="152" y1="74" x2="142" y2="92" stroke={torsoStroke} strokeWidth="2.4" strokeLinecap="round" animate={{ x2: [140, 148, 140] }} transition={{ duration: 1.4, repeat: Infinity }} />
        {/* HR indicator */}
        <M.g animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 0.9, repeat: Infinity }} style={{ transformOrigin: "60px 56px" }}>
          <path d="M 60 56 a 6 6 0 1 1 -12 0 a 6 6 0 1 1 12 0" fill={`${RED}80`} />
        </M.g>
        <text x="64" y="60" fontSize="7" fill={`${RED}c0`} fontFamily="monospace">Zone 2</text>
      </svg>
    );
  }

  if (style === "cardio-cooldown") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        <path d="M 30 122 L 210 122" stroke={`${accent}50`} strokeWidth="1" strokeDasharray="3 3" />
        {/* athlete walking flat */}
        <ellipse cx="120" cy="46" rx="9" ry="10" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d={`M ${120 - shoulderOffset} 56 Q ${120 - shoulderOffset - 2} 74 ${120 - 10} 96 L ${120 + 10} 96 Q ${120 + shoulderOffset + 2} 74 ${120 + shoulderOffset} 56 Z`} fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        <M.line x1="115" y1="96" x2="108" y2="120" stroke={torsoStroke} strokeWidth="2.6" strokeLinecap="round" animate={{ x2: [106, 114, 106] }} transition={{ duration: 1.8, repeat: Infinity }} />
        <M.line x1="125" y1="96" x2="132" y2="120" stroke={torsoStroke} strokeWidth="2.6" strokeLinecap="round" animate={{ x2: [134, 126, 134] }} transition={{ duration: 1.8, repeat: Infinity }} />
        <text x="120" y="142" fontSize="7" fill={`${accent}c0`} fontFamily="monospace" textAnchor="middle">Easy cooldown</text>
      </svg>
    );
  }

  if (style === "recovery-sauna") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* sauna cabin */}
        <rect x="60" y="30" width="120" height="110" rx="6" fill="rgba(255,255,255,0.025)" stroke={`${accent}60`} strokeWidth="1" />
        <line x1="60" y1="46" x2="180" y2="46" stroke={`${accent}40`} strokeWidth="0.6" />
        <line x1="60" y1="58" x2="180" y2="58" stroke={`${accent}40`} strokeWidth="0.6" />
        {/* bench */}
        <rect x="74" y="100" width="92" height="8" rx="2" fill={`${accent}40`} />
        {/* athlete seated */}
        <ellipse cx="120" cy="70" rx="8" ry="9" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d="M 110 80 Q 104 96 116 100 L 124 100 Q 136 96 130 80 Z" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* heat ripples */}
        <M.path d="M 90 38 Q 96 32 102 38 Q 108 44 114 38" fill="none" stroke={`${RED}c0`} strokeWidth="1.2" animate={{ y: [-2, 4, -2], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
        <M.path d="M 126 38 Q 132 32 138 38 Q 144 44 150 38" fill="none" stroke={`${RED}c0`} strokeWidth="1.2" animate={{ y: [-2, 4, -2], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }} />
        <text x="120" y="148" fontSize="7" fill={`${accent}b0`} fontFamily="monospace" textAnchor="middle">Optional · tolerance tracked</text>
      </svg>
    );
  }

  if (style === "recovery-hydration") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* glass with water */}
        <path d="M 100 40 L 96 130 L 144 130 L 140 40 Z" fill="rgba(125,211,238,0.06)" stroke={`${STEEL}c0`} strokeWidth="1.2" />
        <M.path d="M 99 56 L 97 130 L 143 130 L 141 56 Z" fill={`${STEEL}45`} animate={{ opacity: [0.5, 0.85, 0.5] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} />
        {/* droplets */}
        <M.circle cx="160" cy="60" r="3" fill={`${STEEL}c0`} animate={{ y: [-4, 14, -4], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
        <M.circle cx="174" cy="80" r="2.5" fill={`${STEEL}a0`} animate={{ y: [-2, 12, -2], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} />
        <M.circle cx="80" cy="70" r="3" fill={`${STEEL}c0`} animate={{ y: [-3, 13, -3], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.8 }} />
        <text x="120" y="148" fontSize="7" fill={`${STEEL}c0`} fontFamily="monospace" textAnchor="middle">Water ready · routine logged</text>
      </svg>
    );
  }

  if (style === "recovery-cooldown") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* shower frame */}
        <rect x="70" y="20" width="100" height="12" rx="2" fill={`${accent}30`} stroke={`${accent}80`} strokeWidth="1" />
        {/* water lines */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <M.line key={i} x1={80 + i * 16} y1="34" x2={80 + i * 16} y2="120" stroke={`${STEEL}aa`} strokeWidth="1" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }} />
        ))}
        {/* snowflake */}
        <g transform="translate(190 60)">
          <line x1="0" y1="-10" x2="0" y2="10" stroke={`${STEEL}d0`} strokeWidth="1.2" />
          <line x1="-10" y1="0" x2="10" y2="0" stroke={`${STEEL}d0`} strokeWidth="1.2" />
          <line x1="-7" y1="-7" x2="7" y2="7" stroke={`${STEEL}d0`} strokeWidth="1.2" />
          <line x1="-7" y1="7" x2="7" y2="-7" stroke={`${STEEL}d0`} strokeWidth="1.2" />
        </g>
        <text x="120" y="148" fontSize="7" fill={`${STEEL}c0`} fontFamily="monospace" textAnchor="middle">Cool wash · 30-60s</text>
      </svg>
    );
  }

  if (style === "recovery-breath") {
    return (
      <svg viewBox="0 0 240 160" className="h-44 w-full">
        {/* athlete head + chest */}
        <ellipse cx="120" cy="62" rx="12" ry="13" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.6" />
        <path d="M 106 76 Q 100 96 112 124 L 128 124 Q 140 96 134 76 Z" fill={torsoColor} stroke={torsoStroke} strokeWidth="0.7" />
        {/* breath rings expanding */}
        <M.circle cx="120" cy="62" r="22" fill="none" stroke={`${VIOLET}80`} strokeWidth="1" animate={{ r: [22, 52, 22], opacity: [0.6, 0, 0.6] }} transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }} />
        <M.circle cx="120" cy="62" r="22" fill="none" stroke={`${VIOLET}60`} strokeWidth="1" animate={{ r: [22, 52, 22], opacity: [0.5, 0, 0.5] }} transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }} />
        <text x="120" y="148" fontSize="7" fill={`${VIOLET}c0`} fontFamily="monospace" textAnchor="middle">4s in · 8s out · 6 cycles</text>
      </svg>
    );
  }

  return null;
}

export function MovementVisualChamber({
  movement,
  accent = GOLD,
  gender = "neutral",
  compact = false,
}: {
  movement: Movement;
  accent?: string;
  gender?: SilhouetteGender;
  compact?: boolean;
}) {
  const M = useStillMotion();
  const reduce = useReducedMotion();

  // Ultra-HD movement visual system. Support blocks (recovery / cardio / sauna
  // handoff) render a support card, never an exercise image. A shipped cinematic
  // asset renders the real image; otherwise we keep the current anatomy HUD /
  // SVG scene below as the premium "visual pending" fallback.
  const imgVisual = getMovementVisual({
    id: movement.id, name: movement.name, primaryMuscles: movement.primaryMuscles, equipment: movement.equipmentName, role: movement.role,
  });
  if (imgVisual.kind !== "exercise") {
    return <MovementVisualMedia visual={imgVisual} gender={gender} accent={accent} compact={compact} />;
  }
  // Show the gender-aware media frame only when the resolved variant has shipped
  // assets; otherwise fall through to the anatomy HUD / SVG scene below.
  if (selectMediaVariant(imgVisual, gender).variant?.ready) {
    return <MovementVisualMedia visual={imgVisual} gender={gender} accent={accent} compact={compact} />;
  }

  const visual = MOVEMENT_VISUALS[movement.id];
  if (!visual) {
    // graceful fallback to legacy illustration
    return <MovementIllustration movement={movement} accent={accent} />;
  }
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        borderColor: `${accent}28`,
        background: "linear-gradient(168deg, rgba(10,12,18,0.94) 0%, rgba(6,7,11,0.99) 100%)",
        boxShadow: [
          "inset 0 1px 0 rgba(255,255,255,0.05)",
          `inset 0 0 0 1px ${accent}10`,
          "0 12px 36px rgba(0,0,0,0.42)",
          `0 0 32px ${accent}10`,
        ].join(", "),
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }} />
      {/* glass chamber ambient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(213,177,95,0.12),transparent_42%)]" />
      {/* scanning line */}
      {!reduce && (
        <M.div
          className="pointer-events-none absolute inset-x-2 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${STEEL}80, transparent)` }}
          animate={{ y: [10, compact ? 110 : 150, 10] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "linear" }}
        />
      )}
      {/* corner ticks */}
      <div className="pointer-events-none absolute left-2.5 top-2.5 h-2.5 w-2.5 border-l border-t" style={{ borderColor: `${accent}55` }} />
      <div className="pointer-events-none absolute right-2.5 top-2.5 h-2.5 w-2.5 border-r border-t" style={{ borderColor: `${STEEL}55` }} />
      <div className="pointer-events-none absolute bottom-2.5 left-2.5 h-2.5 w-2.5 border-b border-l" style={{ borderColor: `${STEEL}55` }} />
      <div className="pointer-events-none absolute bottom-2.5 right-2.5 h-2.5 w-2.5 border-b border-r" style={{ borderColor: `${accent}55` }} />

      <div className={`relative ${compact ? "p-3" : "p-4"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Scan size={11} style={{ color: `${accent}c0` }} />
            <p className="font-mono text-[8px] uppercase tracking-[0.24em]" style={{ color: `${accent}cc` }}>Movement Visual</p>
          </div>
          <span className="rounded-md border border-white/[0.08] bg-black/30 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.18em] text-white/45">
            {movement.mode}
          </span>
        </div>
        <div className={`relative mt-1.5 grid place-items-center overflow-hidden rounded-xl border border-white/[0.05] bg-black/30 ${compact ? "p-1.5" : "p-2"}`} style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}>
          <MovementVisualScene style={visual.visualStyle} accent={accent} gender={gender} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <div className="rounded-lg bg-white/[0.02] px-2 py-1.5">
            <p className="font-mono text-[7px] uppercase tracking-[0.2em] text-white/30">View</p>
            <p className="mt-0.5 text-[10px] leading-[1.4] text-white/65">{visual.viewAngle}</p>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-2 py-1.5">
            <p className="font-mono text-[7px] uppercase tracking-[0.2em] text-white/30">Position</p>
            <p className="mt-0.5 text-[10px] leading-[1.4] text-white/65">{visual.bodyPosition}</p>
          </div>
          <div className="col-span-2 rounded-lg bg-white/[0.02] px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <Move size={9} style={{ color: `${GOLD}c0` }} />
              <p className="font-mono text-[7px] uppercase tracking-[0.2em]" style={{ color: `${GOLD}b0` }}>Movement path</p>
            </div>
            <p className="mt-0.5 text-[10.5px] leading-[1.45] text-white/65">{visual.movementPath}</p>
          </div>
          {!compact && (
            <>
              <div className="rounded-lg bg-white/[0.02] px-2 py-1.5">
                <p className="font-mono text-[7px] uppercase tracking-[0.2em]" style={{ color: `${STEEL}b0` }}>Setup</p>
                <p className="mt-0.5 text-[10px] leading-[1.4] text-white/55">{visual.setupCue}</p>
              </div>
              <div className="rounded-lg bg-[#ef7d55]/[0.04] px-2 py-1.5">
                <p className="font-mono text-[7px] uppercase tracking-[0.2em]" style={{ color: `${RED}c0` }}>Common error</p>
                <p className="mt-0.5 text-[10px] leading-[1.4] text-white/55">{visual.commonError}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


export function MuscleSilhouette({ movement, big = false, gender = "neutral" }: { movement: Movement; big?: boolean; gender?: SilhouetteGender }) {
  const M = useStillMotion();
  const hasUpperChest = movement.primaryMuscles.some((m) => /upper chest/i.test(m));
  const hasChest = movement.primaryMuscles.some((m) => /chest/i.test(m));
  const hasLats = movement.primaryMuscles.some((m) => /lat/i.test(m));
  const hasMidBack = movement.primaryMuscles.some((m) => /mid back|rhomboid/i.test(m)) || movement.secondaryMuscles.some((m) => /mid back|rhomboid/i.test(m));
  const hasRearDelts = movement.primaryMuscles.some((m) => /rear delt/i.test(m));
  const hasFrontDelts = movement.secondaryMuscles.some((m) => /front delt/i.test(m));
  const hasTriceps = movement.secondaryMuscles.some((m) => /tricep/i.test(m));
  const hasBiceps = movement.secondaryMuscles.some((m) => /bicep/i.test(m));

  const h = big ? 240 : 140;

  // Gender silhouette: subtly adapts shoulder width + waist taper without stereotyping
  // male:    slightly broader shoulders (path expands outward at top)
  // female:  refined athletic taper (slightly narrower shoulders, tighter waist line)
  // neutral: balanced
  const torsoPath =
    gender === "male"
      ? "M 40 40 Q 28 44 24 60 L 22 110 Q 34 116 50 118 L 50 138 L 64 144 L 70 145 L 76 144 L 90 138 L 90 118 Q 106 116 118 110 L 116 60 Q 112 44 100 40 Z"
      : gender === "female"
        ? "M 44 40 Q 36 44 32 60 L 28 92 Q 34 100 36 110 Q 42 118 50 120 L 50 138 L 64 144 L 70 145 L 76 144 L 90 138 L 90 120 Q 98 118 104 110 Q 106 100 112 92 L 108 60 Q 104 44 96 40 Z"
        : "M 42 40 Q 32 44 28 60 L 26 110 Q 36 116 50 118 L 50 138 L 64 144 L 70 145 L 76 144 L 90 138 L 90 118 Q 104 116 114 110 L 112 60 Q 108 44 98 40 Z";

  return (
    <svg viewBox="0 0 140 180" className="w-auto" style={{ height: h }}>
      <ellipse cx="70" cy="18" rx="14" ry="15" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
      <rect x="64" y="32" width="12" height="8" fill="rgba(255,255,255,0.04)" />
      <path d={torsoPath} fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.075)" strokeWidth="0.8" />
      <path d="M 28 60 Q 18 68 16 90 L 18 112 L 30 112 L 32 76 Z" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />
      <path d="M 112 60 Q 122 68 124 90 L 122 112 L 110 112 L 108 76 Z" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />
      {hasUpperChest && (
        <M.path d="M 46 44 Q 54 42 70 42 Q 86 42 94 44 L 92 58 Q 80 60 70 60 Q 60 60 48 58 Z" fill={`${GOLD}55`} stroke={`${GOLD}c0`} strokeWidth="0.8" animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
      )}
      {hasChest && !hasUpperChest && (
        <M.path d="M 46 50 Q 54 48 70 48 Q 86 48 94 50 L 92 70 Q 80 72 70 72 Q 60 72 48 70 Z" fill={`${GOLD}48`} stroke={`${GOLD}a0`} strokeWidth="0.8" animate={{ opacity: [0.65, 1, 0.65] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
      )}
      {hasLats && (<>
        <M.path d="M 28 70 Q 36 74 38 90 L 36 108 Q 30 110 26 108 L 28 78 Z" fill={`${STEEL}48`} stroke={`${STEEL}a0`} strokeWidth="0.8" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }} />
        <M.path d="M 112 70 Q 104 74 102 90 L 104 108 Q 110 110 114 108 L 112 78 Z" fill={`${STEEL}48`} stroke={`${STEEL}a0`} strokeWidth="0.8" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }} />
      </>)}
      {hasMidBack && (
        <M.rect x="46" y="68" width="48" height="18" rx="3" fill={`${STEEL}30`} stroke={`${STEEL}80`} strokeWidth="0.6" animate={{ opacity: [0.5, 0.85, 0.5] }} transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.6 }} />
      )}
      {hasRearDelts && (<>
        <M.ellipse cx="32" cy="48" rx="9" ry="7" fill={`${GOLD}58`} stroke={`${GOLD}b0`} strokeWidth="0.8" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
        <M.ellipse cx="108" cy="48" rx="9" ry="7" fill={`${GOLD}58`} stroke={`${GOLD}b0`} strokeWidth="0.8" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} />
      </>)}
      {hasFrontDelts && !hasRearDelts && (<>
        <ellipse cx="32" cy="48" rx="9" ry="7" fill={`${STEEL}28`} stroke={`${STEEL}60`} strokeWidth="0.6" />
        <ellipse cx="108" cy="48" rx="9" ry="7" fill={`${STEEL}28`} stroke={`${STEEL}60`} strokeWidth="0.6" />
      </>)}
      {hasTriceps && (<>
        <rect x="18" y="74" width="10" height="32" rx="3" fill={`${RED}22`} stroke={`${RED}60`} strokeWidth="0.6" />
        <rect x="112" y="74" width="10" height="32" rx="3" fill={`${RED}22`} stroke={`${RED}60`} strokeWidth="0.6" />
      </>)}
      {hasBiceps && (<>
        <rect x="20" y="72" width="8" height="30" rx="3" fill={`${STEEL}22`} stroke={`${STEEL}60`} strokeWidth="0.6" />
        <rect x="112" y="72" width="8" height="30" rx="3" fill={`${STEEL}22`} stroke={`${STEEL}60`} strokeWidth="0.6" />
      </>)}
    </svg>
  );
}

export function MuscleTargetIllustration({ movement }: { movement: Movement }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#060710] p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/30">Target Tissue</p>
        <Target size={10} style={{ color: `${GOLD}90` }} />
      </div>
      <div className="mt-2 flex justify-center"><MuscleSilhouette movement={movement} /></div>
      <div className="mt-3 space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {movement.primaryMuscles.map((m) => (
            <span key={m} className="rounded-md px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.14em]" style={{ background: `${GOLD}1c`, color: `${GOLD}d8`, border: `1px solid ${GOLD}30` }}>● {m}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {movement.secondaryMuscles.map((m) => (
            <span key={m} className="rounded-md px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.14em]" style={{ background: `${STEEL}14`, color: `${STEEL}aa` }}>{m}</span>
          ))}
        </div>
        {movement.stabilizers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {movement.stabilizers.map((m) => (
              <span key={m} className="rounded-md px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.14em] text-white/35" style={{ background: "rgba(255,255,255,0.03)" }}>◌ {m}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
