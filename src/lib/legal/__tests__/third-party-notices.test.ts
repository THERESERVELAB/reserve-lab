import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LICENSE_TEXT_URL, PACKAGE_INVENTORY, THIRD_PARTY_NOTICES } from "../third-party-notices";

const ALLOWED_LICENSES = new Set(["MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "MIT AND ISC", "CC-BY-4.0", "BlueOak-1.0.0"]);

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { dependencies: Record<string, string> };

describe("third-party notices", () => {
  it("lists every runtime dependency in package.json", () => {
    const listed = new Set(THIRD_PARTY_NOTICES.flatMap((notice) => notice.packages));
    const missing = Object.keys(pkg.dependencies).filter((name) => !listed.has(name));
    expect(missing).toEqual([]);
  });

  it("carries the license each package declares", () => {
    for (const notice of THIRD_PARTY_NOTICES) {
      for (const name of notice.packages) {
        const manifest = JSON.parse(readFileSync(join(root, "node_modules", name, "package.json"), "utf8")) as { license?: string };
        expect(manifest.license, name).toBe(notice.license);
      }
    }
  });

  it("names a copyright holder and a source for every entry", () => {
    for (const notice of THIRD_PARTY_NOTICES) {
      expect(notice.copyright.trim(), notice.name).not.toBe("");
      expect(notice.url, notice.name).toMatch(/^https:\/\/github\.com\//);
    }
  });

  it("keeps a generated inventory of the production tree with only allowed licenses", () => {
    const names = new Set(PACKAGE_INVENTORY.packages.map((p) => p.name));
    expect(Object.keys(pkg.dependencies).filter((name) => !names.has(name))).toEqual([]);
    const offList = PACKAGE_INVENTORY.packages.filter(
      (p) => !ALLOWED_LICENSES.has(p.license) && !(p.name.startsWith("@img/sharp") && /LGPL-3\.0-or-later/.test(p.license)),
    );
    expect(offList).toEqual([]);
  });

  it("serves the full text of licenses that require a copy", () => {
    const needed = new Set(THIRD_PARTY_NOTICES.map((notice) => notice.license).filter((license) => license === "Apache-2.0"));
    for (const license of needed) {
      const url = LICENSE_TEXT_URL[license];
      expect(url, license).toBeTruthy();
      const file = join(root, "public", url!);
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file, "utf8")).toMatch(/Apache License\s+Version 2\.0, January 2004/);
    }
  });
});
