import { describe, expect, it } from "vitest";

import { keyboardViewportFrom } from "@/lib/hooks/useKeyboardViewport";

/* The keyboard is the gap between the layout viewport (what a fixed sheet is
   measured against) and the visual viewport (what the member can still see). */
describe("keyboardViewportFrom", () => {
  it("reads nothing with no visual viewport", () => {
    expect(keyboardViewportFrom(844, null)).toEqual({ inset: 0, visibleHeight: 0 });
  });

  it("reads nothing while the keyboard is closed", () => {
    expect(keyboardViewportFrom(844, { height: 844, offsetTop: 0 })).toEqual({ inset: 0, visibleHeight: 844 });
  });

  it("measures an iOS keyboard opened over the page", () => {
    expect(keyboardViewportFrom(844, { height: 508, offsetTop: 0 })).toEqual({ inset: 336, visibleHeight: 508 });
  });

  it("counts a panned visual viewport as part of the cover", () => {
    /* Safari scrolls the visual viewport to reveal the focused field; the sheet
       still has to clear both the pan and the keys. */
    expect(keyboardViewportFrom(844, { height: 508, offsetTop: 60 })).toEqual({ inset: 276, visibleHeight: 508 });
  });

  it("ignores a collapsing URL bar", () => {
    expect(keyboardViewportFrom(844, { height: 800, offsetTop: 0 })).toEqual({ inset: 0, visibleHeight: 800 });
  });

  it("ignores a pinch zoom", () => {
    expect(keyboardViewportFrom(844, { height: 400, offsetTop: 100, scale: 2 })).toEqual({ inset: 0, visibleHeight: 0 });
  });
});
