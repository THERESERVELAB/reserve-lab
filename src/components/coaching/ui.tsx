"use client";

/* ════════════════════════════════════════════════════════════════════════
   COACH WORKSPACE PRIMITIVES — the coach screens on the Apex bar.

   One surface: `Panel` is the shipped GlassPanel (flush on phones). A Panel
   rendered inside another Panel does not draw a second surface; it becomes a
   hairline-separated group inside the first, so no screen can nest a card in
   a card (components.md rule 1) however its parts are composed.

   Everything inside a panel is rimless: tiles are labelled values, rows are
   separated by light, empty states name what is missing. Gold is reserved for
   the single primary action in `CoachHero`; every other button here is
   outlined ivory, steel, alert or text-only.
   ════════════════════════════════════════════════════════════════════════ */

import React, { createContext, useContext } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import type { CoachBrief } from "@/lib/coaching/workspace-brief";
import type { AlertSeverity } from "@/lib/coaching/types";
import { RESERVE, alpha } from "@/lib/design/tokens";

export const CHAMPAGNE = RESERVE.gold;
export const TEAL = RESERVE.steel;
export const INK = "#0b0c12";

/* ─── Micro label ─────────────────────────────────────────────────────── */

export function MicroLabel({
  children,
  tone = "dim",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "dim" | "champagne" | "teal";
  className?: string;
}) {
  const color =
    tone === "champagne" ? "text-[#d5b15f]/80" : tone === "teal" ? "text-[#5fb7d5]/80" : "text-white/45";
  return (
    <div className={`font-mono text-[9px] uppercase tracking-[0.2em] ${color} ${className}`}>
      {children}
    </div>
  );
}

/* ─── Panel ───────────────────────────────────────────────────────────── */

const PanelDepth = createContext(0);

export function Panel({
  children,
  className = "",
  glow = false,
  as,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  as?: React.ElementType;
}) {
  const depth = useContext(PanelDepth);
  if (depth > 0) {
    const Tag = as ?? "div";
    return (
      <PanelDepth.Provider value={depth + 1}>
        <Tag data-surface="group" className={`relative pt-3 ${className}`}>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01))" }}
          />
          {children}
        </Tag>
      </PanelDepth.Provider>
    );
  }
  return (
    <PanelDepth.Provider value={1}>
      <GlassPanel as={as ?? "div"} noPad phone="flush" accent={glow ? RESERVE.gold : undefined} className={className}>
        {children}
      </GlassPanel>
    </PanelDepth.Provider>
  );
}

export function PanelHeader({
  label,
  title,
  right,
}: {
  label?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-0 pb-2 pt-1 md:px-5 md:pt-4">
      <div className="min-w-0">
        {label && <MicroLabel>{label}</MicroLabel>}
        <h2 className="mt-0.5 text-[13px] font-bold uppercase tracking-[0.06em] text-[#f2eee6]">{title}</h2>
      </div>
      {right}
    </div>
  );
}

/* ─── Labelled value (was a bordered stat tile) ───────────────────────── */

export function StatTile({
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <MicroLabel>{label}</MicroLabel>
      <div className="tnum mt-1 text-xl font-black tracking-tight" style={{ color: accent ?? RESERVE.ivory }}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-white/50">{sub}</div>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="min-h-[44px] py-1 text-left transition-colors hover:brightness-125">
      {body}
    </button>
  ) : (
    <div className="py-1">{body}</div>
  );
}

/* ─── Status chip ─────────────────────────────────────────────────────── */

/* The closed palette only (color.md). Red is the alert signal and nothing else. */
const CHIP_TONES: Record<string, string> = {
  neutral: "rgba(255,255,255,0.6)",
  champagne: RESERVE.gold,
  teal: RESERVE.steel,
  green: RESERVE.green,
  amber: RESERVE.amber,
  red: RESERVE.red,
};

export function StatusChip({
  children,
  tone = "neutral",
  pulse = false,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "champagne" | "teal" | "green" | "amber" | "red";
  pulse?: boolean;
}) {
  const color = CHIP_TONES[tone] ?? CHIP_TONES.neutral;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]"
      style={{
        borderColor: tone === "neutral" ? "rgba(255,255,255,0.1)" : alpha(color, 0.28),
        color,
      }}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: color }} />
          <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        </span>
      )}
      {children}
    </span>
  );
}

export const SEVERITY_TONE: Record<AlertSeverity, "neutral" | "champagne" | "amber" | "red"> = {
  info: "neutral",
  attention: "neutral",
  priority: "champagne",
  urgent: "red",
};

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  info: "Information",
  attention: "Attention",
  priority: "Priority",
  urgent: "Urgent",
};

/* ─── Buttons ─────────────────────────────────────────────────────────── */

/**
 * Every action that is not THE primary action. `primary` here is the
 * strongest secondary (ivory outline), never gold: the one gold action on a
 * coach screen lives in CoachHero.
 */
export function CommandButton({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  disabledReason,
  className = "",
  type = "button",
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "teal" | "danger";
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  type?: "button" | "submit";
  ariaLabel?: string;
}) {
  const base =
    "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[10px] px-3.5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#d5b15f]/50 max-md:min-h-[44px]";
  const styles =
    variant === "primary"
      ? "border border-white/[0.16] text-[#f2eee6] hover:bg-white/[0.05]"
      : variant === "teal"
        ? "border border-[#5fb7d5]/35 text-[#5fb7d5] hover:bg-[#5fb7d5]/[0.08]"
        : variant === "danger"
          ? "border border-[#ef7d55]/35 text-[#ef7d55] hover:bg-[#ef7d55]/[0.08]"
          : "border border-transparent text-white/60 hover:text-white/90";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={disabled ? disabledReason : undefined}
      className={`${base} ${styles} ${disabled ? "cursor-not-allowed opacity-40" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────────── */

/**
 * What is missing, said plainly. No illustration, no sample data: the named
 * requirements are the content.
 */
export function EmptyState({
  title,
  body,
  requirements,
  action,
}: {
  title: string;
  body: string;
  /** What has to exist before this area has anything to show. */
  requirements?: string[];
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 py-5" data-coach="empty">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#d5b15f]/75">{title}</p>
      <p className="max-w-[56ch] text-[13px] leading-[1.55] text-white/65">{body}</p>
      {requirements && requirements.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1.5" aria-label="What this needs">
          {requirements.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[12.5px] leading-[1.45] text-white/70">
              <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full border border-white/35" />
              {item}
            </li>
          ))}
        </ul>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ─── Diff row (Original → Live) ──────────────────────────────────────── */

export function DiffRow({
  label,
  from,
  to,
  removed = false,
}: {
  label: string;
  from: string;
  to: string;
  removed?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] py-2 first:border-t-0">
      <span className="text-[12px] font-medium text-white/70">{label}</span>
      <span className="tnum flex items-center gap-2 font-mono text-[11px]">
        <span className="text-white/40 line-through decoration-white/25">{from}</span>
        <span className="text-white/35" aria-hidden="true">→</span>
        <span className="sr-only">changed to</span>
        <span className={removed ? "italic text-white/55" : "text-[#5fb7d5]"}>{to}</span>
      </span>
    </div>
  );
}

/* ─── Field primitives (forms) ────────────────────────────────────────── */

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <MicroLabel className="mb-1.5">{label}</MicroLabel>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-[1.45] text-white/45">{hint}</p>}
    </label>
  );
}

/* 16px on phones: below it iOS zooms on focus (accessibility.md). */
export const inputClass =
  "min-h-[44px] w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[16px] text-[#f2eee6] placeholder:text-white/30 outline-none transition-colors focus:border-[#d5b15f]/45 md:min-h-[38px] md:text-xs";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "xs";
  /** Accessible name for the group. */
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-md border border-white/[0.07] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`min-h-[34px] rounded px-2.5 font-mono uppercase tracking-[0.12em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#d5b15f]/45 max-md:min-h-[40px] ${
            size === "sm" ? "text-[9px]" : "text-[9px]"
          } ${value === opt.value ? "bg-white/[0.08] text-[#f2eee6]" : "text-white/50 hover:text-white/80"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Page + hero ─────────────────────────────────────────────────────── */

export function CoachPage({ children, screen }: { children: React.ReactNode; screen: string }) {
  return (
    <div data-coach-screen={screen} className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-3 pb-10 pt-4 sm:px-5 lg:gap-6 lg:px-6 lg:pt-6">
      {children}
    </div>
  );
}

export type CoachRead = { label: string; value: string | null; empty?: string };

/**
 * The first screen of every coach page: the screen's name (the h1), one
 * statement from real roster data, two or three reads, and at most one gold
 * action — or the reason there is none.
 */
export function CoachHero({
  eyebrow = "Coach Command",
  title,
  brief,
  reads,
  onPrimary,
  before,
  after,
}: {
  eyebrow?: string;
  title: string;
  brief: CoachBrief;
  reads: CoachRead[];
  onPrimary: () => void;
  /** A back link above the title. */
  before?: React.ReactNode;
  /** Secondary controls under the action (never gold). */
  after?: React.ReactNode;
}) {
  return (
    <GlassPanel accent={RESERVE.gold} noPad phone="flush" className="md:overflow-hidden">
      <section aria-labelledby="coach-hero-title" data-coach="hero" className="relative pb-4 pt-3 md:p-6 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-3 inset-y-0 max-md:[mask-image:linear-gradient(180deg,#000_55%,transparent)] md:inset-x-0"
          style={{ background: `radial-gradient(110% 90% at 0% 0%, ${alpha(RESERVE.gold, 0.07)}, transparent 55%)` }}
        />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-end lg:gap-12">
          <div className="min-w-0">
            {before}
            <p className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: alpha(RESERVE.gold, 0.8) }}>
              {eyebrow}
            </p>
            <h1 id="coach-hero-title" className="mt-1 text-[15px] font-bold uppercase tracking-[0.1em] text-[#f2eee6]">
              {title}
            </h1>
            <p
              data-coach-statement
              className="mt-3 font-display text-[26px] font-black uppercase leading-[0.98] tracking-[-0.02em] text-[#f2eee6] [hyphens:none] sm:text-[30px] lg:text-[36px]"
            >
              {brief.statement}
            </p>
            <p className="mt-2.5 max-w-[58ch] text-[13px] leading-[1.55] text-white/70">{brief.support}</p>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {reads.length > 0 && (
              <dl className={`grid gap-4 ${reads.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                {reads.map((read) => (
                  <div key={read.label} className="min-w-0">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">{read.label}</dt>
                    <dd className="mt-1">
                      {read.value === null ? (
                        <span className="block text-[12.5px] leading-[1.35] text-white/65">{read.empty ?? "None yet"}</span>
                      ) : (
                        <span className="tnum block truncate font-display text-[22px] font-black leading-tight text-[#f2eee6] sm:text-[24px]">
                          {read.value}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="flex flex-wrap items-center gap-2.5">
              {brief.primary ? (
                <div data-coach="primary-action" className="min-w-0 max-sm:w-full">
                  <ReserveButton tier="primary" size="md" fullWidth onClick={onPrimary}>
                    {brief.primary.label}
                  </ReserveButton>
                </div>
              ) : (
                brief.noAction && (
                  <p data-coach="no-action" className="max-w-[46ch] text-[12.5px] leading-[1.5] text-white/60">
                    {brief.noAction}
                  </p>
                )
              )}
              {after}
            </div>
          </div>
        </div>
      </section>
    </GlassPanel>
  );
}

/* ─── Section inside a page ───────────────────────────────────────────── */

/** A flush-on-phone glass section with a light-separated label. */
export function CoachSection({
  id,
  label,
  action,
  children,
  className = "",
}: {
  id?: string;
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PanelDepth.Provider value={1}>
      <GlassPanel as="section" phone="flush" className={`min-w-0 scroll-mt-24 ${className}`}>
        <div id={id} className="scroll-mt-24" />
        <div className="mb-2 flex min-h-[44px] items-center gap-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/60">{label}</h2>
          <span aria-hidden="true" className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.09), rgba(255,255,255,0.01))" }} />
          {action}
        </div>
        {children}
      </GlassPanel>
    </PanelDepth.Provider>
  );
}

/** A rimless row list: rows separated by light. */
export function RowList({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="flex flex-col [&>li+li]:border-t [&>li+li]:border-white/[0.05]">
      {children}
    </ul>
  );
}

/* ─── Relative time ───────────────────────────────────────────────────── */

export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "YYYY-MM-DD" (a local day key) as "Sep 15", without a UTC shift. */
export function dayLabel(dayKey: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", options);
}
