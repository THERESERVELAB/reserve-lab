# Support Stack completeness — plan

Owner direction (2026-09-15): make the Support Stack seamless for members, have an answer for every kind of support option, and have it assist with the member's labs.

Compliance stays as it is: options listed alphabetically with a cited evidence grade, never ranked, no amounts or timing, never "take this", never a claim that a supplement protects against, reverses or fixes a result. Every new line has to pass the banned-language suite and the support tests.

## The findings this comes from

An audit of the shipped code found:

1. `buildMarkerTrends` falls back to `REVIEW_MARKERS` (25 of 49 markers) and no caller passes a list. Sodium, potassium, calcium, magnesium and vitamin D have options whose reasons and records checks can therefore never fire.
2. 19 markers have no answer at all: wbc, platelets, igf-1, dhea-s, cortisol, psa, albumin, cystatin-c, insulin, tsh, free-t4, free-t3, ferritin, iron, vitamin-b12, zinc, lipase, hs-crp, ck.
3. The "supplements don't address" list only renders when at least one supplement is selected, so a member with flagged labs and an empty plan sees nothing.
4. Support areas come only from compounds (`supportAreasForBrief`), so labs alone never open an area.
5. Mood, thyroid, prostate and skin have no area note and no coverage row.
6. Option gaps: CoQ10, melatonin and multivitamin have no markers; TUDCA has no records check; magnesium, zinc and iron medication interactions are unchecked; berberine and CoQ10 cite only a homepage; custom supplements are missing from the clinician summary.

## Order of work

### 1. Every logged marker gets a trend (fixes the dead code)

- `buildMarkerTrends` takes the union of `REVIEW_MARKERS`, every marker the member has logged, every marker any support option names, and every burden marker.
- Callers (`member-support.ts`, `report.ts`) pass that union.
- **Test:** every marker named by an option has a trend; a logged marker outside `REVIEW_MARKERS` (for example magnesium) produces a reason and its records check.

### 2. Labs open support areas on their own

- Add `areasForLabs(labBrief)`: a marker that is outside its report range, carries a lab flag, or is on a clinician-review finding maps to the area its markers belong to.
- `buildSupportPlanReview` unions compound areas with lab areas, and the reason says which it came from ("Your latest ALT is outside the range on your report").
- **Test:** with no compounds and a flagged ALT, the liver options appear with a lab reason. With neither compounds nor labs, nothing is personalized.

### 3. An answer for every marker

- One `MARKER_ANSWER` map covering all 49 markers, each with:
  - the area it belongs to
  - whether any option names it
  - an explicit line when none does, in the existing voice: "No supplement has been shown to change X. Results outside your range belong with your clinician."
- Surfaced wherever a marker is flagged: the Support Plan gaps list, the marker's Lab Response panel, and the area sheet.
- **Test:** every `MarkerKey` has an answer; the lines pass the banned-language and cause-word checks; no line names a library option.

### 4. The empty state answers too

- Render the "what supplements don't address" list whenever there is anything to say, selected supplements or not.
- With labs and no compounds, the Support Plan leads with the flagged results and their answers.
- **Test:** a flagged hematocrit with an empty plan shows "No supplement lowers them".

### 5. Missing areas

- Area notes and coverage rows for mood, thyroid, prostate and skin, each stating plainly that Reserve has no reviewed supplement evidence for it and that it belongs with a clinician.
- A compound's sleep burden opens the sleep area (today `supportAreasForBrief` emits only RiskSystems).

### 6. Option completeness

- Markers for CoQ10, melatonin and multivitamin, or an explicit "no marker shows this on a lab report".
- A records check for TUDCA.
- Medication checks for magnesium, zinc and iron interactions already in their risk profiles.
- Replace homepage-only citations for berberine and CoQ10 with specific cited pages.
- Show each supplement's red flags in the library detail.
- Custom supplements appear in the clinician summary, with their "entered by you, no evidence grade" lines.

### 7. Validation

- Full unit suite, lint, build.
- Phone rehearsal of the Support Stack with labs but no compounds, and with both.
- Regression e2e.
- Docs: amendment note that support areas can now come from labs, and a counsel question about lab-driven support options.
