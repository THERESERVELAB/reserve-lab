"use client";

import React from "react";

import { GlassPanel } from "./GlassPanel";

/* ────────────────────────────────────────────────────────────────────────────
   EMPTY STATE — launch-grade premium empty/activation moment

   One headline, one short explanation, a primary action, an optional secondary
   action, and optional safety copy. Used to keep every surface valuable when no
   data exists — no blank screens, no raw placeholders.
   ──────────────────────────────────────────────────────────────────────── */

const GOLD = "#d5b15f";

export type EmptyStateAction = {
  label: string;
  onClick: () => void;
};

export function EmptyState({
  icon: Icon,
  headline,
  body,
  primary,
  secondary,
  safety,
  accent = GOLD,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  headline: string;
  body: string;
  primary?: EmptyStateAction;
  secondary?: EmptyStateAction;
  safety?: string;
  accent?: string;
}) {
  return (
    <GlassPanel accent={accent} className="text-center">
      <div className="mx-auto max-w-md py-7">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border"
          style={{ borderColor: `${accent}33`, background: `${accent}12`, color: accent }}
        >
          <Icon size={22} />
        </span>
        <h3 className="mt-4 text-xl font-black uppercase tracking-tight text-[#f2eee6]">{headline}</h3>
        <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-[1.6] text-white/50">{body}</p>
        {(primary || secondary) && (
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            {primary && (
              <button
                type="button"
                onClick={primary.onClick}
                className="rounded-xl px-4 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-black transition"
                style={{ background: accent }}
              >
                {primary.label}
              </button>
            )}
            {secondary && (
              <button
                type="button"
                onClick={secondary.onClick}
                className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:border-white/[0.2] hover:text-white/90"
              >
                {secondary.label}
              </button>
            )}
          </div>
        )}
        {safety && (
          <p className="mx-auto mt-4 max-w-sm font-mono text-[8.5px] uppercase leading-[1.5] tracking-[0.12em] text-white/28">{safety}</p>
        )}
      </div>
    </GlassPanel>
  );
}
