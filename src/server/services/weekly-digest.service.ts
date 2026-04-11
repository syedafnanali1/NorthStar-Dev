import { format, subDays } from "date-fns";
import { and, eq, gte, lte } from "drizzle-orm";
import { dailyLogs, goals, goalTasks, progressEntries, users } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { emailService } from "@/lib/email";
import { notificationsService } from "./notifications.service";
import { aiCoachService } from "./ai-coach.service";
import { analyticsService } from "./analytics.service";

type CorrelationInsight = { insight: string; confidence: number };

export interface WeeklyDigestSummary {
  rangeLabel: string;
  daysLogged: number;
  streakDays: number;
  totalTasksCompleted: number;
  completionRate: number;
  topGoal: {
    id: string;
    title: string;
    progress: number;
    unit: string | null;
  } | null;
  atRiskGoals: Array<{ id: string; title: string }>;
  moodTrend: string;
  sleepTrend: string;
  correlations: CorrelationInsight[];
  suggestions: string[];
}

function labelFromMood(mood: string | null | undefined): string | null {
  if (!mood) return null;
  const map: Record<string, string> = {
    energized: "Energized",
    good: "Good",
    neutral: "Neutral",
    tired: "Tired",
    low: "Low",
    focused: "Focused",
    anxious: "Anxious",
  };
  return map[mood] ?? mood;
}

function labelFromSleep(sleep: string | null | undefined): string | null {
  if (!sleep) return null;
  const map: Record<string, string> = {
    under_5: "Under 5h",
    five_to_6: "5-6h",
    six_to_7: "6-7h",
    seven_to_8: "7-8h",
    over_8: "8h+",
  };
  return map[sleep] ?? sleep;
}

function topValue<T>(values: T[], keyFn: (value: T) => string | null): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = keyFn(value);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = "";
  let max = -1;
  for (const [key, count] of counts.entries()) {
    if (count > max) {
      best = key;
      max = count;
    }
  }
  return best || "Not enough data yet";
}

function makeSuggestions(input: {
  completionRate: number;
  streakDays: number;
  lowMoodDays: number;
  lowSleepDays: number;
  atRiskGoals: Array<{ id: string; title: string }>;
  topGoalTitle: string | null;
}): string[] {
  const tips: string[] = [];

  if (input.completionRate < 40) {
    tips.push("Reduce today's focus to your top 3 intentions so your wins stay realistic.");
  }

  if (input.streakDays < 3) {
    tips.push("Protect your streak with one 5-minute action you can finish immediately.");
  }

  if (input.lowSleepDays >= 3) {
    tips.push("Sleep has been low this week. Aim for one earlier bedtime to boost follow-through tomorrow.");
  }

  if (input.lowMoodDays >= 2) {
    tips.push("Energy looks uneven. Start tomorrow with your easiest high-value task to rebuild momentum.");
  }

  if (input.atRiskGoals.length > 0) {
    tips.push(`Log a small progress entry for "${input.atRiskGoals[0]!.title}" today so it does not drift.`);
  }

  if (tips.length === 0 && input.topGoalTitle) {
    tips.push(`You are in rhythm. Keep your current routine and raise "${input.topGoalTitle}" by one small stretch step.`);
  }

  if (tips.length === 0) {
    tips.push("You are trending well. Keep daily check-ins simple and consistent this week.");
  }

  return tips.slice(0, 3);
}

function asDigestText(summary: WeeklyDigestSummary): string {
  const topGoalLine = summary.topGoal
    ? `Top win: ${summary.topGoal.title} (+${summary.topGoal.progress}${summary.topGoal.unit ? ` ${summary.topGoal.unit}` : ""}).`
    : "Top win: Keep logging progress to surface your strongest goal.";
  const focus = summary.suggestions[0] ?? "Keep one small action visible for today.";
  return `Weekly summary: ${summary.daysLogged} logged days, ${summary.totalTasksCompleted} completed intentions, ${summary.completionRate}% completion, ${summary.streakDays}-day streak. ${topGoalLine} Next focus: ${focus}`;
}

export const weeklyDigestService = {
  async getWeeklyDigestSummary(userId: string): Promise<WeeklyDigestSummary> {
    const end = new Date();
    const start = subDays(end, 6);
    const startKey = format(start, "yyyy-MM-dd");
    const endKey = format(end, "yyyy-MM-dd");

    const [user, activeGoals, tasks, logs, progress] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          currentStreak: users.currentStreak,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({
          id: goals.id,
          title: goals.title,
          unit: goals.unit,
          isCompleted: goals.isCompleted,
        })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.isArchived, false))),
      db
        .select({
          id: goalTasks.id,
          goalId: goalTasks.goalId,
        })
        .from(goalTasks)
        .where(eq(goalTasks.userId, userId)),
      db
        .select()
        .from(dailyLogs)
        .where(
          and(
            eq(dailyLogs.userId, userId),
            gte(dailyLogs.date, startKey),
            lte(dailyLogs.date, endKey)
          )
        ),
      db
        .select()
        .from(progressEntries)
        .where(and(eq(progressEntries.userId, userId), gte(progressEntries.loggedAt, start))),
    ]);

    if (!user) {
      throw new Error("User not found");
    }

    const tasksPerDay = tasks.length;
    const totalTasksCompleted = logs.reduce(
      (sum, log) => sum + (Array.isArray(log.completedTaskIds) ? log.completedTaskIds.length : 0),
      0
    );
    const completionRate =
      tasksPerDay > 0 ? Math.round((totalTasksCompleted / (tasksPerDay * 7)) * 100) : 0;

    const goalById = new Map(activeGoals.map((goal) => [goal.id, goal]));
    const progressByGoal = new Map<string, number>();
    for (const entry of progress) {
      if (!entry.goalId) continue;
      progressByGoal.set(entry.goalId, (progressByGoal.get(entry.goalId) ?? 0) + entry.value);
    }

    let topGoal: WeeklyDigestSummary["topGoal"] = null;
    for (const [goalId, amount] of progressByGoal.entries()) {
      const goal = goalById.get(goalId);
      if (!goal) continue;
      if (!topGoal || amount > topGoal.progress) {
        topGoal = {
          id: goalId,
          title: goal.title,
          progress: Math.round(amount * 100) / 100,
          unit: goal.unit ?? null,
        };
      }
    }

    const goalTasksMap = new Map<string, string[]>();
    for (const task of tasks) {
      const current = goalTasksMap.get(task.goalId) ?? [];
      current.push(task.id);
      goalTasksMap.set(task.goalId, current);
    }

    const completedTaskSet = new Set<string>();
    for (const log of logs) {
      for (const taskId of log.completedTaskIds) {
        completedTaskSet.add(taskId);
      }
    }

    const atRiskGoals = activeGoals
      .filter((goal) => !goal.isCompleted)
      .filter((goal) => {
        if ((progressByGoal.get(goal.id) ?? 0) > 0) return false;
        const relatedTasks = goalTasksMap.get(goal.id) ?? [];
        return !relatedTasks.some((taskId) => completedTaskSet.has(taskId));
      })
      .slice(0, 3)
      .map((goal) => ({ id: goal.id, title: goal.title }));

    const moodTrend = topValue(logs, (log) => labelFromMood(log.mood));
    const sleepTrend = topValue(logs, (log) => labelFromSleep(log.sleep));
    const lowMoodDays = logs.filter((log) => log.mood === "low" || log.mood === "anxious").length;
    const lowSleepDays = logs.filter(
      (log) => log.sleep === "under_5" || log.sleep === "five_to_6"
    ).length;

    let correlations: CorrelationInsight[] = [];
    try {
      correlations = await aiCoachService.detectCorrelations(userId);
    } catch {
      correlations = [];
    }

    const baseSuggestions = makeSuggestions({
      completionRate,
      streakDays: user.currentStreak ?? 0,
      lowMoodDays,
      lowSleepDays,
      atRiskGoals,
      topGoalTitle: topGoal?.title ?? null,
    });

    let behaviorSuggestions: string[] = [];
    try {
      const behavior = await analyticsService.getBehaviorIntelligence(userId, 56);
      behaviorSuggestions = behavior.recommendations.slice(0, 2);
    } catch {
      behaviorSuggestions = [];
    }

    const suggestions = Array.from(
      new Set([...baseSuggestions, ...behaviorSuggestions])
    ).slice(0, 4);

    return {
      rangeLabel: `${format(start, "MMM d")} - ${format(end, "MMM d")}`,
      daysLogged: logs.length,
      streakDays: user.currentStreak ?? 0,
      totalTasksCompleted,
      completionRate,
      topGoal,
      atRiskGoals,
      moodTrend,
      sleepTrend,
      correlations,
      suggestions,
    };
  },

  async deliverWeeklyDigestToUser(userId: string): Promise<WeeklyDigestSummary> {
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    const summary = await this.getWeeklyDigestSummary(userId);

    let coachMessage = asDigestText(summary);
    try {
      coachMessage = await aiCoachService.generateWeeklyReview(userId);
    } catch (err) {
      console.error("[weekly-digest ai-review]", err);
    }

    await notificationsService.createNotification(
      userId,
      "weekly_review",
      "Your Monday AI coaching review is ready",
      coachMessage.replace(/\s+/g, " ").slice(0, 180),
      "/dashboard"
    );

    if (user.email) {
      try {
        await emailService.sendWeeklyDigest({
          to: user.email,
          name: user.name ?? "there",
          summary,
          coachMessage,
        });
      } catch (err) {
        console.error("[weekly-digest email]", err);
      }
    }

    return summary;
  },

  async runWeeklyDigestBatch(limit = 200): Promise<{
    processed: number;
    delivered: number;
    failed: number;
  }> {
    const targets = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.aiCoachingEnabled, true))
      .limit(limit);

    let delivered = 0;
    let failed = 0;

    for (const target of targets) {
      try {
        await this.deliverWeeklyDigestToUser(target.id);
        delivered++;
      } catch (err) {
        failed++;
        console.error("[weekly-digest batch]", target.id, err);
      }
    }

    return {
      processed: targets.length,
      delivered,
      failed,
    };
  },
};
