"use client";

interface ActivityVisualizationProps {
  weeklyActivity: Array<{ date: string; hasLog: boolean; tasksTotal: number; tasksCompleted: number }>;
}

export function ActivityVisualization({ weeklyActivity }: ActivityVisualizationProps) {
  return (
    <div className="flex items-end gap-1.5">
      {weeklyActivity.map((day, index) => {
        const height = day.tasksTotal > 0
          ? Math.max(6, (day.tasksCompleted / day.tasksTotal) * 32)
          : 6;
        const weekday = new Date(`${day.date}T12:00:00`).toLocaleDateString(
          "en-US",
          { weekday: "short" }
        );

        return (
          <div key={day.date} className="flex flex-col items-center gap-1">
            <div
              className="w-full rounded-sm transition-all duration-500"
              style={{
                width: "20px",
                height,
                background: day.hasLog
                  ? "rgba(196,150,58,0.5)"
                  : "rgba(255,255,255,0.07)",
              }}
            />
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40">
              {weekday}
            </span>
          </div>
        );
      })}
    </div>
  );
}
