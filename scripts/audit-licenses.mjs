// Audits the license of every package in the production dependency tree and
// writes src/lib/legal/package-inventory.generated.json for /open-source.
//
//   npm run licenses:audit             write the inventory
//   npm run licenses:audit -- --check  fail if the inventory is out of date
//
// Fails when a package carries a license outside the allowlist below, so a new
// dependency with a copyleft or unknown license is caught before it ships.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src", "lib", "legal", "package-inventory.generated.json");
const check = process.argv.includes("--check");

/** Permissive licenses accepted anywhere in the tree. */
const ALLOWED = new Set(["MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "MIT AND ISC", "CC-BY-4.0", "BlueOak-1.0.0"]);
/** Licenses accepted only for named packages, with the reason. */
const ALLOWED_FOR = [
  {
    license: /LGPL-3\.0-or-later/,
    name: /^@img\/sharp-/,
    reason: "libvips inside sharp, used by Next.js image optimization on the server only; not sent to members' devices",
  },
];
/** Optional peers of Next.js that are installed only as devDependencies (test tooling). */
const DEV_TOOLING = new Set(["@playwright/test", "playwright", "playwright-core"]);

function productionTree() {
  try {
    return execSync("npm ls --omit=dev --all --long --json", { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch (error) {
    // npm ls exits non-zero for extraneous or invalid entries but still prints the tree.
    if (error.stdout) return error.stdout;
    throw error;
  }
}

/** Platform-specific binaries differ per OS; list them once under a stable name. */
function stableName(name) {
  if (/^@next\/swc-/.test(name)) return "@next/swc (platform binary)";
  if (/^@img\/sharp-libvips-/.test(name)) return "@img/sharp-libvips (platform binary)";
  if (/^@img\/sharp-/.test(name)) return "@img/sharp (platform binary)";
  return name;
}

function copyrightLine(dir) {
  const file = readdirSync(dir).find((f) => /^licen[cs]e/i.test(f));
  if (!file) return null;
  const line = readFileSync(join(dir, file), "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /^copyright\s*(\(c\)|©|\d{4})/i.test(l) || /^\(c\)\s*\d{4}/i.test(l) || /^©/.test(l));
  return line ? line.slice(0, 200) : null;
}

const tree = JSON.parse(productionTree());
const seen = new Map();
(function walk(deps) {
  for (const [name, node] of Object.entries(deps ?? {})) {
    if (!node.version || node.missing || !node.path) continue;
    if (DEV_TOOLING.has(name) || name.startsWith("@types/")) continue;
    const key = `${name}@${node.version}`;
    if (seen.has(key)) continue;
    seen.set(key, { name, version: node.version, dir: node.path });
    walk(node.dependencies);
  }
})(tree.dependencies);

const problems = [];
const exceptions = [];
const packages = [];
for (const { name, version, dir } of seen.values()) {
  const manifestPath = join(dir, "package.json");
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  let license = manifest.license ?? (Array.isArray(manifest.licenses) ? manifest.licenses.map((l) => l.type ?? l).join(" OR ") : null);
  if (license && typeof license === "object") license = license.type ?? null;
  license = license ?? "UNKNOWN";

  const exception = ALLOWED_FOR.find((rule) => rule.license.test(license) && rule.name.test(name));
  if (exception) exceptions.push(`${stableName(name)} (${license}): ${exception.reason}`);
  else if (!ALLOWED.has(license)) problems.push(`${name}@${version}: ${license}`);

  packages.push({ name: stableName(name), version, license, copyright: copyrightLine(dir) });
}

const unique = [...new Map(packages.map((p) => [`${p.name}@${p.version}`, p])).values()].sort((a, b) =>
  a.name === b.name ? a.version.localeCompare(b.version) : a.name.localeCompare(b.name),
);
const inventory = { source: "npm ls --omit=dev --all (type declarations and test tooling excluded)", exceptions: [...new Set(exceptions)], packages: unique };
const text = `${JSON.stringify(inventory, null, 2)}\n`;

const counts = {};
for (const p of unique) counts[p.license] = (counts[p.license] ?? 0) + 1;
console.log(`[licenses] ${unique.length} packages`, counts);
for (const line of inventory.exceptions) console.log(`[licenses] exception — ${line}`);

if (problems.length) {
  console.error(`[licenses] not on the allowlist:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
if (check) {
  const current = existsSync(out) ? readFileSync(out, "utf8").replace(/\r\n/g, "\n") : "";
  if (current !== text) {
    console.error("[licenses] package-inventory.generated.json is out of date — run npm run licenses:audit");
    process.exit(1);
  }
  console.log("[licenses] inventory up to date");
} else {
  writeFileSync(out, text);
  console.log(`[licenses] wrote ${out}`);
}
