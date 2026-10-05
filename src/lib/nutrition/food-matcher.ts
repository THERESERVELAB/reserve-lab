/* ════════════════════════════════════════════════════════════════════════
   FOOD MATCHER — what the member typed, as a food Reserve knows.

   Members type their favourites and allergies freely: "gress fed ribeye",
   "thilapia", "NY steak (grass-fed)", "shell fish". Before this, favourites
   only counted when the typed words appeared letter for letter inside a
   library ingredient, so most of them never matched and the plan kept
   landing on the few that did.

   The matcher is forgiving: it keeps the quality words (grass-fed,
   pasture-raised, wild) as qualifiers for the plate's name, reads the rest
   against each food's aliases, and accepts a small misspelling. Allergies
   and avoid lists map to what a food IS (shellfish, dairy, gluten …), so
   "shell fish" excludes shrimp and scallops even though neither word says it.
   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import { PLATE_CARBS, PLATE_PROTEINS, type FoodTag } from "./plate-catalogue";

export type FoodQualifier = "grass-fed" | "pasture-raised" | "wild-caught";

export type FoodMatch = { id: string; role: "protein" | "carb"; qualifiers: FoodQualifier[] };

/** Lowercase words only: punctuation, percentages and ratios become spaces. */
export function foodWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\d+\s*\/\s*\d+/g, " ")
    .replace(/\d+\s*%/g, " ")
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Edit distance, for the small misspellings members make ("thilapia", "gress"). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) {
      next[j] = Math.min(prev[j] + 1, next[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = next;
  }
  return prev[b.length];
}

/** Two words are the same word, allowing one slip in a word of five letters or more. */
function sameWord(typed: string, known: string): boolean {
  if (typed === known) return true;
  if (typed.length < 4 || known.length < 4) return false;
  /* Plurals: "potato" / "potatoes", "breast" / "breasts". */
  if (typed.replace(/(es|s)$/, "") === known.replace(/(es|s)$/, "")) return true;
  const allowed = Math.min(typed.length, known.length) >= 7 ? 2 : 1;
  return editDistance(typed, known) <= allowed;
}

/* Quality words. Each is a pair of words; a slip in either still counts. */
const QUALIFIERS: Array<{ q: FoodQualifier; words: [string, string] }> = [
  { q: "grass-fed", words: ["grass", "fed"] },
  { q: "pasture-raised", words: ["pasture", "raised"] },
  { q: "wild-caught", words: ["wild", "caught"] },
];
/** Words that describe a food without naming it. */
const FILLER = new Set(["grassfed", "organic", "fresh", "free", "range", "boneless", "skinless", "cooked", "raw", "the", "and", "of", "my", "extra", "large"]);

function splitQualifiers(words: string[]): { core: string[]; qualifiers: FoodQualifier[] } {
  const qualifiers = new Set<FoodQualifier>();
  const used = new Set<number>();
  for (const { q, words: [first, second] } of QUALIFIERS) {
    for (let i = 0; i < words.length; i += 1) {
      if (used.has(i)) continue;
      if (sameWord(words[i], first)) {
        qualifiers.add(q);
        used.add(i);
        if (i + 1 < words.length && sameWord(words[i + 1], second)) used.add(i + 1);
      }
    }
  }
  if (words.includes("grassfed")) qualifiers.add("grass-fed");
  /* "wild salmon" names the fish and its quality: keep the qualifier, drop the word. */
  const core = words.filter((w, i) => !used.has(i) && !FILLER.has(w));
  return { core, qualifiers: [...qualifiers] };
}

type Candidate = { id: string; role: "protein" | "carb"; aliases: string[] };
const CANDIDATES: Candidate[] = [
  ...PLATE_PROTEINS.map((p) => ({ id: p.id, role: "protein" as const, aliases: p.aliases })),
  ...PLATE_CARBS.map((c) => ({ id: c.id, role: "carb" as const, aliases: c.aliases })),
];

/**
 * How well `core` names `alias`: 3 exact, 2 every alias word present (with a
 * slip allowed), 0 no match. Longer aliases win ties, so "lean ground chicken"
 * beats "chicken".
 */
function aliasScore(core: string[], alias: string): number {
  const words = foodWords(alias);
  if (!words.length) return 0;
  const coreText = core.join(" ");
  if (coreText === words.join(" ")) return 3 + words.length / 100;
  const allPresent = words.every((w) => core.some((c) => sameWord(c, w)));
  return allPresent ? 2 + words.length / 100 : 0;
}

/** The known food a member's words name, or null. `role` narrows the search. */
export function matchFood(text: string, role?: "protein" | "carb"): FoodMatch | null {
  const { core, qualifiers } = splitQualifiers(foodWords(text));
  if (!core.length) return null;
  let best: { c: Candidate; score: number } | null = null;
  for (const c of CANDIDATES) {
    if (role && c.role !== role) continue;
    for (const alias of c.aliases) {
      const score = aliasScore(core, alias);
      if (score > 0 && (!best || score > best.score)) best = { c, score };
    }
  }
  return best ? { id: best.c.id, role: best.c.role, qualifiers } : null;
}

/** Every member entry matched, first occurrence kept, order preserved. */
export function matchFoods(texts: readonly string[], role: "protein" | "carb"): FoodMatch[] {
  const out: FoodMatch[] = [];
  for (const text of texts) {
    const hit = matchFood(text, role);
    if (!hit) continue;
    const existing = out.find((m) => m.id === hit.id);
    if (existing) {
      for (const q of hit.qualifiers) if (!existing.qualifiers.includes(q)) existing.qualifiers.push(q);
      continue;
    }
    out.push(hit);
  }
  return out;
}

/* ─── Allergies and avoid lists ──────────────────────────────────────────── */

/** What an allergy or avoid entry rules out, by what a food is. */
const ALLERGY_PATTERNS: Array<{ tags: FoodTag[]; re: RegExp }> = [
  { tags: ["shellfish"], re: /shell\s*-?\s*fish|shrimp|prawn|crab|lobster|scallop|clam|mussel|oyster|crustacean|crawfish/ },
  { tags: ["dairy"], re: /dairy|milk|lactose|cheese|whey|casein|yogh?urt|butter|cream\b/ },
  { tags: ["egg"], re: /\beggs?\b/ },
  { tags: ["gluten", "oats"], re: /gluten|wheat|celiac|coeliac|barley|\brye\b/ },
  { tags: ["soy"], re: /\bsoy|soya|soybean|edamame|tofu|tempeh/ },
  { tags: ["nuts"], re: /\bnuts?\b|tree\s*nut|peanut|almond|cashew|walnut|pecan|pistachio|hazelnut|macadamia/ },
  { tags: ["sesame"], re: /sesame/ },
  { tags: ["pork"], re: /\bpork|bacon|\bham\b|prosciutto/ },
  { tags: ["red-meat"], re: /red\s*meat/ },
];

/** Tags an allergy entry rules out. "Shell fish" is shellfish, never all fish. */
export function allergyTags(entry: string): FoodTag[] {
  let text = entry.toLowerCase();
  const tags = new Set<FoodTag>();
  for (const { tags: t, re } of ALLERGY_PATTERNS) {
    if (re.test(text)) {
      t.forEach((tag) => tags.add(tag));
      if (t.includes("shellfish")) text = text.replace(/shell\s*-?\s*fish/g, " ");
    }
  }
  /* Fish, once shellfish wording is out of the way ("fish", "finfish", "all fish"). */
  if (/\bfin\s*fish\b|\bfish\b/.test(text)) tags.add("fish");
  return [...tags];
}

/** Peak Mode avoid keys, as tags. Oats stay allowed under "gluten", as Peak Mode's own list keeps them. */
export function avoidKeyTags(key: string): FoodTag[] {
  switch (key) {
    case "dairy": return ["dairy"];
    case "eggs": return ["egg"];
    case "fish": return ["fish"];
    case "shellfish": return ["shellfish"];
    case "red-meat": return ["red-meat"];
    case "pork": return ["pork"];
    case "soy": return ["soy"];
    case "nuts": return ["nuts"];
    case "gluten": return ["gluten"];
    default: return [];
  }
}

/** Tags an ingredient line carries, read from its words ("170g shrimp & scallops" → shellfish). */
export function ingredientTags(line: string): FoodTag[] {
  const text = line.toLowerCase();
  const tags = new Set<FoodTag>();
  if (/shrimp|prawn|crab|lobster|scallop|clam|mussel|oyster/.test(text)) tags.add("shellfish");
  if (/salmon|tuna|\bcod\b|tilapia|mahi|sea bass|halibut|trout|\bfish\b|sardine|anchov/.test(text)) tags.add("fish");
  if (/yogh?urt|cheese|\bmilk\b|whey|butter|feta|parmesan|cream\b|tzatziki|casein/.test(text) && !/almond butter|peanut butter|nut butter/.test(text)) tags.add("dairy");
  if (/\beggs?\b|egg white/.test(text)) tags.add("egg");
  if (/sourdough|toast|bread|pasta|couscous|seitan|\bwheat|tortilla|teriyaki|soy sauce|panko|breadcrumb/.test(text) && !/corn tortilla|chickpea|rice noodle/.test(text)) tags.add("gluten");
  if (/\boats?\b|oatmeal/.test(text)) tags.add("oats");
  if (/\bsoy|tamari|edamame|tofu|tempeh|teriyaki|gochujang/.test(text)) tags.add("soy");
  if (/almond|walnut|pecan|cashew|pistachio|peanut|hazelnut|\bnuts?\b/.test(text)) tags.add("nuts");
  if (/sesame|everything seasoning/.test(text)) tags.add("sesame");
  if (/\bpork|bacon|\bham\b|prosciutto|chorizo/.test(text)) tags.add("pork");
  if (/beef|steak|sirloin|ribeye|bison|lamb|venison|filet/.test(text)) tags.add("red-meat");
  return [...tags];
}

/**
 * True when a meal's ingredients hit one of the member's allergies — by what
 * the ingredient is ("shell fish" → shrimp) or by the typed words themselves.
 */
export function ingredientsHitAllergy(ingredients: readonly string[], allergies: readonly string[]): boolean {
  if (!allergies.length) return false;
  const ruled = new Set(allergies.flatMap(allergyTags));
  if (ruled.size && ingredients.some((line) => ingredientTags(line).some((t) => ruled.has(t)))) return true;
  /* Anything else the member named (a specific food): plain word match. */
  const lines = ingredients.map((l) => foodWords(l).join(" "));
  return allergies.some((a) => {
    const words = foodWords(a).join(" ");
    return words.length >= 3 && lines.some((l) => l.includes(words));
  });
}
