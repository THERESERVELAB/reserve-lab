import type { AnalyticsEventInput } from "@/lib/schemas/analytics";

const QUEUE_KEY = "final-boss-athlete.analytics.queue";
const MAX_QUEUE_SIZE = 100;

type QueuedAnalyticsEvent = AnalyticsEventInput & {
  queuedAt: string;
};

function readQueue(): QueuedAnalyticsEvent[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAnalyticsEvent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(events: QueuedAnalyticsEvent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-MAX_QUEUE_SIZE)));
}

export function queueAnalyticsEvent(event: AnalyticsEventInput) {
  writeQueue([...readQueue(), { ...event, queuedAt: new Date().toISOString() }]);
}

export async function sendAnalyticsEvent(event: AnalyticsEventInput) {
  try {
    const response = await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    });

    if (!response.ok) {
      queueAnalyticsEvent(event);
      return { ok: false as const, queued: true };
    }

    const result = (await response.json()) as { persisted?: boolean; mode?: string };
    if (result.mode === "local_fallback") {
      queueAnalyticsEvent(event);
      return { ok: true as const, queued: true };
    }

    return { ok: true as const, queued: false };
  } catch {
    queueAnalyticsEvent(event);
    return { ok: false as const, queued: true };
  }
}

export async function flushQueuedAnalyticsEvents() {
  const queue = readQueue();
  if (queue.length === 0) return { attempted: 0, remaining: 0 };

  const remaining: QueuedAnalyticsEvent[] = [];
  for (const event of queue) {
    try {
      const response = await fetch("/api/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
        keepalive: true,
      });

      if (!response.ok) remaining.push(event);
    } catch {
      remaining.push(event);
    }
  }

  writeQueue(remaining);
  return { attempted: queue.length, remaining: remaining.length };
}
