// src/components/analytics/pace-tracker.tsx
// Shows current vs required pace for a goal with targetValue and endDate

import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils/index";

export interface PaceGoal {
  id: string;
  title: string;
  emoji: string | null;
  currentValue: number;
  targetValue: number;
  unit: string | null;
  startDate: Date | null;
  endDate: Date;
}

interface PaceTrackerProps {
  goal: PaceGoal;
}

function formatRate(rate: number, unit: string | null): string {
  const rounded = Math.round(rate * 10) / 10;
  return unit ? `${rounded} ${unit}/day` : `${rounded}/day`;
}

export function PaceTracker({ goal }: PaceTrackerProps) {
  const now = new Date();
  const start = goal.startDate ?? new Date(0);
  const daysSinceStart = Math.max(1, differenceInDays(now, start));
  const daysUntilEnd = Math.max(1, differenceInDays(goal.endDate, now));
  const remaining = Math.max(0, goal.targetValue - goal.currentValue);

  const currentPace = goal.currentValue / daysSinceStart;
  const requiredPace = remaining / daysUntilEnd;
  const onTrack = currentPace >= requiredPace;

  const maxRate = Math.max(currentPace, requiredPace, 0.01);
  const currentPct = Math.round((currentPace / maxRate) * 100);
  const requiredPct = Math.round((requiredPace / maxRate) * 100);

  const daysLate = !onTrack && currentPace > 0
    ? Math.round(remaining / currentPace - daysUntilEnd)
    : 0;

  return (
    <div className="flex items-start gap-4">
      <span className="mt-0.5 text-xl">{goal.emoji ?? "⭐"}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-ink">{goal.title}</p>
          <span
            className={cn(
              "flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              onTrack
                ? "bg-green-100 text-green-700"
                : "bg-rose-100 text-rose-600"
            )}
          >
            {onTrack ? "On track" : `${daysLate}d behind`}
          </span>
        </div>

        <div className="mt-2 space-y-1.5">
          {/* Current pace */}
          <div>
            <div className="mb-1 flex justify-between text-[10px] text-ink-muted">
              <span>Current pace</span>
              <span className="font-mono">{formatRate(currentPace, goal.unit)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-cream-dark">
              <div
                className="h-full rounded-full bg-[#C4963A] transition-all"
                style={{ width: `${currentPct}%` }}
              />
            </div>
          </div>

          {/* Required pace */}
          <div>
            <div className="mb-1 flex justify-between text-[10px] text-ink-muted">
              <span>Required pace</span>
              <span className="font-mono">{formatRate(requiredPace, goal.unit)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-cream-dark">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  onTrack ? "bg-green-400" : "bg-rose-400"
                )}
                style={{ width: `${requiredPct}%` }}
              />
            </div>
          </div>
        </div>

        <p className="mt-1.5 text-[10px] text-ink-muted">
          {goal.currentValue.toLocaleString()}{goal.unit ? ` ${goal.unit}` : ""} of {goal.targetValue.toLocaleString()}{goal.unit ? ` ${goal.unit}` : ""} · {daysUntilEnd}d remaining
        </p>
      </div>
    </div>
  );
}
