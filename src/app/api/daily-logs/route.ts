export const runtime = "edge";

// src/app/api/daily-logs/route.ts
// GET  /api/daily-logs?date=YYYY-MM-DD — get log for a specific date
// POST /api/daily-logs — create or update a daily log

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { dailyLogs, goalTasks, goals } from "@/drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { saveDailyLogSchema } from "@/lib/validators/daily-log";
import { achievementService } from "@/server/services/achievements.service";
import { xpService } from "@/server/services/xp.service";
import { analyticsService } from "@/server/services/analytics.service";
import { aiCoachService } from "@/server/services/ai-coach.service";
import { streakProtectionService } from "@/server/services/streak-protection.service";
import { inferTaskIncrementFromText } from "@/lib/progress-intelligence";
import { wearablesService } from "@/server/services/wearables.service";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const month = searchParams.get("month"); // YYYY-MM — fetch all logs for a month

  try {
    if (date) {
      const [log] = await db
        .select()
        .from(dailyLogs)
        .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
        .limit(1);
      return NextResponse.json({ log: log ?? null });
    }

    if (month) {
      const logs = await db
        .select()
        .from(dailyLogs)
        .where(eq(dailyLogs.userId, userId));
      // Filter in JS since Drizzle doesn't have a great LIKE helper
      const filtered = logs.filter((l) => l.date.startsWith(month));
      return NextResponse.json({ logs: filtered });
    }

    return NextResponse.json({ error: "date or month parameter required" }, { status: 400 });
  } catch (err) {
    console.error("[GET /api/daily-logs]", err);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const validated = saveDailyLogSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }

    const { date, mood, sleep, reflection, dailyIntentions, completedTaskIds } = validated.data;

    // Upsert: update if exists, insert if not
    const [existing] = await db
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
      .limit(1);

    let log;
    if (existing) {
      [log] = await db
        .update(dailyLogs)
        .set({
          mood: mood ?? null,
          sleep: sleep ?? null,
          reflection: reflection ?? null,
          dailyIntentions: dailyIntentions ?? existing.dailyIntentions ?? [],
          completedTaskIds,
          updatedAt: new Date(),
        })
        .where(eq(dailyLogs.id, existing.id))
        .returning();
    } else {
      [log] = await db
        .insert(dailyLogs)
        .values({
          userId,
          date,
          mood: mood ?? null,
          sleep: sleep ?? null,
          reflection: reflection ?? null,
          dailyIntentions: dailyIntentions ?? [],
          completedTaskIds,
        })
        .returning();

      // First log achievement
      await achievementService.award(userId, "ignition");
    }

    if (!sleep) {
      const autofilledSleep = await wearablesService.autoFillSleepForDate(userId, date);
      if (autofilledSleep) {
        [log] = await db
          .select()
          .from(dailyLogs)
          .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
          .limit(1);
      }
    }

    const prevIds = new Set(existing?.completedTaskIds ?? []);
    const nextIds = new Set(completedTaskIds ?? []);
    const newlyCompleted = Array.from(nextIds).filter((id) => !prevIds.has(id));
    const newlyUncompleted = Array.from(prevIds).filter((id) => !nextIds.has(id));
    const changedTaskIds = Array.from(new Set([...newlyCompleted, ...newlyUncompleted]));

    // Smart auto-tracking: apply progress deltas for newly checked and unchecked tasks.
    if (changedTaskIds.length > 0) {
        // Look up each task's metadata
        const taskRows = await db
          .select({
            id: goalTasks.id,
            goalId: goalTasks.goalId,
            text: goalTasks.text,
            incrementValue: goalTasks.incrementValue,
          })
          .from(goalTasks)
          .where(inArray(goalTasks.id, changedTaskIds));

        const goalIds = Array.from(new Set(taskRows.map((task) => task.goalId)));
        const goalRows =
          goalIds.length > 0
            ? await db
                .select({
                  id: goals.id,
                  title: goals.title,
                  unit: goals.unit,
                  category: goals.category,
                  targetValue: goals.targetValue,
                })
                .from(goals)
                .where(and(eq(goals.userId, userId), inArray(goals.id, goalIds)))
            : [];

        const goalById = new Map(goalRows.map((goal) => [goal.id, goal]));

        const newlyCompletedSet = new Set(newlyCompleted);
        // Sum signed increment deltas by goalId.
        const goalDeltas = new Map<string, number>();
        const learnedTaskIncrements: Array<{ taskId: string; value: number }> = [];
        for (const t of taskRows) {
          const goal = goalById.get(t.goalId);
          const inferredAmount =
            goal
              ? inferTaskIncrementFromText({
                  goalTitle: goal.title,
                  goalUnit: goal.unit,
                  goalCategory: goal.category,
                  goalTargetValue: goal.targetValue,
                  taskText: t.text,
                })
              : null;
          const amount = t.incrementValue ?? inferredAmount ?? 1;
          const direction = newlyCompletedSet.has(t.id) ? 1 : -1;

          if (t.incrementValue == null && inferredAmount != null) {
            learnedTaskIncrements.push({ taskId: t.id, value: inferredAmount });
          }

          goalDeltas.set(t.goalId, (goalDeltas.get(t.goalId) ?? 0) + direction * amount);
        }

        for (const learned of learnedTaskIncrements) {
          await db
            .update(goalTasks)
            .set({ incrementValue: learned.value })
            .where(eq(goalTasks.id, learned.taskId));
        }

        // Increment ALL goals (both habit and metric) — smart tracking for all
        for (const [goalId, delta] of goalDeltas) {
          if (!Number.isFinite(delta) || delta === 0) continue;
          const nextValueExpr = sql`GREATEST(0, ${goals.currentValue} + ${delta})`;
          await db
            .update(goals)
            .set({
              currentValue: nextValueExpr,
              isCompleted: sql`CASE WHEN ${goals.targetValue} IS NOT NULL THEN ${nextValueExpr} >= ${goals.targetValue} ELSE ${goals.isCompleted} END`,
              completedAt: sql`CASE WHEN ${goals.targetValue} IS NOT NULL AND ${nextValueExpr} >= ${goals.targetValue} THEN COALESCE(${goals.completedAt}, NOW()) WHEN ${goals.targetValue} IS NOT NULL THEN NULL ELSE ${goals.completedAt} END`,
              updatedAt: new Date(),
            })
            .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
        }

        for (const goalId of goalDeltas.keys()) {
          void aiCoachService
            .maybeCreatePredictionInsightForGoal(userId, goalId, {
              cooldownHours: 24,
              createNotification: true,
            })
            .catch(() => null);
        }
    }

    // Award XP for check-in, plus each newly completed task.
    void xpService.awardXP(userId, "post_checkin");
    const taskCount = newlyCompleted.length;
    for (let i = 0; i < taskCount; i++) {
      void xpService.awardXP(userId, "complete_task");
    }

    // Refresh rolling momentum snapshot in the background after each check-in.
    void analyticsService.getMomentumData(userId, 30).catch(() => null);
    // Refresh behavior intelligence signals in the background for smarter suggestions.
    void analyticsService.getBehaviorIntelligence(userId, 56).catch(() => null);
    // Award a streak freeze every 7 days of sustained consistency.
    void streakProtectionService.awardWeeklyFreeze(userId).catch(() => null);

    return NextResponse.json({ log }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/daily-logs]", err);
    return NextResponse.json({ error: "Failed to save log" }, { status: 500 });
  }
}
