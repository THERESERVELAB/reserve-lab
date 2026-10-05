/* ════════════════════════════════════════════════════════════════════════
   RESERVE DESIGN TOKENS — the one palette.

   Design Bible §09 declares the Reserve palette closed. Before this module
   existed, 30 component files re-declared their own `const GOLD = "#d5b15f"`
   (125 declarations total), and 1,686 arbitrary hex literals were written
   inline. Every one of those was a place the palette could silently drift.

   This is the single source. Adding a hue here is a versioned Bible edit,
   not a screen decision.

   NOTE ON `alpha()`: Reserve's shipped idiom is hex-suffix opacity
   (`${GOLD}28`). That idiom is preserved — `alpha()` is the readable form of
   the same thing, so migrating a call site never changes a rendered pixel.
   ════════════════════════════════════════════════════════════════════════ */

/** The closed Reserve palette (Design Bible §09). */
export const RESERVE = {
  /** The environment. Also the document themeColor. */
  base: "#07080c",
  /** Ivory text — the `--foreground` token. */
  foreground: "#ece8df",
  /** Interface ivory — the value behind `.type-command`'s rgba(242,238,230). */
  ivory: "#f2eee6",

  /** Primary accent, high-value actions, Apex light. */
  gold: "#d5b15f",
  /** Gradient partner to gold; Reserve Black identity. */
  amber: "#e8c87a",
  /** Laboratory, bloodwork, recovery. */
  steel: "#5fb7d5",
  /** Fuel, secured states. */
  green: "#6ee7b7",
  /** Evening, sleep, dusk. */
  violet: "#a78bfa",
  /** Neutral supporting signal. */
  slate: "#8ea0b8",
  /** ALERTS ONLY. Never weather, never a surface tint (Bible §09). */
  red: "#ef7d55",

  /** Surfaces. */
  card: "#0d0e14",
  sidebar: "#08090e",
} as const;

export type ReserveColor = keyof typeof RESERVE;

/** Hex-suffix opacity, written readably. `alpha(RESERVE.gold, 0.16)` → "#d5b15f29". */
export function alpha(hex: string, opacity: number): string {
  const clamped = Math.max(0, Math.min(1, opacity));
  const suffix = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${suffix}`;
}

/* ─── Accent leads (Design Bible §09 destination table) ───────────────────
   Each destination has ONE color lead. This map is what makes a module feel
   like a distinct room without becoming a separate brand — and it is why
   module identity never requires a new hue. */

export type ModuleAccent =
  | "apex"
  | "training"
  | "nutrition"
  | "recovery"
  | "intelligence"
  | "clinical"
  | "physique"
  | "schedule"
  | "community"
  | "neutral";

export const MODULE_ACCENT: Record<ModuleAccent, string> = {
  apex: RESERVE.gold,
  training: RESERVE.gold,
  nutrition: RESERVE.green,
  recovery: RESERVE.violet,
  intelligence: RESERVE.steel,
  clinical: RESERVE.steel,
  physique: RESERVE.gold,
  schedule: RESERVE.gold,
  community: RESERVE.gold,
  neutral: RESERVE.slate,
};

/* ─── Radius family ───────────────────────────────────────────────────────
   Bible §06: the rimless radius approximates hardware display curvature.
   Seven different `rounded-[Npx]` values shipped before this. Three now. */

export const RADIUS = {
  /** The rimless surface radius. GlassPanel's contract. */
  surface: "22px",
  /** Inner groupings, controls, chips. */
  control: "12px",
  /** Small chips and pills. */
  chip: "8px",
} as const;

/* ─── Motion ──────────────────────────────────────────────────────────────
   Re-exported from the cinematic module so a component needs one import for
   design tokens rather than two. Durations are milliseconds. */
export { RESERVE_MOTION } from "@/lib/cinematic/environments";
