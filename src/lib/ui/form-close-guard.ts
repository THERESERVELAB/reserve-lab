/* ════════════════════════════════════════════════════════════════════════
   FORM CLOSE GUARD — what a close gesture does to an overlay holding a form.

   A member never loses what they typed to a stray tap:
     backdrop  an outside click never closes a changed form
     escape, button (X / Cancel), drag
               close at once when nothing changed; when something changed,
               ask first ("Discard what you entered?")

   Pure, so the rule is testable without a browser.
   ════════════════════════════════════════════════════════════════════════ */

export type FormCloseSource = "backdrop" | "escape" | "button" | "drag";

/** close: close now · confirm: show the discard bar · stay: do nothing. */
export type FormCloseDecision = "close" | "confirm" | "stay";

export function decideFormClose(
  source: FormCloseSource,
  dirty: boolean,
  options: { backdropClosesWhenClean?: boolean } = {},
): FormCloseDecision {
  if (source === "backdrop") {
    if (dirty) return "stay";
    return options.backdropClosesWhenClean === false ? "stay" : "close";
  }
  return dirty ? "confirm" : "close";
}

/** A comparable snapshot of form state. `undefined` stands in for values
    JSON cannot represent at the top level, so a snapshot is always a string. */
export function formSnapshot(value: unknown): string {
  return JSON.stringify(value) ?? "undefined";
}

export function isFormDirty(initialSnapshot: string, current: unknown): boolean {
  return formSnapshot(current) !== initialSnapshot;
}
