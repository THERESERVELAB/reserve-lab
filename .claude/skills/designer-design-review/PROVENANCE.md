# Provenance — designer-design-review

Third-party skill vendored into this repository at project scope.

| Field | Value |
|---|---|
| Source repo | `https://github.com/julianoczkowski/designer-skills` |
| Path in source | `design-review/SKILL.md` |
| Commit inspected | `c259656c76d9758d7ead46b0d2f125cbe84f8665` |
| License | Apache-2.0 (LICENSE) |
| Scope | Project-local (`.claude/skills/`), not global |

## Modifications (namespacing — required)

This package ships a skill named `frontend-design`, which collides with Anthropic's
official `frontend-design` skill installed alongside it. Rather than let one silently
overwrite the other, all eight skills from this package were installed with a `designer-`
prefix:

1. Directory renamed `design-review` → `designer-design-review`
2. Frontmatter `name: design-review` → `name: designer-design-review`
3. Internal cross-references rewritten: sibling `<skill>/SKILL.md` paths and
   `/<skill>` slash-command mentions now point at their `designer-` equivalents

Plugin-marketplace installation would have provided this namespacing natively, but it
requires mutating Claude settings, which this mission prohibits. No other content changed.

Reviewed for executable scripts, git hooks, MCP servers, telemetry, settings mutation,
credential access, and outbound network calls before installation. None found.

**Governed by** `.claude/skills/reserve-design-constitution/` and
`.claude/DESIGN_SKILL_MAP.md`.
