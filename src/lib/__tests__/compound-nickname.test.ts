import { beforeEach, describe, expect, it } from "vitest";

import { hydrateMemberState, resetMemberStateToDefaults, useAthleteDashboardStore } from "@/lib/athlete-store";
import { compoundIdentity } from "@/components/safety/useSafetyContext";

/** A member who logs "Masteron" sees Masteron, even though the catalog knows it as Drostanolone. */

const entry = (fields: Record<string, unknown>) => ({
  id: "mast", category: "hormone", doseAmount: "", doseUnit: "mg", frequency: "", timingPreference: "", goalAssociation: [], isActive: true, createdAt: "", updatedAt: "", ...fields,
});

beforeEach(() => resetMemberStateToDefaults());

describe("compound nicknames", () => {
  it("keeps the member's own name when no display name was set", () => {
    hydrateMemberState({ trainingSession: { enhancementLog: [entry({ name: "Masteron", officialName: "Drostanolone" })] } });
    const [logged] = useAthleteDashboardStore.getState().trainingSession.enhancementLog;
    expect(logged.displayName).toBe("Masteron");
    expect(compoundIdentity(logged)).toMatchObject({ name: "Masteron", officialName: "Drostanolone" });
  });

  it("repairs the old default that copied the official name over the member's name", () => {
    hydrateMemberState({ trainingSession: { enhancementLog: [entry({ name: "Masteron", officialName: "Drostanolone", displayName: "Drostanolone" })] } });
    expect(useAthleteDashboardStore.getState().trainingSession.enhancementLog[0].displayName).toBe("Masteron");
  });

  it("keeps a nickname the member chose on purpose", () => {
    hydrateMemberState({ trainingSession: { enhancementLog: [entry({ name: "Drostanolone", officialName: "Drostanolone", displayName: "Mast E" })] } });
    expect(useAthleteDashboardStore.getState().trainingSession.enhancementLog[0].displayName).toBe("Mast E");
  });
});
