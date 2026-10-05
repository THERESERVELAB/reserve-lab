/**
 * The heavy Compound Command member (shared by compound-today and
 * compound-timing): four main compounds and eleven add-ons at `when`.
 */
export function heavySeed(WHEN: Date) {
  const stamp = WHEN.toISOString();
  const day = `${WHEN.getFullYear()}-${String(WHEN.getMonth() + 1).padStart(2, "0")}-${String(WHEN.getDate()).padStart(2, "0")}`;
  const e = (id: string, name: string, extra: Record<string, unknown>) => ({
    id, name, doseAmount: "", doseUnit: "", frequency: "daily", frequencyType: "daily", scheduleRule: { type: "daily" },
    timingPreference: "", timeOfDayPreference: "custom", goalAssociation: [], isActive: true, createdAt: stamp, updatedAt: stamp, ...extra,
  });
  const sup = (id: string, name: string, time: string, extra: Record<string, unknown> = {}) =>
    e(id, name, { category: "supplement", compoundClass: "supplements", route: "oral", customTime: time, ...extra });
  const taken = (entryId: string, plannedTime: string, actualTime: string) => ({ id: `adh-${entryId}`, entryId, date: day, plannedTime, takenStatus: "taken", actualTime, createdAt: stamp });
  return {
    state: {
      subscriptionTier: "elite",
      activeView: "supplements",
      onboarding: { status: "complete", currentStep: 99, startedAt: stamp },
      setupProfile: { age: 34, setupComplete: true },
      trainingSession: {
        enhancementLog: [
          e("h-test", "Testosterone Cypionate", { officialName: "Testosterone Cypionate", compoundClass: "hormones_testosterone", category: "hormone", route: "injectable", injectionType: "im", customTime: "08:00" }),
          e("h-bpc", "BPC-157", { compoundClass: "peptides_healing", category: "peptide", route: "injectable", injectionType: "subq", customTime: "16:00" }),
          e("h-oxa", "Oxandrolone", { compoundClass: "aas", category: "hormone", route: "oral", customTime: "12:00" }),
          e("h-tirz", "Tirzepatide", { compoundClass: "peptides_dual_agonists", category: "peptide", route: "injectable", injectionType: "subq", customTime: "21:00" }),
          sup("a-fish", "Fish Oil", "08:00"),
          sup("a-d3", "Vitamin D3", "08:00", { category: "vitamin", compoundClass: "vitamins" }),
          sup("a-multi", "Multivitamin", "08:30", { category: "vitamin", compoundClass: "vitamins" }),
          sup("a-elec", "Electrolytes", "13:00"),
          sup("a-creatine", "Creatine", "16:00"),
          sup("a-citr", "Citrulline", "17:00"),
          sup("a-taurine", "Taurine", "17:30"),
          sup("a-ashwa", "Ashwagandha", "20:00"),
          sup("a-mag", "Magnesium", "21:00"),
          sup("a-zinc", "Zinc", "21:30"),
          sup("a-cherry", "Tart Cherry", "22:00", { category: "recovery", compoundClass: "recovery" }),
        ],
        enhancementAdherence: [
          taken("h-test", "08:00", "08:05"),
          taken("a-fish", "08:00", "08:06"),
          taken("a-d3", "08:00", "08:06"),
          taken("a-multi", "08:30", "08:40"),
          { id: "adh-elec", entryId: "a-elec", date: day, plannedTime: "13:00", takenStatus: "skipped", createdAt: stamp },
        ],
        injectionLogs: [],
        compoundSupportLinks: [],
        schedulePlan: { wakeTime: "06:30", sleepTime: "22:30", workoutTime: "17:30" },
      },
    },
    version: 0,
  };
}
