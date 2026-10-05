"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Moon,
  Target,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { useEffect, useState } from "react";

import { getTimeGreeting, useAthleteDashboardStore } from "@/lib/athlete-store";
import { GlassPanel } from "@/components/ui/GlassPanel";

/* ─── Focus card ────────────────────────────────── */
function FocusCard({
  icon: Icon,
  label,
  title,
  cta,
  accent,
  detail,
  delay = 0,
  onCta,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  title: string;
  cta: string;
  accent: string;
  detail: string;
  delay?: number;
  onCta?: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.4,
        delay: shouldReduceMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <GlassPanel accent={accent} className="h-full">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-black/30"
            style={{ color: accent, boxShadow: `0 0 16px ${accent}22` }}
          >
            <Icon size={16} />
          </div>
          <span
            className="fba-pulse h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ background: accent, boxShadow: `0 0 4px ${accent}` }}
          />
        </div>
        <p
          className="mt-4 font-mono text-[8px] uppercase tracking-[0.22em]"
          style={{ color: `${accent}99` }}
        >
          {label}
        </p>
        <p className="mt-1.5 text-[15px] font-semibold text-[#f2eee6]">{title}</p>
        <p className="mt-2 text-[10.5px] leading-5 text-white/32">{detail}</p>
        <button
          type="button"
          onClick={onCta}
          className="group mt-5 flex w-full items-center justify-between rounded-xl border border-white/[0.07] px-3 py-2.5 text-[11px] font-medium text-white/32 transition-all duration-200"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = accent;
            e.currentTarget.style.borderColor = `${accent}30`;
            e.currentTarget.style.background = `${accent}07`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "";
            e.currentTarget.style.borderColor = "";
            e.currentTarget.style.background = "";
          }}
        >
          <span>{cta}</span>
          <ChevronRight
            size={12}
            className="opacity-50 transition-transform duration-150 group-hover:translate-x-0.5"
          />
        </button>
      </GlassPanel>
    </motion.div>
  );
}

/* ─── Weekly progress ───────────────────────────── */
function WeeklyProgress({ days, completed }: { days: number; completed: number }) {
  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="flex gap-1.5">
      {DAY_LABELS.map((d, i) => {
        const active = i < days;
        const done = i < completed;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="h-8 w-full rounded-lg transition-all duration-300"
              style={{
                borderColor: done
                  ? "rgba(110,231,183,0.3)"
                  : active
                    ? "rgba(255,255,255,0.07)"
                    : "rgba(255,255,255,0.03)",
                background: done
                  ? "rgba(110,231,183,0.12)"
                  : active
                    ? "rgba(255,255,255,0.025)"
                    : "transparent",
              }}
            >
              {done && (
                <div className="flex h-full items-center justify-center">
                  <CheckCircle2 size={10} className="text-emerald-400/70" />
                </div>
              )}
            </div>
            <span
              className="font-mono text-[7.5px] uppercase"
              style={{
                color: done
                  ? "rgba(110,231,183,0.6)"
                  : active
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(255,255,255,0.08)",
              }}
            >
              {d}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Beginner dashboard ────────────────────────── */
export function BeginnerDashboard() {
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

  const completedDays = 3;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Greeting */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-[#d5b15f]/60">
          Your Dashboard
        </p>
        <h1 className="mt-1 text-[24px] font-black leading-tight text-[#f2eee6]">
          {greeting || `Welcome, ${profile.name}.`}
        </h1>
        <p className="mt-1.5 text-[12px] text-white/35">
          Goal: <span className="text-white/55">{profile.goal || "Transformation"}</span>
        </p>
      </motion.div>

      {/* Weekly ring */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.4, delay: shouldReduceMotion ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <GlassPanel accent="#6ee7b7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-emerald-400/65">
                This Week
              </p>
              <p className="mt-1 text-[20px] font-black text-[#f2eee6]">
                {completedDays}{" "}
                <span className="text-[14px] font-medium text-white/35">
                  / {profile.trainingStyle?.match(/\d+/)?.[0] ?? 4} sessions
                </span>
              </p>
              <p className="mt-1 text-[10.5px] text-white/30">
                Keep the streak going — consistency wins.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-emerald-400/60" />
              <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/60">
                On Track
              </span>
            </div>
          </div>
          <div className="mt-4">
            <WeeklyProgress
              days={parseInt(profile.trainingStyle?.match(/\d+/)?.[0] ?? "4")}
              completed={completedDays}
            />
          </div>
        </GlassPanel>
      </motion.div>

      {/* Focus cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <FocusCard
          icon={Dumbbell}
          label="Today"
          title="Training Session"
          detail="Log your workout, sets, reps, and how it felt."
          cta="Open Training"
          accent="#5fb7d5"
          delay={0.12}
          onCta={() => setActiveView("training")}
        />
        <FocusCard
          icon={Utensils}
          label="Nutrition"
          title="Daily Log"
          detail="Track your meals and hit your protein target today."
          cta="Log Nutrition"
          accent="#d5b15f"
          delay={0.18}
          onCta={() => setActiveView("nutrition")}
        />
        <FocusCard
          icon={Moon}
          label="Recovery"
          title="How Are You Feeling?"
          detail="Log sleep, soreness, and energy for trend awareness."
          cta="Check Recovery"
          accent="#a78bfa"
          delay={0.24}
          onCta={() => setActiveView("recovery")}
        />
      </div>

      {/* Quick access */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.4, delay: shouldReduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <GlassPanel accent="#d5b15f" noPad>
          <div className="border-b border-white/[0.05] px-5 py-3.5">
            <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#d5b15f]/60">
              Quick Access
            </p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {[
              { icon: Target, label: "Set this week's focus", view: "settings" as const, accent: "#d5b15f" },
              { icon: BookOpen, label: "Learn the fundamentals", view: "education" as const, accent: "#6ee7b7" },
              { icon: CheckCircle2, label: "Daily journal check-in", view: "journal" as const, accent: "#5fb7d5" },
            ].map(({ icon: Icon, label, view, accent }) => (
              <button
                key={view}
                type="button"
                onClick={() => setActiveView(view)}
                className="group flex w-full items-center gap-3 px-5 py-3.5 transition-all duration-150 hover:bg-white/[0.025]"
              >
                <Icon size={13} style={{ color: accent, opacity: 0.7 }} />
                <span className="flex-1 text-left text-[11px] text-white/40 group-hover:text-white/65 transition-colors">
                  {label}
                </span>
                <ChevronRight size={11} className="text-white/18 group-hover:text-white/35 transition-colors" />
              </button>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Footer */}
      <p className="text-center font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/14">
        The Reserve Method · Observational tracking only · No medical advice generated
      </p>
    </div>
  );
}
