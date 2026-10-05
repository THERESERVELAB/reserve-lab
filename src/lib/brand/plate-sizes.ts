/* ════════════════════════════════════════════════════════════════════════
   PLATE SIZES — what width a full-bleed cover plate actually paints at.

   A cover crop fills the viewport, so it renders at the larger of the
   viewport's width and its height times the plate's aspect ratio:
     16:9 on a phone  → about 178vh wide (much wider than the screen)
     9:16 on a phone  → 56.25vh wide, i.e. about the screen's own width
   `sizes` must follow the source actually served, or a phone served its 9:16
   plate would still ask next/image for the 3840px variant.
   ════════════════════════════════════════════════════════════════════════ */

import type { VisualAsset } from "./asset-manifest";

/** The aspect ratio of the source being served: the mobile one only when a mobile source is what was chosen. */
export function servedAspectRatio(asset: VisualAsset | null, src: string): string {
  if (!asset) return "16:9";
  const variants = Object.values(asset.dayparts ?? {});
  const desktopSources = new Set([asset.desktopSrc, ...variants.map((v) => v?.desktopSrc)].filter(Boolean));
  const mobileSources = new Set([asset.mobileSrc, ...variants.map((v) => v?.mobileSrc)].filter(Boolean));
  return mobileSources.has(src) && !desktopSources.has(src) ? asset.mobileAspectRatio : asset.desktopAspectRatio;
}

/** `sizes` for a full-bleed cover plate of this aspect ratio ("W:H"). */
export function plateSizes(aspectRatio: string): string {
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!(w > 0 && h > 0)) return "max(100vw, 178vh)";
  return `max(100vw, ${Number(((w / h) * 100).toFixed(2))}vh)`;
}
