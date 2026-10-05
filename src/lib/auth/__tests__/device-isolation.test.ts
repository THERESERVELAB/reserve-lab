import { describe, expect, it } from "vitest";

import {
  clearPrivateDeviceStorage,
  PRIVATE_DEVICE_KEYS,
} from "@/lib/auth/device-isolation";

class MemoryStorage implements Pick<Storage, "length" | "key" | "removeItem"> {
  constructor(private readonly values: Map<string, string>) {}

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("private device isolation", () => {
  it("purges exact private keys and every member backup without touching auth or preferences", () => {
    const values = new Map<string, string>([
      ...PRIVATE_DEVICE_KEYS.map((key) => [key, "private"] as const),
      ["fba-backup:pre-hydrate:2026-07-29", "private-backup"],
      ["fba-backup:cloud-pre-overwrite:2026-07-29", "private-cloud-backup"],
      ["sb-project-auth-token", "supabase-owned"],
      ["fba-preview-view", "device-preference"],
    ]);

    clearPrivateDeviceStorage(new MemoryStorage(values));

    expect([...values.keys()].sort()).toEqual([
      "fba-preview-view",
      "sb-project-auth-token",
    ]);
  });
});
