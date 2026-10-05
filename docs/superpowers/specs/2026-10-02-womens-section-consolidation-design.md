# Women's Section Consolidation — one Reserve, not two

Date: 2026-10-02
Status: approved design, not yet implemented
Owner direction captured 2026-10-01, decisions confirmed 2026-10-02

## 1. The problem

Owner direction, verbatim:

> "WE ALSO HAVE A WOMENS SECTION AND ITS REPEATING THE SAME STUFF WE HAVE ON THE
> FUNDAMENTALS OF THE RESERVE LIKE RESERVE FOUNDATION. — JUST REMOVE THOSE THINGS — AND
> MOVE THE WOMENS THINGS INTO THE RESERVE FOUNDATION. LIKE FERTILITY, PREGNANCY, PERIOD
> TRACKERS, ETC."

The clearest evidence: **a woman sees "Training Command" twice in her sidebar** — once
under Foundation, once under Reserve Women. Same for Nutrition Command, Recovery Command
and Physique Command. Four labels, duplicated verbatim.

### 1.1 What each duplicate room actually does

Audited in full. Every one of the four does the same thing: it re-lists data the member
already logged somewhere else, sorted by estimated cycle phase.

| Room | What it shows | Verdict |
|---|---|---|
| Women's Performance | A roll-up of the four below | Duplicate, nothing unique |
| Women's Training | "How training felt," grouped by estimated phase | Duplicate + a lens |
| Women's Nutrition | Meals already logged, grouped by estimated phase | Duplicate + a lens |
| Women's Recovery | Sleep, water and energy already logged, grouped by phase | Duplicate + a lens |
| Women's Physique | Check-ins and photos already logged, each row labelled with its estimated phase | Duplicate + a per-row annotation (see 3.2.1) |
| **Cycle Command** | Period starts, calendar estimates | Its own subject |
| **Fertility Command** | Lifestyle optimization | Its own subject |
| **Pregnancy Command** | Trimester nutrition, recovery, milestones | Its own subject |

**The design error, named:** estimated phase is a **lens, not a room**. Those four rooms
exist only to re-sort data that already has a home. That is one panel belonging inside
Training, Nutrition, Recovery and Physique — not four parallel commands plus a roll-up.

### 1.2 Why this is cheaper than it looks

The engines are already factored out of the rooms. Nothing in `lib/` moves.

| Layer | File | Moves? |
|---|---|---|
| Pure read functions (`trainingFeltRead`, `sleepRead`, `energyStressRead`, `mealDaysRead`) | `lib/women/summaries.ts` | No |
| Per-view requirements and resolutions | `lib/women/primary-actions.ts` | No |
| The lens component itself | `components/views/women/ui.tsx` → `PhaseRows` | No |
| Cycle estimation, grouping | `lib/women/cycle.ts` | No |
| The five room shells | `components/views/women/Womens*.tsx` | **Deleted** |

`PhaseRows` is already generic: it takes `groups` and a `read` function and renders rows.
It is portable as-is.

## 2. Decisions taken by the owner

| Decision | Choice |
|---|---|
| Where Cycle / Fertility / Pregnancy land | **Foundation** — the owner's literal words |
| The `reserve-women` nav group | **Removed entirely** — nothing is sectioned off by gender |
| How much of each deleted room folds in | **The lens only, in a collapsed section** |
| When the lens appears | Only on the women's path **and** with a period start logged |

## 3. Design

### 3.1 Delete five rooms

`WomensPerformanceCommandView`, `WomensTrainingCommandView`, `WomensNutritionCommandView`,
`WomensRecoveryCommandView`, `WomensPhysiqueCommandView`.

Per-view removal is a repeating pattern across these shared files:

`lib/modules/registry.ts` · `components/view-chunks.ts` · `components/nav/module-icons.ts` ·
`components/ui/AnimatedBackground.tsx` · `lib/cinematic/view-environment.ts` ·
`lib/ui/log-sound.ts` · `lib/saas-config.ts` · `lib/athlete-store.ts` (the `DashboardView`
union) · `lib/modules/__tests__/phone-tabs.test.ts`

Plus, per room: `lib/cinematic/__tests__/room-light.test.ts` (training only),
`components/views/SettingsView.tsx`, `components/settings/MenuLayoutPanel.tsx`.

### 3.2 Fold the lens in — one component, four call sites

A new `components/women/CyclePhasePanel.tsx`:

```tsx
<CyclePhasePanel
  label="How training felt"
  read={trainingFeltRead}
  entries={…}        // already-logged data, from the core command's own source
  need={2}
  noun="days"
/>
```

It renders a single `ReserveDisclosure` titled **"By cycle phase"** containing `PhaseRows`,
and returns `null` unless BOTH hold:

1. the member is on the women's path (`genderIdentity === "female" || womens.enabled`), and
2. a period start is entered (`evidence.cycle.entered`).

So a member who never logs a cycle sees no change anywhere in the app.

| Core command | View file | Source | Read function |
|---|---|---|---|
| Training | `TrainingView.tsx` | `womens.cycleLogs` with `trainingPerformance` | `trainingFeltRead` |
| Nutrition | `NutritionView.tsx` | meal-day entries | `mealDaysRead` |
| Recovery | `RecoveryView.tsx` | `recoveryCommand.sleepLogs` | `sleepRead` |
| Recovery | `RecoveryView.tsx` | `womens.cycleLogs` with `energy`/`stress` | `energyStressRead` |
| Physique | `PhysiqueView.tsx` | `physique` check-ins | **new** — see 3.2.1 |

Every source is grouped with the existing `groupByEstimatedPhase(entries, womens.cycle,
starts)` from `lib/women/cycle.ts`. Recovery carries two panels, exactly as the room it
replaces did.

`RecoveryView` is already a thin composition shell (69 lines) and takes a panel cleanly.
The others gain one line each. This matters: `TrainingView.tsx` is **6,143 lines**, and the
Reserve Design Constitution requires progressive disclosure for advanced data and forbids
giving every module equal weight. A cycle-phase read is secondary information in a command
whose job is today's session, so it ships collapsed.

**Dropped on purpose:** the hero statement (a roll-up of the same data), the requirements
block (a women's prompt does not belong inside a command she may be using for something
else — Cycle Command still carries it), and the raw answers list (the core command already
owns its own history).

#### 3.2.1 Physique is the one fold that changes form

Three of the four rooms use `PhaseRows` and fold across unchanged. **Women's Physique does
not use `PhaseRows` at all.** It renders each check-in and each photo as its own row with
the estimated phase printed beside it — a per-row annotation, not a grouping.

That pattern has no home in the core `PhysiqueView`, which renders counts, requirements and
a "what changed" panel; the per-row lists live in the separate **Measurements** and
**Progress Photos** modules.

Resolved: Physique gets a `CyclePhasePanel` grouping **check-in count by estimated phase**,
consistent with the other three. This is a deliberate change in form, not a like-for-like
move, and it is the only place in this change where that is true. The grouped read answers
the same question ("where did my check-ins fall?") in the shape the other three use.

Rejected alternative: pushing the per-row phase label into the Measurements and Progress
Photos views. It preserves the original form exactly, but widens the change to two more
modules for an annotation of low value, and leaves Physique Command itself with no phase
read at all.

### 3.3 Relocate three rooms to Foundation

`womens-cycle`, `womens-fertility`, `womens-pregnancy` change `group: "reserve-women"` to
`group: "foundation"`. The `reserve-women` entry is removed from `NAV_GROUPS`, along with
the `womensFlagship` flag on `NavGroupDef` if nothing else uses it.

Gating is **unchanged**: `requiresFlag: "womens"` still hides them from members not on the
path, and `optional: true` still applies to Fertility and Pregnancy. A male member's
sidebar must be byte-identical to today.

### 3.4 Repoint what pointed at the deleted rooms

- `lib/ai-strategist/engine.ts:209` — `target: "womens-performance"` with an "Open" action
  is a live link to a room that will not exist. It points at `womens-cycle` instead.
- `components/views/SettingsView.tsx:652-655` — a hardcoded quick-link list naming
  Performance, Cycle, Nutrition and Recovery Command. Three of the four are deleted; the
  list keeps Cycle and gains Fertility and Pregnancy.
- `lib/modules/registry.ts` `PROFILE_PATH_DESCRIPTIONS["womens-performance"]` reads
  "Surfaces the Women's Performance OS and Cycle Command". The OS is gone; the copy
  changes to describe cycle, fertility and pregnancy tracking.

## 4. The hazard — `womens-performance` means five different things

Only the first is deleted. **No find-and-replace on this string.** Every site is changed by
hand.

| # | Meaning | Where | Fate |
|---|---|---|---|
| 1 | **View id** | registry, view-chunks, module-icons, view-environment, log-sound, `DashboardView` union | **delete** |
| 2 | **Protocol category** | `category: "womens-performance"` on all nine women's protocols; `architecture-select`, `protocol-suitability`, `ProtocolChooserSheet` filters | **survive** |
| 3 | **ProfilePath** | `deriveProfilePath()` returns it for every female member; `useMemberNavGroups`, `MenuLayoutPanel`, `SettingsView` gate on it | **survive** |
| 4 | **Feature key** | `lib/saas-config.ts` tier gating for the view | **delete with the view** |
| 5 | **Legacy protocol id** | `lib/athlete-store.ts:6144` migration reading saved state | **survive** |

Meanings 2, 3 and 5 are read by shipped member state. Breaking any of them orphans live
accounts: #2 breaks protocol selection for every woman, #3 breaks nav gating, #5 breaks a
migration path for members with old saved protocols.

## 5. Out of scope

- Any change to `lib/women/` engines — they are already shared and stay as they are.
- Cycle Command, Fertility Command and Pregnancy Command content. They move groups; their
  internals are untouched.
- The `womens` store slice and its logging.
- The compliance surfaces (safety acknowledgement, `estimate-only` / `lifestyle-only`
  labels, escalation routing) — all carried over unchanged.
- The stale comments in `daily-context.ts` naming retired protocols. A concurrent session
  holds that file; it is a separate follow-up.

## 6. Compliance

Nothing in this change touches medical, dosage or supplement content. The safety scopes on
the relocated modules (`womens-cycle: estimate-only`, `womens-fertility: lifestyle-only`,
`womens-pregnancy: lifestyle-only`) move with them and still render in the Settings module
control center. Phase remains an **estimate** everywhere it appears, and the folded lens
keeps the existing language: it describes answers logged during the same estimated phase
and never says one thing caused another.

## 7. Verification

- A test asserting **no two nav modules share a label** — the defect that let "Training
  Command" appear twice. This is the regression guard for the whole change.
- A test that a **male member's module list is byte-identical** before and after.
- A test that `CyclePhasePanel` renders `null` without a logged period start, and for a
  member not on the women's path.
- A test that `womens-performance` still resolves as a **protocol category** (all nine
  protocols still selectable) and as a **ProfilePath** (nav gating still derives
  `womensEnabled`).
- `tests/e2e/womens-rooms.spec.ts` — its `SCREENS` table lists all eight rooms and is cut
  to three. `tests/e2e/living-details-2.spec.ts` carries `womens-bare` / `womens-seeded`
  seeds that must still boot.
- `lib/modules/__tests__/phone-tabs.test.ts` and
  `lib/cinematic/__tests__/room-light.test.ts` reference the deleted view ids.
- `npm run lint`, `npm run build`, the full unit suite, and the `wave-training` e2e spec
  (the four core commands gain a panel, and that spec enforces the nesting rule — a new
  panel inside a GlassPanel is exactly how the last regression happened; see
  `reserve_segmented_nests_in_panels`).

## 8. Build order

**Phase 1 — Fold the lens in.** Build `CyclePhasePanel` and wire it into the four core
commands, behind both gates. Ships green on its own and is independently useful: a woman
gets the phase read inside the command she is already using, before anything is removed.

**Phase 2 — Delete the five rooms and relocate the three.** Registry, view-chunks, icons,
environment, log-sound, saas-config, the `DashboardView` union, the Settings quick links,
the Strategist target, and the e2e tables. Safe only after Phase 1, because Phase 1 is what
preserves the capability the rooms were providing.

Splitting this way means the product is never worse than it is today at any commit.
