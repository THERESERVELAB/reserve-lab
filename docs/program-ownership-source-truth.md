# Program ownership source-of-truth trace

This note records the production chain traced before the v17 program-ownership work.

1. `athlete-store.ts` persists versioned `LifestyleSchedule` records and selects one with `activeLifestyleScheduleId`; an ISO-week `WeekAssignment` can select a different schedule for a calendar week.
2. A `LifestyleActivity` identifies its rotation day and may point to a `CustomWorkoutTemplate` through `workoutTemplateId`.
3. `session-bridge.ts` converts the selected template's ordered movements into the Training Command movement shape and a JSON-safe `SessionGenerationSnapshot`.
4. `startTrainingSession` freezes that snapshot. A live session is resumed instead of regenerated. `rebuildLiveSession` refuses to run after any set is logged.
5. `TrainingView` renders the frozen movement queue while live; a legacy live session without a snapshot keeps the existing derived fallback without invented provenance.
6. `closeOutTrainingSession` records the completed immutable session into the bounded `ActualWeekRecord` history and deduplicates by the real session id.
7. `exposure-engine.ts` reads the active schedule, assigned templates, side-activity profiles, and logged completion evidence. `adherence-engine.ts` compares planned activities with actual records across weeks.
8. `normalizePersistedStore` backfills new slices. Zustand `partialize` and cloud serialization both use the same `MEMBER_STATE_KEYS` picker. Cloud hydration runs through the same normalize/backfill/merge path as local restoration.

The v17 extension inserts `ProgramDefinition` and independently versioned `ProgramDayDefinition` records between weekly selection and session generation. It does not replace schedules, custom templates, or immutable sessions:

```text
week assignment / active program
→ resolved program day (today override → member/imported → Reserve optimized → Reserve original)
→ referenced custom template or existing Reserve session
→ SessionGenerationSnapshot with program/day provenance
→ frozen Training Command session
→ actual-week reconciliation with completed-set evidence
→ detailed exposure and inconsistency intelligence
→ shared local/cloud member-state envelope
```

History bounds: eight complete program versions per lineage, twelve day versions per day lineage (240 total), ninety today-only overrides, twenty import drafts with source excerpts capped at 30,000 characters, and twenty-six actual weeks.
