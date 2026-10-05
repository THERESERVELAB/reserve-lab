"use client";

import { useState } from "react";
import { ChevronDown, Dumbbell, Sparkles } from "lucide-react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  ALL_PREMIUM_BRANDS, ENV_EQUIPMENT, EQUIPMENT_LABEL, GYM_ENVIRONMENT_DESC, GYM_ENVIRONMENT_LABEL,
  PREMIUM_BRAND_LABEL, type EquipmentCategory, type GymEnvironment, type PremiumBrand,
  type ProfileCompleteness, type TrainingLevel, type EquipmentStyle, type UserTrainingProfile,
} from "@/lib/training/gym-environment";

const C = { GOLD: "#d5b15f", IVORY: "#f2eee6", STEEL: "#5fb7d5", GREEN: "#6ee7b7", VIOLET: "#a78bfa", AMBER: "#e8c87a", SLATE: "#8ea0b8" };

const ENVIRONMENTS: GymEnvironment[] = ["luxury-premium", "commercial-performance", "commercial-standard", "garage-gym", "home-gym", "dumbbell-home", "hotel-gym", "minimal-travel"];
const LEVELS: TrainingLevel[] = ["beginner", "intermediate", "advanced"];
const STYLES: EquipmentStyle[] = ["mixed", "machines", "free-weights", "cables"];
// Curated equipment toggles that meaningfully change movement prescription.
const KEY_EQUIPMENT: EquipmentCategory[] = [
  "dumbbells", "barbell", "smith", "cables", "bands", "pullup-bar",
  "leg-press", "hack-squat", "pendulum-squat", "hip-thrust-machine", "leg-curl", "leg-extension", "calf-machine",
  "chest-press", "incline-press", "shoulder-press", "pulldown", "row-machine", "pec-deck", "rear-delt-machine", "lateral-raise-machine", "glute-machine",
  "treadmill", "stairmaster", "bike",
];

export function TrainingProfileCard({ profile, onUpdate, completeness }: {
  profile: UserTrainingProfile;
  onUpdate: (updates: Partial<UserTrainingProfile>) => void;
  completeness: ProfileCompleteness;
}) {
  const [open, setOpen] = useState(false);

  const pct = completeness.percent;
  const barColor = pct >= 85 ? C.GREEN : pct >= 55 ? C.GOLD : C.AMBER;

  function setEnvironment(env: GymEnvironment) {
    onUpdate({ gymEnvironment: env, equipment: ENV_EQUIPMENT[env], configured: true });
  }
  function toggleEquipment(cat: EquipmentCategory) {
    const has = profile.equipment.includes(cat);
    onUpdate({ equipment: has ? profile.equipment.filter((e) => e !== cat) : [...profile.equipment, cat], configured: true });
  }
  function toggleBrand(b: PremiumBrand) {
    const has = profile.premiumBrands.includes(b);
    onUpdate({ premiumBrands: has ? profile.premiumBrands.filter((x) => x !== b) : [...profile.premiumBrands, b], configured: true });
  }

  return (
    <GlassPanel accent={C.GOLD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Dumbbell size={14} style={{ color: C.GOLD }} />
          <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: C.GOLD }}>Training Profile</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block">
            <div className="h-1 w-24 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} /></div>
          </div>
          <span className="font-mono text-[8px] uppercase tracking-[0.16em]" style={{ color: barColor }}>{pct}% complete</span>
          <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/55 transition hover:text-white/80" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            {open ? "Close" : "Edit"}<ChevronDown size={11} className={open ? "rotate-180 transition" : "transition"} />
          </button>
        </div>
      </div>

      {/* Summary line */}
      <p className="mt-2 text-[11px] leading-[1.5] text-white/55">
        {GYM_ENVIRONMENT_LABEL[profile.gymEnvironment]} · {profile.equipment.length} equipment types · {profile.trainingLevel} · {profile.sessionDurationMin} min
        {profile.premiumBrands.length > 0 && ` · ${profile.premiumBrands.length} premium brand${profile.premiumBrands.length > 1 ? "s" : ""}`}
      </p>
      {completeness.missing.length > 0 && (
        <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.14em]" style={{ color: C.AMBER }}>Missing: {completeness.missing.join(" · ")}</p>
      )}

      {open && (
        <div className="mt-4 space-y-4">
          {/* Gym environment */}
          <div>
            <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/40">Gym Environment</p>
            <div className="flex flex-wrap gap-1.5">
              {ENVIRONMENTS.map((env) => {
                const active = profile.gymEnvironment === env;
                return (
                  <button key={env} type="button" onClick={() => setEnvironment(env)} title={GYM_ENVIRONMENT_DESC[env]}
                    className="rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition"
                    style={active ? { borderColor: `${C.GOLD}50`, background: `${C.GOLD}14`, color: C.GOLD } : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.6)" }}>
                    {GYM_ENVIRONMENT_LABEL[env]}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[9.5px] leading-[1.4] text-white/35">{GYM_ENVIRONMENT_DESC[profile.gymEnvironment]}</p>
          </div>

          {/* Premium brands */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5"><Sparkles size={10} style={{ color: C.VIOLET }} /><p className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: C.VIOLET }}>Premium Machines (if available)</p></div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_PREMIUM_BRANDS.map((b) => {
                const active = profile.premiumBrands.includes(b);
                return (
                  <button key={b} type="button" onClick={() => toggleBrand(b)}
                    className="rounded-lg border px-2.5 py-1 text-[10px] font-medium transition"
                    style={active ? { borderColor: `${C.VIOLET}50`, background: `${C.VIOLET}14`, color: C.VIOLET } : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.5)" }}>
                    {PREMIUM_BRAND_LABEL[b]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Equipment access */}
          <div>
            <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/40">Equipment Access</p>
            <div className="flex flex-wrap gap-1.5">
              {KEY_EQUIPMENT.map((cat) => {
                const active = profile.equipment.includes(cat);
                return (
                  <button key={cat} type="button" onClick={() => toggleEquipment(cat)}
                    className="rounded-lg border px-2 py-1 text-[9.5px] font-medium transition"
                    style={active ? { borderColor: `${C.STEEL}50`, background: `${C.STEEL}14`, color: C.STEEL } : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.45)" }}>
                    {EQUIPMENT_LABEL[cat]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Level + style + duration */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/40">Training Level</p>
              <div className="flex flex-wrap gap-1.5">
                {LEVELS.map((l) => (
                  <button key={l} type="button" onClick={() => onUpdate({ trainingLevel: l, configured: true })}
                    className="rounded-lg border px-2.5 py-1 text-[10px] font-semibold capitalize transition"
                    style={profile.trainingLevel === l ? { borderColor: `${C.GOLD}50`, background: `${C.GOLD}14`, color: C.GOLD } : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.55)" }}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/40">Preferred Style</p>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((st) => (
                  <button key={st} type="button" onClick={() => onUpdate({ preferredStyle: st, configured: true })}
                    className="rounded-lg border px-2.5 py-1 text-[10px] font-semibold capitalize transition"
                    style={profile.preferredStyle === st ? { borderColor: `${C.STEEL}50`, background: `${C.STEEL}14`, color: C.STEEL } : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.55)" }}>{st.replace("-", " ")}</button>
                ))}
              </div>
            </div>
            <label className="block">
              <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/40">Session Duration</p>
              <div className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2">
                <input type="range" min={30} max={120} step={15} value={profile.sessionDurationMin}
                  onChange={(e) => onUpdate({ sessionDurationMin: Number(e.target.value), configured: true })} className="flex-1 accent-[#d5b15f]" />
                <span className="font-mono text-[11px] font-bold text-[#f2eee6]">{profile.sessionDurationMin}m</span>
              </div>
            </label>
          </div>

          <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/25">Reserve provides training organization and coaching support only. Stop with pain and follow clinician guidance.</p>
        </div>
      )}
    </GlassPanel>
  );
}
