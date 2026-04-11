// src/components/analytics/weekly-heatmap.tsx
// 52-week GitHub-style contribution heatmap

import { eachDayOfInterval, subDays, format, startOfWeek, getDay } from "date-fns";

interface WeeklyHeatmapProps {
  // date string "YYYY-MM-DD" → task count
  activityGrid: Record<string, number>;
}

function intensityClass(count: number): string {
  if (count === 0) return "bg-cream-dark";
  if (count <= 2) return "bg-[#C4963A]/25";
  if (count <= 5) return "bg-[#C4963A]/50";
  return "bg-[#C4963A]";
}

export function WeeklyHeatmap({ activityGrid }: WeeklyHeatmapProps) {
  const today = new Date();
  const start = startOfWeek(subDays(today, 363), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end: today });

  // Pad to full weeks
  const startDow = getDay(start); // should be 0 (Sunday)
  const nullPad: (Date | null)[] = Array<null>(startDow).fill(null);
  const paddedDays: (Date | null)[] = [...nullPad, ...days];

  // Build weeks array (each week = 7 days or nulls)
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7) as (Date | null)[]);
  }

  // Month labels: find first day of each month to position
  const monthLabels: { label: string; weekIndex: number }[] = [];
  let lastMonth = "";
  weeks.forEach((week, wi) => {
    for (const day of week) {
      if (!day) continue;
      const mon = format(day, "MMM");
      if (mon !== lastMonth) {
        monthLabels.push({ label: mon, weekIndex: wi });
        lastMonth = mon;
      }
      break;
    }
  });

  const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-max flex-col gap-1">
        {/* Month labels */}
        <div className="flex gap-[2px] pl-8">
          {weeks.map((_, wi) => {
            const label = monthLabels.find((m) => m.weekIndex === wi);
            return (
              <div key={wi} className="w-[10px] text-[9px] text-ink-muted">
                {label ? label.label : ""}
              </div>
            );
          })}
        </div>

        {/* Grid rows: 7 days of week */}
        <div className="flex gap-[2px]">
          {/* Day-of-week labels */}
          <div className="mr-1 flex flex-col gap-[2px]">
            {DAY_LABELS.map((label, i) => (
              <div key={i} className="flex h-[10px] w-6 items-center justify-end text-[8px] text-ink-muted">
                {label}
              </div>
            ))}
          </div>

          {/* Columns */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {week.map((day, di) => {
                if (!day) {
                  return <div key={di} className="h-[10px] w-[10px] rounded-sm" />;
                }
                const dateKey = format(day, "yyyy-MM-dd");
                const count = activityGrid[dateKey] ?? 0;
                return (
                  <div
                    key={di}
                    title={`${dateKey}: ${count} task${count !== 1 ? "s" : ""} completed`}
                    className={`h-[10px] w-[10px] rounded-sm ${intensityClass(count)}`}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-1 flex items-center gap-1.5 pl-8">
          <span className="text-[9px] text-ink-muted">Less</span>
          {[0, 1, 3, 6].map((v) => (
            <div key={v} className={`h-[10px] w-[10px] rounded-sm ${intensityClass(v)}`} />
          ))}
          <span className="text-[9px] text-ink-muted">More</span>
        </div>
      </div>
    </div>
  );
}
