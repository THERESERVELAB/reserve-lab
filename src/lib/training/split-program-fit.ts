import type { ProtocolCategory, ProtocolDefinition } from "@/lib/protocol/library";

/** Programs whose week is a bodybuilding split. A split the member chose still
    fits them, so switching between them keeps it. Every other program is built
    around a different kind of week — distance, strength specificity, a
    constrained schedule, home equipment, a women's track — and replaces it. */
const SPLIT_COMPATIBLE_CATEGORIES = new Set<ProtocolCategory>([
  "transformation",
  "shred-cut",
  "lean-bulk",
  "recomp",
  "classic-physique",
  "athletic-performance",
  "premium-advanced",
  "vacation-prep",
]);

export function programKeepsMemberSplit(program: Pick<ProtocolDefinition, "category" | "womensTrack">): boolean {
  return !program.womensTrack && SPLIT_COMPATIBLE_CATEGORIES.has(program.category);
}
