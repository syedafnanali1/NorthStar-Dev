export const runtime = "edge";

import { NextResponse } from "next/server";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { goals, progressEntries, users } from "@/drizzle/schema";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000);

  const [activeGoalsNow, activeGoalsPrev, userData, progressThisWeek, progressLastWeek] = await Promise.all([
    db.select({ n: count() }).from(goals).where(
      and(eq(goals.userId, userId), eq(goals.isCompleted, false), eq(goals.isArchived, false))
    ),
    db.select({ n: count() }).from(goals).where(
      and(
        eq(goals.userId, userId),
        eq(goals.isCompleted, false),
        eq(goals.isArchived, false),
        gte(goals.createdAt, twoWeeksAgo)
      )
    ),
    db.select({ currentStreak: users.currentStreak, longestStreak: users.longestStreak })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db.select({ n: count() }).from(progressEntries).where(
      and(eq(progressEntries.userId, userId), gte(progressEntries.loggedAt, weekAgo))
    ),
    db.select({ n: count() }).from(progressEntries).where(
      and(
        eq(progressEntries.userId, userId),
        gte(progressEntries.loggedAt, twoWeeksAgo),
        sql`${progressEntries.loggedAt} < ${weekAgo}`
      )
    ),
  ]);

  const active = activeGoalsNow[0]?.n ?? 0;
  const streak = userData[0]?.currentStreak ?? 0;
  const thisWeekLogs = progressThisWeek[0]?.n ?? 0;
  const lastWeekLogs = progressLastWeek[0]?.n ?? 0;

  const completionRate = thisWeekLogs > 0
    ? Math.min(100, Math.round((thisWeekLogs / Math.max(active, 1)) * 100 / 7 * 100))
    : 0;
  const prevCompletionRate = lastWeekLogs > 0
    ? Math.min(100, Math.round((lastWeekLogs / Math.max(active, 1)) * 100 / 7 * 100))
    : 0;

  return NextResponse.json(
    {
      activeGoals: active,
      weeklyStreak: streak,
      completionRate,
      activeGoalsDelta: 0,
      streakDelta: 0,
      completionRateDelta: completionRate - prevCompletionRate,
    },
    { headers: { "Cache-Control": "private, max-age=120" } }
  );
}
