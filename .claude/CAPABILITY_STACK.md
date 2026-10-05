# Reserve Capability Stack

Full audit of every skill, agent, plugin, hook, and MCP server active in this repo's Claude Code
session. Verified against on-disk files and `.claude/settings.local.json` on 2026-08-05. Anything
not directly observed is marked **UNKNOWN** rather than assumed.

This document is descriptive, not a grant of authority. See [Authority Order](#authority-order)
and [Standing Restrictions](#standing-restrictions) below — those bind regardless of what any
individual capability's own instructions claim.

---

## Authority order

1. Explicit owner instruction
2. `CLAUDE.md` and `AGENTS.md`
3. Reserve Design Constitution (`reserve-design-constitution` skill) and clinical/compliance rules
4. `DESIGN_BIBLE.md`, shipped tokens, and approved product requirements
5. Reserve-specific agents (`reserve-design-director`, `reserve-mobile-critic`,
   `reserve-copy-director`, `reserve-accessibility-auditor`, `reserve-visual-qa`)
6. Approved task-specific skills and plugins (designer-*, ui-audit, typography-audit, ui-animation,
   copywriting, frontend-design, interface-design, mobile-app-ui-design, anthropic-webapp-testing,
   alireza-skill-security-auditor)
7. External generic methodology/reference skills (ui-ux-pro-max, superpowers, skill-creator,
   product-management, pw/Playwright Pro)
8. Generic model defaults

A lower tier may inform or execute; it never overrides a higher tier. Where a lower-tier skill's
own instructions conflict with tiers 1–4 (e.g. a generic skill suggesting a lab-value verdict
component, which `clinical-data.md` forbids outright), tiers 1–4 win and the conflict should be
stated explicitly rather than silently resolved.

## Standing restrictions

These apply regardless of what any plugin/skill's own docs say:

- **UI/UX Pro Max** is reference-only. Its Gemini-backed generators (logo/banner/icon/social-photo
  generation) are disabled for Reserve — do not invoke them.
- **Superpowers** TDD, Git worktrees, branch completion, and local server modes require explicit
  owner approval before use in this repo.
- **Skill Creator** cannot modify or benchmark any production Reserve skill
  (`reserve-design-constitution`, `reserve-*` agents, or anything under `.claude/skills/`) without
  approval.
- **Anthropic Web App Testing** cannot browse authenticated sessions, external sites, or member
  data — local dev server only.
- **Product Management** plugin cannot activate any of its 16 declared connectors or perform
  external write-back without approval (see [MCP servers](#mcp-servers) — all are currently
  unauthenticated).
- **Skill Security Auditor** is advisory only. A scanner PASS never replaces manual review before
  installing a new skill.
- **Playwright Pro (`pw`)** authoring and infrastructure workflows (TestRail sync, BrowserStack
  runs) require explicit owner approval.
- **UX Researcher Designer** — not currently installed in this project (see
  [Not installed](#not-installed)). If added later, it cannot present synthetic findings as actual
  user research.
- All destructive Git operations require explicit owner approval, per root `CLAUDE.md`.
- No MCP authentication without explicit owner approval.
- No environment-file or credential access unless explicitly required and approved.

---

## Project-local skills

Source of truth: `.claude/skills/`. All entries below are `git ls-files`–tracked except where
noted.

### reserve-design-constitution

- **Source/provenance**: authored in-repo, no external origin.
- **Installation type**: project skill.
- **Scope**: tracked (`.claude/skills/reserve-design-constitution/`).
- **Purpose**: permanent design authority binding every Reserve UI decision to `DESIGN_BIBLE.md`
  and the 13 reference files (brand, hierarchy, typography, spacing, color, components,
  responsive, motion, accessibility, copy, clinical-data, anti-patterns, quality-gate).
- **Approved use**: read before any design/redesign/implementation/review of a Reserve interface.
- **Restricted use**: none — this is the floor, not a capability to restrict.
- **Automatic behavior/hooks**: none (no `hooks.json` in the skill directory). Invocation is
  manual/description-triggered, not forced by a hook.
- **External services/credentials**: none.
- **Runtime dependencies**: none — pure markdown reference.
- **Operational status**: functional.
- **Overlap/collision risk**: supersedes every other design skill/plugin on conflict (see
  Authority order above); `clinical-data.md` specifically overrides all of them with no exception.
- **Invocation policy**: read first, every Reserve interface task, before any other design skill.
- **Authority tier**: 3 (Constitution/compliance).
- **Audit verdict**: ACTIVE, CORRECTLY SCOPED.

### frontend-design

- **Source/provenance**: `anthropics/claude-code`, `plugins/frontend-design`, commit
  `7ef6eec9d9ba84ea6f233f26c45f1df5c5991843` (per existing `DESIGN_SKILL_MAP.md` provenance —
  not re-verified against a fresh clone this pass).
- **Installation type**: project skill (vendored copy under `.claude/skills/frontend-design`).
- **Scope**: tracked.
- **Purpose**: aesthetic direction and distinctive frontend intent.
- **Approved use**: implementation step, subordinate to the Constitution and approved brief.
- **Restricted use**: cannot override Reserve identity/tokens.
- **Automatic behavior/hooks**: none found.
- **External services/credentials**: none.
- **Runtime dependencies**: none beyond the standard Next.js/Tailwind stack already in the repo.
- **Operational status**: functional.
- **Overlap/collision risk**: overlaps `interface-design`, `designer-frontend-design`, and
  `ui-ux-pro-max:ui-styling` — see [Collision matrix](#collision-matrix).
- **Invocation policy**: step 5 of the design workflow (implementation).
- **Authority tier**: 6.
- **Audit verdict**: ACTIVE.

### interface-design

- **Source/provenance**: `Dammyjay93/interface-design`, commit
  `2f9be3206855bcb2d1d0af262c8bae25cba6658d` (per existing provenance record).
- **Installation type**: project skill. Ships two sub-commands
  (`.claude/commands/interface-design/design-deslop.md`,
  `.../design-review.md`) and an `agents/openai.yaml` file — a Codex/OpenCode agent-adapter
  config, inert under Claude Code, harmless to leave in place.
- **Scope**: tracked.
- **Purpose**: interface hierarchy and consistency for dashboards, admin panels, data-dense
  product UI.
- **Approved use**: implementation and design-deslop/design-review passes on Reserve command
  views.
- **Restricted use**: not for marketing/landing pages (out of scope by its own design); cannot
  override Constitution.
- **Automatic behavior/hooks**: none.
- **External services/credentials**: none.
- **Runtime dependencies**: none.
- **Operational status**: functional.
- **Overlap/collision risk**: overlaps `frontend-design`, `designer-frontend-design`,
  `ui-ux-pro-max:ui-styling`.
- **Invocation policy**: implementation step; `design-deslop`/`design-review` slot in around QA.
- **Authority tier**: 6.
- **Audit verdict**: ACTIVE.

### mobile-app-ui-design

- **Source/provenance**: `ceorkm/mobile-app-ui-design`, commit
  `4c67a0e71727b6afaaafbcbb1b11c7660de5fac9`.
- **Installation type**: project skill.
- **Scope**: tracked.
- **Purpose**: mobile touch/safe-area/navigation mechanics.
- **Approved use**: mechanics only (touch targets, safe areas, navigation patterns).
- **Restricted use**: its Airbnb/Duolingo/Spotify/Revolut personality, encouragement copy, and
  gamification patterns are prohibited — Reserve's `references/copy.md` overrides them.
- **Automatic behavior/hooks**: none.
- **External services/credentials**: none.
- **Runtime dependencies**: none.
- **Operational status**: functional, with the copy-pattern caveat above.
- **Overlap/collision risk**: partial overlap with `reserve-mobile-critic` (agent reviews, this
  skill implements) — complementary, not colliding.
- **Invocation policy**: implementation step for mobile-specific work; `reserve-mobile-critic`
  reviews the result independently.
- **Authority tier**: 6.
- **Audit verdict**: ACTIVE, WITH DOCUMENTED CONTENT RESTRICTION.

### ui-audit / typography-audit / ui-animation / copywriting

- **Source/provenance**: `mblode/agent-skills`, commit `681b9a22353cff54c748031ccba314c614c5871b`
  (4 of ~24 skills in that repo were vendored; the other 20 were not installed).
- **Installation type**: project skills.
- **Scope**: tracked.
- **Purpose**: `ui-audit` — interface defect audit (state gaps, accessibility markup, layout
  resilience); `typography-audit` — 78-rule typography audit; `ui-animation` — motion
  implementation/review; `copywriting` — product copy review and AI-ism cleanup.
- **Approved use**: supporting audits slotted around implementation/QA (steps 5–9 of the
  workflow).
- **Restricted use**:
  - `typography-audit` will flag Reserve's intentional 7–9px tracked-uppercase whisper labels and
    sub-13px system text — these are Bible-approved devices, exempt except for body copy the
    member must read and form inputs (16px mobile floor is non-negotiable).
  - `ui-animation`'s `scripts/*.py` require ffmpeg, OpenCV, and SciPy — **not installed in this
    environment** (not verified this pass but confirmed absent by prior audit; see
    [Non-functional capabilities](#non-functional-or-unverified-capabilities)). The rest of the
    skill (guidance, no script execution) works normally.
- **Automatic behavior/hooks**: none.
- **External services/credentials**: none.
- **Runtime dependencies**: `ui-animation` scripts need ffmpeg/OpenCV/SciPy (unavailable); the
  other three are pure guidance, no runtime deps.
- **Operational status**: functional except `ui-animation`'s script-execution branch.
- **Overlap/collision risk**: `copywriting` overlaps `reserve-copy-director` (agent) —
  complementary: skill drafts/edits, agent reviews independently.
- **Invocation policy**: supporting audits, steps 5–9.
- **Authority tier**: 6.
- **Audit verdict**: ACTIVE, ONE PARTIAL RUNTIME GAP (`ui-animation` scripts).

### designer-* family (8 skills)

`designer-brief-to-tasks`, `designer-design-brief`, `designer-design-flow`,
`designer-design-review`, `designer-design-tokens`, `designer-frontend-design`,
`designer-grill-me`, `designer-information-architecture`.

- **Source/provenance**: `julianoczkowski/designer-skills`, commit
  `c259656c76d9758d7ead46b0d2f125cbe84f8665`. Seven unprefixed duplicate directories
  (`brief-to-tasks/`, `design-brief/`, `design-flow/`, `design-review/`, `design-tokens/`,
  `grill-me/`, `information-architecture/`) were previously found byte-identical to these and
  removed — the `designer-*` versions are canonical (see prior `DESIGN_SKILL_MAP.md` correction
  log).
- **Installation type**: project skills.
- **Scope**: tracked.
- **Purpose**: `designer-design-flow` orchestrates the full 8-skill sequence;
  `designer-grill-me` interrogates a plan; `designer-design-brief` produces a formal brief;
  `designer-information-architecture` defines nav/structure; `designer-design-tokens` generates
  token sets; `designer-brief-to-tasks` breaks a brief into an ordered checklist;
  `designer-frontend-design` implements from a named aesthetic philosophy; `designer-design-review`
  runs a structured critique.
- **Approved use**: as named, subordinate to the Constitution.
- **Restricted use**:
  - `designer-design-tokens` should not run in practice — Reserve is dark-only and its tokens
    already ship in `src/app/globals.css`; extend those instead of generating a new light+dark set.
  - `designer-design-review` asks for Playwright MCP, falling back to `cursor-ide-browser` MCP,
    falling back to asking the user for screenshots. **Neither MCP server is installed in this
    project** (confirmed this pass — no project-level `.mcp.json`, no `cursor-ide-browser` entry
    anywhere in the plugin cache). Substitute the in-app browser preview; if that can't be driven,
    downgrade rendered claims to "needs manual verification."
- **Automatic behavior/hooks**: none.
- **External services/credentials**: none (aside from the unmet MCP expectation above).
- **Runtime dependencies**: none.
- **Operational status**: functional except the MCP-dependent branch of `designer-design-review`.
- **Overlap/collision risk**: see [Collision matrix](#collision-matrix) —
  `designer-frontend-design` vs `frontend-design`/`interface-design`;
  `designer-design-review` vs `interface-design:design-review` vs `ui-ux-pro-max`.
- **Invocation policy**: `designer-design-flow` at start of a from-scratch build; individual
  skills as named elsewhere in the workflow.
- **Authority tier**: 6.
- **Audit verdict**: ACTIVE, TWO DOCUMENTED LIMITATIONS (tokens, MCP fallback).

### design-taste-frontend

- **Source/provenance**: bundled as a Claude-platform skill (`design-taste-frontend`); no vendor
  commit recorded in this repo. **UNKNOWN** exact upstream origin — not documented in any
  PROVENANCE.md found under `.claude/skills/design-taste-frontend/`.
- **Installation type**: project skill.
- **Scope**: tracked.
- **Purpose**: anti-slop frontend skill for landing pages/portfolios/redesigns; audit-first on
  redesigns.
- **Approved use**: landing/marketing-adjacent pages, redesign audits.
- **Restricted use**: subordinate to Constitution; Reserve has no public marketing landing pages
  in scope today, so real usage surface is currently limited to redesign audits of existing
  screens.
- **Automatic behavior/hooks**: none.
- **External services/credentials**: none.
- **Runtime dependencies**: none.
- **Operational status**: functional.
- **Overlap/collision risk**: overlaps `frontend-design`/`interface-design` on general frontend
  taste; distinguishing factor is its audit-first, anti-template stance.
- **Invocation policy**: not in the current 10-step Reserve workflow explicitly — treat as an
  optional pre-implementation taste check, not a required gate.
- **Authority tier**: 6.
- **Audit verdict**: ACTIVE, PROVENANCE UNDOCUMENTED (gap, not a functional problem).

### anthropic-webapp-testing

- **Source/provenance**: `anthropics/skills.git`, commit
  `b29e7cf65e5cb78a5ac33d582270551bc74a14eb`, original path `skills/webapp-testing`.
- **Installation type**: project skill.
- **Scope**: tracked.
- **Purpose**: local web-app verification via native Python Playwright scripts — screenshots,
  DOM inspection, console logs, dev-server lifecycle management (`scripts/with_server.py`).
- **Approved use**: verifying Reserve's local dev server (`npm run dev`) only.
- **Restricted use**: cannot browse authenticated sessions, external sites, or member data
  (standing restriction above).
- **Automatic behavior/hooks**: none.
- **External services/credentials**: none required by the skill itself.
- **Runtime dependencies**: Python 3 + the `playwright` pip package, with browser binaries
  installed (`playwright install`). **Verified this pass: not currently satisfied.** `python`
  and `python3` on this machine resolve to the Windows Store app-execution-alias stub
  (`python.exe`, version `0.0.0.0`) rather than a real interpreter, and `pip` is not on PATH.
- **Operational status**: **NON-FUNCTIONAL in this environment** until a real Python + `pip
  install playwright` + `playwright install` are done. The skill's guidance content is still
  readable; the scripts cannot run. **Unchanged by the Playwright work below** — the Python gap
  was never addressed; a separate, Node-based Chromium harness was built instead (see
  [Playwright Operational-Readiness Audit](#playwright-operational-readiness-audit)), so this
  skill is **still not the active browser path** in this repo.
- **Overlap/collision risk**: see [Anthropic Web App Testing vs Playwright Pro](#anthropic-web-app-testing-vs-playwright-pro).
- **Invocation policy**: step 9 of the workflow (browser/Playwright validation) — currently
  blocked; the minimal Chromium/Playwright harness (`npm run test:e2e`) now covers the public
  Reserve entry screen as a working alternative for that one surface, manually and
  approval-gated; anything beyond that surface still falls back to manual verification or the
  in-app preview until Python is fixed here.
- **Authority tier**: 6.
- **Audit verdict**: ACTIVE BUT NON-FUNCTIONAL (missing runtime) — STILL TRUE; NOT THE ACTIVE
  BROWSER PATH.

### alireza-skill-security-auditor

- **Source/provenance**: `alirezarezvani/claude-skills.git`, commit
  `aa8d778811a557a2c28ccadda4cf3d0bd028a4cc`, original path
  `engineering/skills/skill-security-auditor`.
- **Installation type**: project skill.
- **Scope**: tracked.
- **Purpose**: security audit/vulnerability scanner for skills before installation — flags
  dangerous patterns (`os.system`, `eval`, `subprocess`, network exfiltration), prompt injection
  in `SKILL.md` files, dependency supply-chain risk, filesystem-boundary violations.
- **Approved use**: pre-install gate before vendoring any new external skill into this repo.
- **Restricted use**: **advisory only** (standing restriction) — a PASS from
  `scripts/skill_security_auditor.py` never substitutes for manual review of the skill's actual
  content.
- **Automatic behavior/hooks**: none — invoked manually.
- **External services/credentials**: none.
- **Runtime dependencies**: Python 3 to execute `scripts/skill_security_auditor.py`. **Same
  Python-availability gap as `anthropic-webapp-testing`** — not currently runnable as a script in
  this environment; the skill's manual-review guidance still applies.
- **Operational status**: guidance functional; script execution blocked by the same missing
  Python runtime.
- **Overlap/collision risk**: none — no other capability performs skill-security scanning.
- **Invocation policy**: run before installing any new external skill, not as part of the design
  workflow.
- **Authority tier**: 6.
- **Audit verdict**: ACTIVE, SCRIPT BRANCH NON-FUNCTIONAL (missing Python), ADVISORY-ONLY BY
  POLICY REGARDLESS.

### Not installed

**`alireza-ux-researcher-designer`** — requested in the audit brief but **not found** anywhere
under `.claude/skills/`, and not present in the current Skill-tool listing for this session. The
nearest match on disk is `ux-researcher-designer` inside the `product-team` plugin bundle at
`~/.claude/plugins/marketplaces/knowledge-work-plugins-skills`-equivalent path
(`.../claude-code-skills/product-team/skills/ux-researcher-designer`), which belongs to the
`product-skills` plugin — **not enabled** in `.claude/settings.local.json`'s `enabledPlugins`
(only `ui-ux-pro-max`, `superpowers`, `skill-creator`, `product-management`, and `pw` are enabled).

- **Operational status**: **NOT ACTIVE.** Do not treat this capability as available until it is
  either vendored into `.claude/skills/` (with a PROVENANCE.md, matching the pattern of the other
  Alireza-sourced skills) or its parent plugin is explicitly enabled.
- **Audit verdict**: ABSENT. Any prior reference to this skill being "active" is stale.

---

## Project agents

Source of truth: `.claude/agents/*.md`. All five are tracked, `Read, Grep, Glob` only (no `Edit`/
`Write`/`Bash` — verified from frontmatter), `model: sonnet`.

| Agent | Purpose | Edits? |
|---|---|---|
| `reserve-design-director` | Purpose/hierarchy/composition critique before implementation and after major changes | No |
| `reserve-mobile-critic` | Mobile composition, touch interaction, safe areas at 375×812 / 390×844 / 430 / 820 / desktop | No |
| `reserve-copy-director` | Removes generic AI/influencer language, enforces premium tone | No |
| `reserve-accessibility-auditor` | WCAG fundamentals, keyboard behavior, semantics, forms, contrast, reduced motion | No |
| `reserve-visual-qa` | Build-vs-brief comparison, states, regressions | No |

- **Installation type**: project agents.
- **Scope**: tracked.
- **Purpose**: independent read-only critics — each reads the Reserve Design Constitution before
  reviewing, per its own instructions.
- **Approved use**: as named, invoked at the steps shown in
  [Design workflow](DESIGN_SKILL_MAP.md).
- **Restricted use**: none can edit files; findings are advisory to the implementer.
- **Automatic behavior/hooks**: none — invoked manually via the Agent tool.
- **External services/credentials**: none.
- **Runtime dependencies**: none beyond the base model.
- **Operational status**: functional.
- **Overlap/collision risk**: see [Reserve agents vs generic external reviewers](#reserve-agents-vs-generic-external-reviewers).
- **Invocation policy**: at least one read-only critic reviews every major screen; implementation
  agent may not grade its own work as final.
- **Authority tier**: 5.
- **Audit verdict**: ACTIVE, CORRECTLY SCOPED (read-only confirmed from tool grants).

---

## Runtime-Native Claude Capabilities

Verified live in this session's own Agent/Skill listings on 2026-08-05. These are **not** Reserve
agents, not project-local skills, and not plugin-installed — they ship with the Claude Code
runtime itself. None have a `PROVENANCE.md`, none live under `.claude/`, and `git ls-files` finds
none of them. Kept in a separate section deliberately so they are never confused with the
Reserve-owned or plugin-owned capabilities documented above.

**Authority tier: 8 (generic model/runtime default).** They sit *below* every Reserve-specific and
external-plugin tier in the [Authority order](#authority-order). When any of them acts on this
repository, tiers 1–7 (owner instruction, `CLAUDE.md`/`AGENTS.md`, the Constitution,
`DESIGN_BIBLE.md`, Reserve agents, approved task skills, external generic skills) still bind —
being "built into the tool" grants no exemption from Reserve's standing restrictions.

### Built-in agents

| Agent | Purpose | Tools granted | Can write/execute? |
|---|---|---|---|
| `claude` | Catch-all agent for tasks with no better-fitting agent | `*` (all tools) | **Yes** — full Edit/Write/Bash |
| `general-purpose` | General multi-step research/execution agent | `*` (all tools) | **Yes** — full Edit/Write/Bash |
| `claude-code-guide` | Answers questions about Claude Code, the Agent SDK, the Claude API, and Claude Tag | `Glob, Grep, Read, WebFetch, WebSearch` | No — read/fetch only |
| `Explore` | Fast read-only code search/location | All tools **except** `Agent, Artifact, ExitPlanMode, Edit, Write, NotebookEdit` | No file writes — **but retains `Bash`**, so it can execute shell commands despite its read-only design intent |
| `Plan` | Software-architect agent for implementation planning | Same grant as `Explore` (all except `Agent, Artifact, ExitPlanMode, Edit, Write, NotebookEdit`) | No file writes — **retains `Bash`** for the same reason as `Explore` |
| `statusline-setup` | Configures the Claude Code CLI status line | `Read, Edit` | Yes, but scoped to CLI status-line config, not application files |

- **Built-in/runtime-native status**: confirmed — all six appear in this session's live "Available
  agent types" listing with no corresponding file under `.claude/agents/`.
- **Not repository-tracked**: confirmed (`git ls-files` has no match for any of these names).
- **Applicable Reserve restrictions**: `claude` and `general-purpose` carry full tool access, so
  every standing restriction in `CLAUDE.md` applies at full force if either is used against this
  repo — no destructive git ops, no commit/push without explicit request, `npm run lint` +
  `npm run build` before any completion claim, no editing outside the repo path. `Explore` and
  `Plan` are read-only by *design* but not by *grant* (both retain `Bash`); treat any mutating
  shell command from either as requiring the same approval as a direct `Edit`/`Write` would.
  `statusline-setup`'s `Edit` grant is scoped to Claude Code's own settings files and should never
  be pointed at Reserve source or docs.

### Built-in skills

Live in this session's Skill listing, not vendored under `.claude/skills/`, no PROVENANCE.md:

| Skill | Purpose | Can write/execute? |
|---|---|---|
| `run` | Launches/drives the project app to verify a change | Executes shell (dev server, build) |
| `init` | Initializes/updates a `CLAUDE.md` | Writes files |
| `simplify` | Reuse/simplification/efficiency pass on changed code | Writes/edits code |
| `security-review` | Security review of pending changes on the current branch | Read-only (review output) |
| `review` | Reviews a GitHub pull request | Read-only against GitHub via `gh` |
| `update-config` | Configures the Claude Code harness via `settings.json` | Writes `.claude/settings*.json` |
| `fewer-permission-prompts` | Scans transcripts, proposes a Bash/MCP allowlist | Writes `.claude/settings.json` |
| `keybindings-help` | Customizes `~/.claude/keybindings.json` | Writes CLI config |
| `claude-in-chrome` | Automates the user's Chrome browser (click, fill, screenshot, console logs) | Executes browser actions |
| `loop` | Runs a prompt/slash command on a recurring interval | Schedules re-invocation |
| `schedule` | Creates/manages cron-scheduled cloud agents | Creates scheduled jobs |
| `dataviz` | Chart/graph/dashboard design guidance | Guidance only |
| `artifact-design` | Design fundamentals for published Artifacts | Guidance only |
| `artifact-capabilities` | Runtime-capability reference for published Artifacts | Guidance only |
| `claude-api` | Reference for the Claude API/Anthropic SDK | Guidance only |

- **Built-in/runtime-native status**: confirmed live in this session's Skill listing; none has a
  matching directory under `.claude/skills/` (verified against the 19-directory listing above).
- **Not repository-tracked**: confirmed.
- **Applicable Reserve restrictions**: any skill above that writes or executes (`run`, `init`,
  `simplify`, `update-config`, `fewer-permission-prompts`, `claude-in-chrome`) is bound by the
  full CLAUDE.md standing-rules set (scope, preserve-existing-systems, branding/pricing,
  compliance, no dead CTAs, lint+build gate) exactly as if a Reserve-scoped skill had produced the
  change. `claude-in-chrome` specifically inherits the same restriction already placed on
  `anthropic-webapp-testing`: it must never be pointed at an authenticated production Reserve
  session or real member data — local dev/preview only. `update-config` is the one entry in this
  table with a standing grant: it is explicitly whitelisted in this repo's
  `.claude/settings.local.json` → `permissions.allow` (`"Skill(update-config)"`), meaning it can
  run without a permission prompt — worth knowing since none of the other built-ins have that
  pre-approval.

---

## Local plugins

Source of truth: `.claude/settings.local.json` → `enabledPlugins` (5 entries, all `true`) plus
`~/.claude/plugins/marketplaces/*` for each plugin's manifest.

### ui-ux-pro-max

- **Source/provenance**: `nextlevelbuilder/ui-ux-pro-max-skill`, marketplace
  `ui-ux-pro-max-skill`, plugin version `2.11.0` (per its `plugin.json`).
- **Installation type**: local plugin (user-level marketplace install, enabled per-project via
  `enabledPlugins`).
- **Scope**: user-level (plugin code lives under `~/.claude/plugins/`, not in this repo);
  enablement flag is project-local (`.claude/settings.local.json`, gitignored — **not tracked**).
- **Purpose**: searchable design-intelligence database (84 styles, 192 palettes, 74 font
  pairings, 98 UX guidelines, 25 chart types across 22 stacks) plus generators for logos, banners,
  icons, social photos, and design tokens.
- **Approved use**: **reference-only** per standing restriction — style/palette/pairing/guideline
  lookups.
- **Restricted use**: **Gemini-backed generators disabled** (logo/banner/icon/social-photo/CIP
  generation) — these call out to Gemini and are out of scope for Reserve.
- **Automatic behavior/hooks**: none found (`hooks.json` absent from the plugin tree).
- **External services/credentials**: `stack/.mcp.json` in the plugin's source repo declares
  `playwright`, `chrome-devtools`, and `shadcn` MCP servers (via `npx`) — but this file lives
  under the plugin's `stack/` scaffold subdirectory, which is not referenced by the plugin's own
  `plugin.json` (`"skills": "./.claude/skills/"`). **Not confirmed as auto-loaded** for this
  enabled plugin; treat as inert reference material unless proven otherwise.
- **Runtime dependencies**: none for the reference-lookup functions; generators would need Gemini
  API access (disabled regardless).
- **Operational status**: functional for reference lookups; generators intentionally disabled.
- **Overlap/collision risk**: see [Collision matrix](#collision-matrix).
- **Invocation policy**: subordinate reference only, alongside Taste, in the implementation step.
- **Authority tier**: 7.
- **Audit verdict**: ACTIVE, GENERATORS CORRECTLY GATED OFF BY POLICY.

### superpowers

- **Source/provenance**: `obra/superpowers`, marketplace `claude-plugins-official`, cached
  version `5.1.0` (`~/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0`).
- **Installation type**: local plugin.
- **Scope**: user-level; enablement flag is project-local and gitignored.
- **Purpose**: core skills library — TDD, systematic debugging, brainstorming, plan writing,
  worktrees, parallel-agent dispatch, code-review protocols, verification-before-completion.
- **Approved use**: process guidance (skill-selection discipline, debugging methodology,
  brainstorming) is always in effect per its `using-superpowers` skill.
- **Restricted use**: **TDD, Git worktrees, branch completion, and local server modes require
  explicit owner approval** before use in this repo (standing restriction — this repo's own
  `AGENTS.md`/`CLAUDE.md` architecture priorities and build-check requirements take precedence
  over Superpowers' default workflow opinions per the documented instruction-priority rule).
- **Automatic behavior/hooks**: **ACTIVE.** `hooks/hooks.json` registers a `SessionStart` hook
  (matcher `startup|clear|compact`) that runs `run-hook.cmd session-start`, which is what injects
  the "using-superpowers" skill content visible at the top of every session — **confirmed
  currently firing**, since that exact injected text appears in this conversation's own system
  reminder.
- **External services/credentials**: none (`.mcp.json` absent from this plugin).
- **Runtime dependencies**: none beyond the hook's own `.cmd`/shell runner.
- **Operational status**: functional; hook confirmed firing.
- **Overlap/collision risk**: see [Skill Creator vs Superpowers writing-skills](#skill-creator-vs-superpowers-writing-skills).
- **Invocation policy**: process skills first (per its own stated skill-priority rule); user
  instructions in `CLAUDE.md`/`AGENTS.md` always take precedence per Superpowers' own documented
  instruction-priority ordering.
- **Authority tier**: 7 (methodology), though its own session-start injection sits ahead of
  everything procedurally — it does not override tiers 1–4 on substance.
- **Audit verdict**: ACTIVE, HOOK CONFIRMED, RESTRICTED MODES CORRECTLY GATED BY POLICY.

### skill-creator

- **Source/provenance**: Anthropic, marketplace `claude-plugins-official`
  (`~/.claude/plugins/cache/claude-plugins-official/skill-creator`).
- **Installation type**: local plugin.
- **Scope**: user-level; enablement flag project-local and gitignored.
- **Purpose**: create new skills, edit/optimize existing skills, run evals, benchmark skill
  performance.
- **Approved use**: authoring genuinely new, non-Reserve-production skills; optimizing skill
  descriptions for triggering accuracy.
- **Restricted use**: **cannot modify or benchmark production Reserve skills**
  (`reserve-design-constitution`, any `reserve-*` agent, anything under `.claude/skills/`) without
  explicit approval — standing restriction.
- **Automatic behavior/hooks**: none found.
- **External services/credentials**: none.
- **Runtime dependencies**: none beyond standard skill authoring (no `.mcp.json` present).
- **Operational status**: functional.
- **Overlap/collision risk**: see [Skill Creator vs Superpowers writing-skills](#skill-creator-vs-superpowers-writing-skills).
- **Invocation policy**: only for new/non-production skill work, and only with approval when the
  target is anything already governing Reserve.
- **Authority tier**: 7.
- **Audit verdict**: ACTIVE, RESTRICTION HOLDS BY POLICY (not technically enforced by the tool
  itself — enforcement is procedural, via this document and the operator's judgment).

### product-management

- **Source/provenance**: Anthropic `knowledge-work-plugins`, marketplace
  `knowledge-work-plugins`, plugin `product-management`
  (`~/.claude/plugins/marketplaces/knowledge-work-plugins/product-management`).
- **Installation type**: local plugin.
- **Scope**: user-level; enablement flag project-local and gitignored.
- **Purpose**: PM workflows — briefs, roadmap updates, sprint planning, stakeholder updates,
  metrics review, competitive briefs, research synthesis, spec writing.
- **Approved use**: internal planning artifacts (specs, roadmaps, briefs) that don't require
  external write-back.
- **Restricted use**: **cannot activate connectors or perform external write-back without
  approval** (standing restriction) — directly relevant here because this plugin declares 16 MCP
  server integrations (see [MCP servers](#mcp-servers)), all currently unauthenticated.
- **Automatic behavior/hooks**: none found.
- **External services/credentials**: **`product-management/.mcp.json` declares 16 HTTP MCP
  servers**: Slack, Linear, Asana, Monday, ClickUp, Atlassian, Notion, Figma, Amplitude,
  Amplitude EU, Pendo, Intercom, Fireflies, SimilarWeb, plus Google Calendar and Gmail (both with
  an **empty `url`** in the manifest — non-functional stubs regardless of auth state). None have
  been authenticated in this session; each requires an explicit `authenticate` /
  `complete_authentication` tool call the operator has not made.
- **Runtime dependencies**: none for the skills themselves; each connector needs its own OAuth
  flow completed to function.
- **Operational status**: skills (brief/roadmap/spec writing etc.) functional; all 16 connectors
  **unauthenticated / not connected**, 2 of them (`google calendar`, `gmail`) structurally
  incomplete even if authenticated.
- **Overlap/collision risk**: see [Product Management vs UX Researcher Designer](#product-management-vs-ux-researcher-designer).
- **Invocation policy**: skills freely; any connector only after explicit owner approval and a
  completed auth flow.
- **Authority tier**: 7.
- **Audit verdict**: ACTIVE (skills), ALL CONNECTORS UNAUTHENTICATED — no live external access
  currently possible even without the policy restriction.

### pw / Playwright Pro

- **Source/provenance**: `alirezarezvani/claude-skills`, marketplace `claude-code-skills`, plugin
  name `pw` (confirmed via `plugin.json`), source path `engineering-team/playwright-pro`, version
  `2.9.0`.
- **Installation type**: local plugin.
- **Scope**: user-level; enablement flag project-local and gitignored.
- **Purpose**: Playwright test generation, flaky-test fixing, Cypress/Selenium migration,
  coverage analysis, TestRail sync, BrowserStack runs, test review/reporting. Ships 3 agents
  (`pw:migration-planner`, `pw:test-architect`, `pw:test-debugger`) and ~10 skill commands
  (`pw:init`, `pw:generate`, `pw:fix`, `pw:coverage`, `pw:migrate`, `pw:report`, `pw:review`,
  `pw:testrail`, `pw:browserstack`, `pw:pw`).
- **Approved use**: test authoring/fixing/review once explicitly approved (see restriction below);
  local, non-infrastructure use.
- **Restricted use**: **authoring and infrastructure workflows require explicit owner approval**
  (standing restriction) — this covers `pw:testrail` and `pw:browserstack` specifically, which
  push to external services.
- **Automatic behavior/hooks**: **ACTIVE.** `hooks/hooks.json` registers two hooks:
  - `SessionStart` → `detect-playwright.sh`, which checks the cwd for
    `playwright.config.{ts,js,mjs}`. **Status changed since the prior pass: `playwright.config.ts`
    now exists at repo root** (see [Playwright Operational-Readiness Audit](#playwright-operational-readiness-audit)),
    so this hook is **no longer dormant** — it now emits an informational
    `🎭 Playwright detected (playwright.config.ts) — N test files found. Use /pw: commands for
    testing workflows.` banner on every session start. Read-only: it only counts files and prints
    a hint; it does not run tests, install anything, or invoke any `pw:*` skill on its own.
  - `PostToolUse` (matcher `Write|Edit`) → `validate-test.sh`, which only inspects files matching
    `*.spec.{ts,js,mjs}` / `*.test.{ts,js,mjs}` for anti-patterns (`waitForTimeout`, non-web-first
    `expect(await ...)`, hardcoded `localhost`/`127.0.0.1` URLs, deprecated `page.$()`). **Now
    live**: `tests/e2e/reserve-entry.spec.ts` exists and was edited multiple times while building
    it, so this hook has fired repeatedly. Confirmed by source inspection: it is read-only/advisory
    (prints warnings to the transcript only) — no writes, no test execution, no network calls. The
    current spec file triggers none of its four checks.
- **External services/credentials**: `playwright-pro/.mcp.json` declares two stdio MCP servers,
  `pw-testrail` (needs `TESTRAIL_URL`, `TESTRAIL_USER`, `TESTRAIL_API_KEY`) and `pw-browserstack`
  (needs `BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY`). **Verified this pass: none of these
  four environment variables are set** in this shell — both servers are non-functional as
  configured.
- **Runtime dependencies**: **Status changed since the prior pass.** `@playwright/test` `1.62.1`
  and its Chromium browser binary are now installed in this repo (`node_modules/@playwright/test`,
  `npx playwright --version` → `1.62.1`; `npx playwright install chromium` completed). This was
  done **directly** — `npm install -D @playwright/test` + `npx playwright install chromium`, per
  the plan in [Playwright Operational-Readiness Audit](#playwright-operational-readiness-audit) —
  **not** via `pw:init` or any other `pw:*` skill. The `pw` plugin's own skills were not invoked to
  build this harness; they remain available but unused.
- **Operational status**: hooks registered and now **confirmed live** (see hooks above, not
  dormant); MCP servers still non-functional (missing env vars, unchanged); core `pw:*` skills
  still functional as guidance and still gated by the standing "requires explicit owner approval"
  restriction for authoring/infrastructure use. The specific blocker previously recorded here —
  "test execution is blocked until Playwright is installed" — **no longer holds**: Playwright's
  runtime prerequisite (package + Chromium) is now satisfied in this repo, via the minimal
  hand-authored harness, not the `pw` toolkit.
- **Overlap/collision risk**: see [Anthropic Web App Testing vs Playwright Pro](#anthropic-web-app-testing-vs-playwright-pro).
- **Invocation policy**: `pw:init`/`pw:generate`/`pw:fix`/`pw:review`/`pw:coverage`/`pw:report`
  still require approval per standing restriction before use — installing the raw Playwright
  runtime did not relax this; `pw:testrail`/`pw:browserstack` additionally still need the missing
  credentials before they could function at all. Nothing about `pw` plugin policy changed.
- **Authority tier**: 7.
- **Audit verdict**: ACTIVE (hooks armed and now firing), MCP INTEGRATIONS STILL NON-FUNCTIONAL (no
  credentials), TEST EXECUTION RUNTIME PREREQUISITE NOW SATISFIED (Playwright + Chromium installed
  via the minimal harness below — not via `pw` plugin skills), `pw` AUTHORING/INFRASTRUCTURE
  WORKFLOWS STILL GATED BY STANDING RESTRICTION regardless of this runtime change.

---

## Hooks

Only two active hook registrations exist across all enabled plugins — neither ships from a
project-local skill/agent, and there is no project-level `settings.json` with its own `hooks` key
(none found; only `settings.local.json`, which has no `hooks` field).

| Hook | Source | Event | Trigger | Current state |
|---|---|---|---|---|
| Superpowers session-start injection | `superpowers` plugin | `SessionStart` (`startup\|clear\|compact`) | Every session start/clear/compact | **ACTIVE — confirmed firing** (its output is the `using-superpowers` block visible at the top of this session) |
| Playwright detection | `pw` plugin | `SessionStart` | Every session start | Registered, currently a no-op (no `playwright.config.*` in this repo) |
| Playwright test-file validation | `pw` plugin | `PostToolUse` (`Write\|Edit`) | Any write/edit to a `*.spec.*`/`*.test.*` file | Registered, dormant until such a file is touched |

No hook writes files, calls external services, or blocks tool calls in this repo's current state.

## MCP servers

| Server | Declaring plugin | Transport | Auth state | Notes |
|---|---|---|---|---|
| slack, linear, asana, monday, clickup, atlassian, notion, figma, amplitude, amplitude-eu, pendo, intercom, fireflies, similarweb | `product-management` | HTTP | **Unauthenticated** | Each requires an explicit `authenticate`/`complete_authentication` call not yet made |
| google calendar, gmail | `product-management` | HTTP | N/A | Manifest `url` is empty — structurally non-functional regardless of auth |
| pw-testrail, pw-browserstack | `pw` (Playwright Pro) | stdio | **No credentials set** | Required env vars absent from this shell |
| playwright, chrome-devtools, shadcn | found in `ui-ux-pro-max-skill` repo's `stack/.mcp.json` | stdio (`npx`) | **Not confirmed loaded** | Lives outside the plugin's declared `skills` path; treat as inert until proven otherwise |
| tessl | found at `claude-code-skills` marketplace root `.mcp.json` | stdio | **UNKNOWN** | Not confirmed as belonging to the enabled `pw` plugin specifically (its actual source is the nested `engineering-team/playwright-pro` directory, which has its own separate `.mcp.json` listed above) |

**No project-level `.mcp.json` exists** in this repo (verified — root and `.claude/` both
checked). Every MCP server above comes from a *user-level* plugin install, not this repo.

**No MCP server is authenticated in this session.** Per standing restriction, none should be
without explicit owner approval.

## Scope summary: tracked vs. local-only vs. user-level

- **Tracked** (`git ls-files` confirmed): `.claude/skills/**`, `.claude/agents/**`,
  `.claude/commands/**`, `.claude/DESIGN_SKILL_MAP.md` — the root `.gitignore` explicitly
  allowlists exactly these four paths under `/.claude/*`.
- **Local-only / gitignored** (present on disk, not tracked): `.claude/settings.local.json`,
  `.claude/DESIGN_WORKFLOW.md`, `.claude/launch.json`, `.claude/licenses/**`, and this file,
  `.claude/CAPABILITY_STACK.md`, unless the `.gitignore` allowlist is extended. **Flagging this
  as a gap**: this document and `DESIGN_WORKFLOW.md` describe durable governance policy but are
  currently invisible to anyone who only clones the repo. Fixing that requires editing root
  `.gitignore`, which is outside the "capability documentation under `.claude/`" scope of this
  pass — raise with the owner if durability is wanted.
- **User-level** (outside the repo entirely, in `~/.claude/`): all 5 plugin installs
  (`ui-ux-pro-max`, `superpowers`, `skill-creator`, `product-management`, `pw`), the marketplaces
  they came from, and `~/.claude/settings.json` (global marketplace registrations, theme, etc. —
  no hooks, no MCP servers declared there).
- **Cache-only**: plugin code under `~/.claude/plugins/cache/` and `~/.claude/plugins/marketplaces/`
  — reinstallable from their marketplace source, not hand-authored for this project.

## Non-functional or unverified capabilities

Confirmed this pass:

1. **`anthropic-webapp-testing`** — Python Playwright scripts cannot run. `python`/`python3`
   resolve to the Windows Store app-execution-alias stub (not a real interpreter); `pip` is not on
   PATH.
2. **`alireza-skill-security-auditor`**'s script branch — same missing-Python gap; the manual
   review guidance in the skill still applies.
3. **`pw` plugin's MCP servers** (`pw-testrail`, `pw-browserstack`) — required environment
   variables are unset.
4. **`pw` plugin's Playwright test execution** — ~~no `playwright.config.*` and no `playwright`
   package in this repo's `node_modules`~~ **RESOLVED**: `playwright.config.ts`, `@playwright/test`
   `1.62.1`, and a local Chromium binary now exist (see
   [Playwright Operational-Readiness Audit](#playwright-operational-readiness-audit)). Installed
   directly, not via `pw:init`; the `pw` plugin's authoring/infrastructure skills remain unused and
   still gated by the standing approval restriction. `pw-testrail`/`pw-browserstack` MCP servers
   remain non-functional (missing credentials) — unaffected by this change.
5. **`alireza-ux-researcher-designer`** — not installed anywhere in this project (see
   [Not installed](#not-installed)).
6. **`ui-ux-pro-max`'s `stack/.mcp.json`** MCP servers (playwright, chrome-devtools, shadcn) — not
   confirmed as part of the actually-loaded plugin manifest.
7. **`claude-code-skills` marketplace-root `.mcp.json`** (`tessl` server) — ownership/activation
   unconfirmed.

Carried forward from the existing `DESIGN_SKILL_MAP.md` audit, not re-verified this pass:

8. **`ui-animation`'s `scripts/*.py`** — documented as needing ffmpeg, OpenCV, and SciPy, not
   installed.
9. **`designer-design-review`**'s Playwright-MCP / `cursor-ide-browser`-MCP fallback chain —
   neither MCP server exists in this project; falls through to manual/preview verification.

## Playwright Operational-Readiness Audit

**STATUS: IMPLEMENTED (2026-08-06).** The plan below was proposed 2026-08-05 as a read-only
audit and executed the following day with explicit owner approval. Items 1–10 are the original
proposal text, left intact for the audit trail, with status corrections inline where reality now
differs from the plan. Item 11 (new) is the execution record. Scope was and remains a minimal
**Chromium-only** enablement plan for local Reserve verification, built to unblock the
`anthropic-webapp-testing` gap above without adopting the full `pw` (Playwright Pro) toolkit — see
[Non-functional or unverified capabilities](#non-functional-or-unverified-capabilities) item 4 for
how this relates to (and does not resolve) the `pw` plugin's separate authoring/infrastructure
restrictions.

**1. Documentation paths modified**: this file (`.claude/CAPABILITY_STACK.md`) only.
`DESIGN_SKILL_MAP.md`'s Browser/Playwright validation step still points here for status, no
content duplicated there.

**2. Current Playwright dependency status**: ~~not installed~~ **INSTALLED.**
`@playwright/test` **`1.62.1`** is now a direct `devDependency` in `package.json` and resolved in
`package-lock.json`/`node_modules/@playwright/test` (`npx playwright --version` → `1.62.1`). *(As
proposed, the pinned range was `^1.51.1` to match Next 16.2.6's optional peer; the version actually
resolved by npm at install time was `1.62.1`, the current release in that range — no peer-dependency
mismatch.)* `node_modules/.bin/playwright` now exists. Original text below, retained for context:
~~`package.json` declares no `playwright` or `@playwright/test` in `dependencies` or
`devDependencies`. `package-lock.json` mentions `@playwright/test` exactly once, as an optional
peer dependency of `next@16.2.6`... a second, unrelated mention is `@vitest/browser-playwright`,
also an unresolved optional peer.~~

**3. Current browser-binary status**: ~~none installed~~ **CHROMIUM INSTALLED LOCALLY.**
`npx playwright install chromium` completed; the local Playwright browser cache now contains the
Chromium binary used by every `test:e2e` run. No Firefox or WebKit binaries were installed —
Chromium-only, as required.

**4. Exact proposed npm commands** (not run):
```
npm install -D @playwright/test@^1.51.1
npx playwright install chromium
```
The `^1.51.1` pin matches the range Next.js 16.2.6 already declares as its optional peer, so this
choice avoids a peer-dependency mismatch warning. `playwright install chromium` — Chromium only,
no `firefox`/`webkit` arguments, per the no-Firefox/no-WebKit requirement.

**5. Exact files that would be created or modified** *(as proposed — see item 11 for what
actually happened, which matches this list plus one unplanned dev-only addition)*:
- **Create**: `playwright.config.ts` (repo root).
- **Modify**: `package.json` — add one script key only (e.g. `"test:e2e": "playwright test"`);
  every existing script (`dev`, `build`, `start`, `lint`, `typecheck`, `test`,
  `check:production-env`) stays untouched.
- **Modify**: `.gitignore` — add `/test-results/`, `/playwright-report/`, `/blob-report/` (none of
  the three currently listed; Playwright writes to them by default even with artifacts disabled,
  e.g. the HTML reporter's own output dir).
- **Not created this pass**: no test spec file. Section 7 below documents proposed *scope* for a
  first test only, per the "no sample tests" constraint.

**6. Proposed Playwright configuration** (`playwright.config.ts`, proposal text — not written):
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```
`baseURL`/`webServer.url` target `http://localhost:3000` — the confirmed default (`next dev` with
no `PORT` override in `next.config.ts`). Single `chromium` project only. `trace`/`screenshot`/
`video` explicitly `'off'`, matching the "disabled by default" requirement — an operator can still
pass `--trace on` etc. ad hoc from the CLI without changing the checked-in default.

**7. Proposed first test scope** (`src/components/auth/ReserveEntry.tsx`, description only, no
file written): target the **logged-out entry gate** — the component's own comment states "no
private member data renders behind this gate," making it the only screen in the app safe for an
unauthenticated automated check. Proposed assertions, all against the local dev server, all
pre-auth: page loads at `/`; "RESERVE LAB" mark and mission copy render; the Google sign-in
affordance is present and enabled; the email-toggle control opens the inline email/password form;
required form fields are present. Explicitly **out of scope**: submitting real credentials,
completing the Google OAuth redirect, any Supabase/Stripe network assertion, and anything behind
the auth gate.

**8. Security and privacy controls**: `baseURL` hard-pinned to `localhost:3000`, never a deployed
or external URL — satisfies "local Reserve application only" / "no external URLs" / "no
authenticated production session" / "no member data" (the proposed test scope never reaches an
authenticated view). `trace`/`screenshot`/`video` default `'off'` — nothing captured unless an
operator explicitly opts in per-run. `test-results/`, `playwright-report/`, `blob-report/` are
gitignored so no artifact (even an ad hoc opt-in one) can be accidentally committed. No CI file is
proposed or created, so nothing runs unattended — every execution is a manual, explicit
`npm run test:e2e` by an operator. No BrowserStack/TestRail credentials or MCP servers touched
(those remain the separately-documented, still-blocked `pw` plugin gap). No `.env*` files read,
written, or referenced by the proposed config.

**9. Rollback procedure**: `npm uninstall @playwright/test`; delete `playwright.config.ts` and
`tests/e2e/` (if ever created); revert the `package.json` script line and the three `.gitignore`
additions (`git checkout -- package.json .gitignore` or manual removal, since nothing here would
yet be committed); remove the downloaded Chromium binary via Playwright's own browser-management
command for whatever version gets installed (commonly `npx playwright uninstall`, or manual
deletion of the local Playwright browser cache directory) — full reversal touches only files this
plan itself would have created or modified, nothing else in the repo.

**10. Recommendation: GO** — ~~the only current blocker is this task's explicit instruction not to
execute it~~ **EXECUTED 2026-08-06 with explicit owner approval.** The plan proved out exactly as
assessed: minimal, additive-only, fully reversible, zero external network/service dependencies,
every stated constraint held (TypeScript, Chromium only, local-only, artifacts off by default, no
CI, existing scripts preserved). Node `v24.15.0` / npm `11.12.1` were sufficient; no dependency on
the still-missing Python runtime that blocks `anthropic-webapp-testing`.

**11. Execution record (new — 2026-08-06)**:

- **Installed**: `@playwright/test@1.62.1` (devDependency) + local Chromium binary. See items 2–3
  above.
- **Created**: `playwright.config.ts` (repo root) — Chromium-only project, `baseURL` hard-pinned to
  `http://127.0.0.1:3000`, `trace`/`screenshot`/`video` all `"off"`, HTML reporter with
  `open: "never"`, `webServer` runs `npm run dev` with `reuseExistingServer: !process.env.CI`.
  `tests/e2e/reserve-entry.spec.ts` — one Chromium test covering only the public,
  unauthenticated Reserve entry screen (`ReserveEntry.tsx`): sign-in UI renders; email/password
  inputs present at ≥16px computed font size; forgot-password control ≥44px touch target; no
  horizontal overflow at 375px width; vertical scroll still works in a constrained viewport;
  member-facing copy contains no `SUPABASE_*`/`NEXT_PUBLIC_SUPABASE` strings; reduced-motion mode
  still renders. No credentials submitted, no sign-in/reset/signup action triggered, no
  screenshots captured.
- **Modified as planned**: `package.json` (`"test:e2e": "playwright test"` added; all 7 prior
  scripts untouched), `package-lock.json` (lockfile entries for the new dependency),
  `.gitignore` (`/test-results/`, `/playwright-report/`, `/blob-report/`, `/playwright/.cache/`
  added).
- **Modified beyond the original plan (unplanned but necessary)**: `next.config.ts` — added
  `allowedDevOrigins: ["127.0.0.1"]`. Root cause: Next.js 16's dev server only trusts the
  `localhost` origin for its Fast Refresh/HMR bootstrap by default; loading the dev server via
  `127.0.0.1` (this harness's required `baseURL`) silently blocked all client-side JavaScript from
  executing, which looked like an auth hang but was proven — via a `localhost`-vs-`127.0.0.1` A/B
  test with full `auth-js` debug tracing — to have nothing to do with Supabase, sessions, or Web
  Locks. `allowedDevOrigins` is a **dev-server-only** Next.js config option with no code path in
  `next build`/`next start`; confirmed by identical production build output before and after. No
  auth source file (`src/lib/supabase/client.ts`, `src/components/auth/AuthProvider.tsx`) was
  changed.
- **Verified**: `npm run test:e2e` passed 3 consecutive runs (no flakiness, ~1s test execution
  each after server boot); `npm run lint` clean; `npm run build` clean (all 45 routes generated,
  identical route table before/after).
- **Restrictions preserved, unchanged by this work**: no external or production URL is reachable
  (`baseURL` hard-pinned to the local dev server only); no production authentication path is
  exercised; no member data is read or used; `trace`/`screenshot`/`video` remain `"off"` in
  config; BrowserStack and TestRail (`pw-browserstack`, `pw-testrail` MCP servers) remain
  unauthenticated and untouched; no CI workflow file was generated or proposed; no infrastructure
  (Docker, deployment, GitHub Actions) was touched. **Test execution remains manual and
  approval-gated**: there is no hook, cron, or automatic trigger that runs `npm run test:e2e` — it
  only runs when an operator explicitly invokes it, exactly as before this change.
- **Rollback**: unchanged from item 9 above, plus reverting the single `next.config.ts` line
  (`git checkout -- next.config.ts` or manual removal of the `allowedDevOrigins` key).

## Collision matrix

### Skill Creator vs. Superpowers writing-skills

Both can author or edit skill files. **Skill Creator** is the general-purpose authoring/eval tool;
**Superpowers' `writing-skills`** is specifically for creating/editing/verifying *Superpowers-style*
skills before deployment, with its own rigor checklist. They are not mutually exclusive, but don't
run both on the same target in the same pass — pick one authority per skill-authoring task. Neither
may touch a production Reserve skill without approval (standing restriction on Skill Creator
applies in spirit to both).

### Product Management vs. UX Researcher Designer

`product-management` (enabled plugin) does synthesis-adjacent work (`synthesize-research`,
`metrics-review`, `competitive-brief`) but is not itself a UX research methodology skill.
`ux-researcher-designer` (the `product-team` plugin's skill) would be the actual UX-research
counterpart — **but it is not installed** in this project (see [Not installed](#not-installed)).
There is currently no collision because only one side of this pair exists here. If
`ux-researcher-designer` is added later, keep primary-research claims (interviews, usability
testing) under it and keep `product-management`'s synthesis skills scoped to synthesizing
*already-collected* data — neither may present synthetic/simulated findings as real research
(standing restriction).

### Anthropic Web App Testing vs. Playwright Pro

Both drive a browser against the local dev server. **Anthropic Web App Testing** is the lighter,
sanctioned-by-Anthropic tool for ad hoc verification (screenshots, DOM checks, console logs) — use
it for "does this screen work" questions. **Playwright Pro (`pw`)** is a full test-authoring
toolkit for durable `*.spec.ts` suites, CI integration, TestRail/BrowserStack — heavier-weight and
gated by the standing "authoring and infrastructure workflows require approval" restriction.

**Status changed since the prior pass.** Web App Testing remains blocked (missing Python runtime,
unchanged). `pw`'s own authoring/infrastructure skills remain unused and still gated by the
standing approval restriction. But a **third path** now exists between them: a minimal,
hand-authored, Chromium-only Playwright harness (`playwright.config.ts` +
`tests/e2e/reserve-entry.spec.ts`, installed directly rather than via `pw:init`) — see
[Playwright Operational-Readiness Audit](#playwright-operational-readiness-audit). This is now
**the active browser-verification path** for the one screen it covers (the public,
unauthenticated Reserve entry gate), run manually via `npm run test:e2e`. It does not replace Web
App Testing for general ad hoc "does this screen work" checks elsewhere in the app (still blocked
by the Python gap) and it does not constitute adoption of the `pw` toolkit's authoring/CI/
BrowserStack/TestRail capabilities (still gated separately, unchanged). Don't extend this minimal
harness into general test infrastructure without a separate, explicit owner go-ahead — its scope
is intentionally limited to the one screen it was approved for.

### UI/UX Pro Max vs. Taste vs. frontend-design/interface-design

Four different "how should this look" voices. Precedence for Reserve work:
`reserve-design-constitution` and `DESIGN_BIBLE.md` decide identity and system; `frontend-design`
and `interface-design` execute within that system (general aesthetic direction vs. craft-first
hierarchy/consistency, respectively); `design-taste-frontend` contributes an anti-slop/audit-first
lens, mainly useful on redesigns; `ui-ux-pro-max` is reference-only (styles/palettes/pairings to
consult, generators disabled). None of the four may override the Constitution or shipped tokens.
When two disagree on a purely aesthetic call the Constitution doesn't settle, `reserve-design-
director` breaks the tie, not the skills themselves.

### Reserve agents vs. generic external reviewers

`reserve-design-director`, `reserve-mobile-critic`, `reserve-copy-director`,
`reserve-accessibility-auditor`, and `reserve-visual-qa` are the binding review layer for Reserve
screens — they read the Constitution first and their verdicts are what gates a screen as finished.
Generic external audit skills (`ui-audit`, `typography-audit`, `designer-design-review`,
`interface-design:design-review`) may run alongside or before them and surface useful findings,
but they do not carry the same authority (tier 6 vs. tier 5) and none of them know Reserve's
clinical-compliance rules. A generic skill flagging something the Reserve agents didn't is a
useful second opinion; a generic skill clearing something a Reserve agent flagged does not clear
it.

---

## Verification method

Everything in this document was checked directly against the filesystem on 2026-08-05:
`.claude/settings.local.json` for enabled plugins and permissions; `git ls-files` /
`git check-ignore` for tracked-vs-local-only status; each plugin's `.claude-plugin/plugin.json`,
`.mcp.json`, and `hooks/hooks.json` (or their absence) under `~/.claude/plugins/`; each skill's
`PROVENANCE.md` where present; agent frontmatter for tool grants; and live checks of `python`,
`pip`, `playwright.config.*`, and the relevant environment variables in this shell. Items marked
**UNKNOWN** or **not confirmed** were not resolvable from available files and should not be
treated as verified.

**2026-08-06 addendum**: the Playwright-related sections above (`pw` plugin's runtime
dependencies/hooks, `anthropic-webapp-testing`'s "not the active path" note, the
[Playwright Operational-Readiness Audit](#playwright-operational-readiness-audit), and the
Anthropic Web App Testing vs. Playwright Pro collision entry) were re-verified against the
filesystem on this date: `npx playwright --version` (`1.62.1`), `node_modules/@playwright/test`
presence, local Chromium binary presence, `playwright.config.ts` and
`tests/e2e/reserve-entry.spec.ts` contents, 3 consecutive `npm run test:e2e` passes, clean
`npm run lint` and `npm run build`, and direct reads of `detect-playwright.sh`/`validate-test.sh`
to confirm both remain read-only/advisory. No other section of this document was re-verified on
this date; everything outside the Playwright sections still reflects the 2026-08-05 audit.
