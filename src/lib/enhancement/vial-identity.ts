import type { CompoundClassKey, CompoundRoute } from "@/lib/enhancement/catalog";

/**
 * What a member's compound actually looks like in the hand.
 *
 * A vial on screen that is the same grey as every other vial is a list with a
 * picture stuck on it. A member knows their own shelf by sight — GHK-Cu is the
 * blue one, the test is the pale oil — so the widget earns its place only if it
 * carries that recognition.
 *
 * Every tint here is the real appearance of the reconstituted or suspended
 * solution, resolved onto the closed Reserve palette rather than sampled from a
 * photograph. That resolution is the point: copper peptide blue lands on steel,
 * carrier oils land on amber and gold, and everything water-clear stays ivory.
 * No hue is invented, so the palette stays closed (DESIGN_BIBLE §09).
 *
 * This is appearance only. It says nothing about what a compound does, who
 * should take it, or how much — it is the colour of the liquid, nothing more.
 */

export type VialTint = "clear" | "steel" | "amber" | "gold";

/** How the compound is actually held, which decides what we draw. */
export type VialForm = "vial" | "capsule" | "pump";

export type VialIdentity = {
  tint: VialTint;
  form: VialForm;
  /** Plain-language appearance, used for the accessible label. */
  appearance: string;
};

/* Compounds whose solution has a real, recognisable colour. Matched on the
   official name lowercased, so aliases resolve through the catalog first. */
const NAMED_TINTS: Array<{ match: RegExp; tint: VialTint; appearance: string }> = [
  /* Copper peptides are genuinely, vividly blue — the copper ion does it, and it
     is the single most recognisable vial on a shelf. This is the case the tint
     system exists for. */
  { match: /\bghk[-\s]?cu\b|copper peptide/i, tint: "steel", appearance: "deep blue copper solution" },
  /* GLOW and KLOW are blends built around GHK-Cu, so they carry the copper into
     the vial and come out blue too. Matched by name because the blend is what
     the member logs — they never type "GHK-Cu" for these. */
  { match: /\b[gk]low\b/i, tint: "steel", appearance: "blue copper-peptide blend" },
  /* Trenbolone carries the darkest carrier of the common oils. */
  { match: /\btrenbolone\b|\btren\b/i, tint: "gold", appearance: "dark amber oil" },
];

/* Classes suspended in a carrier oil rather than dissolved in water. These read
   pale gold in the barrel.

   Typed as strings, not CompoundClassKey: the member's stored entry carries a
   free-form class string (they can type their own compound), so this has to
   accept anything and simply not match what it does not know. */
const OIL_CLASSES: ReadonlySet<string> = new Set<CompoundClassKey>([
  "aas",
  "hormones_testosterone",
]);

function formForRoutes(routes: readonly CompoundRoute[] | undefined): VialForm {
  if (!routes || routes.length === 0) return "vial";
  if (routes.includes("injectable")) return "vial";
  if (routes.includes("oral")) return "capsule";
  if (routes.includes("topical") || routes.includes("nasal")) return "pump";
  return "vial";
}

export type VialIdentityInput = {
  /** The member's own label, or the catalog's official name. */
  name?: string | null;
  /** Free-form on the member's entry, so this is a string the map may not know. */
  compoundClass?: string | null;
  /** The single route the member chose, if they chose one. */
  route?: CompoundRoute | null;
  /** Every route the catalog lists, used when the member has not chosen. */
  routes?: readonly CompoundRoute[] | null;
};

/**
 * Resolve a compound to the thing we draw.
 *
 * Unknown compounds resolve to a clear vial, which is honest: most peptides do
 * reconstitute water-clear, so "we don't know" and "it's clear" look the same
 * and neither one lies.
 */
export function vialIdentity(input: VialIdentityInput): VialIdentity {
  const name = (input.name ?? "").trim();

  for (const rule of NAMED_TINTS) {
    if (rule.match.test(name)) {
      return { tint: rule.tint, form: resolveForm(input), appearance: rule.appearance };
    }
  }

  if (input.compoundClass && OIL_CLASSES.has(input.compoundClass)) {
    return { tint: "amber", form: resolveForm(input), appearance: "pale gold oil" };
  }

  return { tint: "clear", form: resolveForm(input), appearance: "clear solution" };
}

function resolveForm(input: VialIdentityInput): VialForm {
  if (input.route) return formForRoutes([input.route]);
  return formForRoutes(input.routes ?? undefined);
}

/**
 * The liquid colour, as the closed palette's own tokens.
 *
 * Returned as a hex string rather than a CSS variable because the vial paints
 * these into SVG gradient stops at several opacities, and a variable cannot be
 * alpha-composited inside a stop without a second variable per step.
 */
export function vialTintHex(tint: VialTint): string {
  switch (tint) {
    case "steel":
      return "#5fb7d5"; // --teal, the laboratory lead
    case "amber":
      return "#e8c87a";
    case "gold":
      return "#d5b15f"; // --gold
    case "clear":
    default:
      return "#ece8df"; // --foreground, carried at low opacity so it reads as glass
  }
}

/**
 * How opaque the body of the liquid sits.
 *
 * Clear has to be very low. Ivory at a quarter opacity over a near-black
 * environment does not read as "clear fluid" — it reads as grey paint, and
 * since most peptides reconstitute clear that would be the majority of a
 * member's shelf looking dirty. A real column of clear fluid in a dark room is
 * announced by its surface, not its body, which is what `vialMeniscusOpacity`
 * is for.
 */
export function vialTintOpacity(tint: VialTint): number {
  return tint === "clear" ? 0.13 : 0.68;
}

/**
 * The bright line at the surface of the liquid.
 *
 * For a clear solution this is doing nearly all the work, so it is pushed well
 * above the body opacity rather than a fixed step above it.
 */
export function vialMeniscusOpacity(tint: VialTint): number {
  return tint === "clear" ? 0.72 : Math.min(1, vialTintOpacity(tint) + 0.28);
}

/**
 * Whether an item is drawn with the compound vial visual at all.
 *
 * The vial is for peptides and compounds — the things a member actually holds
 * in a vial, pump or capsule and reconstitutes or injects. Add-ons like
 * vitamins, supplements and nootropics are not compounds; they get a plain row,
 * not a glass. Gate on the member entry's own category so a multivitamin never
 * shows up wearing a peptide's vial.
 */
const NON_VIAL_CATEGORIES: ReadonlySet<string> = new Set(["supplement", "vitamin", "nootropic"]);

export function categoryDrawsVial(category: string | null | undefined): boolean {
  if (!category) return true; // unknown / legacy entries keep the vial rather than lose it silently
  return !NON_VIAL_CATEGORIES.has(category);
}
