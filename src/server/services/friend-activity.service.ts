import { db } from "@/lib/db";
import {
  circleConnections,
  friendActivityEvents,
  friendActivityTypeEnum,
  users,
} from "@/drizzle/schema";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { notificationsService } from "./notifications.service";

type FriendActivityType = (typeof friendActivityTypeEnum.enumValues)[number];

export interface FriendActivityFeedItem {
  id: string;
  type: FriendActivityType;
  createdAt: Date;
  payload: Record<string, unknown>;
  actor: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
    level: number;
    northStarScore: number;
  };
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function textForType(type: FriendActivityType): { title: string; body: string } {
  if (type === "goal_completed") {
    return {
      title: "Friend completed a goal",
      body: "A friend just completed one of their goals. Celebrate the win.",
    };
  }
  if (type === "goal_milestone") {
    return {
      title: "Friend hit a milestone",
      body: "A friend reached a meaningful milestone. Drop a quick celebration.",
    };
  }
  if (type === "challenge_completed") {
    return {
      title: "Friend finished a challenge",
      body: "A friend completed a challenge. Check the leaderboard.",
    };
  }
  return {
    title: "Friend activity",
    body: "A friend shared a new progress update.",
  };
}

export const friendActivityService = {
  async getAcceptedFriendIds(userId: string): Promise<string[]> {
    const rows = await db
      .select({
        requesterId: circleConnections.requesterId,
        receiverId: circleConnections.receiverId,
      })
      .from(circleConnections)
      .where(
        and(
          eq(circleConnections.status, "accepted"),
          or(
            eq(circleConnections.requesterId, userId),
            eq(circleConnections.receiverId, userId)
          )
        )
      );

    return uniqueIds(
      rows.map((row) => (row.requesterId === userId ? row.receiverId : row.requesterId))
    );
  },

  async emitActivity(input: {
    actorUserId: string;
    type: FriendActivityType;
    goalId?: string | null;
    challengeId?: string | null;
    payload?: Record<string, unknown>;
    notifyFriends?: boolean;
    link?: string;
  }): Promise<void> {
    await db.insert(friendActivityEvents).values({
      actorUserId: input.actorUserId,
      type: input.type,
      goalId: input.goalId ?? null,
      challengeId: input.challengeId ?? null,
      payload: input.payload ?? {},
    });

    if (!input.notifyFriends) return;

    const [actor, friendIds] = await Promise.all([
      db
        .select({
          name: users.name,
          username: users.username,
        })
        .from(users)
        .where(eq(users.id, input.actorUserId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      this.getAcceptedFriendIds(input.actorUserId),
    ]);

    if (friendIds.length === 0) return;

    const base = textForType(input.type);
    const actorName =
      actor?.name ?? (actor?.username ? `@${actor.username}` : "Your friend");
    const notificationType =
      input.type === "goal_milestone" ||
      input.type === "goal_completed" ||
      input.type === "challenge_completed" ||
      input.type === "group_milestone"
        ? "friend_milestone"
        : "friend_activity";
    const title = base.title;
    const body =
      input.payload?.["message"] && typeof input.payload["message"] === "string"
        ? `${actorName}: ${input.payload["message"]}`
        : `${actorName}. ${base.body}`;

    await Promise.all(
      friendIds.map((friendId) =>
        notificationsService.createNotification(
          friendId,
          notificationType,
          title,
          body,
          input.link ?? "/circle"
        )
      )
    );
  },

  async getFeedForUser(userId: string, limit = 30): Promise<FriendActivityFeedItem[]> {
    const friendIds = await this.getAcceptedFriendIds(userId);
    if (friendIds.length === 0) return [];

    const rows = await db
      .select({
        event: friendActivityEvents,
        actor: {
          id: users.id,
          name: users.name,
          username: users.username,
          image: users.image,
          level: users.level,
          northStarScore: users.northStarScore,
        },
      })
      .from(friendActivityEvents)
      .innerJoin(users, eq(friendActivityEvents.actorUserId, users.id))
      .where(inArray(friendActivityEvents.actorUserId, friendIds))
      .orderBy(desc(friendActivityEvents.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.event.id,
      type: row.event.type,
      createdAt: row.event.createdAt,
      payload: row.event.payload ?? {},
      actor: row.actor,
    }));
  },
};
