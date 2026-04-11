// src/server/services/analytics.service.ts
// All analytics calculations live here.

import { db } from "@/lib/db";
import { dailyLogs, goals, goalTasks, progressEntries, users } from "@/drizzle/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { friendActivityService } from "./friend-activity.service";
import { notificationsService } from "./notifications.service";
import { xpService } from "./xp.service";

export interface MomentumData {
  score: number;
  streakDays: number;
  longestStreak: number;
  activeDaysThisMonth: number;
  completionRate: number;
  weeklyDelta: number;
  motivation: string;
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
  intensity: number;
  dayOfWeek: number;
  category?: string;
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

export interface BehaviorIntelligenceData {
  consistencyScore: number;
  recoveryScore: number;
  trendDeltaPct: number;
  riskLevel: "low" | "medium" | "high";
  followThroughScore: number;
  adaptiveDailyTarget: number;
  overloadRiskScore: number;
  checkInConsistencyScore: number;
  bestWeekday: string;
  weakestWeekday: string;
  bestCheckInWindow: string;
  sleepImpactDelta: number;
  goalBalanceScore: number;
  recommendations: string[];
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const CHECKIN_WINDOWS = [
  { label: "Morning", test: (hour: number) => hour >= 5 && hour < 12 },
  { label: "Afternoon", test: (hour: number) => hour >= 12 && hour < 17 },
  { label: "Evening", test: (hour: number) => hour >= 17 && hour < 22 },
  { label: "Late Night", test: (hour: number) => hour >= 22 || hour < 5 },
] as const;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp((sorted.length - 1) * p, 0, sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower]!;
  const weight = idx - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const analyticsService = {
  async getMomentumData(userId: string, rangedays = 30): Promise<MomentumData> {
    const now = new Date();
    const rangeStart = subDays(now, rangedays);
    const today = format(now, "yyyy-MM-dd");

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

    const activeTasks = await db
      .select()
      .from(goalTasks)
      .where(eq(goalTasks.userId, userId));

    const totalTasksPerDay = activeTasks.length;
    const logMap = new Map(logs.map((log) => [log.date, log]));

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

    const [user] = await db
      .select({
        longestStreak: users.longestStreak,
        currentStreak: users.currentStreak,
        momentumScore: users.momentumScore,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const longestStreak = Math.max(streakDays, user?.longestStreak ?? 0);

    const weekDays = eachDayOfInterval({
      start: subDays(now, 6),
      end: now,
    });

    const weeklyActivity: DayActivity[] = weekDays.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const log = logMap.get(dateStr);
      return {
        date: dateStr,
        tasksCompleted: log?.completedTaskIds.length ?? 0,
        tasksTotal: totalTasksPerDay,
        hasLog: !!log,
      };
    });

    const last7Total = weeklyActivity.reduce((total, day) => total + day.tasksTotal, 0);
    const last7Done = weeklyActivity.reduce((total, day) => total + day.tasksCompleted, 0);
    const completionRate = last7Total > 0 ? last7Done / last7Total : 0;

    const previousWeekDone = eachDayOfInterval({
      start: subDays(now, 13),
      end: subDays(now, 7),
    }).reduce((total, day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      return total + (logMap.get(dateStr)?.completedTaskIds.length ?? 0);
    }, 0);

    const monthStart = format(
      new Date(now.getFullYear(), now.getMonth(), 1),
      "yyyy-MM-dd"
    );
    const activeDaysThisMonth = logs.filter(
      (log) => log.date >= monthStart && (log.completedTaskIds.length > 0 || log.reflection)
    ).length;

    const userGoals = await db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.isArchived, false)));

    const avgGoalProgress =
      userGoals.length > 0
        ? userGoals.reduce((total, goal) => {
            const percent = goal.targetValue
              ? Math.min(100, (goal.currentValue / goal.targetValue) * 100)
              : 0;
            return total + percent;
          }, 0) / userGoals.length
        : 0;

    const score = Math.round(
      Math.min(
        100,
        Math.min(30, streakDays * 2) +
          completionRate * 35 +
          (avgGoalProgress / 100) * 20 +
          Math.min(15, activeDaysThisMonth * 0.5)
      )
    );

    const weeklyDelta = last7Done - previousWeekDone;
    const motivation =
      score >= 80
        ? "You are in a strong rhythm. Protect the streak with one deliberate action today."
        : score >= 60
        ? "Your momentum is building. Keep the next win obvious and easy to finish."
        : score >= 40
        ? "Consistency is taking shape. One finished action matters more than a perfect plan."
        : "Start with one clean action today. Momentum begins with something finishable.";

    if (
      (user?.currentStreak ?? 0) !== streakDays ||
      (user?.longestStreak ?? 0) !== longestStreak ||
      (user?.momentumScore ?? 0) !== score
    ) {
      const previousStreak = user?.currentStreak ?? 0;
      await db
        .update(users)
        .set({
          currentStreak: streakDays,
          longestStreak,
          momentumScore: score,
          lastActiveAt: now,
        })
        .where(eq(users.id, userId));

      const streakMilestones = [7, 30, 60, 100, 365].filter(
        (milestone) => previousStreak < milestone && streakDays >= milestone
      );

      for (const milestone of streakMilestones) {
        if (milestone === 7) void xpService.awardXP(userId, "streak_7");
        if (milestone === 30) void xpService.awardXP(userId, "streak_30");

        await notificationsService.createNotification(
          userId,
          "friend_milestone",
          `Streak milestone: ${milestone} days`,
          `You reached a ${milestone}-day streak.`,
          "/calendar"
        );

        void friendActivityService.emitActivity({
          actorUserId: userId,
          type: "goal_milestone",
          payload: {
            milestone,
            message: `hit a ${milestone}-day streak`,
          },
          notifyFriends: true,
          link: "/calendar",
        });
      }
    }

    // Build taskId → category map for constellation coloring
    const goalCategoryMap = new Map(userGoals.map((g) => [g.id, g.category]));
    const taskGoalMap = new Map(activeTasks.map((t) => [t.id, t.goalId]));

    const allDays = eachDayOfInterval({ start: rangeStart, end: now });
    const constellationData: ConstellationPoint[] = allDays.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const log = logMap.get(dateStr);
      const intensity = log
        ? Math.min(1, log.completedTaskIds.length / Math.max(1, totalTasksPerDay))
        : 0;

      // Find dominant category for this day
      let category: string | undefined;
      if (log && log.completedTaskIds.length > 0) {
        const catCount = new Map<string, number>();
        for (const tid of log.completedTaskIds) {
          const goalId = taskGoalMap.get(tid);
          const cat = goalId ? goalCategoryMap.get(goalId) : undefined;
          if (cat) catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
        }
        let maxCount = 0;
        for (const [cat, count] of catCount) {
          if (count > maxCount) { maxCount = count; category = cat; }
        }
      }

      return {
        date: dateStr,
        intensity,
        dayOfWeek: day.getDay(),
        category,
      };
    });

    return {
      score,
      streakDays,
      longestStreak,
      activeDaysThisMonth,
      completionRate,
      weeklyDelta,
      motivation,
      weeklyActivity,
      constellationData,
    };
  },

  async getCategoryBreakdown(userId: string): Promise<CategoryBreakdown[]> {
    const userGoals = await db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.isArchived, false)));

    const categoryMeta: Record<string, { label: string; emoji: string; color: string }> = {
      health: { label: "Health", emoji: "🏃", color: "#6B8C7A" },
      finance: { label: "Finance", emoji: "💰", color: "#5B7EA6" },
      writing: { label: "Writing", emoji: "✍️", color: "#C4963A" },
      body: { label: "Body", emoji: "⚖️", color: "#B5705B" },
      mindset: { label: "Mindset", emoji: "🧠", color: "#7B6FA0" },
      custom: { label: "Custom", emoji: "⭐", color: "#C4963A" },
    };

    const grouped = new Map<string, typeof userGoals>();
    for (const goal of userGoals) {
      const existing = grouped.get(goal.category) ?? [];
      existing.push(goal);
      grouped.set(goal.category, existing);
    }

    return Array.from(grouped.entries()).map(([category, categoryGoals]) => {
      const meta = categoryMeta[category] ?? {
        label: category,
        emoji: "⭐",
        color: "#C4963A",
      };

      const avgProgress =
        categoryGoals.length > 0
          ? categoryGoals.reduce((total, goal) => {
              return (
                total +
                (goal.targetValue
                  ? Math.min(100, (goal.currentValue / goal.targetValue) * 100)
                  : 0)
              );
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

  async getLifetimeStats(userId: string): Promise<LifetimeStats> {
    const [goalStats, momentCount, progressCount, logCount, user] = await Promise.all([
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

  async getBehaviorIntelligence(
    userId: string,
    lookbackDays = 56
  ): Promise<BehaviorIntelligenceData> {
    const now = new Date();
    const rangeStart = format(subDays(now, lookbackDays - 1), "yyyy-MM-dd");
    const shortRangeStart = subDays(now, 30);

    const [logs, tasks, userRow, progressRows] = await Promise.all([
      db
        .select()
        .from(dailyLogs)
        .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, rangeStart)))
        .orderBy(dailyLogs.date),
      db.select().from(goalTasks).where(eq(goalTasks.userId, userId)),
      db
        .select({ currentStreak: users.currentStreak })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ goalId: progressEntries.goalId, value: progressEntries.value })
        .from(progressEntries)
        .where(
          and(
            eq(progressEntries.userId, userId),
            gte(progressEntries.loggedAt, shortRangeStart)
          )
        ),
    ]);

    const totalTasksPerDay = Math.max(1, tasks.length);
    const completionCounts = logs.map((log) => log.completedTaskIds.length);
    const completionRates = completionCounts.map((count) => count / totalTasksPerDay);

    const loggingRate = clamp(logs.length / Math.max(1, lookbackDays), 0, 1);
    const stabilityRaw =
      1 - clamp(stdDev(completionRates) / Math.max(0.15, average(completionRates)), 0, 1);
    const streakFactor = clamp((userRow?.currentStreak ?? 0) / 14, 0, 1);
    const consistencyScore = Math.round(
      (loggingRate * 0.45 + stabilityRaw * 0.35 + streakFactor * 0.2) * 100
    );

    let recoveryTrials = 0;
    let recoveryWins = 0;
    for (let index = 0; index < logs.length - 1; index++) {
      const current = logs[index]!;
      const next = logs[index + 1]!;
      const currentDone = current.completedTaskIds.length;
      const nextDone = next.completedTaskIds.length;
      const lowMood = current.mood === "low" || current.mood === "anxious";
      const lowSleep =
        current.sleep === "under_5" || current.sleep === "five_to_6";
      const lowOutput = currentDone <= 1;
      if (lowMood || lowSleep || lowOutput) {
        recoveryTrials++;
        if (nextDone >= Math.max(2, currentDone + 1)) {
          recoveryWins++;
        }
      }
    }
    const recoveryScore =
      recoveryTrials > 0 ? Math.round((recoveryWins / recoveryTrials) * 100) : 50;

    const recent14 = completionRates.slice(-14);
    const previous14 = completionRates.slice(-28, -14);
    const recentAvg = average(recent14);
    const previousAvg = average(previous14);
    const trendDeltaPct =
      previous14.length > 0
        ? Math.round(((recentAvg - previousAvg) / Math.max(previousAvg, 0.05)) * 100)
        : 0;

    const intentionDays = logs
      .map((log) => {
        const planned = log.dailyIntentions.length;
        if (planned === 0) return null;
        const completed = log.dailyIntentions.reduce(
          (count, intention) => (intention.done ? count + 1 : count),
          0
        );
        return {
          planned,
          completed,
          completionRatio: completed / Math.max(1, planned),
        };
      })
      .filter((entry): entry is { planned: number; completed: number; completionRatio: number } =>
        entry !== null
      );

    const totalPlannedIntentions = intentionDays.reduce((sum, day) => sum + day.planned, 0);
    const totalCompletedIntentions = intentionDays.reduce((sum, day) => sum + day.completed, 0);
    const followThroughScore =
      intentionDays.length > 0
        ? Math.round((totalCompletedIntentions / Math.max(1, totalPlannedIntentions)) * 100)
        : Math.round(average(completionRates) * 100);

    const completedFromStrongDays = intentionDays
      .filter((day) => day.completionRatio >= 0.6)
      .map((day) => day.completed);
    const completedForTarget =
      completedFromStrongDays.length >= 3
        ? completedFromStrongDays
        : intentionDays.map((day) => day.completed);
    const fallbackTarget = Math.max(1, Math.round(average(completionCounts)));
    const adaptiveDailyTarget = clamp(
      Math.round(percentile(completedForTarget, 0.7) || fallbackTarget || 1),
      1,
      8
    );

    const overloadDays = intentionDays.filter(
      (day) => day.planned >= adaptiveDailyTarget + 2 && day.completionRatio < 0.5
    ).length;
    const overloadRiskScore =
      intentionDays.length > 0
        ? Math.round((overloadDays / intentionDays.length) * 100)
        : 0;

    const riskLevel: BehaviorIntelligenceData["riskLevel"] =
      consistencyScore < 40 || trendDeltaPct < -20 || overloadRiskScore >= 55
        ? "high"
        : consistencyScore < 65 || trendDeltaPct < -8 || overloadRiskScore >= 30
        ? "medium"
        : "low";

    const weekdayBuckets = Array.from({ length: 7 }, () => ({
      samples: 0,
      completionRateTotal: 0,
    }));
    for (const log of logs) {
      const day = parseISO(log.date).getDay();
      weekdayBuckets[day]!.samples += 1;
      weekdayBuckets[day]!.completionRateTotal +=
        log.completedTaskIds.length / totalTasksPerDay;
    }

    const weekdayAverages = weekdayBuckets
      .map((bucket, day) => ({
        day,
        samples: bucket.samples,
        avgRate: bucket.samples > 0 ? bucket.completionRateTotal / bucket.samples : 0,
      }))
      .filter((entry) => entry.samples >= 2);

    const strongestDay = weekdayAverages.reduce(
      (best, entry) => (entry.avgRate > best.avgRate ? entry : best),
      weekdayAverages[0] ?? { day: 1, samples: 0, avgRate: 0 }
    );
    const weakestDay = weekdayAverages.reduce(
      (worst, entry) => (entry.avgRate < worst.avgRate ? entry : worst),
      weekdayAverages[0] ?? { day: 1, samples: 0, avgRate: 0 }
    );

    const bestWeekday = `${WEEKDAY_LABELS[strongestDay.day]} (${Math.round(
      strongestDay.avgRate * 100
    )}%)`;
    const weakestWeekday = `${WEEKDAY_LABELS[weakestDay.day]} (${Math.round(
      weakestDay.avgRate * 100
    )}%)`;

    const checkinWindowStats = new Map<string, { samples: number; rateTotal: number }>();
    for (const windowDef of CHECKIN_WINDOWS) {
      checkinWindowStats.set(windowDef.label, { samples: 0, rateTotal: 0 });
    }
    for (const log of logs) {
      const hour = log.updatedAt.getHours();
      const windowDef = CHECKIN_WINDOWS.find((entry) => entry.test(hour));
      if (!windowDef) continue;
      const bucket = checkinWindowStats.get(windowDef.label);
      if (!bucket) continue;
      bucket.samples += 1;
      bucket.rateTotal += log.completedTaskIds.length / totalTasksPerDay;
    }
    const bestCheckInWindow = Array.from(checkinWindowStats.entries())
      .filter(([, data]) => data.samples > 0)
      .sort((a, b) => b[1].rateTotal / b[1].samples - a[1].rateTotal / a[1].samples)[0]?.[0] ??
      "Morning";
    const bestWindowSamples = checkinWindowStats.get(bestCheckInWindow)?.samples ?? 0;
    const checkInConsistencyScore =
      logs.length > 0 ? Math.round((bestWindowSamples / logs.length) * 100) : 0;

    const goodSleepCompletions = logs
      .filter((log) => log.sleep === "seven_to_8" || log.sleep === "over_8")
      .map((log) => log.completedTaskIds.length);
    const lowSleepCompletions = logs
      .filter((log) => log.sleep === "under_5" || log.sleep === "five_to_6")
      .map((log) => log.completedTaskIds.length);
    const sleepImpactDelta = Math.round(
      (average(goodSleepCompletions) - average(lowSleepCompletions)) * 10
    ) / 10;

    const progressByGoal = new Map<string, number>();
    for (const row of progressRows) {
      if (!row.goalId) continue;
      progressByGoal.set(
        row.goalId,
        (progressByGoal.get(row.goalId) ?? 0) + Math.max(0, row.value)
      );
    }

    const progressValues = Array.from(progressByGoal.values()).filter((value) => value > 0);
    const goalBalanceScore =
      progressValues.length <= 1
        ? 100
        : Math.round(
            (() => {
              const total = progressValues.reduce((sum, value) => sum + value, 0);
              const entropy = progressValues.reduce((sum, value) => {
                const p = value / Math.max(total, 0.01);
                return p > 0 ? sum - p * Math.log(p) : sum;
              }, 0);
              const maxEntropy = Math.log(progressValues.length);
              return clamp(entropy / Math.max(maxEntropy, 0.0001), 0, 1) * 100;
            })()
          );

    const recommendations: string[] = [];
    if (trendDeltaPct <= -10) {
      recommendations.push(
        `Your completion pace is down ${Math.abs(trendDeltaPct)}% versus the prior two weeks. Shrink tomorrow to one must-do intention.`
      );
    }
    if (sleepImpactDelta >= 1) {
      recommendations.push(
        `You complete about ${sleepImpactDelta} more intentions after stronger sleep. Protect one earlier bedtime this week.`
      );
    }
    if (recoveryScore < 45) {
      recommendations.push(
        "After low-energy days, your bounce-back is weaker. Keep a 5-minute recovery task pre-planned for the next morning."
      );
    }
    if (goalBalanceScore < 45) {
      recommendations.push(
        "Progress is concentrated in a narrow slice of goals. Add one lightweight action for an under-served goal today."
      );
    }
    if (followThroughScore < 55) {
      recommendations.push(
        `Your follow-through is ${followThroughScore}%. Keep tomorrow to about ${adaptiveDailyTarget} intentions to protect completion quality.`
      );
    }
    if (overloadRiskScore >= 35) {
      recommendations.push(
        "You tend to overload your day and stall. Cap planned intentions and move extras to tomorrow's list."
      );
    }
    if (checkInConsistencyScore < 45) {
      recommendations.push(
        `Your best check-in window is ${bestCheckInWindow}. Try logging in that window more consistently for steadier momentum.`
      );
    }
    recommendations.push(
      `${bestWeekday} is your strongest day; ${weakestWeekday} needs guardrails. Schedule easier tasks on your weaker day.`
    );

    return {
      consistencyScore,
      recoveryScore,
      trendDeltaPct,
      riskLevel,
      followThroughScore,
      adaptiveDailyTarget,
      overloadRiskScore,
      checkInConsistencyScore,
      bestWeekday,
      weakestWeekday,
      bestCheckInWindow,
      sleepImpactDelta,
      goalBalanceScore,
      recommendations: recommendations.slice(0, 4),
    };
  },

  async getActivityGrid(userId: string): Promise<Record<string, number>> {
    const startDate = format(subDays(new Date(), 364), "yyyy-MM-dd");
    const logs = await db
      .select({ date: dailyLogs.date, completedTaskIds: dailyLogs.completedTaskIds })
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, startDate)));

    const grid: Record<string, number> = {};
    for (const log of logs) {
      grid[log.date] = log.completedTaskIds.length;
    }
    return grid;
  },
};
