"use client";

// src/app/grid/goal-grid.tsx
// 31-day toggle grid for tracking goal completion per day.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, getDaysInMonth, isToday, isFuture, startOfDay } from "date-fns";
import { cn } from "@/lib/utils/index";
import { toast } from "@/components/ui/toaster";

interface GridGoal {
  id: string;
  title: string;
  emoji: string | null;
  color: string;
  category: string;
}

interface GoalGridProps {
  goals: GridGoal[];
  // date string "YYYY-MM-DD" → goalId[]
  initialCompletionMap: Record<string, string[]>;
  month: string; // "YYYY-MM"
  userId: string;
}

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function GoalGrid({ goals, initialCompletionMap, month }: GoalGridProps) {
  const router = useRouter();
  const [completionMap, setCompletionMap] = useState<Record<string, string[]>>(
    initialCompletionMap
  );
  const [toggling, setToggling] = useState<string | null>(null);

  const [year, monthNum] = month.split("-").map(Number) as [number, number];
  const daysInMonth = getDaysInMonth(new Date(year, monthNum - 1));
  const today = new Date();
  const todayDay = isToday(new Date(year, monthNum - 1, today.getDate()))
    ? today.getDate()
    : null;

  const isGoalDoneOnDay = (goalId: string, day: number): boolean => {
    const dateKey = `${month}-${String(day).padStart(2, "0")}`;
    return completionMap[dateKey]?.includes(goalId) ?? false;
  };

  const completedToday = goals.filter((g) =>
    todayDay ? isGoalDoneOnDay(g.id, todayDay) : false
  ).length;

  const completedThisMonth = goals.reduce((acc, goal) => {
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (isGoalDoneOnDay(goal.id, d)) count++;
    }
    return acc + count;
  }, 0);

  const toggleCell = async (goalId: string, day: number) => {
    const dayFuture = isFuture(startOfDay(new Date(year, monthNum - 1, day)));
    if (dayFuture) return;

    const dateKey = `${month}-${String(day).padStart(2, "0")}`;
    const key = `${goalId}-${dateKey}`;
    setToggling(key);

    const isDone = isGoalDoneOnDay(goalId, day);

    // Optimistic update
    setCompletionMap((prev) => {
      const prevIds = prev[dateKey] ?? [];
      const newIds = isDone
        ? prevIds.filter((id) => id !== goalId)
        : [...prevIds, goalId];
      return { ...prev, [dateKey]: newIds };
    });

    try {
      // POST to daily-logs to toggle the goal's primary task
      await fetch("/api/goals/grid/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId, date: dateKey, done: !isDone }),
      });
      router.refresh();
    } catch {
      // Revert optimistic
      setCompletionMap((prev) => {
        const prevIds = prev[dateKey] ?? [];
        const newIds = isDone
          ? [...prevIds, goalId]
          : prevIds.filter((id) => id !== goalId);
        return { ...prev, [dateKey]: newIds };
      });
      toast("Failed to update", "error");
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="flex gap-6">
      {/* Main grid panel */}
      <div className="min-w-0 flex-1 overflow-hidden rounded-3xl border border-[#2A2522]" style={{ background: "#141210" }}>
        <div className="border-b border-[#2A2522] px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#C7AF7A]">
                Goal Tracker
              </p>
              <h2 className="mt-1 font-serif text-xl font-semibold text-white">
                {format(new Date(year, monthNum - 1), "MMMM yyyy")}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-2xl font-serif font-semibold text-white">{completedThisMonth}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Completed</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          {/* Day numbers header */}
          <div className="flex items-center gap-1 pb-2 pl-[160px]">
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const dayOfWeek = new Date(year, monthNum - 1, d).getDay();
              const isT = d === today.getDate() && month === format(today, "yyyy-MM");
              return (
                <div
                  key={d}
                  className="flex w-9 shrink-0 flex-col items-center gap-0.5"
                >
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      isT ? "text-[#E8C97A]" : "text-white/30"
                    )}
                  >
                    {DAYS_OF_WEEK[dayOfWeek]}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      isT
                        ? "text-[#E8C97A]"
                        : isFuture(startOfDay(new Date(year, monthNum - 1, d)))
                        ? "text-white/20"
                        : "text-white/55"
                    )}
                  >
                    {d}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Goal rows */}
          {goals.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm italic text-white/30">No active goals yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {goals.map((goal) => (
                <div key={goal.id} className="flex items-center gap-1">
                  {/* Goal label */}
                  <div className="flex w-[160px] shrink-0 items-center gap-2 pr-3">
                    <span className="text-base">{goal.emoji ?? "⭐"}</span>
                    <span className="truncate text-xs font-medium text-white/80">{goal.title}</span>
                  </div>

                  {/* Day cells */}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = i + 1;
                    const isT = d === today.getDate() && month === format(today, "yyyy-MM");
                    const future = isFuture(startOfDay(new Date(year, monthNum - 1, d)));
                    const done = isGoalDoneOnDay(goal.id, d);
                    const cellKey = `${goal.id}-${month}-${String(d).padStart(2, "0")}`;
                    const isToggling = toggling === cellKey;

                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={future || isToggling}
                        onClick={() => void toggleCell(goal.id, d)}
                        title={done ? "Mark incomplete" : "Mark complete"}
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all",
                          done
                            ? "bg-[#4A7A5A] text-white shadow-sm"
                            : future
                            ? "cursor-default bg-white/4 text-white/10"
                            : isT
                            ? "border border-[#C4963A]/40 bg-white/6 text-white/30 hover:bg-[#4A7A5A]/60"
                            : "bg-white/6 text-white/20 hover:bg-[#4A7A5A]/50"
                        )}
                        style={
                          done
                            ? { background: goal.color + "55", border: `1px solid ${goal.color}60` }
                            : undefined
                        }
                      >
                        {done && "✓"}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side panel */}
      <div className="hidden w-[200px] shrink-0 space-y-4 lg:block">
        {/* Today's Progress */}
        <div className="rounded-2xl border border-[#2A2522] p-4" style={{ background: "#141210" }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#C7AF7A]">
            Today&apos;s Progress
          </p>
          <div className="mt-3 text-center">
            <p className="font-serif text-3xl font-semibold text-white">
              {completedToday}
              <span className="text-lg text-white/40">/{goals.length}</span>
            </p>
            <p className="mt-1 text-xs text-white/40">goals done</p>
          </div>
          {goals.length > 0 && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[#C4963A] transition-all"
                style={{ width: `${(completedToday / goals.length) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Goals list */}
        <div className="rounded-2xl border border-[#2A2522] p-4" style={{ background: "#141210" }}>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#C7AF7A]">
            Goals
          </p>
          <div className="space-y-2">
            {goals.map((goal) => {
              let monthCount = 0;
              for (let d = 1; d <= daysInMonth; d++) {
                if (isGoalDoneOnDay(goal.id, d)) monthCount++;
              }
              return (
                <div key={goal.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-white/60">{goal.emoji} {goal.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-[#E8C97A]">{monthCount}d</span>
                </div>
              );
            })}
            {goals.length === 0 && (
              <p className="text-xs italic text-white/25">No goals yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
