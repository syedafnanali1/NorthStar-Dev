"use client";

// src/components/goals/predicted-completion.tsx
// Visual pace comparison: current daily rate vs required rate to hit deadline.

import { cn } from "@/lib/utils/index";

interface PredictedCompletionProps {
  currentDailyRate: number;
  requiredDailyRate: number;
  etaDays: number;
  daysAhead: number;
  unit: string;
}

export function PredictedCompletion({
  currentDailyRate,
  requiredDailyRate,
  etaDays,
  daysAhead,
  unit,
}: PredictedCompletionProps) {
  const isOnTrack = daysAhead >= 0;
  const maxRate = Math.max(currentDailyRate, requiredDailyRate, 0.01);
  const currentPct = Math.min(100, (currentDailyRate / maxRate) * 100);
  const requiredPct = Math.min(100, (requiredDailyRate / maxRate) * 100);

  const etaLabel =
    etaDays > 365
      ? `${Math.round(etaDays / 30)} months`
      : etaDays > 30
      ? `${Math.round(etaDays / 7)} weeks`
      : `${etaDays} days`;

  const diffDays = Math.abs(daysAhead);

  return (
    <div className="space-y-4 rounded-2xl border border-cream-dark bg-white/75 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
          Pace Prediction
        </p>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            isOnTrack
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose/10 text-rose"
          )}
        >
          {isOnTrack ? (
            <>On track ✓{daysAhead > 0 ? ` · ${daysAhead}d ahead` : ""}</>
          ) : (
            <>{diffDays} days behind</>
          )}
        </span>
      </div>

      {/* Bar chart */}
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Current pace</span>
            <span className="font-medium text-ink">
              {currentDailyRate.toLocaleString()} {unit}/day
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream-dark">
            <div
              className="h-full rounded-full bg-gold transition-all duration-700"
              style={{ width: `${currentPct}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Required pace</span>
            <span className="font-medium text-ink">
              {requiredDailyRate.toLocaleString()} {unit}/day
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream-dark">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                isOnTrack ? "bg-emerald-500" : "bg-rose"
              )}
              style={{ width: `${requiredPct}%` }}
            />
          </div>
        </div>
      </div>

      <p className="text-xs leading-5 text-ink-muted">
        {isOnTrack
          ? `At your current rate you&apos;ll finish in ~${etaLabel} — ${daysAhead > 0 ? `${daysAhead} days ahead of schedule` : "right on schedule"}.`
          : `At your current rate you&apos;ll finish in ~${etaLabel}, which is ${diffDays} days past your deadline. Pick up to ${requiredDailyRate} ${unit}/day to stay on track.`}
      </p>
    </div>
  );
}
