/* Small deterministic-friendly id + time helpers for the coaching domain. */

let counter = 0;

export function newId(prefix: string): string {
  counter += 1;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}_${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateKeyOffset(base: string, offsetDays: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d + offsetDays);
  return todayKey(dt);
}

/** "HH:MM" → minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Minutes since midnight → "HH:MM" (clamped into the same day). */
export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" → "8:05 PM" display form. */
export function formatTime(time: string | null): string {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Human-readable connection code, e.g. "RSV-8F2K". */
export function newConnectionCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `RSV-${code}`;
}
