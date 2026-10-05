import type { EnhancementEntry } from "@/lib/athlete-store";
import { computeReconstitution, reconstitutionInputFromEntry } from "@/lib/enhancement/reconstitution";

/* The member's own planned amount, as they entered it (or as their own vial
   numbers work out). Shown only inside an entry's sheet — never on Apex, never
   as guidance. Moved verbatim from CompoundCommandView so Apex's sheet reads
   the same line. */

/**
 * Planned execution string from member-entered values — the dose/units the member
 * pre-selected or that the reconstitution math produced. Calculation only, never guidance.
 * Returns null when there is nothing entered to display.
 */
export function formatPlannedExecution(entry: EnhancementEntry): string | null {
  const formatAmount = (mg: number): string =>
    mg < 1 ? `${Number((mg * 1000).toFixed(1))} mcg` : `${Number(mg.toFixed(3))} mg`;

  if (entry.route === "injectable") {
    const recon = computeReconstitution(reconstitutionInputFromEntry(entry));
    const units = entry.unitsPlannedPerLog;
    const mg = recon.mgPerLog ?? entry.amountPerLogMg ?? null;
    const parts: string[] = [];
    if (typeof units === "number" && Number.isFinite(units)) parts.push(`${Number(units.toFixed(2))} units`);
    if (typeof mg === "number" && Number.isFinite(mg)) parts.push(formatAmount(mg));
    return parts.length ? parts.join(" · ") : null;
  }

  const mg = entry.amountPerLogMg;
  if (typeof mg === "number" && Number.isFinite(mg)) return `${formatAmount(mg)} total`;
  return null;
}

