"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatInfoModal } from "./stat-info-modal";
import { StreakVisualization } from "./streak-visualization";
import { ActivityVisualization } from "./activity-visualization";
import type { MomentumData } from "@/server/services/analytics.service";

interface MomentumCardProps {
  momentum: MomentumData;
  className?: string;
}

interface StatInfo {
  title: string;
  description: string;
  value?: string;
  visual?: React.ReactNode;
}

export function MomentumCard({ momentum, className }: MomentumCardProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [selectedStat, setSelectedStat] = useState<StatInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      let current = 0;
      const step = Math.max(1, momentum.score / 24);
      const interval = setInterval(() => {
        current = Math.min(momentum.score, current + step);
        setDisplayScore(Math.round(current));
        if (current >= momentum.score) clearInterval(interval);
      }, 28);
      return () => clearInterval(interval);
    }, 120);
    return () => clearTimeout(timer);
  }, [momentum.score]);

  const handleStatClick = (stat: StatInfo) => {
    setSelectedStat(stat);
    setIsModalOpen(true);
  };

  const deltaPositive = momentum.weeklyDelta >= 0;
  const deltaLabel    = deltaPositive ? `+${momentum.weeklyDelta} pts` : `${momentum.weeklyDelta} pts`;

  const scoreContext =
    momentum.score >= 80 ? "Exceptional. Keep this going." :
    momentum.score >= 60 ? "Strong. One missed day doesn't break a pattern." :
    momentum.score >= 40 ? "Building. Consistency is the only strategy." :
    momentum.score >= 20 ? "Time to reignite. You know what to do." :
    "Day one is the most important day. Start.";

  const activeWeekdays = momentum.weeklyActivity.filter((d) => d.hasLog).length;

  const statClickHandlers = [
    {
      emoji: "🔥",
      value: `${momentum.streakDays}d`,
      label: "Streak",
      onClick: () => handleStatClick({
        title: "Your Streak",
        description: "A streak is the number of consecutive days you've completed at least one action towards your goals. Each day you show up, you extend your streak. Consistency is everything.",
        value: `${momentum.streakDays} days`,
        visual: <StreakVisualization currentStreak={momentum.streakDays} />
      }),
    },
    {
      emoji: "📅",
      value: `${activeWeekdays}/7`,
      label: "This Week",
      onClick: () => handleStatClick({
        title: "This Week's Activity",
        description: "Shows how many days this week you've taken action on your goals. Aim for consistency throughout the week.",
        value: `${activeWeekdays} days active`,
        visual: <ActivityVisualization weeklyActivity={momentum.weeklyActivity} />
      }),
    },
    {
      emoji: "✅",
      value: `${Math.round(momentum.completionRate * 100)}%`,
      label: "Done Rate",
      onClick: () => handleStatClick({
        title: "Done Rate",
        description: "The percentage of your daily intentions you've completed. This measures follow-through and commitment to your goals.",
        value: `${Math.round(momentum.completionRate * 100)}%`
      }),
    },
    {
      emoji: deltaPositive ? "📈" : "📉",
      value: deltaLabel,
      label: "vs Last Week",
      onClick: () => handleStatClick({
        title: deltaPositive ? "Momentum Gained" : "Momentum Lost",
        description: `Your momentum score this week compared to last week. ${deltaPositive ? "You're building consistent progress." : "Time to rebuild your momentum."}`,
        value: deltaLabel
      }),
    },
  ];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-[#2A2522] bg-[#171411] text-white",
        "shadow-[0_16px_48px_rgba(26,23,20,0.18)]",
        className
      )}
    >
      <div className="p-5 sm:p-6">
        {/* ── Top row: score + ring ─── */}
        <div className="flex items-start justify-between gap-4">
          <button
            onClick={() => handleStatClick({
              title: "Momentum Score",
              description: "Your momentum score measures your progress and consistency across all your goals. It combines your daily streaks, completion rates, and weekly engagement. A higher score means you're building sustainable habits.",
              value: `${displayScore} / 100`
            })}
            className="min-w-0 cursor-pointer transition-opacity hover:opacity-80"
          >
            <p className="section-label" style={{ color: "rgba(199,175,122,0.75)" }}>
              Momentum Score
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="font-serif text-4xl font-semibold leading-none text-white sm:text-5xl">
                {displayScore}
              </span>
              <span className="mb-1 font-serif text-base text-white/35">/ 100</span>
            </div>
            <p className="mt-1.5 font-mono text-xs text-[#E8C97A] sm:text-sm">
              {scoreContext}
            </p>
          </button>

          {/* Score arc */}
          <div className="hidden sm:flex flex-shrink-0 flex-col items-end gap-2">
            <div
              className="relative h-16 w-16 cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => handleStatClick({
                title: "Momentum Score",
                description: "Your momentum score measures your progress and consistency across all your goals. It combines your daily streaks, completion rates, and weekly engagement. A higher score means you're building sustainable habits.",
                value: `${displayScore} / 100`
              })}
            >
              <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
                <circle
                  cx="32" cy="32" r="26" fill="none"
                  stroke="#C4963A" strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${(displayScore / 100) * 163.4} 163.4`}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-xs font-semibold text-white">{displayScore}</span>
              </div>
            </div>
            <Link
              href="/analytics"
              className="flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white"
            >
              analytics <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* ── Progress bar ─── */}
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-[repeating-linear-gradient(to_right,rgba(255,255,255,0.12),rgba(255,255,255,0.12)_6px,transparent_6px,transparent_12px)]">
          <div
            className="h-full rounded-full bg-[#E8C97A] transition-all duration-700"
            style={{ width: `${Math.max(4, Math.min(100, displayScore))}%` }}
          />
        </div>

        {/* ── Stats grid ─── */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {statClickHandlers.map((s) => (
            <button
              key={s.label}
              onClick={s.onClick}
              className="flex flex-col gap-0.5 rounded-xl border border-white/6 bg-white/4 px-3 py-2.5 transition-all hover:bg-white/6 hover:border-white/10 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className={cn(
                  "font-serif font-semibold sm:text-lg",
                  momentum.streakDays >= 7 ? "text-[#E8C97A]" : "text-white"
                )}>
                  {s.value}
                </span>
                <span className="text-base leading-none">{s.emoji}</span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-left" style={{ color: "rgba(255,255,255,0.3)" }}>
                {s.label}
              </span>
            </button>
          ))}
        </div>

        {/* ── Weekly bar chart ─── */}
        <div className="mt-4">
          <div className="flex items-end gap-1 sm:gap-1.5">
            {momentum.weeklyActivity.map((day, index) => {
              const height = day.tasksTotal > 0
                ? Math.max(6, (day.tasksCompleted / day.tasksTotal) * 48)
                : 6;
              const isToday  = index === momentum.weeklyActivity.length - 1;
              const weekday  = new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });

              return (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-sm transition-all duration-500"
                    style={{
                      height,
                      background: isToday
                        ? "#C4963A"
                        : day.hasLog
                        ? "rgba(196,150,58,0.4)"
                        : "rgba(255,255,255,0.07)",
                    }}
                  />
                  <span className={cn(
                    "text-[9px] font-semibold uppercase tracking-[0.12em]",
                    isToday ? "text-[#E8C97A]" : "text-white/25"
                  )}>
                    {weekday}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Motivation + analytics link */}
          <div className="mt-3 flex items-start justify-between gap-4 hidden">
            <p className="text-sm leading-snug text-white/55 line-clamp-2">
              {momentum.motivation}
            </p>
            <Link
              href="/analytics"
              className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#DAB667] transition-colors hover:text-white sm:hidden"
            >
              Stats <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Modal */}
      <StatInfoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        stat={selectedStat}
      />
    </section>
  );
}
