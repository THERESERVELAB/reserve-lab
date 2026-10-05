export function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatSigned(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

export function formatAge(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
