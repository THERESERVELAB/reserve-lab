import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { VIEW_FEATURE_MAP } from "@/lib/saas-config";

/**
 * FIRST-LOAD SHAPE.
 *
 * `ViewRouter` used to import all 35 rooms statically, so a member's cold open
 * downloaded and parsed Coach Command, Reserve Women, Compound Command and
 * every Black room before their own room could be tapped. These tests hold the
 * split in place: the router may name a room only through the lazy registry,
 * and every routable room must have an entry there.
 *
 * Source text rather than a bundle measurement, because it is the same answer
 * in dev and in production and it fails on the line that caused it.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const router = read("../ViewRouter.tsx");
const chunks = read("../view-chunks.ts");

describe("view chunks", () => {
  it("the router imports no room statically", () => {
    const statics = [...router.matchAll(/^\s*import\s+[^;]*?from\s+"(\.\/views\/[^"]+|\.\/personas\/[^"]+|\.\/FinalBossDashboard)"/gm)].map(
      (m) => m[1],
    );
    expect(statics, "rooms must be reached through ./view-chunks, never imported directly").toEqual([]);
  });

  it("every routable room has a lazy chunk", () => {
    const keys = new Set(
      [...chunks.matchAll(/^\s*"?([a-z][a-z0-9-]*)"?:\s*named\(/gm)].map((m) => m[1]),
    );
    const missing = Object.keys(VIEW_FEATURE_MAP).filter((view) => view !== "dashboard" && !keys.has(view));
    expect(missing, "rooms without a chunk fall through to the persona dashboard").toEqual([]);
  });

  it("the persona dashboards are chunks of their own", () => {
    expect(chunks).toMatch(/beginner:\s*named\("BeginnerDashboard"/);
    expect(chunks).toMatch(/intermediate:\s*named\("IntermediateDashboard"/);
    expect(chunks).toMatch(/advanced:\s*named\("FinalBossDashboard"/);
  });

  it("the shell keeps Coach Command and the onboarding wizard out of the first load", () => {
    const shell = read("../AppShell.tsx");
    expect(shell).not.toMatch(/^\s*import\s+\{\s*CoachCommandShell\s*\}/m);
    expect(shell).not.toMatch(/^\s*import\s+\{\s*OnboardingWizard\s*\}/m);
    expect(shell).toMatch(/dynamic\(\(\) => import\("\.\/coaching\/CoachCommandShell"\)/);
    expect(shell).toMatch(/dynamic\(\(\) => import\("\.\/onboarding\/OnboardingWizard"\)/);
  });

  it("the shell withholds every room until the member's own state is restored", () => {
    const shell = read("../AppShell.tsx");
    /* The server snapshot is false, so the server renders the restoration
       screen and no room is ever built from store defaults. */
    expect(shell).toMatch(/const readServerRehydrated = \(\) => false;/);
    expect(shell).toMatch(/if \(!restored\) return <ReserveRestoring/);
    /* Both launch paths go through the gate — nothing reaches MemberShell directly. */
    const direct = [...shell.matchAll(/return <MemberShell>\{children\}<\/MemberShell>;/g)];
    expect(direct.length, "only RestoredMemberShell may render MemberShell").toBe(1);
    expect([...shell.matchAll(/return <RestoredMemberShell>\{children\}<\/RestoredMemberShell>;/g)].length).toBe(2);
  });
});
