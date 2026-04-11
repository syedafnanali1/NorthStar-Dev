// src/app/grid/page.tsx
// Goal Tracker Grid — 31-day monthly toggle grid for all active goals.

import type { Metadata } from "next";
import { format } from "date-fns";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { GoalGrid } from "./goal-grid";
import { db } from "@/lib/db";
import { goals, goalTasks, dailyLogs } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

export const metadata: Metadata = { title: "Goal Grid" };

export default async function GridPage() {
  const user = await requireAuthUser();
  const now = new Date();
  const month = format(now, "yyyy-MM");

  const [userGoals, tasks, logs] = await Promise.all([
    db
      .select({
        id: goals.id,
        title: goals.title,
        emoji: goals.emoji,
        color: goals.color,
        category: goals.category,
      })
      .from(goals)
      .where(
        and(
          eq(goals.userId, user.id),
          eq(goals.isArchived, false),
          eq(goals.isCompleted, false)
        )
      ),
    db.select().from(goalTasks).where(eq(goalTasks.userId, user.id)),
    db
      .select({ date: dailyLogs.date, completedTaskIds: dailyLogs.completedTaskIds })
      .from(dailyLogs)
      .where(eq(dailyLogs.userId, user.id)),
  ]);

  // Build goalId → taskId[]
  const goalTaskMap: Record<string, string[]> = {};
  for (const task of tasks) {
    if (!goalTaskMap[task.goalId]) goalTaskMap[task.goalId] = [];
    goalTaskMap[task.goalId]!.push(task.id);
  }

  // Build completionMap for current month
  const completionMap: Record<string, string[]> = {};
  for (const log of logs) {
    if (!log.date.startsWith(month)) continue;
    const doneGoalIds: string[] = [];
    for (const goal of userGoals) {
      const gTasks = goalTaskMap[goal.id] ?? [];
      if (gTasks.some((tid) => log.completedTaskIds.includes(tid))) {
        doneGoalIds.push(goal.id);
      }
    }
    if (doneGoalIds.length > 0) completionMap[log.date] = doneGoalIds;
  }

  const todayStr = format(now, "yyyy-MM-dd");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
              Monthly View
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-ink lg:text-[3.2rem] lg:leading-[0.93]">
              Goal Tracker
            </h1>
            <p className="mt-1 text-sm text-ink-muted">Daily goals grid with monthly progress</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-ink">{todayStr}</p>
            <p className="text-xs text-ink-muted">{userGoals.length} active goal{userGoals.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <GoalGrid
          goals={userGoals}
          initialCompletionMap={completionMap}
          month={month}
          userId={user.id}
        />
      </div>
    </AppLayout>
  );
}
