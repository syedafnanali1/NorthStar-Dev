"use client";

import { useEffect, useState } from "react";
import { isEnabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

interface GlanceData {
  activeGoals: number;
  weeklyStreak: number;
  completionRate: number;
  activeGoalsDelta: number;
  streakDelta: number;
  completionRateDelta: number;
}

function TrendArrow({ delta }: { delta: number }) {
  if (delta === 0) return null;
  return (
    <span className={cn("text-[10px] font-semibold ml-1", delta > 0 ? "text-emerald-500" : "text-rose-400")}>
      {delta > 0 ? "↑" : "↓"}{Math.abs(delta)}
    </span>
  );
}

export function StatsGlanceCards() {
  const [data, setData] = useState<GlanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isEnabled("statsGlanceCards")) { setLoading(false); return; }

    fetch("/api/analytics/glance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GlanceData | null) => { if (d) setData(d); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (!isEnabled("statsGlanceCards")) return null;
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-cream-dark bg-cream-paper p-4 animate-pulse">
            <div className="h-3 w-16 bg-cream-dark rounded mb-3" />
            <div className="h-7 w-10 bg-cream-dark rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Active Goals",
      value: data?.activeGoals ?? 0,
      delta: data?.activeGoalsDelta ?? 0,
      emoji: "🎯",
      suffix: "",
    },
    {
      label: "Weekly Streak",
      value: data?.weeklyStreak ?? 0,
      delta: data?.streakDelta ?? 0,
      emoji: "🔥",
      suffix: "d",
    },
    {
      label: "Completion",
      value: data?.completionRate ?? 0,
      delta: data?.completionRateDelta ?? 0,
      emoji: "✅",
      suffix: "%",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-cream-dark bg-cream-paper p-3.5 sm:p-4"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-sm">{card.emoji}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted truncate">
              {card.label}
            </span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="font-serif text-2xl font-bold text-ink">{card.value}</span>
            <span className="text-sm text-ink-muted">{card.suffix}</span>
            <TrendArrow delta={card.delta} />
          </div>
        </div>
      ))}
    </div>
  );
}
