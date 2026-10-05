# Owner Mode stage 3 — Research tab

Date: 2026-09-15 · Status: approved by owner

## Decisions (owner)

- **Audience:** everyone, not owner-only.
- **Panels:** Lab Response, Burden Map, N=1 Review. Clinician PDF inclusion of the Timeline stays out of scope.
- **Placement:** one "Research" tab in Compound Command, next to Timeline.
- **Launch switch:** live for everyone now, as an owner-directed exception. The tab sits behind the safety acknowledgement (including 18+) and does not check `useSafetyToolsVisible()`. Everything else in Cycle & Safety still does.

## Data

- `Observation.markedForReviewAt?: string` (ISO), toggled by a store action `toggleObservationReview(id)`. It syncs with `observations`.
- Everything else is computed from existing records:
  - lab records (via `buildLabSafetyBrief`)
  - compounds (the enhancement log)
  - `burdensForCompound`
  - `cycleCheckIns`
  - `cyclePeriods`
  - `changeHistory`

## Builders (`src/lib/research/`, pure, tested)

- **`lab-response.ts`**
  - `buildLabResponse({ labBrief, markerKey | readingId, changeHistory, cycles, checkIns })`
  - **Chart points:** every reading of one marker, oldest first; only readings in the latest unit are drawn, the rest are listed.
  - **Range:** the latest reading's report range; each reading keeps its lab flag and its position against that report's range.
  - **Change:** from the previous drawable reading only (value and percent).
  - **Events on the same dates:** compound, support-plan and cycle changes; cycle start and end; check-ins with blood pressure, resting heart rate and bodyweight.
  - **Findings:** any finding for this marker from the lab brief, with its tier.
  - No correlation, no windows, no "since".
- **`burden-map.ts`**
  - `buildBurdenMap({ compounds, labBrief, checkIns, today })`
  - Returns one row per `SYSTEM_ORDER` system. Each row has:
    - the running compounds that load it, sorted alphabetically, each with the burdens it carries there and their evidence grades
    - the watched markers, each with the latest reading, date, age in days, or "not tested"
  - Systems with no load are listed last, as "No logged compound loads this system."
- **`n1-review.ts`**
  - `buildN1Review(observations, { onlyMarked })`
  - Groups observations by what changed (ref or label), newest first within a group.
  - Each group reports a count and marked count; when the noticed item is a lab marker, it carries a marker link for Lab Response.

## UI (`src/components/research/`)

- **Research tab:**
  - `ResearchTab` → `SafetyAcknowledgementGate`
  - a segmented control with Lab Response, Burden Map and N=1 Review
  - the open escalation list (`ctx.escalation`) always first when anything is open
- **Lab Response:**
  - marker select (all logged markers, alphabetical)
  - SVG chart with the range band and point flags
  - event rail
  - readings table
  - finding notice routed to "review with your clinician", or the emergency copy from the existing lab safety wording
- **Burden Map:**
  - system rows with compound chips (name · grade), watched markers with their latest value and age
  - a "Pending clinician review" label
- **N=1 Review:**
  - groups
  - "Mark for review" toggle
  - "Only marked" filter
  - "Open in Lab Response" link

## Compliance

- **Copy:**
  - no cause wording ("caused", "led to", "because", "improved", "worsened", "correlat…", "response to")
  - no ranking or "best"
  - no directives to start, stop, reduce or change
- **Burden Map:** framed as "commonly associated", with the cited grade, pending clinician review.
- **Lab Response:** placement in time only. The panel name means the member's lab results over time, and the explainer says so.
- **Docs:**
  - CLAUDE.md launch-switch exception
  - HARM_REDUCTION_AMENDMENT stage 3 section
  - COUNSEL_BRIEF Q38

## Tests

- **Unit:**
  - lab response points, unit split, events and findings
  - burden map alphabetical order, grades, not tested, no-load
  - N=1 grouping and marked filter
  - store toggle
  - banned language and cause wording across all research copy
- **E2E** (switch off, member):
  - the acknowledgement gate
  - Lab Response shows readings and a Timeline event
  - Burden Map shows a compound with its grade
  - an observation can be marked and filtered
- **Regression:** Cycle Review, Cycle & Safety, lab intake, clinician summary PDF, open-source notices, stage 2; lint and build.
