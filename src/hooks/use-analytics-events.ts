"use client";

import { useCallback, useEffect, useRef } from "react";
import { isEnabled } from "@/lib/feature-flags";

interface AnalyticsEvent {
  eventType: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

const QUEUE_FLUSH_INTERVAL_MS = 60_000;
const QUEUE_KEY = "ns_event_queue";

function loadQueue(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: AnalyticsEvent[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-100)));
  } catch {}
}

async function flushQueue() {
  if (!isEnabled("analyticsEvents")) return;
  const queue = loadQueue();
  if (queue.length === 0) return;

  try {
    const res = await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: queue.slice(0, 50) }),
    });
    if (res.ok) {
      saveQueue(queue.slice(50));
    }
  } catch {
    // keep queue, retry next flush
  }
}

export function useAnalyticsEvents() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => void flushQueue(), QUEUE_FLUSH_INTERVAL_MS);

    // Flush on visibility change (app comes to foreground)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void flushQueue();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const track = useCallback((event: AnalyticsEvent) => {
    if (!isEnabled("analyticsEvents")) return;
    const queue = loadQueue();
    queue.push({ ...event, metadata: { ...event.metadata, occurredAt: new Date().toISOString() } });
    saveQueue(queue);
  }, []);

  return { track };
}
