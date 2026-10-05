"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Settings2 } from "lucide-react";

import {
  AvatarAura,
  DensityMode,
  FocusZone,
  PhysiqueGoal,
  useAthleteDashboardStore,
} from "@/lib/athlete-store";
import { GlassPanel } from "./ui/GlassPanel";

/* ── Option chip ─────────────────────────────────── */
function Chip<T extends string>({
  value,
  current,
  label,
  color,
  onSelect,
}: {
  value: T;
  current: T | T[];
  label: string;
  color?: string;
  onSelect: (v: T) => void;
}) {
  const active = Array.isArray(current) ? current.includes(value) : current === value;
  const accent = color ?? "#d5b15f";

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className="rounded-lg border px-2.5 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.16em] transition-all duration-150"
      style={
        active
          ? {
              borderColor: `${accent}35`,
              background: `${accent}12`,
              color: accent,
            }
          : {
              borderColor: "rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.03)",
              color: "rgba(255,255,255,0.35)",
            }
      }
    >
      {label}
    </button>
  );
}

/* ── Row ─────────────────────────────────────────── */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <p className="w-24 flex-shrink-0 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/28">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/* ── Component ───────────────────────────────────── */
export function CustomizationPreview() {
  const { profile, updateProfile, setActiveView } = useAthleteDashboardStore();
  const shouldReduceMotion = useReducedMotion();

  const AURA_OPTIONS: Array<{ value: AvatarAura; label: string; color: string }> = [
    { value: "gold", label: "Gold", color: "#d5b15f" },
    { value: "teal", label: "Teal", color: "#5fb7d5" },
    { value: "violet", label: "Violet", color: "#a78bfa" },
    { value: "red", label: "Red", color: "#f87171" },
  ];

  const DENSITY_OPTIONS: Array<{ value: DensityMode; label: string }> = [
    { value: "simple", label: "Simple" },
    { value: "operator", label: "Detailed" },
    { value: "advanced", label: "Advanced" },
  ];

  const PHYSIQUE_OPTIONS: Array<{ value: PhysiqueGoal; label: string }> = [
    { value: "lean", label: "Lean" },
    { value: "athletic", label: "Athletic" },
    { value: "classic", label: "Classic" },
    { value: "mass", label: "Mass" },
  ];

  const ZONE_OPTIONS: Array<{ value: FocusZone; label: string }> = [
    { value: "upper-chest", label: "Upper Chest" },
    { value: "delts", label: "Delts" },
    { value: "lats", label: "Lats" },
    { value: "arms", label: "Arms" },
    { value: "quads", label: "Quads" },
    { value: "hamstrings", label: "Hamstrings" },
    { value: "core", label: "Core" },
  ];

  function toggleZone(zone: FocusZone) {
    const current = profile.focusZones;
    const next = current.includes(zone)
      ? current.filter((z) => z !== zone)
      : [...current, zone];
    updateProfile({ focusZones: next });
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassPanel accent="#d5b15f" noPad>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d5b15f]/22 bg-[#d5b15f]/[0.09]"
              style={{ boxShadow: "0 0 10px rgba(213,177,95,0.12)" }}
            >
              <Settings2 size={12} className="text-[#d5b15f]" />
            </div>
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#d5b15f]/65">
                Personalization
              </p>
              <h3 className="text-[13px] font-semibold text-[#f2eee6]">
                Customize Your Command Center
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveView("settings")}
            className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/30 transition-all duration-150 hover:border-[#d5b15f]/22 hover:bg-[#d5b15f]/[0.06] hover:text-[#d5b15f]/70"
          >
            Full Settings
          </button>
        </div>

        {/* Options grid */}
        <div className="flex flex-col gap-4 p-5">
          {/* Theme aura */}
          <Row label="Theme">
            {AURA_OPTIONS.map(({ value, label, color }) => (
              <Chip
                key={value}
                value={value}
                current={profile.avatarAura}
                label={label}
                color={color}
                onSelect={(v) => updateProfile({ avatarAura: v })}
              />
            ))}
          </Row>

          {/* Density */}
          <Row label="Density">
            {DENSITY_OPTIONS.map(({ value, label }) => (
              <Chip
                key={value}
                value={value}
                current={profile.densityMode}
                label={label}
                onSelect={(v) => updateProfile({ densityMode: v })}
              />
            ))}
          </Row>

          {/* Physique goal */}
          <Row label="Physique">
            {PHYSIQUE_OPTIONS.map(({ value, label }) => (
              <Chip
                key={value}
                value={value}
                current={profile.physiqueGoal}
                label={label}
                onSelect={(v) => updateProfile({ physiqueGoal: v })}
              />
            ))}
          </Row>

          {/* Focus zones */}
          <Row label="Focus">
            {ZONE_OPTIONS.map(({ value, label }) => (
              <Chip
                key={value}
                value={value}
                current={profile.focusZones}
                label={label}
                onSelect={toggleZone}
              />
            ))}
          </Row>
        </div>

        {/* Footer note */}
        <div className="border-t border-white/[0.04] px-5 pb-4 pt-3">
          <p className="text-[9px] leading-4 text-white/20">
            Preferences apply immediately. Full persistence and profile sync available in Settings.
          </p>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
