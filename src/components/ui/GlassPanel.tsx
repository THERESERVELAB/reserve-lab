"use client";

import React from "react";

type GlassPanelProps = {
  children: React.ReactNode;
  className?: string;
  /** Accent color for top-edge highlight and optional glow */
  accent?: string;
  /** Remove default padding */
  noPad?: boolean;
  /** Apply gradient border via fba-gradient-border class */
  gradientBorder?: boolean;
  as?: React.ElementType;
  style?: React.CSSProperties;
  /**
   * How the panel reads below `md`.
   *
   * `glass` (default): the same rimless surface at every width.
   * `flush`: on phones the panel sheds its surface — no rim, radius, fill,
   * blur or shadow — and becomes a full-width section inside the page gutter,
   * separated from the section above by its top-edge light. From `md` up it is
   * the glass panel, unchanged. This is how a room keeps to two surface levels
   * on a 390px screen (components.md rule 1) without a card inside a card.
   * With `flush`, pass layout classes that must only apply to the glass as
   * `md:` classes (for example `md:overflow-hidden`).
   */
  phone?: "glass" | "flush";
};

/* Owner 2026-09-18: the glass was hiding the room's loop. A light smoke tint
   keeps text legible; an 8px blur lets the motion read through it. */
const SURFACE_BACKGROUND =
  "linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 100%), rgba(7,8,12,0.34)";
const SURFACE_BLUR = "blur(8px) saturate(120%)";

export function GlassPanel({
  children,
  className = "",
  accent,
  noPad = false,
  gradientBorder = false,
  as: Tag = "div",
  style,
  phone = "glass",
}: GlassPanelProps) {
  const edgeColor = accent
    ? `linear-gradient(90deg, transparent, ${accent}22 35%, ${accent}22 65%, transparent)`
    : "linear-gradient(90deg, transparent, rgba(255,255,255,0.07) 35%, rgba(255,255,255,0.07) 65%, transparent)";
  const shadow = [
    "0 0 0 1px rgba(255,255,255,0.022) inset",
    "0 32px 100px rgba(0,0,0,0.22)",
    accent ? `0 0 56px ${accent}0a` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const edge = (
    /* Top-edge shimmer line. On a flush phone section it is the hairline that
       separates the section from the one above.

       Awake light: an accented panel's edge carries one faint light pass every
       14s. It runs only while the shell marks ambient motion live (globals.css
       `.fba-edge-light`), so pause, reduced motion and a hidden tab all stop it. */
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden" style={{ background: edgeColor }} aria-hidden="true">
      {accent && (
        <span
          className="fba-edge-light absolute inset-y-0 left-0 w-1/5"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}55, transparent)` }}
        />
      )}
    </div>
  );

  if (phone === "flush") {
    return (
      <Tag
        data-surface="flush"
        /* The surface lives in custom properties so that `md:` can switch it on:
           an inline style cannot be undone by a responsive class. */
        className={`relative md:overflow-hidden md:rounded-[22px] md:border md:border-white/[0.04] md:[background:var(--glass-bg)] md:[backdrop-filter:var(--glass-blur)] md:[box-shadow:var(--glass-shadow)] ${noPad ? "" : "pt-4 md:p-5"} ${gradientBorder ? "fba-gradient-border" : ""} ${className}`}
        style={
          {
            "--glass-bg": SURFACE_BACKGROUND,
            "--glass-blur": SURFACE_BLUR,
            "--glass-shadow": shadow,
            ...style,
          } as React.CSSProperties
        }
      >
        {edge}
        {children}
      </Tag>
    );
  }

  return (
    <Tag
      /* Rimless surface: hardware-curvature radius, near-invisible rim.
         Separation comes from light and depth (top edge glow + soft ambient
         shadow), not from drawn borders — the content sits IN the surface. */
      data-surface="glass"
      className={`relative overflow-hidden rounded-[22px] border border-white/[0.04] ${noPad ? "" : "p-5"} ${gradientBorder ? "fba-gradient-border" : ""} ${className}`}
      style={{
        background: SURFACE_BACKGROUND,
        backdropFilter: SURFACE_BLUR,
        boxShadow: shadow,
        ...style,
      }}
    >
      {edge}
      {children}
    </Tag>
  );
}
