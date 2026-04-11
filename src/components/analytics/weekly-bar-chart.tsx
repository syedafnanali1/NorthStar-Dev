// src/components/analytics/weekly-bar-chart.tsx
"use client";

import { cn } from "@/lib/utils";
import type { DayActivity } from "@/server/services/analytics.service";

interface WeeklyBarChartProps {
  data: DayActivity[];
}

export function WeeklyBarChart({ data }: WeeklyBarChartProps) {
  return (
    <div className="flex h-36 items-end gap-3 lg:h-44 lg:gap-1.5">
      {data.map((day, index) => {
        const isToday = index === data.length - 1;
        const pct = day.tasksTotal > 0 ? day.tasksCompleted / day.tasksTotal : 0;
        const barHeight = Math.max(5, pct * 110);
        const dayLabel = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "short",
        });

        return (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
            <div className="text-2xs font-mono text-ink-muted lg:hidden lg:text-xs">
              {day.tasksCompleted > 0 ? day.tasksCompleted : ""}
            </div>
            <div
              className="flex w-full flex-col justify-end"
              style={{ height: "116px" }}
            >
              <div
                className="w-full rounded-t-md transition-all duration-700 lg:rounded-t"
                style={{
                  height: `${barHeight}px`,
                  background: isToday
                    ? "#C4963A"
                    : day.hasLog
                    ? "rgba(196,150,58,0.4)"
                    : "rgba(196,150,58,0.22)",
                }}
              />
            </div>
            <div
              className={cn(
                "text-2xs font-medium lg:text-[11px] lg:tracking-[0.04em]",
                isToday ? "text-gold" : "text-ink-muted"
              )}
            >
              {dayLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
}
