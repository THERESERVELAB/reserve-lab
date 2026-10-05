"use client";

import { useEffect, useRef, useState } from "react";

import { decideFormClose, formSnapshot, type FormCloseSource } from "@/lib/ui/form-close-guard";

/* ─── Form close guard ─────────────────────────────────────────────────────
   A form never closes on an outside click. X, Cancel and Escape close it
   straight away when nothing was typed, and ask first when something was.

   ReserveBottomSheet takes a `dirty` prop and does all of this itself. A
   hand-rolled overlay uses the hook: route X / Cancel through
   `guard.requestClose`, give its backdrop no close handler, and render
   <DiscardChangesBar guard={guard} /> at the top of the panel. */

export type FormCloseGuard = {
  confirming: boolean;
  /** X, Cancel, Escape: close now when clean, ask first when dirty. */
  requestClose: () => void;
  /** Any close gesture, by source (see lib/ui/form-close-guard.ts). */
  requestCloseFrom: (source: FormCloseSource) => void;
  keepEditing: () => void;
  discard: () => void;
};

export function useFormCloseGuard(
  dirty: boolean,
  onClose: () => void,
  options: {
    /** Listen for Escape on the window. Off when the overlay already
        routes Escape itself (ReserveBottomSheet). */
    escape?: boolean;
    /** Whether an outside click closes the overlay while it is untouched. */
    backdropClosesWhenClean?: boolean;
    /** What Discard does, when it must do more than close — a form whose
        state outlives the overlay clears it here. Defaults to `onClose`. */
    onDiscard?: () => void;
  } = {},
): FormCloseGuard {
  const { escape = true, backdropClosesWhenClean = false, onDiscard } = options;
  const [confirming, setConfirming] = useState(false);
  const requestCloseFrom = (source: FormCloseSource) => {
    const decision = decideFormClose(source, dirty, { backdropClosesWhenClean });
    if (decision === "close") onClose();
    else if (decision === "confirm") setConfirming(true);
  };
  const requestRef = useRef(requestCloseFrom);
  useEffect(() => {
    requestRef.current = requestCloseFrom;
  });
  useEffect(() => {
    if (!escape) return;
    function onKey(event: KeyboardEvent) {
      /* An open list inside the form (ReserveSelect) claims its own Escape. */
      if (event.key === "Escape" && !event.defaultPrevented) requestRef.current("escape");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [escape]);
  return {
    confirming,
    requestClose: () => requestCloseFrom("button"),
    requestCloseFrom,
    keepEditing: () => setConfirming(false),
    discard: () => {
      setConfirming(false);
      (onDiscard ?? onClose)();
    },
  };
}

/** True once `value` differs from what it was on the first render — or on
    the render `resetKey` last changed (pass the sheet's `open` when the form
    state outlives the overlay). Compares JSON snapshots. */
export function useDirtySnapshot(value: unknown, resetKey?: unknown): boolean {
  const current = formSnapshot(value);
  const [snapshot, setSnapshot] = useState(() => ({ key: resetKey, json: current }));
  if (!Object.is(snapshot.key, resetKey)) {
    setSnapshot({ key: resetKey, json: current });
    return false;
  }
  return current !== snapshot.json;
}

/** For a form that lives in a child of the sheet: tells the owner of the
    sheet whether it is dirty, and clean again once the form unmounts.
    Pass a stable callback (a state setter). */
export function useReportDirty(dirty: boolean, onDirtyChange: ((dirty: boolean) => void) | undefined) {
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
}

export function DiscardChangesBar({ guard }: { guard: Pick<FormCloseGuard, "confirming" | "keepEditing" | "discard"> }) {
  if (!guard.confirming) return null;
  return (
    <div role="alertdialog" aria-label="Discard unsaved changes" className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-[#0b0c12] px-5 py-3">
      <p className="text-[12px] text-white/75">Discard what you entered?</p>
      <div className="flex items-center gap-2">
        <button type="button" autoFocus onClick={guard.keepEditing} className="rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/85 transition hover:text-white">Keep Editing</button>
        <button type="button" onClick={guard.discard} className="rounded-lg border border-white/[0.08] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/50 transition hover:text-white/80">Discard</button>
      </div>
    </div>
  );
}
