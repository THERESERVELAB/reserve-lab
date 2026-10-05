import { describe, expect, it } from "vitest";

import { COMMUNITY_CHANNELS } from "../channels";
import { describeCommunity, publicChannelText } from "../status";

describe("describeCommunity", () => {
  it("says the community is not open and shows no conversation", () => {
    const status = describeCommunity({ channels: COMMUNITY_CHANNELS, tier: "elite" });
    expect(status.statement).toBe("Community is not open yet.");
    expect(status.support).toMatch(/no conversations to show/);
  });

  it("counts the channels the member's own plan includes", () => {
    const black = describeCommunity({ channels: COMMUNITY_CHANNELS, tier: "elite" });
    expect(black.channelsTotal).toBe(COMMUNITY_CHANNELS.length);
    expect(black.channelsIncluded).toBe(COMMUNITY_CHANNELS.length);
    expect(black.fullAccessPlan).toBeNull();

    const signature = describeCommunity({ channels: COMMUNITY_CHANNELS, tier: "core" });
    expect(signature.channelsIncluded).toBe(COMMUNITY_CHANNELS.filter((c) => c.requiredTier === "core").length);
    expect(signature.fullAccessPlan).toBe("Reserve Black");
  });

  it("labels access with public plan names only", () => {
    const status = describeCommunity({ channels: COMMUNITY_CHANNELS, tier: "core" });
    const labels = new Set(status.rows.map((row) => row.access));
    expect([...labels].sort()).toEqual(["Included in your plan", "Reserve Black"]);
    const text = JSON.stringify(status);
    for (const internal of ["Elite", "Core", "Pro"]) expect(text).not.toMatch(new RegExp(`\\b${internal}\\b`));
  });

  it("rewrites an internal tier word inside stored channel text", () => {
    expect(publicChannelText("Elite War Room")).toBe("Reserve Black War Room");
    expect(publicChannelText("Private Elite accountability")).toBe("Private Reserve Black accountability");
  });

  it("is honest when no channels exist", () => {
    const status = describeCommunity({ channels: [], tier: "elite" });
    expect(status.channelsTotal).toBe(0);
    expect(status.rows).toEqual([]);
    expect(status.support).toMatch(/No channels are set up/);
  });
});
