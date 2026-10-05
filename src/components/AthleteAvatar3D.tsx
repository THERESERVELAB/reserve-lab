"use client";

import { motion, useReducedMotion } from "framer-motion";

import {
  AvatarAura,
  FocusZone,
  PhysiqueArchetype,
  PhysiqueGoal,
  useAthleteDashboardStore,
} from "@/lib/athlete-store";
import { GlassPanel } from "./ui/GlassPanel";

const AURA_COLORS: Record<AvatarAura, string> = {
  gold:   "#c8a060",   // champagne — warmer, less saturated
  teal:   "#4fa8c0",   // muted cyan — premium not neon
  violet: "#8870c0",   // deep violet — restrained
  red:    "#a04e30",   // controlled blood-amber — not toy red
};

const ARCHETYPE_CONFIG: Record<PhysiqueArchetype, {
  label: string; code: string; gender: "male" | "female";
  shoulderW: number; hipW: number; torsoW: number; armW: number;
}> = {
  "classic-physique":        { label: "Classic Physique",       code: "CPH", gender: "male",   shoulderW: 1.02, hipW: 0.88, torsoW: 0.95, armW: 0.98 },
  "mens-physique":           { label: "Men's Physique",          code: "MPH", gender: "male",   shoulderW: 1.06, hipW: 0.84, torsoW: 0.88, armW: 0.90 },
  "open-bodybuilding":       { label: "Open Bodybuilding",       code: "OBB", gender: "male",   shoulderW: 1.15, hipW: 1.02, torsoW: 1.12, armW: 1.16 },
  "powerbuilder":            { label: "Powerbuilder",            code: "PWB", gender: "male",   shoulderW: 1.08, hipW: 1.06, torsoW: 1.10, armW: 1.10 },
  "hybrid-athlete":          { label: "Hybrid Athlete",          code: "HYB", gender: "male",   shoulderW: 0.99, hipW: 0.96, torsoW: 0.97, armW: 0.97 },
  "functional-tactical":     { label: "Functional Tactical",     code: "FTC", gender: "male",   shoulderW: 0.96, hipW: 0.95, torsoW: 0.96, armW: 0.94 },
  "fat-loss-transformation": { label: "Fat Loss",                code: "FLT", gender: "male",   shoulderW: 0.90, hipW: 0.90, torsoW: 0.86, armW: 0.86 },
  "female-bikini":           { label: "Female Bikini",           code: "FBK", gender: "female", shoulderW: 0.82, hipW: 1.14, torsoW: 0.80, armW: 0.80 },
  "female-wellness":         { label: "Female Wellness",         code: "FWL", gender: "female", shoulderW: 0.84, hipW: 1.20, torsoW: 0.82, armW: 0.82 },
  "female-performance":      { label: "Female Performance",      code: "FPF", gender: "female", shoulderW: 0.89, hipW: 1.10, torsoW: 0.87, armW: 0.86 },
};

const PHYSIQUE_LABELS: Record<PhysiqueGoal, string> = {
  lean: "Lean Build", athletic: "Athletic", classic: "Classic", mass: "Mass Phase",
};

const FOCUS_ZONE_LABELS: Record<FocusZone, string> = {
  "upper-chest": "Upper Chest", delts: "Delts", lats: "Lats",
  arms: "Arms", quads: "Quads", hamstrings: "Hamstrings", core: "Core",
};

/* ─── Holographic Male Figure ──────────────────── */
function MaleFigureSVG({
  color, focusZones, weakPoints, sw, tw, hw, aw,
}: {
  color: string; focusZones: FocusZone[]; weakPoints: FocusZone[];
  sw: number; tw: number; hw: number; aw: number;
}) {
  const has   = (z: FocusZone) => focusZones.includes(z);
  const isWeak= (z: FocusZone) => weakPoints.includes(z) && !has(z);

  const fill = (zone: FocusZone): string => {
    if (has(zone))   return "url(#mgActive)";
    if (isWeak(zone))return "url(#mgWeak)";
    return "url(#mgNeutral)";
  };

  const glow = (zone: FocusZone): React.CSSProperties | undefined =>
    has(zone) ? { filter: `drop-shadow(0 0 6px ${color}88)` }
    : isWeak(zone) ? { filter: "drop-shadow(0 0 4px rgba(239,125,85,0.5))" }
    : undefined;

  const sw6 = 15 * sw;
  const tw4 = 25 * tw;
  const hw4 = 27 * hw;

  const lSx = 60 - sw6 - 18;
  const rSx = 60 + sw6 + 18;
  const lTx = 60 - tw4;
  const rTx = 60 + tw4;
  const lHx = 60 - hw4;
  const rHx = 60 + hw4;

  return (
    <svg viewBox="0 0 120 264" width="118" height="252" fill="none" aria-hidden="true"
      style={{ filter: `drop-shadow(0 0 16px ${color}1a)` }}>
      <defs>
        {/* Muscle fill gradients */}
        <radialGradient id="mgActive" cx="50%" cy="35%" r="62%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor={color} stopOpacity="0.97" />
          <stop offset="42%"  stopColor={color} stopOpacity="0.80" />
          <stop offset="100%" stopColor={color} stopOpacity="0.28" />
        </radialGradient>
        <radialGradient id="mgWeak" cx="50%" cy="35%" r="62%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#b06038" stopOpacity="0.42" />
          <stop offset="55%"  stopColor="#b06038" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#b06038" stopOpacity="0.05" />
        </radialGradient>
        <radialGradient id="mgNeutral" cx="50%" cy="35%" r="62%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#3a3e50" stopOpacity="0.52" />
          <stop offset="60%"  stopColor="#252838" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#10121a" stopOpacity="0.09" />
        </radialGradient>
        {/* Body depth gradient */}
        <radialGradient id="bodyDepth" cx="50%" cy="40%" r="58%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#1c2030" stopOpacity="0.92" />
          <stop offset="60%"  stopColor="#12141e" stopOpacity="0.97" />
          <stop offset="100%" stopColor="#060810" stopOpacity="0.99" />
        </radialGradient>
        {/* Ambient glow */}
        <radialGradient id="ambientGlow" cx="50%" cy="42%" r="54%" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={color} stopOpacity="0.10" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        {/* Holographic scan grid pattern */}
        <pattern id="holoGrid" width="10" height="10" patternUnits="userSpaceOnUse">
          <line x1="0" y1="5" x2="10" y2="5" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        </pattern>
        {/* Highlight shimmer gradient */}
        <linearGradient id="shimmer" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.16)" />
          <stop offset="50%"  stopColor="rgba(255,255,255,0.06)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      {/* Ambient glow layer */}
      <ellipse cx="60" cy="132" rx="56" ry="118" fill="url(#ambientGlow)" />

      {/* Holographic grid overlay */}
      <ellipse cx="60" cy="132" rx="54" ry="116" fill="url(#holoGrid)" opacity="0.6" />

      {/* ── HEAD ── */}
      <ellipse cx="60" cy="21" rx="13.5" ry="17.5" fill="url(#bodyDepth)" stroke={`${color}45`} strokeWidth="0.8" />
      {/* Ear line */}
      <path d="M 49.5 19 Q 47 21 49.5 25" fill="none" stroke={`${color}35`} strokeWidth="0.7" />
      <path d="M 70.5 19 Q 73 21 70.5 25" fill="none" stroke={`${color}35`} strokeWidth="0.7" />
      {/* Jaw line highlight */}
      <path d="M 51 30 Q 60 37 69 30" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />

      {/* ── NECK ── */}
      <rect x="54" y="37" width="12" height="10" rx="4" fill="url(#bodyDepth)" stroke={`${color}40`} strokeWidth="0.6" />
      {/* Neck highlight */}
      <path d="M 55 37 Q 60 35 65 37" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="0.7" />

      {/* ── TRAPS ── */}
      <path d={`M 55 37 C 45 40 ${lSx+13} 46 ${lSx} 58 L ${lSx+8} 64 C ${lSx+20} 55 50 48 57 45 Z`}
        fill={fill("delts")} style={glow("delts")} />
      <path d={`M 65 37 C 75 40 ${rSx-13} 46 ${rSx} 58 L ${rSx-8} 64 C ${rSx-20} 55 70 48 63 45 Z`}
        fill={fill("delts")} style={glow("delts")} />
      {/* Trap highlight */}
      <path d={`M 55 39 C 48 42 ${lSx+15} 48 ${lSx+4} 59`} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.7" />
      <path d={`M 65 39 C 72 42 ${rSx-15} 48 ${rSx-4} 59`} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.7" />

      {/* ── DELTOIDS ── */}
      <ellipse cx={lSx} cy="64" rx={Math.round(13.5 * sw)} ry="11.5" fill={fill("delts")} style={glow("delts")} />
      <ellipse cx={rSx} cy="64" rx={Math.round(13.5 * sw)} ry="11.5" fill={fill("delts")} style={glow("delts")} />
      {/* Delt highlight arc */}
      <path d={`M ${lSx-9*sw} 59 Q ${lSx} 55 ${lSx+9*sw} 59`} fill="none" stroke="url(#shimmer)" strokeWidth="1.2" />
      <path d={`M ${rSx-9*sw} 59 Q ${rSx} 55 ${rSx+9*sw} 59`} fill="none" stroke="url(#shimmer)" strokeWidth="1.2" />

      {/* ── LATS ── */}
      <path d={`M ${lSx+4} 62 C ${lSx-10} 78 ${lSx-9} 102 ${lSx-6} 113 C ${lSx-2} 121 ${lTx+7} 119 ${lTx+9} 111 C ${lTx+13} 94 ${lTx+14} 72 ${lTx+8} 60 Z`}
        fill={fill("lats")} style={glow("lats")} />
      <path d={`M ${rSx-4} 62 C ${rSx+10} 78 ${rSx+9} 102 ${rSx+6} 113 C ${rSx+2} 121 ${rTx-7} 119 ${rTx-9} 111 C ${rTx-13} 94 ${rTx-14} 72 ${rTx-8} 60 Z`}
        fill={fill("lats")} style={glow("lats")} />
      {/* Lat highlight */}
      <path d={`M ${lSx+4} 63 C ${lSx-3} 75 ${lSx-5} 92 ${lSx-4} 108`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
      <path d={`M ${rSx-4} 63 C ${rSx+3} 75 ${rSx+5} 92 ${rSx+4} 108`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />

      {/* ── TORSO BASE (body) ── */}
      <path d={`M ${lTx} 59 C ${lTx-5} 65 ${lTx-5} 126 ${lTx} 131 Q 60 137 ${rTx} 131 C ${rTx+5} 126 ${rTx+5} 65 ${rTx} 59 Q 60 55 ${lTx} 59 Z`}
        fill="url(#bodyDepth)" stroke={`${color}30`} strokeWidth="0.5" />

      {/* ── CHEST — upper pec ── */}
      <ellipse cx={lTx+14} cy="72" rx="18" ry="15" fill={fill("upper-chest")} style={glow("upper-chest")} />
      <ellipse cx={rTx-14} cy="72" rx="18" ry="15" fill={fill("upper-chest")} style={glow("upper-chest")} />
      {/* Chest highlight arc */}
      <path d={`M ${lTx+2} 60 Q ${lTx+14} 55 ${lTx+28} 62`} fill="none" stroke="url(#shimmer)" strokeWidth="1.5" />
      <path d={`M ${rTx-2} 60 Q ${rTx-14} 55 ${rTx-28} 62`} fill="none" stroke="url(#shimmer)" strokeWidth="1.5" />
      {/* Chest divide + sternal line */}
      <line x1="60" y1="57" x2="60" y2="88" stroke={`${color}40`} strokeWidth="0.7" strokeDasharray="2 2.5" />
      {/* Pec-delt groove */}
      <path d={`M ${lSx+4} 62 Q ${lTx+18} 68 ${lTx+2} 60`} fill="none" stroke={`${color}30`} strokeWidth="0.6" />
      <path d={`M ${rSx-4} 62 Q ${rTx-18} 68 ${rTx-2} 60`} fill="none" stroke={`${color}30`} strokeWidth="0.6" />

      {/* ── ABS / CORE ── */}
      <rect x="43" y="88" width="34" height="42" rx="7" fill={fill("core")} style={glow("core")} />
      {/* Ab grid lines */}
      <line x1="60" y1="88" x2="60" y2="130" stroke={`${color}50`} strokeWidth="0.7" />
      <line x1="44" y1="100" x2="76" y2="100" stroke={`${color}38`} strokeWidth="0.6" opacity="0.8" />
      <line x1="44" y1="114" x2="76" y2="114" stroke={`${color}38`} strokeWidth="0.6" opacity="0.8" />
      {/* Ab highlight */}
      <path d="M 45 90 Q 53 86 60 88" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.9" />

      {/* ── OBLIQUES ── */}
      <ellipse cx={lTx+2} cy="100" rx="8" ry="22" fill={fill("core")} opacity="0.45" />
      <ellipse cx={rTx-2} cy="100" rx="8" ry="22" fill={fill("core")} opacity="0.45" />
      {/* Serratus lines */}
      <path d={`M ${lTx+4} 82 L ${lTx-4} 92`} fill="none" stroke={`${color}28`} strokeWidth="0.6" />
      <path d={`M ${lTx+4} 90 L ${lTx-4} 100`} fill="none" stroke={`${color}28`} strokeWidth="0.6" />
      <path d={`M ${rTx-4} 82 L ${rTx+4} 92`} fill="none" stroke={`${color}28`} strokeWidth="0.6" />
      <path d={`M ${rTx-4} 90 L ${rTx+4} 100`} fill="none" stroke={`${color}28`} strokeWidth="0.6" />

      {/* ── UPPER ARMS (BICEPS) ── */}
      <ellipse cx={lSx-1} cy="87" rx={Math.round(9.5 * aw)} ry="20" fill={fill("arms")} style={glow("arms")} />
      <ellipse cx={rSx+1} cy="87" rx={Math.round(9.5 * aw)} ry="20" fill={fill("arms")} style={glow("arms")} />
      {/* Bicep peak highlight */}
      <path d={`M ${lSx-6*aw} 75 Q ${lSx} 70 ${lSx+6*aw} 75`} fill="none" stroke="url(#shimmer)" strokeWidth="1.1" />
      <path d={`M ${rSx-6*aw} 75 Q ${rSx} 70 ${rSx+6*aw} 75`} fill="none" stroke="url(#shimmer)" strokeWidth="1.1" />
      {/* Bicep/tricep separation line */}
      <path d={`M ${lSx+5*aw} 76 L ${lSx+5*aw} 104`} fill="none" stroke={`${color}30`} strokeWidth="0.6" />
      <path d={`M ${rSx-5*aw} 76 L ${rSx-5*aw} 104`} fill="none" stroke={`${color}30`} strokeWidth="0.6" />

      {/* ── FOREARMS ── */}
      <path d={`M ${lSx-8*aw} 106 C ${lSx-10*aw} 118 ${lSx-10*aw} 132 ${lSx-8*aw} 140 C ${lSx-5*aw} 147 ${lSx+2*aw} 147 ${lSx+4*aw} 140 C ${lSx+5*aw} 132 ${lSx+5*aw} 118 ${lSx+3*aw} 107 Z`}
        fill={fill("arms")} opacity="0.68" />
      <path d={`M ${rSx+8*aw} 106 C ${rSx+10*aw} 118 ${rSx+10*aw} 132 ${rSx+8*aw} 140 C ${rSx+5*aw} 147 ${rSx-2*aw} 147 ${rSx-4*aw} 140 C ${rSx-5*aw} 132 ${rSx-5*aw} 118 ${rSx-3*aw} 107 Z`}
        fill={fill("arms")} opacity="0.68" />
      {/* Forearm vascularity */}
      <path d={`M ${lSx} 110 C ${lSx-2} 118 ${lSx-2} 128 ${lSx} 136`} fill="none" stroke={`${color}20`} strokeWidth="0.5" />
      <path d={`M ${rSx} 110 C ${rSx+2} 118 ${rSx+2} 128 ${rSx} 136`} fill="none" stroke={`${color}20`} strokeWidth="0.5" />

      {/* ── HIPS ── */}
      <path d={`M ${lTx} 131 C ${lTx-2} 133 ${lHx} 137 ${lHx} 141 Q 60 148 ${rHx} 141 C ${rHx} 137 ${rTx+2} 133 ${rTx} 131 Z`}
        fill="url(#bodyDepth)" stroke={`${color}28`} strokeWidth="0.5" />

      {/* ── QUADS ── */}
      <path d={`M ${lHx+2} 140 C ${lHx-7} 156 ${lHx-6} 176 ${lHx-2} 188 C ${lHx+2} 196 ${lHx+14} 197 ${lHx+18} 189 C ${lHx+22} 175 ${lHx+20} 154 ${lHx+14} 142 Z`}
        fill={fill("quads")} style={glow("quads")} />
      <path d={`M ${rHx-2} 140 C ${rHx+7} 156 ${rHx+6} 176 ${rHx+2} 188 C ${rHx-2} 196 ${rHx-14} 197 ${rHx-18} 189 C ${rHx-22} 175 ${rHx-20} 154 ${rHx-14} 142 Z`}
        fill={fill("quads")} style={glow("quads")} />
      {/* Quad sweep highlight */}
      <path d={`M ${lHx+2} 141 C ${lHx-4} 154 ${lHx-4} 170 ${lHx} 184`} fill="none" stroke="url(#shimmer)" strokeWidth="1.2" />
      <path d={`M ${rHx-2} 141 C ${rHx+4} 154 ${rHx+4} 170 ${rHx} 184`} fill="none" stroke="url(#shimmer)" strokeWidth="1.2" />
      {/* VMO tear-drop */}
      <ellipse cx={lHx+17} cy="185" rx="7" ry="9" fill={fill("quads")} opacity="0.6" />
      <ellipse cx={rHx-17} cy="185" rx="7" ry="9" fill={fill("quads")} opacity="0.6" />
      {/* Quad separation lines */}
      <path d={`M ${lHx+8} 148 L ${lHx+10} 178`} fill="none" stroke={`${color}25`} strokeWidth="0.6" />
      <path d={`M ${rHx-8} 148 L ${rHx-10} 178`} fill="none" stroke={`${color}25`} strokeWidth="0.6" />

      {/* ── HAMSTRINGS ── */}
      <ellipse cx={lHx+10} cy="163" rx="9" ry="23" fill={fill("hamstrings")} opacity="0.42" />
      <ellipse cx={rHx-10} cy="163" rx="9" ry="23" fill={fill("hamstrings")} opacity="0.42" />

      {/* ── KNEE CAP ── */}
      <ellipse cx={lHx+9}  cy="193" rx="11" ry="7" fill="url(#bodyDepth)" stroke={`${color}35`} strokeWidth="0.6" />
      <ellipse cx={rHx-9}  cy="193" rx="11" ry="7" fill="url(#bodyDepth)" stroke={`${color}35`} strokeWidth="0.6" />

      {/* ── CALVES ── */}
      <path d={`M ${lHx} 193 C ${lHx-6} 208 ${lHx-6} 220 ${lHx-2} 231 C ${lHx+2} 238 ${lHx+12} 238 ${lHx+15} 231 C ${lHx+18} 220 ${lHx+16} 207 ${lHx+10} 195 Z`}
        fill="url(#mgNeutral)" stroke={`${color}28`} strokeWidth="0.7" />
      <path d={`M ${rHx} 193 C ${rHx+6} 208 ${rHx+6} 220 ${rHx+2} 231 C ${rHx-2} 238 ${rHx-12} 238 ${rHx-15} 231 C ${rHx-18} 220 ${rHx-16} 207 ${rHx-10} 195 Z`}
        fill="url(#mgNeutral)" stroke={`${color}28`} strokeWidth="0.7" />
      {/* Calf medial line */}
      <path d={`M ${lHx+8} 196 C ${lHx+7} 210 ${lHx+7} 222 ${lHx+8} 230`} fill="none" stroke={`${color}20`} strokeWidth="0.6" />
      <path d={`M ${rHx-8} 196 C ${rHx-7} 210 ${rHx-7} 222 ${rHx-8} 230`} fill="none" stroke={`${color}20`} strokeWidth="0.6" />

      {/* ── FEET ── */}
      <ellipse cx={lHx+5}  cy="246" rx="13" ry="5" fill="url(#bodyDepth)" stroke={`${color}25`} strokeWidth="0.5" />
      <ellipse cx={rHx-5}  cy="246" rx="13" ry="5" fill="url(#bodyDepth)" stroke={`${color}25`} strokeWidth="0.5" />

      {/* ── SPINE / CENTER GLOW ── */}
      <line x1="60" y1="46" x2="60" y2="131" stroke={`${color}30`} strokeWidth="0.6" strokeDasharray="3 4" />
      <line x1="60" y1="46" x2="60" y2="131" stroke="rgba(255,255,255,0.03)" strokeWidth="2" />
    </svg>
  );
}

/* ─── Holographic Female Figure ────────────────── */
function FemaleFigureSVG({
  color, focusZones, weakPoints, sw, hw,
}: {
  color: string; focusZones: FocusZone[]; weakPoints: FocusZone[]; sw: number; hw: number;
}) {
  const has    = (z: FocusZone) => focusZones.includes(z);
  const isWeak = (z: FocusZone) => weakPoints.includes(z) && !has(z);
  const fill   = (zone: FocusZone): string => {
    if (has(zone))    return "url(#mgActiveF)";
    if (isWeak(zone)) return "url(#mgWeakF)";
    return "url(#mgNeutralF)";
  };
  const glow = (zone: FocusZone): React.CSSProperties | undefined =>
    has(zone) ? { filter: `drop-shadow(0 0 6px ${color}88)` }
    : isWeak(zone) ? { filter: "drop-shadow(0 0 4px rgba(239,125,85,0.5))" }
    : undefined;

  const lSx = 60 - 12 * sw - 14;
  const rSx = 60 + 12 * sw + 14;
  const lHx = 60 - 25 * hw;
  const rHx = 60 + 25 * hw;

  return (
    <svg viewBox="0 0 120 264" width="118" height="252" fill="none" aria-hidden="true"
      style={{ filter: `drop-shadow(0 0 16px ${color}1a)` }}>
      <defs>
        <radialGradient id="mgActiveF" cx="50%" cy="35%" r="62%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor={color} stopOpacity="0.97" />
          <stop offset="42%"  stopColor={color} stopOpacity="0.80" />
          <stop offset="100%" stopColor={color} stopOpacity="0.28" />
        </radialGradient>
        <radialGradient id="mgWeakF" cx="50%" cy="35%" r="62%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#b06038" stopOpacity="0.42" />
          <stop offset="55%"  stopColor="#b06038" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#b06038" stopOpacity="0.05" />
        </radialGradient>
        <radialGradient id="mgNeutralF" cx="50%" cy="35%" r="62%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#3a3e50" stopOpacity="0.52" />
          <stop offset="60%"  stopColor="#252838" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#10121a" stopOpacity="0.09" />
        </radialGradient>
        <radialGradient id="bodyDepthF" cx="50%" cy="40%" r="58%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#1c2030" stopOpacity="0.92" />
          <stop offset="60%"  stopColor="#12141e" stopOpacity="0.97" />
          <stop offset="100%" stopColor="#060810" stopOpacity="0.99" />
        </radialGradient>
        <radialGradient id="ambientF" cx="50%" cy="52%" r="54%" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={color} stopOpacity="0.10" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <pattern id="holoGridF" width="10" height="10" patternUnits="userSpaceOnUse">
          <line x1="0" y1="5" x2="10" y2="5" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        </pattern>
        <linearGradient id="shimmerF" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.16)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      <ellipse cx="60" cy="140" rx="56" ry="118" fill="url(#ambientF)" />
      <ellipse cx="60" cy="140" rx="54" ry="116" fill="url(#holoGridF)" opacity="0.6" />

      {/* HEAD */}
      <ellipse cx="60" cy="21" rx="13" ry="17" fill="url(#bodyDepthF)" stroke={`${color}45`} strokeWidth="0.8" />
      <path d="M 51 30 Q 60 37 69 30" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />

      {/* NECK */}
      <rect x="54.5" y="37" width="11" height="9" rx="4" fill="url(#bodyDepthF)" stroke={`${color}40`} strokeWidth="0.6" />

      {/* SHOULDERS */}
      <ellipse cx={lSx} cy="62" rx={Math.round(11 * sw)} ry="9" fill={fill("delts")} style={glow("delts")} />
      <ellipse cx={rSx} cy="62" rx={Math.round(11 * sw)} ry="9" fill={fill("delts")} style={glow("delts")} />
      <path d={`M ${lSx-7*sw} 57 Q ${lSx} 53 ${lSx+7*sw} 57`} fill="none" stroke="url(#shimmerF)" strokeWidth="1.0" />
      <path d={`M ${rSx-7*sw} 57 Q ${rSx} 53 ${rSx+7*sw} 57`} fill="none" stroke="url(#shimmerF)" strokeWidth="1.0" />

      {/* CHEST */}
      <ellipse cx="48" cy="73" rx="13" ry="12" fill={fill("upper-chest")} style={glow("upper-chest")} />
      <ellipse cx="72" cy="73" rx="13" ry="12" fill={fill("upper-chest")} style={glow("upper-chest")} />

      {/* TORSO */}
      <path d="M 43 62 C 38 67 38 118 43 124 Q 60 132 77 124 C 82 118 82 67 77 62 Q 60 57 43 62 Z"
        fill="url(#bodyDepthF)" stroke={`${color}30`} strokeWidth="0.5" />

      {/* CORE */}
      <rect x="45" y="88" width="30" height="35" rx="8" fill={fill("core")} style={glow("core")} />
      <line x1="60" y1="88" x2="60" y2="123" stroke={`${color}50`} strokeWidth="0.6" />
      <line x1="46" y1="104" x2="74" y2="104" stroke={`${color}35`} strokeWidth="0.6" opacity="0.7" />

      {/* UPPER ARMS */}
      <ellipse cx={lSx} cy="84" rx="8" ry="18" fill={fill("arms")} style={glow("arms")} />
      <ellipse cx={rSx} cy="84" rx="8" ry="18" fill={fill("arms")} style={glow("arms")} />

      {/* FOREARMS */}
      <ellipse cx={lSx} cy="115" rx="6" ry="14" fill={fill("arms")} opacity="0.62" />
      <ellipse cx={rSx} cy="115" rx="6" ry="14" fill={fill("arms")} opacity="0.62" />

      {/* HIPS / GLUTES — wider, more prominent */}
      <path d={`M 43 122 C 36 128 ${lHx} 138 ${lHx} 149 Q 60 160 ${rHx} 149 C ${rHx} 138 84 128 77 122 Z`}
        fill={fill("hamstrings")} style={glow("hamstrings")} />
      {/* Glute center separation */}
      <path d="M 60 130 L 60 155" fill="none" stroke={`${color}30`} strokeWidth="0.6" strokeDasharray="2 3" />
      {/* Glute highlight */}
      <path d={`M 44 124 Q 50 120 57 122`} fill="none" stroke="url(#shimmerF)" strokeWidth="1.2" />
      <path d={`M 76 124 Q 70 120 63 122`} fill="none" stroke="url(#shimmerF)" strokeWidth="1.2" />

      {/* QUADS */}
      <path d={`M ${lHx+2} 149 C ${lHx-5} 165 ${lHx-5} 179 ${lHx} 191 C ${lHx+4} 199 ${lHx+14} 199 ${lHx+18} 191 C ${lHx+20} 179 ${lHx+18} 163 ${lHx+12} 151 Z`}
        fill={fill("quads")} style={glow("quads")} />
      <path d={`M ${rHx-2} 149 C ${rHx+5} 165 ${rHx+5} 179 ${rHx} 191 C ${rHx-4} 199 ${rHx-14} 199 ${rHx-18} 191 C ${rHx-20} 179 ${rHx-18} 163 ${rHx-12} 151 Z`}
        fill={fill("quads")} style={glow("quads")} />
      {/* Quad highlight */}
      <path d={`M ${lHx+2} 150 C ${lHx-3} 162 ${lHx-3} 176 ${lHx} 188`} fill="none" stroke="url(#shimmerF)" strokeWidth="1.0" />
      <path d={`M ${rHx-2} 150 C ${rHx+3} 162 ${rHx+3} 176 ${rHx} 188`} fill="none" stroke="url(#shimmerF)" strokeWidth="1.0" />

      {/* HAMSTRINGS */}
      <ellipse cx={lHx+9}  cy="169" rx="8.5" ry="24" fill={fill("hamstrings")} opacity="0.52" style={glow("hamstrings")} />
      <ellipse cx={rHx-9}  cy="169" rx="8.5" ry="24" fill={fill("hamstrings")} opacity="0.52" style={glow("hamstrings")} />

      {/* KNEES */}
      <ellipse cx={lHx+8}  cy="196" rx="10" ry="6" fill="url(#bodyDepthF)" stroke={`${color}35`} strokeWidth="0.5" />
      <ellipse cx={rHx-8}  cy="196" rx="10" ry="6" fill="url(#bodyDepthF)" stroke={`${color}35`} strokeWidth="0.5" />

      {/* CALVES */}
      <ellipse cx={lHx+6}  cy="219" rx="9" ry="20" fill="url(#mgNeutralF)" stroke={`${color}28`} strokeWidth="0.6" />
      <ellipse cx={rHx-6}  cy="219" rx="9" ry="20" fill="url(#mgNeutralF)" stroke={`${color}28`} strokeWidth="0.6" />

      {/* FEET */}
      <ellipse cx={lHx+4}  cy="246" rx="12" ry="5" fill="url(#bodyDepthF)" stroke={`${color}25`} strokeWidth="0.5" />
      <ellipse cx={rHx-4}  cy="246" rx="12" ry="5" fill="url(#bodyDepthF)" stroke={`${color}25`} strokeWidth="0.5" />

      {/* SPINE */}
      <line x1="60" y1="46" x2="60" y2="123" stroke={`${color}28`} strokeWidth="0.6" strokeDasharray="3 4" />
    </svg>
  );
}

/* ─── Scan ring (layered) ───────────────────────── */
function ScanRing({ size, duration, color, opacity = 0.06 }: {
  size: number; duration: number; color: string; opacity?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full"
      style={{
        width: size, height: size,
        left: "50%", top: "50%",
        marginLeft: -size / 2, marginTop: -size / 2,
        opacity,
        border: `1px solid ${color}`,
        boxShadow: `0 0 8px ${color}18, inset 0 0 8px ${color}08`,
      }}
      animate={reduce ? undefined : { rotate: 360 }}
      transition={{ duration: reduce ? 0 : duration, repeat: reduce ? 0 : Infinity, ease: "linear" }}
    />
  );
}

/* ─── Zone tag ─────────────────────────────────── */
function ZoneTag({ label, color, delay, isWeak = false }: {
  label: string; color: string; delay: number; isWeak?: boolean;
}) {
  const reduce = useReducedMotion();
  const c = isWeak ? "#ef7d55" : color;
  return (
    <motion.span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[7px] uppercase tracking-wider"
      style={{ borderColor: `${c}30`, background: `${c}0d`, color: `${c}cc` }}
      initial={reduce ? false : { opacity: 0, scale: 0.8 }}
      animate={reduce ? undefined : { opacity: 1, scale: 1 }}
      transition={{ delay: reduce ? 0 : delay, duration: reduce ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="h-1 w-1 flex-shrink-0 rounded-full" style={{ background: c }} />
      {isWeak ? `⚠ ${label}` : label}
    </motion.span>
  );
}

/* ─── Archetype proportion bar ──────────────────── */
function ProportionBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 flex-shrink-0 font-mono text-[7px] uppercase tracking-wider text-white/25">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-white/[0.07] overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <span className="w-8 flex-shrink-0 text-right font-mono text-[7px]" style={{ color }}>{value}</span>
    </div>
  );
}

/* ─── Digital Twin Engine ───────────────────────── */
export function AthleteAvatar3D() {
  const { profile } = useAthleteDashboardStore();
  const reduce = useReducedMotion();
  const auraColor = AURA_COLORS[profile.avatarAura];
  const archetypeCfg = ARCHETYPE_CONFIG[profile.physiqueArchetype];
  const physiqueLabel = PHYSIQUE_LABELS[profile.physiqueGoal];

  const ARCHETYPE_PROPORTIONS = {
    Shoulders: Math.round(archetypeCfg.shoulderW * 82),
    Torso:     Math.round(archetypeCfg.torsoW * 78),
    Arms:      Math.round(archetypeCfg.armW * 76),
    Hips:      Math.round(archetypeCfg.hipW * 74),
  };

  return (
    <GlassPanel accent={auraColor} noPad className="flex flex-col overflow-hidden">
      {/* Header radial glow */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 50% 42%, ${auraColor}0e 0%, transparent 64%)` }} />

      {/* ── Header ── */}
      <div className="relative border-b border-white/[0.05] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="fba-pulse h-1.5 w-1.5 rounded-full" style={{ background: auraColor }} />
            <p className="font-mono text-[7.5px] uppercase tracking-[0.22em]" style={{ color: `${auraColor}90` }}>
              Digital Twin Engine
            </p>
          </div>
          <span className="rounded-md border px-1.5 py-0.5 font-mono text-[6.5px] uppercase tracking-wider"
            style={{ borderColor: `${auraColor}30`, background: `${auraColor}0d`, color: `${auraColor}bb` }}>
            {archetypeCfg.code}
          </span>
        </div>
        <h3 className="mt-0.5 text-[13px] font-semibold text-[#f2eee6]">
          {profile.name}&apos;s Model
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border px-2 py-0.5 font-mono text-[7px] uppercase tracking-wider"
            style={{ borderColor: `${auraColor}25`, background: `${auraColor}0d`, color: `${auraColor}bb` }}>
            {archetypeCfg.label}
          </span>
          <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 font-mono text-[7px] uppercase tracking-wider text-white/30">
            {physiqueLabel}
          </span>
        </div>
      </div>

      {/* ── Twin viewport ── */}
      <div className="relative flex flex-1 flex-col items-center justify-center py-4">
        {/* Layered scan rings */}
        <ScanRing size={224} duration={60}  color={auraColor} opacity={0.03} />
        <ScanRing size={178} duration={48}  color={auraColor} opacity={0.04} />
        <ScanRing size={130} duration={34}  color={auraColor} opacity={0.06} />
        <ScanRing size={90}  duration={22}  color={auraColor} opacity={0.08} />

        {/* Corner data readouts (holographic HUD) */}
        <div className="pointer-events-none absolute left-3 top-4 flex flex-col gap-1.5 opacity-20">
          {["SYM", "POS", "VOL"].map((lbl) => (
            <div key={lbl} className="flex items-center gap-1">
              <div className="h-px w-3" style={{ background: auraColor }} />
              <span className="font-mono text-[6px] tracking-widest" style={{ color: auraColor }}>{lbl}</span>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute right-3 top-4 flex flex-col items-end gap-1.5 opacity-20">
          {["84%", "CPH", "W6"].map((val) => (
            <div key={val} className="flex items-center gap-1">
              <span className="font-mono text-[6px] tracking-widest" style={{ color: auraColor }}>{val}</span>
              <div className="h-px w-3" style={{ background: auraColor }} />
            </div>
          ))}
        </div>

        {/* Ground arc */}
        <div className="pointer-events-none absolute bottom-2 left-1/2 h-px w-28 -translate-x-1/2"
          style={{ background: `radial-gradient(ellipse, ${auraColor}40 0%, transparent 72%)` }} />

        {/* Floating figure */}
        <motion.div
          className="relative"
          animate={reduce ? undefined : { y: [0, -3, 0] }}
          transition={{ duration: reduce ? 0 : 10, repeat: reduce ? 0 : Infinity, ease: "easeInOut" }}
        >
          {/* Scan line overlay */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute left-0 h-[1px] w-full"
              style={{ background: `linear-gradient(90deg, transparent 0%, ${auraColor}08 20%, ${auraColor}22 50%, ${auraColor}08 80%, transparent 100%)` }}
              animate={reduce ? undefined : { top: ["-4%", "108%"] }}
              transition={{ duration: reduce ? 0 : 4.5, repeat: reduce ? 0 : Infinity, ease: "linear", repeatDelay: 7 }}
            />
          </div>

          {archetypeCfg.gender === "female" ? (
            <FemaleFigureSVG
              color={auraColor}
              focusZones={profile.focusZones}
              weakPoints={profile.weakPoints ?? []}
              sw={archetypeCfg.shoulderW}
              hw={archetypeCfg.hipW}
            />
          ) : (
            <MaleFigureSVG
              color={auraColor}
              focusZones={profile.focusZones}
              weakPoints={profile.weakPoints ?? []}
              sw={archetypeCfg.shoulderW}
              tw={archetypeCfg.torsoW}
              hw={archetypeCfg.hipW}
              aw={archetypeCfg.armW}
            />
          )}
        </motion.div>
      </div>

      {/* ── Archetype proportions ── */}
      <div className="relative border-t border-white/[0.05] px-4 py-3">
        <p className="mb-2 font-mono text-[7px] uppercase tracking-[0.22em] text-white/22">
          Archetype Proportions
        </p>
        <div className="flex flex-col gap-1.5">
          {Object.entries(ARCHETYPE_PROPORTIONS).map(([key, val]) => (
            <ProportionBar key={key} label={key} value={val} color={auraColor} />
          ))}
        </div>
      </div>

      {/* ── Focus zones + weak points ── */}
      <div className="relative border-t border-white/[0.05] px-4 pb-4 pt-3">
        <p className="mb-2 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/22">
          Active Focus
        </p>
        <div className="flex flex-wrap gap-1.5">
          {profile.focusZones.map((zone, i) => (
            <ZoneTag key={zone} label={FOCUS_ZONE_LABELS[zone]} color={auraColor} delay={i * 0.06} />
          ))}
          {(profile.weakPoints ?? []).map((zone, i) => (
            !profile.focusZones.includes(zone) && (
              <ZoneTag key={`weak-${zone}`} label={FOCUS_ZONE_LABELS[zone]} color={auraColor}
                delay={0.12 + i * 0.06} isWeak />
            )
          ))}
        </div>

        {/* AI symmetry note */}
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
          <p className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/22">AI Symmetry Note</p>
          <p className="mt-1 text-[9.5px] leading-[1.5] text-white/38">
            {profile.focusZones.includes("upper-chest") || profile.focusZones.includes("delts")
              ? "Upper chain priority detected. Maintain posterior volume ratio — face pulls, rear delt work."
              : profile.focusZones.includes("quads") || profile.focusZones.includes("hamstrings")
                ? "Lower chain specialization active. Hip flexor mobility + glute activation pre-session."
                : profile.focusZones.includes("lats")
                  ? "Back width priority. Monitor scapular health — external rotation prehab recommended."
                  : "Balanced stimulus pattern. Maintain current zone distribution for symmetry score gains."}
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}
