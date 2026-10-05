import { beforeEach, describe, expect, it } from "vitest";

import { resetMemberStateToDefaults, useAthleteDashboardStore } from "@/lib/athlete-store";

const store = () => useAthleteDashboardStore.getState();

beforeEach(() => {
  resetMemberStateToDefaults();
  store().selectProtocol("recomp-protocol");
  store().setSplitSystem("pplula", "member", 2);
});

describe("a chosen split across program switches", () => {
  it("stays when the new program's week is still a bodybuilding split", () => {
    store().selectProtocol("classic-physique-build");
    expect(store().activeProtocol?.protocolId).toBe("classic-physique-build");
    expect(store().splitSystem).toMatchObject({ key: "pplula", restDayIndex: 2 });
  });

  it("is replaced by a program built around a different kind of week", () => {
    store().selectProtocol("reserve-grand-touring");
    expect(store().activeProtocol?.protocolId).toBe("reserve-grand-touring");
    expect(store().splitSystem.key).toBeNull();
  });
});
