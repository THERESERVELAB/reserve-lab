/* ════════════════════════════════════════════════════════════════════════
   LAB TYPES — shared by the report parser, the safety engine and the store.

   Kept dependency-free so the store can import them without pulling the
   parser or the compound library into its module graph.
   ════════════════════════════════════════════════════════════════════════ */

/**
 * The flag a LAB printed beside a result. Reserve never invents one — it only
 * carries what the report said, so a member can see their lab's own call.
 */
export type LabFlag = "H" | "L" | "HH" | "LL" | "A" | "critical";

export const LAB_FLAG_LABEL: Record<LabFlag, string> = {
  H: "High",
  L: "Low",
  HH: "Critical high",
  LL: "Critical low",
  A: "Abnormal",
  critical: "Critical",
};

/** Flags a lab uses to mark a result it considers critical. */
export function isCriticalLabFlag(flag: LabFlag | undefined): boolean {
  return flag === "HH" || flag === "LL" || flag === "critical";
}
