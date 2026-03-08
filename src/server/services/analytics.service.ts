// src/server/services/analytics.service.ts
// All analytics calculations live here.
// Momentum score, streaks, achievement checks, category breakdowns.

import { db } from "@/lib/db";
import {
  goals,
  dailyLogs,
  progressEntries,
  userAchievements,
  users,
  goalTasks,
} from "@/drizzle/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { subDays, format, startOfDay, eachDayOfInterval, parseISO } from "date-fns";

export interface MomentumData {
  score: number; // 0–100
  streakDays: number;
  longestStreak: number;
  activeDaysThisMonth: number;
  completionRate: number; // 0–1
  weeklyActivity: DayActivity[];
  constellationData: ConstellationPoint[];
}

export interface DayActivity {
  date: string;
  tasksCompleted: number;
  tasksTotal: number;
  hasLog: boolean;
}

export interface ConstellationPoint {
  date: string;
  intensity: number; // 0–1
  dayOfWeek: number;
}

export interface CategoryBreakdown {
  category: string;
  label: string;
  emoji: string;
  goalCount: number;
  avgProgress: number;
  color: string;
}

export interface LifetimeStats {
  totalGoals: number;
  completedGoals: number;
  totalMoments: number;
  totalProgressLogs: number;
  daysTracked: number;
  longestStreak: number;
}

export const analyticsService = {
  /**
   * Calculate complete momentum data for a user
   */
  async getMomentumData(userId: string, rangedays = 30): Promise<MomentumData> {
    const now = new Date();
    const rangeStart = subDays(now, rangedays);
    const today = format(now, "yyyy-MM-dd");

    // Get daily logs for range
    const logs = await db
      .select()
      .from(dailyLogs)
      .where(
        and(
          eq(dailyLogs.userId, userId),
          gte(dailyLogs.date, format(rangeStart, "yyyy-MM-dd")),
          lte(dailyLogs.date, today)
        )
      )
      .orderBy(desc(dailyLogs.date));

    // Get all active goal tasks
    const activeTasks = await db
      .select()
      .from(goalTasks)
      .where(eq(goalTasks.userId, userId));

    const totalTasksPerDay = activeTasks.length;

    // Build daily activity map
    const logMap = new Map(logs.map((l) => [l.date, l]));

    // Calculate streak
    let streakDays = 0;
    let checkDate = today;
    while (true) {
      const log = logMap.get(checkDate);
      if (log && (log.completedTaskIds.length > 0 || log.reflection)) {
        streakDays++;
        checkDate = format(subDays(parseISO(checkDate), 1), "yyyy-MM-dd");
      } else {
        break;
      }
    }

    // Get longest streak from user record
    const [user] = await db
      .select({ longestStreak: users.longestStreak })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const longestStreak = Math.max(streakDays, user?.longestStreak ?? 0);

    // Update streak if changed
    if (streakDays !== (user ? 0 : streakDays)) {
      await db
        .update(users)
        .set({
          currentStreak: streakDays,
          longestStreak,
          lastActiveAt: now,
        })
        .where(eq(users.id, userId));
    }

    // Build 7-day activity data
    const days = eachDayOfInterval({
      start: subDays(now, 6),
      end: now,
    });

    const weeklyActivity: DayActivity[] = days.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      const log = logMap.get(dateStr);
      return {
        date: dateStr,
        tasksCompleted: log?.completedTaskIds.length ?? 0,
        tasksTotal: totalTasksPerDay,
        hasLog: !!log,
      };
    });

    // Completion rate (last 7 days)
    const last7Total = weeklyActivity.reduce((a, d) => a + d.tasksTotal, 0);
    const last7Done = weeklyActivity.reduce((a, d) => a + d.tasksCompleted, 0);
    const completionRate = last7Total > 0 ? last7Done / last7Total : 0;

    // Active days this month
    const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
    const activeDaysThisMonth = logs.filter(
      (l) => l.date >= monthStart && (l.completedTaskIds.length > 0 || l.reflection)
    ).length;

    // Goal progress
    const userGoals = await db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.isArchived, false)));

    const avgGoalProgress =
      userGoals.length > 0
        ? userGoals.reduce((a, g) => {
            const pct = g.targetValue
              ? Math.min(100, (g.currentValue / g.targetValue) * 100)
              : 0;
            return a + pct;
          }, 0) / userGoals.length
        : 0;

    // Momentum score formula:
    // streak (max 30 pts) + completion rate (max 35 pts) + goal progress (max 20 pts) + active days (max 15 pts)
    const score = Math.round(
      Math.min(100,
        Math.min(30, streakDays * 2) +
        completionRate * 35 +
        (avgGoalProgress / 100) * 20 +
        Math.min(15, activeDaysThisMonth * 0.5)
      )
    );

    // Constellation data (range days, grouped by date)
    const allDays = eachDayOfInterval({ start: rangeStart, end: now });
    const constellationData: ConstellationPoint[] = allDays.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      const log = logMap.get(dateStr);
      const intensity = log
        ? Math.min(1, (log.completedTaskIds.length / Math.max(1, totalTasksPerDay)))
        : 0;
      return {
        date: dateStr,
        intensity,
        dayOfWeek: d.getDay(),
      };
    });

    return {
      score,
      streakDays,
      longestStreak,
      activeDaysThisMonth,
      completionRate,
      weeklyActivity,
      constellationData,
    };
  },

  /**
   * Get category breakdown for analytics page
   */
  async getCategoryBreakdown(userId: string): Promise<CategoryBreakdown[]> {
    const userGoals = await db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.isArchived, false)));

    const categoryMeta: Record<string, { label: string; emoji: string; color: string }> = {
      health:  { label: "Health",   emoji: "🏃", color: "#6B8C7A" },
      finance: { label: "Finance",  emoji: "💰", color: "#5B7EA6" },
      writing: { label: "Writing",  emoji: "✍️", color: "#C4963A" },
      body:    { label: "Body",     emoji: "⚖️", color: "#B5705B" },
      mindset: { label: "Mindset",  emoji: "🧠", color: "#7B6FA0" },
      custom:  { label: "Custom",   emoji: "⭐", color: "#C4963A" },
    };

    const grouped = new Map<string, typeof userGoals>();
    for (const g of userGoals) {
      const arr = grouped.get(g.category) ?? [];
      arr.push(g);
      grouped.set(g.category, arr);
    }

    return Array.from(grouped.entries()).map(([category, categoryGoals]) => {
      const meta = categoryMeta[category] ?? { label: category, emoji: "⭐", color: "#C4963A" };
      const avgProgress =
        categoryGoals.length > 0
          ? categoryGoals.reduce((a, g) => {
              return a + (g.targetValue ? Math.min(100, (g.currentValue / g.targetValue) * 100) : 0);
            }, 0) / categoryGoals.length
          : 0;

      return {
        category,
        label: meta.label,
        emoji: meta.emoji,
        goalCount: categoryGoals.length,
        avgProgress: Math.round(avgProgress),
        color: meta.color,
      };
    });
  },

  /**
   * Get lifetime statistics
   */
  async getLifetimeStats(userId: string): Promise<LifetimeStats> {
    const [
      goalStats,
      momentCount,
      progressCount,
      logCount,
      user,
    ] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          completed: sql<number>`count(*) filter (where ${goals.isCompleted} = true)`,
        })
        .from(goals)
        .where(eq(goals.userId, userId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(goals)
        .where(eq(goals.userId, userId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(progressEntries)
        .where(eq(progressEntries.userId, userId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(dailyLogs)
        .where(eq(dailyLogs.userId, userId)),
      db
        .select({ longestStreak: users.longestStreak })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
    ]);

    return {
      totalGoals: goalStats[0]?.total ?? 0,
      completedGoals: goalStats[0]?.completed ?? 0,
      totalMoments: momentCount[0]?.count ?? 0,
      totalProgressLogs: progressCount[0]?.count ?? 0,
      daysTracked: logCount[0]?.count ?? 0,
      longestStreak: user[0]?.longestStreak ?? 0,
    };
  },
};
