import { format, startOfDay } from "date-fns";
import { and, eq, gt, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyLogs, notifications, users } from "@/drizzle/schema";
import { analyticsService } from "./analytics.service";
import { notificationsService } from "./notifications.service";

type PreferredWindow = "Morning" | "Afternoon" | "Evening" | "Late Night";

function localHour(now: Date, timezone: string): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(now);
  const hour = Number.parseInt(formatted, 10);
  return Number.isFinite(hour) ? hour : now.getUTCHours();
}

function inWindow(hour: number, preferredWindow: PreferredWindow): boolean {
  if (preferredWindow === "Morning") return hour >= 7 && hour <= 11;
  if (preferredWindow === "Afternoon") return hour >= 12 && hour <= 16;
  if (preferredWindow === "Evening") return hour >= 17 && hour <= 21;
  return hour >= 21 || hour <= 1;
}

export const reengagementService = {
  async runAdaptiveStreakRiskBatch(limit = 300): Promise<{
    processed: number;
    sent: number;
    skipped: number;
  }> {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const dayStart = startOfDay(now);

    const candidates = await db
      .select({
        id: users.id,
        currentStreak: users.currentStreak,
        timezone: users.timezone,
      })
      .from(users)
      .where(and(gt(users.currentStreak, 2), eq(users.pushNotificationsEnabled, true)))
      .limit(limit);

    const todayLogUserIds = new Set(
      (
        await db
          .select({ userId: dailyLogs.userId })
          .from(dailyLogs)
          .where(eq(dailyLogs.date, today))
      ).map((row) => row.userId)
    );

    let sent = 0;
    let skipped = 0;

    for (const user of candidates) {
      if (todayLogUserIds.has(user.id)) {
        skipped += 1;
        continue;
      }

      const [alreadySentToday, preferredWindow] = await Promise.all([
        db
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, user.id),
              eq(notifications.type, "streak_risk"),
              gte(notifications.createdAt, dayStart)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
        analyticsService
          .getBehaviorIntelligence(user.id, 56)
          .then((behavior) => behavior.bestCheckInWindow as PreferredWindow)
          .catch(() => "Evening" as PreferredWindow),
      ]);

      if (alreadySentToday) {
        skipped += 1;
        continue;
      }

      const hour = localHour(now, user.timezone ?? "UTC");
      const preferred = preferredWindow ?? "Evening";
      if (!inWindow(hour, preferred) && !(hour >= 21 && hour <= 23)) {
        skipped += 1;
        continue;
      }

      await notificationsService.createAdaptiveNotification(
        user.id,
        "streak_risk",
        "Streak at risk",
        `No log yet today. Add one entry before midnight to protect your ${user.currentStreak}-day streak.`,
        "/calendar",
        preferred
      );
      sent += 1;
    }

    return {
      processed: candidates.length,
      sent,
      skipped,
    };
  },
};

