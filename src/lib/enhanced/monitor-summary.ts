/* ════════════════════════════════════════════════════════════════════════
   ENHANCED MONITOR — an index of the member's own observational records.

   COMPLIANCE (CLAUDE.md · constitution clinical-data.md): this screen is a
   record index and nothing else. It counts what the member has logged and
   routes them to the log that holds it. It never names a compound to start,
   stop, add, reduce or replace, never states an amount or a schedule, never
   interprets a lab value, and never clears anyone to continue.

   The screen it replaces listed nine capability tiles reading "Ready to
   log" — none of which did anything. Those were dead affordances (CLAUDE.md
   UI Quality), and every line here instead reports a real count and opens a
   real surface.

   Pure: no React, no store. Inputs are structural.
   ════════════════════════════════════════════════════════════════════════ */

import { formatDay } from "@/lib/physique/record-summary";

/** Every destination this index can open. Kept as a string so the store's
    DashboardView union stays out of this module's graph; the caller maps it. */
export type MonitorDestination =
  | "supplements"
  | "bloodwork"
  | "physique"
  | "measurements"
  | "progress-photos";

export type MonitorLine = {
  id: string;
  label: string;
  /** What the member has logged here, in their own numbers. */
  detail: string;
  count: number;
  destination: MonitorDestination;
  /** The exact words on the control that opens it. */
  action: string;
};

export type MonitorInput = {
  /** Compound and supplement entries the member recorded. */
  compoundEntryCount: number;
  /** Cycles the member stated, and how many are still open. */
  cycles: ReadonlyArray<{ startDate: string; endedOn?: string }>;
  labRecords: ReadonlyArray<{ testDate: string }>;
  measurementEntries: ReadonlyArray<{ date: string }>;
  photoCheckIns: ReadonlyArray<{ date: string }>;
};

export type MonitorSummary = {
  totalRecords: number;
  statement: string;
  lines: MonitorLine[];
  /** Where the one primary action goes: the emptiest real log, or the compound log. */
  primary: { label: string; destination: MonitorDestination };
};

function newestOf(dates: readonly string[]): string | null {
  const sorted = [...dates].sort();
  return sorted[sorted.length - 1] ?? null;
}

function lastLogged(dates: readonly string[], noun: string): string {
  const newest = newestOf(dates);
  if (!newest) return `Nothing logged yet · ${noun}`;
  return `Last logged ${formatDay(newest)}`;
}

export function monitorSummary(input: MonitorInput): MonitorSummary {
  const openCycles = input.cycles.filter((cycle) => !cycle.endedOn).length;
  const labDates = input.labRecords.map((record) => record.testDate);
  const measurementDates = input.measurementEntries.map((entry) => entry.date);
  const photoDates = input.photoCheckIns.map((checkIn) => checkIn.date);

  const lines: MonitorLine[] = [
    {
      id: "compounds",
      label: "Compound and supplement log",
      detail:
        input.compoundEntryCount > 0
          ? `${input.compoundEntryCount} ${input.compoundEntryCount === 1 ? "entry" : "entries"} you recorded`
          : "Nothing logged yet · what you are taking, in your own words",
      count: input.compoundEntryCount,
      destination: "supplements",
      action: "Open Compound Log",
    },
    {
      id: "cycles",
      label: "Cycles you have stated",
      detail:
        input.cycles.length > 0
          ? `${input.cycles.length} recorded · ${openCycles} still open`
          : "Nothing logged yet · your own start date and planned weeks",
      count: input.cycles.length,
      destination: "supplements",
      action: "Open Compound Log",
    },
    {
      id: "labs",
      label: "Lab records",
      detail: input.labRecords.length > 0 ? `${input.labRecords.length} on file · ${lastLogged(labDates, "labs")}` : "Nothing logged yet · results from your own reports",
      count: input.labRecords.length,
      destination: "bloodwork",
      action: "Open Bloodwork Log",
    },
    {
      id: "measurements",
      label: "Measurement check-ins",
      detail:
        measurementDates.length > 0
          ? `${measurementDates.length} on file · ${lastLogged(measurementDates, "measurements")}`
          : "Nothing logged yet · weight and sites you measure",
      count: measurementDates.length,
      destination: "measurements",
      action: "Open Measurements",
    },
    {
      id: "photos",
      label: "Photo check-ins",
      detail:
        photoDates.length > 0
          ? `${photoDates.length} on file · ${lastLogged(photoDates, "photos")}`
          : "Nothing logged yet · dated sets, never analysed",
      count: photoDates.length,
      destination: "progress-photos",
      action: "Open Progress Photos",
    },
  ];

  const totalRecords = lines.reduce((sum, line) => sum + line.count, 0);
  const newestOverall = newestOf([...labDates, ...measurementDates, ...photoDates]);

  return {
    totalRecords,
    statement:
      totalRecords === 0
        ? "No observational records yet"
        : newestOverall
          ? `${totalRecords} records on file · last logged ${formatDay(newestOverall)}`
          : `${totalRecords} records on file`,
    lines,
    primary:
      input.compoundEntryCount === 0
        ? { label: "Open Compound Log", destination: "supplements" }
        : input.labRecords.length === 0
          ? { label: "Add Lab Record", destination: "bloodwork" }
          : { label: "Open Compound Log", destination: "supplements" },
  };
}
