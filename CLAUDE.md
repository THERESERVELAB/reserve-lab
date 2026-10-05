@AGENTS.md

# Standing Rules (apply to every session — do not restate in prompts)

## Scope & Safety
- Repo path: `C:\Users\antho\OneDrive\Desktop\final-boss-athlete-clean` — work only here.
- Do not touch unrelated folders or repos.
- Do not commit, push, reset, restore, or clean untracked files unless explicitly told to.
- Validate (`npm run lint` + `npm run build`) before reporting any task complete.

## Preserve Existing Systems
- Preserve: Personal Command, Training Command, Apex Command, Nutrition Command, Schedule, Physique submissions, Bloodwork Log, Supplement Logbook, Pricing.
- Use existing systems before creating new ones.

## Branding & Pricing
- Public pricing names are **Reserve Signature** and **Reserve Black** only.
- Never use public-facing: Core, Basic, Starter, Entry, Lite, Standard, Beginner.
- No real athlete/coach/federation names in public UI.
- No guaranteed-results claims.

## Compliance (hard rules)
Amended 2026-09-13 by owner direction to allow harm-reduction monitoring. Counsel and clinician review are pending — see `docs/compliance/HARM_REDUCTION_AMENDMENT.md` and `docs/compliance/COUNSEL_BRIEF.md`.

Never:
- No medical claims, diagnosis, or treatment guidance. Never name a condition or say what caused a result.
- No dosage recommendations — never amounts, schedules, durations, combinations, or cycle design.
- No supplement/compound/hormone/medication recommendations — never suggest starting, stopping, continuing, adding, or changing anything.
- No "safe to continue" or clearance verdicts.

Allowed (harm-reduction monitoring):
- Tracking the member's own stated cycle (start, planned weeks, end, linked compounds, lab checkpoints they or their clinician set).
- Publicly sourced compound risk profiles: body systems affected, commonly watched markers, red-flag symptoms, interactions, regulatory status — with citations.
- Comparing a lab result to the reference range printed on the member's own report, carrying the lab's own flag, and showing trends.
- Escalation only: every safety surface routes to a human — clinician, urgent care, 911 / 988.
- Support options (amended 2026-09-14): for an area the member's compounds affect, list supplements alphabetically with a cited evidence grade (including "not shown") and let the member add one to their log. Never ranked, never "best", never amounts/timing, never prompted or auto-added, never a claim that anything protects against or reverses harm.

Safeguards:
- Compound risk profiles stay `pending-clinician-review` until a licensed clinician signs them off; the banned-language suite (`src/lib/safety/__tests__/compliance-language.ts`) must pass.
- Lab reports (text PDFs, scanned PDFs, photos, pasted text) are read on-device — OCR runs in the browser from Reserve's own origin; files and pasted text are never stored or uploaded; only member-confirmed marker rows are stored.
- Launch switch: production builds hide Cycle & Safety, the Bloodwork safety panel and "What this measures" unless `NEXT_PUBLIC_ENABLE_SAFETY_TOOLS=true` (`src/lib/launch/safety-tools.ts`). Keep it unset in production until clinician and counsel sign-off; new unreviewed safety surfaces must check it (via `useSafetyToolsVisible()`). Exceptions by owner direction (2026-09-15): the Support Plan inside Support Stack and the Research tab in Compound Command are live for all members, still behind the safety acknowledgement.
- Timeline: change history, notes and observations are the member's own record. Observations are labeled "timing only"; Reserve never analyzes them, links them or says one thing caused, fixed or worsened another.
- Research tab (Lab Response, Burden Map, N=1 Review): placement in time only — never correlation, cause, ranking or directives. Burden Map lists compounds alphabetically with cited grades and stays labeled pending clinician review; open safety alerts always show first.
- Owner Mode: owner status comes only from a server-verified Supabase user id on the server-only `RESERVE_OWNER_USER_IDS` (or `RESERVE_DEV_OWNER=true` in local development without Supabase). Features gate on `can(access, capability)` / `useCan` (`src/lib/authz`), never ad-hoc owner checks. No capability may disable, bypass or silence a safety system, and safety modules never import `@/lib/authz` (test-enforced). Owner Mode adds information; it never removes warnings or escalation.
- Risk intelligence is shown only after the member accepts the current safety acknowledgement, including confirming they are 18 or older; a profile age under 18 keeps it closed.
- Open-source software is listed at `/open-source` (`src/lib/legal/third-party-notices.ts`); every new runtime dependency needs an entry, and `npm run licenses:audit` must be re-run to regenerate the full package inventory (it fails on licenses outside its allowlist).

## UI Quality
- No fake buttons. No dead CTAs — every interactive element must work or be honestly disabled with a reason.
