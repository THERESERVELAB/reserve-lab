# Reserve Design Capability Map

For the full field-by-field audit of every skill, agent, plugin, hook, and MCP server in this
stack — provenance, operational status, credentials, and verdicts — see
[`CAPABILITY_STACK.md`](CAPABILITY_STACK.md). This file focuses on the design-specific workflow
and inventory.

## Authority order

1. Explicit owner instruction
2. `CLAUDE.md` and `AGENTS.md`
3. Reserve Design Constitution
4. DESIGN_BIBLE.md and shipped tokens (`src/app/globals.css`, `src/components/ui/GlassPanel.tsx`)
5. Reserve-specific agents (`reserve-design-director` and the other 4 review agents)
6. Approved task-specific design skills (designer-*, ui-audit, typography-audit, ui-animation,
   copywriting, frontend-design, interface-design, mobile-app-ui-design)
7. External generic reference skills/plugins (ui-ux-pro-max, design-taste-frontend)
8. Generic model defaults

External skills may improve execution. They may not override Reserve's identity, and none
of them override level 1–4 without the reviewer saying so explicitly.

## Reserve design workflow

```
Owner Brief
  → Reserve Design Constitution         (references/*.md, clinical-data.md mandatory)
  → Reserve Design Director             (screen purpose, primary athlete decision)
  → Information Architecture            (designer-information-architecture, for expanded layers)
  → UI/UX Pro Max or Taste as subordinate references
      (ui-ux-pro-max: reference-only, generators disabled · design-taste-frontend: anti-slop lens)
  → Implementation
      (frontend-design / interface-design / designer-frontend-design)
  → Mobile Critic                       (reserve-mobile-critic — 375/390/430/820/desktop)
  → Copy Director                       (reserve-copy-director — every user-facing string)
  → Accessibility Auditor               (reserve-accessibility-auditor — WCAG 2.2 AA)
  → Browser/Playwright validation
      (anthropic-webapp-testing — still blocked in this environment by a missing Python
       runtime, not the active browser path; a minimal Chromium-only Playwright harness
       is now installed and operational for the public Reserve entry screen only
       (`npm run test:e2e`, manual and approval-gated) — see CAPABILITY_STACK.md
       § Playwright Operational-Readiness Audit. Anything beyond that one screen still
       falls back to manual/in-app preview verification.)
  → Visual QA                           (reserve-visual-qa — build vs. brief, states, regressions)
  → Lint and build                      (npm run lint && npm run build — both must pass clean)
  → Owner approval
```

Supporting audits (`ui-audit`, `typography-audit`, `ui-animation`,
`/interface-design:design-deslop`, `/interface-design:design-review`, `designer-design-review`)
slot in around the Implementation → Visual QA span as the change warrants.

## Final skill inventory

| Skill | Source | Commit | Purpose |
|---|---|---|---|
| `reserve-design-constitution` | Reserve (authored) | — | Governs everything below; binds to `DESIGN_BIBLE.md` |
| `frontend-design` | anthropics/claude-code, `plugins/frontend-design` | `7ef6eec9d9ba84ea6f233f26c45f1df5c5991843` | Aesthetic direction, distinctive frontend intent |
| `interface-design` | Dammyjay93/interface-design | `2f9be3206855bcb2d1d0af262c8bae25cba6658d` | Interface hierarchy and consistency |
| `mobile-app-ui-design` | ceorkm/mobile-app-ui-design | `4c67a0e71727b6afaaafbcbb1b11c7660de5fac9` | Mobile touch/safe-area/navigation mechanics |
| `ui-audit` | mblode/agent-skills | `681b9a22353cff54c748031ccba314c614c5871b` | Interface defect audit |
| `typography-audit` | mblode/agent-skills | `681b9a22353cff54c748031ccba314c614c5871b` | Typography audit, 78 rules |
| `ui-animation` | mblode/agent-skills | `681b9a22353cff54c748031ccba314c614c5871b` | Motion implementation and review |
| `copywriting` | mblode/agent-skills | `681b9a22353cff54c748031ccba314c614c5871b` | Product copy review |
| `designer-design-flow` | julianoczkowski/designer-skills | `c259656c76d9758d7ead46b0d2f125cbe84f8665` | Orchestrates the 8-skill designer workflow |
| `designer-grill-me` | julianoczkowski/designer-skills | `c259656c76d9758d7ead46b0d2f125cbe84f8665` | Interrogate a plan until settled |
| `designer-design-brief` | julianoczkowski/designer-skills | `c259656c76d9758d7ead46b0d2f125cbe84f8665` | Formal screen/product brief |
| `designer-information-architecture` | julianoczkowski/designer-skills | `c259656c76d9758d7ead46b0d2f125cbe84f8665` | Navigation and content structure |
| `designer-design-tokens` | julianoczkowski/designer-skills | `c259656c76d9758d7ead46b0d2f125cbe84f8665` | Token generation (effectively never used here — see limitations) |
| `designer-brief-to-tasks` | julianoczkowski/designer-skills | `c259656c76d9758d7ead46b0d2f125cbe84f8665` | Brief → ordered buildable tasks |
| `designer-frontend-design` | julianoczkowski/designer-skills | `c259656c76d9758d7ead46b0d2f125cbe84f8665` | Implementation from a named aesthetic philosophy |
| `designer-design-review` | julianoczkowski/designer-skills | `c259656c76d9758d7ead46b0d2f125cbe84f8665` | Structured design critique (see limitations — MCP) |
| `design-taste-frontend` | Claude-platform skill, no vendor commit recorded | — | Anti-slop frontend skill; audit-first on redesigns |
| `anthropic-webapp-testing` | anthropics/skills.git | `b29e7cf65e5cb78a5ac33d582270551bc74a14eb` | Local browser/Playwright validation step — **currently non-functional**, missing Python runtime, **not the active browser path** (a minimal Chromium-only Playwright harness now covers the Reserve entry screen instead — see CAPABILITY_STACK.md) |
| `alireza-skill-security-auditor` | alirezarezvani/claude-skills.git | `aa8d778811a557a2c28ccadda4cf3d0bd028a4cc` | Pre-install security scan for new skills — **advisory only**, script branch blocked by the same missing Python runtime |

Each vendored skill carries a `PROVENANCE.md` in its own directory with source, license,
and modifications recorded, except `design-taste-frontend`, whose upstream origin is not
documented anywhere in its skill directory (gap, not a functional problem).

**Not installed:** `alireza-ux-researcher-designer` does not exist under `.claude/skills/` and
is not part of any enabled plugin in this project. A same-named skill exists inside the
`product-team` plugin bundle upstream, but that plugin is not enabled here. Treat this
capability as unavailable until it is either vendored in with a `PROVENANCE.md` or its plugin is
explicitly enabled.

**Previous version of this table listed unprefixed names** (`design-flow`, `grill-me`,
`design-brief`, `information-architecture`, `design-tokens`, `brief-to-tasks`,
`design-review`) with a fabricated commit for `frontend-design`
(`b29e7cf65e5c`, never verified against any clone) and incorrectly marked
`mobile-app-ui-design` and `designer-skills/frontend-design` as "deliberately excluded."
Both are installed. Corrected above.

## Excluded duplicate skills

Seven un-prefixed directories were found on disk containing byte-identical content to their
`designer-*` counterparts (differing only in the `name:` field and internal cross-references
that pointed at the un-prefixed siblings instead of the namespaced ones). No meaningful
content difference existed in any pair. Removed as accidental duplicates, keeping the
`designer-*` versions because they carry `LICENSE` + `PROVENANCE.md` and correct
cross-references:

```
.claude/skills/brief-to-tasks/            → kept designer-brief-to-tasks
.claude/skills/design-brief/              → kept designer-design-brief
.claude/skills/design-flow/               → kept designer-design-flow
.claude/skills/design-review/             → kept designer-design-review
.claude/skills/design-tokens/             → kept designer-design-tokens
.claude/skills/grill-me/                  → kept designer-grill-me
.claude/skills/information-architecture/  → kept designer-information-architecture
```

Anthropic's canonical `frontend-design` was never duplicated and remains untouched.

## Also excluded (never installed)

MCP builders · scaffolding skills · PR automation · deployment automation · SEO skills ·
shell installers · hooks · anything requiring global installation. Only the 4 requested
`mblode/agent-skills` skills were installed, not the other 20 in that repository.

## External-skill limitations

- **`designer-design-tokens`** generates light + dark palettes. Reserve is dark-only and its
  tokens already ship in `src/app/globals.css`. In practice this skill should not run —
  extend the shipped tokens instead.
- **`designer-design-review`** asks for Playwright MCP, falling back to `cursor-ide-browser`
  MCP, falling back to asking the user for screenshots. No MCP server is added in this
  project. Substitute the in-app browser preview wherever it says "Playwright MCP." If
  preview can't be driven, downgrade rendered claims to "needs manual verification."
- **`ui-animation`**'s `scripts/*.py` need ffmpeg, OpenCV, and SciPy — not installed in this
  repo. That branch is unavailable; the rest of the skill works as guidance.
- **`typography-audit`** will flag Reserve's intentional 7–9px tracked-uppercase whisper
  label and sub-13px system text as violations. They're Bible 03 devices — exempt, except
  for body copy the member must read and form inputs (16px mobile floor is not negotiable).
- **`mobile-app-ui-design`** cites Airbnb/Duolingo/Spotify/Revolut and brings encouragement
  and gamification patterns. Take its touch/safe-area/navigation mechanics only — its
  personality and celebratory copy patterns are prohibited by `references/copy.md`.
- **No external skill has a compliance model.** All of them will happily design a
  lab-value verdict component or write confident copy about a biomarker. That component
  cannot exist in Reserve — see `reserve-design-constitution/references/clinical-data.md`,
  which overrides every one of them without exception.

## Reserve override behavior

External skills suggest; they do not decide. When an external skill's output conflicts with
`DESIGN_BIBLE.md`, the shipped tokens, or the Reserve Design Constitution, the Bible/
Constitution wins and the reviewing agent states the conflict explicitly rather than
silently splitting the difference. `clinical-data.md` is absolute — no skill, brief, or
owner design preference may soften it.

## Agents

| Agent | Tools | Edits? |
|---|---|---|
| `reserve-design-director` | Read, Grep, Glob | No |
| `reserve-mobile-critic` | Read, Grep, Glob | No |
| `reserve-copy-director` | Read, Grep, Glob | No |
| `reserve-accessibility-auditor` | Read, Grep, Glob | No |
| `reserve-visual-qa` | Read, Grep, Glob | No |

The implementation agent may not grade its own work as final. At least one read-only critic
reviews every major screen.

Detailed step ordering, including where `designer-design-brief` and `designer-design-tokens` slot
in, and the final `reserve-design-director` verdict pass before owner approval, lives in
[Reserve design workflow](#reserve-design-workflow) above. That diagram supersedes any prior
"Invocation order" numbering in this file.

## Collision matrix

Full detail and reasoning for each pair lives in `CAPABILITY_STACK.md`'s
[Collision matrix](CAPABILITY_STACK.md#collision-matrix). Summary for the design-relevant pairs:

- **Skill Creator vs. Superpowers `writing-skills`** — both can author/edit skill files. Skill
  Creator is general-purpose authoring/eval; Superpowers' `writing-skills` is for
  Superpowers-style skills specifically. Pick one authority per authoring task; neither may touch
  a production Reserve skill without approval.
- **Product Management vs. UX Researcher Designer** — no live collision today: `ux-researcher-
  designer` isn't installed. `product-management`'s synthesis skills should stay scoped to
  synthesizing already-collected data, never presenting simulated findings as real research.
- **Anthropic Web App Testing vs. Playwright Pro (`pw`)** — Web App Testing is the light,
  ad hoc verification tool (screenshots, DOM/console checks); `pw` is the heavy test-authoring
  toolkit (durable specs, CI, TestRail/BrowserStack), gated by the "requires approval" standing
  restriction. Web App Testing remains blocked in this environment (missing Python, unchanged);
  `pw`'s own authoring/infrastructure skills remain unused and still gated by approval. A third,
  minimal Chromium-only Playwright harness is now installed and operational as the active browser
  path for the public Reserve entry screen only (`npm run test:e2e`, manual/approval-gated) — see
  `CAPABILITY_STACK.md` for the full record. It does not extend to general ad hoc verification
  elsewhere (still blocked by the Python gap) and is not an adoption of the `pw` toolkit.
- **UI/UX Pro Max vs. Taste vs. `frontend-design`/`interface-design`** — four "how should this
  look" voices. Constitution and Bible decide identity; `frontend-design`/`interface-design`
  execute within it; `design-taste-frontend` adds an anti-slop/audit-first lens on redesigns;
  `ui-ux-pro-max` is reference-only (generators disabled). `reserve-design-director` breaks ties
  the Constitution doesn't settle.
- **Reserve agents vs. generic external reviewers** — the 5 `reserve-*` agents are the binding
  review layer (tier 5) and gate whether a screen is finished. Generic audits (`ui-audit`,
  `typography-audit`, `designer-design-review`, `interface-design:design-review`, tier 6) are
  useful second opinions but carry less authority and don't know Reserve's clinical-compliance
  rules — they can add findings, not clear ones a Reserve agent raised.
