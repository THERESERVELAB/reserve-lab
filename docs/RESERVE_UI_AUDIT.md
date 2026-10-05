# RESERVE UI AUDIT — 2026-07-02

Art Director pass across the six major command surfaces (Apex, Training, Nutrition,
Recovery, Physique, Schedule), scored against `DESIGN_BIBLE.md` V1 — the Bible the app
already claims to follow. This is a gap audit, not new doctrine: every finding cites the
Bible rule it breaks. Findings are grounded in direct code reads (file:line) and live
browser screenshots at desktop width, persona=advanced, Reserve Athlete Hybrid protocol.

This document is the input to the Design Bible V2 proposal and the redesign strategy —
it does not itself prescribe fixes beyond a one-line direction per cross-cutting pattern.

---

## THE FIVE CROSS-CUTTING PATTERNS

The six per-screen audits below are long. Read this section first — the same five
failures repeat on every screen, which means they are systemic, not per-screen bugs.

### 1. The "Command" template is one hero shape wearing six colors

Apex, Recovery, and Physique (and to a lesser extent Schedule) all open with the
identical composition: whisper label → hero title → a dial or numeral → a colored
statement → a 2×2 metrics grid → one CTA button. Screenshotted side by side, Recovery's
"84 · Strong" and Physique's "82 · Improving" are pixel-for-pixel the same layout with
the accent color swapped (green both times, incidentally). The Bible promises six
*emotionally distinct* environments (Section 02, Section 09) — mission control vs. dim
regeneration suite vs. evidence studio — but the component layer only has one hero
template, so "distinct atmosphere" currently means "different label, same box." This is
the single biggest reason the app reads as one SaaS dashboard reskinned six times
instead of six purpose-built environments.

### 2. Color has stopped meaning anything

Every audit independently flagged the same thing: gold, green, steel, violet, and amber
all appear in the same viewport, on every screen, including Recovery — the one screen
the Bible explicitly restricts to "steel → violet, lowest light in the product"
(Section 09). When every accent is present everywhere, no accent signals priority. The
Bible's own rule — "one dominant element per viewport-height" (Section 07) — is
structurally impossible while five competing hues fight for the eye in the same fold.

### 3. Box-in-box is the default, not the exception

Every single audit found nested `GlassPanel`/bordered-div stacks three or more levels
deep: Apex's Daily Command Board lanes, Recovery's Decision Engine sub-tiles, Nutrition's
Weekly Fuel Plan cards-inside-a-panel, Physique's five-panel grid, Schedule's
`TodaysScheduleCard` nested inside the page's own glass panel, Training's Enhancement
Stack (panel → grid → rounded-2xl → rounded-xl → rounded-md, four levels). The Bible's
"kill the box effect... maximum two visible surface levels" (Section 06) is the single
most-violated rule in the codebase.

### 4. Panels duplicate each other instead of composing

The same fact gets restated in a second card with a different name: Apex's Split Command
repeats the hero's focus/objective/limiter; Apex's Smart Brief repeats Next Move's
mission/limiter/protect; Nutrition shows the day's macros in four separate visual
treatments; Physique runs two full cockpits (`PhysiqueCommandV2` + `DigitalAthletePanel`)
stacked on one screen. This is the concrete mechanism behind "wall of cards" — it isn't
that there's too much *information*, it's that the same three or four facts get a new
card each time instead of one authoritative presentation.

### 5. Training is not one screen, it's five screens wearing a trenchcoat

At 11,308 lines and 53 `GlassPanel` instances, `TrainingView.tsx` is roughly 20× the
size of any other view in the audit. It already triggers a Babel 500KB bundle-size
warning during lint. The five session states (Pre-Session, Mobility Primer, Live,
Post-Session, plus the idle dashboard) are nested ternaries inside one component instead
of gated, visually distinct environments. This is both a design problem (no
environment-to-environment feel change, per Section 09) and an engineering-health
problem worth flagging even though this pass is design-first.

---

## APEX COMMAND

**File:** `src/components/apex/ApexCommandV2.tsx` (2,159 lines, 33 `GlassPanel`
instances). **Verdict: reads as a wall of 33 cards, not one mission control.**

| # | Finding | Location | Bible rule broken |
|---|---|---|---|
| 1 | Split Command repeats the hero's focus/objective/limiter | ~1665–1696 | §13 locked order forbids duplication in one scroll |
| 2 | Evening Closeout nested as a 4th box inside a panel already holding 3 lane grids | ~1556–1634 | §06 max two surface levels |
| 3 | Hero / Next Move / Nutrition Signal / Performance Core run 4+ accent colors in one fold | ~1171–1499 | §07 one dominant element per viewport |
| 4 | Smart Brief restates Next Move's Mission/Limiter/Protect/Avoid almost verbatim | ~1107–1129, 1701–1733 | §13 no duplication |
| 5 | Panel padding varies (p-5/p-6/p-7) with no visible hierarchy logic | throughout | §07 rhythm implies hierarchy, not arbitrary |
| 6 | Auto AI Review nests 3 mini review-cards inside one panel | 1843–1893 | §06 box-in-box |
| 7 | Enhanced Member Command offers 3 competing CTA destinations from one section | 1970–1995 | §11 one primary action per screen |
| 8 | System Status renders as a hard-bordered bento tile farm | 2003–2063 | §06 liquid over rigid, forbids heavy borders |
| 9 | Watch List conflates risk signals and actionable evidence under one accent | 2067–2114 | §11 Risk (Layer 4) and Supporting Intelligence (Layer 5) are distinct layers |
| 10 | Hero section alone carries 4 stacked text treatments (whisper/hero/command/derived line) | 1212–1217 | §03 max 3 font sizes per card |
| 11 | Nutrition Alignment Card repeats fuel intent already stated in the Nutrition Signal strip | ~1502 | §13 no duplication |

Live screenshot confirms: the hero fold alone contains whisper → "READY FOR HIGH
OUTPUT" hero → command line → "Projected Session Quality" derived line → a second
hero-weight statement ("4X RESERVE METHOD") → "Today's Directive" → "Objective" → 3
badges → a live status line → 4 metric tiles → a CTA → the 3D orb, all before any
scrolling. That is two hero-weight statements and roughly nine distinct text blocks in
one fold, directly contradicting "exactly one hero statement per screen" (§03).

---

## TRAINING COMMAND

**File:** `src/components/views/TrainingView.tsx` (11,308 lines, 147 helper functions,
53 `GlassPanel` instances). **Verdict: a long scrolling form with accumulated features,
not an armed performance cockpit.**

| # | Finding | Location | Bible rule broken |
|---|---|---|---|
| 1 | Idle state alone renders 16 top-level sections in one scroll | 11168–11248 | §07 one dominant element per viewport |
| 2 | Enhancement Stack nests panel → grid → rounded-2xl → rounded-xl → rounded-md (4 levels) | 8113–8249 | §06 max two surface levels |
| 3 | "Today's X" framing repeats 20+ times with no new information each time | scattered | vocabulary/duplication discipline |
| 4 | ConditioningReservePanel and RecoveryChamberPanel answer the same question twice in ~200 lines | 9177–9370 | §07 remove blocks before shrinking them |
| 5 | Pre/Primer/Launch/Live/Post are nested ternaries, not gated environments | 11022–11248 | §09 distinct environment per destination |
| 6 | 53 GlassPanel instances total; several sections stack 3+ panel layers | scattered | §06 GlassPanel is the only primitive, 2-level max |
| 7 | Four interchangeable metric-chip components (SessionLine/DebriefLine/MetricCard/StatCard) render the same label+value pattern differently across sections | 44 instances | §03 max 3 font sizes/patterns per card |
| 8 | Session-mode selector (9 modes) buried 16 components deep with no leading CTA | ~11206 | §11 decisions belong in Layer 3, not Layer 6 depth |
| 9 | Post-session alone runs 3 separate retrospective cards (Handoff, Completion Review, Debrief) | 11033–11060 | §07 "status without a move is noise" |
| 10 | File triggers a Babel 500KB bundle-size warning at lint time | build output | engineering-health flag, not a Bible rule, but relevant to any redesign batch plan |

---

## NUTRITION

**Files:** `NutritionView.tsx` (1,423 lines) + `FuelCommandPanel.tsx` (798) +
`PrepCommandPanel.tsx` (282) + `NutritionAlignmentCard.tsx` (110). **Verdict: a
settings-heavy tracker stitched into one scroll, not a warm "fuel is handled" strategy
surface.**

| # | Finding | Location | Bible rule broken |
|---|---|---|---|
| 1 | Macros shown in 4 different visual treatments across the same screen | multiple | §11 one primary metric, not a chorus |
| 2 | Weekly Fuel Plan nests bordered cards inside a `noPad` GlassPanel | FuelCommandPanel 646–662 | §06 box-in-box |
| 3 | NutritionAlignmentCard and the Fuel Command hero both sit above the fold at hero weight | 356–402 | §07/§11 one hero per screen |
| 4 | Warm hearth (green+gold) target undercut by role-based color coding (gold=CTA, green=logged, steel=secondary, violet=favorites) | throughout | §09 warm hearth glow, green+gold dominant |
| 5 | Weekly Fuel Plan and Meal Prep Guidance both present "what to eat this week" with no stated ordering | Fuel 643 vs Prep 220–273 | §11 layers may not reorder/duplicate |
| 6 | Full Grocery Command (5 tabs) exists in NutritionView; a second, simpler grocery checklist exists in PrepCommandPanel | View 778–870 vs Prep 152–217 | one source of truth |
| 7 | Diet Style + Meal Personalization (allergies/proteins/carbs/equipment/budget) sit mid-scroll as a major section, not a settings drawer | 514–772 | §11 settings are Layer 6, "reachable, never leading" |
| 8 | Meal cards repeat in both FuelCommandPanel and NutritionView's own MealCard grid | Fuel 496–610 vs View 439–448 | duplication |
| 9 | Macro Rescue only appears after 6-8 meal cards, too late to act as the "highest ROI" panel it functionally is | 502–508 | §11 Layer 3 should rank near the top |
| 10 | Signature Meals library renders as a full mid-scroll grid rather than a reachable drawer | 453–500 | §11 Layer 6 |

Live screenshot corroborates: a single meal card carries a header, 4-line ingredient
list, a 4-cell macro box grid (itself boxes inside the card), a Smart Read box, a prep
tag row, and three roughly-equal-weight buttons (Log / Swap / Configure / Save) — one
card, six visually competing sub-elements.

---

## RECOVERY

**Files:** `RecoveryView.tsx` (844 lines) + `RecoveryCommandV2` + `MobilityCommand.tsx`.
**Verdict: the busiest screen in the app is supposed to be the calmest one.**

| # | Finding | Location | Bible rule broken |
|---|---|---|---|
| 1 | 18+ distinct card sections across the full scroll | throughout | §07 one dominant element per viewport |
| 2 | Reserve dial competes for weight with a full-text "Next Best Action" card beside it | RecoveryCommandV2 161–184 | §11 Layer 1/2 should be uncontested |
| 3 | Full palette in use (gold/green/steel/violet/amber/red) on the one screen mandated steel→violet | throughout | §09 explicit exception, most violated |
| 4 | Pulse-band (3.6s) motion on metric tiles; Bible reserves pulse for live signals, Recovery gets breath-band only | RecoveryView 95–96 | §08 tempo bands |
| 5 | Recovery Decision Engine panel is a 6-tile mini-dashboard with its own glow and animated numeral | RecoveryView 432–540 | §06/§11 competes with the primary metric |
| 6 | Radar chart + waveform chart, both dense multi-axis SVGs, sit side by side | 654–698 | §06 box-in-box (chart inside panel), tone mismatch with "restful" |
| 7 | Sleep chart uses a dual-axis analytics ComposedChart with legend and threshold lines | 723–762 | §06 "forbid table borders," rigid not liquid |
| 8 | "Recovery Strain Radar" uses "Strain," a training/stress word, on the one screen meant to feel like protection | 662 | §04/§05 vocabulary + tone |
| 9 | QuickRecoveryBar offers 4 competing logging actions at once | 545–600 | §07 remove blocks before shrinking |
| 10 | No `.type-hero` statement anchors the screen at all — Apex has one, Recovery doesn't | 604–620 | §11 Layer 1 is mandatory |
| 11 | Sleep stat tiles nest 3 boxes inside one panel | RecoveryCommandV2 215–223 | §06 |
| 12 | Recovery score (91) is buried as a small label inside a radar chart instead of a jewelry numeral | RecoveryView 240–248 | §03 numbers outrank words |
| 13 | Post-training copy reads as directive checklist ("Protect sleep window") rather than permission ("Sleep is your mission asset") | RecoveryCommandV2 308–326 | §02 leaving feeling should be "permission to restore" |

Live screenshot corroborates directly: the hero fold alone shows a green dial, a gold
CTA, a violet "momentum" tag, then four tiles in steel/violet/green/amber — five hues in
one screenshot on the screen the Bible says should have the least light in the product.

---

## PHYSIQUE

**Files:** `PhysiqueView.tsx` (570 lines) wrapping `PhysiqueCommandV2` (476 lines) plus a
`DigitalAthletePanel`. **Verdict: a cluttered tracker with a judgmental voice, not a
calm evidence studio.**

| # | Finding | Location | Bible rule broken |
|---|---|---|---|
| 1 | No hero statement — jumps straight into the cockpit/metrics | ~292 | §11 Layer 1 mandatory |
| 2 | "Lagging" applied as a hard-coded fact (e.g. hamstrings) rather than the member's own selection | 32–40, ~19 occurrences | §02 zero evaluative language about the body |
| 3 | "Symmetry Concerns" rendered as a red alert box | ~262 | §02 documentation, never judgment |
| 4 | "Lagging Zone Detected" gets a red "Priority Alert · Action Required" treatment | ~447 | §02 no fear/urgency theatrics |
| 5 | Five-panel grid (avatar/symmetry/BF trend/recovery zones/breakdown) nests borders throughout | 305–410 | §06 box-in-box |
| 6 | BF% trend shown without "est."/"derived" labeling | 383–409 | §04 honest provenance |
| 7 | "Stage-ready window in 10–12 weeks" — evaluative language about aesthetic readiness | ~558 | §02, §04 |
| 8 | "...could improve overall symmetry by an estimated +8–12 points" — quantified outcome promise | ~467 | §04 forbidden: outcome guarantees |
| 9 | Two full cockpits stacked on one screen (`PhysiqueCommandV2` + `DigitalAthletePanel`) | 148–170 | §06 "no second dashboard inside it" |
| 10 | 8-tile stats grid with uniform weight, no hierarchy | 362–378 | §07 rhythm implies hierarchy |
| 11 | 12-Week Physique Outlook presents three projections as near-certainties with no "projected" framing | 554–563 | §04 |

Live screenshot shows Physique's hero fold is structurally identical to Recovery's:
green dial ("82 · Improving") → green CTA → 2×2 stat tiles — confirming Cross-Cutting
Pattern #1 (the templated Command hero) rather than the "Studio, neutral light"
atmosphere the Bible specifies for this screen.

---

## SCHEDULE

**Files:** `ScheduleCommandView.tsx` (297 lines) + `TodaysScheduleCard.tsx` (reused
across 4 other screens). **Verdict: operationally sound but the smallest file still
manages to violate vocabulary and nesting rules; structurally more a control panel than
a briefing.**

| # | Finding | Location | Bible rule broken |
|---|---|---|---|
| 1 | Whisper chip literally reads "Schedule Command" while the Bible mandates "Mission Timeline" | ~110 | §04 locked label conversion |
| 2 | "Schedule Conflict" is not in the approved vocabulary; "Sleep Compression" is | ~69, TodaysScheduleCard 128 | §04 |
| 3 | `TodaysScheduleCard` (its own GlassPanel) nests inside the page's outer glass flow | ~278 | §06 max two surface levels |
| 4 | Eight sections with ~1rem gaps and no breathing room between hero, dual-column editors, and timeline | throughout | §07 one dominant element per viewport |
| 5 | Four equally-weighted stat chips with no jewelry numeral | 118–125 | §03 numbers outrank words, but none is elevated |
| 6 | Full inline editors (6 time/dropdown inputs + 4 cadence cards) sit above the fold | 152–191 | §11 configuration is Layer 6, should follow intelligence |
| 7 | Recovery Window panel tints fully red/amber even for mild compression | 254–274 | §02 no urgency theatrics |
| 8 | "Next Scheduled Action" is verbose vs. the established "Next Move" vocabulary | ~137 | §04/§05 quiet authority, 2-4 word whispers |
| 9 | "Execution Window" (approved vocabulary) exists but isn't used for the training time block | 94–99 | §04 vocabulary is a brand moat, underused |

---

## WHAT THIS MEANS FOR THE NEXT PHASE

The six screens don't need six different fixes — they need one systemic fix applied six
times: **a real hero-composition system** (so Apex/Recovery/Physique/Schedule stop
sharing one dial-hero template), **a hard color-per-screen discipline** (one dominant
hue + one accent, not five), **an enforced two-surface-level cap** (GlassPanel content
groups by spacing/light, never a second bordered box), and **a duplication check per
screen** (every fact appears in exactly one authoritative place). Training additionally
needs to be split into gated environment components before any visual redesign can land
cleanly — redesigning inside an 11,000-line ternary tree is how the current mess formed
in the first place.

These four fixes are exactly what the Design Bible V2 proposal formalizes next.
