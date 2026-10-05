# Owner Mode — Stage 2: change history, notes, observations, custom supplements

**Date:** 2026-09-15 · **Status:** approved by the owner (all three design sections; remaining calls delegated)

## Goal

Every member (the owner first) can see how their plan changed over time, keep dated notes, record N=1 observations with timing only, and track supplements that are not in Reserve's library. The evidence-graded Support Plan becomes reachable from Compound Command → Support Stack without an active cycle.

## Decisions

| Decision | Choice |
|---|---|
| Who | Everything for every member (not owner-only) |
| Storage | New slices in each member's synced record (`member_state`), capped; no migration |
| Visibility | Live now. Owner-directed change: the Support Plan in Support Stack is exempt from the launch switch |
| Placement | Support Plan in the Support Stack tab, behind the safety acknowledgement (incl. 18+), works without a cycle |
| Observations | Structured, timing only; no Reserve analysis or cause wording |
| History capture | Recorded inside each store action, in the same state update |

## 1. Data

- `changeHistory: ChangeEvent[]` — newest 500. `ChangeEvent = { id, at, date, subject: { kind: "compound" | "support-plan" | "cycle", id, name }, action, changes: FieldChange[] }`.
  - Actions: `added`, `edited`, `paused`, `resumed`, `activated`, `deactivated`, `removed`, `ended`, `reopened`, `checkpoint-added`, `checkpoint-removed`.
  - `FieldChange = { field, label, from, to }` for member-entered fields only: compound name, amount, unit, frequency, route, start date, time of day; cycle name, start date, planned weeks, linked compounds count, clinician oversight; support item amount, unit, frequency, product, start date.
  - Created only by store actions — hydration, cloud sync, sign-in and resets never create events.
- `timelineNotes: TimelineNote[]` — newest 300. `{ id, date, text, createdAt, updatedAt }`, text ≤ 1000 characters.
- `observations: Observation[]` — newest 300. `{ id, date, changed: ObservationRef, noticed: ObservationRef, note?, createdAt }`, where `ObservationRef = { kind, ref?, label }`; `changed.kind` ∈ `compound | supplement | change | text`, `noticed.kind` ∈ `marker | check-in | symptom | text`.
- Custom supplements: `SupportPlanItem.customTitle` with `optionKey: "custom"`. Shown as "Entered by you · not in Reserve's library", no evidence grade, and "Reserve can't check its ingredients against your records."
- All three new keys join `MEMBER_STATE_KEYS` and reset at the account boundary like every member slice.

## 2. What members see

- **Compound Command → Timeline tab (new):** change history, dated notes and observations in date order. "Add note" and "Add observation". Observations are labelled **Your observation · timing only**; member text is shown exactly as written.
- **Compound Command → Support Stack:** the Support Plan section above the existing link tool, behind the safety acknowledgement. Built without a cycle from logged compounds, the full lab history (`buildMarkerTrends` with `cycle: null`), check-ins and sleep. Members can add their own supplements from the library sheet.
- **Launch switch:** the Support Plan in Support Stack is exempt. Risk profiles, Cycle Review, lab flags and the symptom check stay behind the switch.
- Not in this stage: history and observations in the clinician summary / PDF (stage 3).

## 3. Compliance, tests, docs

- Reserve-authored copy (event summaries, labels, custom supplement lines) passes the banned-language suite; observation display never adds cause words; history carries member-entered values only.
- Tests: an event for every action; no events from hydration or reset; caps; account-boundary reset; notes and observations CRUD and caps; custom supplement add, dedupe and honest review lines; no-cycle support review; e2e with the launch switch off (Timeline records an edit, member adds an observation, Support Plan in Support Stack behind the acknowledgement with a custom supplement).
- Docs: CLAUDE.md launch-switch amendment and observations rule; amendment section; counsel Q36 (member N=1 observations) and Q37 (Support Plan live before review).
