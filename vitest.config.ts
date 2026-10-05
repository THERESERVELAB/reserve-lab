import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Mirror the tsconfig "@/*" → "src/*" path alias so tests can import app
// modules the same way the Next build does. Node environment (default);
// no globals — tests import { describe, it, expect } from "vitest".
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // `tests/e2e` belongs to Playwright, and its default include glob
    // (**/*.spec.ts) otherwise matches those files too. Vitest then loads a
    // Playwright suite outside its runner and fails the whole run on
    // "test.describe() was not expected here" — with every real unit test
    // still passing, which makes the failure easy to misread.
    // Claude Code worktrees (background-task sessions) are full checkouts of
    // this repo. Collected from here their suites resolve "@/" to THIS tree and
    // fail on code that only exists in the worktree — the same reason ESLint
    // ignores them. Each worktree runs its own suite.
    exclude: [...configDefaults.exclude, "tests/e2e/**", ".claude/worktrees/**"],
  },
});
