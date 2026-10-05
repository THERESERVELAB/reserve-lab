#!/usr/bin/env node
/**
 * Production environment validation.
 *
 * Verifies that a deployment has the variable NAMES required for authenticated
 * cloud mode, and that no server-only secret has been dangerously exposed with
 * a NEXT_PUBLIC_ prefix. It prints only variable names and PRESENT/MISSING
 * status — never a value.
 *
 * Exit codes:
 *   0  configuration is production-ready (or a non-production run)
 *   1  a required public variable is missing, OR a secret is publicly exposed
 *
 * Usage:
 *   node scripts/check-production-env.mjs            # validates process.env
 *   TARGET_ENV=production node scripts/check-production-env.mjs
 */

const REQUIRED_PUBLIC = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const REQUIRED_SERVER = ["SUPABASE_SERVICE_ROLE_KEY"];

// Server-only secrets that must NEVER appear with a NEXT_PUBLIC_ prefix.
const SERVER_ONLY = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  // A published vault key would make every stored WHOOP token openable by
  // anyone who loads the site.
  "RESERVE_TOKEN_ENCRYPTION_KEY",
  "WHOOP_CLIENT_SECRET",
];

// Optional server vars — reported for visibility, never required to pass.
const OPTIONAL = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "OPENAI_API_KEY",
  "RESERVE_TOKEN_ENCRYPTION_KEY",
  "WHOOP_CLIENT_ID",
  "WHOOP_CLIENT_SECRET",
  "WHOOP_REDIRECT_URI",
];

const has = (name) => {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
};

const targetEnv = process.env.TARGET_ENV ?? process.env.NODE_ENV ?? "development";
const isProduction = targetEnv === "production";

const lines = [];
const errors = [];

lines.push(`Reserve Lab — production environment check (target: ${targetEnv})`);
lines.push("");
lines.push("Required (public, browser-safe — RLS enforces access):");
for (const name of REQUIRED_PUBLIC) {
  const present = has(name);
  lines.push(`  ${present ? "PRESENT" : "MISSING "}  ${name}`);
  if (!present) errors.push(`Missing required variable: ${name}`);
}

lines.push("");
lines.push("Required (server-only — identity bootstrap, export, deletion):");
for (const name of REQUIRED_SERVER) {
  const present = has(name);
  lines.push(`  ${present ? "PRESENT" : "MISSING "}  ${name}`);
  if (!present) errors.push(`Missing required variable: ${name}`);
}

lines.push("");
lines.push("Optional integrations:");
for (const name of OPTIONAL) {
  if (REQUIRED_SERVER.includes(name)) continue;
  lines.push(`  ${has(name) ? "PRESENT" : "absent "}  ${name}`);
}

// A server secret must never be published to the browser via NEXT_PUBLIC_.
lines.push("");
lines.push("Secret exposure guard (must all be CLEAR):");
for (const name of SERVER_ONLY) {
  const publicName = `NEXT_PUBLIC_${name}`;
  const exposed = has(publicName);
  lines.push(`  ${exposed ? "EXPOSED!" : "clear   "}  ${publicName}`);
  if (exposed) errors.push(`Server secret exposed to the browser: ${publicName}`);
}

console.log(lines.join("\n"));

if (errors.length > 0) {
  console.error("\nFAIL:");
  for (const e of errors) console.error(`  - ${e}`);
  // Only fail the process for a production target; local dev may run without cloud config.
  if (isProduction) {
    console.error("\nProduction configuration is incomplete or unsafe. Blocking.");
    process.exit(1);
  }
  console.error("\n(Non-production target — reported but not blocking.)");
  process.exit(0);
}

console.log("\nOK: environment is valid for the target.");
process.exit(0);
