# Owner Mode Stage 3 — Research Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Research tab in Compound Command, for every member behind the safety acknowledgement, with Lab Response, Burden Map and N=1 Review.

**Architecture:** The builders in `src/lib/research/` are pure and read existing records: the lab safety brief, the enhancement log, burden links, check-ins, cycles and change history. React components in `src/components/research/` render them inside `SafetyAcknowledgementGate`. The only new stored field is `Observation.markedForReviewAt`.

**Tech Stack:** Next.js 16, TypeScript, Zustand store, Vitest, Playwright.

Spec: `docs/superpowers/specs/2026-09-15-owner-mode-stage-3-design.md`

---

### Task 1: Observation review flag

**Files:**
- Modify: `src/lib/history/types.ts` (add `markedForReviewAt?: string` to `Observation`)
- Modify: `src/lib/athlete-store.ts` (add `toggleObservationReview(id)` beside `removeObservation`)
- Test: `src/lib/__tests__/change-history-store.test.ts`

- [ ] Write a test: toggling sets an ISO `markedForReviewAt`, toggling again clears it, and an unknown id leaves observations unchanged.
- [ ] Run `node ../../../node_modules/vitest/vitest.mjs run src/lib/__tests__/change-history-store.test.ts`. Expect it to fail.
- [ ] Implement the toggle with `set((s) => ({ observations: s.observations.map(...) }))`.
- [ ] Run the test again. Expect it to pass.

### Task 2: Lab Response builder

**Files:**
- Create: `src/lib/research/lab-response.ts`
- Create: `src/lib/research/__tests__/lab-response.test.ts`

- [ ] **Write tests.** Expect `listLabMarkers(labBrief)` to return every history id with its label, alphabetical. For `buildLabResponse({ labBrief, markerId, changeHistory, cycles, checkIns })`, test that:
  - points are oldest first
  - readings in another unit go to `otherUnit` and are not drawn
  - `changeFromPrevious` has a value and a percent
  - events include change-history entries, cycle start and end, and check-ins with blood pressure, heart rate and weight, limited to the span of the readings (padded 30 days)
  - `findings` hold the lab brief findings for that id
- [ ] Run them. Expect them to fail.
- [ ] Implement the builder.
- [ ] Run them. Expect them to pass.

### Task 3: Burden Map builder

**Files:**
- Create: `src/lib/research/burden-map.ts`
- Create: `src/lib/research/__tests__/burden-map.test.ts`

- [ ] **Write tests.** For `buildBurdenMap({ compounds, labBrief, today })`, test that:
  - there is one row per `SYSTEM_ORDER` system
  - loaded rows come first
  - compounds are alphabetical, each with burdens and grade labels
  - markers show the latest value and age in days, or `null` for not tested
  - paused or inactive compounds are ignored
  - no-load rows have empty compounds
- [ ] Run them. Expect them to fail.
- [ ] Implement the builder.
- [ ] Run them. Expect them to pass.

### Task 4: N=1 Review builder and research copy

**Files:**
- Create: `src/lib/research/n1-review.ts`
- Create: `src/lib/research/copy.ts`
- Create: `src/lib/research/__tests__/n1-review.test.ts`
- Create: `src/lib/research/__tests__/research-copy.test.ts`

- [ ] **Write tests.** For `buildN1Review(observations, { onlyMarked })`, test that:
  - it groups by changed ref (or lowercased label for text)
  - groups are ordered by newest observation
  - `count` and `markedCount` are correct
  - `labMarkerId` is set when the noticed kind is marker
- [ ] **Copy test.** Every string in `RESEARCH_COPY` passes `bannedLanguageIn` and does not match the cause-word regex.
- [ ] Implement both files.
- [ ] Run all four test files in `src/lib/research`. Expect them to pass.

### Task 5: Research tab UI

**Files:**
- Create: `src/components/research/ResearchTab.tsx`
- Create: `src/components/research/LabResponsePanel.tsx`
- Create: `src/components/research/BurdenMapPanel.tsx`
- Create: `src/components/research/N1ReviewPanel.tsx`
- Modify: `src/components/views/CompoundCommandView.tsx` (`TabKey` `"research"`, `ALL_TABS` entry after Timeline, render block)

- [ ] **`ResearchTab`:**
  - `useClientNow`, then `SafetyAcknowledgementGate`
  - the body calls `useSafetyContext(now)` and shows `EscalationList items={ctx.escalation}` first
  - `ReserveSegmented` switches between the panels
- [ ] **Lab Response:**
  - marker `select`
  - SVG chart with the range band
  - event rail list
  - readings table
  - finding notes
- [ ] **Burden Map:** system rows, compound chips with grade labels, marker latest and age, a "Pending clinician review" label.
- [ ] **N=1 Review:** groups, "Mark for review" toggle, "Only marked" filter, an "Open in Lab Response" button that switches the panel and selects the marker.
- [ ] Run `tsc --noEmit` and eslint on the changed files. Expect no errors.

### Task 6: E2E, docs, validation

**Files:**
- Create: `tests/e2e/owner-mode-stage-3.spec.ts`
- Modify: `CLAUDE.md`
- Modify: `docs/compliance/HARM_REDUCTION_AMENDMENT.md`
- Modify: `docs/compliance/COUNSEL_BRIEF.md` (Q38)

- [ ] **E2E** on `stage3-member` (port 3351, switch off), seeding a compound, two lab records, a change event and an observation:
  - the acknowledgement gate
  - Lab Response shows readings and a Timeline event
  - Burden Map shows a compound with its grade
  - mark an observation and filter to it
- [ ] Write the docs.
- [ ] **Validate:**
  - `npm run lint`
  - full vitest
  - `npm run build`
  - regression e2e on `stage3-default` (cycle-review, cycle-safety, lab-intake, clinician-summary-print, open-source-notices, owner-mode-stage-2, owner-mode-stage-3)
- [ ] Report to the owner and ask before committing.
