export const runtime = "edge";

// src/app/api/goals/grid/route.ts
// GET /api/goals/grid?month=YYYY-MM
// Returns active goals + daily completion map for the month.

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { goals, goalTasks, dailyLogs } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const monthParam = req.nextUrl.searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json({ error: "Invalid month param. Use YYYY-MM." }, { status: 400 });
  }

  const [userGoals, tasks, logs] = await Promise.all([
    db
      .select({
        id: goals.id,
        title: goals.title,
        emoji: goals.emoji,
        color: goals.color,
        category: goals.category,
        isArchived: goals.isArchived,
        isCompleted: goals.isCompleted,
      })
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.isArchived, false), eq(goals.isCompleted, false))),
    db.select().from(goalTasks).where(eq(goalTasks.userId, userId)),
    db
      .select({ date: dailyLogs.date, completedTaskIds: dailyLogs.completedTaskIds })
      .from(dailyLogs)
      .where(eq(dailyLogs.userId, userId)),
  ]);

  // Build goalId → taskId[] map
  const goalTaskMap: Record<string, string[]> = {};
  for (const task of tasks) {
    if (!goalTaskMap[task.goalId]) goalTaskMap[task.goalId] = [];
    goalTaskMap[task.goalId]!.push(task.id);
  }

  // Build completionMap: date → Set<goalId> (goal is "done" if any of its tasks completed)
  const completionMap: Record<string, string[]> = {};
  for (const log of logs) {
    if (!log.date.startsWith(monthParam)) continue;
    const doneGoalIds: string[] = [];
    for (const goal of userGoals) {
      const gTasks = goalTaskMap[goal.id] ?? [];
      if (gTasks.some((tid) => log.completedTaskIds.includes(tid))) {
        doneGoalIds.push(goal.id);
      }
    }
    if (doneGoalIds.length > 0) completionMap[log.date] = doneGoalIds;
  }

  return NextResponse.json({ goals: userGoals, completionMap });
}
