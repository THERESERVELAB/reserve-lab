"use client";

import { useId } from "react";

import {
  type VialForm,
  type VialTint,
  vialMeniscusOpacity,
  vialTintHex,
  vialTintOpacity,
} from "@/lib/enhancement/vial-identity";

/**
 * The member's own vial, drawn at the level their logging left it.
 *
 * The fill is not decoration and it is not an estimate Reserve invented: it is
 * `remainingMg / startingMg` straight out of `computeInventory`, which is
 * arithmetic on values the member entered and doses the member logged. So the
 * glass goes down as they use it, and a vial that looks nearly empty on screen
 * is nearly empty on the shelf.
 *
 * When inventory was never configured there is no honest level to draw, so the
 * glass renders empty with a dashed line instead of a full one — an unknown
 * vial must never look like a full vial.
 */

export type CompoundVialProps = {
  /** 0..1 from logged usage, or null when inventory is not configured. */
  fill: number | null;
  tint: VialTint;
  form: VialForm;
  /** Drives the cap ring only — the liquid never turns red. */
  urgent?: boolean;
  size?: "sm" | "md";
  /** Sentence for screen readers, e.g. "Semaglutide, 40% remaining". */
  label: string;
};

const SIZES = {
  sm: { w: 22, h: 40 },
  md: { w: 34, h: 62 },
} as const;

export function CompoundVial({ fill, tint, form, urgent = false, size = "sm", label }: CompoundVialProps) {
  const uid = useId().replace(/:/g, "");
  const { w, h } = SIZES[size];
  const hex = vialTintHex(tint);
  const opacity = vialTintOpacity(tint);

  const known = fill !== null && Number.isFinite(fill);
  const ratio = known ? Math.min(1, Math.max(0, fill)) : 0;

  /* Geometry in a 0..100 box, scaled by the viewBox. The body is the glass the
     liquid can occupy; the neck and cap sit above it. */
  const bodyTop = form === "capsule" ? 14 : 30;
  const bodyBottom = 96;
  const bodyHeight = bodyBottom - bodyTop;
  const liquidTop = bodyBottom - bodyHeight * ratio;

  const capRing = urgent ? "#ef7d55" : "rgba(255,255,255,0.30)";

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 60 100"
      role="img"
      aria-label={label}
      className="shrink-0 overflow-visible"
    >
      <defs>
        {/* The liquid: denser at the bottom, as a real column of fluid reads. */}
        <linearGradient id={`liq-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hex} stopOpacity={opacity * 0.72} />
          <stop offset="100%" stopColor={hex} stopOpacity={opacity} />
        </linearGradient>
        {/* Glass: a single specular run down the left shoulder, nothing more. */}
        <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="34%" stopColor="#ffffff" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.07" />
        </linearGradient>
        <clipPath id={`body-${uid}`}>
          {form === "capsule" ? (
            <rect x="14" y={bodyTop} width="32" height={bodyHeight} rx="16" />
          ) : (
            <path d="M14 34 h32 v52 a8 8 0 0 1 -8 8 h-16 a8 8 0 0 1 -8 -8 z" />
          )}
        </clipPath>
      </defs>

      {/* Neck and cap — a vial has a crimp, a pump has a collar, a capsule has
          neither, so we simply don't draw one. */}
      {form !== "capsule" && (
        <>
          <rect x="22" y="14" width="16" height="10" rx="2" fill="#ffffff" fillOpacity="0.10" />
          <rect
            x="20"
            y="8"
            width="20"
            height="8"
            rx="3"
            fill="none"
            stroke={capRing}
            strokeWidth="2"
          />
          {form === "pump" && <rect x="27" y="0" width="6" height="9" rx="2" fill="#ffffff" fillOpacity="0.14" />}
          <path d="M22 24 h16 l2 10 h-20 z" fill="#ffffff" fillOpacity="0.06" />
        </>
      )}

      {/* The liquid, clipped to the glass. */}
      <g clipPath={`url(#body-${uid})`}>
        {known && ratio > 0 && (
          <>
            <rect
              x="14"
              y={liquidTop}
              width="32"
              height={bodyBottom - liquidTop}
              fill={`url(#liq-${uid})`}
              className="transition-[y,height] duration-700 ease-out motion-reduce:transition-none"
            />
            {/* Meniscus: the bright line that makes it read as fluid, not a bar. */}
            <rect
              x="14"
              y={liquidTop}
              width="32"
              height="1.6"
              fill={hex}
              fillOpacity={vialMeniscusOpacity(tint)}
              className="transition-[y] duration-700 ease-out motion-reduce:transition-none"
            />
          </>
        )}
        <rect x="14" y={bodyTop} width="32" height={bodyHeight} fill={`url(#glass-${uid})`} />
      </g>

      {/* The glass edge, drawn last so the liquid sits inside it. */}
      {form === "capsule" ? (
        <rect
          x="14"
          y={bodyTop}
          width="32"
          height={bodyHeight}
          rx="16"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.20"
          strokeWidth="1.5"
        />
      ) : (
        <path
          d="M14 34 h32 v52 a8 8 0 0 1 -8 8 h-16 a8 8 0 0 1 -8 -8 z"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.20"
          strokeWidth="1.5"
        />
      )}

      {/* Nothing logged. This has to be clearly distinct from an *empty* vial,
          which is also drawn with no liquid — "I don't know" and "you're out"
          are opposite meanings and must never look alike. So the unknown level
          is a full-width dashed rule, bright enough to read as a deliberate
          mark rather than as a faint smudge. */}
      {!known && (
        <line
          x1="15"
          y1={bodyTop + bodyHeight * 0.5}
          x2="45"
          y2={bodyTop + bodyHeight * 0.5}
          stroke="#ffffff"
          strokeOpacity="0.5"
          strokeWidth="2"
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
