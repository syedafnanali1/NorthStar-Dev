"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MomentumData } from "@/server/services/analytics.service";

interface MomentumCardProps {
  momentum: MomentumData;
  className?: string;
}

export function MomentumCard({ momentum, className }: MomentumCardProps) {
  const [displayScore, setDisplayScore] = useState(0);

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

  const deltaLabel =
    momentum.weeklyDelta >= 0
      ? `+${momentum.weeklyDelta} pts`
      : `${momentum.weeklyDelta} pts`;

  const scoreContext =
    momentum.score >= 80 ? "Exceptional. Keep this going." :
    momentum.score >= 60 ? "Strong. One missed day doesn't break a pattern." :
    momentum.score >= 40 ? "Building. Consistency is the only strategy." :
    momentum.score >= 20 ? "Time to reignite. You know what to do." :
    "Day one is the most important day. Start.";

  const activeWeekdays = momentum.weeklyActivity.filter((d) => d.hasLog).length;

  return (
    /* ── Single unified dark card, responsive across all widths ── */
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-[#2A2522] bg-[#171411] text-white",
        "shadow-[0_16px_48px_rgba(26,23,20,0.18)]",
        className
      )}
    >
      <div className="p-5 sm:p-6 lg:p-5 xl:p-6">
        {/* ── Top row: score + delta ───────────────────────── */}
        <div className="flex items-start justify-between gap-4 sm:gap-6">
          {/* Score block */}
          <div className="min-w-0">
            <p className="section-label" style={{ color: "rgba(199,175,122,0.75)" }}>
              Momentum Score
            </p>
            <div className="mt-2 flex items-end gap-2 sm:gap-3">
              <span className="font-serif text-4xl font-semibold leading-none text-white sm:text-5xl">
                {displayScore}
              </span>
              <span className="mb-1 font-serif text-base text-white/35">/ 100</span>
            </div>
            <p className="mt-1.5 font-mono text-xs text-[#E8C97A] sm:text-sm">
              {scoreContext}
            </p>
          </div>

          {/* Score ring — shown sm+ */}
          <div className="hidden sm:flex flex-shrink-0 flex-col items-end gap-2">
            {/* Compact arc */}
            <div className="relative h-16 w-16">
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

        {/* ── Progress bar ─────────────────────────────────── */}
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-[repeating-linear-gradient(to_right,rgba(255,255,255,0.12),rgba(255,255,255,0.12)_6px,transparent_6px,transparent_12px)]">
          <div
            className="h-full rounded-full bg-[#E8C97A] transition-all duration-700"
            style={{ width: `${Math.max(4, Math.min(100, displayScore))}%` }}
          />
        </div>

        {/* ── Stats row ────────────────────────────────────── */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Streak",     value: `${momentum.streakDays}d`          },
            { label: "This week",  value: `${activeWeekdays}/7`              },
            { label: "Completion", value: `${Math.round(momentum.completionRate * 100)}%` },
            { label: "vs last wk", value: deltaLabel, highlight: momentum.weeklyDelta >= 0 },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col gap-0.5 rounded-xl border border-white/6 bg-white/4 px-3 py-2.5"
            >
              <span className={cn(
                "font-serif text-base font-semibold sm:text-lg",
                s.highlight ? "text-[#E8C97A]" : "text-white"
              )}>
                {s.value}
              </span>
              <span className="section-label" style={{ color: "rgba(255,255,255,0.3)" }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Weekly bar chart ─────────────────────────────── */}
        <div className="mt-4">
          <div className="flex items-end gap-1 sm:gap-1.5">
            {momentum.weeklyActivity.map((day, index) => {
              const height = day.tasksTotal > 0
                ? Math.max(6, (day.tasksCompleted / day.tasksTotal) * 48)
                : 6;
              const isToday = index === momentum.weeklyActivity.length - 1;
              const weekday = new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });

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

          {/* Motivation text + analytics link */}
          <div className="mt-3 flex items-start justify-between gap-4">
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

        {/* ── Delta chip (hidden on sm+ since it's in stats row) ── */}
        <div className="mt-3 flex sm:hidden">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70">
            <TrendingUp className="h-3.5 w-3.5 text-gold" />
            <span>{deltaLabel} from last week</span>
          </div>
        </div>
      </div>
    </section>
  );
}
