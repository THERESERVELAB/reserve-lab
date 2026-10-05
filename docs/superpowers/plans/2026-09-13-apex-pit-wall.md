# Apex Pit Wall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the book-like Apex home screen with the Pit Wall — today on lanes under a live now-marker, one Next Move, one risk line — without changing any engine's math.

**Architecture:** A pure day resolver (`resolveApexToday`) turns existing engine output into lanes, a Next Move and a risk line. A model hook moves Apex's existing derivations out of `ApexCommandV2`. New Pit Wall components render the resolver's output; the old panels move behind a closed "Full briefing" or leave the home screen. Shell slots let the page fill the top bar and dock a phone action at the true bottom.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Zustand, Vitest (node env), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-13-apex-pit-wall-design.md`

---

## Standing rules for every task (owner rules — override skill defaults)

1. **No commits, no pushes, no resets, no stash.** Leave all work in the working tree. (CLAUDE.md.)
2. **Do not run `npm run build`, `next dev`, or start any server.** A dev server is already running on port 3300 and holds `.next`. The integrator runs the production build.
3. **Edit existing files with the Edit tool only — never Write over an existing file.** Other tasks are editing the same tree at the same time.
4. **Touch only the files your task owns** (table below). If you believe a file you do not own must change, stop and report it instead.
5. Validate with `npx eslint <your files>`, `npx vitest run <your tests>`, and `npx tsc --noEmit`. `tsc` may show errors in files other tasks are mid-way through — report them, do not fix them.
6. Compliance (CLAUDE.md, `.claude/skills/reserve-design-constitution/references/clinical-data.md`): bloodwork, biomarkers, compounds and supplements stay log-only. Never write lab interpretation, supplement or dose guidance. Move clinician strings verbatim.
7. Closed palette and type ramp only: `src/lib/design/tokens.ts`, `.type-*` classes in `src/app/globals.css`. No new hues, no new typefaces.

## File ownership

| Task | Owner | Creates | Modifies |
|---|---|---|---|
| 0 Contracts | integrator (done) | `src/lib/apex/today-types.ts`, `src/components/ui/reserve/ReserveShellPortal.tsx`, `src/lib/hooks/useMediaQuery.ts` | `src/components/ui/reserve/index.ts` |
| A Truth layer | agent "truth" | `src/lib/apex/today-resolver.ts`, `src/lib/apex/__tests__/today-resolver.test.ts`, `src/lib/apex/__tests__/engine-context.test.ts`, `src/lib/nutrition/__tests__/logged-protein.test.ts` | `src/lib/ai-strategist/engine.ts`, `src/lib/apex/engine.ts`, `src/lib/nutrition/fuel-plan.ts`, `src/components/views/nutrition/FuelCommandPanel.tsx` |
| B Shell | agent "shell" | `src/lib/ui/shell-store.ts` | `src/components/AppShell.tsx`, `src/components/Sidebar.tsx`, `src/components/TopBar.tsx`, `src/components/ui/reserve/ReserveSurfaces.tsx`, `src/components/ui/reserve/ReserveLayout.tsx`, `tests/e2e/*.spec.ts` (harness only) |
| C Below the line | agent "briefing" | `src/components/apex/briefing/*`, `src/lib/apex/source-to-view.ts`, `src/lib/apex/__tests__/source-to-view.test.ts` | `src/components/FinalBossDashboard.tsx` (Consistency block only), `DESIGN_BIBLE.md` |
| D Model + Pit Wall | integrator | `src/lib/apex/statement.ts`, `src/components/apex/model/*`, `src/components/apex/pit-wall/*` | `src/components/apex/ApexCommandV2.tsx` (until deleted) |
| E Integration | integrator | — | `src/components/FinalBossDashboard.tsx`, `tests/e2e/visual-system-qa.spec.ts` (dashboard assertions) |

---

## Task 0: Contracts (landed)

- `src/lib/apex/today-types.ts` — `ApexToday`, `ApexTodayInput`, `ApexLane`, `ApexLaneItem`, `ApexAction`, `ApexNextMove`, `ApexItemStatus`, `ApexRiskLevel`, `ApexTargetView`. Read it before Task A or D. Do not change it without the integrator.
- `src/components/ui/reserve/ReserveShellPortal.tsx` — `ReserveShellPortal({ slot: "topbar" | "dock" })`, `RESERVE_SHELL_SLOT_ID` (`reserve-slot-topbar`, `reserve-slot-dock`).
- `src/lib/hooks/useMediaQuery.ts` — `useMediaQuery(query)`, `useIsPhone()`, `PHONE_QUERY = "(max-width: 767px)"`. SSR and hydration report `false`.

---

## Task A: Truth layer (agent "truth")

### A1–A4: `resolveApexToday` (TDD)

**Files:** Create `src/lib/apex/today-resolver.ts`, `src/lib/apex/__tests__/today-resolver.test.ts`.

- [ ] **Step A1: Write the failing test** — create `src/lib/apex/__tests__/today-resolver.test.ts` with exactly:

```ts
import { describe, expect, it } from "vitest";

import { DEFAULT_SCHEDULE_PROFILE, type MemberScheduleProfile } from "@/lib/schedule/types";
import type { DayProtocol } from "@/lib/training/weekly-split";
import { resolveApexToday } from "../today-resolver";
import type { ApexLaneId, ApexToday, ApexTodayInput } from "../today-types";

const PROTOCOL: DayProtocol = {
  splitDay: 2,
  cardio: "Cooldown walk · 10 min",
  abs: "Brace · 6 min",
  sauna: "Optional · if hydrated",
  mobility: "Hips · 5 min",
  posing: null,
  nutritionFocus: "Carbs around the session",
  recoveryNote: "Protect the lower body.",
  afterSession: "Walk · abs · mobility",
};

const SCHEDULE: MemberScheduleProfile = {
  ...DEFAULT_SCHEDULE_PROFILE,
  wakeTime: "06:30",
  sleepTarget: "22:30",
  preferredTrainingStart: "17:30",
  preferredTrainingEnd: "19:00",
  mobilityPreference: "pre-session",
  preSessionMobilityMinutes: 8,
};

/** Tuesday 15 September 2026 at a local wall-clock time. */
function at(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2026, 8, 15, h, m, 0, 0);
}

function input(over: Partial<ApexTodayInput> = {}): ApexTodayInput {
  return {
    now: at("16:12"),
    schedule: SCHEDULE,
    trainingContext: { trainingPlanned: true, direction: "unchanged" },
    today: { recovery: false, sessionName: "Legs + Abs", durationMin: 90, protocol: PROTOCOL },
    sessionMode: "pre",
    meals: [
      { id: "m-mid", windowLabel: "Midday Meal", time: "12:30", name: "Chicken rice bowl", isSnack: false },
      { id: "m-pre", windowLabel: "Pre-Workout", time: "16:00", name: "Rice cakes · whey", isSnack: false },
      { id: "m-post", windowLabel: "Post-Workout", time: "19:15", name: "Salmon · potatoes", isSnack: false },
    ],
    loggedMealIds: ["m-mid"],
    intakeSlots: [],
    watchSignals: [],
    ...over,
  };
}

const lane = (t: ApexToday, id: ApexLaneId) => {
  const found = t.lanes.find((l) => l.id === id);
  if (!found) throw new Error(`lane ${id} missing`);
  return found;
};
const allItems = (t: ApexToday) => t.lanes.flatMap((l) => l.items);
const item = (t: ApexToday, id: string) => {
  const found = allItems(t).find((i) => i.id === id);
  if (!found) throw new Error(`item ${id} missing`);
  return found;
};

describe("resolveApexToday — one day, one decision", () => {
  it("lays out training, fuel, recovery and sleep lanes in that order", () => {
    const t = resolveApexToday(input());
    expect(t.lanes.map((l) => l.id)).toEqual(["training", "fuel", "recovery", "sleep"]);
  });

  it("uses the schedule engine for everything except meals and the session", () => {
    const t = resolveApexToday(input());
    const sched = allItems(t).filter((i) => i.id.startsWith("sched-")).map((i) => i.id).sort();
    expect(sched).toEqual([
      "sched-mobility-primer",
      "sched-post-session-handoff",
      "sched-pre-session-command",
      "sched-recovery-downshift",
      "sched-sleep-target",
    ]);
    expect(item(t, "sched-sleep-target")).toMatchObject({ lane: "sleep", label: "Sleep Lock", timeLabel: "10:30 PM" });
    expect(item(t, "sched-pre-session-command").lane).toBe("training");
    expect(item(t, "sched-recovery-downshift").lane).toBe("recovery");
  });

  it("draws the fuel lane from the fuel plan only, skipping untimed meals", () => {
    const t = resolveApexToday(
      input({
        meals: [
          ...input().meals,
          { id: "m-snack", windowLabel: "Mid-Day Smart Snack", time: null, name: "Greek yogurt", isSnack: true },
        ],
      }),
    );
    expect(lane(t, "fuel").items.map((i) => i.id)).toEqual(["meal-m-mid", "meal-m-pre", "meal-m-post"]);
  });

  it("places the session and the after-session protocol on the member's training window", () => {
    const t = resolveApexToday(input());
    expect(item(t, "session")).toMatchObject({ lane: "training", label: "Legs + Abs", sub: "90 min", startMin: 1050, endMin: 1140, timeLabel: "5:30 PM" });
    expect(item(t, "protocol-cardio")).toMatchObject({ lane: "training", label: "Cardio", sub: "Cooldown walk · 10 min", startMin: 1145 });
    expect(item(t, "protocol-abs")).toMatchObject({ lane: "training", startMin: 1160 });
    expect(item(t, "protocol-sauna")).toMatchObject({ lane: "recovery", label: "Sauna", startMin: 1175 });
    expect(item(t, "protocol-mobility")).toMatchObject({ lane: "recovery", startMin: 1190 });
    expect(allItems(t).some((i) => i.id === "protocol-posing")).toBe(false);
  });

  it("makes a due-now meal the next move at 4:12 PM", () => {
    const t = resolveApexToday(input());
    expect(t.nextMove).toEqual({
      title: "Pre-Workout Meal",
      context: "Fuel window · Due now",
      whyNow: "Window closes 4:30 PM · Rice cakes · whey",
      itemId: "meal-m-pre",
      action: { kind: "log-meal", label: "Log meal", mealId: "m-pre" },
    });
    expect(t.then?.id).toBe("sched-pre-session-command");
  });

  it("marks logged meals completed with an explicit undo, and never chases a missed meal", () => {
    const logged = resolveApexToday(input());
    expect(item(logged, "meal-m-mid")).toMatchObject({ status: "completed", action: { kind: "undo-meal-log", label: "Undo log", mealId: "m-mid" } });

    const missed = resolveApexToday(input({ loggedMealIds: [] }));
    expect(item(missed, "meal-m-mid")).toMatchObject({ status: "past-due", action: { kind: "log-meal", label: "Log if eaten", mealId: "m-mid" } });
    expect(missed.nextMove.itemId).toBe("meal-m-pre");
  });

  it("promotes exactly one due-next item across the day lanes", () => {
    const t = resolveApexToday(input());
    const dueNext = allItems(t).filter((i) => i.status === "due-next");
    expect(dueNext.map((i) => i.id)).toEqual(["sched-pre-session-command"]);
  });

  it("puts the session ahead of prep items once its window is due", () => {
    const t = resolveApexToday(input({ now: at("17:25") }));
    expect(item(t, "sched-pre-session-command").status).toBe("due-now");
    expect(t.nextMove).toMatchObject({
      title: "Legs + Abs",
      context: "Training · Due now",
      whyNow: "Session window 5:30 PM–7:00 PM · 90 min planned.",
      itemId: "session",
      action: { kind: "start-session", label: "Start Session" },
    });
  });

  it("always resumes a live session", () => {
    const t = resolveApexToday(input({ now: at("18:00"), sessionMode: "live" }));
    expect(t.nextMove).toMatchObject({ title: "Resume Live Session", itemId: "session", action: { kind: "start-session", label: "Resume Live Session" } });
    expect(item(t, "session").status).toBe("due-now");
  });

  it("offers review once the session is complete", () => {
    const t = resolveApexToday(input({ now: at("19:30"), sessionMode: "complete" }));
    expect(item(t, "session")).toMatchObject({ status: "completed", action: { kind: "review-session", label: "Review Session" } });
  });

  it("never offers training on a recovery day", () => {
    const t = resolveApexToday(input({ today: { recovery: true, sessionName: "Recovery + Posing", durationMin: null, protocol: PROTOCOL } }));
    expect(t.trainingPlanned).toBe(false);
    expect(allItems(t).some((i) => i.action?.kind === "start-session")).toBe(false);
    expect(allItems(t).some((i) => i.id === "session")).toBe(false);
    for (const i of lane(t, "training").items) {
      expect(i.action).toEqual({ kind: "open-view", label: "Open Recovery Command", view: "recovery" });
    }
    expect(t.nextMove.title).not.toBe("Recovery + Posing");
  });

  it("empties the training lane honestly when the session moved or was set aside", () => {
    const moved = resolveApexToday(input({ trainingContext: { trainingPlanned: false, direction: "moved-away" } }));
    expect(moved.trainingPlanned).toBe(false);
    expect(lane(moved, "training")).toMatchObject({
      items: [],
      empty: { message: "Session moved off today", action: { kind: "open-view", label: "Open Training Command", view: "training" } },
    });
    const setAside = resolveApexToday(input({ trainingContext: { trainingPlanned: false, direction: "set-aside" } }));
    expect(lane(setAside, "training").empty?.message).toBe("Session set aside today");
  });

  it("gives an unmapped fuel lane one honest move", () => {
    const t = resolveApexToday(input({ meals: [] }));
    expect(lane(t, "fuel")).toMatchObject({
      items: [],
      empty: { message: "No meal windows mapped", action: { kind: "open-view", label: "Map Meal Windows", view: "schedule-command" } },
    });
  });

  it("shows a log-only logbook lane that never drives the next move or the risk line", () => {
    const slot = { id: "s1", entryId: "e1", plannedTime: "16:10", plannedTimeLabel: "4:10 PM", status: "planned" as const, entry: { name: "Entry", displayName: "Logged item" } };
    const t = resolveApexToday(input({ loggedMealIds: ["m-mid", "m-pre"], intakeSlots: [slot] }));
    expect(t.lanes.map((l) => l.id)).toEqual(["training", "fuel", "recovery", "sleep", "logbook"]);
    expect(lane(t, "logbook").label).toBe("Logbook · user-entered · log-only");
    expect(item(t, "log-s1")).toMatchObject({
      label: "Logged item",
      sub: null,
      status: "due-now",
      logOnly: true,
      action: { kind: "mark-logged", label: "Mark Completed", entryId: "e1", plannedTime: "16:10" },
    });
    expect(t.nextMove.itemId).toBe("sched-pre-session-command");
    expect(t.risk.level).toBe("Low");
  });

  it("ranks risk: sleep compression, then high signals, then any signal", () => {
    const late: MemberScheduleProfile = { ...SCHEDULE, preferredTrainingStart: "20:30", preferredTrainingEnd: "22:00" };
    const high = { title: "Recovery debt building", severity: "high" as const };
    const moderate = { title: "Mobility skipped", severity: "moderate" as const };

    expect(resolveApexToday(input({ schedule: late, watchSignals: [high] })).risk).toEqual({ level: "Sleep compression", detail: "Short window before sleep" });
    expect(resolveApexToday(input({ watchSignals: [moderate, high] })).risk).toEqual({ level: "Elevated", detail: "Recovery debt building" });
    expect(resolveApexToday(input({ watchSignals: [moderate] })).risk).toEqual({ level: "Moderate", detail: "Mobility skipped" });
    expect(resolveApexToday(input()).risk).toEqual({ level: "Low", detail: "Sleep lock 10:30 PM" });
  });

  it("protects sleep before wake and after the sleep target", () => {
    const early = resolveApexToday(input({ now: at("05:00") }));
    expect(early.nextMove).toMatchObject({
      title: "Protect Sleep",
      context: "Overnight",
      whyNow: "It's before your 6:30 AM wake time — rest supports tomorrow's readiness.",
      action: { kind: "open-view", label: "Open Recovery Command", view: "recovery" },
    });
    const late = resolveApexToday(input({ now: at("23:00") }));
    expect(late.nextMove).toMatchObject({ title: "Protect Sleep", context: "Sleep lock", itemId: "sched-sleep-target" });
  });

  it("looks back four hours, never before wake, and ends just after the sleep lock", () => {
    expect(resolveApexToday(input()).window).toEqual({ startMin: 732, endMin: 1380 });
    expect(resolveApexToday(input({ now: at("07:00") })).window.startMin).toBe(390);
    expect(resolveApexToday(input({ now: at("20:30") })).window.startMin).toBe(990);
    expect(resolveApexToday(input()).sleepLock).toEqual({ min: 1350, label: "10:30 PM" });
  });

  it("counts only actionable items that fell before the window", () => {
    const t = resolveApexToday(input({ now: at("20:30") }));
    expect(t.earlier).toEqual({ done: 1, total: 2 });
  });
});
```

- [ ] **Step A2: Run it and confirm it fails**

Run: `npx vitest run src/lib/apex/__tests__/today-resolver.test.ts`
Expected: FAIL — cannot resolve `../today-resolver`.

- [ ] **Step A3: Implement `src/lib/apex/today-resolver.ts`** exporting `resolveApexToday(input: ApexTodayInput): ApexToday`. Pure: no store, no React, no `Date.now()`. Reuse `buildTodaySchedule`, `detectSleepConflict`, `formatTime12`, `minutesToTime`, `timeToMinutes` from `@/lib/schedule/engine`. The rules, all of which the tests pin:

  **Minute space.** `wakeMin = timeToMinutes(wakeTime)`. `sleepMin = timeToMinutes(sleepTarget)`, plus 1440 when below 360. `nowRaw = hours·60 + minutes`; `nowMin = nowRaw + 1440` only when `nowRaw < wakeMin && sleepMin > 1440`, else `nowRaw`. Labels: `fmt(min) = formatTime12(minutesToTime(min))`.

  **trainingPlanned** = `trainingContext.trainingPlanned && !today.recovery`.

  **Point status** (items that are not logged/completed): `delta = startMin − nowMin`; `delta < −30` → `past-due`; `delta ≤ 20` → `due-now`; else `upcoming`.

  **Schedule items.** `buildTodaySchedule(schedule, { trainingPlanned, direction })`. Skip kinds `wake`, `meal`, `training`. `prep` → training lane. `recovery` → recovery lane, except label `"Evening Wind-Down"` → sleep lane. `sleep` → sleep lane with label `"Sleep Lock"`. Id `sched-{slug(engine label)}` where slug lowercases and joins non-alphanumerics with `-`. `sub = item.sub ?? null`. Actions: prep → `{ kind: "open-view", label: "Open Training Command", view: "training" }`; recovery-lane and wind-down → `{ kind: "open-view", label: "Open Recovery Command", view: "recovery" }`; sleep → `null`. Point status.

  **Session** (only when `trainingPlanned`). Id `session`, lane training. `label = today.activity?.label ?? today.sessionName`. `startMin = timeToMinutes(today.activity?.startTime ?? preferredTrainingStart)`. `endMin`: activity → `startMin + (activity.durationMinutes ?? 60)`; otherwise `timeToMinutes(preferredTrainingEnd)`, plus 1440 when not after start. `sub`: activity → `${durationMinutes} min` when present; otherwise `${durationMin} min` when not null; else null. Status: `live` → `due-now`; `complete`/`closed` → `completed`; else `nowMin < start − 20` → `upcoming`, `nowMin ≤ end` → `due-now`, else `past-due`. Action: live → start-session "Resume Live Session"; completed or past-due → review-session "Review Session"; else start-session "Start Session".

  **Protocol items** — anchored at `timeToMinutes(preferredTrainingEnd)`. Only when `trainingPlanned` or `today.recovery`. Offsets and lanes: `cardio` +5 training, `abs` +20 training, `sauna` +35 recovery, `mobility` +50 recovery, `posing` +65 training. Skip null values. Id `protocol-{key}`, label `Cardio | Abs | Sauna | Mobility | Posing`, sub = the protocol string. Action: `trainingPlanned` → open-view "Open Training Command" training; recovery day → open-view "Open Recovery Command" recovery. Point status.

  **Meals** — skip `time === null`. Id `meal-{id}`, lane fuel, label `windowLabel`, sub `name`. Logged → `completed` + `{ kind: "undo-meal-log", label: "Undo log", mealId }`. Not logged → point status + `{ kind: "log-meal", label: status === "past-due" ? "Log if eaten" : "Log meal", mealId }`.

  **Logbook** — lane present only when `intakeSlots.length > 0`, label `"Logbook · user-entered · log-only"`. Skip `plannedTime === "—"`. Id `log-{slot.id}`, label `entry.displayName ?? entry.officialName ?? entry.name`, `sub: null`, `logOnly: true`. Status: `taken` → completed; `skipped` → skipped; `missed` → past-due; `planned` → point status. Action: completed or skipped → open-view "Open Compound Command" supplements; else `{ kind: "mark-logged", label: "Mark Completed", entryId, plannedTime }`. Every other item has `logOnly: false`.

  **Due next.** Across non-logbook lanes, the single earliest `upcoming` item (ties: lane order training, fuel, recovery, sleep) becomes `due-next`. Within the logbook lane, its own earliest `upcoming` becomes `due-next`. Sort each lane's items by `startMin`. `timeLabel = fmt(startMin)`.

  **Lanes and empties.** Order training, fuel, recovery, sleep, then logbook. `empty` is null when a lane has items. Training empty: `direction === "moved-away"` → "Session moved off today"; otherwise when not planned and not a recovery day → "Session set aside today"; action open-view "Open Training Command" training. Fuel empty → "No meal windows mapped", open-view "Map Meal Windows" schedule-command. Recovery empty → "Nothing scheduled", null. Sleep empty → "Sleep target not set", open-view "Open Schedule" schedule-command.

  **Window.** `endMin = sleepMin + 30`; `startMin = max(wakeMin, min(min(nowMin, sleepMin) − 240, endMin − 360))`.

  **Earlier.** Non-logbook items whose action kind is log-meal, undo-meal-log, start-session or review-session and whose `(endMin ?? startMin) < window.startMin`. `total` = count, `done` = those `completed`.

  **Next Move**, first rule that applies:
  1. `sessionMode === "live"` → title "Resume Live Session", context "Training · Live", whyNow `` `${today.sessionName} is live — pick up where you left off.` ``, itemId `"session"`, action start-session "Resume Live Session".
  2. `nowMin < wakeMin` → title "Protect Sleep", context "Overnight", whyNow `` `It's before your ${fmt(wakeMin)} wake time — rest supports tomorrow's readiness.` ``, itemId null, action open-view "Open Recovery Command" recovery.
  3. `nowMin ≥ sleepMin` → title "Protect Sleep", context "Sleep lock", whyNow `` `Past your ${fmt(sleepMin)} sleep target — close the day and protect the window.` ``, itemId `"sched-sleep-target"` (null if absent), same action.
  4. Otherwise pick from non-logbook items. First the `due-now` items with an action other than undo-meal-log, ranked start/review-session → log-meal → open-view, ties by earliest start. If none, the `due-next` item. If none, rule 3 with whyNow `` `Nothing else stands between you and the ${fmt(sleepMin)} sleep target.` `` and context "Sleep lock".
  - Status word: due-now "Due now", due-next "Due next", upcoming "Upcoming".
  - Title and copy for the chosen item:
    - **Meal:** title = label when it matches `/meal|snack/i`, else `` `${label} Meal` ``. Context `` `Fuel window · ${word}` ``. whyNow: due-now `` `Window closes ${fmt(start + 30)} · ${sub}` ``, otherwise `` `Opens ${item.timeLabel} · ${sub}` ``.
    - **Session:** title = label. Context `` `Training · ${word}` ``. whyNow: due-now `` `Session window ${fmt(start)}–${fmt(end)}${durationMin != null ? ` · ${durationMin} min planned` : ""}.` ``, otherwise `` `Starts ${fmt(start)}${…same suffix}.` ``.
    - **Any other item:** title = label. Context `` `${lane label} · ${word}` ``. whyNow `` `${item.timeLabel}${sub ? ` · ${sub}` : ""}` ``.
  - itemId = item.id; action = item.action.

  **Then.** The first non-logbook item with `startMin` greater than the chosen item's `startMin` (or greater than `nowMin` when itemId is null), whose status is not completed, skipped or past-due.

  **Risk.** `detectSleepConflict(schedule, { trainingPlanned })`:
  - Conflict → `Sleep compression`; detail "Training ends at or after sleep" when severity is `conflict`, else "Short window before sleep".
  - Else any signal with `severity === "high"` → `Elevated`; detail is the first such title.
  - Else any signal → `Moderate`; detail is the first title.
  - Else `Low`; detail `` `Sleep lock ${fmt(sleepMin)}` ``.

  **Sleep lock.** `{ min: sleepMin, label: fmt(sleepMin) }`.

- [ ] **Step A4: Run and pass**

Run: `npx vitest run src/lib/apex/__tests__/today-resolver.test.ts`
Expected: PASS, 18 tests. Do not edit the test to make it pass; if a rule and a test disagree, report it.

### A5: Training context reaches the engines

**Files:** Modify `src/lib/ai-strategist/engine.ts:30-38,80-81`, `src/lib/apex/engine.ts:439,534,577`. Create `src/lib/apex/__tests__/engine-context.test.ts`.

- [ ] **Step A5.1:** Add an optional field to `StrategistContext`:
  `trainingContext?: Pick<TrainingScheduleContext, "trainingPlanned" | "direction">;`
  Import the type from `@/lib/schedule/engine`.
- [ ] **Step A5.2:** Pass `ctx.trainingContext` as the context argument everywhere it is accepted: `getScheduleNextAction(ctx.schedule, now, ctx.trainingContext)` and `detectSleepConflict(ctx.schedule, ctx.trainingContext)` in the ai-strategist engine; `detectSleepConflict(ctx.schedule, ctx.trainingContext)`, `buildTodaySchedule(ctx.schedule, ctx.trainingContext)` and `getScheduleNextAction(ctx.schedule, now, ctx.trainingContext)` in the apex engine. `undefined` must keep today's defaults — the callees already default their parameter.
- [ ] **Step A5.3: Write the test.** Build a `StrategistContext` from the store's default slices; find them near `src/lib/athlete-store.ts:4800` or their modules' `DEFAULT_*` exports. Schedule `{ ...DEFAULT_SCHEDULE_PROFILE, preferredTrainingStart: "17:30", preferredTrainingEnd: "19:00" }`, `now = new Date(2026, 8, 15, 17, 45)`.
  - Without `trainingContext`: `buildApexView(ctx).nextMove.title === "Start Training"`.
  - With `{ trainingPlanned: false, direction: "moved-away" }`: `nextMove.title !== "Start Training"`.
  - With that context, `buildStrategistBriefing(ctx)` does not rank "Start Training" as `highestRoiAction.title`.
- [ ] **Step A5.4:** `npx vitest run src/lib/apex/__tests__/engine-context.test.ts` → PASS.

### A6: One logged-protein summary

**Files:** Modify `src/lib/nutrition/fuel-plan.ts`, `src/components/views/nutrition/FuelCommandPanel.tsx:326-333`. Create `src/lib/nutrition/__tests__/logged-protein.test.ts`.

- [ ] **Step A6.1: Test first:**

```ts
import { describe, expect, it } from "vitest";

import { summarizeLoggedProtein } from "../fuel-plan";

const macros = (proteinG: number) => ({ calories: 500, proteinG, carbsG: 50, fatG: 10 });

describe("summarizeLoggedProtein", () => {
  const meals = [
    { id: "a", macros: macros(40) },
    { id: "b", macros: macros(30) },
    { id: "c", macros: macros(25) },
  ];

  it("sums protein from logged meals only", () => {
    expect(summarizeLoggedProtein(meals, ["a", "c"])).toBe(65);
    expect(summarizeLoggedProtein(meals, [])).toBe(0);
  });

  it("uses an override's macros in place of the planned meal", () => {
    expect(summarizeLoggedProtein(meals, ["a"], { a: { macros: macros(55) } })).toBe(55);
  });
});
```

If `FuelMacros` has other required fields, extend `macros()` to satisfy the type — keep the protein values.

- [ ] **Step A6.2:** Run → FAIL. Then add to `fuel-plan.ts`:

```ts
/** Protein from the meals the member logged — the one sum every surface shows ("est · logged meals"). */
export function summarizeLoggedProtein(
  meals: ReadonlyArray<Pick<PlannedFuelMeal, "id" | "macros">>,
  loggedMealIds: readonly string[],
  overrides: Readonly<Record<string, Pick<PlannedFuelMeal, "macros">>> = {},
): number {
  return meals
    .filter((m) => loggedMealIds.includes(m.id))
    .reduce((sum, m) => sum + (overrides[m.id] ?? m).macros.proteinG, 0);
}
```

- [ ] **Step A6.3:** In `FuelCommandPanel.tsx`, replace the inline `proteinLogged` reduce with `summarizeLoggedProtein(dailyPlan.meals, loggedMealIds, overrides)`. Keep `logged` if other lines still use it.
- [ ] **Step A6.4:** Run the test → PASS. Then run `npx vitest run src/lib/apex src/lib/nutrition`, `npx eslint` on your files, and `npx tsc --noEmit`.

**Report back:** test counts, any rule ambiguity you resolved (with the choice made), `tsc` errors seen in files you do not own.

---

## Task B: Shell (agent "shell")

Read first: `src/components/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `BottomTicker.tsx`, `src/components/ui/reserve/ReserveSurfaces.tsx` (ReserveBottomSheet), `ReserveLayout.tsx` (ReserveActionBar), `ReserveShellPortal.tsx`, `src/lib/hooks/useMediaQuery.ts`, and `.claude/skills/reserve-design-constitution/references/{components,responsive,accessibility,motion}.md`.

- [ ] **B1 — Shell UI store.** Create `src/lib/ui/shell-store.ts`: a non-persisted zustand store `useShellStore` with `navOpen: boolean`, `setNavOpen(open: boolean)`. Never add this to the persisted athlete store.
- [ ] **B2 — Left sheet.** Add `side?: "bottom" | "left"` to `ReserveBottomSheet`, default `"bottom"` with rendering unchanged.
  - `"left"`: the panel is a full-height left drawer, `w-[min(86vw,320px)]`, starting at `.safe-top`, with a rounded right edge (`rounded-r-[22px]`). It slides in from the left using the existing easing and duration.
  - Focus trap, Escape, backdrop close, focus restore and scroll lock stay exactly as they are.
  - The motion falls under the global reduced-motion kill.
- [ ] **B3 — Sidebar variants.** Add props `variant?: "rail" | "overlay"` (default `"rail"`) and `onNavigate?: () => void`.
  - `overlay` always renders the expanded layout (labels, group headers, tier chip) regardless of `sidebarCollapsed`, and hides the collapse toggle.
  - After `setActiveView(view)` it calls `onNavigate?.()`.
  - Rail behaviour is unchanged.
- [ ] **B4 — AppShell.** Use `useIsPhone()` and `activeView` from the store. The layout:

```tsx
<div className="safe-x relative flex h-screen flex-col overflow-hidden">
  <AnimatedBackground />
  {showOnboarding && <OnboardingWizard />}
  <div className="safe-top relative z-10 flex min-h-0 flex-1">
    {!isPhone && <Sidebar />}
    <div className="flex min-w-0 flex-1 flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  </div>
  <div className="safe-bottom relative z-20">
    <div id="reserve-slot-dock" />
    {showTicker && <BottomTicker />}
  </div>
  {isPhone && (
    <ReserveBottomSheet side="left" open={navOpen} onClose={() => setNavOpen(false)} title="Navigation">
      <Sidebar variant="overlay" onNavigate={() => setNavOpen(false)} />
    </ReserveBottomSheet>
  )}
</div>
```

  - `showTicker = !isPhone && activeView !== "dashboard"`.
  - Use `RESERVE_SHELL_SLOT_ID.dock` rather than the literal id.
  - Keep the existing mount effects.
  - If the sheet's own chrome fights the sidebar (double padding, a title bar), give the sheet a prop to render bare. Do not hand-roll a second modal.
- [ ] **B5 — TopBar.**
  - **Menu button:** on phones it calls `setNavOpen(true)`; on `md`+ it calls `toggleSidebar()` as today. Give it `aria-label="Open navigation"` on phones and `aria-expanded`.
  - **Centre region:** always render `<div id={RESERVE_SHELL_SLOT_ID.topbar} className="hidden min-w-0 flex-1 items-center justify-center md:flex" />`. Render the existing greeting, quick-stat chips and system status only when `activeView !== "dashboard"`, placed inside that same flex region beside the slot.
  - **Hit areas:** the menu, bell and avatar controls reach 44×44px (hit area may exceed the visual size).
  - Change nothing else visually.
- [ ] **B6 — ReserveActionBar docks on phones.** Add `dock?: "phone" | "never"` (default `"phone"`).
  - When `dock === "phone"` and `useIsPhone()`: render the bar through `<ReserveShellPortal slot="dock">` as a static bar, not `sticky`. Keep the feathered background and `px-3 pt-3 pb-3`; `.safe-bottom` now comes from the shell container, so do not add it again.
  - Otherwise: render exactly today's sticky bar.
- [ ] **B7 — E2E harness.**
  - In `tests/e2e/visual-system-qa.spec.ts` `bootTo`, the sidebar-settle wait uses `page.locator("aside").first()`, which never resolves on phones once the rail is gone. Make it resolve when there is no `aside`, when the aside is ≤ 60px wide, or when `innerWidth ≥ 768`. Use `page.evaluate` against `document.querySelector("aside")`.
  - Search every `tests/e2e/*.spec.ts` for sidebar or `aside` navigation at phone widths and adapt it to open the menu first.
  - Leave dashboard content assertions alone; the integrator owns them.
- [ ] **B8 — Validate.**
  - `npx eslint` on every file you touched and `npx tsc --noEmit`.
  - `RESERVE_E2E_PORT=3300 npx playwright test tests/e2e/visual-system-qa.spec.ts --grep "Nutrition Command"` — Nutrition is not being redesigned, so failures there are yours.
  - With Playwright against `http://127.0.0.1:3300` (seed as `bootTo` does, view `nutrition`), save screenshots to your scratchpad at 390×844 with the menu closed and open, and at 1440×1000. Report the file paths.

**Report back:** files changed, what each does, screenshot paths, test output, anything left undone.

---

## Task C: Below the line (agent "briefing")

Read first: `src/components/apex/ApexCommandV2.tsx` lines 250–405 (helpers) and 1786–2245 (the blocks), `src/components/FinalBossDashboard.tsx`, `.claude/skills/reserve-design-constitution/references/clinical-data.md` and `copy.md`, the spec §4.4–§6. **Do not edit `ApexCommandV2.tsx`** — copy from it. The integrator is refactoring its derivation section; its JSX and variable names will not change.

- [ ] **C1 — `sourceToView`, fixed and tested.** Create `src/lib/apex/source-to-view.ts`:
  - Export `sourceToView(source: string): DashboardView | null`.
  - Match on `source.trim().toLowerCase()` with today's cases, adding `"compounds"` → supplements.
  - Test in `src/lib/apex/__tests__/source-to-view.test.ts`, covering capitalised and lowercase inputs for every case plus an unknown source → null. Before writing it, read `SourceSystem` in `src/lib/ai-strategist/types.ts` and test every value it can take.
- [ ] **C2 — Shared pieces.** Create `src/components/apex/briefing/shared.tsx`: `LuxTile`, `TrendGlyph`, `STATUS_COLOR`, `STATUS_LABEL`, copied from ApexCommandV2 with the palette imported from `@/lib/design/tokens`.
- [ ] **C3 — Blocks.** Each is a client component with explicit props and markup and strings copied unchanged. Replace every `setActiveView(x)` with `onNavigate(x)`, typed `(view: DashboardView) => void`. Prop types come from the lib modules (`BiomarkerCommand`, `EvidenceItem`, `MeasurementReview`, `PhotoReview`, `EnhancedCommand`, `StrategistBriefing`, the summary type of `summarizeEnhancementSchedule`, etc.):
  - `SmartBriefBlock.tsx` — `{ smartBrief: { mission; highRoi; limiter; protect; avoid; afterTraining; nextEvidence: string }; confidenceLevel: string; intakeSummary; onNavigate }`
  - `PhysiquePriorityBlock.tsx` — `{ weakPointLabels: string[]; momentum: string; checkInCadence: string; physiqueEvidence: number; onNavigate }`. The hard-coded "Signal Watch" line is not derived from data (Bible §12). Remove that row and keep the other two.
  - `BiomarkerBlock.tsx` — `{ biomarkers; onNavigate }`
  - `AutoReviewBlock.tsx` — `{ biomarkers; measurementReview; photoReview; onNavigate }`
  - `EnhancedBlock.tsx` — `{ enhanced; enhancedLogOnly; intakeSummary; biomarkers; onNavigate; onEnableEnhanced: () => void; canAccessEnhanced: boolean }`. Keep "Keep Hidden" as local state.
    - Honest Configure: when `canAccessEnhanced`, call `onEnableEnhanced()` then `onNavigate("supplements")`. Otherwise do not enable anything; label the action "Configure Enhanced Tracking · Reserve Black" and only navigate.
    - Find how access to `supplements` is decided (`src/components/ViewRouter.tsx`, `src/lib/saas-config.ts`, `src/lib/modules/registry.ts`). Put that exact check in a pure exported helper `canAccessView(tier, view)` in `src/lib/apex/source-to-view.ts` with a test, so the integrator can compute `canAccessEnhanced`.
  - `SystemLedger.tsx` — `{ systems: StrategistBriefing["systemMatrix"]; onNavigate }`. One flat list, no bento and no tiles: system name, status word, the full note (no line clamp), and a link only when `target` exists. The Bloodwork and Compound notes must render in full.
  - `WatchEvidencePanel.tsx` — `{ hurting: StrategistBriefing["hurting"]; evidence: EvidenceItem[]; confidenceLevel: string; onNavigate }` using the fixed `sourceToView`. This one renders below the line on the page, not inside Full briefing.
  - `FullBriefing.tsx` — a `ReserveDisclosure summary="Full briefing"` (closed by default) holding, in order: SmartBrief + PhysiquePriority (two columns on `lg`), `WeeklyChallengeCard` (existing, prop `onOpenNutrition`), `NutritionAlignmentCard` (existing, compact), BiomarkerBlock, AutoReviewBlock, EnhancedBlock, SystemLedger. Props are the union of its children's, passed straight through.
- [ ] **C4 — Consistency honesty.** `recordDailyCheckIn` only bumps streak and milestone engagement; it records no recovery data. Grep its callers.
  - If `FinalBossDashboard.tsx` is the only caller, relabel the button "Mark Today Checked In" and keep the call.
  - If a real recovery check-in path already records engagement, route this button there ("Log Recovery Check-in" → `recovery`) and drop the call.
  - Edit only the `Consistency` function.
- [ ] **C5 — Bible amendment.** Edit `DESIGN_BIBLE.md` into V1.1:
  - Title line → `RESERVE DESIGN BIBLE — V1.1`.
  - Rewrite §13's "Above the fold (locked order)" and "Section order below the fold" per spec §6.
  - Add the §11 simultaneous-visibility clause and the §08 now-marker clause.
  - Add a changelog line at the end: `*V1.1 — 2026-09-13: Apex becomes the Pit Wall; Performance Core retired from Apex; layers 1–4 simultaneously visible (owner-approved direction A).*`
  - Change nothing else.
- [ ] **C6 — Validate.** `npx vitest run src/lib/apex/__tests__/source-to-view.test.ts`, `npx eslint src/components/apex/briefing src/lib/apex/source-to-view.ts src/components/FinalBossDashboard.tsx`, `npx tsc --noEmit`.

**Report back:** each block's final props type, how `canAccessView` decides, the C4 choice and why, test output.

---

## Task D: Model + Pit Wall (integrator)

- [ ] **D1** `src/lib/apex/statement.ts` — move `readinessStatement` verbatim; import it in ApexCommandV2.
- [ ] **D2** `src/components/apex/model/useApexModel.ts` — move the derivation block (`ApexCommandV2.tsx:407–1164`) and its pure helpers into the hook, which returns every value the JSX reads; `export type ApexModel = ReturnType<typeof useApexModel>`. ApexCommandV2 destructures it. Verify: typecheck, plus `innerText` of `main` at 1440×1000 is identical before and after.
- [ ] **D3** In the model:
  - Add `trainingContext` from `resolveTrainingScheduleContext(trainingOverrides, localScheduleDateKey(clock))`.
  - Add `todayResolved = getTodayTrainingWeekDay(apexWeek)`, the edit-aware day.
  - Feed `todayResolved` to the statement, the fuel plan (`isTrainingDay = trainingPlanned`), `buildMealPlan(schedule, trainingContext)`, the smart brief, and the intake schedule.
  - Pass `trainingContext` into `buildApexView`.
- [ ] **D4** `src/components/apex/model/useApexToday.ts` — `resolveApexToday` from model fields; memoised on the minute clock.
- [ ] **D5** `src/components/apex/pit-wall/` — `PitWallView`, `StatusBus`, `ConditionColumn`, `DayTimeline`, `NowSpine`, `LaneItemSheet`, `NextMovePanel`, `AdjustTodaySheet`, `useApexActions` (binds `ApexAction` to store actions), and a dev preview route `src/app/dev/pit-wall/page.tsx` (404 in production).

## Task E: Integration and validation (integrator)

- [ ] **E1** `FinalBossDashboard` renders `PitWallView` + `WatchEvidencePanel` + `FullBriefing` + Secondary Systems + Consistency + footer. `resolveSystemState` feeds the Next Move instead of stacking a notice. Delete `ApexCommandV2.tsx` and prune unused model fields.
- [ ] **E2** Dashboard assertions in `tests/e2e/visual-system-qa.spec.ts`:
  - At 390×844 and 375×812: `h1`, the readiness readout, the Next Move title and the risk line all have `getBoundingClientRect().bottom ≤ innerHeight`.
  - Exactly one visible filled gold action.
  - The week rail does not scroll internally.
- [ ] **E3** `npm run lint`, `npm run typecheck`, `npm test`. Stop the preview server, run `npm run build`, restart the preview server, then `RESERVE_E2E_PORT=3300 npx playwright test tests/e2e/visual-system-qa.spec.ts`.
- [ ] **E4** Capture 1440×1000 and 390×844. Run the reserve-design-director, reserve-mobile-critic, reserve-accessibility-auditor, reserve-copy-director and reserve-visual-qa agents in parallel on the captures. Fix every blocker and re-run E3.
- [ ] **E5** Report to the owner with before/after images. Nothing committed.
