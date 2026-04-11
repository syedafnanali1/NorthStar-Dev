// src/components/analytics/lifetime-stats.tsx
import { formatCompact } from "@/lib/utils";
import type { LifetimeStats as LifetimeStatsType } from "@/server/services/analytics.service";

interface LifetimeStatsProps {
  stats: LifetimeStatsType;
}

export function LifetimeStats({ stats }: LifetimeStatsProps) {
  const items = [
    { label: "Total Goals", value: stats.totalGoals, emoji: "🎯" },
    { label: "Completed Goals", value: stats.completedGoals, emoji: "✅" },
    { label: "Moments Written", value: stats.totalMoments, emoji: "📖" },
    { label: "Progress Logs", value: stats.totalProgressLogs, emoji: "📊" },
    { label: "Days Tracked", value: stats.daysTracked, emoji: "📅" },
    { label: "Longest Streak", value: `${stats.longestStreak}d`, emoji: "🔥" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3 lg:rounded-[1.5rem] lg:border lg:border-cream-dark lg:bg-white/70 lg:px-4 lg:py-5">
          <span className="text-2xl">{item.emoji}</span>
          <div>
            <div className="text-xl font-serif font-semibold text-ink">
              {typeof item.value === "number"
                ? formatCompact(item.value)
                : item.value}
            </div>
            <div className="text-2xs uppercase tracking-wide text-ink-muted">
              {item.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
