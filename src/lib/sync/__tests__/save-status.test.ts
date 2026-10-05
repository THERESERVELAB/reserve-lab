import { beforeEach, describe, expect, it } from "vitest";

import { SYNC_STATUS_META, useSyncStatusStore, type SyncStatus } from "@/lib/sync/sync-status";

/**
 * The save indicator is a promise to the member. "Saved" must mean the cloud
 * confirmed the write — never that we optimistically hoped it would.
 */

const status = () => useSyncStatusStore.getState();

beforeEach(() => {
  useSyncStatusStore.setState({ status: "local-only", lastSavedAt: null, detail: null });
});

describe("save status contract", () => {
  it("does not reach Saved by scheduling or starting a write", () => {
    status().setStatus("pending");
    expect(status().status).not.toBe("saved");
    status().setStatus("saving");
    expect(status().status).not.toBe("saved");
    expect(status().lastSavedAt).toBeNull();
  });

  it("reaches Saved only when the confirmed write is recorded", () => {
    status().setStatus("saving");
    status().markSaved("2026-07-31T00:00:00.000Z");
    expect(status().status).toBe("saved");
    expect(status().lastSavedAt).toBe("2026-07-31T00:00:00.000Z");
  });

  it("a failed write reports the failure instead of Saved", () => {
    status().setStatus("saving");
    status().setStatus("error", "network unreachable");
    expect(status().status).toBe("error");
    expect(status().detail).toBe("network unreachable");
    expect(status().lastSavedAt).toBeNull();
  });

  it("a retry that succeeds is what finally clears the error", () => {
    status().setStatus("error", "network unreachable");
    status().setStatus("saving"); // retry attempt
    expect(status().status).toBe("saving");
    status().markSaved("2026-07-31T00:00:05.000Z");
    expect(status().status).toBe("saved");
    expect(status().detail).toBeNull();
  });

  it("going offline never claims the work was saved", () => {
    status().setStatus("pending");
    status().setStatus("offline");
    expect(status().status).toBe("offline");
    expect(status().lastSavedAt).toBeNull();
  });

  it("labels every status honestly for the member", () => {
    const all: SyncStatus[] = [
      "local-only", "restoring", "pending", "saving", "saved", "offline", "error",
    ];
    for (const s of all) expect(SYNC_STATUS_META[s]?.label).toBeTruthy();
    // Only the confirmed state is allowed to say "Saved".
    const saying = all.filter((s) => SYNC_STATUS_META[s].label === "Saved");
    expect(saying).toEqual(["saved"]);
  });
});
