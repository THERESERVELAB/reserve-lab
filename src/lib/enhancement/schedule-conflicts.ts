/* ════════════════════════════════════════════════════════════════════════
   SCHEDULE CONFLICTS — clashes in the times the member chose, with sources.

   The member decides every time on their schedule. Reserve reads the day as
   they set it and names the clashes a label or public health source
   describes:
     · absorption — minerals set close to antibiotics or thyroid medicine
     · stimulants set close to the member's own bedtime
     · sedating products set shortly before their training time
     · the same nutrient coming from several products on one day

   It never says what time to take anything, never moves an item and never
   suggests stopping one. It names the clash and who can talk it through.
   ════════════════════════════════════════════════════════════════════════ */

import type { ProfileSource } from "@/lib/compound-intelligence/risk-profiles";
import { CATALOG_INGREDIENTS, DUPLICATE_WATCH, NUTRIENT_LABEL, type NutrientKey } from "@/lib/compound-intelligence/support-options";

import type { EnhancementScheduleSlot } from "./schedule";

export const SCHEDULE_CONFLICTS_VERSION = "2026.09.16";

export type ConflictKind = "absorption" | "stimulant-bedtime" | "sedating-training" | "duplicate-nutrient";

export type ScheduleConflict = {
  id: string;
  kind: ConflictKind;
  title: string;
  detail: string;
  /** Names and chosen times of the items involved, as the member set them. */
  items: Array<{ name: string; time: string }>;
  source: ProfileSource;
};

const SRC = {
  dailymedTetracycline: { label: "Doxycycline and minocycline prescribing information (DailyMed)", url: "https://dailymed.nlm.nih.gov" },
  dailymedQuinolone: { label: "Ciprofloxacin and levofloxacin prescribing information (DailyMed)", url: "https://dailymed.nlm.nih.gov" },
  dailymedLevothyroxine: { label: "Levothyroxine prescribing information (DailyMed)", url: "https://dailymed.nlm.nih.gov" },
  caffeineSleep: { label: "Drake C, et al. Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed. Journal of Clinical Sleep Medicine, 2013." },
  nccihMelatonin: { label: "NIH National Center for Complementary and Integrative Health: Melatonin", url: "https://www.nccih.nih.gov/health/melatonin-what-you-need-to-know" },
  nccihKava: { label: "NIH National Center for Complementary and Integrative Health: Kava", url: "https://www.nccih.nih.gov/health/kava" },
  nccihValerian: { label: "NIH National Center for Complementary and Integrative Health: Valerian", url: "https://www.nccih.nih.gov/health/valerian" },
  odsFactSheets: { label: "NIH Office of Dietary Supplements fact sheets", url: "https://ods.od.nih.gov" },
} satisfies Record<string, ProfileSource>;

const nameOf = (slot: EnhancementScheduleSlot) => [slot.entry.displayName, slot.entry.officialName, slot.entry.name].filter(Boolean).join(" ");
const matches = (slot: EnhancementScheduleSlot, pattern: RegExp) => pattern.test(nameOf(slot));

const MINERALS = /\b(?:zinc|iron|ferrous|calcium|magnesium|multivitamin|multi-vitamin|antacid|tums)\b/i;
const TETRACYCLINES = /\b(?:doxycycline|minocycline|tetracycline)\b/i;
const QUINOLONES = /\b(?:ciprofloxacin|levofloxacin|moxifloxacin|cipro)\b/i;
const THYROID = /\b(?:levothyroxine|synthroid|thyroxine|t4 medication)\b/i;
const STIMULANTS = /\b(?:caffeine|pre-?workout|yohimbine|yohimbe|synephrine|bitter orange|clenbuterol|ephedrine|dmha|dmaa|energy drink)\b/i;
const SEDATING = /\b(?:melatonin|kava|valerian|diphenhydramine|zzzquil|unisom|doxylamine)\b/i;

function minutesOf(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Minutes between two clock times on the same day, ignoring order. */
function gapMinutes(a: string, b: string): number | null {
  const x = minutesOf(a);
  const y = minutesOf(b);
  return x === null || y === null ? null : Math.abs(x - y);
}

/** Minutes from `from` forward to `to`, wrapping past midnight. */
function minutesUntil(from: string, to: string): number | null {
  const x = minutesOf(from);
  const y = minutesOf(to);
  return x === null || y === null ? null : (y - x + 1440) % 1440;
}

/** "22:30" → "10:30 PM", matching how slot times read. */
function clock12(time: string): string {
  const total = minutesOf(time);
  if (total === null) return time;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const label = (slot: EnhancementScheduleSlot) => ({ name: slot.entry.displayName || slot.entry.name, time: slot.plannedTimeLabel });

export type ScheduleConflictInput = {
  slots: EnhancementScheduleSlot[];
  sleepTime?: string;
  trainingTime?: string;
};

export function findScheduleConflicts(input: ScheduleConflictInput): ScheduleConflict[] {
  const timed = input.slots.filter((slot) => minutesOf(slot.plannedTime) !== null);
  const conflicts: ScheduleConflict[] = [];

  /* Absorption: a mineral set within the label's window of an antibiotic or thyroid medicine. */
  const absorptionRules: Array<{ drugs: RegExp; windowMinutes: number; title: string; detail: string; source: ProfileSource }> = [
    {
      drugs: TETRACYCLINES,
      windowMinutes: 120,
      title: "Minerals near a tetracycline antibiotic",
      detail: "These are set within 2 hours of each other. The prescribing information says calcium, iron, magnesium and zinc bind this antibiotic and can stop it being absorbed.",
      source: SRC.dailymedTetracycline,
    },
    {
      drugs: QUINOLONES,
      windowMinutes: 120,
      title: "Minerals near a quinolone antibiotic",
      detail: "These are set within 2 hours of each other. The prescribing information says products with calcium, iron, magnesium or zinc can stop this antibiotic being absorbed.",
      source: SRC.dailymedQuinolone,
    },
    {
      drugs: THYROID,
      windowMinutes: 240,
      title: "Minerals near thyroid medicine",
      detail: "These are set within 4 hours of each other. The prescribing information says calcium, iron and magnesium products can reduce how much thyroid medicine is absorbed.",
      source: SRC.dailymedLevothyroxine,
    },
  ];
  for (const rule of absorptionRules) {
    for (const drug of timed.filter((s) => matches(s, rule.drugs))) {
      for (const mineral of timed.filter((s) => s.entryId !== drug.entryId && matches(s, MINERALS))) {
        const gap = gapMinutes(drug.plannedTime, mineral.plannedTime);
        if (gap !== null && gap < rule.windowMinutes) {
          conflicts.push({ id: `absorption-${drug.id}-${mineral.id}`, kind: "absorption", title: rule.title, detail: rule.detail, items: [label(drug), label(mineral)], source: rule.source });
        }
      }
    }
  }

  /* Stimulants within 6 hours of the member's own bedtime. */
  if (input.sleepTime) {
    for (const slot of timed.filter((s) => matches(s, STIMULANTS))) {
      const until = minutesUntil(slot.plannedTime, input.sleepTime);
      if (until !== null && until < 360) {
        conflicts.push({
          id: `stimulant-${slot.id}`,
          kind: "stimulant-bedtime",
          title: "A stimulant close to your bedtime",
          detail: `Set about ${Math.round(until / 60 * 10) / 10} hours before the bedtime in your schedule. In a sleep-lab study, caffeine taken even 6 hours before bed measurably reduced sleep.`,
          items: [label(slot), { name: "Bedtime", time: clock12(input.sleepTime) }],
          source: SRC.caffeineSleep,
        });
      }
    }
  }

  /* Sedating products within 2 hours before the member's training time. */
  if (input.trainingTime) {
    for (const slot of timed.filter((s) => matches(s, SEDATING))) {
      const until = minutesUntil(slot.plannedTime, input.trainingTime);
      if (until !== null && until > 0 && until < 120) {
        const source = /kava/i.test(nameOf(slot)) ? SRC.nccihKava : /valerian/i.test(nameOf(slot)) ? SRC.nccihValerian : SRC.nccihMelatonin;
        conflicts.push({
          id: `sedating-${slot.id}`,
          kind: "sedating-training",
          title: "Something sedating before training",
          detail: "Set shortly before the training time in your schedule. Drowsiness is a listed effect, which matters for heavy lifting, driving and balance.",
          items: [label(slot), { name: "Training", time: clock12(input.trainingTime) }],
          source,
        });
      }
    }
  }

  /* The same watched nutrient from more than one product on the day. */
  const byNutrient = new Map<NutrientKey, EnhancementScheduleSlot[]>();
  for (const slot of input.slots) {
    const names = [slot.entry.officialName, slot.entry.name].filter(Boolean) as string[];
    const ingredients = names.flatMap((n) => CATALOG_INGREDIENTS[n] ?? []);
    for (const { nutrient } of ingredients) {
      if (!DUPLICATE_WATCH.has(nutrient)) continue;
      const list = byNutrient.get(nutrient) ?? [];
      if (!list.some((s) => s.entryId === slot.entryId)) list.push(slot);
      byNutrient.set(nutrient, list);
    }
  }
  for (const [nutrient, slots] of byNutrient) {
    if (slots.length < 2) continue;
    conflicts.push({
      id: `duplicate-${nutrient}`,
      kind: "duplicate-nutrient",
      title: `${NUTRIENT_LABEL[nutrient]} from more than one product today`,
      detail: `${slots.length} products on today's schedule contain or commonly contain ${NUTRIENT_LABEL[nutrient].toLowerCase()}. Amounts from each add together; the labels show how much.`,
      items: slots.map(label),
      source: SRC.odsFactSheets,
    });
  }

  return conflicts;
}
