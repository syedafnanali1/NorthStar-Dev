import {
  differenceInCalendarDays,
  format,
  startOfMonth,
  subDays,
} from "date-fns";
import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  circleConnections,
  dailyLogs,
  streakProtectionEvents,
  users,
} from "@/drizzle/schema";
import { notificationsService } from "./notifications.service";

type StreakEventType =
  | "freeze_earned"
  | "freeze_used"
  | "ally_vouch_used"
  | "recovery_used";

function dateKey(date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

async function assertFriends(userId: string, otherUserId: string): Promise<boolean> {
  const [link] = await db
    .select({ id: circleConnections.id })
    .from(circleConnections)
    .where(
      and(
        eq(circleConnections.status, "accepted"),
        or(
          and(
            eq(circleConnections.requesterId, userId),
            eq(circleConnections.receiverId, otherUserId)
          ),
          and(
            eq(circleConnections.requesterId, otherUserId),
            eq(circleConnections.receiverId, userId)
          )
        )
      )
    )
    .limit(1);
  return Boolean(link);
}

export const streakProtectionService = {
  async getStatus(userId: string) {
    const monthStart = startOfMonth(new Date());
    const [user, events] = await Promise.all([
      db
        .select({
          currentStreak: users.currentStreak,
          longestStreak: users.longestStreak,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select()
        .from(streakProtectionEvents)
        .where(eq(streakProtectionEvents.userId, userId))
        .orderBy(desc(streakProtectionEvents.createdAt))
        .limit(100),
    ]);

    const freezeEarned = events.filter((e) => e.eventType === "freeze_earned").length;
    const freezeUsed = events.filter((e) => e.eventType === "freeze_used").length;
    const allyUsedThisMonth = events.filter(
      (e) => e.eventType === "ally_vouch_used" && e.createdAt >= monthStart
    ).length;
    const recoveryUsedThisMonth = events.filter(
      (e) => e.eventType === "recovery_used" && e.createdAt >= monthStart
    ).length;

    return {
      currentStreak: user?.currentStreak ?? 0,
      longestStreak: user?.longestStreak ?? 0,
      freezeBalance: Math.max(0, freezeEarned - freezeUsed),
      allyUsedThisMonth,
      recoveryUsedThisMonth,
      events,
    };
  },

  async awardWeeklyFreeze(userId: string) {
    const [user, recentEarned] = await Promise.all([
      db
        .select({ currentStreak: users.currentStreak })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ id: streakProtectionEvents.id })
        .from(streakProtectionEvents)
        .where(
          and(
            eq(streakProtectionEvents.userId, userId),
            eq(streakProtectionEvents.eventType, "freeze_earned"),
            gte(streakProtectionEvents.createdAt, subDays(new Date(), 7))
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

    if (!user) throw new Error("User not found");
    if (user.currentStreak < 7) {
      return { awarded: false, reason: "Need at least a 7-day streak to earn a freeze." };
    }
    if (recentEarned) {
      return { awarded: false, reason: "A freeze was already earned in the last 7 days." };
    }

    await db.insert(streakProtectionEvents).values({
      userId,
      eventType: "freeze_earned",
      note: "Awarded for weekly consistency.",
    });
    return { awarded: true };
  },

  async useFreeze(userId: string, targetDate: string, note?: string) {
    const status = await this.getStatus(userId);
    if (status.freezeBalance <= 0) {
      throw new Error("No streak freezes available.");
    }

    await db.insert(streakProtectionEvents).values({
      userId,
      eventType: "freeze_used",
      targetDate,
      note: note ?? "Used streak freeze",
    });

    await notificationsService.createNotification(
      userId,
      "streak_risk",
      "Streak freeze applied",
      `Your streak freeze protected ${targetDate}.`,
      "/calendar"
    );

    return this.getStatus(userId);
  },

  async useAllyVouch(input: {
    userId: string;
    allyUsername: string;
    targetDate: string;
    note?: string;
  }) {
    const monthStart = startOfMonth(new Date());
    const [monthlyUsage, ally] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(streakProtectionEvents)
        .where(
          and(
            eq(streakProtectionEvents.userId, input.userId),
            eq(streakProtectionEvents.eventType, "ally_vouch_used"),
            gte(streakProtectionEvents.createdAt, monthStart)
          )
        )
        .limit(1)
        .then((rows) => rows[0]?.count ?? 0),
      db
        .select({ id: users.id, name: users.name, username: users.username })
        .from(users)
        .where(eq(users.username, input.allyUsername.toLowerCase()))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

    if (!ally) throw new Error("Ally not found.");
    if (ally.id === input.userId) throw new Error("You cannot vouch for yourself.");
    if (monthlyUsage >= 1) throw new Error("Ally vouch already used this month.");
    if (!(await assertFriends(input.userId, ally.id))) {
      throw new Error("Ally vouch requires an accepted friendship.");
    }

    await db.insert(streakProtectionEvents).values({
      userId: input.userId,
      helperUserId: ally.id,
      eventType: "ally_vouch_used" satisfies StreakEventType,
      targetDate: input.targetDate,
      note: input.note ?? "Ally vouched for this day.",
    });

    await notificationsService.createNotification(
      ally.id,
      "friend_activity",
      "Ally vouch requested",
      "Your friend used your monthly ally vouch.",
      "/calendar"
    );

    return this.getStatus(input.userId);
  },

  async useRecoveryWindow(input: { userId: string; missedDate: string; note: string }) {
    const monthStart = startOfMonth(new Date());
    const [usedThisMonth, logForMissedDay, logForToday, user] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(streakProtectionEvents)
        .where(
          and(
            eq(streakProtectionEvents.userId, input.userId),
            eq(streakProtectionEvents.eventType, "recovery_used"),
            gte(streakProtectionEvents.createdAt, monthStart)
          )
        )
        .limit(1)
        .then((rows) => rows[0]?.count ?? 0),
      db
        .select({ id: dailyLogs.id })
        .from(dailyLogs)
        .where(
          and(
            eq(dailyLogs.userId, input.userId),
            eq(dailyLogs.date, input.missedDate)
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ id: dailyLogs.id })
        .from(dailyLogs)
        .where(
          and(
            eq(dailyLogs.userId, input.userId),
            eq(dailyLogs.date, dateKey())
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({
          currentStreak: users.currentStreak,
          longestStreak: users.longestStreak,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

    if (!user) throw new Error("User not found.");
    if (usedThisMonth >= 1) throw new Error("Recovery window already used this month.");
    if (!logForToday) throw new Error("Log today's entry before using recovery.");
    if (logForMissedDay) throw new Error("Missed date already has a log.");

    const yesterday = subDays(new Date(), 1);
    if (differenceInCalendarDays(new Date(input.missedDate), yesterday) !== 0) {
      throw new Error("Recovery is only available for yesterday's missed day.");
    }

    await db.insert(streakProtectionEvents).values({
      userId: input.userId,
      eventType: "recovery_used",
      targetDate: input.missedDate,
      note: input.note,
    });

    const nextStreak = user.currentStreak + 1;
    await db
      .update(users)
      .set({
        currentStreak: nextStreak,
        longestStreak: Math.max(user.longestStreak, nextStreak),
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId));

    return this.getStatus(input.userId);
  },
};

