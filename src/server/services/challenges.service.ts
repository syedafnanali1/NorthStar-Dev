import { addDays, endOfWeek, format, startOfWeek } from "date-fns";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  lte,
  gte,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  challengeParticipants,
  challengeProgressEntries,
  challenges,
  users,
} from "@/drizzle/schema";
import { notificationsService } from "./notifications.service";
import { friendActivityService } from "./friend-activity.service";
import { xpService } from "./xp.service";

type GoalCategory = "health" | "finance" | "writing" | "body" | "mindset" | "custom";

export interface CreateChallengeInput {
  title: string;
  description?: string;
  category?: GoalCategory;
  targetValue: number;
  unit: string;
  startDate: string;
  endDate: string;
  isPublic?: boolean;
  isSponsored?: boolean;
  sponsorName?: string;
  sponsorPrize?: string;
  isAiMicro?: boolean;
}

export interface ChallengeWithStats {
  id: string;
  title: string;
  description: string | null;
  category: GoalCategory;
  targetValue: number;
  unit: string;
  startDate: Date;
  endDate: Date;
  status: "upcoming" | "active" | "completed" | "archived";
  isPublic: boolean;
  isSponsored: boolean;
  sponsorName: string | null;
  sponsorPrize: string | null;
  isAiMicro: boolean;
  participantCount: number;
  joined: boolean;
  viewerProgress: number;
}

export interface ChallengeLeaderboardRow {
  rank: number;
  userId: string;
  name: string | null;
  username: string | null;
  image: string | null;
  value: number;
  completedAt: Date | null;
}

function computeStatus(challenge: {
  status: "upcoming" | "active" | "completed" | "archived";
  startDate: Date;
  endDate: Date;
}): "upcoming" | "active" | "completed" | "archived" {
  if (challenge.status === "archived") return "archived";
  const now = Date.now();
  if (challenge.endDate.getTime() < now) return "completed";
  if (challenge.startDate.getTime() <= now) return "active";
  return "upcoming";
}

async function refreshStatuses(): Promise<void> {
  const now = new Date();
  await db
    .update(challenges)
    .set({ status: "active", updatedAt: now })
    .where(
      and(
        eq(challenges.status, "upcoming"),
        lte(challenges.startDate, now),
        gte(challenges.endDate, now)
      )
    );

  await db
    .update(challenges)
    .set({ status: "completed", updatedAt: now })
    .where(
      and(
        or(eq(challenges.status, "upcoming"), eq(challenges.status, "active")),
        lt(challenges.endDate, now)
      )
    );
}

export const challengesService = {
  async createChallenge(userId: string, input: CreateChallengeInput) {
    const now = new Date();
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error("Invalid challenge dates");
    }
    if (endDate <= startDate) {
      throw new Error("Challenge end date must be after start date");
    }
    if (input.targetValue <= 0) {
      throw new Error("Challenge targetValue must be positive");
    }

    const [challenge] = await db
      .insert(challenges)
      .values({
        creatorId: userId,
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? "custom",
        targetValue: input.targetValue,
        unit: input.unit,
        startDate,
        endDate,
        isPublic: input.isPublic ?? true,
        isSponsored: input.isSponsored ?? false,
        sponsorName: input.sponsorName ?? null,
        sponsorPrize: input.sponsorPrize ?? null,
        isAiMicro: input.isAiMicro ?? false,
        status: computeStatus({
          status: "upcoming",
          startDate,
          endDate,
        }),
        updatedAt: now,
      })
      .returning();

    if (!challenge) throw new Error("Failed to create challenge");

    await db
      .insert(challengeParticipants)
      .values({
        challengeId: challenge.id,
        userId,
      })
      .onConflictDoNothing();

    return challenge;
  },

  async listChallenges(userId: string, options?: { status?: string; limit?: number }) {
    await refreshStatuses();
    const limit = Math.min(options?.limit ?? 40, 100);
    const statusFilter = options?.status;

    const joinedRows = await db
      .select({
        challengeId: challengeParticipants.challengeId,
        currentValue: challengeParticipants.currentValue,
      })
      .from(challengeParticipants)
      .where(eq(challengeParticipants.userId, userId));
    const joinedById = new Map(joinedRows.map((row) => [row.challengeId, row.currentValue]));

    const rows = await db
      .select()
      .from(challenges)
      .where(
        and(
          or(
            eq(challenges.isPublic, true),
            eq(challenges.creatorId, userId),
            sql`${challenges.id} IN (SELECT ${challengeParticipants.challengeId} FROM ${challengeParticipants} WHERE ${challengeParticipants.userId} = ${userId})`
          ),
          statusFilter
            ? eq(
                challenges.status,
                statusFilter as "upcoming" | "active" | "completed" | "archived"
              )
            : sql`true`
        )
      )
      .orderBy(desc(challenges.createdAt))
      .limit(limit);

    if (rows.length === 0) return [] as ChallengeWithStats[];

    const ids = rows.map((row) => row.id);
    const counts = await db
      .select({
        challengeId: challengeParticipants.challengeId,
        count: sql<number>`count(*)`,
      })
      .from(challengeParticipants)
      .where(inArray(challengeParticipants.challengeId, ids))
      .groupBy(challengeParticipants.challengeId);
    const countById = new Map(counts.map((row) => [row.challengeId, row.count]));

    return rows.map((row) => ({
      ...row,
      participantCount: countById.get(row.id) ?? 0,
      joined: joinedById.has(row.id),
      viewerProgress: joinedById.get(row.id) ?? 0,
    }));
  },

  async getChallenge(challengeId: string, userId: string) {
    await refreshStatuses();
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);
    if (!challenge) return null;

    const [viewer] = await db
      .select({
        id: challengeParticipants.id,
        currentValue: challengeParticipants.currentValue,
      })
      .from(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.challengeId, challengeId),
          eq(challengeParticipants.userId, userId)
        )
      )
      .limit(1);

    if (!challenge.isPublic && challenge.creatorId !== userId && !viewer) {
      throw new Error("You do not have access to this challenge");
    }

    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(challengeParticipants)
      .where(eq(challengeParticipants.challengeId, challengeId));

    const leaderboard = await this.getLeaderboard(challengeId, 20);
    return {
      ...challenge,
      participantCount: countRow?.count ?? 0,
      joined: Boolean(viewer),
      viewerProgress: viewer?.currentValue ?? 0,
      leaderboard,
    };
  },

  async joinChallenge(challengeId: string, userId: string) {
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.status === "archived") throw new Error("Challenge is archived");
    if (challenge.endDate < new Date()) throw new Error("Challenge already ended");

    await db
      .insert(challengeParticipants)
      .values({ challengeId, userId })
      .onConflictDoNothing();

    await friendActivityService.emitActivity({
      actorUserId: userId,
      type: "challenge_joined",
      challengeId,
      payload: { challengeTitle: challenge.title },
      notifyFriends: false,
      link: `/challenges/${challengeId}`,
    });

    return { success: true };
  },

  async logProgress(challengeId: string, userId: string, value: number, note?: string) {
    if (value <= 0) throw new Error("Progress value must be positive");

    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);
    if (!challenge) throw new Error("Challenge not found");

    if (challenge.status === "archived" || challenge.endDate < new Date()) {
      throw new Error("Challenge is no longer active");
    }

    await db
      .insert(challengeParticipants)
      .values({ challengeId, userId })
      .onConflictDoNothing();

    await db.insert(challengeProgressEntries).values({
      challengeId,
      userId,
      value,
      note: note ?? null,
    });

    const [participant] = await db
      .select({
        id: challengeParticipants.id,
        currentValue: challengeParticipants.currentValue,
        completedAt: challengeParticipants.completedAt,
      })
      .from(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.challengeId, challengeId),
          eq(challengeParticipants.userId, userId)
        )
      )
      .limit(1);

    if (!participant) throw new Error("Failed to join challenge");
    const newValue = participant.currentValue + value;
    const completedAt =
      !participant.completedAt && newValue >= challenge.targetValue
        ? new Date()
        : participant.completedAt;

    await db
      .update(challengeParticipants)
      .set({
        currentValue: newValue,
        completedAt: completedAt ?? null,
      })
      .where(eq(challengeParticipants.id, participant.id));

    if (!participant.completedAt && completedAt) {
      void xpService.awardXP(userId, "complete_challenge");
      await friendActivityService.emitActivity({
        actorUserId: userId,
        type: "challenge_completed",
        challengeId,
        payload: {
          challengeTitle: challenge.title,
          message: `completed challenge "${challenge.title}"`,
        },
        notifyFriends: true,
        link: `/challenges/${challengeId}`,
      });
    }

    const leaderboard = await this.getLeaderboard(challengeId, 10);
    const rank = leaderboard.find((row) => row.userId === userId)?.rank ?? null;
    if (rank && rank <= 3) {
      await notificationsService.createNotification(
        userId,
        "challenge_rank",
        "Leaderboard update",
        `You are currently #${rank} in "${challenge.title}".`,
        `/challenges/${challengeId}`
      );
    }

    return { challengeId, currentValue: newValue, completedAt, rank };
  },

  async getLeaderboard(challengeId: string, limit = 50): Promise<ChallengeLeaderboardRow[]> {
    const rows = await db
      .select({
        userId: challengeParticipants.userId,
        currentValue: challengeParticipants.currentValue,
        completedAt: challengeParticipants.completedAt,
        name: users.name,
        username: users.username,
        image: users.image,
      })
      .from(challengeParticipants)
      .innerJoin(users, eq(challengeParticipants.userId, users.id))
      .where(eq(challengeParticipants.challengeId, challengeId))
      .orderBy(
        desc(challengeParticipants.currentValue),
        asc(challengeParticipants.completedAt),
        asc(challengeParticipants.joinedAt)
      )
      .limit(limit);

    return rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      name: row.name,
      username: row.username,
      image: row.image,
      value: row.currentValue,
      completedAt: row.completedAt,
    }));
  },

  async generateWeeklyMicroChallenges(limitUsers = 120): Promise<{
    processed: number;
    created: number;
  }> {
    await refreshStatuses();
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const weekKey = format(weekStart, "yyyy-'W'II");

    const candidates = await db
      .select({
        id: users.id,
        currentStreak: users.currentStreak,
      })
      .from(users)
      .where(eq(users.aiCoachingEnabled, true))
      .limit(limitUsers);

    let created = 0;
    for (const user of candidates) {
      const targetStreak = user.currentStreak < 25 ? 7 : 30;
      const missing = Math.max(1, targetStreak - user.currentStreak);
      const title =
        targetStreak === 30
          ? `Week ${weekKey}: You're ${missing} day(s) from a 30-day streak`
          : `Week ${weekKey}: Extend your streak by ${missing} day(s)`;

      const [existing] = await db
        .select({ id: challenges.id })
        .from(challenges)
        .where(
          and(
            eq(challenges.isAiMicro, true),
            eq(challenges.title, title),
            gte(challenges.endDate, addDays(now, -1)),
            sql`${challenges.id} IN (SELECT ${challengeParticipants.challengeId} FROM ${challengeParticipants} WHERE ${challengeParticipants.userId} = ${user.id})`
          )
        )
        .limit(1);

      if (existing) continue;

      const [challenge] = await db
        .insert(challenges)
        .values({
          creatorId: null,
          title,
          description:
            targetStreak === 30
              ? `You're ${missing} day(s) away from a 30-day streak. Finish it this week.`
              : `Build consistency this week with ${missing} additional check-in day(s).`,
          category: "mindset",
          targetValue: missing,
          unit: "streak_days",
          startDate: weekStart,
          endDate: weekEnd,
          isPublic: false,
          isSponsored: false,
          isAiMicro: true,
          status: "active",
          updatedAt: now,
        })
        .returning({ id: challenges.id, title: challenges.title });

      if (!challenge) continue;

      await db
        .insert(challengeParticipants)
        .values({ challengeId: challenge.id, userId: user.id })
        .onConflictDoNothing();

      await notificationsService.createNotification(
        user.id,
        "challenge_update",
        "Your weekly AI micro-challenge is ready",
        challenge.title,
        `/challenges/${challenge.id}`
      );

      created += 1;
    }

    return { processed: candidates.length, created };
  },
};
