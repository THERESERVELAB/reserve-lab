import { test, expect, type Page } from "@playwright/test";
import { BORDERED_PANEL_RULE, BROAD_RULE, nestedSurfaces } from "./support/surface-nesting";
import { goldActions as findGoldActions } from "./support/gold-action";

/**
 * ROOM DEPTH — the living rooms held to the screen recipe BELOW the first
 * screen, at 1440×1000 and at 390×844 with touch.
 *
 * `phone-rooms.spec.ts` proves the first two sections of each room. This proves
 * the rest of the page, scrolled end to end, against the program redesign spec
 * (docs/superpowers/specs/2026-09-15-program-redesign.md §3 and §6):
 *
 *   · no bordered rounded panel sits inside another anywhere in `main` —
 *     measured from computed border and radius ancestry, not class names, so a
 *     card inside a card cannot come back under a different class
 *   · no surface inside another under the BROAD rule: a rounded element with a
 *     border OR a non-transparent background OR a box-shadow, inside another
 *     such element. The border-only rule above let tinted and shadowed tiles
 *     through (Training's Session Directive objectives, Split Architect days).
 *     Content behind a closed disclosure is not on screen and is not counted.
 *   · exactly one gold action per room (Bible §11: the gold CTA is scarce),
 *     counted two ways: near-black primary text AND gold background fill — a
 *     gold-filled control with other text colour slipped past the first check
 *   · no text on the horizon strip renders below 11px (Bible §13). The rooms
 *     keep their 7–9px whisper labels: `references/typography.md` sanctions
 *     those as Reserve's identity. The floor is a horizon rule, not a blanket
 *     minimum.
 *   · no horizontal overflow
 *
 * Seeding is the two-phase pattern the room specs use: the first load lets the
 * app write its own persisted state, and the patch lands in an init script
 * BEFORE the app boots on reload. Recovery is seeded WITH logs, so its debt,
 * sleep, hydration, "what's helping" and suite sections all render.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a training day, the pre-workout meal due. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);

type Room = {
  name: string;
  view: string;
  /** Present only once this room, and not another, has rendered. */
  ready: string;
};

const ROOMS: Room[] = [
  { name: "Apex", view: "dashboard", ready: '[data-apex="next-move-title"]' },
  { name: "Training", view: "training", ready: '[data-training="hero"]' },
  { name: "Nutrition", view: "nutrition", ready: '[data-nutrition="hero"]' },
  { name: "Recovery", view: "recovery", ready: '[data-recovery="hero"]' },
  { name: "Schedule", view: "schedule-command", ready: '[data-schedule="hero"]' },
];

const VIEWPORTS = [
  { name: "1440×1000", width: 1440, height: 1000, touch: false },
  { name: "390×844", width: 390, height: 844, touch: true },
] as const;

/**
 * `src/components/response/**` belongs to wave-1 agent B. Its context panels
 * embed into Training, Nutrition and Recovery and still carry one
 * tile-inside-a-panel. Excluded from the nesting rule by their own test ids and
 * reported to the lead rather than silently skipped.
 */
const NOT_OURS = ['[data-testid$="-response-context"]', '[data-testid$="-response-context"] *'].join(", ");

/**
 * Rooms held to the STRICT checks: gold counted by background fill as well as
 * text colour, and the broad nesting rule (border OR fill OR shadow). Every
 * other room keeps the border-only nesting check and text-colour gold count.
 *
 * Known offenders under the strict checks, found 2026-09-16 (add each room
 * here once its wave fixes them):
 *   (none open)
 *
 * Fixed and held strict since their waves: Apex ("Mark Done" is secondary),
 * Recovery (no tinted boxes inside its panels), Schedule, Nutrition (week
 * plan rebuilt as rows, the rest behind one closed disclosure).
 */
const STRICT_ROOMS: readonly string[] = ["training", "apex", "recovery", "schedule", "nutrition"];

/**
 * The 11px floor is a §13 rule about the HORIZON STRIP, not a blanket minimum.
 *
 * `references/typography.md` sanctions 7–9px uppercase mono whisper labels as
 * Reserve's identity and explicitly overrides generic readable-scale minimums,
 * so the rooms keep theirs. What §13 does require is that the timeline's own
 * labels — tick hours, lane names, spine time and status — never drop below
 * 11px, because that is where depth tempts a design into unreadable type.
 *
 * So the check reads the TIMELINE, not the panel around it: the item rows
 * (every horizon renders them as an `ol`) and, on Apex desktop, the whole
 * perspective track. A strip's own section header and footer meta are ordinary
 * whisper labels and keep their sanctioned size.
 */
const HORIZON_STRIPS = [
  '[data-training="horizon"]',
  '[data-nutrition="horizon"]',
  '[data-recovery="horizon"]',
  '[data-schedule="horizon"]',
  /* Apex: the phone spine and the desktop timeline track. */
  '[data-apex="now-spine"]',
  '[data-apex="day-timeline"]',
].join(", ");

async function bootRoom(page: Page, { view, ready }: Room) {
  await page.clock.setFixedTime(WHEN);
  await page.addInitScript(
    ({ k, v }) => {
      window.localStorage.setItem("fba-preview-view", v);
      const raw = window.localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      parsed.state = {
        ...parsed.state,
        onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
      };
      window.localStorage.setItem(k, JSON.stringify(parsed));
    },
    { k: KEY, v: view },
  );

  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    (k) => {
      const raw = window.localStorage.getItem(k);
      const state = raw ? JSON.parse(raw).state : null;
      return Boolean(state?.recoveryCommand && state?.nutritionPrefs && state?.scheduleProfile && state?.setupProfile);
    },
    KEY,
    { timeout: 30_000 },
  );

  const patched = await page.evaluate(
    ({ k, iso, v }) => {
      const now = new Date(iso);
      const dayKey = (offset: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() - offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.activeView = v;
      /* Logs present: Recovery's debt, sleep, hydration, helping and suite all render. */
      s.recoveryCommand = {
        ...s.recoveryCommand,
        sleepLogs: [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(7 - i), hours })),
        hydrationLogs: [{ date: dayKey(0), oz: 64 }],
        mobilityLogs: [{ date: dayKey(1), kind: "recovery", minutes: 10, focus: "Reset" }],
        stressCheckIns: [{ date: dayKey(0), stress: 2, energy: 4, mood: 4 }],
      };
      s.nutritionPrefs = { ...s.nutritionPrefs, loggedMealIds: [], latestMealLog: null, nutritionLogDate: dayKey(0) };
      s.scheduleProfile = {
        ...s.scheduleProfile,
        wakeTime: "06:30",
        sleepTarget: "22:30",
        trainingWindow: "evening",
        preferredTrainingStart: "17:30",
        preferredTrainingEnd: "19:00",
      };
      const steps: string[] = (s.setupProfile?.completedSteps ?? []).filter((step: string) => step !== "schedule");
      s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: now.toISOString(), completedSteps: [...steps, "schedule"] };
      s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: now.toISOString() };
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: WHEN.toISOString(), v: view },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });

  /* `visible`: Apex renders the Next Move twice — once for phones, once from
     `md` up — so the first match is the hidden one at desktop widths. */
  await expect(page.locator(ready).filter({ visible: true }).first(), `the ${view} room rendered`).toBeVisible({ timeout: 60_000 });
}

/** Walk the whole page so every section below the fold has entered and laid out. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`room depth at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    for (const room of ROOMS) {
      test(`${room.name}: no card in a card, one gold action, a readable horizon`, async ({ page }) => {
        test.setTimeout(240_000);
        await bootRoom(page, room);
        await scrollThrough(page);

        /* ── No bordered rounded panel inside another, anywhere in main ── */
        const nesting = await nestedSurfaces(page, BORDERED_PANEL_RULE, { exclude: NOT_OURS, classes: 4 });
        expect(nesting, `bordered rounded panels nested inside another in ${room.name}`).toEqual([]);

        /* ── No surface inside another, broad rule (strict rooms only) ─── */
        /* By room name, lower-cased ("apex", not its view key "dashboard"). */
        const strict = STRICT_ROOMS.includes(room.name.toLowerCase());
        const broad = !strict ? [] : await nestedSurfaces(page, BROAD_RULE, { exclude: NOT_OURS, classes: 4 });
        expect(broad, `surfaces nested inside another surface (broad rule) in ${room.name}`).toEqual([]);

        /* ── Exactly one gold action ──────────────────────────────────── */
        /* Two detections: ReserveButton's primary tier paints #0a0b10 text, and any
           control in main painted with a gold background fill. The shell's dock
           counts as the room's own: below md a room's action bar portals there
           (ReserveActionBar), outside main, and Apex's one gold action lives in it. */
        /* Both read colours in any format (support/gold-action), so an oklab or oklch gold cannot slip past. */
        const gold = {
          text: await findGoldActions(page, { selector: "button", match: "text" }),
          fill: await findGoldActions(page, {
            selector: "main button, main a, main [role=button], #reserve-slot-dock button, #reserve-slot-dock a, #reserve-slot-dock [role=button]",
            match: "fill",
          }),
        };
        expect(gold.text, `exactly one gold action (text colour) in ${room.name}`).toHaveLength(1);
        if (strict) expect(gold.fill, `exactly one gold action (gold fill) in ${room.name}`).toHaveLength(1);

        /* ── Nothing under 11px on the horizon strip (Bible §13) ──────── */
        const small = await page.evaluate((strips) => {
          const out: string[] = [];
          for (const strip of document.querySelectorAll(strips)) {
            /* The timeline itself: its item rows, plus the whole track where the
               strip IS the track (Apex desktop). Not the panel's header or footer. */
            const scope = strip.matches('[data-apex="day-timeline"]')
              ? [strip, ...strip.querySelectorAll("*")]
              : [...strip.querySelectorAll("ol, ol *")];
            for (const el of scope) {
              if (el.closest(".sr-only")) continue;
              const own = [...el.childNodes]
                .filter((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim())
                .map((n) => (n.textContent ?? "").trim())
                .join(" ");
              if (!own) continue;
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;
              const px = parseFloat(getComputedStyle(el).fontSize);
              if (px >= 11) continue;
              out.push(`${px}px ${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 3).join(".")} "${own.slice(0, 30)}"`);
            }
          }
          return [...new Set(out)];
        }, HORIZON_STRIPS);
        expect(small, `text under the §13 11px floor on ${room.name}'s horizon`).toEqual([]);

        /* ── No sideways scroll ───────────────────────────────────────── */
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `sideways scroll in ${room.name}`).toBeLessThanOrEqual(1);
      });
    }
  });
}
