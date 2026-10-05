/* ════════════════════════════════════════════════════════════════════════
   N=1 REVIEW — the member's observations, grouped by what they say changed.

   Grouping and counting only. Reserve never scores, links or interprets an
   observation.
   ════════════════════════════════════════════════════════════════════════ */

import type { Observation, ObservationChangedKind, ObservationRef } from "@/lib/history/types";

export type N1Group = {
  key: string;
  /** As written on the newest observation in the group. */
  changed: ObservationRef<ObservationChangedKind>;
  /** Newest first. */
  observations: Observation[];
  count: number;
  markedCount: number;
  latestDate: string;
};

export function groupKeyOf(observation: Observation): string {
  const { kind, ref, label } = observation.changed;
  return ref ? `${kind}:${ref}` : `text:${label.trim().toLowerCase()}`;
}

/** The Lab Response marker id when the member noticed a lab marker. */
export function labMarkerIdOf(observation: Observation): string | null {
  return observation.noticed.kind === "marker" && observation.noticed.ref ? observation.noticed.ref : null;
}

export function buildN1Review(observations: Observation[], options: { onlyMarked?: boolean } = {}): N1Group[] {
  const shown = options.onlyMarked ? observations.filter((o) => o.markedForReviewAt) : observations;
  const groups = new Map<string, Observation[]>();
  for (const observation of shown) {
    const key = groupKeyOf(observation);
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  return [...groups.entries()]
    .map(([key, list]): N1Group => {
      const sorted = [...list].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
      return {
        key,
        changed: sorted[0].changed,
        observations: sorted,
        count: sorted.length,
        markedCount: sorted.filter((o) => o.markedForReviewAt).length,
        latestDate: sorted[0].date,
      };
    })
    .sort((a, b) => b.latestDate.localeCompare(a.latestDate));
}
