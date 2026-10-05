#!/usr/bin/env node
/**
 * Real-data isolation verification for member_state, protected profile
 * columns, multi-session restore, and private Storage owner paths.
 *
 * Proves that the anon key + authenticated session + RLS actually isolate
 * members from each other. Requires TWO real test accounts (magic-link or
 * password) on a live Supabase project. It never prints tokens or emails in
 * full and creates only disposable test rows it then deletes.
 *
 * REQUIRED ENV (never committed — set in the shell for a one-off run):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   RLS_TEST_A_EMAIL   RLS_TEST_A_PASSWORD
 *   RLS_TEST_B_EMAIL   RLS_TEST_B_PASSWORD
 *
 * Run:
 *   node scripts/verify-rls.mjs
 *
 * Exit 0 = all isolation assertions held. Exit 1 = a violation or setup gap.
 *
 * STATUS IN THIS REPO: UNEXECUTED — no live credentials/test accounts were
 * available in the production worktree at authoring time.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const A = { email: process.env.RLS_TEST_A_EMAIL, password: process.env.RLS_TEST_A_PASSWORD };
const B = { email: process.env.RLS_TEST_B_EMAIL, password: process.env.RLS_TEST_B_PASSWORD };

function redact(email) {
  if (!email) return "(unset)";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain ?? "?"}`;
}

if (!url || !anon || !A.email || !A.password || !B.email || !B.password) {
  console.error("RLS verification is UNEXECUTED — missing configuration:");
  console.error(`  NEXT_PUBLIC_SUPABASE_URL:      ${url ? "present" : "MISSING"}`);
  console.error(`  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anon ? "present" : "MISSING"}`);
  console.error(`  RLS_TEST_A_EMAIL:              ${redact(A.email)}`);
  console.error(`  RLS_TEST_B_EMAIL:              ${redact(B.email)}`);
  console.error("\nProvide two disposable test accounts and re-run. See docs/SUPABASE_SECURITY_VERIFICATION.md.");
  process.exit(1);
}

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function clientFor(creds, label) {
  const c = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword(creds);
  if (error || !data.user) throw new Error(`Sign-in failed for ${label}: ${error?.message ?? "no user"}`);
  return { client: c, userId: data.user.id };
}

async function main() {
  console.log("Reserve Lab real-data isolation\n");
  const anonClient = createClient(url, anon, { auth: { persistSession: false } });

  const a = await clientFor(A, "A");
  const b = await clientFor(B, "B");
  console.log(`  signed in A=${a.userId.slice(0, 8)}… B=${b.userId.slice(0, 8)}…\n`);

  // A writes own row.
  {
    const { error } = await a.client.from("member_state").upsert(
      { user_id: a.userId, state: { probe: "A" }, schema_version: 2 }, { onConflict: "user_id" });
    record("A can upsert own row", !error, error?.message);
  }
  // A reads own row.
  {
    const { data, error } = await a.client.from("member_state").select("user_id").eq("user_id", a.userId).maybeSingle();
    record("A can read own row", !error && data?.user_id === a.userId, error?.message);
  }
  // B writes own row.
  {
    const { error } = await b.client.from("member_state").upsert(
      { user_id: b.userId, state: { probe: "B" }, schema_version: 2 }, { onConflict: "user_id" });
    record("B can upsert own row", !error, error?.message);
  }
  // A cannot read B's row (RLS filters it — expect empty, not error).
  {
    const { data } = await a.client.from("member_state").select("user_id").eq("user_id", b.userId);
    record("A cannot read B's row", Array.isArray(data) && data.length === 0);
  }
  // A cannot update B's row.
  {
    const { data } = await a.client.from("member_state").update({ state: { probe: "hacked" } }).eq("user_id", b.userId).select();
    record("A cannot update B's row", Array.isArray(data) && data.length === 0);
  }
  // A cannot insert a row owned by B (WITH CHECK must reject).
  {
    const { error } = await a.client.from("member_state").insert({ user_id: b.userId, state: { probe: "spoof" }, schema_version: 2 });
    record("A cannot insert under B's user_id", Boolean(error), error ? "rejected as expected" : "NO ERROR — violation");
  }
  // Anonymous cannot read.
  {
    const { data, error } = await anonClient.from("member_state").select("user_id").limit(1);
    record("Anon cannot read member_state", Boolean(error) || (Array.isArray(data) && data.length === 0));
  }
  // Anonymous cannot write.
  {
    const { error } = await anonClient.from("member_state").insert({ user_id: a.userId, state: { probe: "anon" }, schema_version: 2 });
    record("Anon cannot write member_state", Boolean(error));
  }

  // A second authenticated client for the same account can restore A's row.
  {
    const secondDevice = await clientFor(A, "A second device");
    const { data, error } = await secondDevice.client
      .from("member_state")
      .select("state")
      .eq("user_id", a.userId)
      .maybeSingle();
    record(
      "A second authenticated client restores A's cloud row",
      !error && data?.state?.probe === "A",
      error?.message,
    );
    await secondDevice.client.auth.signOut();
  }

  // Members cannot self-promote by changing the billing-owned tier column.
  {
    const { error } = await a.client
      .from("profiles")
      .update({ current_tier: "elite" })
      .eq("id", a.userId);
    record("A cannot update the billing-owned profile tier", Boolean(error));
  }

  // Private Storage paths are rooted by auth.uid().
  const storagePath = `${a.userId}/rls-probe-${Date.now()}.png`;
  {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const { error } = await a.client.storage
      .from("progress-photos")
      .upload(storagePath, bytes, { contentType: "image/png", upsert: false });
    record("A can upload under A's private Storage prefix", !error, error?.message);
  }
  {
    const { error } = await b.client.storage.from("progress-photos").download(storagePath);
    record("B cannot download A's private object", Boolean(error));
  }
  {
    const spoofPath = `${a.userId}/rls-spoof-${Date.now()}.png`;
    const { error } = await b.client.storage
      .from("progress-photos")
      .upload(spoofPath, new Uint8Array([137, 80, 78, 71]), {
        contentType: "image/png",
        upsert: false,
      });
    record("B cannot upload under A's private prefix", Boolean(error));
  }
  {
    const { error } = await anonClient.storage.from("progress-photos").download(storagePath);
    record("Anon cannot download A's private object", Boolean(error));
  }
  {
    const { error } = await a.client.storage.from("progress-photos").remove([storagePath]);
    record("A can delete A's private object", !error, error?.message);
  }

  // Cleanup — each account deletes only its own row.
  await a.client.from("member_state").delete().eq("user_id", a.userId);
  await b.client.from("member_state").delete().eq("user_id", b.userId);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} assertions held.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nRLS verification error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
