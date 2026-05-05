"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface GlanceData {
  activeGoals: number;
  weeklyStreak: number;
  completionRate: number;
  activeGoalsDelta: number;
  streakDelta: number;
  completionRateDelta: number;
  badgesEarned: number;
  latestBadgeKey: string | null;
}

const BADGE_EMOJI: Record<string, string> = {
  first_goal_created: "🎯",
  first_checkin: "✅",
  streak_7: "🔥",
  streak_30: "🏆",
  streak_60: "💎",
  streak_100: "👑",
  circle_friend_added: "🤝",
  goal_completed: "🌟",
  goals_5: "🎖️",
  early_bird: "🌅",
  group_joined: "🏘️",
  level_up: "⭐",
};

function BadgeSvg({ achievementKey }: { achievementKey: string | null }) {
  const emoji = achievementKey ? (BADGE_EMOJI[achievementKey] ?? "🏅") : "🏅";
  return (
    <span className="text-base leading-none" role="img" aria-label="latest badge">
      {emoji}
    </span>
  );
}

function TrendArrow({ delta }: { delta: number }) {
  if (delta === 0) return null;
  return (
    <span className={cn("text-[10px] font-semibold ml-0.5", delta > 0 ? "text-emerald-500" : "text-rose-400")}>
      {delta > 0 ? "↑" : "↓"}{Math.abs(delta)}
    </span>
  );
}

export function StatsGlanceCards() {
  const [data, setData] = useState<GlanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/glance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GlanceData | null) => { if (d) setData(d); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-cream-dark bg-cream-paper p-3.5 animate-pulse">
            <div className="h-2.5 w-14 bg-cream-dark rounded mb-3" />
            <div className="h-6 w-10 bg-cream-dark rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Active Goals",
      value: data?.activeGoals ?? 0,
      suffix: "",
      delta: data?.activeGoalsDelta ?? 0,
      icon: (
        <svg viewBox="0 0 18 18" className="h-[15px] w-[15px] flex-shrink-0" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="9" cy="9" r="4" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="9" cy="9" r="1.25" fill="currentColor" />
        </svg>
      ),
    },
    {
      label: "Streak",
      value: data?.weeklyStreak ?? 0,
      suffix: "d",
      delta: data?.streakDelta ?? 0,
      icon: (
        <svg viewBox="0 0 18 18" className="h-[15px] w-[15px] flex-shrink-0" fill="none" aria-hidden>
          <path
            d="M9 2C9.5 4.5 12 5.5 12 8C12 10.5 10.5 13 9 14C7.5 13 6 10.5 6 8C6 5.5 8.5 4.5 9 2Z"
            fill="currentColor"
            opacity="0.9"
          />
          <path
            d="M9 8.5C9.25 9.5 10 9.8 10 11C10 12.2 9.5 13.2 9 14C8.5 13.2 8 12.2 8 11C8 9.8 8.75 9.5 9 8.5Z"
            fill="white"
            opacity="0.5"
          />
        </svg>
      ),
    },
    {
      label: "Completion",
      value: data?.completionRate ?? 0,
      suffix: "%",
      delta: data?.completionRateDelta ?? 0,
      icon: (
        <svg viewBox="0 0 18 18" className="h-[15px] w-[15px] flex-shrink-0" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 9L7.5 11L12.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: "Badges",
      value: data?.badgesEarned ?? 0,
      suffix: "",
      delta: 0,
      icon: <BadgeSvg achievementKey={data?.latestBadgeKey ?? null} />,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-cream-dark bg-cream-paper p-3.5"
        >
          <div className="flex items-center gap-1.5 mb-2 text-ink-muted">
            {card.icon}
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] truncate">
              {card.label}
            </span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="font-serif text-[1.6rem] font-bold text-ink leading-none">{card.value}</span>
            {card.suffix && <span className="text-sm text-ink-muted ml-0.5">{card.suffix}</span>}
            <TrendArrow delta={card.delta} />
          </div>
        </div>
      ))}
    </div>
  );
}
