import { beforeEach, describe, expect, it } from "vitest";

import { resetMemberStateToDefaults, useAthleteDashboardStore } from "@/lib/athlete-store";

const store = () => useAthleteDashboardStore.getState();

beforeEach(() => {
  resetMemberStateToDefaults();
});

describe("marking observations for review", () => {
  it("marks, leaves others alone for an unknown id, and unmarks", () => {
    const id = store().addObservation({
      date: "2026-09-10",
      changed: { kind: "text", label: "Moved training to mornings" },
      noticed: { kind: "check-in", ref: "sleep", label: "Sleep" },
    });
    expect(id).toBeTruthy();

    store().toggleObservationReview(id!);
    const marked = store().observations[0].markedForReviewAt;
    expect(marked).toBeTruthy();
    expect(Number.isNaN(Date.parse(marked!))).toBe(false);

    store().toggleObservationReview("missing");
    expect(store().observations[0].markedForReviewAt).toBe(marked);

    store().toggleObservationReview(id!);
    expect(store().observations[0].markedForReviewAt).toBeUndefined();
  });
});
