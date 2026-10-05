#!/usr/bin/env node
/**
 * Route auth verification — proves the B2 IDOR fix at the HTTP boundary.
 *
 * These assertions require NO Supabase credentials: the auth guard rejects a
 * request that carries no (or an invalid) bearer token before any database
 * access, so the 401 / no-persist behavior is fully testable locally.
 *
 * Prereq: a running server (dev or `next start`). Point BASE_URL at it.
 *   BASE_URL=http://localhost:3311 node scripts/verify-route-auth.mjs
 *
 * Exit 0 = every protected route denied the unauthenticated caller and no AI
 * route persisted without a verified session. Exit 1 = a violation.
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3311";

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
}

// A schema-valid v4 UUID standing in for "some other member".
const VICTIM = "11111111-1111-4111-8111-111111111111";

async function main() {
  console.log(`Route auth verification against ${BASE}\n`);
  console.log("Protected member routes must reject the unauthenticated caller (401):");

  // Direct member-CRUD routes: no token → 401, even with a spoofed userId.
  {
    const r = await post("/api/session/complete", { userId: VICTIM, sessionId: "x", completedSets: 1 });
    record("POST /api/session/complete (no token) → 401", r.status === 401, `got ${r.status}`);
  }
  {
    const r = await post("/api/session/start", { userId: VICTIM });
    record("POST /api/session/start (no token) → 401", r.status === 401, `got ${r.status}`);
  }
  {
    const r = await post("/api/session/set", { userId: VICTIM, sessionId: "x", setNumber: 1 });
    record("POST /api/session/set (no token) → 401", r.status === 401, `got ${r.status}`);
  }
  {
    const r = await post("/api/session/swap", { userId: VICTIM, sessionId: "x" });
    record("POST /api/session/swap (no token) → 401", r.status === 401, `got ${r.status}`);
  }
  {
    const r = await get(`/api/checkins/physique?userId=${VICTIM}`);
    record("GET /api/checkins/physique?userId=victim (no token) → 401", r.status === 401, `got ${r.status}`);
  }
  {
    const r = await post("/api/checkins/physique", { userId: VICTIM });
    record("POST /api/checkins/physique (no token) → 401", r.status === 401, `got ${r.status}`);
  }
  {
    const r = await post("/api/auth/bootstrap", { userId: VICTIM });
    record("POST /api/auth/bootstrap (no token) → 401", r.status === 401, `got ${r.status}`);
  }
  {
    const r = await get("/api/community/channels");
    record("GET /api/community/channels (no token) → 401", r.status === 401, `got ${r.status}`);
  }
  {
    const r = await get(`/api/community/messages?channelId=${VICTIM}`);
    record("GET /api/community/messages (no token) → 401", r.status === 401, `got ${r.status}`);
  }
  {
    const r = await post("/api/community/messages", {
      channelId: VICTIM,
      userId: VICTIM,
      body: "spoof",
    });
    record("POST /api/community/messages (no token) → 401", r.status === 401, `got ${r.status}`);
  }
  {
    const r = await get("/api/account/export");
    record("GET /api/account/export (no token) → 401", r.status === 401, `got ${r.status}`);
  }
  {
    const res = await fetch(`${BASE}/api/account/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE MY RESERVE ACCOUNT" }),
    });
    record("DELETE /api/account/delete (no token) → 401", res.status === 401, `got ${res.status}`);
  }
  {
    const r = await post("/api/stripe/checkout", { tier: "elite", userId: VICTIM });
    record("POST /api/stripe/checkout (no token) → 401", r.status === 401, `got ${r.status}`);
  }
  {
    const r = await post("/api/stripe/portal", { customerId: "cus_victim" });
    record("POST /api/stripe/portal (no token) → 401", r.status === 401, `got ${r.status}`);
  }

  console.log("\nAI routes must still COMPUTE for anonymous callers but never PERSIST:");
  {
    // AI routes accept anonymous compute; persistence must be skipped (never
    // 'supabase') even when a request tries to force persist under a userId.
    const r = await get(`/api/ai/digital-athlete?persist=true&userId=${VICTIM}`);
    const persistedToSupabase = r.json?.persistence?.persisted === true;
    record("GET /api/ai/digital-athlete?persist=true&userId=victim → not persisted to cloud",
      r.status === 200 && !persistedToSupabase, `status ${r.status}, persisted=${persistedToSupabase}`);
  }

  console.log("\nHealth endpoint must expose no secrets:");
  {
    const r = await get("/api/health");
    const body = JSON.stringify(r.json ?? {});
    const leaks = /service_role|eyJhbGciOi|sk-[A-Za-z0-9]{20}|SUPABASE_SERVICE/i.test(body);
    record("GET /api/health reveals no secret", r.status === 200 && !leaks, leaks ? "LEAK DETECTED" : "clean");
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} assertions held.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nVerification error (is the server running at ${BASE}?): ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
