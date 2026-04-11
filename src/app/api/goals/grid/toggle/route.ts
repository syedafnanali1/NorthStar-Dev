// src/app/api/goals/grid/toggle/route.ts
// POST — toggle a goal's completion for a given day in the grid.
// Adds/removes the goal's first task from completedTaskIds in the daily log.

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

  // Get first task for this goal
  const [task] = await db
    .select()
    .from(goalTasks)
    .where(and(eq(goalTasks.goalId, goalId), eq(goalTasks.userId, userId)))
    .limit(1);

  if (!task) {
    return NextResponse.json({ error: "No tasks found for goal" }, { status: 404 });
  }

  // Get or create the daily log
  const [existingLog] = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
    .limit(1);

  const currentIds: string[] = existingLog?.completedTaskIds ?? [];
  const wasDone = currentIds.includes(task.id);
  const newIds = done
    ? Array.from(new Set([...currentIds, task.id]))
    : currentIds.filter((id) => id !== task.id);

  if (existingLog) {
    await db
      .update(dailyLogs)
      .set({ completedTaskIds: newIds })
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)));
  } else {
    await db.insert(dailyLogs).values({
      userId,
      date,
      completedTaskIds: newIds,
    });
  }

  if (done && !wasDone) {
    const [goal] = await db
      .select({
        id: goals.id,
        title: goals.title,
        unit: goals.unit,
        category: goals.category,
        targetValue: goals.targetValue,
      })
      .from(goals)
      .where(and(eq(goals.id, task.goalId), eq(goals.userId, userId)))
      .limit(1);

    if (goal) {
      const inferredAmount = inferTaskIncrementFromText({
        goalTitle: goal.title,
        goalUnit: goal.unit,
        goalCategory: goal.category,
        goalTargetValue: goal.targetValue,
        taskText: task.text,
      });
      const amount = task.incrementValue ?? inferredAmount ?? 1;

      if (task.incrementValue == null && inferredAmount != null) {
        await db
          .update(goalTasks)
          .set({ incrementValue: inferredAmount })
          .where(eq(goalTasks.id, task.id));
      }

      await db
        .update(goals)
        .set({ currentValue: sql`current_value + ${amount}`, updatedAt: new Date() })
        .where(and(eq(goals.id, goal.id), eq(goals.userId, userId)));
    }
  }

  return NextResponse.json({ success: true });
}
