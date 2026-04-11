import { addHours } from "date-fns";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { circleConnections, goalStories, goals, users } from "@/drizzle/schema";

async function getCircleUserIds(userId: string): Promise<string[]> {
  const links = await db
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

  return [
    userId,
    ...links.map((row) =>
      row.requesterId === userId ? row.receiverId : row.requesterId
    ),
  ];
}

export const storiesService = {
  async createStory(input: {
    userId: string;
    goalId: string;
    text?: string;
    mediaUrl?: string;
    mediaType?: "image" | "video";
  }) {
    const [goal] = await db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.id, input.goalId), eq(goals.userId, input.userId)))
      .limit(1);
    if (!goal) throw new Error("Goal not found");

    if (!input.text?.trim() && !input.mediaUrl?.trim()) {
      throw new Error("Story requires text or media.");
    }

    const [story] = await db
      .insert(goalStories)
      .values({
        userId: input.userId,
        goalId: input.goalId,
        text: input.text?.trim() ?? null,
        mediaUrl: input.mediaUrl?.trim() ?? null,
        mediaType: input.mediaType ?? (input.mediaUrl ? "image" : null),
        expiresAt: addHours(new Date(), 24),
      })
      .returning();

    if (!story) throw new Error("Failed to create story");
    return story;
  },

  async listGoalStories(goalId: string, userId: string) {
    return db
      .select()
      .from(goalStories)
      .where(
        and(
          eq(goalStories.goalId, goalId),
          eq(goalStories.userId, userId),
          eq(goalStories.isArchived, false),
          sql`${goalStories.expiresAt} > now()`
        )
      )
      .orderBy(desc(goalStories.createdAt));
  },

  async listStoryFeed(userId: string, limit = 80) {
    const ids = await getCircleUserIds(userId);
    if (ids.length === 0) return [];

    return db
      .select({
        story: goalStories,
        author: {
          id: users.id,
          name: users.name,
          username: users.username,
          image: users.image,
        },
        goal: {
          id: goals.id,
          title: goals.title,
          emoji: goals.emoji,
          color: goals.color,
        },
      })
      .from(goalStories)
      .leftJoin(users, eq(goalStories.userId, users.id))
      .leftJoin(goals, eq(goalStories.goalId, goals.id))
      .where(
        and(
          inArray(goalStories.userId, ids),
          eq(goalStories.isArchived, false),
          sql`${goalStories.expiresAt} > now()`
        )
      )
      .orderBy(desc(goalStories.createdAt))
      .limit(Math.min(limit, 120));
  },

  async archiveStory(storyId: string, userId: string): Promise<void> {
    await db
      .update(goalStories)
      .set({ isArchived: true })
      .where(and(eq(goalStories.id, storyId), eq(goalStories.userId, userId)));
  },

  async expireStories(): Promise<{ expired: number }> {
    const expired = await db
      .update(goalStories)
      .set({ isArchived: true })
      .where(
        and(
          eq(goalStories.isArchived, false),
          sql`${goalStories.expiresAt} <= now()`
        )
      )
      .returning({ id: goalStories.id });
    return { expired: expired.length };
  },
};

