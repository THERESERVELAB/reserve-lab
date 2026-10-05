"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { productionDetail, type DetailCrop, type DetailImageId } from "@/lib/brand/asset-manifest";
import { useAmbientMotion } from "@/lib/ui/use-ambient-motion";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE DETAIL IMAGE — the objects of a room, as a band inside a section.

   PLACEMENT. One per section at most, at the top of the section's existing
   panel. It is never a surface of its own: no border, no rim, no fill of its
   own, so it can never become a card inside a card. It never sits above a
   room's hero statement or its gold primary.

   FRAMES. Below 768px the band is ~220px tall and is served the image's own
   4:5 phone crop; from 768px it is a short band (a clamped height) served the
   16:9 at 1200w or 2400w. The frame's size is CSS only, so nothing shifts
   when the image arrives; the blur placeholder paints first.

   LIVING LAYER (Bible §08, atmosphere band; transform and opacity only):
     · drift — scale 1.00 → 1.05 and a 6px pan over 24s, alternating, from
       the focal point, so the subject never leaves the frame
     · light — a faint bronze wash breathing over 12s
     · reveal — a band below the fold fades and settles once, on first view

   GATES. Reduced motion (OS) removes every animation and the reveal. The
   member's ambient pause holds the drift and light exactly where they are,
   and skips the reveal. The image is visible in every state: the reveal only
   hides a band once the observer has proved it is running, and print and
   reduced motion override it.
   ════════════════════════════════════════════════════════════════════════ */

type Reveal = "rest" | "pending" | "in";

/**
 * Bleed for the top of a padded `GlassPanel phone="flush"`: on phones the band
 * is a softened full-width strip inside the flush section; from `md` it runs to
 * the glass edges and the panel's own radius clips it.
 */
export const DETAIL_BAND_BLEED = "mb-4 rounded-[14px] md:-mx-5 md:-mt-5 md:mb-5 md:rounded-none";

/** Bleed for the top of a padded glass `GlassPanel` (p-5 at every width). */
export const DETAIL_BAND_BLEED_GLASS = "-mx-5 -mt-5 mb-5";

/** How wide the band paints from 768px, for the browser's source choice. */
export type DetailBandWidth = "full" | "half";

const BAND_VW: Record<DetailBandWidth, string> = {
  /* A full-width section: the page caps at 1400px, less the sidebar and gutters. */
  full: "(min-width: 1440px) 1100px, 80vw",
  /* One column of a two-column row from lg. */
  half: "(min-width: 1440px) 560px, (min-width: 1024px) 45vw, 90vw",
};

/** A short band from 768px: roughly 16:5 in a half column, wider in a full-width section. */
const BAND_HEIGHT: Record<DetailBandWidth, string> = {
  full: "md:h-[clamp(170px,19vw,250px)]",
  half: "md:h-[clamp(140px,13vw,190px)]",
};

/** `strip`: a thin line of atmosphere for command screens, where the band must never push the instrument down. */
const STRIP_HEIGHT = "h-[96px] md:h-[112px]";

/** `sizes` for the 16:9 sources, widened by the band's still zoom. */
function bandSizes(width: DetailBandWidth, zoom: number): string {
  if (zoom === 1) return BAND_VW[width];
  return BAND_VW[width]
    .split(", ")
    .map((part) => {
      const at = part.lastIndexOf(" ");
      const media = part.includes("(") ? part.slice(0, at + 1) : "";
      const length = part.includes("(") ? part.slice(at + 1) : part;
      return `${media}calc(${length} * ${zoom})`;
    })
    .join(", ");
}

/** Pan toward the side the focal point sits on, so the drift never opens a gap at an edge. */
function panFor(crop: DetailCrop): string {
  const x = parseFloat(crop.focalPoint);
  return Number.isFinite(x) && x < 50 ? "-6px" : "6px";
}

export function ReserveDetailImage({
  id,
  width = "full",
  size = "band",
  decorative = true,
  className = "",
  children,
}: {
  id: DetailImageId;
  width?: DetailBandWidth;
  /** `band` (default) is the room's short band; `strip` is a thin atmosphere line. */
  size?: "band" | "strip";
  /** Decorative (the default) renders alt="" and hides the band from assistive tech. */
  decorative?: boolean;
  /** Layout only: margins that bleed the band to its panel's edges. */
  className?: string;
  /** An optional label laid over the bottom scrim. */
  children?: ReactNode;
}) {
  const image = productionDetail(id);
  const ref = useRef<HTMLDivElement>(null);
  /* The one motion gate (use-ambient-motion): "reduced" removes the living
     layer, "static" (the member's pause, or a hidden tab) holds it. */
  const motion = useAmbientMotion();
  const [reveal, setReveal] = useState<Reveal>("rest");

  const gated = motion !== "full";

  useEffect(() => {
    const el = ref.current;
    if (gated || !el || typeof IntersectionObserver === "undefined") return;
    let first = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (first) {
          first = false;
          /* Only a band the observer has proved is off screen is hidden, so a
             band on screen at load never blinks and a silent observer never
             parks one at opacity 0. */
          if (entry.isIntersecting) observer.disconnect();
          else setReveal("pending");
          return;
        }
        if (entry.isIntersecting) {
          setReveal("in");
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [gated]);

  if (!image) return null;

  const desktopZoom = image.crop.desktop.zoom ?? 1;
  const mobileZoom = image.crop.mobile.zoom ?? 1;
  const vars = {
    "--detail-focal-d": image.crop.desktop.focalPoint,
    "--detail-focal-m": image.crop.mobile.focalPoint,
    "--detail-zoom-d": String(desktopZoom),
    "--detail-zoom-m": String(mobileZoom),
    "--detail-pan-d": panFor(image.crop.desktop),
    "--detail-pan-m": panFor(image.crop.mobile),
    "--detail-blur": `url("${image.blurDataURL}")`,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      data-detail-image={image.id}
      data-motion={motion === "reduced" ? "still" : motion === "static" ? "paused" : "live"}
      /* A gate that closes mid-reveal shows the band at rest. */
      data-reveal={gated ? "rest" : reveal}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : image.alt}
      /* Height, never aspect-ratio: a capped aspect-ratio box transfers the cap
         to its width and stops short of the panel edge. */
      className={`fba-detail relative isolate overflow-hidden ${size === "strip" ? STRIP_HEIGHT : `h-[220px] ${BAND_HEIGHT[width]}`} ${className}`}
      style={vars}
    >
      <div className="fba-detail-blur absolute inset-0" />
      <div className="fba-detail-frame absolute inset-0">
        <div className="fba-detail-drift absolute inset-0">
          <picture>
            <source media="(max-width: 767px)" srcSet={`${image.src4x5} 1080w`} sizes="100vw" type="image/webp" />
            <source
              media="(min-width: 768px)"
              srcSet={`${image.src1200} 1200w, ${image.src} 2400w`}
              sizes={bandSizes(width, desktopZoom)}
              type="image/webp"
            />
            {/* Art-directed 4:5 / 16:9 sources need <picture>; the files are pre-sized local WebP. */}
            <img
              src={image.src1200}
              alt={decorative ? "" : image.alt}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              draggable={false}
              className="fba-detail-img absolute inset-0 h-full w-full"
            />
          </picture>
        </div>
      </div>
      {/* Bronze cove light, breathing. */}
      <div className="fba-detail-light pointer-events-none absolute inset-0" />
      {/* Scrim: settles the picture into the panel and keeps a label legible. */}
      <div className="fba-detail-scrim pointer-events-none absolute inset-0" />
      {children && <div className="absolute inset-x-0 bottom-0 px-4 pb-3.5 md:px-5 md:pb-4">{children}</div>}
    </div>
  );
}
