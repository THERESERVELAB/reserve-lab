"use client";

import { useEffect, useState } from "react";

import { HORIZON } from "@/lib/apex/horizon-projection";

/**
 * A horizon track's measured width. The first render uses the projection's
 * default. A callback ref, so a track that mounts after its parent (a clock
 * arriving, a session appearing) is still observed.
 */
export function useTrackWidth() {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(HORIZON.defaultTrackPx);

  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const measured = Math.round(entries[0]?.contentRect.width ?? 0);
      /* A hidden track (phones) measures 0: keep the last real width. */
      if (measured > 0) setWidth((current) => (current === measured ? current : measured));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, width] as const;
}
