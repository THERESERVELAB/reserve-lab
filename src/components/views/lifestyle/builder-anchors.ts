/* The Build Studio editors' places on the page. The hero's one gold action
   brings the right editor into view and moves focus into it, instead of
   creating, activating or rewriting anything on the member's behalf.

   Mirrors the shipped pattern in `schedule-times-anchor.ts` and
   `fuel-log-anchor.ts`. */

export type BuildStudioSection = "program" | "week" | "sessions" | "intelligence" | "import";

export const BUILD_STUDIO_ANCHOR: Record<BuildStudioSection, string> = {
  program: "build-studio-program",
  week: "build-studio-week",
  sessions: "build-studio-sessions",
  intelligence: "build-studio-intelligence",
  import: "build-studio-import",
};

/**
 * Opens the named editor where it sits (each is a closed row until asked for),
 * brings it into view and focuses its first control. False when it is not on
 * the page.
 */
export function focusBuildStudio(section: BuildStudioSection): boolean {
  if (typeof document === "undefined") return false;
  const host = document.getElementById(BUILD_STUDIO_ANCHOR[section]);
  if (!host) return false;
  const details = host instanceof HTMLDetailsElement ? host : host.querySelector("details");
  if (details && !details.open) details.open = true;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  host.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  /* The row's own summary is not the editor: focus the first control inside it. */
  const body = details ? details.querySelector(":scope > div") ?? host : host;
  const control = body.querySelector<HTMLElement>("button, input, select, textarea, [tabindex]");
  (control ?? host).focus({ preventScroll: true });
  return true;
}
