import { describe, expect, it } from "vitest";

import { decideFormClose, formSnapshot, isFormDirty } from "../form-close-guard";

describe("form close guard", () => {
  it("never lets an outside click close a changed form", () => {
    expect(decideFormClose("backdrop", true)).toBe("stay");
    expect(decideFormClose("backdrop", true, { backdropClosesWhenClean: true })).toBe("stay");
  });

  it("lets an outside click close an untouched sheet, unless the overlay opts out", () => {
    expect(decideFormClose("backdrop", false)).toBe("close");
    expect(decideFormClose("backdrop", false, { backdropClosesWhenClean: false })).toBe("stay");
  });

  it("closes at once from Escape, X/Cancel and drag when nothing changed", () => {
    for (const source of ["escape", "button", "drag"] as const) {
      expect(decideFormClose(source, false)).toBe("close");
    }
  });

  it("asks first from Escape, X/Cancel and drag when something changed", () => {
    for (const source of ["escape", "button", "drag"] as const) {
      expect(decideFormClose(source, true)).toBe("confirm");
    }
  });
});

describe("dirty snapshot", () => {
  it("is clean until a value changes, and clean again when it is put back", () => {
    const initial = formSnapshot({ weight: "", notes: "" });
    expect(isFormDirty(initial, { weight: "", notes: "" })).toBe(false);
    expect(isFormDirty(initial, { weight: "82", notes: "" })).toBe(true);
    expect(isFormDirty(initial, { weight: "", notes: "" })).toBe(false);
  });

  it("sees changes inside arrays and nested objects", () => {
    const initial = formSnapshot({ tags: ["a"], sleep: { hours: 7 } });
    expect(isFormDirty(initial, { tags: ["a", "b"], sleep: { hours: 7 } })).toBe(true);
    expect(isFormDirty(initial, { tags: ["a"], sleep: { hours: 8 } })).toBe(true);
  });

  it("always yields a string, even for undefined", () => {
    expect(formSnapshot(undefined)).toBe("undefined");
    expect(isFormDirty(formSnapshot(undefined), undefined)).toBe(false);
    expect(isFormDirty(formSnapshot(undefined), "x")).toBe(true);
  });
});
