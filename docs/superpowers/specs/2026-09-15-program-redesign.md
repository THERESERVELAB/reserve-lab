# Program Redesign — every tab to the Reserve room standard (owner-directed 2026-09-15)

**Owner brief:** "Work on the other tabs as well — Apex won't be enough. We need a full redesign across the entire program."

**What already shipped** (the reference implementation):
- Five living rooms: Apex, Training, Nutrition, Recovery, Schedule.
- The Threshold sign-in.
- The phone shell (#17) and phone rooms (#18): document scroll, tab bar, More sheet, one headline, flush sections, shared `ReserveHorizon`.
- Honesty passes #10 and #13.

## Screen types

Every screen is one of these five types:

| Type | Screens | Job |
|---|---|---|
| **Room** | Apex, Training, Nutrition, Recovery, Schedule | Run today (shipped) |
| **Plan** | Personal/Protocol Command, Program Horizon, Build Studio, Mesocycle Planner | Set and see the plan |
| **Intelligence** | Response Model, AI Strategist, Performance Intelligence, Physique Intelligence, Biomarker Intelligence, Peak Physique | Read what the evidence shows, honestly |
| **Record** | Bloodwork, Measurements, Progress Photos, Physique, Journal, Enhanced Monitor, Compound/Supplement Logbook | Log and review the member's own entries |
| **Utility** | Settings, My Coach, Community, Education, Women's views, Coach workspace | Account, people, learning, specialised tracks |

## The screen recipe (all types)

1. **Header.** Use `ReserveCommandHeader` (with `phone="title"`): eyebrow, one h1 (the screen name), and a one-line purpose. There is exactly one h1 per page.
2. **Hero** (inside the first screen at 1440×1000 and 390×844):
   - One plain-language statement of the member's current state on this screen. It must be honest; with no data, say what is missing.
   - Two or three real readouts, or "Evidence needed".
   - **Exactly one gold primary action** (`ReserveButton` primary) that does the real next thing: log X, set the plan, open the review. Every other action is secondary or tertiary.
   - Locked screens keep `LockedPremiumModule` as it is.
3. **Sections.**
   - `GlassPanel` with `phone="flush"`, and a `ReserveSectionHeader` per section.
   - **No card-in-card at any width.** Bordered tiles inside a panel become rows, hairline-separated groups or plain grids.
   - At most two surface levels: environment plus one glass layer (constitution `components.md` rules 1 and 4).
4. **Record screens.**
   - Show the newest entry first, then a dated list or timeline of the member's own entries.
   - Trends only between real entries.
   - The empty state offers the real log action.
5. **Intelligence screens.**
   - An evidence status (how many entries and over what span) comes before any finding.
   - Findings only from real data. No projections, no forecasts of body change, no scores the member didn't earn.
6. **Type and touch.**
   - Use the `.type-*` ramp only.
   - **The 11px floor applies to the horizon strip only** (DESIGN_BIBLE §13). Everywhere else the ramp governs, and `.type-whisper` stays at 7–9px uppercase mono — `references/typography.md` sanctions it as Reserve's identity and overrides generic readable-scale minimums. Do not sweep type sizes upward.
   - Targets are at least 44px. Inputs are at least 16px on phone.
   - No hover-only affordances.
7. **Motion.** Follow the existing §08 rules only. No new animation systems.
8. **Honesty and compliance.** These follow CLAUDE.md:
   - no invented numbers
   - no medical, dosage, supplement or compound guidance
   - no guaranteed results
   - no dead CTAs
   - public tiers are Reserve Signature and Reserve Black only
   - the safety launch switch (`NEXT_PUBLIC_ENABLE_SAFETY_TOOLS`) is respected
   - the banned-language suite passes

## Owner findings, 2026-09-15 (measured at 1440 on a Reserve Black member)

**1. Higher-tier screens are unlocked but empty.** Owner: "some of the rooms don't work in the higher tiers — there's not much info in there."

| Screen | Text in `main` | Visible buttons |
|---|---|---|
| Optimization Log | 301 chars | 0 |
| Mesocycle Planner | 552 | 1 |
| Physique Cockpit | 770 | 1 |
| Biomarker Cockpit | 784 | 1 |
| Peak Physique | 810 | 1 |
| Physique Command | 759 | 3 |

Each shows a single "waiting for data" sentence and offers no way in. **Rule: every gated screen must earn its first screen even with zero data.** It carries:
- what this cockpit does, in one line;
- exactly what it needs, as 2–3 named requirements with real progress ("1 of 3 photo check-ins", "0 of 1 lab panel");
- **one gold action that starts the first missing requirement** and lands on the real logger;
- where partial data exists, whatever is genuinely readable from it.

No invented previews and no sample data: the requirement list IS the content.

**2. Personal Command reads like a book.** Owner: "the protocol and all of that stuff — full redesign, it felt like a book as well." It measures 18,523 characters and 113 buttons in one screen, with no h1. The first screen carries state plus one action; prose becomes rows and labelled values; long explanation moves into a disclosure or sheet.

**3. The program must recognise an enhanced athlete.** Owner: "the system must understand the user is enhanced across the program." When a member logs a cycle or compounds, that context appears wherever it matters — Apex, Training, Nutrition, Recovery, Physique, Bloodwork and the cockpits — not only in Compound Command. Within compliance, that means:
- their own logged cycle, its week, and the lab checkpoints they or their clinician set;
- the markers commonly watched for their logged compounds, cited, and compared only to the range printed on their own report, carrying the lab's own flag;
- symptom logging and escalation routes to a clinician, urgent care, or 911 / 988.

Never dosage, timing, protocol design, "safe to continue", or a claim that anything protects against harm. The safety launch switch still gates review-pending surfaces.

## File ownership rules (parallel safety)

- **Shared primitives are read-only during waves.** That covers `src/components/ui/**`, `AppShell`, `TopBar`, `Sidebar`, `nav/**` and `globals.css`. If a primitive is missing, build a local component inside the screen's own folder and report it; the lead consolidates later.
- **`DESIGN_BIBLE.md` is not edited by wave agents.** The lead adds a single changelog entry per wave.
- **Owner-mode files belong to another session: do not touch.** These are `src/components/research/**`, `src/components/authz/**` and `src/components/timeline/**`.

## Waves (each agent owns a disjoint file set, ships as one PR)

**Wave 1**
- **A — Room depth** (`claude/redesign-rooms-depth`)
  - De-box below the fold in Training, Nutrition and Recovery, and in Apex's Watch List and Full Briefing.
  - Raise Apex's horizon labels to the 11px floor.
  - Fix the `TodaysScheduleCard` gold "Go" and the `useTodayFuelPlan` recovery-day flag.
- **B — Plan and intelligence** (`claude/redesign-foundation`): ProtocolCommandView, ProgramHorizonView, ResponseProfileView (+ `src/components/response/**`), LifestyleStudioView (+ `views/lifestyle/**`), MesocyclePlannerView, AIStrategistView, PerformanceIntelligenceView.
- **C — Records and physique** (`claude/redesign-records`): BloodworkView (+ `src/components/labs/**`), MeasurementsView, ProgressPhotosView, PhysiqueView (+ `views/physique/**`), PhysiqueIntelligenceView, BiomarkerIntelligenceView, PeakPhysiqueView, JournalView, EnhancedMonitorView.

**Wave 2**
- **D — Compound Command** (`CompoundCommandView` + `src/components/enhancement/**`). This carries the heaviest compliance load.
- **E — Settings, My Coach, Community and Education.**
- **F — Women's views** (`views/women/**`, `src/components/cycle/**`).

**Wave 3**
- **G — Coach workspace** (`src/components/coaching/**`) and onboarding (`src/components/onboarding/**`).

## Verification per PR

- **One e2e spec per wave agent.** It covers every owned screen at 1440×1000 and 390×844 (touch), with the tier seeded so the screen is unlocked. It asserts:
  - exactly one visible h1
  - the gold action count is exactly 1, or 0 where the screen is honestly read-only or locked, with the reason documented
  - no bordered rounded panel is nested inside another inside `main`
  - no horizontal overflow
  - no hydration errors
- **Every existing spec for those screens passes**, plus the five room specs and `phone-shell`.
- **Build checks:** `tsc`, `lint`, `vitest` and `build`.
- **Screenshots** of every owned screen at both sizes.
