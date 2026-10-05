# RESERVE ATHLETE INTELLIGENCE ENGINE — Architecture (v0.1)

**Status:** Architecture documented first (per ticket), then a verified foundation implemented.
**Outranked by:** `CLAUDE.md` / `AGENTS.md` (compliance), `DESIGN_BIBLE.md` (UI/voice).

The mission: Reserve Athlete stops *generating workouts* and starts *thinking like an elite
performance coach every day*. Every recommendation answers one question:

> **What is the highest-return action today to build the best physique while maximizing
> athletic performance and recovery — without ever spending the physique?**

---

## 1. Design law: extend the existing intelligence stack, never duplicate it

Reserve Lab already has a strong intelligence layer. The engine **consumes** it:

| Existing system | What it already gives us | We reuse it for |
|---|---|---|
| `recovery/engine.ts` → `buildRecoverySnapshot` | Recovery Reserve (0–100), class, sleep/hydration/stress, momentum, debt, next action | The recovery + sleep + stress readiness signals |
| `ai-strategist/engine.ts` → `buildStrategistBriefing` | Mission status, limiter, next move | Cross-system limiter framing |
| `apex/engine.ts` → `buildApexView` | Momentum board, scores, weekly snapshot | The weekly report substrate + Command Center feed |
| `physique/engine.ts` → `buildPhysiqueGuidance` | Physique check-in guidance | Physique-protection trend inputs |
| `training/reserve-athlete.ts` + blueprint resolver | The Reserve Athlete week + signature days | The plan the decision engine adapts |
| `training/recovery-engine.ts` | Load-adaptive recovery prescription | Extended with accumulated-fatigue depth |

**No engine recomputes Recovery Reserve, sleep, or mission** — it imports them. New code is purely
the *athlete decision layer* on top.

---

## 2. Graceful-scaling data model (the core abstraction)

"Not all data needs to exist today." Every signal is **optional**; the engine scores over what's
present and reports its own confidence by coverage. New inputs (wearables) drop in by adding a key
+ weight — no rewrite.

```ts
// readiness-engine.ts
export type ReadinessSignalKey =
  | "sleepDuration" | "sleepQuality" | "recoveryReserve" | "recoveryCompletion"
  | "trainingLoad" | "runningLoad" | "lowerFatigue" | "upperFatigue" | "soreness"
  | "restingHR" | "hrv" | "calories" | "protein" | "hydration" | "steps"
  | "stress" | "mood" | "bodyweightTrend";

/** Each provided signal is a 0..100 readiness contribution (higher = more ready) + weight. */
export type ReadinessSignal = { key: ReadinessSignalKey; label: string; score: number; weight: number; note?: string };

export type ReadinessResult = {
  score: number;                 // 0..100 weighted over PRESENT signals
  band: "primed" | "ready" | "moderate" | "compromised" | "depleted";
  coverage: number;              // 0..1 fraction of canonical signals present
  confidence: "high" | "moderate" | "limited";
  drivers: { positive: ReadinessSignal[]; negative: ReadinessSignal[] };
  missing: ReadinessSignalKey[]; // what would sharpen the score (wearable upsell honesty)
};
```

A canonical `READINESS_SIGNALS` registry (key → default weight + label) defines coverage. The
caller maps store/snapshot data → whichever signals it can fill; missing keys simply don't count
and `confidence` degrades honestly. The current wiring fills `recoveryReserve`, `sleepQuality`,
`trainingLoad` (from the resolved week's load type), and fatigue when available — wearable signals
(`restingHR`, `hrv`, `steps`) are pre-declared and light up when a wearable lands.

---

## 3. The seven systems

### 3.1 Daily Readiness Engine — `readiness-engine.ts`
`computeReadiness(signals)` → weighted composite, band, coverage-based confidence, and the top
positive/negative drivers (so the member sees *why*). Bands: primed ≥85, ready ≥70, moderate ≥55,
compromised ≥40, depleted <40.

### 3.2 Adaptive Decision Engine — `decision-engine.ts`
`adaptToday({ readiness, todayPlan, yesterdayLoad, lowerFatigue, upperFatigue, fueledForPerformance })`
→ an ordered list of `DayAdaptation { action, headline, reason, appliesTo, protectsPhysique }`.
The program stops being a calendar and asks "can today be improved?". Encoded rules:

| Condition | Adaptation |
|---|---|
| Heavy lower yesterday + sprint/conditioning today | Swap intervals → Zone 2 (protect legs) |
| Readiness compromised/depleted, lifting today | Reduce accessory volume; keep the lifts |
| Readiness primed, hypertrophy today | Authorize extra hypertrophy volume |
| Readiness primed, sprint day | Authorize the sprint session |
| Poor sleep (sleep-driven low readiness) | Keep lifting, cut conditioning |
| High fatigue | Increase recovery prescription |
| Low fuel + performance day | Fuel before performance work |

### 3.3 Recovery Intelligence — `recovery-engine.ts` (extended)
`buildRecoveryPrescription(loadType, amenities, { accumulatedFatigue })` gains body-region
`focusAreas` per load and scales modality depth by accumulated fatigue: heavy posterior → hips +
compression + sauna + walking + electrolytes; sprint → calves/feet/achilles + contrast + mobility;
heavy upper → thoracic + lats + shoulders + breathing. Every modality already carries a reason.

### 3.4 Athletic Balance Engine — `athletic-balance.ts`
`evaluateAthleticBalance(scores)` over seven pillars (muscularity, conditioning, explosiveness,
aerobic, recovery, mobility, movement-quality). Flags the laggard and recommends a *small*
adjustment so imbalances never accumulate — muscularity lagging always outranks a conditioning gap.

### 3.5 Physique Protection System — `physique-protection.ts` (the Reserve rule)
`evaluatePhysiqueProtection(trends)` → guardrails where **muscle always wins**:

| Signal | Guardrail |
|---|---|
| Running volume rising too far | Reduce mileage |
| Leg growth stalling | Reduce endurance volume |
| Recovery insufficient | Cap conditioning |
| Bodyweight dropping too fast | Reduce expenditure |
| Strength declining | Reduce conditioning *before* reducing lifting |

Returns `{ flags, verdict: protected | watch | intervene, rule: "Muscle always wins." }`. The
decision engine treats `intervene` flags as hard constraints — a primed-readiness "authorize
sprints" call is overridden if protection says cap conditioning.

### 3.6 Weekly Intelligence Report — `weekly-intelligence.ts` (builder; surface staged)
`buildWeeklyIntelligence(week)` → a coach-level report (not raw data): Recovery Score, Training
Quality, Physique/Athletic Progress, Body-Fat & Muscle-Retention trend, Strength/Running/Mobility
trend, Consistency, Recovery Compliance, Recommended Focus, Opportunities, Risks. Built by
aggregating the daily readiness/decision history + Apex weekly snapshot. Reads like a performance
director wrote it.

### 3.7 Reserve Athlete Command Center — dashboard architecture (design-only for now)
A future surface fed by everything above: Daily Readiness · Recovery Status · Physique Status ·
Athletic Capacity · Muscle Recovery Map · Training/Recovery/Nutrition Recommendation · Performance
Trend · Weekly Intelligence · Monthly Report. Each tile is a pure selector over an engine output;
no tile owns logic. Mounts as a new `DashboardView` ("reserve-athlete-command") gated to Reserve
Athlete protocols, additive to the sidebar.

---

## 4. The daily decision flow (how the engines compose)

```
RecoverySnapshot ─┐
resolved week ────┤→ ReadinessInputs → computeReadiness → ReadinessResult ┐
fatigue/nutrition ┘                                                        │
physique/strength/bodyweight trends → evaluatePhysiqueProtection ──────────┤→ adaptToday → DayAdaptation[]
pillar estimates → evaluateAthleticBalance → laggard nudge ────────────────┘   (protection = hard constraint)
                                                                                      │
                                                          buildRecoveryPrescription(loadType, amenities, fatigue)
```

Protection is evaluated **before** the decision so "muscle always wins" can veto an aggressive call.

---

## 5. Architecture requirements (from the ticket) → how they're met

- **No hardcoded values** → weights/thresholds are named constants in each engine's registry.
- **Modular / extensible** → one engine per file, pure functions, signal registries.
- **Wearable-ready** → readiness signal keys for `restingHR` / `hrv` / `steps` pre-declared; they
  light up when data arrives, no engine change.
- **Additive / no duplication** → consumes `recovery/engine`, `apex/engine`, `physique/engine`;
  surfaces only for Reserve Athlete protocols; existing protocols untouched.
- **Conventions** → pure data + deterministic helpers, observational copy only (no medical/dosing),
  `lint` + `build` + browser verification gate.

---

## 6. Build order

1. **Foundation (this batch):** `readiness-engine.ts`, `decision-engine.ts`, `physique-protection.ts`,
   `athletic-balance.ts`; extend `recovery-engine.ts`; surface a "Reserve Athlete Intelligence"
   section in `ReserveAthleteDayPanel` (readiness + today's adaptive call + protection + balance).
   Validate lint/build/browser.
2. **Weekly Intelligence Report** — `weekly-intelligence.ts` builder + a weekly report surface.
3. **Reserve Athlete Command Center** — the dedicated dashboard view fed by all engines.
4. **Signal expansion** — soreness/mood quick-logs, nutrition calories/protein wiring, wearable
   adapters (each is just new `ReadinessSignal`s).
```

---

## 7. Implementation log

**Foundation (Build order step 1) — implemented.**

- `src/lib/training/readiness-engine.ts` — `computeReadiness` + the `READINESS_SIGNALS` registry
  exactly as specified in § 2/3.1, plus `buildReadinessSignals()` which maps the Recovery Command
  snapshot + sleep target + yesterday's session load into present signals today. Wearable keys
  (`restingHR`, `hrv`, `steps`, `calories`, `protein`, `mood`) are registered but unfilled — they
  widen coverage automatically once a source exists.
- `src/lib/training/physique-protection.ts` — `evaluatePhysiqueProtection` implementing all five
  guardrails from § 3.5. Two (running-volume-rising, strength-declining) have no data source yet
  in the app and stay dormant by design rather than faking a trend; the other three (bodyweight
  drop, recovery-insufficient, leg-growth-stalling) are live, reading `physique/engine.ts` trends
  and the Recovery Reserve snapshot. Verdict `intervene` is a hard constraint on the decision layer.
- `src/lib/training/decision-engine.ts` — `adaptToday` implementing the § 3.2 rule table. Fixed
  during verification: the legs-carried-yesterday Zone-2 swap and the primed-readiness sprint
  authorization could previously fire together, which is a direct contradiction (swap the
  intervals but also authorize them) — the swap now gates the authorization.
- `src/lib/training/athletic-balance.ts` — `evaluateAthleticBalance` over the seven pillars from
  § 3.4, composed from `physique/engine.ts` momentum (muscularity), the existing
  `athletic-progression.ts` capacity board (conditioning/explosiveness/aerobic), and the Recovery
  Reserve snapshot (recovery/mobility). `movement-quality` has no signal source yet and reads
  "data-limited" honestly. Muscularity wins the laggard tie per the Reserve rule.
- `src/components/training/ReserveAthleteDayPanel.tsx` — new "Reserve Athlete Intelligence"
  section (readiness band + confidence, today's adaptive call(s), physique-protection verdict,
  athletic-balance recommendation), inserted above the signature-day content. Same additive guard
  as the rest of the panel — renders nothing outside a Reserve Athlete Method protocol.

Verified via `npx tsx` against five scenarios (strong-readiness hypertrophy day, legs-carried
Zone-2 swap, depleted + bodyweight-dropping intervene case, fully-empty graceful path, and the
athletic-balance board) before wiring into the panel. `tsc` / `lint` / `build` clean.

**Deferred (matches § 6 build order):** Weekly Intelligence Report, Reserve Athlete Command Center,
signal expansion (soreness/mood quick-logs, nutrition adherence wiring, wearable adapters).
