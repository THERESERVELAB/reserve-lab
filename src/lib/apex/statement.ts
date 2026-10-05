/* ─── Dynamic statement system — the screen is designed around one line ─────
   The hero statement reacts to the member's real state (readiness reserve,
   recovery day, sleep conflict). Behavioral coaching language only.

   Thresholds and copy are DESIGN_BIBLE.md §05 canon. Change them only with a
   versioned Bible edit, never as a screen decision.                        */
export function readinessStatement(opts: { readiness: number | null; recoveryDay: boolean; conflict: boolean }): { hero: string; command: string } {
  const { readiness, recoveryDay, conflict } = opts;
  if (recoveryDay) {
    return { hero: "Protect Recovery", command: "Restore the system. Tomorrow's output is built tonight." };
  }
  if (readiness === null) {
    return { hero: "Bring Systems Online", command: "Log a recovery check-in to activate the briefing." };
  }
  if (readiness < 45) {
    return { hero: "Do Not Force Output", command: `You are ${readiness}% ready. Recovery debt is elevated — sleep and hydration take priority.` };
  }
  if (readiness < 62) {
    return { hero: "Recovery Takes Priority", command: `You are ${readiness}% ready. Protect the system and reduce load today.` };
  }
  if (readiness < 78) {
    return {
      hero: "Execute With Discipline",
      command: conflict
        ? `You are ${readiness}% ready. Training approved — keep volume controlled and protect the sleep window.`
        : `You are ${readiness}% ready. Training approved — keep volume controlled.`,
    };
  }
  return {
    hero: "Ready For High Output",
    command: conflict
      ? `You are ${readiness}% ready for high output. Close the day early — tonight compresses sleep.`
      : `You are ${readiness}% ready for high output. Hard session approved.`,
  };
}
