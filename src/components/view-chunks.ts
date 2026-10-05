"use client";

/**
 * One lazy chunk per room.
 *
 * Every room used to be a static import in `ViewRouter`, so a member's first
 * load carried all 35 of them — Coach Command, Reserve Women, Compound
 * Command, the Black rooms — before the first room could become tappable.
 * Each entry here is its own chunk, fetched only when that room is opened.
 *
 * The persona dashboards are chunks too: Apex carries the pit wall and the
 * fuel plan, and the intermediate dashboard carries Recharts, which no
 * advanced member ever renders. `preloadRoom` starts the right one as soon as
 * the member's persisted state is known, so the download overlaps hydration
 * rather than following it.
 */

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/* The room is only reached through the shell, which is gated on the member's
   own state; there is nothing honest to render on the server. */
const room = (loader: () => Promise<{ default: ComponentType }>) =>
  dynamic(loader, { ssr: false, loading: () => null });

const named = <K extends string>(key: K, loader: () => Promise<Record<K, ComponentType>>) =>
  room(() => loader().then((m) => ({ default: m[key] })));

export const PERSONA_CHUNKS = {
  beginner: named("BeginnerDashboard", () => import("./personas/BeginnerDashboard")),
  intermediate: named("IntermediateDashboard", () => import("./personas/IntermediateDashboard")),
  advanced: named("FinalBossDashboard", () => import("./FinalBossDashboard")),
} as const;

export type PersonaChunkKey = keyof typeof PERSONA_CHUNKS;

export const ROOM_CHUNKS = {
  training: named("TrainingView", () => import("./views/TrainingView")),
  nutrition: named("NutritionView", () => import("./views/NutritionView")),
  physique: named("PhysiqueView", () => import("./views/PhysiqueView")),
  recovery: named("RecoveryView", () => import("./views/RecoveryView")),
  "progress-photos": named("ProgressPhotosView", () => import("./views/ProgressPhotosView")),
  measurements: named("MeasurementsView", () => import("./views/MeasurementsView")),
  "enhanced-monitor": named("EnhancedMonitorView", () => import("./views/EnhancedMonitorView")),
  bloodwork: named("BloodworkView", () => import("./views/BloodworkView")),
  supplements: named("CompoundCommandView", () => import("./views/CompoundCommandView")),
  journal: named("JournalView", () => import("./views/JournalView")),
  education: named("EducationView", () => import("./views/EducationView")),
  settings: named("SettingsView", () => import("./views/SettingsView")),
  "schedule-command": named("ScheduleCommandView", () => import("./views/ScheduleCommandView")),
  "my-coach": named("MyCoachView", () => import("./views/MyCoachView")),
  "protocol-command": named("ProtocolCommandView", () => import("./views/ProtocolCommandView")),
  "program-horizon": named("ProgramHorizonView", () => import("./views/ProgramHorizonView")),
  "response-profile": named("ResponseProfileView", () => import("./views/ResponseProfileView")),
  "lifestyle-builder": named("LifestyleStudioView", () => import("./views/LifestyleStudioView")),
  /* Black rooms */
  "physique-intelligence": named("PhysiqueIntelligenceView", () => import("./views/PhysiqueIntelligenceView")),
  "mesocycle-planner": named("MesocyclePlannerView", () => import("./views/MesocyclePlannerView")),
  "biomarker-intelligence": named("BiomarkerIntelligenceView", () => import("./views/BiomarkerIntelligenceView")),
  "performance-intelligence": named("PerformanceIntelligenceView", () => import("./views/PerformanceIntelligenceView")),
  "peak-physique": named("PeakPhysiqueView", () => import("./views/PeakPhysiqueView")),
  "ai-strategist": named("AIStrategistView", () => import("./views/AIStrategistView")),
  community: named("CommunityView", () => import("./views/CommunityView")),
  /* Reserve Women */
  "womens-cycle": named("CycleCommandView", () => import("./views/women/CycleCommandView")),
  "womens-fertility": named("FertilityCommandView", () => import("./views/women/FertilityCommandView")),
  "womens-pregnancy": named("PregnancyCommandView", () => import("./views/women/PregnancyCommandView")),
} as const;

export type RoomChunkKey = keyof typeof ROOM_CHUNKS;

type Preloadable = { preload?: () => void };

/**
 * Start a room's chunk before React needs it. Called as soon as the member's
 * persisted room is known, so the download overlaps hydration instead of
 * queueing behind it.
 */
export function preloadRoom(view: string, persona?: string): void {
  if (view === "dashboard") {
    const dash = (PERSONA_CHUNKS[persona as PersonaChunkKey] ?? PERSONA_CHUNKS.advanced) as Preloadable;
    dash.preload?.();
    return;
  }
  const entry = ROOM_CHUNKS[view as RoomChunkKey] as Preloadable | undefined;
  entry?.preload?.();
}

/** The rooms the tab bar reaches. Kept in step with `phone-tabs`. */
const TAB_ROOMS: RoomChunkKey[] = ["training", "nutrition", "recovery", "schedule-command"];

/**
 * Once the member's room is interactive and the browser is idle, quietly fetch
 * the rooms one tap away, so a tab switch never waits on a download. Skipped
 * when the member has asked their phone to save data.
 */
export function prefetchTabRooms(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return () => undefined;
  const run = () => TAB_ROOMS.forEach((room) => (ROOM_CHUNKS[room] as Preloadable).preload?.());
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) {
    const handle = idle(run, { timeout: 4000 });
    const cancel = (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
    return () => cancel?.(handle);
  }
  const timer = window.setTimeout(run, 2500);
  return () => window.clearTimeout(timer);
}
