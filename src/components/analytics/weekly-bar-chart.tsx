// src/components/analytics/weekly-bar-chart.tsx
"use client";

import { cn, formatDate } from "@/lib/utils";
import type { DayActivity } from "@/server/services/analytics.service";

interface WeeklyBarChartProps {
  data: DayActivity[];
}

export function WeeklyBarChart({ data }: WeeklyBarChartProps) {
  const maxTasks = Math.max(...data.map((d) => d.tasksTotal), 1);

  return (
    <div className="flex items-end gap-3 h-36">
      {data.map((day, i) => {
        const isToday = i === data.length - 1;
        const pct = day.tasksTotal > 0 ? day.tasksCompleted / day.tasksTotal : 0;
        const barHeight = Math.max(4, pct * 120);
        const dayLabel = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });

        return (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
            <div className="text-2xs font-mono text-ink-muted">
              {day.tasksCompleted > 0 ? day.tasksCompleted : ""}
            </div>
            <div className="w-full flex flex-col justify-end" style={{ height: "100px" }}>
              <div
                className="w-full rounded-t-lg transition-all duration-700"
                style={{
                  height: `${barHeight}px`,
                  background: isToday
                    ? "#C4963A"
                    : day.hasLog
                    ? "rgba(196,150,58,0.4)"
                    : "var(--cream-dark)",
                }}
              />
            </div>
            <div
              className={cn(
                "text-2xs font-medium",
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
