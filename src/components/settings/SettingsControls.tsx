"use client";

import React from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { DETAIL_BAND_BLEED, ReserveDetailImage, ReserveSectionHeader } from "@/components/ui/reserve";
import type { DetailImageId } from "@/lib/brand/asset-manifest";
import { RESERVE, alpha } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   SETTINGS CONTROLS — the few pieces every Settings section is made from.

   Settings used to draw a bordered card per module, a bordered tile per
   option, and a bordered tile per toggle inside those cards: three surface
   levels at every width. Here a section is one flush glass layer, a setting
   is a hairline-separated row, and a choice is a control — never a card.

   Local to Settings because the shared primitives are frozen during the
   redesign waves. `OptionButtons` and `SwitchControl` are the likeliest to
   be promoted.
   ════════════════════════════════════════════════════════════════════════ */

export const SETTINGS_INPUT =
  "min-h-[44px] w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[16px] text-[#f2eee6] outline-none transition-colors placeholder:text-white/30 focus:border-[#d5b15f]/45 disabled:opacity-50 md:text-[13px]";

export const SETTINGS_LABEL = "font-mono text-[11px] uppercase tracking-[0.16em] text-white/55";

/** One section of Settings: one flush glass layer, a header, one line of purpose. */
export function SettingsSection({
  id,
  label,
  purpose,
  accent = RESERVE.gold,
  action,
  detail,
  children,
}: {
  id: string;
  label: string;
  purpose?: string;
  accent?: string;
  action?: React.ReactNode;
  /** An atmosphere band at the top of this section's panel. At most one section carries one. */
  detail?: DetailImageId;
  children: React.ReactNode;
}) {
  return (
    <GlassPanel accent={accent} phone="flush">
      {detail && <ReserveDetailImage id={detail} className={DETAIL_BAND_BLEED} />}
      <section id={id} aria-label={label} className="scroll-mt-24">
        <ReserveSectionHeader label={label} accent={accent} action={action} />
        {purpose && <p className="max-w-[72ch] text-[13.5px] leading-[1.6] text-white/70">{purpose}</p>}
        <ul className={`flex flex-col divide-y divide-white/[0.06] ${purpose ? "mt-3" : ""}`}>{children}</ul>
      </section>
    </GlassPanel>
  );
}

/** A setting: what it is on the left (or above on phones), its control beside it. */
export function SettingRow({
  label,
  description,
  children,
  stacked = false,
}: {
  label: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Put the control under the label at every width — for wide choice groups. */
  stacked?: boolean;
}) {
  return (
    <li
      className={`py-3.5 first:pt-1 last:pb-0 ${
        stacked ? "flex flex-col gap-2.5" : "grid gap-2.5 md:grid-cols-[minmax(200px,300px)_minmax(0,1fr)] md:gap-10"
      }`}
    >
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-[#f2eee6]">{label}</p>
        {description && <div className="mt-1 max-w-[64ch] text-[12.5px] leading-[1.55] text-white/60">{description}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

export type Option<T extends string> = { value: T; label: string; sub?: string };

/**
 * A single choice among a few. Real buttons with `aria-pressed`; the chosen
 * one is lit, the rest are text. No tile, no border.
 */
export function OptionButtons<T extends string>({
  label,
  options,
  value,
  onChange,
  accent = RESERVE.gold,
  columns,
}: {
  /** Accessible name for the group. */
  label: string;
  options: Array<Option<T>>;
  value: T | null;
  onChange: (value: T) => void;
  accent?: string;
  /** Lay options with subtitles out as a grid instead of a wrapping row. */
  columns?: 2 | 3;
}) {
  const grid = columns === 3 ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : columns === 2 ? "grid grid-cols-1 sm:grid-cols-2" : "flex flex-wrap";
  return (
    <div role="group" aria-label={label} className={`${grid} gap-1`}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className="min-h-[44px] rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
            style={{
              background: on ? alpha(accent, 0.12) : undefined,
              outlineColor: alpha(accent, 0.6),
            }}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: on ? accent : "rgba(255,255,255,0.18)" }}
              />
              <span className="text-[13px] font-semibold" style={{ color: on ? RESERVE.ivory : "rgba(255,255,255,0.7)" }}>
                {option.label}
              </span>
            </span>
            {option.sub && <span className="mt-0.5 block pl-3.5 text-[12px] leading-[1.45] text-white/50">{option.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** An on/off switch. `role="switch"`, so its state is announced, not just coloured. */
export function SwitchControl({
  label,
  checked,
  onChange,
  disabled = false,
  disabledReason,
  stateLabel,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
  /** Overrides the On/Off word — e.g. "Active" when a path turns a module on. */
  stateLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-[44px] shrink-0 items-center gap-2.5 px-1 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span
        aria-hidden="true"
        className="relative h-6 w-11 rounded-full transition-colors"
        style={{ background: checked ? alpha(RESERVE.green, 0.4) : "rgba(255,255,255,0.1)" }}
      >
        <span
          className="absolute top-1 h-4 w-4 rounded-full transition-[left]"
          style={{ left: checked ? 24 : 4, background: checked ? RESERVE.green : "rgba(255,255,255,0.55)" }}
        />
      </span>
      <span className="w-12 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">
        {stateLabel ?? (checked ? "On" : "Off")}
      </span>
    </button>
  );
}
