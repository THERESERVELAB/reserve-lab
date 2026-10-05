/* ════════════════════════════════════════════════════════════════════════
   COACHING PERSISTENCE — one versioned document, storage-agnostic.

   The UI never touches localStorage directly: repositories talk to this
   store, and the store talks to a swappable adapter. In the browser the
   adapter is localStorage + BroadcastChannel (same-browser multi-tab sync);
   in tests/SSR it is an in-memory map. Replacing this with Supabase later
   means implementing new repositories — nothing in the UI changes.
   ════════════════════════════════════════════════════════════════════════ */

import { normalizeCoachingPermissions } from "./permissions";
import type {
  ClinicalAccessLogEntry,
  ClinicalConsent,
  ClinicalCoordinationRecord,
  ClinicalObservation,
  CoachAIDraft,
  DailyDirective,
  DirectivePreference,
  GroceryPlan,
  LifestylePlan,
  MealCompletionEntry,
  MealFlag,
  MealPlan,
  MealPrepSession,
  NutritionArchitecture,
  PantryItem,
  ProtocolAdherenceEntry,
  StoreProfile,
  SupplementProtocol,
} from "./operations/types";
import type {
  ActiveDayPlan,
  AlertStatus,
  AthleteProfile,
  ChatMessage,
  CoachActivityEvent,
  CoachNote,
  CoachPrescription,
  CoachProfile,
  CoachReview,
  CoachTemplate,
  CoachTemplateAssignment,
  CoachingInvitation,
  CoachingRelationship,
  Conversation,
  LiveDayOverride,
  LiveDayTimelineEvent,
  PermissionAuditRecord,
  PhysiquePhotoRecord,
  ReserveMember,
  WeeklyCheckIn,
  WeightEntry,
} from "./types";

/* ─── Document shape ──────────────────────────────────────────────────── */

export type CoachingDatabase = {
  members: ReserveMember[];
  coachProfiles: CoachProfile[];
  athleteProfiles: AthleteProfile[];
  relationships: CoachingRelationship[];
  invitations: CoachingInvitation[];
  permissionAudit: PermissionAuditRecord[];
  conversations: Conversation[];
  messages: ChatMessage[];
  prescriptions: CoachPrescription[];
  activeDayPlans: ActiveDayPlan[];
  liveDayOverrides: LiveDayOverride[];
  liveDayEvents: LiveDayTimelineEvent[];
  checkIns: WeeklyCheckIn[];
  reviews: CoachReview[];
  weightEntries: WeightEntry[];
  photos: PhysiquePhotoRecord[];
  notes: CoachNote[];
  templates: CoachTemplate[];
  templateAssignments: CoachTemplateAssignment[];
  activity: CoachActivityEvent[];
  /** Coach-set alert dispositions keyed by deterministic alert id. */
  alertStates: Record<string, AlertStatus>;
  /* ── Performance Operations (schema v2) ─────────────────────────────── */
  supplementProtocols: SupplementProtocol[];
  protocolAdherence: ProtocolAdherenceEntry[];
  clinicalRecords: ClinicalCoordinationRecord[];
  clinicalObservations: ClinicalObservation[];
  clinicalConsents: ClinicalConsent[];
  clinicalAccessLog: ClinicalAccessLogEntry[];
  nutritionArchitectures: NutritionArchitecture[];
  mealPlans: MealPlan[];
  mealCompletions: MealCompletionEntry[];
  mealFlags: MealFlag[];
  mealPrepSessions: MealPrepSession[];
  groceryPlans: GroceryPlan[];
  pantryItems: PantryItem[];
  storeProfiles: StoreProfile[];
  lifestylePlans: LifestylePlan[];
  directivePreferences: DirectivePreference[];
  dailyDirectives: DailyDirective[];
  aiDrafts: CoachAIDraft[];
  /** True once the demo scenario has been seeded (so we never re-seed over real edits). */
  seededScenario: string | null;
  /** Additive operations demo layer, seeded once on top of the base scenario. */
  seededOperations: string | null;
};

export function emptyCoachingDatabase(): CoachingDatabase {
  return {
    members: [],
    coachProfiles: [],
    athleteProfiles: [],
    relationships: [],
    invitations: [],
    permissionAudit: [],
    conversations: [],
    messages: [],
    prescriptions: [],
    activeDayPlans: [],
    liveDayOverrides: [],
    liveDayEvents: [],
    checkIns: [],
    reviews: [],
    weightEntries: [],
    photos: [],
    notes: [],
    templates: [],
    templateAssignments: [],
    activity: [],
    alertStates: {},
    supplementProtocols: [],
    protocolAdherence: [],
    clinicalRecords: [],
    clinicalObservations: [],
    clinicalConsents: [],
    clinicalAccessLog: [],
    nutritionArchitectures: [],
    mealPlans: [],
    mealCompletions: [],
    mealFlags: [],
    mealPrepSessions: [],
    groceryPlans: [],
    pantryItems: [],
    storeProfiles: [],
    lifestylePlans: [],
    directivePreferences: [],
    dailyDirectives: [],
    aiDrafts: [],
    seededScenario: null,
    seededOperations: null,
  };
}

/* ─── Adapter contract ────────────────────────────────────────────────── */

export interface CoachingStorageAdapter {
  load(): CoachingDatabase | null;
  save(db: CoachingDatabase): void;
  /** Cross-context change notifications (other tabs). Returns unsubscribe. */
  onExternalChange(cb: () => void): () => void;
}

export const COACHING_STORAGE_KEY = "reserve.coaching.v1";
const CHANNEL_NAME = "reserve-coaching-sync";
const SCHEMA_VERSION = 2;

export type CoachingEnvelope = { version: number; data: Partial<CoachingDatabase> };

export function migrateCoachingEnvelope(envelope: CoachingEnvelope): CoachingDatabase {
  // v1 → v2: Performance Operations collections default empty, and every
  // persisted relationship's permission set is normalized so pre-operations
  // grants keep exactly the scope the athlete already approved (clinical and
  // supplements never auto-grant). Existing member data is never dropped.
  const base = emptyCoachingDatabase();
  const db: CoachingDatabase = { ...base, ...envelope.data };
  if (envelope.version < 2) {
    db.relationships = db.relationships.map((rel) => ({
      ...rel,
      permissions: normalizeCoachingPermissions(rel.permissions ?? {}),
    }));
    db.invitations = db.invitations.map((invite) => ({
      ...invite,
      requestedPermissions: normalizeCoachingPermissions(invite.requestedPermissions ?? {}),
    }));
  }
  return db;
}

/* ─── Browser adapter: localStorage + BroadcastChannel ────────────────── */

class BrowserAdapter implements CoachingStorageAdapter {
  private channel: BroadcastChannel | null =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

  load(): CoachingDatabase | null {
    try {
      const raw = window.localStorage.getItem(COACHING_STORAGE_KEY);
      if (!raw) return null;
      const envelope = JSON.parse(raw) as CoachingEnvelope;
      if (!envelope || typeof envelope.version !== "number") return null;
      return migrateCoachingEnvelope(envelope);
    } catch {
      return null;
    }
  }

  save(db: CoachingDatabase): void {
    try {
      const envelope: CoachingEnvelope = { version: SCHEMA_VERSION, data: db };
      window.localStorage.setItem(COACHING_STORAGE_KEY, JSON.stringify(envelope));
      this.channel?.postMessage({ type: "coaching-db-changed" });
    } catch {
      // Quota/serialization failures must never crash the app.
    }
  }

  onExternalChange(cb: () => void): () => void {
    const onMessage = () => cb();
    const onStorage = (e: StorageEvent) => {
      if (e.key === COACHING_STORAGE_KEY) cb();
    };
    this.channel?.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    return () => {
      this.channel?.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
    };
  }
}

/* ─── Memory adapter (SSR + tests) ────────────────────────────────────── */

export class MemoryAdapter implements CoachingStorageAdapter {
  private db: CoachingDatabase | null = null;
  load(): CoachingDatabase | null {
    return this.db ? (JSON.parse(JSON.stringify(this.db)) as CoachingDatabase) : null;
  }
  save(db: CoachingDatabase): void {
    this.db = JSON.parse(JSON.stringify(db)) as CoachingDatabase;
  }
  onExternalChange(): () => void {
    return () => {};
  }
}

/* ─── Document store ──────────────────────────────────────────────────── */

export class CoachingStore {
  private adapter: CoachingStorageAdapter;
  private cache: CoachingDatabase;
  private listeners = new Set<() => void>();
  private detachExternal: () => void;

  constructor(adapter?: CoachingStorageAdapter) {
    this.adapter =
      adapter ?? (typeof window === "undefined" ? new MemoryAdapter() : new BrowserAdapter());
    this.cache = this.adapter.load() ?? emptyCoachingDatabase();
    this.detachExternal = this.adapter.onExternalChange(() => {
      this.cache = this.adapter.load() ?? emptyCoachingDatabase();
      this.emit();
    });
  }

  read(): CoachingDatabase {
    return this.cache;
  }

  /** All mutations flow through here so every change persists + notifies. */
  write(mutate: (db: CoachingDatabase) => void): CoachingDatabase {
    const next = JSON.parse(JSON.stringify(this.cache)) as CoachingDatabase;
    mutate(next);
    this.cache = next;
    this.adapter.save(next);
    this.emit();
    return next;
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  destroy(): void {
    this.detachExternal();
    this.listeners.clear();
  }

  private emit(): void {
    this.listeners.forEach((cb) => cb());
  }
}

/* Singleton for the app; tests construct their own with MemoryAdapter. */
let appStore: CoachingStore | null = null;

export function getCoachingStore(): CoachingStore {
  if (!appStore) appStore = new CoachingStore();
  return appStore;
}

/** Drop both the cached document and its browser copy at an account boundary. */
export function resetCoachingStorage(): void {
  appStore?.destroy();
  appStore = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(COACHING_STORAGE_KEY);
  } catch {
    // Browser privacy restrictions are handled by the outer auth boundary.
  }
}
