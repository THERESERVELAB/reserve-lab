import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createTokenVault, generateEncryptionKey } from "../token-vault";
import { createOAuthState, verifyOAuthState } from "../oauth-state";

const KEY = randomBytes(32).toString("base64");

describe("token vault", () => {
  it("does not store the token in a readable form", () => {
    const vault = createTokenVault(KEY)!;
    const sealed = vault.seal("whoop-refresh-token");
    expect(sealed).not.toContain("whoop-refresh-token");
    expect(vault.open(sealed)).toBe("whoop-refresh-token");
  });

  it("produces a different ciphertext every time, so equal tokens are not obvious", () => {
    const vault = createTokenVault(KEY)!;
    expect(vault.seal("same")).not.toBe(vault.seal("same"));
  });

  it("refuses to open a tampered value instead of returning something else", () => {
    const vault = createTokenVault(KEY)!;
    const sealed = vault.seal("whoop-refresh-token");
    const parts = sealed.split(".");
    const flipped = Buffer.from(parts[3], "base64");
    flipped[0] ^= 0xff;
    parts[3] = flipped.toString("base64");
    expect(() => vault.open(parts.join("."))).toThrow();
  });

  it("refuses to open with the wrong key", () => {
    const sealed = createTokenVault(KEY)!.seal("whoop-refresh-token");
    const other = createTokenVault(randomBytes(32).toString("base64"))!;
    expect(() => other.open(sealed)).toThrow();
  });

  it("returns null for a key of the wrong size rather than a weaker vault", () => {
    expect(createTokenVault("too-short")).toBeNull();
    expect(createTokenVault(randomBytes(16).toString("base64"))).toBeNull();
  });

  it("accepts a hex key as well as base64", () => {
    const hex = randomBytes(32).toString("hex");
    expect(createTokenVault(hex)).not.toBeNull();
  });

  it("generates a key its own vault accepts", () => {
    expect(createTokenVault(generateEncryptionKey())).not.toBeNull();
  });
});

describe("oauth state", () => {
  const SECRET = "state-signing-secret";

  it("carries the member through the redirect and back", () => {
    const state = createOAuthState({ userId: "member-1", secret: SECRET, returnTo: "/settings" });
    const verified = verifyOAuthState(state, SECRET);
    expect(verified).toMatchObject({ ok: true, userId: "member-1", returnTo: "/settings" });
  });

  it("is long enough for WHOOP to accept", () => {
    expect(createOAuthState({ userId: "member-1", secret: SECRET }).length).toBeGreaterThanOrEqual(8);
  });

  it("is different every time for the same member", () => {
    const a = createOAuthState({ userId: "member-1", secret: SECRET });
    const b = createOAuthState({ userId: "member-1", secret: SECRET });
    expect(a).not.toBe(b);
  });

  it("refuses a claim signed with another secret", () => {
    const forged = createOAuthState({ userId: "member-2", secret: "attacker-secret" });
    expect(verifyOAuthState(forged, SECRET)).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("refuses a claim whose member id was edited", () => {
    const state = createOAuthState({ userId: "member-1", secret: SECRET });
    const [payload, signature] = state.split(".");
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { uid: string };
    claim.uid = "someone-else";
    const swapped = `${Buffer.from(JSON.stringify(claim)).toString("base64url")}.${signature}`;
    expect(verifyOAuthState(swapped, SECRET)).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("refuses a claim that has expired", () => {
    const state = createOAuthState({
      userId: "member-1",
      secret: SECRET,
      now: new Date("2026-09-24T12:00:00.000Z"),
      ttlSeconds: 600,
    });
    expect(verifyOAuthState(state, SECRET, new Date("2026-09-24T12:20:00.000Z"))).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("refuses anything that is not a signed claim", () => {
    expect(verifyOAuthState("garbage", SECRET)).toEqual({ ok: false, reason: "malformed" });
  });
});
