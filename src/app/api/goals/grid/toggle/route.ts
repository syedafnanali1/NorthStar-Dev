// src/app/api/goals/grid/toggle/route.ts
// POST - toggle a goal completion cell for a specific date in the grid.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { dailyLogs, goalTasks, goals } from "@/drizzle/schema";
import { and, eq, sql } from "drizzle-orm";
import { inferTaskIncrementFromText } from "@/lib/progress-intelligence";
import type { NextRequest } from "next/server";

const bodySchema = z.object({
  goalId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.boolean(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }

  const { goalId, date, done } = parsed.data;

  const tasks = await db
    .select({
      id: goalTasks.id,
      goalId: goalTasks.goalId,
      text: goalTasks.text,
      incrementValue: goalTasks.incrementValue,
      order: goalTasks.order,
    })
    .from(goalTasks)
    .where(and(eq(goalTasks.goalId, goalId), eq(goalTasks.userId, userId)))
    .orderBy(goalTasks.order);

  if (tasks.length === 0) {
    return NextResponse.json({ error: "No tasks found for goal" }, { status: 404 });
  }

  const primaryTask = tasks[0]!;
  const taskIds = tasks.map((task) => task.id);

  const [existingLog] = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
    .limit(1);

  const currentIds = new Set(existingLog?.completedTaskIds ?? []);
  const wasDone = taskIds.some((taskId) => currentIds.has(taskId));

  const nextIds = new Set(currentIds);
  if (done) {
    if (!wasDone) {
      nextIds.add(primaryTask.id);
    }
  } else {
    for (const taskId of taskIds) {
      nextIds.delete(taskId);
    }
  }

  const completedTaskIds = Array.from(nextIds);
  if (existingLog) {
    await db
      .update(dailyLogs)
      .set({ completedTaskIds })
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)));
  } else {
    await db.insert(dailyLogs).values({
      userId,
      date,
      completedTaskIds,
    });
  }

  const newlyCompleted = Array.from(nextIds).filter((taskId) => !currentIds.has(taskId));
  const newlyUncompleted = Array.from(currentIds).filter((taskId) => !nextIds.has(taskId));
  const changedTaskIds = Array.from(new Set([...newlyCompleted, ...newlyUncompleted]));

  if (changedTaskIds.length > 0) {
    const [goal] = await db
      .select({
        id: goals.id,
        title: goals.title,
        unit: goals.unit,
        category: goals.category,
        targetValue: goals.targetValue,
      })
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);

    if (goal) {
      const taskById = new Map(tasks.map((task) => [task.id, task]));
      const newlyCompletedSet = new Set(newlyCompleted);
      const learnedTaskIncrements: Array<{ taskId: string; value: number }> = [];
      let delta = 0;

      for (const taskId of changedTaskIds) {
        const task = taskById.get(taskId);
        if (!task) continue;

        const inferredAmount = inferTaskIncrementFromText({
          goalTitle: goal.title,
          goalUnit: goal.unit,
          goalCategory: goal.category,
          goalTargetValue: goal.targetValue,
          taskText: task.text,
        });

        const amount = task.incrementValue ?? inferredAmount ?? 1;
        const direction = newlyCompletedSet.has(taskId) ? 1 : -1;
        delta += direction * amount;

        if (task.incrementValue == null && inferredAmount != null) {
          learnedTaskIncrements.push({ taskId, value: inferredAmount });
        }
      }

      for (const learned of learnedTaskIncrements) {
        await db
          .update(goalTasks)
          .set({ incrementValue: learned.value })
          .where(eq(goalTasks.id, learned.taskId));
      }

      if (Number.isFinite(delta) && delta !== 0) {
        const nextValueExpr = sql`GREATEST(0, ${goals.currentValue} + ${delta})`;
        await db
          .update(goals)
          .set({
            currentValue: nextValueExpr,
            isCompleted: sql`CASE WHEN ${goals.targetValue} IS NOT NULL THEN ${nextValueExpr} >= ${goals.targetValue} ELSE ${goals.isCompleted} END`,
            completedAt: sql`CASE WHEN ${goals.targetValue} IS NOT NULL AND ${nextValueExpr} >= ${goals.targetValue} THEN COALESCE(${goals.completedAt}, NOW()) WHEN ${goals.targetValue} IS NOT NULL THEN NULL ELSE ${goals.completedAt} END`,
            updatedAt: new Date(),
          })
          .where(and(eq(goals.id, goal.id), eq(goals.userId, userId)));
      }
    }
  }

  return NextResponse.json({
    success: true,
    done: taskIds.some((taskId) => nextIds.has(taskId)),
  });
}
