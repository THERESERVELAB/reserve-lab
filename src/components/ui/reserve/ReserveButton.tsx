"use client";

import React from "react";

import { RADIUS, RESERVE, alpha } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE ACTION FAMILY — one action language for the whole product.

   Bible §11: the gold CTA is scarce. ONE primary action per screen. Every
   other action steps down. Before this component the product hand-rolled
   its buttons inline, which is how a screen ends up with five equal CTAs
   and no discernible next move.

   The four tiers, and what each one means:

     primary   gold, filled. THE next move. One per screen.
     secondary outlined. A real alternative to the primary.
     quiet     text only. Navigation and reversible side actions.
     danger    outlined in alert orange. Destructive and irreversible.

   Rules enforced here rather than left to the caller:

     - `disabled` REQUIRES `disabledReason`. TypeScript will not let a dead
       control ship without an explanation (CLAUDE.md: no dead CTAs).
     - Minimum 44px target on every tier, at every density.
     - `.fba-cta-sheen` is available on primary ONLY (Bible §11) and only
       when explicitly asked for.
     - `busy` keeps the button's width so a save never reflows the layout.
   ════════════════════════════════════════════════════════════════════════ */

export type ReserveButtonTier = "primary" | "secondary" | "quiet" | "danger";
export type ReserveButtonSize = "sm" | "md" | "lg";

type BaseProps = {
  children: React.ReactNode;
  tier?: ReserveButtonTier;
  size?: ReserveButtonSize;
  accent?: string;
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  /** Trailing icon — use for "leads somewhere", not for decoration. */
  iconAfter?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  fullWidth?: boolean;
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  /** Scarce sheen. Primary tier only; ignored elsewhere (Bible §11). */
  sheen?: boolean;
  /** In-flight. Announces politely and holds layout. */
  busy?: boolean;
  /**
   * While busy, stay focusable: `aria-disabled` and a swallowed activation
   * instead of the native `disabled` attribute, which drops a focused button's
   * focus to <body>. For controls the member is likely to be focused on when
   * they start work (sign-in, save). Off by default.
   */
  busyKeepsFocus?: boolean;
};

/* A disabled button MUST say why. Encoding that in the type is the only way
   it stays true as the product grows. */
type DisabledProps =
  | { disabled: true; disabledReason: string }
  | { disabled?: false; disabledReason?: never };

export type ReserveButtonProps = BaseProps & DisabledProps;

const SIZE: Record<ReserveButtonSize, { pad: string; text: string; icon: number }> = {
  sm: { pad: "px-3 py-2", text: "text-[11px]", icon: 12 },
  md: { pad: "px-4 py-2.5", text: "text-[12px]", icon: 14 },
  lg: { pad: "px-5 py-3", text: "text-[13px]", icon: 16 },
};

export function ReserveButton({
  children,
  tier = "secondary",
  size = "md",
  accent = RESERVE.gold,
  icon: Icon,
  iconAfter: IconAfter,
  fullWidth = false,
  className = "",
  type = "button",
  onClick,
  sheen = false,
  busy = false,
  busyKeepsFocus = false,
  disabled = false,
  disabledReason,
}: ReserveButtonProps) {
  const s = SIZE[size];
  const inert = disabled || busy;
  const nativeDisabled = disabled || (busy && !busyKeepsFocus);

  const style: React.CSSProperties = { borderRadius: RADIUS.control };
  let tone = "";

  switch (tier) {
    case "primary":
      /* Filled gold on near-black text — the highest-contrast pairing in the
         palette, and the only one that should ever read as "do this". */
      style.background = `linear-gradient(135deg, ${accent} 0%, ${RESERVE.amber} 100%)`;
      style.color = "#0a0b10";
      style.border = "1px solid transparent";
      style.boxShadow = `0 10px 30px -12px ${alpha(accent, 0.55)}`;
      tone = "font-bold";
      break;
    case "secondary":
      style.background = alpha(accent, 0.08);
      style.border = `1px solid ${alpha(accent, 0.3)}`;
      style.color = accent;
      tone = "font-semibold";
      break;
    case "quiet":
      style.background = "transparent";
      style.border = "1px solid transparent";
      style.color = "rgba(255,255,255,0.55)";
      tone = "font-medium hover:text-white/85";
      break;
    case "danger":
      style.background = alpha(RESERVE.red, 0.08);
      style.border = `1px solid ${alpha(RESERVE.red, 0.32)}`;
      style.color = RESERVE.red;
      tone = "font-semibold";
      break;
  }

  return (
    <button
      type={type}
      onClick={
        inert
          ? busyKeepsFocus
            ? /* Also stops a submit button's form submission while busy. */
              (event) => event.preventDefault()
            : undefined
          : onClick
      }
      disabled={nativeDisabled}
      title={disabled ? disabledReason : undefined}
      aria-disabled={inert || undefined}
      aria-busy={busy || undefined}
      className={[
        "relative inline-flex min-h-[44px] items-center justify-center gap-2",
        "uppercase tracking-[0.1em] transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-45",
        busy && busyKeepsFocus ? "cursor-progress opacity-80" : "",
        !inert && tier === "primary" ? "hover:brightness-110" : "",
        !inert && tier !== "primary" ? "hover:brightness-125" : "",
        sheen && tier === "primary" && !inert ? "fba-cta-sheen" : "",
        fullWidth ? "w-full" : "",
        s.pad,
        s.text,
        tone,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      {Icon && <Icon size={s.icon} aria-hidden="true" />}
      <span>{children}</span>
      {IconAfter && <IconAfter size={s.icon} aria-hidden="true" />}
      {/* Politely announced, visually silent — the label already changed
          nothing, so a spinner here would only add movement. */}
      {busy && <span className="sr-only">Working</span>}
    </button>
  );
}

/* ─── Icon action ─────────────────────────────────────────────────────────
   Separate component because an icon-only control has one extra hard
   requirement: it MUST carry an accessible name. Making `label` required
   is the enforcement. */

export type ReserveIconButtonProps = {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  /** Required. Becomes both the accessible name and the tooltip. */
  label: string;
  onClick?: () => void;
  accent?: string;
  size?: number;
  className?: string;
} & DisabledProps;

export function ReserveIconButton({
  icon: Icon,
  label,
  onClick,
  accent = RESERVE.gold,
  size = 16,
  className = "",
  disabled = false,
  disabledReason,
}: ReserveIconButtonProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      title={disabled ? disabledReason : label}
      className={`grid min-h-[44px] min-w-[44px] place-items-center transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      style={{
        borderRadius: RADIUS.control,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        color: alpha(accent, 0.8),
      }}
    >
      <Icon size={size} aria-hidden="true" />
    </button>
  );
}
