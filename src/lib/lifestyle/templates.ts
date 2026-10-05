/* ════════════════════════════════════════════════════════════════════════
   PLUG-AND-PLAY LIFESTYLE TEMPLATES — strong starting weeks the member can
   adopt as-is, then edit freely. A template is only ever a DRAFT copy with
   fresh ids: adopting one never touches an existing member schedule.
   ════════════════════════════════════════════════════════════════════════ */

import {
  lifestyleId,
  type LifestyleActivity,
  type LifestyleSchedule,
} from "./types";

type ActivitySeed = Omit<LifestyleActivity, "id">;

export type LifestyleTemplate = {
  key: string;
  name: string;
  tagline: string;
  rotationLengthDays: number;
  weekAnchor: number;
  activities: ActivitySeed[];
};

const lift = (dayIndex: number, title: string, focus: string[], extra?: Partial<ActivitySeed>): ActivitySeed => ({
  dayIndex, type: "strength", title, focus, fixed: false, intensity: "high",
  durationMinutes: 75, ...extra,
});
const act = (dayIndex: number, type: LifestyleActivity["type"], title: string, extra?: Partial<ActivitySeed>): ActivitySeed => ({
  dayIndex, type, title, fixed: false, ...extra,
});

export const LIFESTYLE_TEMPLATES: LifestyleTemplate[] = [
  {
    key: "hybrid-six",
    name: "Hybrid Six + Recovery",
    tagline: "Full-body strength, dedicated push/pull, arms, HIIT, and a real recovery day.",
    rotationLengthDays: 7,
    weekAnchor: 0,
    activities: [
      lift(0, "Full Body Strength", ["full body"]),
      lift(1, "Upper Body Push", ["upper push"]),
      lift(2, "Lower Body Strength", ["lower"]),
      lift(3, "Upper Body Pull", ["upper pull"]),
      lift(4, "Arms / Core", ["arms", "core"], { intensity: "moderate", durationMinutes: 60 }),
      act(5, "hiit", "HIIT Strength / Conditioning", { intensity: "high", durationMinutes: 45 }),
      act(6, "recovery", "Recovery / Mobility", { intensity: "low", durationMinutes: 40 }),
    ],
  },
  {
    key: "track-plus-lift",
    name: "Track + Lift",
    tagline: "Monday on the track, six days under the bar — sequenced around sprint recovery.",
    rotationLengthDays: 7,
    weekAnchor: 0,
    activities: [
      act(0, "track", "Track / Sprint Work", { intensity: "high", durationMinutes: 75 }),
      lift(1, "Full Body Strength", ["full body"]),
      lift(2, "Upper Body Push", ["upper push"]),
      lift(3, "Lower Body Strength", ["lower"]),
      lift(4, "Upper Body Pull", ["upper pull"]),
      lift(5, "Arms / Core", ["arms", "core"], { intensity: "moderate", durationMinutes: 60 }),
      act(6, "hiit", "HIIT Strength / Conditioning", { intensity: "high", durationMinutes: 45 }),
    ],
  },
  {
    key: "ppl",
    name: "Push / Pull / Legs ×2",
    tagline: "The classic six-day PPL with one full recovery day.",
    rotationLengthDays: 7,
    weekAnchor: 0,
    activities: [
      lift(0, "Push — Chest / Delts / Triceps", ["upper push"]),
      lift(1, "Pull — Back / Biceps", ["upper pull"]),
      lift(2, "Legs — Quads / Hamstrings", ["lower"]),
      lift(3, "Push — Volume", ["upper push"], { intensity: "moderate" }),
      lift(4, "Pull — Volume", ["upper pull"], { intensity: "moderate" }),
      lift(5, "Legs — Volume", ["lower"], { intensity: "moderate" }),
      act(6, "rest", "Full Rest"),
    ],
  },
  {
    key: "three-on-one-off",
    name: "3-On / 1-Off Rotation",
    tagline: "A rolling 4-day cycle that ignores the calendar — push, pull, legs, rest, repeat.",
    rotationLengthDays: 4,
    weekAnchor: 0,
    activities: [
      lift(0, "Push Day", ["upper push"]),
      lift(1, "Pull Day", ["upper pull"]),
      lift(2, "Leg Day", ["lower"]),
      act(3, "rest", "Rest / Recovery"),
    ],
  },
  {
    key: "travel-week",
    name: "Travel Week",
    tagline: "Three condensed full-body sessions plus daily movement — built for hotel weeks.",
    rotationLengthDays: 7,
    weekAnchor: 0,
    activities: [
      lift(0, "Full Body A — Condensed", ["full body"], { durationMinutes: 45, intensity: "moderate" }),
      act(1, "zone2", "Zone 2 Walk", { durationMinutes: 40, intensity: "low" }),
      lift(2, "Full Body B — Condensed", ["full body"], { durationMinutes: 45, intensity: "moderate" }),
      act(3, "travel", "Travel Day", { fixed: true }),
      lift(4, "Full Body C — Condensed", ["full body"], { durationMinutes: 45, intensity: "moderate" }),
      act(5, "mobility", "Mobility Reset", { durationMinutes: 30, intensity: "low" }),
      act(6, "rest", "Full Rest"),
    ],
  },
  {
    key: "deload-week",
    name: "Deload Week",
    tagline: "Volume drops ~40%, movement quality stays — the week that makes the next block work.",
    rotationLengthDays: 7,
    weekAnchor: 0,
    activities: [
      lift(0, "Full Body — Light Technical", ["full body"], { intensity: "low", durationMinutes: 50 }),
      act(1, "zone2", "Zone 2 Conditioning", { durationMinutes: 40, intensity: "low" }),
      lift(2, "Upper Body — Light", ["upper"], { intensity: "low", durationMinutes: 50 }),
      act(3, "mobility", "Mobility Flow", { durationMinutes: 35, intensity: "low" }),
      lift(4, "Lower Body — Light", ["lower"], { intensity: "low", durationMinutes: 50 }),
      act(5, "sauna", "Sauna + Walk", { durationMinutes: 45, intensity: "low" }),
      act(6, "rest", "Full Rest"),
    ],
  },
];

/** Instantiate a template as a fresh DRAFT schedule owned by the member. */
export function scheduleFromTemplate(template: LifestyleTemplate): LifestyleSchedule {
  const now = new Date().toISOString();
  const id = lifestyleId("sched");
  return {
    id,
    lineageId: id,
    name: template.name,
    version: 1,
    status: "draft",
    rotationLengthDays: template.rotationLengthDays,
    weekAnchor: template.weekAnchor,
    source: "reserve-template",
    activities: template.activities.map((a) => ({ ...a, id: lifestyleId("act") })),
    createdAt: now,
    updatedAt: now,
  };
}

/** A blank member-created schedule. */
export function blankSchedule(name: string, rotationLengthDays = 7): LifestyleSchedule {
  const now = new Date().toISOString();
  const id = lifestyleId("sched");
  return {
    id,
    lineageId: id,
    name,
    version: 1,
    status: "draft",
    rotationLengthDays,
    weekAnchor: 0,
    source: "member-created",
    activities: [],
    createdAt: now,
    updatedAt: now,
  };
}
