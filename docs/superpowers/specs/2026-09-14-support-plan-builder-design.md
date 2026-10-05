# Support Plan Builder — Design

**Date:** 2026-09-14 · **Branch:** `claude/cycle-safety-intelligence` · **Status:** built, pending owner review. Not committed.

## Principle

The fewest justified interventions for the member's real priorities. Unsupported products, interactions, duplicate ingredients, worsening markers and monitoring gaps must be impossible to overlook. More supplements never reads as safer, and nothing is called safe.

## Where it lives

Inside Cycle Review, between Body systems and Cycle complexity:

- **Support plan panel**
  - summary
  - my plan, grouped by purpose
  - duplicate intake
  - "covers" and "supplements don't address"
- **Health Support panel** — coverage by system
- **Supplement library sheet** — "Linked to your data" and "All options", with option detail
- **Details sheet** — member-entered fields

The Cycle & Safety risk-card support sheet adds to the same plan.

## One library

`src/lib/compound-intelligence/support-options.ts` is extended, not duplicated:
- **Purpose groups:** Cardiovascular & lipids, Liver, Glucose & metabolic, General nutrition, Recovery, Sleep, Hydration & electrolytes, Bone health, GI health.
- **New per-option fields:** `doesNotAddress` and `coverageLabel`.
- **`CATALOG_INGREDIENTS`:** "contains" vs "commonly" for duplicate checks.
- **New options:** melatonin (sleep) and electrolytes (hydration).
- **New findings:** magnesium (glucose, sleep), psyllium (GI, ApoB marker) and vitamin D3 (general).
- **Recovery** stays empty: no option passed evidence review.

Only dietary supplements appear. Every option's catalog category and risk profile regulatory status are test-checked.

## Engine — `src/lib/cycle-review/support-plan.ts`

| Function | Does |
| --- | --- |
| `reasonsFor(option, ctx, areas?)` | Reasons from real data only: compound loads for the area, the member's moving or outside-range markers, priorities, recent insomnia or profile sleep issues, goal. Scoped to the purpose group the option is listed under. Never blood pressure |
| `labLinksFor` | The member's related markers with value, date, direction and status |
| `intakeSources` / `findDuplicates` | Plan items plus active logged supplements. Flags watched nutrients (vitamins A, B6, D, niacin, calcium, magnesium, zinc, iron, sodium, potassium) that come from 2+ sources |
| `checkSafety` | Rules per option: blood thinners, insulin and glucose-lowering drugs, oral compounds (member route, else catalog-only-oral), nitrates, potassium-raising drugs, sedatives, kidney/calcium/electrolyte lab flags, CHF, diabetes, high blood pressure, fish and ragweed allergies, snoring symptoms. Also the option's own profile overlaps and duplicates. Levels: No known issue detected from information entered · Review before using · Ask a clinician or pharmacist first. Always includes "Based on the information currently entered." plus missing-data caveats |
| `buildSupportLibrary` | Groups with per-group reasons, all reasons, in-plan and in-log flags, a check (as if added), and lab links |
| `buildSupportPlanReview` | Entries (grade, check, lab links, before/after timing), counts, duplicates, coverage rows, covers, not-addressed, size note, library |

Cycle Review integration:
- `buildCycleReview` builds `review.support`.
- "Ask first" checks and duplicates join What needs attention.
- The clinician summary gains a SUPPORT PLAN section, with member-entered details and "Unknown / not entered".

## Data

`supportPlan: SupportPlanItem[]` holds `optionKey`, `addedAt`, and optional member-entered `amount`, `unit`, `frequency`, `brand`, `startDate` and `notes`. It is synced via `MEMBER_STATE_KEYS`. Items are added only by the member, one per option, and removable at any time.

## Visual review changes

- The option detail's add action moved below the evidence, "does not address" and the check, and uses a secondary button.
- Plan rows show the check's reasons inline.
- Health Support "Monitored" now carries a moving or clinician-routed system status.
- The General nutrition row no longer counts GI or hydration findings.
- List reasons are scoped per purpose group, so magnesium under Sleep no longer shows its cardiovascular reason.
- Duplicate source notes read as one parenthetical.
- The phone detail opens at its top, and going back returns to the row it came from.

## Tests

- **Unit:** `support-plan.test.ts` covers:
  - supplements only, no prescription medicines
  - purpose grouping and the empty Recovery note
  - reasons from real data, group-scoped reasons, no reason without data, never blood pressure
  - interaction and allergy checks, and oral route from the catalog
  - caveats for missing data
  - duplicates with sources, including before adding
  - counts with no score, and the size note
  - lab links and timing-only language
  - no-proven-support coverage
  - "supplements don't address", which names no supplement
  - no invented details
  - banned language and safety-claim scan
  - `supportPlan` persisted key
- **E2E:** `cycle-review.spec.ts › support plan` covers:
  - the empty state and browsing the library
  - why-reasons, "does not address", markers and the check
  - adding
  - "All options" with no prescription drugs and the Recovery note
  - adding a duplicate that is flagged before it is added
  - the plan summary, duplicates, gaps and no-proven-support
  - member-entered details
  - removal, and persistence across a reload

  `cycle-safety.spec.ts` covers the risk-card sheet adding to the plan.
