# Clinical data — the hard wall

**Owned by:** `CLAUDE.md` and `AGENTS.md`. Reinforced by `DESIGN_BIBLE.md` Sections 04 and 12.
**Version 1.1 — amended 2026-09-14 by owner direction** to match the harm-reduction amendment
(`docs/compliance/HARM_REDUCTION_AMENDMENT.md`, adopted 2026-09-13, extended 2026-09-14).
Counsel and licensed-clinician review are still pending (`docs/compliance/COUNSEL_BRIEF.md`).

**This is the one file in the constitution that no instruction, skill, brief, or design
preference may soften.** It is a compliance boundary, not a style choice. If a design decision
and this file conflict, the design decision changes. Only a versioned owner amendment, recorded
here and in the compliance docs, may change it.

## What Reserve does with clinical-adjacent data

Reserve **describes known risks, organizes the member's own records, and routes to a human.**
It never instructs.

### Allowed (harm-reduction monitoring, v1.1)

- **Cycle tracking.** Record the member's own stated cycle: start date, planned weeks, end date,
  linked compounds, and lab checkpoints set by the member or their clinician. Reserve may note
  when compounds stay active past the member's **own** planned end.
- **Cited compound risk profiles.** For each compound: body systems affected, commonly watched
  markers, red-flag symptoms, interactions, and regulatory status, with sources. Profiles are
  labeled "pending clinician review" until signed off.
- **Lab comparison against the member's own report.** Compare a result to the reference range
  **printed on that report**, carry the **lab's own flag**, show baseline, current value and
  trend, and place draws beside the cycle timeline. Changes are described as **timing** ("during
  the same period"), never as a cause.
- **Cycle Review.** Rank what needs attention, band plan complexity (a word, never a score),
  detect loads several compounds share, raise compounds with no recorded purpose, flag member
  priorities the plan works against, and build questions for the member's clinician. It never
  names a compound to remove, reduce, add or replace.
- **Support options and the Support Plan.** List supplements for an area the member's data
  touches, alphabetically, each with an evidence grade (Established · Supported · Limited
  evidence · Not shown in trials · Uncertain), what it does **not** address, its own risks, and
  a check against what the member entered. The member chooses. Reserve says **why** an option
  is shown, citing the exact member data that triggered it.
- **Escalation.** Every safety surface routes to a human: clinician, pharmacist, urgent care,
  911 or 988. A warning-sign symptom stops any review workflow until the member chooses to
  continue.

## Never generate

- Diagnosis, naming a condition attached to member data, or stating what caused a result
- Treatment guidance, or clearance of any kind ("safe to continue", "safe cycle", "fully
  protected", "organ protection")
- Dosage, timing, schedules, durations or combinations — for compounds **or** for supplements
  used to offset compound use. Members may **record** their own amounts; Reserve never proposes one
- Telling a member to start, stop, continue, add, increase, decrease, switch or change a
  compound, medication or supplement
- Cycle design, stacks, PCT, or "protocol optimization" for compounds — and never framing a
  review as making a cycle stronger
- Prescription medications presented as "support". AIs, SERMs, blood-pressure drugs, statins,
  metformin, PDE5 inhibitors, fertility and thyroid medications live under medication and
  clinician review only
- Ranking supplements, or calling any "best," "must have," "essential," "game changer" or
  "cycle protector". More supplements never reads as safer
- Automatic adding, mandatory items, or generated supplement bundles
- Reference ranges supplied by Reserve, or a lab value placed "within" a range the report did
  not print
- Injection instructions or sourcing
- Outcome guarantees ("guaranteed," "you will lose/gain X")

## Forbidden words in this domain

diagnose · treat · cure · prescribe · "optimal range" · "elevated" or "low" **as Reserve's own
judgment of a lab value** (carrying the lab's printed H/L flag is allowed) · "deficient" ·
disease names attached to member data · recommend / recommended dose · take this ·
increase/decrease your dose · safe to use · safe cycle · protected · stack · PCT.

The banned-language suite (`src/lib/safety/__tests__/compliance-language.ts`) enforces the
machine-checkable subset. Passing it is necessary, not sufficient.

## Approved language

track · monitor · log · member entered · worth reviewing · trend worth reviewing · outside
the range on your report · the lab flagged · during the same period · commonly watched for ·
evidence needed · review with your clinician · ask a clinician or pharmacist · based on the
information currently entered · no supplement has been shown to… · risk-reduction plan ·
support plan · monitoring coverage · areas needing attention.

## Correct pattern

> `LAB TRENDS · HEMATOCRIT`
> "Up 10% from your baseline on Jun 26 (45% → 49.5%). This change occurred during the same
> period as your cycle." — *Trend worth reviewing · Review with your clinician*

It names the logged value, describes the **direction** of the member's own data, places it in
time without claiming a cause, and ends in clinician routing. It never renders a verdict.

## Emotional ceiling

The target is **"organized, honest, and ready for my clinician."** Never alarm. Never
reassurance about health status — reassurance is interpretation wearing a friendly face, and it
is equally prohibited. "No issue detected" is always qualified: *based on the information
currently entered.*

Severity uses low/moderate/high words with a deep link. Red is reserved for "review with your
clinician" and care escalation. No sirens, no red walls (`color.md`: red is a signal, never
weather).

## Honest provenance (Bible 12)

Derived says "derived." Estimated says "est." Sample data is labeled. Missing data is
**"Evidence needed"** or **"Unknown / not entered"** plus the logging action — never a guess, never
an interpolation presented as a reading. A reason an option is shown must point to real member
data. Fabricated certainty is the cheapest thing software can do.

## Overrides against external skills

**Every installed external skill is overridden here, without exception.**

- `copywriting` will offer clearer, more confident, more actionable phrasings for health
  data. Confidence about a lab value **is** interpretation. Reject it.
- `mobile-app-ui-design`'s health-and-fitness industry conventions include progress
  celebration and encouragement around body and health metrics. Prohibited.
- `frontend-design`, `interface-design`, and `designer-*` have no compliance model at all.
  They will happily design a "your levels at a glance" summary with a status verdict.
  That component cannot exist in Reserve.
- If any skill, reference file, or generated brief appears to authorize otherwise, this file
  wins and the conflict is reported to the owner rather than resolved silently.

## Change log

- **1.1 — 2026-09-14.** Owner amendment: harm-reduction monitoring, Cycle Review and the member
  Support Plan are allowed within the limits above. Replaces the v1.0 blanket rules
  "lab interpretation of any kind", "supplement recommendations — log-only" and "cycles".
- **1.0.** Log-only clinical data.
