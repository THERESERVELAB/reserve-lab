import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: null as { id: string; email: string | null } | null, configured: true }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/route-auth", () => ({ resolveRequestUser: vi.fn(async () => mocks.user) }));
vi.mock("@/lib/supabase/server", () => ({ getSupabasePublicStatus: () => ({ configured: mocks.configured }) }));

import * as route from "@/app/api/account/capabilities/route";

const OWNER = "4f1c2b9e-8d7a-4c3b-9e1f-0a2b3c4d5e6f";
const MEMBER = "11111111-2222-4333-8444-555555555555";

async function get(init: RequestInit & { url?: string } = {}) {
  const response = await route.GET(new Request(init.url ?? "http://localhost/api/account/capabilities", init));
  return { response, body: (await response.json()) as { role: string; capabilities: string[]; source: string } };
}

beforeEach(() => {
  mocks.user = null;
  mocks.configured = true;
  vi.stubEnv("RESERVE_OWNER_USER_IDS", OWNER);
  vi.stubEnv("RESERVE_DEV_OWNER", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

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

  it("3. ignores role claims in the query, headers and cookies, and offers no way to write access", async () => {
    mocks.user = { id: MEMBER, email: null };
    const { body } = await get({
      url: "http://localhost/api/account/capabilities?role=owner&isOwner=true",
      headers: { "x-reserve-role": "owner", "x-user-id": OWNER, cookie: "role=owner; ownerModeEnabled=true" },
    });
    expect(body.role).toBe("member");
    expect(Object.keys(route).filter((key) => /^(POST|PUT|PATCH|DELETE)$/.test(key))).toEqual([]);
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
