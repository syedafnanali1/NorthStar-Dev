"use client";

import { useEffect, useState } from "react";
import { isEnabled } from "@/lib/feature-flags";

interface ProgressEntry {
  date: string;
  value: number;
}

interface GoalStatsLevel2Props {
  goalId: string;
  currentValue: number;
  targetValue: number | null;
  color: string;
  startDate: string | null;
  endDate: string | null;
  recentProgress: ProgressEntry[];
  percentComplete?: number;
}

function MomentumBar({ score, color }: { score: number; color: string }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDisplayed(score), 80);
    return () => clearTimeout(t);
  }, [score]);

  const label =
    score >= 80 ? "On fire 🔥" :
    score >= 60 ? "Strong 💪" :
    score >= 40 ? "Steady 📈" :
    score >= 20 ? "Building 🌱" : "Getting started";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">Momentum</span>
        <span className="text-sm font-bold" style={{ color }}>{score}/100</span>
      </div>
      <div className="h-3 rounded-full bg-[var(--color-surface)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${displayed}%`, background: color }}
        />
      </div>
      <p className="mt-1.5 text-xs text-[var(--color-muted)]">{label}</p>
    </div>
  );
}

function TimelineChart({
  recentProgress,
  targetValue,
  startDate,
  endDate,
  color,
}: {
  recentProgress: ProgressEntry[];
  targetValue: number | null;
  startDate: string | null;
  endDate: string | null;
  color: string;
}) {
  if (!targetValue || recentProgress.length < 2) {
    return (
      <p className="text-xs italic text-[var(--color-muted)] py-3 text-center">
        Log progress to see your trajectory
      </p>
    );
  }

  const H = 64;
  const W = 100;
  const allValues = recentProgress.map((p) => p.value);
  const maxVal = Math.max(targetValue, ...allValues);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const toY = (v: number) => H - ((v - minVal) / range) * H;
  const toX = (i: number, total: number) => (i / Math.max(total - 1, 1)) * W;

  const actualPts = recentProgress
    .map((p, i) => `${toX(i, recentProgress.length)},${toY(p.value)}`)
    .join(" ");

  // Planned: linear interpolation from 0 to target across the date range
  const plannedPts = `0,${toY(recentProgress[0]?.value ?? 0)} ${W},${toY(targetValue)}`;

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">Progress vs Plan</span>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-2" style={{ height: H * 2 }}>
        {/* Planned line */}
        <polyline
          points={plannedPts}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeDasharray="3 2"
          className="text-[var(--color-muted)] opacity-40"
        />
        {/* Actual line */}
        <polyline
          points={actualPts}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Last dot */}
        {recentProgress.length > 0 && (
          <circle
            cx={toX(recentProgress.length - 1, recentProgress.length)}
            cy={toY(recentProgress[recentProgress.length - 1]!.value)}
            r="2"
            fill={color}
          />
        )}
      </svg>
      <div className="flex justify-between text-[10px] text-[var(--color-muted)] -mt-1">
        <span>{startDate ?? "Start"}</span>
        <span className="opacity-50">— planned</span>
        <span>{endDate ?? "End"}</span>
      </div>
    </div>
  );
}

function IntentionRing({ rate, color }: { rate: number; color: string }) {
  const R = 28;
  const circ = 2 * Math.PI * R;
  const dash = (rate / 100) * circ;
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDisplayed(rate), 100);
    return () => clearTimeout(t);
  }, [rate]);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={R} fill="none" stroke="var(--color-surface)" strokeWidth="7" />
        <circle
          cx="36" cy="36" r={R}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(displayed / 100) * circ} ${circ}`}
          strokeDashoffset={circ / 4}
          style={{ transition: "stroke-dasharray 0.7s ease-out" }}
        />
        <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-fg)">
          {rate}%
        </text>
      </svg>
      <span className="text-[10px] text-[var(--color-muted)] text-center leading-tight">
        Intention<br />completion
      </span>
    </div>
  );
}

export function GoalStatsLevel2({
  goalId: _goalId,
  currentValue,
  targetValue,
  color,
  startDate,
  endDate,
  recentProgress,
  percentComplete,
}: GoalStatsLevel2Props) {
  const [momentum, setMomentum] = useState(0);
  const intentionRate = percentComplete ?? (targetValue ? Math.min(100, Math.round((currentValue / targetValue) * 100)) : 0);

  useEffect(() => {
    if (!isEnabled("goalStatsLevel2")) return;

    // Derive momentum from recent progress velocity + overall progress
    const recent = recentProgress.slice(-7);
    if (recent.length >= 2) {
      const first = recent[0]!.value;
      const last = recent[recent.length - 1]!.value;
      const delta = last - first;
      const velocityScore = targetValue ? (delta / targetValue) * 100 * recent.length * 5 : 0;
      const overallScore = targetValue ? (currentValue / targetValue) * 40 : 0;
      setMomentum(Math.min(100, Math.max(0, Math.round(velocityScore + overallScore))));
    } else if (currentValue > 0 && targetValue) {
      setMomentum(Math.min(100, Math.round((currentValue / targetValue) * 80)));
    }
  }, [currentValue, targetValue, recentProgress]);

  if (!isEnabled("goalStatsLevel2")) return null;

  return (
    <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5 space-y-5">
      <p className="section-label">📊 Stats</p>

      <MomentumBar score={momentum} color={color} />

      <div className="grid grid-cols-[1fr_auto] gap-5 items-start">
        <TimelineChart
          recentProgress={recentProgress}
          targetValue={targetValue}
          startDate={startDate}
          endDate={endDate}
          color={color}
        />
        <IntentionRing rate={intentionRate} color={color} />
      </div>
    </section>
  );
}
