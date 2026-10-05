/* Dev-only: headless/hidden preview browsers suspend requestAnimationFrame
   (and throttle timers), which wedges AnimatePresence mode="wait" transitions
   and freezes navigation. Shim rAF onto a MessageChannel loop (not throttled
   when hidden) BEFORE any bundle captures it. Hidden-at-boot / automated
   documents only; dead-code eliminated from production builds. */
if (
  process.env.NODE_ENV !== "production" &&
  typeof window !== "undefined" &&
  document.visibilityState === "hidden"
) {
  const channel = new MessageChannel();
  const queue = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  let scheduled = false;
  channel.port1.onmessage = () => {
    scheduled = false;
    const callbacks = Array.from(queue.values());
    queue.clear();
    const t = performance.now();
    for (const cb of callbacks) {
      try {
        cb(t);
      } catch {
        /* preview-only shim — never let one callback kill the loop */
      }
    }
  };
  window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    queue.set(++nextId, cb);
    if (!scheduled) {
      scheduled = true;
      channel.port2.postMessage(0);
    }
    return nextId;
  };
  window.cancelAnimationFrame = (id: number) => {
    queue.delete(id);
  };
}

export {};
