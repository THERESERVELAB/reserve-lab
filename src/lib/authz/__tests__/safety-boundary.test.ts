import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { EMERGENCY_COPY } from "@/lib/safety/escalation";

/**
 * Owner Mode can add information; it can never switch a safety system off.
 * The simplest proof: the modules that produce warnings, flags, checks and
 * escalation never import the capability layer, so no capability can reach
 * them.
 */

const SAFETY_DIRS = [
  "src/lib/safety",
  "src/lib/labs",
  "src/lib/compound-intelligence",
  "src/lib/cycle-review",
  "src/lib/cycle",
  "src/components/safety",
  "src/components/labs",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("safety systems cannot be switched off by access", () => {
  it("6, 7. no safety module imports the capability layer", () => {
    const files = SAFETY_DIRS.flatMap((dir) => sourceFiles(join(process.cwd(), dir)));
    expect(files.length).toBeGreaterThan(20);
    const offenders = files
      .filter((file) => /["']@\/(lib|components)\/authz|["'][./]+(\.\.\/)*authz\//.test(readFileSync(file, "utf8")))
      .map((file) => relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });

  it("7. emergency guidance still routes to 911 and 988", () => {
    const copy = Object.values(EMERGENCY_COPY).join(" ");
    expect(copy).toMatch(/911/);
    expect(copy).toMatch(/988/);
  });
});
