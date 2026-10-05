"use client";

/* ════════════════════════════════════════════════════════════════════════
   COACHING UI STORE — the only seam between React and the coaching domain.

   Components never touch localStorage or repositories directly: they read
   the snapshot held here and call these actions, which delegate to the
   repository layer. Swapping in Supabase repositories later changes this
   file's wiring only.
   ════════════════════════════════════════════════════════════════════════ */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { deriveClientAlerts } from "./alerts/engine";
import { DEMO_IDS, ensureDemoScenario } from "./fixtures";
import { ensureOperationsDemo } from "./operations/fixtures";
import { createOperationsRepositories, type OperationsRepositories } from "./operations/local";
import { createLocalRepositories, type CoachingRepositories } from "./repositories/local";
import {
  getCoachingStore,
  resetCoachingStorage,
  type CoachingDatabase,
  emptyCoachingDatabase,
} from "./storage";
import type { ClientAlert, ClientSummary, ReserveMember } from "./types";

/** Everything the UI can reach — base coaching repos plus the Performance
    Operations bundle. Components only ever get this through `run`. */
export type AppRepositories = CoachingRepositories & { ops: OperationsRepositories };

export type CoachView =
  | "command"
  | "clients"
  | "client"
  | "messages"
  | "reviews"
  | "programs"
  | "nutrition"
  | "schedules"
  | "live"
  | "alerts"
  | "templates";

export type WorkspaceMode = "personal" | "coach";

type CoachingUiState = {
  hydrated: boolean;
  /** Which coaching-domain member the app is currently acting as (dev fixture switching). */
  actorId: string;
  workspace: WorkspaceMode;
  coachView: CoachView;
  activeClientId: string | null;
  activeThreadId: string | null;
  lastError: string | null;

  /* Snapshot (read-only projections of the domain) */
  db: CoachingDatabase;
  clients: ClientSummary[];
  alerts: ClientAlert[];
  unreadTotal: number;

  /* Actions */
  bootstrap: () => void;
  refresh: () => Promise<void>;
  setWorkspace: (mode: WorkspaceMode) => void;
  setCoachView: (view: CoachView) => void;
  openClient: (athleteId: string) => void;
  setActiveThread: (threadId: string | null) => void;
  setActor: (memberId: string) => void;
  clearError: () => void;
  /** Coach disposition on a derived alert (reviewed / snoozed / dismissed). */
  setAlertState: (alertId: string, state: "open" | "reviewed" | "snoozed" | "resolved" | "dismissed") => void;
  /** Runs a repository action, refreshes the snapshot, surfaces errors. */
  run: <T>(fn: (repos: AppRepositories) => Promise<T>) => Promise<T | null>;
};

let repos: AppRepositories | null = null;
let unsubscribe: (() => void) | null = null;

function getRepos(): AppRepositories {
  if (!repos) {
    const store = getCoachingStore();
    repos = { ...createLocalRepositories(store), ops: createOperationsRepositories(store) };
  }
  return repos;
}

/** Demo data loads in development only — production starts honest and empty
    unless the owner explicitly opts into the demo scenario. */
function demoAllowed(): boolean {
  return process.env.NODE_ENV === "development";
}

export const useCoachingStore = create<CoachingUiState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      actorId: DEMO_IDS.coach,
      workspace: "personal",
      coachView: "command",
      activeClientId: null,
      activeThreadId: null,
      lastError: null,

      db: emptyCoachingDatabase(),
      clients: [],
      alerts: [],
      unreadTotal: 0,

      bootstrap: () => {
        if (typeof window === "undefined" || get().hydrated) return;
        const store = getCoachingStore();
        if (demoAllowed()) {
          ensureDemoScenario(store);
          ensureOperationsDemo(store);
        }
        if (!unsubscribe) {
          unsubscribe = store.subscribe(() => void get().refresh());
        }
        set({ hydrated: true });
        void get().refresh();
      },

      refresh: async () => {
        const { actorId } = get();
        const store = getCoachingStore();
        const db = store.read();
        const r = getRepos();
        const member = db.members.find((m) => m.id === actorId);
        const isCoach = member?.tier === "premium_coach";
        const [clients, unreadTotal] = await Promise.all([
          isCoach ? r.coaching.listClients(actorId) : Promise.resolve([]),
          r.messaging.unreadCount(actorId),
        ]);
        const alerts = isCoach ? deriveClientAlerts(db, actorId, new Date()) : [];
        set({ db, clients, alerts, unreadTotal });
      },

      setWorkspace: (workspace) => set({ workspace }),
      setCoachView: (coachView) =>
        set({ coachView, ...(coachView !== "client" ? { activeClientId: null } : {}) }),
      openClient: (athleteId) => set({ coachView: "client", activeClientId: athleteId }),
      setActiveThread: (activeThreadId) => set({ activeThreadId }),

      setActor: (actorId) => {
        set({ actorId, activeClientId: null, activeThreadId: null, workspace: "personal" });
        void get().refresh();
      },

      clearError: () => set({ lastError: null }),

      setAlertState: (alertId, state) => {
        getCoachingStore().write((db) => {
          if (state === "open") delete db.alertStates[alertId];
          else db.alertStates[alertId] = state;
        });
        void get().refresh();
      },

      run: async (fn) => {
        try {
          const result = await fn(getRepos());
          await get().refresh();
          set({ lastError: null });
          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Something went wrong.";
          set({ lastError: message });
          await get().refresh();
          return null;
        }
      },
    }),
    {
      name: "reserve-coaching-ui",
      storage: createJSONStorage(() => localStorage),
      // Only UI position persists here; domain data lives in the repositories.
      partialize: (s) => ({
        actorId: s.actorId,
        workspace: s.workspace,
        coachView: s.coachView,
        activeClientId: s.activeClientId,
      }),
    },
  ),
);

/* ─── Derived helpers (pure reads over the snapshot) ──────────────────── */

export function currentCoachingMember(s: CoachingUiState): ReserveMember | null {
  return s.db.members.find((m) => m.id === s.actorId) ?? null;
}

/** Resolves `?actor=` shorthand (anthony | jasmine | luis | marcus) for the
    development fixture switcher. Returns null when unrecognized. */
export function resolveActorParam(param: string): string | null {
  const key = param.trim().toLowerCase();
  if (!key) return null;
  if (key.includes("anthony")) return DEMO_IDS.anthony;
  if (key.includes("jasmine")) return DEMO_IDS.jasmine;
  if (key.includes("luis")) return DEMO_IDS.luis;
  if (key.includes("noah")) return DEMO_IDS.noah;
  if (key.includes("marcus") || key.includes("coach")) return DEMO_IDS.coach;
  return null;
}

/** Reset cached coaching data and UI identity between authenticated accounts. */
export function resetCoachingForAccountBoundary(): void {
  unsubscribe?.();
  unsubscribe = null;
  repos = null;
  resetCoachingStorage();
  useCoachingStore.setState({
    hydrated: false,
    actorId: DEMO_IDS.coach,
    workspace: "personal",
    coachView: "command",
    activeClientId: null,
    activeThreadId: null,
    lastError: null,
    db: emptyCoachingDatabase(),
    clients: [],
    alerts: [],
    unreadTotal: 0,
  });
}
