import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The production auth contract is a deployment agreement: these exact paths
 * must be registered as Supabase redirect URLs. If a path changes here without
 * the dashboard changing too, real confirmation and recovery links break in
 * production. Pin them.
 */

const read = (...segments: string[]) =>
  readFileSync(join(process.cwd(), ...segments), "utf8");

const authProvider = read("src", "components", "auth", "AuthProvider.tsx");

describe("production auth contract", () => {
  it("sends signup confirmation to /auth/callback on the current origin", () => {
    expect(authProvider).toContain("emailRedirectTo: `${window.location.origin}/auth/callback`");
  });

  it("sends OAuth back to /auth/callback on the current origin", () => {
    expect(authProvider).toContain("redirectTo: `${window.location.origin}/auth/callback`");
  });

  it("sends password recovery to the declared reset path", () => {
    expect(authProvider).toContain('export const PASSWORD_RESET_PATH = "/auth/reset"');
    expect(authProvider).toContain(
      "redirectTo: `${window.location.origin}${PASSWORD_RESET_PATH}`",
    );
  });

  it("ships a page at every redirect target the contract names", () => {
    expect(() => read("src", "app", "auth", "callback", "page.tsx")).not.toThrow();
    expect(() => read("src", "app", "auth", "reset", "page.tsx")).not.toThrow();
  });

  it("derives redirects from the live origin, never a hardcoded host", () => {
    // A baked-in localhost or vercel.app would send production members to the
    // wrong deployment after confirming their email.
    expect(authProvider).not.toMatch(/redirectTo:\s*["'`]https?:\/\//);
    expect(authProvider).not.toContain("localhost:3000");
  });

  it("does not disclose whether an email has an account on reset request", () => {
    expect(authProvider).toContain("If that address has a Reserve account");
  });

  it("strips the recovery token from the address bar before rendering", () => {
    const resetPage = read("src", "app", "auth", "reset", "page.tsx");
    expect(resetPage).toContain("window.history.replaceState");
  });
});
