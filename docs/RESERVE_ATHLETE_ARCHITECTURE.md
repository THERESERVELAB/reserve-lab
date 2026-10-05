# RESERVE ATHLETE™ — Architecture Design (v0.1, design-only)

**Status:** Design proposal. No code written yet. This document is the blueprint to review
*before* implementation, per the mandate: *"first design the architecture, data model,
progression system, recovery engine, environment detection, onboarding flow, and integration
strategy so it scales cleanly across the Reserve Lab ecosystem without disrupting the current
bodybuilding-first experience."*

**Outranked by:** `CLAUDE.md` and `AGENTS.md` (compliance) and `DESIGN_BIBLE.md` (UI/voice).
Nothing here generates cycles, doses, protocols, or medical advice. Athletic + recovery
surfaces are observational tracking, health awareness, and trend observation only.

---

## 1. What Reserve Athlete is (and is not)

Reserve Athlete is a **new flagship program category** that lives *alongside* the existing
physique protocols — it does **not** modify or replace them. It is the "luxury athlete
operating system": members who look like competitive bodybuilders, move like athletes,
recover like professionals, and stay lean and healthy for decades.

- **It is:** bodybuilder-first hybrid training where athletic capacity, conditioning, and
  recovery are *layered around* a protected bodybuilding core.
- **It is not:** CrossFit, Hyrox, or marathon training. Running/conditioning are *expressions*
  of athletic capacity, never the goal. Endurance volume never compromises muscle.

### The Hierarchy (the spine of every decision)

| Priority | Pillar | Role |
|---|---|---|
| 1 | **Elite Physique** | Mass, density, shoulder width, upper chest, back thickness, legs, low body fat, abs, vascularity, symmetry. Never sacrificed. |
| 2 | **Strength** | Heavy compounds + progressive overload feed the physique. |
| 3 | **Athletic Capacity** | Speed, power, conditioning, work capacity — *enhances* the look. |
| 4 | **Recovery** | A scheduled training component, load-adaptive. |
| 5 | **Longevity** | Health, durability, decades of capability. |

This hierarchy is encoded as a **typed guardrail** (§4) that the week-resolver and progression
engine must respect. Physique and Strength win every conflict.

### Future archetypes (all inherit "bodybuilder first")

`Reserve Athlete Hybrid` · `Reserve Athlete Run Club` · `Reserve Athlete Tactical` ·
`Reserve Athlete Performance` · `Reserve Athlete Endurance`. Hybrid ships first; the rest are
authored data, not new engines.

---

## 2. Design principle: extend, don't fork

Per `AGENTS.md` ("Use existing systems before creating new ones") and the Design Bible
("New work extends those artifacts; it does not invent parallel ones"), Reserve Athlete plugs
into the **five seams that already exist** rather than building a parallel stack:

| Need | Existing seam (reuse) | What Reserve Athlete adds |
|---|---|---|
| Program catalog / selection | `src/lib/protocol/library.ts` (`ProtocolDefinition`, `ProtocolCategory`) | One new category + N archetype definitions |
| Weekly structure | `src/lib/training/split-blueprints.ts` (`SplitBlueprint`, resolver) | New blueprints + a few athletic archetypes |
| Per-day support stack | `src/lib/training/weekly-split.ts` (`DayProtocol`) | Load-adaptive recovery prescription |
| Progression | `src/lib/training/progression-engine.ts` (`MesoPhase`, mesocycle) | A *separate* athletic-capacity track that reuses the phase clock |
| Environment | `src/lib/training/gym-environment.ts` (`EquipmentCategory`) | A new **Facility/Amenity** layer (non-lifting) |
| Selection state | `src/lib/athlete-store.ts` (`protocolId`, `activityStack`, `recoveryPreferences`) | New profile fields; no schema break |

**Hard rule for implementation:** the existing physique protocols, blueprints, and progression
behavior must be byte-for-byte unchanged for any member not on a Reserve Athlete protocol.
TypeScript exhaustiveness (e.g. `CATEGORY_LABEL: Record<ProtocolCategory, string>`) will force
every switch to acknowledge the new category at compile time — that is the safety net, not a
runtime flag.

---

## 3. Data model

### 3.1 New program category

In `src/lib/protocol/library.ts`:

```ts
// add to ProtocolCategory union:
| "reserve-athlete"

// CATEGORY_LABEL (Record is exhaustive — compiler enforces this):
"reserve-athlete": "Reserve Athlete",
```

Then add Reserve Athlete archetypes as `ProtocolDefinition` entries. The existing
`ProtocolDefinition` shape already carries everything an archetype needs
(`trainingDays`, `cardioDays`, `mobilityDays`, `trainingEmphasis`, `recoveryEmphasis`,
`gymFit`, `difficulty`, `commitment`, `primaryGoal`, `appChanges`, `safetyNote`). **No new
fields are required on `ProtocolDefinition`** for v1 — Reserve Athlete is expressible in the
current type. An optional discriminator can be added later if archetypes need bespoke UI:

```ts
// OPTIONAL, additive, non-breaking:
athleteTrack?: "hybrid" | "run-club" | "tactical" | "performance" | "endurance";
```

Seed archetype (Hybrid):

```ts
{
  id: "reserve-athlete-hybrid", name: "Reserve Athlete Hybrid", category: "reserve-athlete",
  athleteTrack: "hybrid",
  tagline: "Bodybuilder first. Athlete second.",
  description: "A protected bodybuilding core with athletic capacity, conditioning, and scheduled recovery layered around it — without spending the muscle.",
  idealUser: "Looks like he could step on stage, then run a fast 5K and dominate a pickup game.",
  durationOptions: [12, 16, 24], trainingEmphasis: "Hypertrophy + strength core, athletic capacity layered",
  nutritionEmphasis: "Year-round lean, nutrient partitioning, fuel matched to session type",
  recoveryEmphasis: "Load-adaptive recovery as a scheduled session",
  scheduleDemand: "5–6 days/week", trainingDays: 4, cardioDays: 2, mobilityDays: 2, checkInCadence: "Weekly",
  gymFit: "premium", difficulty: "advanced", commitment: "high",
  primaryGoal: "Elite physique that performs",
  secondaryGoals: ["Athletic capacity", "Conditioning", "Recovery discipline", "Longevity"],
  appChanges: [
    "Training runs a protected bodybuilding core with athletic + recovery days layered",
    "Recovery becomes a scheduled, load-adaptive session",
    "Environment intelligence uses available athletic + recovery facilities",
  ],
  safetyNote: "Performance and recovery tracking only. Observational — not medical advice.",
}
```

### 3.2 The hierarchy as a typed constant

New module `src/lib/training/reserve-athlete.ts` (the only genuinely new file for v1 logic):

```ts
export const RESERVE_ATHLETE_PILLARS = ["physique", "strength", "athletic", "recovery", "longevity"] as const;
export type ReserveAthletePillar = (typeof RESERVE_ATHLETE_PILLARS)[number];

/** Weekly invariants the resolver must never violate (the "physique floor"). */
export type PhysiqueFloor = {
  minHypertrophyDays: number;   // e.g. 4 — lifting days that may never be displaced
  minLowerSessions: number;     // protect leg development
  protectPriorityLifts: true;   // priority:1 BlueprintDays are immovable
};
```

### 3.3 Session intent extensions (athletic)

`split-blueprints.ts` already defines the athletic vocabulary we need:
`full-body-athletic`, `sprint-power`, `explosive`, `conditioning`, `sport-conditioning`,
`zone2` archetypes and `power` / `sport` / `conditioning` intents. v1 adds a **small** set of
named conditioning archetypes so the engine can pick a purposeful modality instead of generic
"cardio":

```ts
// additive to SessionArchetype:
| "tempo-run" | "interval-run" | "hill-sprints" | "acceleration"
| "sled-carry" | "plyometric" | "erg-conditioning"
```

Every cardio assignment must carry a **programming purpose** (Zone 2, tempo, intervals, hill
sprints, acceleration, sled, carries, bike, row, ski erg) — never "random cardio."

---

## 4. Weekly structure & the physique-floor guarantee

Reserve Athlete archetypes are authored as `SplitBlueprint`s and registered in
`PROTOCOL_BLUEPRINTS`, with a `CATEGORY_DEFAULT["reserve-athlete"]` fallback — identical to how
every other protocol works today. The resolver (`resolveWeeklyBlueprint`) already:

- keeps the **N highest-priority training days** and converts the rest to recovery when
  availability shrinks (this *is* the physique-floor mechanism — give lifts `priority: 1`,
  athletic days `priority: 3–4`);
- injects activity layers into `activitySlots` so athletic work **adds**, not replaces;
- honors recovery preference (protective vs aggressive).

**Reserve Athlete Hybrid — ideal Mon…Sun blueprint** (lifts are `priority:1`, immovable;
athletic/recovery fill activity slots):

| Day | Title | archetype | intent | priority |
|---|---|---|---|---|
| Mon | Upper Builder (heavy press/pull, delts, arms) | `upper-strength` | strength | 1 |
| Tue | Lower Builder (squat/RDL/lunge, curls, calves) | `lower-strength` | strength | 1 |
| Wed | Recovery Athlete (Zone 2 + mobility, **no lift**) | `zone2` | recovery | 99 |
| Thu | Upper Hypertrophy (pump) + sprint quality finish | `upper-hypertrophy` | hypertrophy | 1 |
| Fri | Lower Hypertrophy (glute-ham) + sled finish | `posterior-chain` | hypertrophy | 1 |
| Sat | Reserve Athlete Day (plyo, carries, hill sprints, ropes, core) | `full-body-athletic` | sport | 3 |
| Sun | Recovery (walk, mobility, sauna/steam) | `recovery` | recovery | 99 |

`idealTrainingDays: 4`, `activitySlots: [2, 5]` (Wed + Sat). When a member can only train 3
days, the resolver drops Saturday's athletic day first (priority 3) — **never** a lifting day.
That is the hierarchy enforced in code: athletic capacity yields to physique.

The 70/15/10/5 emphasis (bodybuilding / athletic / conditioning / recovery) is the *authoring
target* for each blueprint's weekly minutes, surfaced as a read-only "weekly ratio" badge — not
a runtime constraint.

---

## 5. Progression system (two parallel tracks)

The bodybuilding progression engine (`progression-engine.ts`) is **untouched**. Reserve Athlete
adds a *second*, independent track that **reuses the same mesocycle clock** (`getPhaseForWeek`,
`MesoPhase`) so physique and athletic blocks stay phase-aligned.

```ts
// src/lib/training/athletic-progression.ts (new)
export type AthleticQuality = "aerobic-base" | "tempo" | "threshold" | "speed" | "power" | "work-capacity";

export type AthleticExposure = {
  quality: AthleticQuality;
  // logged, member-entered — never prescribed as a dose
  lastValue: number;          // e.g. Zone-2 minutes, sprint time, jump output
  unit: "min" | "sec" | "m" | "reps" | "watts";
  recentValues: number[];
};

export type AthleticAssessment = {
  status: "baseline" | "progressing" | "hold" | "back-off";
  target: string;             // coach-style line, e.g. "Add 2 min at the same easy pace"
  yieldsToPhysique: boolean;  // true during specialization/peak — athletic load trims first
};
```

Rules:

- During **specialization / peak / deload** physique phases, athletic load *trims first*
  (`yieldsToPhysique = true`). Physique progression never trims for athletic gains.
- Conditioning progression is capped so endurance volume can't erode leg growth or upper
  fullness (the "no excessive mileage" rule, expressed as a per-phase ceiling).
- All athletic values are **logged, not prescribed** — Reserve observes the trend and frames
  targets as quality cues, never doses.

---

## 6. Recovery engine (load-adaptive, scheduled)

Recovery becomes a *programmed session*, and the prescription is a **function of the prior
session's load type** — heavy-lower recovery ≠ sprint recovery ≠ upper recovery ≠ conditioning
recovery. This extends the existing `DayProtocol` (`weekly-split.ts`) and
`getSupportPhaseHints` (`progression-engine.ts`) rather than replacing them.

```ts
// src/lib/training/recovery-engine.ts (new)
export type RecoveryModality =
  | "sauna" | "steam" | "cold-plunge" | "compression-boots"
  | "mobility" | "stretch" | "breathwork" | "walk"
  | "sleep" | "hydration-electrolytes";

export type SessionLoadType = "heavy-lower" | "heavy-upper" | "hypertrophy" | "sprint-power" | "conditioning" | "rest";

export type RecoveryPrescription = {
  loadType: SessionLoadType;
  modalities: RecoveryModality[];   // gated by available amenities (§7)
  emphasis: string;                  // e.g. "Posterior-chain decompression + parasympathetic downshift"
  note: string;                      // observational framing only
};
```

- Modalities are **only surfaced if the member's facility profile has them** (§7) — no fake
  buttons (UI Quality rule). A member without a cold plunge never sees a plunge prescription.
- Copy stays observational: "supports recovery," "trend observation," "review with clinician."
  No claims, no doses, no medical advice.
- Adapts to recovery reserve via the existing low-reserve logic in
  `schedule-recovery.ts` (`LOW_RECOVERY_THRESHOLD`) — when reserve is low, athletic/conditioning
  days down-shift before lifting days.

---

## 7. Environment detection (new Facility/Amenity layer)

`gym-environment.ts` models **lifting equipment**. Reserve Athlete needs **athletic + recovery
facilities**, which are a different concept — a running track is not "equipment." So we add a
parallel, additive layer (existing `EquipmentCategory` matrix untouched):

```ts
// additive to gym-environment.ts (or a new facilities.ts)
export type FacilityAmenity =
  // athletic surfaces
  | "running-track" | "indoor-track" | "turf" | "pool" | "olympic-platform"
  | "sled-track" | "row-erg" | "ski-erg" | "assault-bike"
  // courts / sport
  | "basketball-court" | "tennis-court" | "pickleball-court"
  // recovery suite
  | "sauna" | "steam-room" | "cold-plunge" | "hot-tub" | "compression-boots"
  | "stretch-studio" | "group-fitness" | "yoga-studio" | "pilates-studio";

export type GymEnvironment = /* existing */ | "luxury-athletic-club"; // new premium preset

// presets map each environment → its likely amenities, member-refinable:
export const ENV_AMENITIES: Record<GymEnvironment, FacilityAmenity[]> = { /* ... */ };
```

The engine consumes amenities to choose **purposeful** modalities:

| Amenity | Unlocks |
|---|---|
| running-track / indoor-track | tempo runs, intervals, acceleration, sprint quality |
| turf / sled-track | sled pushes, carries, prowler conditioning |
| pool | low-impact Zone 2 / recovery conditioning |
| row-erg / ski-erg / assault-bike | low-joint-impact engine work |
| courts | sport-conditioning (`sport-conditioning` archetype) |
| sauna / steam / plunge / hot-tub / boots | recovery modalities (§6) |
| yoga / pilates / stretch studio | mobility + recovery days |

`UserTrainingProfile` (in `gym-environment.ts`) gains an additive `amenities: FacilityAmenity[]`
field, defaulted from the environment preset and refinable in onboarding. The
`computeProfileCompleteness` check can add an optional "Facility access" item for Reserve
Athlete members.

---

## 8. Onboarding flow

Reuses the existing protocol-selection plumbing (`setActiveProtocol`, `activityStack`,
`recoveryPreferences`) — Reserve Athlete is a category in the same Protocol Command surface, not
a separate wizard.

1. **Protocol Command** (`ProtocolCommandView.tsx`) gains a **Reserve Athlete** category filter
   and a category hero (its own identity, premium framing).
2. **Pick archetype** — Hybrid (others "Coming Soon," honestly disabled per UI Quality rules).
3. **Facility confirmation step** (new) — member confirms athletic + recovery amenities (§7),
   defaulted from their gym environment. This is the only genuinely new onboarding screen.
4. **Schedule + emphasis** — training days/week (drives resolver compression), athletic emphasis
   (which `activitySlots` to fill), recovery preference (protective/aggressive — already wired).
5. **Activate** → `setActiveProtocol({ protocolId: "reserve-athlete-hybrid", category: "reserve-athlete", activityStack, ... })`.
   The blueprint resolver produces the week; nothing downstream needs to know it's "new."

No new store actions are required beyond persisting `amenities` and (optional) `athleteTrack`.

---

## 9. Integration strategy & non-disruption

- **Additive types only.** New category, new archetypes, new blueprints, new amenity layer, two
  new engine modules. Existing unions gain members; existing records stay exhaustive (compiler
  enforces completeness across the ~8 `ProtocolCategory` consumers).
- **Zero change to physique behavior.** Members not on a Reserve Athlete protocol resolve the
  exact same blueprint, progression, and recovery they do today.
- **Compliance preserved.** All athletic/recovery copy is observational. No cycles, doses,
  protocols, stacks, or medical/lab/compound guidance. `safetyNote` on every archetype.
- **Validation gate.** `npm run lint` + `npm run build` must pass before any handoff (Standing
  Rules). The exhaustive `Record` types make most regressions compile-time failures.
- **Naming/branding.** Public tiers remain Reserve Signature / Reserve Black. No real
  athlete/coach/federation names. "Reserve Athlete" is a product/method name, not an endorsement.

### Suggested build order (each step ships green)

1. **Data + types** — add category, `CATEGORY_LABEL`, Hybrid `ProtocolDefinition`, hierarchy
   constant. (No UI yet; library is data.)
2. **Blueprint** — author `RESERVE_ATHLETE_HYBRID` blueprint + register; verify resolver output
   across 3–6 day availability (physique floor holds).
3. **Environment** — add `FacilityAmenity` layer + presets + profile field.
4. **Recovery engine** — load-adaptive `RecoveryPrescription`, amenity-gated.
5. **Athletic progression** — parallel track, phase-aligned, physique-yielding.
6. **Onboarding + UI** — category in Protocol Command, facility step, weekly-ratio badge, day
   cards rendering athletic/recovery sessions.
7. **Future archetypes** — Run Club / Tactical / Performance / Endurance as authored data.

---

## 10. Open questions for product (decide before step 2)

1. **Default training days for Hybrid** — 4 lifts + 2 athletic/recovery (the manifesto), or a
   5-lift variant for members who want more bodybuilding density?
2. **Wednesday no-lift day** — strict (recovery-athlete only) or an optional "express upper"
   fallback for members who hate a mid-week gap?
3. **Facility step placement** — inside Protocol Command activation, or folded into the existing
   Training profile setup (`gym-environment`) so it serves all protocols?
4. **Weekly-ratio badge** — show the 70/15/10/5 split as a member-facing metric, or keep it an
   internal authoring guide only?
5. **Naming** — "Reserve Athlete" as the category label, or "Reserve Athlete Method" to mirror
   "The Reserve Method"?

---

## 11. Decisions locked + implementation status (2026-06-29)

**Decisions:** (1) Hybrid default = 4 lifts + 2 athletic/recovery; no 5-lift density variant yet.
(2) Wednesday = strict no-lift Recovery-Athlete day; no fallback lift. (3) Facility/amenity step
lives inside Reserve Athlete onboarding for now (fold into shared Training profile later).
(4) 70/15/10/5 ratio is an internal authoring guide only — member copy stays premium, not
mathematical. (5) Framework = "Reserve Athlete Method"; category/identity = "Reserve Athlete".

**Shipped (lint + build green):**
- `protocol/library.ts` — `reserve-athlete` category + label, optional `athleteTrack` field,
  `reserve-athlete-hybrid` `ProtocolDefinition`.
- `protocol/architecture.ts` — `reserve-athlete → advanced_performance` family (keeps canonical
  bodybuilding copy + the blueprint's own split name).
- `ProtocolCommandView.tsx` — "Reserve Athlete" catalog filter (discoverable, not half-hidden).
- `training/split-blueprints.ts` — `RESERVE_ATHLETE_HYBRID` blueprint + registry. The 4 lifts are
  `priority:1`; Wed + Sat are `recovery:true` so the resolver always preserves them and never
  counts them as droppable lift slots (the physique floor, enforced).
- `training/reserve-athlete.ts` (new) — hierarchy/pillars, physique-floor constant, weekly-ratio
  authoring guide, `isReserveAthlete`, and the Wednesday Recovery-Athlete + Saturday Reserve
  Athlete Day session content.
- `training/facilities.ts` (new) — Facility/Amenity layer + per-environment presets (does NOT
  modify the shared `UserTrainingProfile`).
- `training/recovery-engine.ts` (new) — load-adaptive, amenity-gated `RecoveryPrescription`.

**Shipped — UX batch (lint + build green, browser-verified):**
- `athlete-store.ts` — additive `reserveAthleteFacilities` field + setter + persistence (mirrors
  `activityStack`; shared `UserTrainingProfile` untouched).
- `ProtocolCommandView.tsx` — premium **Reserve Athlete category hero** (identity + 5-pillar
  hierarchy) and the **facility/amenity onboarding step** in the activation drawer (grouped chips,
  defaulted from the member's gym environment, persisted on activate).
- `protocol/architecture.ts` — dedicated `reserve_athlete` family so the protocol carries its own
  "Reserve Athlete Hybrid Rotation" architecture + "Reserve Athlete Method" system label
  (specialized:false → lifting days keep canonical bodybuilding copy).
- `ReserveAthleteDayPanel.tsx` (new) + mounted in `TrainingView` — renders the hierarchy, both
  signature day cards (Wed Recovery-Athlete + Sat Reserve Athlete Day, today highlighted), and the
  load-adaptive, amenity-gated recovery prescription. Returns `null` for non–Reserve-Athlete
  protocols (fully additive).

**Verified in-browser:** category hero, facility step (presets matched the member's
`commercial-performance` environment), activation, and the Training-view panel (Monday correctly
showed a "Heavy Upper" recovery prescription with amenity-gated modalities). No console errors.

**Shipped — engine + progression batch (lint + build green, browser-verified):**
- `daily-context.ts` — `resolveDailyTrainingContext` now routes Reserve Athlete protocols through
  the blueprint **regardless of muscle priority / stale track** (weak points emphasize INSIDE the
  Reserve Athlete week via `musclePriority`, never replace it). Isolated behind an `isReserveAthlete`
  gate, so every other protocol's resolution path is byte-for-byte unchanged. This resolves the
  prior "main session engine shows legacy split" gap: the main Training hero, today's session, and
  the weekly strip now render the real Hybrid week (Upper Builder → Recovery Athlete → … → Reserve
  Athlete Day). Verified: a Transformation protocol still resolves its original week unchanged.
- `athletic-progression.ts` (new) — the parallel athletic-capacity track (aerobic-base / tempo /
  threshold / speed / power / work-capacity), member-logged (never prescribed), reusing the
  mesocycle phase clock; `yieldsToPhysique` during specialization/peak/deload. Surfaced as an
  "Athletic Capacity" board in `ReserveAthleteDayPanel` (honest baseline states until logging UI).

**Deferred (next batches):** folding the facility step into the shared Training profile; an
athletic-effort logging surface (so the capacity board shows real trends, not baseline); the
compact week-strip showing "Athlete" rather than "Rest" for Sat (cosmetic); future archetypes
(Run Club / Tactical / Performance / Endurance) as authored data.
```
