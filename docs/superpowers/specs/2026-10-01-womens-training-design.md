# Women's Training — Splits, Naming, Cardio Content and Double Day

Date: 2026-10-01
Status: approved design, not yet implemented
Owner direction captured in session 2026-10-01

## 1. The problem

The owner's opening report: "I ONLY SAW PROTOCOLS WITH 1 GLUTE DAY IN THERE — WE NEED TO
TREAT IT VERY SERIOUS WITH 2–3 LEG WORKOUTS A WEEK."

The north star identity, stated by the owner: **the splits a runway / swim-week model would
use to be the best version of themselves.** That is not a bodybuilder's week. It means
glutes trained repeatedly with *different qualities*, a back-and-shoulder line that makes
the waist read smaller, leg *length* rather than thickness, and conditioning that keeps her
lean without flattening the glutes. It specifically avoids heavy loaded oblique work that
thickens the waist and quad-dominant blocky work that shortens the leg line.

## 2. Findings (all verified in code)

### 2.1 The women's protocol blueprints are NOT the problem

`src/lib/training/split-blueprints.ts` already carries 2–4 lower days in every women's
rotation: The Crown 3, Glute Ascend 3, Sculpted Legs 4, Signature Shape 3, Hybrid Pilates 3,
Runway Shape 2 + legs-conditioning, Vacation 2 + legs-conditioning, Athletic Model and
Sport+Strength 2 + posterior-chain power.

Session content behind them is strong: four distinct glute archetypes in
`workout-templates.ts` — `glute-strength` (heavy hip thrust, 6–8), `glute-shape`
(medius/upper glute, controlled tempo, 10–12), `glute-pump` (bands and cables, 15–20, short
rest), `glute-detail` (single-leg, abductors, glute-ham tie-in) — plus a dedicated
`abductors` template. These encode the runway thesis already.

### 2.2 The Split Architect has no lower-led lane

`src/lib/training/split-architectures.ts` holds 18 architectures. **Every one opens on chest,
back or push.** None is lower-led. Three carry a single lower day (`bro-split`,
`hybrid-bodybuilder`, `hybrid-runner`), and `reserve-physique` at ≤3 training days silently
resolves to `full-body-3`. Nothing anywhere discloses leg frequency.

### 2.3 The Architect receives no gender signal

`SplitArchitectPanel.tsx:132` calls `buildSplitRecommendation` with goal, physiqueArchetype,
advanced, recoveryStrong, trainingDaysPerWeek, weakPointLabels, hasDeadline. **No gender.**
`coachingProfile.genderIdentity` and `womens.enabled` both exist in the store and never reach
it. `SplitArchitectInput` has no field for it. This is why a woman is recommended Arnold.

`readGoal` in `split-architect.ts` has reads for running, hybrid/track, PPL/bodybuilding,
events and recomp — **nothing for glutes or shape**. "I want my glutes to grow" lands on a
bodybuilding split.

### 2.4 Precedence bug — a chosen split silently destroys a glute protocol

`daily-context.ts:656`. The resolution chain is:

```
programWeek ?? memberArchitecture ?? horizonActive ?? track ?? useBlueprint ?? muscleKind
```

`memberArchitecture` resolves **before** `track`. The comment block directly above claims
"1. Women's track → layered shape-frequency week" — the code does the opposite. So a woman on
The Crown who picks "Arnold Split" loses three glute exposures for two generic `"Legs"` days,
with no indication it happened. Note: flipping the order back would re-break a previously
fixed bug where choosing a split did nothing.

### 2.5 The enrollment split step is a dead end

`OperatingSystemSetup.tsx:38`:

```ts
const SPLITS = ["Push Pull Legs", "Upper Lower", "Chest / Back", "Arms / Delts", "Legs", "Classic Specialization", "Custom"];
```

Hardcoded, gender-blind, one lower option literally labelled `"Legs"`, and it mixes
categories ("Chest / Back" and "Arms / Delts" are days, not splits). It writes
`setupProfile.preferredSplit`, which flows to `currentSplit`, which is read in exactly one
place — `protocol-suitability.ts:336`, testing whether the string contains `"none"`. **The
choice shapes nothing.** Dead CTA under the UI rule in CLAUDE.md.

### 2.6 Four blueprint archetypes resolve to no session

`workout-templates.ts:1768` maps `zone2`, `core`, `waistline`, `pilates`, `yoga`, `mobility`
to `null`.

A `rest(title, archetype)` day sets `recovery: true` and never loads a lifting template, so a
null archetype on a rest day is harmless — 28 such entries exist and are fine. The holes are
`day()` entries, which are real training days. Verified list:

**Static — authored into a named protocol:**

| Protocol | Day | Archetype |
|---|---|---|
| Hybrid Pilates Shape / STUDIO | 2 · Pilates + Core Control | `pilates` |
| Hybrid Pilates Shape / STUDIO | 4 · Pilates / Yoga Flow | `yoga` |
| Glute Crown / CROWN | 6 · Waistline + Cardio | `waistline` |
| Endurance Physique | 5 · Easy Aerobic + Mobility | `zone2` |
| Pregnancy Lifestyle | 5 · Low-Impact Walking + Breathing | `zone2` |

**Dynamic — injected into ANY protocol's week.** This is the larger finding:

- `activityDayFor` (`split-blueprints.ts:854`) injects a Pilates or Yoga **training day** into
  any protocol when the member's activity stack mentions pilates or yoga. That covers **6 of
  the 8 `ACTIVITY_STACKS`** — Gym+Pilates, Gym+Yoga, Pilates+Yoga, Gym+Pilates+Yoga,
  Gym+Pilates+Sports, Full Hybrid Week. Every one of those members gets a day that resolves
  to no session, on any protocol.
- Recovery preference "aggressive" (`split-blueprints.ts:934`) replaces a recovery day with
  `day("Conditioning + Mobility", "zone2", …)` — also null, on any protocol.

So the blast radius is not one women's protocol. It is five named protocols plus every member
who picks a pilates/yoga activity stack or an aggressive recovery preference.

`core` and `mobility` are null but appear only in `rest()`; they are filled anyway to stop the
next injector reopening the hole. `recovery` and `logged` are null by design.

### 2.7 Weekly commitments cannot express real life

`ACTIVITY_STACKS` in `activity-stack.ts` is eight preset bundles ("Gym + Pilates", "Full
Hybrid Week"). **No frequency** — cannot say *2x a week*. **No days** — cannot say *Tuesday
and Thursday*. `SportType` is a single value, so *track weekly **and** Pilates twice* is
inexpressible. `SplitDayEdit` with `scope: "weekly"` can patch a day, but that is
after-the-fact override: she builds a week blind to her life, then corrects it day by day.

**There is no `pilates` activity key.** `SplitActivityKey` offers track, run, long-run,
group-class, sport, conditioning, zone2, swim, cycling, yoga, mobility. Pilates — the most
common women's modality in this product — must be filed as "Group Class" (load: `high`),
which is wrong. Meanwhile `pilates` exists as a `SessionArchetype` and in `ACTIVITY_STACKS`.
Three systems disagree.

### 2.8 Two-a-days are not modelled, and `preferFasted` is dead

"two-a-day" appears twice in the repo, both marketing copy (`ScheduleBuilderPanel.tsx:102`,
`primary-action.ts:52`). `ArchitectureDay` and `BlueprintDay` are strictly one session per
day with no AM/PM. `LifestyleActivity` does carry `dayIndex` + `startTime`, so the custom
Build Studio can hold two sessions on a day — but that is a separate system from the
protocol/split resolver.

`preferFasted` (`athlete-store.ts:783`) has **zero consumers**. Another dead setting.

### 2.9 Competitive benchmark — Ladder (joinladder.com, read 2026-10-01)

Ladder ships **four** glute plans: TRANSFORM ("Glute focused strength training without the
bulk"), ERA ("Grow Your Glutes & Reshape Your Body"), EVOLVE ("aesthetic muscle with
glute-focused bodybuilding"), ASCEND ("Shape an hourglass physique"). Naming is one word, all
caps, no suffix; the *description* sells, not the name.

Taken: the naming form; the phrase "without the bulk" (names the fear — and
`FEMALE_GOALS` in `OnboardingWizard.tsx:193` already contains "Strength Without Bulk", so the
vocabulary exists and never reaches a protocol card); description discipline.

Refused: the named-human-coach model (CLAUDE.md bars real coach names in public UI).

**Name collision:** ASCEND is Ladder's hourglass glute plan. Reserve's `glute-ascend`
predates it, but shipping "The Ascent" as the flagship glute protocol duplicates a direct
competitor in the same category. Moving to SUMMIT.

## 3. Decisions taken by the owner

| Decision | Choice |
|---|---|
| Order of work | Training first; women's-section consolidation deferred to its own spec |
| Four lower-led splits | **Women's path only** — not offered to male members |
| Existing 18 architectures | Remain visible to women (a woman who wants PPL can pick it) |
| Precedence | Her named choice wins, **stated plainly**, never silently rewritten |
| Glute protocol count | Two is enough (CROWN, SUMMIT) — go deeper, not wider |
| Naming | Ladder-tight single words; **display names only, ids frozen** |
| Double Day | **Member toggle, all users, any split** — not women-only |
| Double Day days | **Specific weekdays**, not a count (owner runs Mon/Tue/Thu/Fri) |
| Cardio fill | All six null archetypes, after a full audit for other holes |

## 4. Design

### A1 — Women's lower-led architectures

Add four to `SPLIT_ARCHITECTURES`. Every day explicitly `archetype`-backed against templates
that already exist, so no session content is invented.

Each day's `archetype` is stated explicitly below. Every one already exists in
`SessionArchetype` and resolves to a real template via `getTemplateForArchetype` — except the
conditioning/waistline days, which depend on A6a landing first (see build order, §9).

**`lower-priority-ul` — CROWN FOUR** (4 training days, 2 lower)

| Slot | Title | `archetype` |
|---|---|---|
| 1 | Glute Strength + Hamstrings | `glute-strength` |
| 2 | Back Line + Delts | `posture-upper` |
| 3 | Recovery | — |
| 4 | Glute Shape + Hamstrings | `hamstring-glute` |
| 5 | Shoulders + Back Width | `upper-tone` |
| 6 | Recovery | — |
| 7 | Recovery (main rest) | — |

**`glute-priority` — CROWN FIVE** (5 training days, 3 lower)

| Slot | Title | `archetype` |
|---|---|---|
| 1 | Glute Strength + Hamstrings | `glute-strength` |
| 2 | Back Line + Delts | `posture-upper` |
| 3 | Glute Shape + Abductors | `glute-shape` |
| 4 | Recovery | — |
| 5 | Shoulders + Back Width | `upper-tone` |
| 6 | Glute Pump + Waistline | `glute-pump` |
| 7 | Recovery (main rest) | — |

**`runway-athletic` — RUNWAY ATHLETIC** (5 training days, 3 lower)

| Slot | Title | `archetype` |
|---|---|---|
| 1 | Glute Strength + Hamstrings | `glute-strength` |
| 2 | Upper Strength + Core | `upper-strength` |
| 3 | Posterior Chain + Power | `posterior-chain` |
| 4 | Recovery | — |
| 5 | Glute Pump + Abductors | `glute-pump` |
| 6 | Low-Impact Conditioning | `zone2` *(needs A6a)* |
| 7 | Recovery (main rest) | — |

**`glute-crown-six` — CROWN SIX** (6 training days, 3 lower)

| Slot | Title | `archetype` |
|---|---|---|
| 1 | Glute Strength + Hamstrings | `glute-strength` |
| 2 | Back Line + Delts | `posture-upper` |
| 3 | Glute Shape + Abductors | `glute-shape` |
| 4 | Shoulders + Arm Day | `delts-arms` |
| 5 | Glute Pump + Detail | `glute-pump` |
| 6 | Conditioning + Waistline | `waistline` *(needs A6a)* |
| 7 | Recovery (main rest) | — |

Day titles must alias-resolve via `resolveSplitKey` unless recovery/activity/archetype-backed;
all lifting days here are archetype-backed, which satisfies the `split-customization` suite.
"Arm Day" is used rather than bare "Arms" — the alias table only matches "arm day".

Each opens on the glutes while the reserve is full — the inverse of all 18 existing
architectures. Two upper exposures per week build the shoulder-and-back line that frames the
waist. No heavy loaded oblique work.

Gating: add `audience?: "womens"` to `SplitSystem` and `SplitArchitecture`. Add
`womensPath: boolean` to `SplitArchitectInput`, fed from
`genderIdentity === "female" || womens.enabled`. Filter the catalog, the recommendation and
the deeper disclosure on it. A male member never sees these four.

Add glute/shape/runway/swim/resort reads to `readGoal`, active only when `womensPath`.

### A2 — Precedence honesty

Keep `memberArchitecture` winning. Correct the comment block so it matches the code. Return
the paused-track fact from the resolver so the UI can state it:

> Arnold Split · 2 leg days. Your CROWN week (3 glute exposures) is paused while this is
> active.

One tap returns her to the protocol week. Nothing silent, nothing rewritten.

### A3 — Enrollment rebuild

Delete the hardcoded `SPLITS` array. The Training Setup step becomes a real picker driven by
`SPLIT_SYSTEMS`, filtered by her path, showing each option's leg frequency, and it
**writes `splitSystem`** so the choice builds her week. Mixed-category entries are removed.

### A4 — Naming and frequency copy

Display names and taglines only. **All nine ids frozen** — zero migration, no active protocol
orphaned.

| id (unchanged) | Was | Now | Line |
|---|---|---|---|
| `glute-crown` | Glute Crown Rotation | **CROWN** | Maximum glute priority, built without the bulk |
| `glute-ascend` | Glute Ascend Protocol | **SUMMIT** | Glutes lead, legs complete — strength without the bulk |
| `sculpted-legs` | Sculpted Legs Architecture | **LONG LINES** | Complete legs built for length, not thickness |
| `runway-shape` | Runway Shape Protocol | **RUNWAY** | Shape, posture and waistline for a photographed physique |
| `vacation-physique` | Vacation Physique Rotation | **RESORT** | A sharper look on a schedule that's already full |
| `athletic-model` | Athletic Model Rotation | **OFF-DUTY** | A physique that performs and photographs |
| `signature-shape` | Signature Shape Rotation | **SIGNATURE** | The complete foundation before you specialize |
| `hybrid-pilates-shape` | Hybrid Pilates Shape Protocol | **STUDIO** | Gym strength and studio control in one week |
| `sport-strength-shape` | Sport + Strength Shape Protocol | **FIELD** | Strength that holds up in your sport |

Plus `lowerDaysPerWeek`, **derived from the authored week** (never hand-typed, so it cannot
drift), surfaced as a badge on every architecture card. `bro-split` will read "1 leg day"
out loud.

### A5 — Weekly commitments

Add `pilates` to `SplitActivityKey` with `load: "moderate"` — resolving the three-way
disagreement between `SplitActivityKey`, `SessionArchetype` and `ACTIVITY_STACKS`.

New model, replacing the preset-bundle question:

```ts
type WeeklyCommitment = {
  activity: SplitActivityKey;   // track, pilates, run, swim, sport…
  timesPerWeek: number;         // 1–7
  days?: number[];              // optional fixed weekdays, 0 = Monday
};
```

`activityStack` becomes **derived** from commitments rather than a second question the member
must also answer. The week is then built around them from the start: commitments land on
their fixed days first, lifting days arrange around them, and a heavy glute day is never
placed the day after track.

### A6 — Cardio content, Double Day, scheduling guidance

**A6a.** Fill all six null archetypes with real prescribed sessions. Shape specified by the
owner — a duration, a zone, and 2–3 equipment routes, so Reserve never pretends there is one
gym:

> **Zone 2 · 25 min** — Outdoors · Treadmill · Stairmaster
> Or split it: 20 min treadmill zone 2 + 10 min stairmaster zone 2.
> Conversational pace, nasal breathing.

Same treatment for `waistline`, `core`, `pilates`, `yoga`, `mobility`. This also closes the
two empty days in Hybrid Pilates Shape / STUDIO.

**A6b — Double Day.** Available to **all members, any split**. Per-weekday selection, not a
count:

```ts
type DoubleDay = {
  enabled: boolean;
  morning: {
    activity: SplitActivityKey;   // zone2 by default
    days: number[];               // e.g. [0,1,3,4] = Mon/Tue/Thu/Fri
    durationMinutes: number;      // e.g. 25
    fasted: boolean;              // finally wires preferFasted
    route?: string;               // outdoors | treadmill | stairmaster | split
  };
};
```

Wiring `fasted` gives `preferFasted` its first consumer. The nutrition engine already
handles the rest: `pre-workout-shake.ts` has a `"fasted"` style and lands meal 1 after an
early session.

**A6c — Scheduling guidance.** A "How to run this week" read **computed from her resolved
week and commitments**, never generic copy. Examples it can state: *don't put Glute Strength
the morning after track*; *put the fasted zone 2 before an upper day, not before Glute
Strength*; *your two Pilates days already cover mobility, so the mobility day is redundant.*

## 5. Compliance

- Fasted cardio is described as **placement and structure only**. No metabolic or fat-loss
  claim, no "burns more fat fasted." No guaranteed-results language anywhere.
- Public card copy uses **Runway / Resort / Swim** as descriptive terms. No real
  federation, event, athlete or coach names (CLAUDE.md).
- Public tier names remain **Reserve Signature** and **Reserve Black** only. No
  Core/Basic/Starter/Entry/Lite/Standard/Beginner in public copy — the first-timer lane, if
  ever added, ships as Foundation language.
- No medical, dosage or supplement content is touched by this work.
- "Arm Day", never bare "Arms" — the alias table only matches "arm day".

## 6. Naming hazard to respect

**"Hybrid" already means five things in this codebase:** `hybrid-athlete`,
`hybrid-bodybuilder`, `hybrid-runner`, `hybrid-performance` (protocol category) and
`full-hybrid` (activity stack). The AM-cardio/PM-lift concept is therefore called
**Double Day**, and "hybrid" keeps meaning lift-plus-sport.

Separately: the string `womens-performance` is **two different things** — a view id *and* a
protocol category driving all nine women's protocols. The category must survive untouched.

## 7. Out of scope

- The women's-section consolidation (deleting the five phase-lens rooms, folding the phase
  lens into the core commands, relocating Cycle / Fertility / Pregnancy). Own spec.
- New session templates for lifting days — the existing glute templates are the strongest
  part of the system and are reused as-is.
- Any gender gate on Double Day.
- Renaming protocol ids.
- A fifth glute protocol.

## 8. Verification

- `npm run lint` and `npm run build` both clean.
- Existing suites green: `split-customization`, `split-week-shape`, `member-split`,
  `member-split-explanation`, `session-protocol`, `architecture-divergence`, `fallback-week`.
- New assertions:
  - every lower-led architecture carries ≥2 lower days;
  - every authored day title resolves to a real template or is archetype/activity/recovery-backed;
  - no archetype used by any blueprint resolves to `null`;
  - the four women's architectures are absent from a male member's catalog, recommendation and
    deeper disclosure;
  - `lowerDaysPerWeek` is derived, and matches a hand-count for every architecture;
  - a chosen split that pauses a women's track reports the paused track rather than hiding it.
- Compliance: `src/lib/safety/__tests__/compliance-language.ts` banned-language suite passes.

## 9. Build order

A1–A6 is too large for one implementation plan and is sequenced into four shippable phases.
Each phase ends green on lint + build + suites and is independently useful.

**Phase 1 — Cardio and low-impact content (A6a).** First because CROWN SIX and RUNWAY
ATHLETIC both schedule a day that currently resolves to `null`, and because it closes the two
empty days already shipping in Hybrid Pilates Shape / STUDIO. Fill `zone2`, `waistline`,
`core`, `pilates`, `yoga`, `mobility` with real prescribed sessions. Add the assertion that no
archetype used by any blueprint resolves to `null` — this phase is what makes that assertion
passable.

**Phase 2 — Women's lower-led splits and precedence (A1 + A2).** The four architectures,
`audience: "womens"`, `womensPath` threaded into `SplitArchitectInput` from the panel, the
glute/shape `readGoal` reads, derived `lowerDaysPerWeek` with badges on every card, the
corrected precedence comment and the paused-track fact surfaced. This phase answers the
owner's opening report.

**Phase 3 — Naming and card copy (A4).** Display names and taglines for the nine protocols,
ids frozen. Leg frequency stated on protocol cards. Lands after Phase 2 so the four new
splits are named in the same pass.

**Phase 4 — Commitments, enrollment and Double Day (A3 + A5 + A6b + A6c).** The `pilates`
activity key, `WeeklyCommitment` with frequency and optional fixed days, `activityStack`
derived rather than asked, the enrollment picker rebuilt to write `splitSystem`, the Double
Day toggle with per-weekday selection wiring `preferFasted`, and the derived scheduling
guidance. Largest phase and the one that touches onboarding, the schedule profile and the
resolver together — deliberately last, built against a final architecture list.

Phase 4 may be split again once Phase 2 lands and the real surface area of the enrollment
picker is known.

## 10. Open items

None blocking. Decisions in §3 are settled; the deferred women's-section consolidation
(§7) needs its own brainstorm before it is specced.
