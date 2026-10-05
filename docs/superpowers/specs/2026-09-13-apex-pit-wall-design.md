# Apex Pit Wall — Design Spec

**Date:** 2026-09-13 · **Branch:** `claude/reserve-design-capability-stack` · **Status:** approved direction, spec pending owner review
**Direction board:** https://claude.ai/code/artifact/8cf4c666-3ed6-45af-b4ea-dce08c507545 (owner chose **A · Pit Wall**)

## 1. Problem

The home screen (`dashboard` view: `FinalBossDashboard` → `ApexCommandV2`) reads like a book. Measured in local
mode with a fresh member: phone 10,376 px (13.5 scroll-heights), 1,450 words, 18 equal-weight glass panels,
69 controls; desktop 5,661 px. Causes, verified in code:

1. Every section is appended to one flex column (`ApexCommandV2.tsx:1166`); nothing outranks anything.
2. State is written as ~12 sentence rows in the hero; phone hides the live chips (`TopBar.tsx:142`).
3. Three code paths answer "what now" and disagree. Next Move calls `getScheduleNextAction(ctx.schedule, now)`
   with no context (`lib/apex/engine.ts:577`), so it assumes training on recovery days. `todaySession` is built
   from `trainingWeek`, which never receives `splitCustomization`, so member day edits change the rail but
   not the primary action.

## 2. Goal and non-goals

**Goal.** Rebuild the home screen as the Pit Wall: one clock, today laid out on lanes under a live now-marker,
one Next Move, one risk line. The first screen answers condition, mission, next move and risk from position.

**Non-goals.** No new palette hues or typefaces. No change to Training, Nutrition, Recovery, Schedule or other
views beyond the shared shell. No engine logic changes except the wiring fixes in §4. No clinical
interpretation of any kind. No schema, Supabase or billing changes. No commits without owner instruction.

## 3. The composition

### Desktop ≥ 1280 px (first screen at 1440×900 and 1280×900)

```
┌ Status bus (TopBar on dashboard) ─────────────────────────────────────────────────────┐
│ RESERVE · APEX   Output capacity · Protein est · Hydration · Sleep          16:12 ● │
├───────────────┬───────────────────────────────────────────────────────────────────────┤
│ CONDITION     │ MISSION TIMELINE · TUESDAY — Legs + Abs · 5:30 PM     [Adjust today] │
│ whisper       │  12P    2P    4P │   6P    8P    10P                                  │
│ STATEMENT     │ TRAINING         │  ▪ ▬▬▬▬ ▪                                          │
│ command line  │ FUEL     ✓       ▣       ▬   ▬                                        │
│ ── 84 ──      │ RECOVERY         │          ▬  ▬                                      │
│ momentum      │ SLEEP            │                ▬ ┃ sleep lock                     │
│ sleep·7 nights│ (LOGBOOK — only when entries exist, log-only)                         │
│ split line    │                  NOW 4:12                                             │
├───────────────┼──────────────────────────────────┬────────────────────────────────────┤
│               │ NEXT MOVE · due now              │ WEEK 3 · rail (existing)           │
│               │ Pre-Workout Meal                 │ Watch list · evidence (1 line each)│
│               │ why now · RISK · Low             │                                    │
│               │ [ Log Pre-Workout Meal ]  Then … │                                    │
└───────────────┴──────────────────────────────────┴────────────────────────────────────┘
below the line: Watch List + Evidence Needed → Full briefing (disclosure) → Secondary Systems → footer
```

- Grid: condition column 320 px · timeline fills. Second row: Next Move ~58% · week + watch ~42%.
- Surfaces on the first screen: timeline and Next Move are GlassPanels; the condition column and week sit on the
  environment. Maximum three glass surfaces above the line.
- The only filled gold element on the screen is the Next Move action.

### Tablet 768–1279 px
Condition collapses to one row above the timeline (statement left, readiness jewel right). Timeline full width.
Next Move and week side by side.

### Phone < 768 px (first screen at 390×844 and 375×812)
Top bar (menu · RESERVE · APEX · sync) → instrument strip (readiness · protein · hydration · sleep) → statement +
command line → **now spine** (vertical: previous item, next four items, "+N more tonight · Sleep lock 10:30 PM")
→ week rail 3-day window (existing behaviour) → docked action bar (risk chip + the one gold action) at the true
bottom. Fold contract (Bible §11): statement, readiness, next move and risk visible without scrolling.

## 4. Architecture

Presentation changes; derivations are reused. Two layers: a **hook** that wires store state into existing
resolvers, and a **pure resolver** that makes the day's decisions and is unit-tested.

### 4.1 Truth layer (Stream 1)

- **`src/lib/apex/today-resolver.ts`** (new, pure). `resolveApexToday(input): ApexToday`.
  - Input: `now`, `schedule: MemberScheduleProfile`, `trainingContext` (from
    `resolveTrainingScheduleContext(trainingOverrides, localScheduleDateKey(now))`), `today` (the edit-aware day —
    see below), `meals: PlannedFuelMeal[]`, `loggedMealIds`, `mealOverrides`, `intakeSlots` (log-only),
    `sleepConflict`, `watchSignals: StrategistSignal[]` (`briefing.hurting`).
  - Output:
    - `trainingPlanned: boolean` = `trainingContext.trainingPlanned && !today.recovery`.
    - `lanes: ApexLane[]` — `{ id: "training" | "fuel" | "recovery" | "sleep" | "logbook"; label; items: ApexLaneItem[] }`.
    - `ApexLaneItem` — `{ id; label; sub?; startMin; endMin?; status: "due-now" | "due-next" | "upcoming" | "past-due" | "completed" | "skipped"; action: ApexAction | null; logOnly: boolean }`.
    - `ApexAction` — `{ kind: "log-meal" | "start-session" | "review-session" | "mark-logged" | "open-view"; label; mealId?; entryId?; view? }`.
    - `nextMove: { title; whyNow; itemId: string | null; action: ApexAction | null }`.
    - `risk: { level: "Low" | "Moderate" | "Elevated" | "Sleep compression"; detail }`.
    - `window: { startMin; endMin; nowMin }` — timeline range: `max(wake, now − 4h)` to sleep target.
    - `earlier: { done; total }` — items before the window start.
    - `state: "ready" | "map-your-day"` — `map-your-day` when the schedule profile has no wake/sleep times.
- **Lane mapping** (no new data, one source per fact):
  - Training: `prep` schedule items (Mobility Primer, Pre-Session Command); the session (`today.sessionName`,
    `preferredTrainingStart`–`preferredTrainingEnd`) when `trainingPlanned`; after-session protocol `cardio`,
    `abs`, `posing` anchored at `preferredTrainingEnd` + existing offsets (5/20/65 min).
  - Fuel: `meals` from the fuel plan only (loggable ids). Schedule items of kind `meal` are not drawn — one meal
    source.
  - Recovery: schedule items of kind `recovery` except Evening Wind-Down; protocol `sauna` (+35) and `mobility`
    (+50).
  - Sleep: Evening Wind-Down and the `sleep` item, drawn as the sleep lock.
  - Logbook: intake slots, only when entries exist. Labelled "Logbook · user-entered · log-only". Its items carry
    `logOnly: true`, action `mark-logged`, and **never** become `nextMove` or `risk`.
  - `wake` is the timeline's left boundary label, not an item.
- **Next Move**: `getScheduleNextAction(schedule, now, { trainingPlanned, direction })`, linked to the lane item in
  the same window when one exists (e.g. pre-workout meal → `log-meal`). Logbook items are excluded.
- **Risk**: `Sleep compression` when `detectSleepConflict` (same context) reports a conflict; else `Elevated` if any
  `watchSignals` item has severity `high`; else `Moderate` if any is `moderate`; else `Low`. `detail` is the
  deciding signal's title. Same precedence as today, computed once.
- **Edit-aware today**: the day comes from the same week the rail renders (`apexWeek`, built from
  `dailyContext.weeklyPlan`, which receives `splitCustomization`). `readinessStatement`'s `recoveryDay`, the
  primary action and the lanes all read this one value.
- **Engine fix**: `buildApexView` gains an optional `trainingContext` and passes it to
  `getScheduleNextAction` (`lib/apex/engine.ts:577`). Default behaviour unchanged when omitted.
- **Shared protein summary**: extract `summarizeLoggedProtein(meals, loggedMealIds, overrides)` into
  `lib/nutrition/fuel-plan.ts`; `FuelCommandPanel` and the status bus both call it. Label "est · logged meals".
- **`src/lib/apex/statement.ts`** (new): `readinessStatement()` moved verbatim from `ApexCommandV2.tsx:126`.
  Thresholds and copy are Bible §05 canon — unchanged.
- **`src/components/apex/pit-wall/useApexToday.ts`** (new hook): all store selectors and the existing derivations
  from `ApexCommandV2.tsx:406–1060` (week, protocol, program, dailyContext, fuel plan, intake slots), then
  `resolveApexToday`. Components below take props only.

### 4.2 Shell (Stream 2)

- **Phone navigation**: below 768 px the Sidebar rail is not rendered. The TopBar menu opens the same `Sidebar`
  in an overlay. `ReserveBottomSheet` gains `side: "bottom" | "left"` so there is still one modal primitive
  (Escape, focus trap, focus restore, backdrop close, `role="dialog"`). The overlay closes on navigation.
- **Status bus**: on the `dashboard` view the TopBar's centre shows Output capacity (session state: Staged / Live /
  Closed) · Protein (`summarizeLoggedProtein`, est · logged meals) · Hydration (`hydrationTodayOz` /
  `hydrationTargetOz`, logged) · Sleep last night (`sleepLastNight`), each with a provenance tooltip. Readiness and
  Recovery Capacity are **not** in the bus: both are the same recovery reserve (`engine.ts:462–464`, number and
  label), so they have one home — the condition column's jewel (number + `reserveLabel`). Other views keep today's
  TopBar.
- **Ticker**: `BottomTicker` is hidden on the `dashboard` view and below 768 px everywhere. Its log-only lines
  are already carried by the home footer.
- **Action dock**: `AppShell` renders a dock element after `<main>`. `ReserveActionBar` portals into it below
  768 px, so the docked action sits at the true bottom above `.safe-bottom`, not above the ticker.

### 4.3 The instrument (Stream 3) — `src/components/apex/pit-wall/`

- `PitWallView.tsx` — composition root rendered by `FinalBossDashboard` in place of `ApexCommandV2`.
- `ConditionColumn.tsx` — whisper + greeting; the one `<h1>` statement (`.type-hero`) + command line
  (`.type-command`); readiness (recovery reserve number + `reserveLabel`) via `ReserveMetric` (`.type-jewel`) or "—" + "Evidence needed · log a recovery
  check-in"; momentum word (Improving / Stable / Slipping, hidden when `data-limited`); **sleep · 7 nights**
  micro-series from logged `sleepLogs` hours with the target line (fewer than 3 logs → "Evidence needed");
  projected session quality (training days only, labelled "derived"); split line ("Week n of m · phase").
  No readiness sparkline — no readiness history exists.
- `DayTimeline.tsx` — desktop lanes on a shared time scale; past items at 42% opacity; due-now item ringed gold;
  now-marker updated by the minute clock (no animation loop); "Earlier · n of m done" stub; `map-your-day` state
  with one action to `schedule-command`. When today was rescheduled or reset (the Schedule Flex notice, today at
  `ApexCommandV2.tsx:1562`), the header shows that status word and links to Training's Schedule Flex panel. Header
  action "Adjust today" opens a sheet with Update Profile (→ settings) and Adjust Schedule (→ schedule-command).
- `NowSpine.tsx` — the phone form of the same lanes, merged and sorted by time.
- `LaneItemSheet.tsx` — `ReserveBottomSheet` with the item's time, lane, status word and its one action.
- `NextMovePanel.tsx` — whisper (lane · status), title, why now, `RISK · level · detail`, the gold action, and
  "Then · next item". When `resolveSystemState()` returns a blocking state, it **replaces** the Next Move content
  and action instead of stacking above the page.
- `WeekStrip.tsx` — mounts the existing `ReserveWeekRail` unchanged.
- **Actions**: `log-meal` → `toggleLoggedMeal(id)` exactly as today, but a logged item shows the status word
  "Logged" with an explicit "Undo log" action — never a toggle labelled "Logged";
  `start-session` → `requestTrainingLaunch()` + training; `review-session` → training; `mark-logged` →
  `logEnhancementAdherence` (existing call shape); `open-view` → `setActiveView`.

### 4.4 Below the line (Stream 4)

- **Watch List + Evidence Needed**: one panel. Fix the per-signal link (`sourceToView` compares lowercase keys to
  capitalized sources, `ApexCommandV2.tsx:2233`).
- **Full briefing** (`ReserveDisclosure`, closed by default), each block extracted into
  `src/components/apex/briefing/` with markup and strings unchanged: Smart Brief, Physique Priority, Weekly
  Challenge, Biomarker Command, Auto AI Review, Enhanced Member Command, Nutrition Alignment.
- **Secondary Systems** and **Consistency & Milestones**: kept as today.
- **Removed from home** (their facts now live in the status bus, condition column or lanes): Performance Core orb,
  hero metric tiles, Split Command panel, Daily Command Board panel, Evening Closeout, Mission Timeline card,
  Fuel Command strip, System Status bento, Member Update Center.
- **Honest controls**: remove the static "Schedule synced" chip and the duplicate "Rebuild Today Around Me";
  "Configure Enhanced Tracking" checks tier access before setting `enhancedLogOnly`; "Daily Check-in" opens the
  recovery check-in instead of only bumping the streak. Each is reproduced before it is changed.
- `ApexCommandV2.tsx` is deleted once no importer remains.

## 5. Compliance carry-over (verbatim)

Strings move with their blocks, unedited: the home footer ("THE RESERVE METHOD records observations and trends
only…"); "Log Only" chips; compound lane copy ("User-entered · log-only", "Selected amount · …", "Log-only ·
user-entered schedule. Reserve does not recommend compounds, supplements, vitamins, amounts, or sites.");
Biomarker Command chips, next-review labels, empty state and footer ("Log-only · member-entered values · no
reference ranges, diagnoses, or interpretation. Review every panel with a medical professional."); Enhanced
Member Command lines, urgent-symptoms line and footer; System Status bloodwork and compound notes (shown in Full
briefing). The logbook lane never drives the primary action, risk, or any colour-graded status.

## 6. Bible amendment (versioned edit to `DESIGN_BIBLE.md`, V1 → V1.1)

- **§13 Above the fold** becomes spatial: (1) status bus; (2) condition column — whisper + greeting, statement +
  command line, readiness jewel, split line; (3) mission timeline, the dominant region, with now-marker;
  (4) Next Move with risk. The Performance Core retires from Apex. Below the fold: week rail → Watch List +
  Evidence → Full briefing → Secondary Systems → footer.
- **§11**: "Layers 1–4 are simultaneously visible on the first screen at 1440×900 and 390×844. Side by side is
  allowed; reading order left-to-right, top-to-bottom follows layer order."
- **§08**: now-marker moves with the minute clock only; no continuous animation.

## 7. States

| State | Behaviour |
|---|---|
| Loading (clock not mounted) | Lanes, week and panels render at full size; lane items, the now-marker and Next Move text appear when the clock mounts. Heights are reserved, so nothing shifts |
| Fresh member, no logs | Readiness "—" + evidence line; sleep series "Evidence needed"; lanes still render from the schedule profile |
| No schedule profile | Timeline `map-your-day` state; Next Move "Map your day" → `schedule-command` |
| Program unconfirmed / setup | Blocking system state replaces Next Move content and action |
| Recovery day (incl. member edit) | No session block; statement "PROTECT RECOVERY"; Next Move never "Start Training" |
| Training moved by override | `trainingPlanned` false everywhere on the page |
| Live session | Next Move "Resume Live Session" → training |
| After sleep target | Next Move "Protect Sleep"; timeline shows the closed day |
| Logbook entries exist | Logbook lane appears; never the Next Move |

## 8. Accessibility and motion

One `<h1>`. Lanes are `role="group"` with labels; items are real `<button>`s with ≥ 44 px hit areas and text
status words (never colour alone). The now-marker is `aria-hidden`; a visually hidden "Now 4:12 PM" carries it.
Visible focus on all controls. Due-now uses `fba-glow-pulse`; entry uses `fba-stagger`; all under the global
reduced-motion kill. Form inputs in sheets ≥ 16 px.

## 9. Testing

- **Vitest** `src/lib/apex/__tests__/today-resolver.test.ts`: split-edit recovery day never yields "Start Training";
  override-moved training sets `trainingPlanned` false; fuel lane uses one meal source; logbook never supplies
  `nextMove`/`risk`; missing wake/sleep → `map-your-day`; window clamps to `max(wake, now − 4h)`.
- **Vitest** `lib/apex` engine: `buildApexView` with `trainingContext.trainingPlanned = false` never returns
  "Start Training". `summarizeLoggedProtein` equals `FuelCommandPanel`'s current result.
- **Playwright** `tests/e2e/visual-system-qa.spec.ts` (dashboard): one `<h1>`; no horizontal overflow at the six
  viewports; at 390×844 and 375×812 the statement, readiness, Next Move title and risk are inside the viewport
  without scrolling; exactly one filled gold action; week rail never scrolls internally; no hydration errors.
- `npm run lint`, `npm run build`, `npm test` clean before handoff.

## 10. Build order (four parallel streams)

1. Contract first: `ApexToday` types committed to the working tree before streams start.
2. Streams run in parallel against the contract — S1 truth layer (+ tests), S2 shell, S3 instrument (fixture
   `ApexToday` until S1 lands), S4 below the line + Bible amendment.
3. Integration: `FinalBossDashboard` switches to `PitWallView`; delete `ApexCommandV2`; e2e + visual captures at
   1440×1000 and 390×844 compared against the direction board.

## 11. Decisions made during planning (supersede earlier sections where they differ)

- **Next Move comes from the lanes, not a label match.** `getScheduleNextAction` returns free-text labels
  ("Prepare Pre-Workout Meal", "Begin Pre-Session Command") that cannot be joined reliably to lane items; joining
  them would recreate the three-answers bug. The resolver picks the due-now item (session > meal > navigation,
  then earliest), else the due-next item, with explicit before-wake / after-sleep rules. The engine still gets its
  training context (§4.1) because other consumers read it.
- **No `map-your-day` page state.** A default schedule profile always exists, so there is no honest "unmapped" signal
  at page level. Each lane carries its own empty state instead (e.g. fuel: "No meal windows mapped").
- **Risk keeps today's semantics:** any remaining watch signal (not only `moderate`) reads Moderate.
- **Status bus protein** uses the fuel plan's logged meals. Meal swaps in `FuelCommandPanel` are session-local
  state, so home cannot see them; the shared `summarizeLoggedProtein` accepts overrides for Nutrition's use.
- **Ticker:** hidden on the dashboard and on phones; kept on other desktop views.
- **Contracts landed:** `src/lib/apex/today-types.ts`, `ReserveShellPortal`, `useMediaQuery`. Plan:
  `docs/superpowers/plans/2026-09-13-apex-pit-wall.md`.

### Written back after build review (2026-09-14)

- **The second row is stacked, not side by side.** Next Move spans the timeline's width and the week rail sits
  below it: the rail's seven columns need the full width (at ~93px they broke day names mid-word), and the
  rail uses its three-day window below `lg`.
- **The `lg` seam.** At `lg`+ the status bus lives in the top bar (output, protein, sleep; hydration only
  ≥1360px, so a readout is dropped rather than truncated). Below `lg` the in-page instrument strip carries
  output, protein, hydration and sleep — plus readiness on phones, where the condition column's jewel is hidden.
- **Phone order.** The Next Move precedes the Now Spine; recorded as the one sanctioned reordering in Bible §13.
- **Logbook below the line.** Bible §13 keeps anything log-only off the first screen, so member-entered
  logbook entries render in `LogbookPanel` under the Pit Wall instead of as a timeline lane.
- **Resilience.** `ApexErrorBoundary` wraps the Pit Wall, so a derivation failure never blanks the shell.
- **Sheets are portaled** to `document.body`; ancestors with filters or backdrop-filters no longer trap them.

## 12. Follow-ups (out of scope)

- Meal logs from home use `toggleLoggedMeal`, which skips the `confirmMealLog` event record
  (`athlete-store.ts:1767`) that Nutrition's two-phase `MealConfirmationDrawer` writes. Unifying them needs the
  home fuel plan (`PlannedFuelMeal`) and Nutrition's `Meal` / `MealPlan` models reconciled.
- "Open Hydration Bar" (Weekly Challenge) lands at the top of Nutrition instead of the Hydration Bar panel.
- The direction board mockup showed "Recovery capacity 71" beside readiness 84. That was wrong: both are the same
  reserve. This spec supersedes the mockup on that point.
