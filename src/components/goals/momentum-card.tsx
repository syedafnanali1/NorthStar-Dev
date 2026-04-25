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

/* ── Inline SVG illustrations for each stat ── */
function ScoreIllustration({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const dash = (pct / 100) * 226;
  return (
    <svg viewBox="0 0 90 90" className="h-20 w-20">
      <circle cx="45" cy="45" r="36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle
        cx="45" cy="45" r="36" fill="none"
        stroke="url(#scoreGrad)" strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} 226`}
        transform="rotate(-90 45 45)"
      />
      <defs>
        <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E8C97A" />
          <stop offset="100%" stopColor="#C4963A" />
        </linearGradient>
      </defs>
      <text x="45" y="49" textAnchor="middle" fill="white" fontSize="14" fontFamily="serif" fontWeight="600">
        {score}
      </text>
    </svg>
  );
}

function StreakFlameIllustration({ days }: { days: number }) {
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16">
      <defs>
        <linearGradient id="flameGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#C4963A" />
          <stop offset="100%" stopColor="#E8C97A" />
        </linearGradient>
      </defs>
      {/* Outer flame */}
      <path
        d="M40 10 C42 18 50 22 50 30 C50 20 44 16 44 10 C50 20 60 28 58 40 C56 52 48 62 40 66 C32 62 24 52 22 40 C20 28 30 20 36 10 C36 16 30 20 30 30 C30 22 38 18 40 10Z"
        fill="url(#flameGrad)"
        opacity="0.9"
      />
      {/* Inner flame */}
      <path
        d="M40 30 C41 35 45 37 45 42 C45 48 42.5 54 40 56 C37.5 54 35 48 35 42 C35 37 39 35 40 30Z"
        fill="rgba(255,255,255,0.3)"
      />
      <text x="40" y="76" textAnchor="middle" fill="#E8C97A" fontSize="10" fontFamily="mono" fontWeight="700">
        {days}d
      </text>
    </svg>
  );
}

function WeekGridIllustration({ active }: { active: number }) {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <svg viewBox="0 0 112 48" className="h-12 w-28">
      {days.map((d, i) => (
        <g key={i}>
          <rect
            x={i * 16 + 2} y="0" width="12" height="28" rx="3"
            fill={i < active ? "url(#weekGrad)" : "rgba(255,255,255,0.08)"}
          />
          <text x={i * 16 + 8} y="42" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="mono">
            {d}
          </text>
        </g>
      ))}
      <defs>
        <linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8C97A" />
          <stop offset="100%" stopColor="#C4963A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function RateCircleIllustration({ rate }: { rate: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = (rate / 100) * circ;
  return (
    <svg viewBox="0 0 72 72" className="h-16 w-16">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke="#86C07A" strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        transform="rotate(-90 36 36)"
      />
      <path
        d="M28 36 L33 41 L44 30"
        fill="none" stroke="rgba(134,192,122,0.8)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendArrowIllustration({ positive }: { positive: boolean }) {
  return (
    <svg viewBox="0 0 72 48" className="h-12 w-16">
      <polyline
        points={positive ? "4,40 20,28 36,32 52,16 68,8" : "4,8 20,20 36,16 52,32 68,40"}
        fill="none"
        stroke={positive ? "#86C07A" : "#C47A86"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={positive ? "60,4 72,8 68,20" : "60,44 72,40 68,28"}
        fill={positive ? "#86C07A" : "#C47A86"}
      />
    </svg>
  );
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
        title: "Streak",
        description: "Your streak counts consecutive days you've taken at least one action toward your goals. Every day you show up, the streak grows. Missing a day resets it — so protect it.",
        value: `${momentum.streakDays} days`,
        visual: (
          <div className="flex flex-col items-center gap-3">
            <StreakFlameIllustration days={momentum.streakDays} />
            <StreakVisualization currentStreak={momentum.streakDays} />
          </div>
        ),
      }),
    },
    {
      emoji: "📅",
      value: `${activeWeekdays}/7`,
      label: "Week",
      onClick: () => handleStatClick({
        title: "Week",
        description: "How many days this week you've taken action on your goals. Aim for 5 out of 7 as a strong baseline — showing up most days beats a perfect record you can't maintain.",
        value: `${activeWeekdays} active days`,
        visual: (
          <div className="flex flex-col items-center gap-4">
            <WeekGridIllustration active={activeWeekdays} />
            <ActivityVisualization weeklyActivity={momentum.weeklyActivity} />
          </div>
        ),
      }),
    },
    {
      emoji: "✅",
      value: `${Math.round(momentum.completionRate * 100)}%`,
      label: "Rate",
      onClick: () => handleStatClick({
        title: "Rate",
        description: "The percentage of daily intentions you've actually completed. This is your follow-through score — it separates those who set goals from those who achieve them.",
        value: `${Math.round(momentum.completionRate * 100)}%`,
        visual: <RateCircleIllustration rate={Math.round(momentum.completionRate * 100)} />,
      }),
    },
    {
      emoji: deltaPositive ? "📈" : "📉",
      value: deltaLabel,
      label: "Trend",
      onClick: () => handleStatClick({
        title: deltaPositive ? "Trending Up" : "Trending Down",
        description: `Your momentum score this week compared to last week. ${deltaPositive ? "You're building consistent progress — keep showing up." : "A dip is normal. What matters is your next action."}`,
        value: deltaLabel,
        visual: <TrendArrowIllustration positive={deltaPositive} />,
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
              description: "Your Momentum Score measures consistency and progress across all goals. It combines daily streaks, completion rates, and weekly engagement into one number. Higher is better — and it compounds over time.",
              value: `${displayScore} / 100`,
              visual: <ScoreIllustration score={displayScore} />,
            })}
            className="min-w-0 cursor-pointer transition-opacity hover:opacity-80 text-left"
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

          {/* Score arc — desktop only */}
          <div className="hidden sm:flex flex-shrink-0 flex-col items-end gap-2">
            <div
              className="relative h-16 w-16 cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => handleStatClick({
                title: "Momentum Score",
                description: "Your Momentum Score measures consistency and progress across all goals. It combines daily streaks, completion rates, and weekly engagement into one number. Higher is better — and it compounds over time.",
                value: `${displayScore} / 100`,
                visual: <ScoreIllustration score={displayScore} />,
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
              className="flex flex-col gap-0.5 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-left transition-all hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.97]"
            >
              <div className="flex items-center gap-0.5">
                <span className={cn(
                  "font-serif font-semibold sm:text-lg",
                  s.label === "Streak" && momentum.streakDays >= 7 ? "text-[#E8C97A]" : "text-white"
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

        {/* ── Fixed-height weekly bar chart ─── */}
        <div className="mt-4">
          <div className="flex items-stretch gap-1 sm:gap-1.5">
            {momentum.weeklyActivity.map((day, index) => {
              const fillPct = day.tasksTotal > 0
                ? Math.max(10, (day.tasksCompleted / day.tasksTotal) * 100)
                : day.hasLog ? 35 : 0;
              const isToday  = index === momentum.weeklyActivity.length - 1;
              const weekday  = new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });

              return (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                  {/* Fixed-height container, fill from bottom */}
                  <div className="relative w-full overflow-hidden rounded-sm" style={{ height: 28 }}>
                    {/* Track */}
                    <div className="absolute inset-0 bg-white/[0.06]" />
                    {/* Fill */}
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-500"
                      style={{
                        height: `${fillPct}%`,
                        background: isToday
                          ? "#C4963A"
                          : day.hasLog
                          ? "rgba(196,150,58,0.42)"
                          : "transparent",
                      }}
                    />
                  </div>
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
        </div>
      </div>

      <StatInfoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        stat={selectedStat}
      />
    </section>
  );
}
