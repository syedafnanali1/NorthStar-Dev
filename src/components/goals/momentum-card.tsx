// src/components/goals/momentum-card.tsx
"use client";

import { useState, useEffect } from "react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { cn } from "@/lib/utils";
import type { MomentumData } from "@/server/services/analytics.service";
import Link from "next/link";

interface MomentumCardProps {
  momentum: MomentumData;
  className?: string;
}

export function MomentumCard({ momentum, className }: MomentumCardProps) {
  const [displayScore, setDisplayScore] = useState(0);

  // Animate score on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      let current = 0;
      const target = momentum.score;
      const step = target / 40;
      const interval = setInterval(() => {
        current = Math.min(target, current + step);
        setDisplayScore(Math.round(current));
        if (current >= target) clearInterval(interval);
      }, 30);
      return () => clearInterval(interval);
    }, 200);
    return () => clearTimeout(timer);
  }, [momentum.score]);

  const scoreLabel =
    momentum.score >= 80
      ? "Exceptional"
      : momentum.score >= 60
      ? "Strong"
      : momentum.score >= 40
      ? "Building"
      : "Getting Started";

  const maxBarHeight = 40;

  return (
    <div
      className={cn(
        "card p-6 cursor-pointer hover:shadow-card-hover transition-all",
        className
      )}
      style={{ background: "#1A1714", border: "1px solid #2A2522" }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-2xs uppercase tracking-widest font-medium mb-1" style={{ color: "rgba(232,201,122,0.5)" }}>
            Momentum Score
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-serif font-semibold text-white">
              {displayScore}
            </span>
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              / 100
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "rgba(232,201,122,0.7)" }}>
            {scoreLabel}
          </p>
        </div>

        <ProgressRing
          percent={displayScore}
          size={88}
          strokeWidth={6}
          color="#C4963A"
          trackColor="rgba(255,255,255,0.07)"
        >
          <div className="text-center">
            <div className="text-xl font-serif font-semibold text-white">
              {displayScore}
            </div>
          </div>
        </ProgressRing>
      </div>

      {/* Stats row */}
      <div
        className="grid grid-cols-4 gap-3 mb-5 pb-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="text-center">
          <div className="text-lg font-serif font-semibold text-white">
            🔥 {momentum.streakDays}
          </div>
          <div className="text-2xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>
            Streak
          </div>
        </div>
        <div className="text-center">
          <div className="text-lg font-serif font-semibold text-white">
            {momentum.weeklyActivity.filter((d) => d.hasLog).length}
          </div>
          <div className="text-2xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>
            Active
          </div>
        </div>
        <div className="text-center">
          <div className="text-lg font-serif font-semibold text-white">
            {Math.round(momentum.completionRate * 100)}%
          </div>
          <div className="text-2xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>
            Done rate
          </div>
        </div>
        <div className="text-center">
          <div className="text-lg font-serif font-semibold text-white">
            {momentum.activeDaysThisMonth}
          </div>
          <div className="text-2xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>
            Days/mo
          </div>
        </div>
      </div>

      {/* 7-day bar chart */}
      <div className="flex items-end gap-1.5 h-10">
        {momentum.weeklyActivity.map((day, i) => {
          const height =
            day.tasksTotal > 0
              ? Math.max(4, (day.tasksCompleted / day.tasksTotal) * maxBarHeight)
              : 4;
          const isToday = i === momentum.weeklyActivity.length - 1;
          return (
            <div key={day.date} className="flex-1 flex flex-col justify-end">
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: `${height}px`,
                  background: isToday
                    ? "#C4963A"
                    : day.hasLog
                    ? "rgba(196,150,58,0.45)"
                    : "rgba(255,255,255,0.07)",
                }}
              />
            </div>
          );
        })}
      </div>

      <Link href="/analytics" className="block mt-3 text-center text-2xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
        Click for analytics ↗
      </Link>
    </div>
  );
}
