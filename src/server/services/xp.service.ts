// src/server/services/xp.service.ts
// XP / Leveling system for North Star

import { subDays } from "date-fns";
import { and, count, eq, gte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  circleConnections,
  circlePosts,
  comments,
  goals,
  notifications,
  postReactions,
  postReplies,
  users,
} from "@/drizzle/schema";

// XP Award Table
export const AWARD_TABLE = {
  log_progress: 10,
  complete_task: 5,
  write_moment: 15,
  complete_goal: 100,
  streak_7: 50,
  streak_30: 200,
  post_checkin: 8,
  react_to_post: 2,
  invite_friend: 75,
  join_group_goal: 20,
  complete_challenge: 50,
} as const;

export type XpAction = keyof typeof AWARD_TABLE;

// Level thresholds:
// L1=0, L2=100, L3=250, L4=500, L5=900, L6=1400, L7=2000, L8=2700, L9=3500, L10=4500
// L11+ each requires previous + 1000*(level-9)
const BASE_LEVELS = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4500];

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= BASE_LEVELS.length) return BASE_LEVELS[level - 1]!;
  const base = BASE_LEVELS[BASE_LEVELS.length - 1]!;
  const extra = level - BASE_LEVELS.length;
  return base + extra * 1000;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) {
    level++;
    if (level >= 100) break;
  }
  return level;
}

export function nextLevelXp(currentLevel: number): number {
  return xpForLevel(currentLevel + 1);
}

export const xpService = {
  async awardXP(
    userId: string,
    action: XpAction
  ): Promise<{ xp: number; newLevel: number; leveledUp: boolean }> {
    const amount = AWARD_TABLE[action];

    const [user] = await db
      .select({ xpPoints: users.xpPoints, level: users.level })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return { xp: amount, newLevel: 1, leveledUp: false };

    const newXp = user.xpPoints + amount;
    const newLevel = levelForXp(newXp);
    const leveledUp = newLevel > user.level;

    await db
      .update(users)
      .set({ xpPoints: newXp, level: newLevel })
      .where(eq(users.id, userId));

    if (leveledUp) {
      await db.insert(notifications).values({
        userId,
        type: "level_up",
        title: `Level ${newLevel} Reached!`,
        body: `You reached Level ${newLevel}! Keep compounding.`,
      });
    }

    return { xp: amount, newLevel, leveledUp };
  },

  async calculateNorthStarScore(userId: string): Promise<number> {
    const now = new Date();
    const monthAgo = subDays(now, 30);

    const [user] = await db
      .select({
        currentStreak: users.currentStreak,
        xpPoints: users.xpPoints,
        totalGoalsCompleted: users.totalGoalsCompleted,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return 0;

    const [totalGoalsRow] = await db
      .select({ count: count() })
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.isArchived, false)));
    const totalGoals = totalGoalsRow?.count ?? 0;
    const goalCompletionRate =
      totalGoals > 0 ? user.totalGoalsCompleted / totalGoals : 0;

    // Social engagement signal (last 30 days)
    const [postCount, reactionCount, replyCount, commentCount, connectionCount] =
      await Promise.all([
        db
          .select({ count: count() })
          .from(circlePosts)
          .where(and(eq(circlePosts.userId, userId), gte(circlePosts.createdAt, monthAgo)))
          .then((rows) => rows[0]?.count ?? 0),
        db
          .select({ count: count() })
          .from(postReactions)
          .where(and(eq(postReactions.userId, userId), gte(postReactions.createdAt, monthAgo)))
          .then((rows) => rows[0]?.count ?? 0),
        db
          .select({ count: count() })
          .from(postReplies)
          .where(and(eq(postReplies.userId, userId), gte(postReplies.createdAt, monthAgo)))
          .then((rows) => rows[0]?.count ?? 0),
        db
          .select({ count: count() })
          .from(comments)
          .where(and(eq(comments.userId, userId), gte(comments.createdAt, monthAgo)))
          .then((rows) => rows[0]?.count ?? 0),
        db
          .select({ count: count() })
          .from(circleConnections)
          .where(
            and(
              eq(circleConnections.status, "accepted"),
              gte(circleConnections.updatedAt, monthAgo),
              or(
                eq(circleConnections.requesterId, userId),
                eq(circleConnections.receiverId, userId)
              )
            )
          )
          .then((rows) => rows[0]?.count ?? 0),
      ]);

    const socialRaw =
      postCount * 14 +
      reactionCount * 3 +
      replyCount * 6 +
      commentCount * 6 +
      connectionCount * 12;

    // Composite 0-1000: streak + completion + social + xp
    const streakScore = Math.min(250, user.currentStreak * 8);
    const completionScore = Math.round(goalCompletionRate * 250);
    const socialScore = Math.min(250, socialRaw);
    const xpScore = Math.min(250, Math.round(user.xpPoints / 20));
    const score = Math.round(streakScore + completionScore + socialScore + xpScore);

    await db
      .update(users)
      .set({ northStarScore: score })
      .where(eq(users.id, userId));

    return score;
  },

  async getUserLevel(
    userId: string
  ): Promise<{ level: number; xpPoints: number; nextLevelXp: number }> {
    const [user] = await db
      .select({ level: users.level, xpPoints: users.xpPoints })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const level = user?.level ?? 1;
    const xp = user?.xpPoints ?? 0;
    return { level, xpPoints: xp, nextLevelXp: nextLevelXp(level) };
  },
};

