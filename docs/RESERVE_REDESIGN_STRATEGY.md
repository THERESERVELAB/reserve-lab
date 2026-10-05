# RESERVE REDESIGN STRATEGY

Screen-by-screen application of `docs/RESERVE_DESIGN_BIBLE_V2_PROPOSAL.md` (Sections
16–21) to the six audited surfaces, grounded in `docs/RESERVE_UI_AUDIT.md` findings.
**No implementation in this document — strategy only**, per the standing instruction for
this phase. Each screen entry states: what the redesign keeps, what it removes, the
target information architecture, and which Firefly assets it draws from.

**What never changes:** every engine (`apex/engine.ts`, `recovery/engine.ts`,
`physique/engine.ts`, `ai-strategist/engine.ts`, the daily-context/protocol/training
engines, and the new Reserve Athlete Intelligence layer) is untouched by this strategy.
This is a presentation-layer redesign. Every number, decision, and piece of intelligence
currently computed stays computed exactly the same way — it just stops being rendered
six different times in six different boxes.

---

## APEX COMMAND

**Hero archetype:** Statement Hero (Section 16). **Colors:** Gold dominant / Steel
accent (Section 18). **Current:** 33 Tier-1 surfaces. **Target:** ≤8.

### Keep
The hero statement engine (`readinessStatement`, `buildApexHero`) — its logic and
copy-selection are sound, only its *container* changes. The Performance Core concept.
Active Protocol strip. Next Move as the single highest-ROI panel.

### Remove or merge (audit-grounded)
- **Split Command merges into the hero** as its supporting-visual layer, not a second
  Tier-1 panel — focus/objective/limiter become small inline facts under the
  Performance Core, never restated.
- **Smart Brief and Next Move merge into one panel.** They currently say the same six
  things (Mission/Limiter/Protect/Avoid/ROI) in two places (audit finding #4). One
  panel: the ROI action leads, the rest are its supporting "why."
- **"4X RESERVE METHOD" demotes** from a second hero-weight line to a whisper-weight tag
  inside the Statement Hero's supporting-visual area (Section 16 anatomy rule #3).
- **Daily Command Board's Evening Closeout becomes a sibling panel**, not a 4th nested
  box (audit finding #2) — via `TierGroup`, not a new border.
- **System Status drops the bento-tile treatment** for a single-row status strip (Tier 2
  groups, no individual tile borders) — 8 systems as one glanceable line, not 8 boxes.
- **Auto AI Review's 3 nested review-cards flatten** into one panel with three `TierGroup`
  rows instead of three bordered sub-cards.
- **Watch List and Evidence Needed split** into their correctly-distinct Bible layers
  (Risk = Layer 4, Evidence = Layer 5) instead of sharing one amber-tinted panel.

### Target section order (replaces the current locked V1 §13 order, which the audit
shows is violated by duplication anyway)
Statement Hero (incl. Performance Core + split identity as supporting facts) → Next
Move (absorbs Smart Brief) → Active Protocol strip → 7-Day rail → Daily Command Board
(4 lanes as siblings, Evening Closeout included) → Reserve Intelligence (the new coach
decision module, once it ships to Apex) → System Status (one strip) → Risk (Watch List)
→ Evidence Needed → Member Update Center.

### Firefly assets used
`reserve-gradient-gold-steel-v1`, `apex-core-orb-gold-v2`, `apex-bg-command-center-gold-v1`,
`reserve-particles-ember-gold-v1`.

---

## TRAINING COMMAND

**Hero archetype:** Cockpit Hero (Section 16). **Colors:** Gold dominant / Steel accent.
**Current:** 11,308 lines, 53 Tier-1 surfaces, five session states as nested ternaries.

### Prerequisite (engineering, before visual work)
Training is the one screen where the audit finding is structural, not just visual: the
five lifecycle states (idle/Pre-Session/Primer/Live/Post-Session) must split into
separate gated components with one thin orchestrator (~300 lines) before any redesign
can land cleanly — redesigning inside an 11,000-line ternary tree is how the current
state accumulated. This is a refactor-first, restyle-second screen. The refactor
preserves 100% of existing logic (the 147 helpers move with their consuming component,
none are rewritten); only the file boundaries change.

### Keep
The gated lifecycle concept itself (Pre-Session → Mobility Primer → Live → Post-Session)
is correct and matches V1 §02's intended "armed cockpit" arc — it's the flat
implementation that broke it, not the concept.

### Remove or merge
- **Idle state's 16 stacked sections** collapse to the Cockpit Hero (HUD strip) plus a
  ≤6-surface budget: Today's session, Session mode selector (promoted from 16-deep to
  directly under the hero — audit finding #8), Intensity/phase context, and a single
  "Prepare" CTA. Architecture/calendar/rationale/profile detail move behind a
  `DrawerSheet`.
- **ConditioningReservePanel and RecoveryChamberPanel merge** into one panel with two
  `TierGroup` halves — they currently answer the same question twice in ~200 lines
  (audit finding #4).
- **Enhancement Stack's 4-level nesting flattens** to Tier 1 (panel) → Tier 2
  (per-window group) → Tier 3 (the entry itself) — no more `rounded-2xl` inside
  `rounded-xl` inside `rounded-md`.
- **SessionLine/DebriefLine/MetricCard/StatCard consolidate into one component**
  (`ReserveMetricCluster`'s `rows` variant, per the V2 catalog) so metric display is
  visually identical everywhere in this screen.
- **Post-session's 3 retrospective cards merge into one Post-Session Debrief** panel
  with `TierGroup` sections (Handoff facts / Completion summary / Notes), not three
  separate GlassPanels.

### Target per-state structure (each state is now visually distinct, per Bible V2
Section 19 "scene change, not card swap")
- **Idle:** Cockpit Hero + session prep (≤6 surfaces).
- **Pre-Session:** Hero shifts to a readiness-check framing; mobility primer becomes the
  dominant element.
- **Live:** Environment tightens (Section 19 rule #2 — spotlight, darker edges); HUD
  strip becomes the persistent header; set-logging is the only Tier-1 surface in view at
  a time.
- **Post-Session:** Environment cools toward Recovery's palette as a preview of the
  handoff; one Debrief panel, one CTA into Recovery.

### Firefly assets used
`training-bg-performance-lab-steel-v1`, `training-core-hud-gold-v1`,
`reserve-texture-carbon-dark-v1`.

---

## NUTRITION

**Hero archetype:** Kitchen Hero (Section 16). **Colors:** Green dominant / Gold accent.
**Current:** 4 files, 4 different macro-display treatments, settings mid-scroll.

### Keep
The fuel-plan engine, meal-swap/config engines, and the grocery/prep data model are all
sound — the redesign only touches how the daily plan and its 6-8 meals are *presented*.

### Remove or merge
- **Macros consolidate to one display** (the Kitchen Hero's single ring/bar, per Section
  16) — the 4-treatment duplication (audit finding #1) collapses to one authoritative
  macro read; every other surface that needs a macro number links to it instead of
  re-rendering it.
- **NutritionAlignmentCard and the Fuel Command hero merge** — two hero-weight panels
  above the fold (audit finding #3) become one: the Kitchen Hero itself carries both the
  day's macro-alignment framing and the "what's cooking now" plate visual.
- **Weekly Fuel Plan's nested cards flatten** to `TierGroup` rows inside one panel
  (audit finding #2).
- **Diet Style + Meal Personalization moves entirely behind a `DrawerSheet`** ("Fuel
  Preferences") — 250 lines of settings no longer live mid-scroll (audit finding #7).
- **Signature Meals library moves behind a drawer** ("Saved Meals") rather than a
  mid-scroll grid (audit finding #10).
- **Grocery Command consolidates to one implementation** — NutritionView's 5-tab version
  is canonical; PrepCommandPanel's checklist becomes a view *into* the same data, not a
  second grocery surface (audit finding #6).
- **Meal cards drop to one CTA weight**: Log is primary; Swap/Configure/Save demote to a
  secondary row or an overflow affordance, not three equal buttons.
- **Macro Rescue moves up** to sit directly under the hero as a conditional Next-Move-style
  panel (only rendering when actually behind pace), not buried after 6-8 meal cards
  (audit finding #9).

### Target section order
Kitchen Hero (macro ring + current/next meal) → Macro Rescue (conditional) → Today's
meal timeline (Log-primary cards) → Weekly Fuel Plan (flattened) → Grocery Command → Fuel
Preferences drawer + Saved Meals drawer (Layer 6, reachable not leading).

### Firefly assets used
`reserve-gradient-green-gold-v1`, `nutrition-core-plate-green-v1`,
`nutrition-bg-kitchen-green-v1`.

---

## RECOVERY

**Hero archetype:** Dial Hero (Section 16) — the only screen keeping this shape.
**Colors:** Steel dominant / Violet accent — **no green, no amber-as-default** (the
audit's single worst color-discipline violation). **Current:** 18+ surfaces on the
screen meant to feel the calmest.

### Keep
The Reserve dial itself, the recovery-reserve computation, and the Recovery Suite
recommendation logic — all sound. The dial *is* the correct hero shape here; it just
needs to stop sharing visual space with an equally-weighted text card beside it.

### Remove or merge
- **Add the missing hero statement** (audit finding #10 — Recovery is the one screen
  with no `.type-hero` line at all). A state-derived line ("PROTECT RECOVERY" /
  "RESTORE THE SYSTEM") anchors the screen the way Apex's hero does.
- **Next Best Action moves to a supporting position beneath the dial**, not beside it at
  equal weight (audit finding #2).
- **Full palette (gold/green/amber/violet) reduces to steel+violet only**, with
  amber/red reserved strictly for genuine debt/compromise signal states (Section 18
  table) — this single change fixes 5+ audit findings at once.
- **Recovery Decision Engine's 6-tile mini-dashboard flattens** to a single `TierGroup`
  summary beneath the hero, not a competing panel with its own glow and animated numeral
  (audit finding #5).
- **Radar chart + waveform chart consolidate to one, simplified.** Two dense multi-axis
  SVGs (audit finding #6) contradict "restful" on sight — pick the single most-useful
  trend visual (recommend the waveform, since it maps directly to the sleep/hydration
  story) and drop the radar, or fold both into one collapsed "Trends" drawer.
- **Sleep chart drops the dual-axis analytics treatment** for a simpler single-metric
  trend line (audit finding #7) — this is a regeneration suite, not a lab report.
- **"Strain" retires from vocabulary** on this screen entirely (audit finding #8) —
  replaced with Recovery-appropriate language ("Recovery Load" at most, never "Strain").
- **QuickRecoveryBar drops to 2 actions max** (audit finding #9) — the primary log
  action plus one secondary, not four competing options.
- **Motion drops to breath-band only** (audit finding #4) — no pulse-band tempo
  anywhere on this screen, full stop.
- **Post-training copy shifts from directive to permissive** tone (audit finding #14) —
  "Sleep is your mission asset tonight," not a checklist of protective actions.

### Target section order
Dial Hero (reserve numeral + state-derived hero line) → Next Best Action (subordinate,
beneath) → Recovery Suite recommendation (one flattened summary) → single trend visual →
Sleep/Hydration/Mobility/Stress as one `ReserveMetricCluster` row, not four separate
tiles → Log action (max 2 buttons).

### Firefly assets used
`reserve-gradient-steel-violet-v1`, `recovery-core-dial-steel-v1`,
`recovery-bg-suite-violet-v1`, `reserve-particles-dust-steel-v1`.

---

## PHYSIQUE

**Hero archetype:** Studio Hero (Section 16). **Colors:** Steel dominant / Ivory accent
— **no red, no evaluative color-coding** (Physique is documentation, not alert-driven,
V1 §02). **Current:** two full cockpits stacked, judgmental copy throughout.

### Keep
The momentum/trend engine (`buildPhysiqueGuidance`), the check-in cadence system, and
the weak-point selection model — all sound. The redesign's real work here is as much
**copy** as layout (this screen has the most compliance-adjacent tone problems in the
audit, not just visual ones).

### Remove or merge
- **Add the missing hero statement** (audit finding #1) — currently jumps straight to
  metrics with zero framing.
- **Collapse the two cockpits into one.** `PhysiqueCommandV2` and `DigitalAthletePanel`
  are two competing dashboards (audit finding #9) — merge into the single Studio Hero +
  one supporting panel structure.
- **Every evaluative label neutralizes** (audit findings #2, #3, #4, #7, #8 — the
  largest concentration of tone violations in the whole audit): "Lagging" only appears
  when it is literally the member's own weak-point selection, never system-asserted;
  "Symmetry Concerns" becomes neutral observation ("Variance noted — right/left"); the
  red "Priority Alert" treatment on lagging zones is removed entirely — Physique gets no
  signal-color alerts, only steel/ivory observation; "Stage-ready" and the "+8–12
  points" outcome-quantification language are removed and replaced with "derived" /
  "projected" framing per V1 §04's hard compliance wall.
- **BF% and all projections get explicit "est." / "derived" labels** (audit findings #6,
  #11) — every numeral on this screen must carry honest provenance per V1 §01's "honesty
  is premium" principle.
- **Five-panel grid flattens** to Studio Hero (photo-led) + one vertical stat rail
  (Section 16 anatomy) instead of five bordered boxes (audit finding #5).
- **8-tile uniform stat grid gets hierarchy** (audit finding #10) — one dominant
  momentum statement, everything else demotes to Tier 2/3.

### Target section order
Studio Hero (evidence photo/frame + momentum statement, honestly labeled) → weak-point
focus (member-selected only, neutral language) → check-in cadence + next action → trend
rail (bodyweight/waist, each "est."/"derived" as appropriate) → photo consistency +
history (Layer 6, drawer).

### Firefly assets used
`reserve-gradient-steel-ivory-v1`, `physique-core-frame-ivory-v1`,
`physique-bg-studio-ivory-v1`.

---

## SCHEDULE

**Hero archetype:** Timeline Hero (Section 16). **Colors:** Gold dominant / Slate
accent. **Current:** the smallest file, still vocabulary- and nesting-violating; closest
to Bible-compliant already.

### Keep
Almost everything computationally — the schedule-recovery engine, meal-window mapping,
and sleep-conflict detection are all fine. This is the lowest-effort redesign of the
six.

### Remove or merge
- **"Schedule Command" whisper corrects to "Mission Timeline"** everywhere (audit
  finding #1) — a copy fix, not a structural one.
- **"Schedule Conflict" renames to "Sleep Compression"** consistently (audit finding
  #2), matching the term already used correctly elsewhere in the app.
- **`TodaysScheduleCard` stops nesting inside the page's own glass panel** (audit
  finding #3) — it either *is* the Timeline Hero's supporting visual, or it's removed
  from this screen entirely since the screen would otherwise duplicate itself.
- **Operating Times + Cadence editors move behind a `DrawerSheet`** ("Edit Schedule")
  (audit finding #6) — configuration follows intelligence, per V1 §11's layer order,
  instead of leading it.
- **Recovery Window panel's full-red/amber tint scales with actual severity** (audit
  finding #7) — mild compression gets the screen's own gold/slate pair, not a signal
  color.
- **"Next Scheduled Action" shortens to "Next Move"** (audit finding #8), matching the
  vocabulary used everywhere else in the app.
- **The four flat stat chips get one promoted to a `JewelryNumeral`** (audit finding #5)
  — likely the sleep target or current window countdown, as the screen's one dominant
  metric.

### Target section order
Timeline Hero (horizon-line spine, live now-marker, one promoted numeral) → Next Move →
the timeline itself (full day) → Recovery Window (severity-scaled) → Edit Schedule
drawer (times, cadence, meal windows — all Layer 6 together).

### Firefly assets used
`reserve-gradient-gold-slate-v1`, `schedule-core-spine-gold-v1`.

---

## BATCH SEQUENCING RECOMMENDATION

1. **Batch 0 — Foundation.** Build the P0 Firefly assets (gradients, particles,
   textures, core objects) and the new component catalog primitives (`HeroShell`,
   `TierGroup`, `DrawerSheet`, `JewelryNumeral`, `ScreenColorProvider`) from Bible V2
   Section 21. Nothing screen-specific ships yet — this is shared infrastructure every
   subsequent batch depends on.
2. **Batch 1 — Recovery.** Smallest scope-to-impact ratio: mostly color and motion
   discipline plus one merged panel, no engine changes, and it's the audit's clearest
   single offender — a fast, visible proof the new system works.
3. **Batch 2 — Apex.** The highest-traffic screen (seen daily per V1 §13); validates the
   Statement Hero archetype and the merged-panel pattern at the app's most important
   surface.
4. **Batch 3 — Physique.** Tone/compliance fixes are urgent independent of visual
   polish; bundle them with the Studio Hero rebuild.
5. **Batch 4 — Nutrition.** Kitchen Hero + the drawer pattern (Preferences, Saved Meals)
   proven here transfers directly to Training's drawer needs next.
6. **Batch 5 — Schedule.** Lowest effort; mostly copy + one drawer + one promoted
   numeral.
7. **Batch 6 — Training.** Last, deliberately: it needs the engineering split
   (five gated components) as its own sub-phase before the Cockpit Hero and
   scene-change transitions (Section 19) can be applied, and every pattern it needs
   (drawers, tier groups, metric consolidation) will already be proven on five other
   screens by the time this batch starts.

Each batch ends at the same gate every other batch in this codebase already uses:
`npm run lint`, `npm run build`, and browser verification before being called done.
