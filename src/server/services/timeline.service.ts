import { format, subDays } from "date-fns";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  challengeProgressEntries,
  challenges,
  friendActivityEvents,
  goals,
  moments,
  progressEntries,
  userAchievements,
} from "@/drizzle/schema";
import { ACHIEVEMENTS } from "./achievements.service";

export interface TimelineEvent {
  id: string;
  type:
    | "progress"
    | "moment"
    | "achievement"
    | "friend_activity"
    | "challenge_progress";
  title: string;
  description: string;
  at: string;
  link: string;
  payload?: Record<string, unknown>;
}

function monthDayKey(date: Date): string {
  return format(date, "MM-dd");
}

export const timelineService = {
  async getTimeline(
    userId: string,
    options?: { limit?: number; daysBack?: number; includeFriendFeed?: boolean }
  ): Promise<TimelineEvent[]> {
    const limit = Math.min(Math.max(options?.limit ?? 120, 20), 400);
    const since = subDays(new Date(), Math.max(options?.daysBack ?? 3650, 30));

    const [progressRows, momentRows, achievementRows, friendRows, challengeRows] =
      await Promise.all([
        db
          .select({
            id: progressEntries.id,
            at: progressEntries.loggedAt,
            value: progressEntries.value,
            note: progressEntries.note,
            goalId: progressEntries.goalId,
            goalTitle: goals.title,
          })
          .from(progressEntries)
          .leftJoin(goals, eq(progressEntries.goalId, goals.id))
          .where(
            and(
              eq(progressEntries.userId, userId),
              gte(progressEntries.loggedAt, since)
            )
          )
          .orderBy(desc(progressEntries.loggedAt))
          .limit(limit),
        db
          .select({
            id: moments.id,
            at: moments.createdAt,
            text: moments.text,
            goalId: moments.goalId,
            goalTitle: goals.title,
          })
          .from(moments)
          .leftJoin(goals, eq(moments.goalId, goals.id))
          .where(and(eq(moments.userId, userId), gte(moments.createdAt, since)))
          .orderBy(desc(moments.createdAt))
          .limit(limit),
        db
          .select({
            id: userAchievements.id,
            at: userAchievements.earnedAt,
            key: userAchievements.achievementKey,
          })
          .from(userAchievements)
          .where(
            and(
              eq(userAchievements.userId, userId),
              gte(userAchievements.earnedAt, since)
            )
          )
          .orderBy(desc(userAchievements.earnedAt))
          .limit(limit),
        options?.includeFriendFeed === false
          ? Promise.resolve([] as Array<{
              id: string;
              at: Date;
              type: string;
              payload: Record<string, unknown>;
              link: string | null;
            }>)
          : db
              .select({
                id: friendActivityEvents.id,
                at: friendActivityEvents.createdAt,
                type: friendActivityEvents.type,
                payload: friendActivityEvents.payload,
              })
              .from(friendActivityEvents)
              .where(
                and(
                  eq(friendActivityEvents.actorUserId, userId),
                  gte(friendActivityEvents.createdAt, since)
                )
              )
              .orderBy(desc(friendActivityEvents.createdAt))
              .limit(limit),
        db
          .select({
            id: challengeProgressEntries.id,
            at: challengeProgressEntries.loggedAt,
            value: challengeProgressEntries.value,
            challengeId: challengeProgressEntries.challengeId,
          })
          .from(challengeProgressEntries)
          .where(
            and(
              eq(challengeProgressEntries.userId, userId),
              gte(challengeProgressEntries.loggedAt, since)
            )
          )
          .orderBy(desc(challengeProgressEntries.loggedAt))
          .limit(limit)
          .then(async (rows) => {
            if (rows.length === 0) return [];
            const ids = [...new Set(rows.map((row) => row.challengeId))];
            const challengeRows = await db
              .select({ id: challenges.id, title: challenges.title })
              .from(challenges)
              .where(inArray(challenges.id, ids));
            const titleById = new Map(challengeRows.map((row) => [row.id, row.title]));
            return rows.map((row) => ({
              ...row,
              challengeTitle: titleById.get(row.challengeId) ?? "Challenge",
            }));
          }),
      ]);

    const events: TimelineEvent[] = [];

    for (const row of progressRows) {
      events.push({
        id: row.id,
        type: "progress",
        title: row.goalTitle ? `Progress on ${row.goalTitle}` : "Progress logged",
        description: `${row.value}${row.note ? ` - ${row.note}` : ""}`,
        at: row.at.toISOString(),
        link: row.goalId ? `/goals/${row.goalId}` : "/dashboard",
      });
    }

    for (const row of momentRows) {
      events.push({
        id: row.id,
        type: "moment",
        title: row.goalTitle ? `Moment on ${row.goalTitle}` : "Story moment",
        description: row.text.slice(0, 220),
        at: row.at.toISOString(),
        link: row.goalId ? `/goals/${row.goalId}` : "/dashboard",
      });
    }

    for (const row of achievementRows) {
      const definition = ACHIEVEMENTS.find((item) => item.key === row.key);
      events.push({
        id: row.id,
        type: "achievement",
        title: definition?.title ?? "Achievement unlocked",
        description: definition?.description ?? row.key,
        at: row.at.toISOString(),
        link: "/analytics",
        payload: { achievementKey: row.key },
      });
    }

    for (const row of friendRows) {
      events.push({
        id: row.id,
        type: "friend_activity",
        title: "Friend feed event",
        description: `${row.type} activity captured`,
        at: row.at.toISOString(),
        link: "/circle",
        payload: row.payload,
      });
    }

    for (const row of challengeRows) {
      events.push({
        id: row.id,
        type: "challenge_progress",
        title: `Challenge progress on ${row.challengeTitle}`,
        description: `${row.value} logged`,
        at: row.at.toISOString(),
        link: `/challenges/${row.challengeId}`,
      });
    }

    return events
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, limit);
  },

  async getOnThisDay(userId: string): Promise<TimelineEvent[]> {
    const timeline = await this.getTimeline(userId, {
      limit: 400,
      daysBack: 3650,
      includeFriendFeed: false,
    });
    const todayKey = monthDayKey(new Date());

    return timeline
      .filter((event) => monthDayKey(new Date(event.at)) === todayKey)
      .slice(0, 6);
  },
};
