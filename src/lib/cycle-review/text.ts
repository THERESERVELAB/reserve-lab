/* Sentence helpers shared by every cycle-review module, so lists and marker
   names read the same way wherever the review mentions them. */

/** "A", "A and B", "A, B and C" — or with "or". */
export function listNames(items: string[], joiner: "and" | "or" = "and"): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} ${joiner} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} ${joiner} ${items.at(-1)}`;
}

export function listOr(items: string[]): string {
  return listNames(items, "or");
}

/** "Estradiol" → "estradiol" mid-sentence; acronyms such as LH, ALT and ApoB keep their case. */
export function inSentence(label: string): string {
  const first = label.split(" ")[0];
  return /[A-Z].*[A-Z]/.test(first) ? label : label.charAt(0).toLowerCase() + label.slice(1);
}
