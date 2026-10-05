import {
  EnhancementAdherenceRecord,
  EnhancementEntry,
} from "@/lib/athlete-store";

/**
 * Reserve Inventory math.
 *
 * Pure arithmetic on member-entered values. Reserve does not recommend a dose,
 * does not auto-calculate "how much to take" — it only projects runout dates
 * from the values the member chose to enter.
 */

export type InventorySnapshot = {
  configured: boolean;
  totalMg: number | null;          // vialVolumeMl × concentrationMgPerMl
  startingMg: number | null;       // member-entered startingQuantityMg, or totalMg fallback
  remainingMg: number | null;
  remainingMl: number | null;
  loggedEvents: number;
  loggedMgUsed: number;
  averageMgPerLog: number | null;
  averageMgPerWeek: number | null;
  estimatedRunoutDate: Date | null;
  reorderDate: Date | null;
  status: InventoryStatus;
  costPerWeek: number | null;
};

export type InventoryStatus =
  | "not-configured"
  | "healthy"
  | "reorder-soon"
  | "reorder-now"
  | "out";

export type InventoryInput = {
  entry: EnhancementEntry;
  adherence: EnhancementAdherenceRecord[];
  /** Earliest date (YYYY-MM-DD) we should consider when computing average usage. */
  rangeStart?: string;
  /** Today's date — defaults to now. */
  today?: Date;
};

function safeNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

export function computeInventory(input: InventoryInput): InventorySnapshot {
  const today = input.today ?? new Date();
  const entry = input.entry;

  const vialVolumeMl = safeNumber(entry.vialVolumeMl);
  const concentrationMgPerMl = safeNumber(entry.concentrationMgPerMl);
  const startingQty = safeNumber(entry.totalQuantityMg);
  const remainingOverride = safeNumber(entry.remainingQuantityMg);
  const amountPerLog = safeNumber(entry.amountPerLogMg);
  const reorderLeadDays = safeNumber(entry.reorderLeadDays) ?? 7;
  const costPerVial = safeNumber(entry.costPerVial);

  const totalMg = vialVolumeMl !== null && concentrationMgPerMl !== null
    ? vialVolumeMl * concentrationMgPerMl
    : null;

  const configured = totalMg !== null || startingQty !== null || amountPerLog !== null;
  if (!configured) {
    return {
      configured: false,
      totalMg: null,
      startingMg: null,
      remainingMg: null,
      remainingMl: null,
      loggedEvents: 0,
      loggedMgUsed: 0,
      averageMgPerLog: null,
      averageMgPerWeek: null,
      estimatedRunoutDate: null,
      reorderDate: null,
      status: "not-configured",
      costPerWeek: null,
    };
  }

  // Use only adherence records for THIS entry that were taken
  const takenForEntry = input.adherence.filter((r) => r.entryId === entry.id && r.takenStatus === "taken");
  const loggedEvents = takenForEntry.length;
  const loggedMgUsed = amountPerLog !== null ? loggedEvents * amountPerLog : 0;

  const startingMg = startingQty ?? totalMg;
  const remainingMg = remainingOverride !== null
    ? remainingOverride
    : startingMg !== null
      ? Math.max(0, startingMg - loggedMgUsed)
      : null;
  const remainingMl = remainingMg !== null && concentrationMgPerMl !== null && concentrationMgPerMl > 0
    ? remainingMg / concentrationMgPerMl
    : null;

  // Date range for usage estimation
  let rangeDays = 7;
  if (loggedEvents > 0) {
    const sortedDates = takenForEntry
      .map((r) => new Date(r.createdAt))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (sortedDates.length > 0) {
      rangeDays = Math.max(1, daysBetween(sortedDates[0], today) || 7);
    }
  }
  const averageMgPerLog = amountPerLog;
  const averageMgPerWeek = amountPerLog !== null
    ? (loggedEvents > 0 ? (loggedMgUsed / rangeDays) * 7 : amountPerLog)
    : null;
  const averageDailyUse = averageMgPerWeek !== null ? averageMgPerWeek / 7 : null;

  let estimatedRunoutDate: Date | null = null;
  if (remainingMg !== null && averageDailyUse !== null && averageDailyUse > 0) {
    const daysLeft = remainingMg / averageDailyUse;
    estimatedRunoutDate = new Date(today.getTime() + daysLeft * 24 * 60 * 60 * 1000);
  }
  const reorderDate = estimatedRunoutDate
    ? new Date(estimatedRunoutDate.getTime() - reorderLeadDays * 24 * 60 * 60 * 1000)
    : null;

  let status: InventoryStatus;
  if (remainingMg !== null && remainingMg <= 0) status = "out";
  else if (reorderDate !== null && reorderDate.getTime() <= today.getTime()) status = "reorder-now";
  else if (estimatedRunoutDate !== null && daysBetween(today, estimatedRunoutDate) <= reorderLeadDays * 2) status = "reorder-soon";
  else status = "healthy";

  const costPerWeek = costPerVial !== null && totalMg !== null && averageMgPerWeek !== null && totalMg > 0
    ? (costPerVial / totalMg) * averageMgPerWeek
    : null;

  return {
    configured: true,
    totalMg,
    startingMg,
    remainingMg,
    remainingMl,
    loggedEvents,
    loggedMgUsed,
    averageMgPerLog,
    averageMgPerWeek,
    estimatedRunoutDate,
    reorderDate,
    status,
    costPerWeek,
  };
}

export function inventoryStatusLabel(s: InventoryStatus): string {
  switch (s) {
    case "not-configured": return "Not Configured";
    case "healthy": return "Healthy";
    case "reorder-soon": return "Reorder Soon";
    case "reorder-now": return "Reorder Now";
    case "out": return "Out";
  }
}

export function inventoryStatusColor(s: InventoryStatus): string {
  switch (s) {
    case "not-configured": return "rgba(255,255,255,0.4)";
    case "healthy": return "#79e3b5";
    case "reorder-soon": return "#e8c87a";
    case "reorder-now": return "#d5b15f";
    case "out": return "#ef7d55";
  }
}

export function formatDateShort(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
