# Owner Mode Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recognize the founder's account as `OWNER` from server-verified identity and gate owner-only features through explicit capabilities, without ever weakening safety.

**Architecture:** A pure capability model (`src/lib/authz/capabilities.ts`) and a pure resolver (`resolve-access.ts`) decide access from a verified user id plus server-only settings. A thin server wrapper and `GET /api/account/capabilities` expose it. A client `CapabilitiesProvider` holds the answer in memory only, and `useCan` / `useSafetyToolsVisible` gate the UI. Safety modules never import the capability layer.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase bearer verification (`resolveRequestUser`), Vitest (node), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-15-owner-mode-stage-1-design.md`

**Workspace:** worktree `.claude/worktrees/owner-mode-stage-1`, branch `claude/owner-mode-stage-1`. Run npm scripts, not `npx` (see memory: worktrees resolve `node_modules` from the main checkout). Use `node <main>/node_modules/vitest/vitest.mjs` for targeted vitest runs.

---

## File map

| File | Responsibility |
|---|---|
| Create `src/lib/authz/capabilities.ts` | Roles, capability list, `can`, `accessForRole`, `parseAccessResponse`, `MEMBER_ACCESS` |
| Create `src/lib/authz/resolve-access.ts` | Pure `parseOwnerAllowlist`, `resolveAccess(inputs)` |
| Create `src/lib/authz/access.server.ts` | `resolveRequestAccess(request)`: gathers verified user + server env |
| Create `src/app/api/account/capabilities/route.ts` | `GET` → `{ role, capabilities, source }`, no-store |
| Modify `src/lib/env/server.ts` | Add `RESERVE_OWNER_USER_IDS`, `RESERVE_DEV_OWNER` |
| Create `src/components/authz/CapabilitiesProvider.tsx` | In-memory provider, `useAccess`, `useCan`, `useSafetyToolsVisible` |
| Create `src/components/authz/OwnerResearchMode.tsx` | `OWNER_MODE_LABEL`, `OwnerModeAccountLine`, `OwnerPendingReviewNote` |
| Modify `src/components/AppShell.tsx` | Mount provider inside `AuthProvider` |
| Modify `src/components/views/CompoundCommandView.tsx` | Tabs + render via hook; owner badge |
| Modify `src/components/views/BloodworkView.tsx` | Three switch checks via hook |
| Modify `src/components/cycle/CycleCommandTab.tsx` | Owner pending-review note |
| Modify `src/components/views/SettingsView.tsx` | Owner account line |
| Tests `src/lib/authz/__tests__/*.test.ts` | Model, resolver, route, isolation, safety boundary |
| Test `tests/e2e/owner-mode.spec.ts` | Owner server and member server journeys |
| Docs | CLAUDE.md, amendment, deployment guide, counsel brief |

---

### Task 1: Capability model

**Files:** Create `src/lib/authz/capabilities.ts`; Test `src/lib/authz/__tests__/capabilities.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { CAPABILITIES, MEMBER_ACCESS, ROLE_CAPABILITIES, accessForRole, can, parseAccessResponse } from "../capabilities";

describe("capabilities", () => {
  it("gives the owner every capability and a member none", () => {
    const owner = accessForRole("owner", "allowlist");
    for (const capability of CAPABILITIES) {
      expect(can(owner, capability), capability).toBe(true);
      expect(can(MEMBER_ACCESS, capability), capability).toBe(false);
    }
    expect(ROLE_CAPABILITIES.member).toEqual([]);
  });

  it("treats missing access as a member", () => {
    expect(can(null, "review-pending-safety-tools")).toBe(false);
    expect(can(undefined, "owner-research-tools")).toBe(false);
  });

  it("never defines a capability that switches safety off", () => {
    for (const capability of CAPABILITIES) {
      expect(capability).not.toMatch(/bypass|disable|skip|silence|suppress|override|mute|hide-warning|no-safety/i);
    }
  });

  it("derives capabilities from a well-formed server answer and ignores anything forged", () => {
    expect(parseAccessResponse({ role: "owner", source: "allowlist", capabilities: [] })).toEqual(accessForRole("owner", "allowlist"));
    expect(parseAccessResponse({ role: "owner", source: "dev-owner" }).role).toBe("owner");
    expect(parseAccessResponse({ role: "member", source: "allowlist", capabilities: [...CAPABILITIES] })).toBe(MEMBER_ACCESS);
    expect(parseAccessResponse({ role: "owner", source: "client" })).toBe(MEMBER_ACCESS);
    expect(parseAccessResponse({ isOwner: true, ownerModeEnabled: true })).toBe(MEMBER_ACCESS);
    expect(parseAccessResponse(null)).toBe(MEMBER_ACCESS);
    expect(parseAccessResponse("owner")).toBe(MEMBER_ACCESS);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `node ../../../node_modules/vitest/vitest.mjs run src/lib/authz/__tests__/capabilities.test.ts` → FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
/* ════════════════════════════════════════════════════════════════════════
   CAPABILITIES — what an account may use beyond the member feature set.

   Access is a role plus an explicit list of capabilities, decided on the
   server (see access.server.ts). Features ask can(access, capability) —
   never "is this the owner?". No capability may disable, bypass or silence
   a safety system: Owner Mode adds information, never fewer warnings.
   ════════════════════════════════════════════════════════════════════════ */

export const ROLES = ["member", "owner"] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  /** See Cycle & Safety, the Bloodwork safety panel and "What this measures" while the launch switch hides them for members. */
  "review-pending-safety-tools",
  "advanced-cycle-tracking",
  "custom-cycle-entry",
  "owner-research-tools",
  "raw-lab-analytics",
  "advanced-support-plan",
  "experimental-features",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  member: [],
  owner: CAPABILITIES,
};

/** allowlist — verified user on RESERVE_OWNER_USER_IDS · dev-owner — local development flag · default — member */
export type AccessSource = "allowlist" | "dev-owner" | "default";

export type AccessContext = { role: Role; capabilities: readonly Capability[]; source: AccessSource };

export const MEMBER_ACCESS: AccessContext = Object.freeze({ role: "member", capabilities: ROLE_CAPABILITIES.member, source: "default" });

export function accessForRole(role: Role, source: AccessSource): AccessContext {
  return role === "member" ? MEMBER_ACCESS : { role, capabilities: ROLE_CAPABILITIES[role], source };
}

export function can(access: AccessContext | null | undefined, capability: Capability): boolean {
  return Boolean(access?.capabilities.includes(capability));
}

/**
 * Reads the capabilities route's answer. Capabilities are derived from the
 * role — a capabilities array in the payload is never trusted — and anything
 * malformed is member access.
 */
export function parseAccessResponse(value: unknown): AccessContext {
  if (!value || typeof value !== "object") return MEMBER_ACCESS;
  const { role, source } = value as { role?: unknown; source?: unknown };
  if (role !== "owner") return MEMBER_ACCESS;
  if (source !== "allowlist" && source !== "dev-owner") return MEMBER_ACCESS;
  return accessForRole("owner", source);
}
```

- [ ] **Step 4: Run to verify it passes** — same command → PASS (4 tests)

### Task 2: Pure owner resolver

**Files:** Create `src/lib/authz/resolve-access.ts`; Test `src/lib/authz/__tests__/resolve-access.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { MEMBER_ACCESS } from "../capabilities";
import { parseOwnerAllowlist, resolveAccess, type AccessInputs } from "../resolve-access";

const OWNER = "4f1c2b9e-8d7a-4c3b-9e1f-0a2b3c4d5e6f";
const OTHER = "11111111-2222-4333-8444-555555555555";
const base: AccessInputs = { verifiedUserId: null, ownerAllowlist: OWNER, devOwnerFlag: undefined, nodeEnv: "production", supabaseConfigured: true };

describe("owner allowlist", () => {
  it("accepts only UUIDs, trimmed and case-insensitive", () => {
    expect([...parseOwnerAllowlist(` ${OWNER.toUpperCase()} , owner@example.com, , not-a-uuid,${OTHER}`)]).toEqual([OWNER, OTHER]);
    expect(parseOwnerAllowlist(undefined).size).toBe(0);
    expect(parseOwnerAllowlist("").size).toBe(0);
  });
});

describe("resolveAccess", () => {
  it("1. makes a verified allowlisted user the owner", () => {
    expect(resolveAccess({ ...base, verifiedUserId: OWNER })).toMatchObject({ role: "owner", source: "allowlist" });
  });

  it("2. keeps every other verified user a member", () => {
    expect(resolveAccess({ ...base, verifiedUserId: OTHER })).toBe(MEMBER_ACCESS);
  });

  it("8. is a member when signed out or when no allowlist is set", () => {
    expect(resolveAccess(base)).toBe(MEMBER_ACCESS);
    expect(resolveAccess({ ...base, verifiedUserId: OWNER, ownerAllowlist: undefined })).toBe(MEMBER_ACCESS);
  });

  it("3. never honors the dev owner flag in production or when Supabase is configured", () => {
    expect(resolveAccess({ ...base, devOwnerFlag: "true", nodeEnv: "production", supabaseConfigured: false })).toBe(MEMBER_ACCESS);
    expect(resolveAccess({ ...base, devOwnerFlag: "true", nodeEnv: "development", supabaseConfigured: true })).toBe(MEMBER_ACCESS);
    expect(resolveAccess({ ...base, devOwnerFlag: "1", nodeEnv: "development", supabaseConfigured: false })).toBe(MEMBER_ACCESS);
    expect(resolveAccess({ ...base, devOwnerFlag: "true", nodeEnv: "development", supabaseConfigured: false })).toMatchObject({ role: "owner", source: "dev-owner" });
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
import { MEMBER_ACCESS, accessForRole, type AccessContext } from "./capabilities";

/* Decides access from facts the server already verified. Pure: no request,
   no environment reads — access.server.ts supplies the inputs. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Supabase user ids only. Emails, blanks and anything else are dropped. */
export function parseOwnerAllowlist(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => UUID.test(entry)),
  );
}

export type AccessInputs = {
  /** From a verified Supabase access token — never from the request body. */
  verifiedUserId: string | null;
  ownerAllowlist: string | undefined;
  devOwnerFlag: string | undefined;
  nodeEnv: string | undefined;
  supabaseConfigured: boolean;
};

export function resolveAccess(inputs: AccessInputs): AccessContext {
  if (inputs.verifiedUserId && parseOwnerAllowlist(inputs.ownerAllowlist).has(inputs.verifiedUserId.toLowerCase())) {
    return accessForRole("owner", "allowlist");
  }
  // Local development only: never in a production build, never with real sign-in configured.
  if (inputs.devOwnerFlag === "true" && inputs.nodeEnv !== "production" && !inputs.supabaseConfigured) {
    return accessForRole("owner", "dev-owner");
  }
  return MEMBER_ACCESS;
}
```

- [ ] **Step 4: Run to verify it passes** → PASS
- [ ] **Step 5: Commit** — `git add src/lib/authz && git commit -m "feat(authz): capability model and owner resolver"`

### Task 3: Server wrapper, route and env

**Files:** Create `src/lib/authz/access.server.ts`, `src/app/api/account/capabilities/route.ts`; Modify `src/lib/env/server.ts`; Test `src/lib/authz/__tests__/capabilities-route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: null as { id: string; email: string | null } | null, configured: true }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/route-auth", () => ({ resolveRequestUser: vi.fn(async () => mocks.user) }));
vi.mock("@/lib/supabase/server", () => ({ getSupabasePublicStatus: () => ({ configured: mocks.configured }) }));

import * as route from "@/app/api/account/capabilities/route";

const OWNER = "4f1c2b9e-8d7a-4c3b-9e1f-0a2b3c4d5e6f";
const MEMBER = "11111111-2222-4333-8444-555555555555";
const get = async (init: RequestInit & { url?: string } = {}) => {
  const response = await route.GET(new Request(init.url ?? "http://localhost/api/account/capabilities", init));
  return { response, body: (await response.json()) as { role: string; capabilities: string[]; source: string } };
};

beforeEach(() => {
  mocks.user = null;
  mocks.configured = true;
  vi.stubEnv("RESERVE_OWNER_USER_IDS", OWNER);
  vi.stubEnv("RESERVE_DEV_OWNER", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/account/capabilities", () => {
  it("1. returns owner capabilities for the verified allowlisted account, uncached", async () => {
    mocks.user = { id: OWNER, email: null };
    const { response, body } = await get({ headers: { authorization: "Bearer token" } });
    expect(body).toMatchObject({ role: "owner", source: "allowlist" });
    expect(body.capabilities).toContain("review-pending-safety-tools");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("2. returns member access for any other account and when signed out", async () => {
    mocks.user = { id: MEMBER, email: null };
    expect((await get()).body).toEqual({ role: "member", capabilities: [], source: "default" });
    mocks.user = null;
    expect((await get()).body.role).toBe("member");
  });

  it("3. ignores role claims in the query, headers and cookies", async () => {
    mocks.user = { id: MEMBER, email: null };
    const { body } = await get({
      url: "http://localhost/api/account/capabilities?role=owner&isOwner=true",
      headers: { "x-reserve-role": "owner", "x-user-id": OWNER, cookie: "role=owner; ownerModeEnabled=true" },
    });
    expect(body.role).toBe("member");
    expect(Object.keys(route)).toEqual(["GET", "dynamic"].filter((key) => key in route));
  });

  it("3. never reads a public look-alike of the allowlist", async () => {
    mocks.user = { id: OWNER, email: null };
    vi.stubEnv("RESERVE_OWNER_USER_IDS", "");
    vi.stubEnv("NEXT_PUBLIC_RESERVE_OWNER_USER_IDS", OWNER);
    expect((await get()).body.role).toBe("member");
  });

  it("3. ignores the dev owner flag when real sign-in is configured", async () => {
    vi.stubEnv("RESERVE_DEV_OWNER", "true");
    mocks.configured = true;
    expect((await get()).body.role).toBe("member");
    mocks.configured = false;
    vi.stubEnv("NODE_ENV", "development");
    expect((await get()).body).toMatchObject({ role: "owner", source: "dev-owner" });
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL (route module not found)

- [ ] **Step 3: Implement `access.server.ts`**

```ts
import "server-only";

import { getSupabasePublicStatus } from "@/lib/supabase/server";
import { resolveRequestUser } from "@/lib/supabase/route-auth";

import type { AccessContext } from "./capabilities";
import { resolveAccess } from "./resolve-access";

/**
 * The acting account's access. Identity comes only from the verified bearer
 * token; owner status only from server-only settings read at request time.
 * The request body, query, cookies and other headers are never consulted.
 */
export async function resolveRequestAccess(request: Request): Promise<AccessContext> {
  const supabaseConfigured = getSupabasePublicStatus().configured;
  const user = supabaseConfigured ? await resolveRequestUser(request) : null;
  return resolveAccess({
    verifiedUserId: user?.id ?? null,
    ownerAllowlist: process.env.RESERVE_OWNER_USER_IDS,
    devOwnerFlag: process.env.RESERVE_DEV_OWNER,
    nodeEnv: process.env.NODE_ENV,
    supabaseConfigured,
  });
}
```

- [ ] **Step 4: Implement the route**

```ts
import { NextResponse } from "next/server";

import { resolveRequestAccess } from "@/lib/authz/access.server";

export const dynamic = "force-dynamic";

/** This account's role and capabilities. Member access for anyone not verified as the owner. */
export async function GET(request: Request) {
  const access = await resolveRequestAccess(request);
  return NextResponse.json(
    { role: access.role, capabilities: access.capabilities, source: access.source },
    { headers: { "Cache-Control": "no-store" } },
  );
}
```

- [ ] **Step 5: Add env keys** to `serverEnvSchema` and the parse call in `src/lib/env/server.ts`:

```ts
  /** Server-only. Comma-separated Supabase user ids with Owner Mode. */
  RESERVE_OWNER_USER_IDS: optionalString,
  /** Server-only, local development only ("true"). Ignored in production builds and when Supabase is configured. */
  RESERVE_DEV_OWNER: optionalString,
```
```ts
  RESERVE_OWNER_USER_IDS: process.env.RESERVE_OWNER_USER_IDS,
  RESERVE_DEV_OWNER: process.env.RESERVE_DEV_OWNER,
```

- [ ] **Step 6: Run to verify it passes** → PASS
- [ ] **Step 7: Commit** — `git commit -m "feat(authz): server-verified capabilities route"`

### Task 4: Client provider and hooks

**Files:** Create `src/components/authz/CapabilitiesProvider.tsx`; Modify `src/components/AppShell.tsx`

- [ ] **Step 1: Implement the provider**

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { MEMBER_ACCESS, can, parseAccessResponse, type AccessContext, type Capability } from "@/lib/authz/capabilities";
import { SAFETY_TOOLS_ENABLED } from "@/lib/launch/safety-tools";
import { authorizedFetch } from "@/lib/supabase/client-auth";

/* ════════════════════════════════════════════════════════════════════════
   CAPABILITIES PROVIDER — this account's access, from the server.

   Loaded after sign-in, on account switch and sign-out (and once in local
   mode). Held in React memory only: never the persisted store, never cloud
   sync, never localStorage. Loading, errors and a previous account's answer
   all read as member access.
   ════════════════════════════════════════════════════════════════════════ */

const AccessReactContext = createContext<AccessContext>(MEMBER_ACCESS);

const CAPABILITIES_PATH = "/api/account/capabilities";

export function CapabilitiesProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const accountKey = status === "signed-in" && user ? `user:${user.id}` : status === "unconfigured" ? "local" : null;
  const [loaded, setLoaded] = useState<{ key: string; access: AccessContext } | null>(null);

  useEffect(() => {
    if (!accountKey) return;
    let cancelled = false;
    (async () => {
      try {
        const response =
          accountKey === "local" ? await fetch(CAPABILITIES_PATH, { cache: "no-store" }) : await authorizedFetch(CAPABILITIES_PATH, { cache: "no-store" });
        const access = parseAccessResponse(response.ok ? await response.json() : null);
        if (!cancelled) setLoaded({ key: accountKey, access });
      } catch {
        if (!cancelled) setLoaded({ key: accountKey, access: MEMBER_ACCESS });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountKey]);

  const access = accountKey && loaded?.key === accountKey ? loaded.access : MEMBER_ACCESS;
  return <AccessReactContext.Provider value={access}>{children}</AccessReactContext.Provider>;
}

export function useAccess(): AccessContext {
  return useContext(AccessReactContext);
}

export function useCan(capability: Capability): boolean {
  return can(useAccess(), capability);
}

/** Review-pending safety tools: on for everyone when the launch switch is on, otherwise only with the capability. */
export function useSafetyToolsVisible(): boolean {
  const ownerAccess = useCan("review-pending-safety-tools");
  return SAFETY_TOOLS_ENABLED || ownerAccess;
}
```

- [ ] **Step 2: Mount it** in `AppShell`:

```tsx
import { CapabilitiesProvider } from "./authz/CapabilitiesProvider";
// …
    <AuthProvider>
      <CapabilitiesProvider>
        <AuthenticatedShell>{children}</AuthenticatedShell>
      </CapabilitiesProvider>
    </AuthProvider>
```

- [ ] **Step 3: Type-check** — `npm run typecheck` → clean
- [ ] **Step 4: Commit** — `git commit -m "feat(authz): in-memory capabilities provider"`

### Task 5: Gate the surfaces and add owner UI

**Files:** Create `src/components/authz/OwnerResearchMode.tsx`; Modify `CompoundCommandView.tsx`, `BloodworkView.tsx`, `CycleCommandTab.tsx`, `SettingsView.tsx`

- [ ] **Step 1: Owner UI pieces**

```tsx
"use client";

import { SAFETY_TOOLS_ENABLED } from "@/lib/launch/safety-tools";

import { useCan } from "./CapabilitiesProvider";

export const OWNER_MODE_LABEL = "Owner research mode";

/** Settings → Account. Rendered only for accounts with owner research tools. */
export function OwnerModeAccountLine() {
  if (!useCan("owner-research-tools")) return null;
  return (
    <p className="mt-3 border-t border-white/[0.05] pt-3 text-[10px] leading-4 text-white/55">
      <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-[#e8c87a]">{OWNER_MODE_LABEL}</span>
      <span className="mt-1 block">Private self-tracking and experimental analytics. Safety warnings and escalation still apply.</span>
    </p>
  );
}

/** Cycle & Safety, while the launch switch hides these tools for members. */
export function OwnerPendingReviewNote() {
  const owner = useCan("review-pending-safety-tools");
  if (!owner || SAFETY_TOOLS_ENABLED) return null;
  return (
    <p role="note" className="text-[12px] leading-[1.5] text-white/55">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#e8c87a]">{OWNER_MODE_LABEL}</span> · These tools are pending clinician and counsel review and are hidden for members.
    </p>
  );
}
```

- [ ] **Step 2: Compound Command** — remove module `TABS`; inside the component:

```tsx
  const safetyToolsVisible = useSafetyToolsVisible();
  const ownerResearch = useCan("owner-research-tools");
  const tabs = safetyToolsVisible ? ALL_TABS : ALL_TABS.filter((t) => t.key !== "cycle");
```
`<ViewShell … badge={ownerResearch ? OWNER_MODE_LABEL : undefined}>`, `{tabs.map(…)}`, `{safetyToolsVisible && tab === "cycle" && <CycleCommandTab />}`.

- [ ] **Step 3: Bloodwork** — `const safetyToolsVisible = useSafetyToolsVisible();` at the top of `BloodworkView`, replacing the three `SAFETY_TOOLS_ENABLED` uses (`measures`, `LabSafetyPanel`, history descriptions) and the import.

- [ ] **Step 4: Cycle & Safety** — first child of the `CycleCommand` column: `<OwnerPendingReviewNote />`.

- [ ] **Step 5: Settings** — `<OwnerModeAccountLine />` directly above the Open-source notices paragraph in `AccountSection`.

- [ ] **Step 6:** `npm run typecheck` and `npm run lint` → clean
- [ ] **Step 7: Commit** — `git commit -m "feat(authz): owner access to review-pending safety tools and Owner research mode UI"`

### Task 6: Isolation and safety boundary tests

**Files:** Test `src/lib/authz/__tests__/access-isolation.test.ts`, `src/lib/authz/__tests__/safety-boundary.test.ts`

- [ ] **Step 1: Isolation test**

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { hydrateMemberState, resetMemberStateToDefaults, serializeMemberState, useAthleteDashboardStore } from "@/lib/athlete-store";
import { MEMBER_ACCESS, parseAccessResponse } from "@/lib/authz/capabilities";
import { PRIVATE_DEVICE_KEYS } from "@/lib/auth/device-isolation";
import { MEMBER_STATE_KEYS } from "@/lib/sync/state-contract";

const ACCESS_KEY = /role|capabilit|owner|access|privilege/i;

beforeEach(() => resetMemberStateToDefaults());

describe("owner access stays out of member data", () => {
  it("4. is never a persisted, synced or device key", () => {
    expect(MEMBER_STATE_KEYS.filter((key) => ACCESS_KEY.test(key))).toEqual([]);
    expect(PRIVATE_DEVICE_KEYS.filter((key) => ACCESS_KEY.test(key))).toEqual([]);
  });

  it("3. ignores forged owner fields in saved or synced member state", () => {
    hydrateMemberState({ role: "owner", isOwner: true, ownerModeEnabled: true, capabilities: ["review-pending-safety-tools"] });
    const state = useAthleteDashboardStore.getState() as unknown as Record<string, unknown>;
    expect(state.role).toBeUndefined();
    expect(state.isOwner).toBeUndefined();
    expect(state.capabilities).toBeUndefined();
    expect(Object.keys(serializeMemberState()).filter((key) => ACCESS_KEY.test(key))).toEqual([]);
    expect(parseAccessResponse(state)).toBe(MEMBER_ACCESS);
  });

  it("8. the default member experience carries no owner state", () => {
    const initial = useAthleteDashboardStore.getInitialState() as unknown as Record<string, unknown>;
    expect(Object.keys(initial).filter((key) => /owner|capabilit|privilege/i.test(key))).toEqual([]);
  });
});
```

- [ ] **Step 2: Safety boundary test**

```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { EMERGENCY_COPY } from "@/lib/safety/escalation";

const SAFETY_DIRS = ["src/lib/safety", "src/lib/labs", "src/lib/compound-intelligence", "src/lib/cycle-review", "src/lib/cycle", "src/components/safety", "src/components/labs"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("safety systems cannot be switched off by access", () => {
  it("6, 7. no safety module imports the capability layer", () => {
    const offenders = SAFETY_DIRS.flatMap((dir) => sourceFiles(join(process.cwd(), dir)))
      .filter((file) => /@\/(lib|components)\/authz|\/authz\//.test(readFileSync(file, "utf8")))
      .map((file) => relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });

  it("7. emergency copy still routes to 911 and 988", () => {
    expect(Object.values(EMERGENCY_COPY).join(" ")).toMatch(/911/);
    expect(Object.values(EMERGENCY_COPY).join(" ")).toMatch(/988/);
  });
});
```

- [ ] **Step 3:** run both → PASS
- [ ] **Step 4: Commit** — `git commit -m "test(authz): owner access isolation and safety boundary"`

### Task 7: E2E journeys

**Files:** Test `tests/e2e/owner-mode.spec.ts`; gitignored launchers `.claude/reserve-owner-dev.cjs` (port 3330), `.claude/reserve-member-dev.cjs` (port 3331), config in `.claude/launch.json`

Launchers (run one at a time; they share `.next`):

```js
/* eslint-disable */
// Owner-mode local dev server for this worktree: Supabase blanked, launch switch OFF, dev owner ON.
process.chdir(require("node:path").resolve(__dirname, ".."));
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) process.env[key] = " ";
process.env.NEXT_PUBLIC_ENABLE_SAFETY_TOOLS = "false";
process.env.RESERVE_DEV_OWNER = "true";
process.argv = [process.execPath, "next", "dev", "-p", process.env.PORT || "3330"];
require("next/dist/bin/next");
```
The member launcher is identical with `RESERVE_DEV_OWNER` deleted and port 3331.

- [ ] **Step 1: Spec**

```ts
import { test, expect, type Page } from "@playwright/test";

/**
 * OWNER MODE — run against a local server with the launch switch OFF.
 *   RESERVE_E2E_OWNER_MODE=owner  → server with RESERVE_DEV_OWNER=true
 *   RESERVE_E2E_OWNER_MODE=member → server without it
 * Skipped otherwise, so the normal suite is unaffected.
 */

const MODE = process.env.RESERVE_E2E_OWNER_MODE;

async function boot(page: Page, view: string, extra: Record<string, unknown> = {}) {
  const stamp = new Date().toISOString();
  await page.addInitScript(
    ({ v, state }) => {
      window.localStorage.setItem("fba-preview-view", v);
      if (!window.localStorage.getItem("final-boss-athlete-settings")) {
        window.localStorage.setItem("final-boss-athlete-settings", JSON.stringify({ state, version: 0 }));
      }
    },
    {
      v: view,
      state: {
        subscriptionTier: "elite",
        onboarding: { status: "complete", currentStep: 99, startedAt: stamp },
        trainingSession: {
          enhancementLog: [
            { id: "o-test", name: "Testosterone Cypionate", officialName: "Testosterone Cypionate", compoundClass: "hormones_testosterone", category: "hormone", doseAmount: "", doseUnit: "mg", frequency: "", timingPreference: "", goalAssociation: [], isActive: true, createdAt: stamp, updatedAt: stamp },
          ],
        },
        bloodworkLogs: [
          { id: "o-lab", testDate: "2026-09-01", createdAt: stamp, markers: [{ name: "Hematocrit", value: "52.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H", markerKey: "hematocrit" }] },
        ],
        ...extra,
      },
    },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
}

test.describe("owner mode — owner account", () => {
  test.skip(MODE !== "owner", "Needs the dev-owner server (launch switch off).");
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(240_000);

  test("5, 6, 7. the owner uses Cycle & Safety with the switch off, and every safeguard still applies", async ({ page }) => {
    const capabilities = await (await page.request.get("/api/account/capabilities")).json();
    expect(capabilities).toMatchObject({ role: "owner", source: "dev-owner" });

    await boot(page, "supplements");
    await expect(page.getByText("Reserve Stack · Owner research mode")).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Cycle & Safety" }).click();

    await expect(page.getByRole("heading", { name: "How Reserve helps keep you safe" })).toBeVisible();
    await page.getByLabel(/I understand Reserve is not medical care/).check();
    await page.getByLabel("I am 18 or older.").check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText(/pending clinician and counsel review and are hidden for members/)).toBeVisible();
    await page.getByLabel("Chest pain, pressure or tightness").check();
    await page.getByRole("button", { name: "See what to do" }).click();
    await expect(page.getByRole("link", { name: "Call 911" }).first()).toHaveAttribute("href", "tel:911");
    await page.screenshot({ path: "test-results/owner-mode/owner-cycle-safety.png" });
  });

  test("6. lab flags and escalation still show for the owner in Bloodwork", async ({ page }) => {
    const stamp = new Date().toISOString();
    await boot(page, "bloodwork", { safetyAcknowledgement: { acknowledgedAt: stamp, version: "2026.09.14", adultConfirmedAt: stamp } });
    await expect(page.getByText(/to review with your clinician/).first()).toBeVisible({ timeout: 60_000 });
  });
});

test.describe("owner mode — member account", () => {
  test.skip(MODE !== "member", "Needs the member server (launch switch off, no dev owner).");
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(240_000);

  test("2, 3, 8. a member sees no owner UI and no review-pending tools, even with forged owner state", async ({ page }) => {
    expect(await (await page.request.get("/api/account/capabilities?role=owner", { headers: { "x-reserve-role": "owner" } })).json()).toEqual({ role: "member", capabilities: [], source: "default" });

    await boot(page, "supplements", { role: "owner", isOwner: true, ownerModeEnabled: true, capabilities: ["review-pending-safety-tools"] });
    await expect(page.getByRole("button", { name: "Registry" }).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Owner research mode/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cycle & Safety" })).toHaveCount(0);
  });
});
```

- [ ] **Step 2:** start owner server → `RESERVE_E2E_PORT=3330 RESERVE_E2E_OWNER_MODE=owner npm run test:e2e -- tests/e2e/owner-mode.spec.ts` → 2 passed, 1 skipped; stop; start member server → `RESERVE_E2E_PORT=3331 RESERVE_E2E_OWNER_MODE=member …` → 1 passed, 2 skipped; stop.
- [ ] **Step 3: Commit** — `git commit -m "test(authz): owner and member e2e journeys"`

### Task 8: Docs

- [ ] CLAUDE.md Safeguards: add "Owner Mode: owner status comes only from a verified Supabase user id on the server-only `RESERVE_OWNER_USER_IDS` (or `RESERVE_DEV_OWNER=true` in local development without Supabase). Features gate on `can(access, capability)` (`src/lib/authz`). No capability may disable a safety system, and safety modules never import `@/lib/authz`."
- [ ] Amendment: "Owner Mode stage 1 (2026-09-15)" section — owner sees review-pending tools in production while hidden for members; safeguards unchanged; limits.
- [ ] Deployment guide env table rows for `RESERVE_OWNER_USER_IDS` and `RESERVE_DEV_OWNER`.
- [ ] Counsel brief Q35: the founder's own production use of review-pending content.
- [ ] Commit — `git commit -m "docs(compliance): Owner Mode stage 1"`

### Task 9: Validate and ship

- [ ] `npm run lint`, `npm run typecheck`, `npm test` (whole suite; note the known worktree-only `third-party-notices` license-read failure if it appears), e2e from Task 7, `npm run build` (if the worktree build cannot run, rely on the Vercel preview build and say so).
- [ ] Push branch, open PR into `main`, wait for Vercel, report. Merge only when the owner says so.
