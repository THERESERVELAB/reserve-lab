"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  BarChart3,
  ChevronRight,
  Dumbbell,
  Moon,
  Target,
  TrendingUp,
  Utensils,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getTimeGreeting, useAthleteDashboardStore } from "@/lib/athlete-store";
import { READINESS_DATA, TRAINING_LOAD_DATA } from "@/lib/config/static-data";
import { GlassPanel } from "@/components/ui/GlassPanel";

const TOOLTIP_STYLE = {
  background: "#0a0b10",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  color: "#ece8df",
  fontSize: 11,
  boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
};

/* ─── Stat chip ─────────────────────────────────── */
function StatChip({
  icon: Icon,
  label,
  value,
  accent,
  delta,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  accent: string;
  delta?: string;
}) {
  return (
    <div
      className="relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3.5"
      style={{
        borderColor: `${accent}22`,
        background: `${accent}08`,
      }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-black/30"
        style={{ color: accent, boxShadow: `0 0 14px ${accent}1a` }}
      >
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p
          className="font-mono text-[7.5px] uppercase tracking-[0.22em]"
          style={{ color: `${accent}99` }}
        >
          {label}
        </p>
        <p className="mt-0.5 text-[20px] font-black leading-none text-[#f2eee6]">
          {value}
        </p>
      </div>
      {delta && (
        <div className="ml-auto flex items-center gap-1">
          <TrendingUp size={10} style={{ color: accent, opacity: 0.7 }} />
          <span className="font-mono text-[8px]" style={{ color: `${accent}99` }}>
            {delta}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Action card ───────────────────────────────── */
function ActionCard({
  icon: Icon,
  label,
  title,
  accent,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  title: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-4 py-3.5 text-left transition-all duration-200"
      style={{
        borderColor: "rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${accent}30`;
        e.currentTarget.style.background = `${accent}07`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
      }}
    >
      <span
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-black/25 transition-all duration-200"
        style={{ color: accent }}
      >
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/25">
          {label}
        </p>
        <p className="mt-0.5 text-[11.5px] font-medium text-white/55 group-hover:text-white/75 transition-colors">
          {title}
        </p>
      </div>
      <ChevronRight
        size={12}
        className="flex-shrink-0 text-white/18 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-white/35"
      />
    </button>
  );
}

/* ─── Intermediate dashboard ────────────────────── */
export function IntermediateDashboard() {
  const { profile, setActiveView } = useAthleteDashboardStore();
  const [greeting, setGreeting] = useState("");
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const frame = requestAnimationFrame(() => setGreeting(getTimeGreeting(profile.name)));
    const id = setInterval(() => setGreeting(getTimeGreeting(profile.name)), 60_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(id);
    };
  }, [profile.name]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-end justify-between gap-4"
      >
        <div>
          <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-[#d5b15f]/60">
            Performance Dashboard
          </p>
          <h1 className="mt-1 text-[24px] font-black leading-tight text-[#f2eee6]">
            {greeting || `Welcome, ${profile.name}.`}
          </h1>
          <p className="mt-1 text-[11.5px] text-white/30">
            {profile.goal || "Performance"} · {profile.trainingStyle || "Structured Training"}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-white/[0.025] px-3 py-2">
          <Zap size={11} className="text-[#d5b15f]/65" />
          <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/32">
            W6 Active
          </span>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.4, delay: shouldReduceMotion ? 0 : 0.07, ease: [0.22, 1, 0.36, 1] }}
        className="grid gap-3 sm:grid-cols-3"
      >
        <StatChip icon={Activity} label="Readiness" value="84" accent="#6ee7b7" delta="+6" />
        <StatChip icon={Dumbbell} label="Training Load" value="79%" accent="#5fb7d5" delta="W6" />
        <StatChip icon={Moon} label="Recovery Score" value="7.8" accent="#a78bfa" />
      </motion.div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.4, delay: shouldReduceMotion ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassPanel accent="#6ee7b7" className="h-full">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[7.5px] uppercase tracking-[0.22em] text-emerald-400/65">
                  7-Day Trend
                </p>
                <h3 className="mt-0.5 text-[13px] font-semibold text-[#f2eee6]">
                  Readiness vs. Strain
                </h3>
              </div>
              <BarChart3 size={14} className="mt-0.5 text-white/18" />
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={READINESS_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                <defs>
                  <linearGradient id="int-readiness" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#6ee7b7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="int-strain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5fb7d5" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#5fb7d5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8, fill: "rgba(255,255,255,0.2)" }} axisLine={false} tickLine={false} domain={[50, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
                <Area type="monotone" dataKey="readiness" stroke="#6ee7b7" strokeWidth={1.5} fill="url(#int-readiness)" dot={false} />
                <Area type="monotone" dataKey="strain" stroke="#5fb7d5" strokeWidth={1.5} fill="url(#int-strain)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </GlassPanel>
        </motion.div>

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.4, delay: shouldReduceMotion ? 0 : 0.17, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassPanel accent="#5fb7d5" className="h-full">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[7.5px] uppercase tracking-[0.22em] text-[#5fb7d5]/65">
                  Block Performance
                </p>
                <h3 className="mt-0.5 text-[13px] font-semibold text-[#f2eee6]">
                  Training Load · W1–W6
                </h3>
              </div>
              <TrendingUp size={14} className="mt-0.5 text-white/18" />
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={TRAINING_LOAD_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="block" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8, fill: "rgba(255,255,255,0.2)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="load" fill="#5fb7d5" opacity={0.7} radius={[3, 3, 0, 0]} />
                <Bar dataKey="volume" fill="#d5b15f" opacity={0.5} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassPanel>
        </motion.div>
      </div>

      {/* Action row */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.4, delay: shouldReduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <ActionCard icon={Dumbbell} label="Training" title="Log Today's Session" accent="#5fb7d5" onClick={() => setActiveView("training")} />
        <ActionCard icon={Utensils} label="Nutrition" title="Update Macro Log" accent="#d5b15f" onClick={() => setActiveView("nutrition")} />
        <ActionCard icon={Target} label="Measurements" title="Weekly Check-In" accent="#a78bfa" onClick={() => setActiveView("measurements")} />
        <ActionCard icon={Moon} label="Recovery" title="Log Sleep & HRV" accent="#6ee7b7" onClick={() => setActiveView("recovery")} />
      </motion.div>

      {/* Macro snapshot */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.4, delay: shouldReduceMotion ? 0 : 0.27, ease: [0.22, 1, 0.36, 1] }}
      >
        <GlassPanel accent="#d5b15f" noPad>
          <div className="border-b border-white/[0.05] px-5 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[7.5px] uppercase tracking-[0.22em] text-[#d5b15f]/65">
                  Nutrition · Today
                </p>
                <p className="mt-0.5 text-[12px] font-semibold text-[#f2eee6]">
                  Macro Snapshot
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView("nutrition")}
                className="font-mono text-[8px] uppercase tracking-wider text-[#d5b15f]/50 transition-colors hover:text-[#d5b15f]/80"
              >
                Update →
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 divide-x divide-white/[0.05]">
            {[
              { label: "Calories", value: "2,840", unit: "kcal", accent: "#d5b15f" },
              { label: "Protein", value: "218", unit: "g", accent: "#6ee7b7" },
              { label: "Carbs", value: "320", unit: "g", accent: "#5fb7d5" },
              { label: "Fat", value: "78", unit: "g", accent: "#a78bfa" },
            ].map(({ label, value, unit, accent }) => (
              <div key={label} className="px-4 py-3.5 text-center">
                <p className="font-mono text-[7px] uppercase tracking-[0.2em] text-white/25">
                  {label}
                </p>
                <p className="mt-1 text-[16px] font-black" style={{ color: accent }}>
                  {value}
                </p>
                <p className="font-mono text-[8px] text-white/20">{unit}</p>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Footer */}
      <p className="text-center font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/14">
        The Reserve Method · Performance Dashboard · Observational tracking only
      </p>
    </div>
  );
}
