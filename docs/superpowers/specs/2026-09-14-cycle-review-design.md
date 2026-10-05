# Cycle Review (owner brief: "Cycle Optimization") — Design

**Date:** 2026-09-14 · **Branch:** `claude/cycle-safety-intelligence` · **Status:** built, pending owner review. Not committed.

## Product principle

The review never asks "how can this cycle be stronger?" It asks: given what this member is already doing, how can the plan become more deliberate, measurable, goal-aligned and reviewable by a clinician, with less preventable risk?

## Naming

The owner brief calls this "Cycle Optimization" and asks for an "Optimize my cycle" action. The public label is **Cycle Review**, and the action is **Review my cycle**. Reason: `AGENTS.md` and `DESIGN_BIBLE.md` §04 forbid "protocol optimization (for compounds)". "Optimize" also reads as making the cycle stronger, which is the opposite of the principle above. This needs owner sign-off, and the label is a single string to change.

## Boundary (unchanged hard rules)

The review never tells a member to:
- increase an amount
- add, start or stop a compound or medication
- change frequency or route
- use one compound against another

Its only moves are **monitor**, **log**, **review** and **ask a clinician**. Missing data stays visibly missing ("Unknown / not entered", "Evidence needed"). Lab changes are described as timing ("during the same period"), never as a cause.

## Data sources (reused)

| Input | Source |
| --- | --- |
| Cycle, phase, week | `cycle-period.ts` `resolveCycleState` |
| Compounds as entered | `trainingSession.enhancementLog` (amount, frequency, route, start, sourceType) |
| Risk + burdens | `risk-profiles.ts` → new `burdens.ts` (per-profile load links with evidence grades) |
| Evidence scale | new shared `compound-intelligence/evidence.ts` (Established / Supported / Limited / Not shown / Uncertain); support options re-export it |
| Labs | `lab-safety.ts` history + findings (report's own range and flag) |
| Escalation | `safety/escalation.ts` |
| Age, sex, height | `setupProfile` |
| Weight | `physiqueCommand.entries` + check-ins |
| Resting HR | `physiqueCommand.entries.restingHeartRate` + check-ins |
| Sleep | `recoveryCommand.sleepLogs` |
| Training | `trainingSession.executionHistory` |
| Nutrition phase + targets | `useNutritionAlignment()` |

**Not tracked anywhere today** (reported as gaps, never guessed): blood pressure (now captured by the weekly check-in), steps, cardio minutes, libido (now captured by the check-in).

## New data (persisted, in `MEMBER_STATE_KEYS`)

- `cycleGoals: Record<cycleId, CycleGoalSetup>`: primary goal, secondary priorities, and each compound's recorded purpose.
- `cycleCheckIns: CycleCheckIn[]`: bodyweight, average BP, resting HR, sleep, 1–5 ratings, symptoms, new medications, outside changes.
- `cycleReviewSnapshots: CycleReviewSnapshot[]`: saved clinician summaries. This stands in for "Save to journal", because no general journal exists: the Journal view is a static placeholder, and `trainingJournal` is shaped for finished workouts.

## Engine (`src/lib/cycle-review/`, pure, unit-tested)

| Module | Responsibility |
| --- | --- |
| `types.ts` | Goals, priorities → burdens, purposes, check-in symptoms (with escalation keys), snapshot |
| `lab-trends.ts` | Baseline (latest draw ≤180 days before start) / current / points; statuses Evidence needed · Inside range · Near baseline · Changed · Trend worth reviewing · Outside range · Review with clinician; cycle timeline events |
| `complexity.ts` | Band low → very high with reasons (count, shared loads by system, duration, past end, untested markers, no labs since start, moving linked labs, symptoms); complexity review (no purpose, off-goal purpose, same role + shared load, several "managing effects", mid-cycle additions, shared load + moving labs → review soon); priority conflicts |
| `body-systems.ts` | Nine rows: Review with clinician · Trend · Monitoring due · Evidence needed · Monitored · No known load |
| `check-in.ts` | Since last week: Improved / Stable / Worth watching / Review. Vitals are directional only |
| `nutrition-phase.ts` | Goal vs fuel-strategy direction; today's estimated targets; least-squares weekly weight rate vs a general coaching range; glucose watch for plans with glucose-affecting compounds. No compound-timed meals |
| `training-recovery.ts` | Four weeks before the cycle vs the last four weeks: sessions, sets, est. 1RM on shared lifts, RPE, adherence, sleep, RHR, recovery rating; flags volume up while recovery falls |
| `report.ts` | Assembles the review: aligned, attention (ranked high → low), gaps, questions (≤8, from the member's own numbers), clinician summary text |

## UI (`src/components/cycle-review/`)

Entry: the **Review my cycle** action on the cycle overview in Cycle & Safety (inside the existing acknowledgement gate).

Order (owner brief §17):
1. Top card: goal, phase, week, last labs, last check-in
2. What looks good
3. What needs attention
4. Lab trends
5. Body systems
6. Cycle complexity
7. Nutrition
8. Training + recovery
9. Questions for your clinician, plus the "Bring this to your clinician" card

The weekly check-in is a bottom sheet. When a symptom needs care, the sheet shows the escalation, and the review collapses behind "Show the review anyway".

Severity styling: red only for "Review with your clinician" and care items. Amber for trends. Everything else uses neutral opacity.

## Changes after visual review

The real-app screenshots at 1280 and 390 px surfaced these, now fixed:

- **Trend reasons disagreed with the "from" value.** A lab-flagged trend read "since" the previous draw while the row showed the baseline. When a pre-cycle baseline exists, the reason now reads from it.
- **Stray unit spacing.** Percent values printed as "45 %"; `formatLabValue` is now shared.
- **Shared loads were a wall of nine rows.** Loads whose markers moved sort first, four show, and the rest sit behind "N more shared loads". Each row carries only its monitoring note, not the compound names a second time.
- **Mid-sentence capitals and missing "or".** "No Estradiol, Prolactin, LH results" is now "No estradiol, prolactin or LH result", using shared helpers in `cycle-review/text.ts`.
- **Four near-identical monitoring questions** are merged into one question that names the markers.
- **Testosterone was missing from "Androgenic effects".** Its profile now cites acne and oily skin from prescribing information, with a matching burden link.
- **Body-system rows repeated "Loaded by…" everywhere.** The compound note now shows only on rows that are moving or routed to a clinician.
- **The clinician card showed an ISO date.** It now uses the same date format as the rest of the screen.

## Testing

- **Unit:** `burdens.test.ts` and `cycle-review.test.ts` cover baseline/trend, never-causal copy, missing data, timeline, redundancy, kitchen-sink review, priority conflicts, systems, ranking, questions, summary fidelity, banned language, care step-aside, check-in direction, weight rate, and volume-vs-recovery.
- **E2E:** `tests/e2e/cycle-review.spec.ts` covers the goal setup, the review sections, the check-in with a warning sign → 911, and copying the clinician summary.

## Open questions for clinician / counsel

- Evidence grades on burden links (`burdens.ts`) are authored from the cited profiles and need clinician sign-off.
- The general coaching ranges for weekly weight change, and the ≥10% / 5 mmHg / 5 bpm change thresholds, are product heuristics, not clinical cut-offs.
- Priority-conflict and complexity copy may need counsel review for practice-of-medicine exposure (counsel brief Q4).
- `reserve-design-constitution/references/clinical-data.md` still says "lab interpretation of any kind" and "cycles" are forbidden, while `CLAUDE.md` was amended 2026-09-13 to allow harm-reduction monitoring. The constitution needs a versioned owner edit so the two agree.
