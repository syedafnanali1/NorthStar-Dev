import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  coachClientLinks,
  coachProfiles,
  coachReferralConversions,
  goals,
  progressEntries,
  users,
} from "@/drizzle/schema";
import { notificationsService } from "./notifications.service";

function defaultReferralCode(userId: string): string {
  return `coach-${userId.slice(-6)}`.toLowerCase();
}

export const coachService = {
  async getProfile(userId: string) {
    const [profile] = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);
    return profile ?? null;
  },

  async upsertProfile(input: {
    userId: string;
    headline?: string;
    bio?: string;
    referralCode?: string;
    isActive?: boolean;
  }) {
    const referralCode =
      input.referralCode?.toLowerCase().trim() ?? defaultReferralCode(input.userId);

    const [profile] = await db
      .insert(coachProfiles)
      .values({
        userId: input.userId,
        headline: input.headline ?? null,
        bio: input.bio ?? null,
        referralCode,
        isActive: input.isActive ?? true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: coachProfiles.userId,
        set: {
          headline: input.headline ?? null,
          bio: input.bio ?? null,
          referralCode,
          isActive: input.isActive ?? true,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!profile) throw new Error("Failed to save coach profile.");
    return profile;
  },

  async linkClient(coachUserId: string, clientUserId: string) {
    const [coach] = await db
      .select({ id: coachProfiles.id, isActive: coachProfiles.isActive })
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, coachUserId))
      .limit(1);
    if (!coach || !coach.isActive) throw new Error("Coach profile is not active.");
    if (coachUserId === clientUserId) throw new Error("You cannot add yourself as a client.");

    const [link] = await db
      .insert(coachClientLinks)
      .values({ coachUserId, clientUserId, status: "active" })
      .onConflictDoNothing()
      .returning();

    await notificationsService.createNotification(
      clientUserId,
      "friend_activity",
      "You were added to a coach dashboard",
      "A coach linked your account for accountability tracking.",
      "/dashboard"
    );

    return link ?? { coachUserId, clientUserId, status: "active" };
  },

  async listClients(coachUserId: string) {
    return db
      .select({
        link: coachClientLinks,
        client: {
          id: users.id,
          name: users.name,
          username: users.username,
          image: users.image,
          level: users.level,
          northStarScore: users.northStarScore,
          currentStreak: users.currentStreak,
        },
      })
      .from(coachClientLinks)
      .innerJoin(users, eq(coachClientLinks.clientUserId, users.id))
      .where(
        and(eq(coachClientLinks.coachUserId, coachUserId), eq(coachClientLinks.status, "active"))
      )
      .orderBy(desc(coachClientLinks.createdAt));
  },

  async assignGoal(input: {
    coachUserId: string;
    clientUserId: string;
    title: string;
    category: "health" | "finance" | "writing" | "body" | "mindset" | "custom";
    unit: string;
    targetValue?: number;
    why?: string;
  }) {
    const [link] = await db
      .select({ id: coachClientLinks.id })
      .from(coachClientLinks)
      .where(
        and(
          eq(coachClientLinks.coachUserId, input.coachUserId),
          eq(coachClientLinks.clientUserId, input.clientUserId),
          eq(coachClientLinks.status, "active")
        )
      )
      .limit(1);
    if (!link) throw new Error("Client is not linked to this coach.");

    const [goal] = await db
      .insert(goals)
      .values({
        userId: input.clientUserId,
        title: input.title,
        why: input.why ?? `Assigned by coach`,
        category: input.category,
        unit: input.unit,
        targetValue: input.targetValue ?? null,
        currentValue: 0,
        isPublic: false,
        updatedAt: new Date(),
      })
      .returning();

    if (!goal) throw new Error("Failed to assign goal.");

    await notificationsService.createNotification(
      input.clientUserId,
      "weekly_review",
      "New coach-assigned goal",
      `Your coach assigned: ${input.title}`,
      `/goals/${goal.id}`
    );

    return goal;
  },

  async getDashboard(coachUserId: string) {
    const [profile, clients] = await Promise.all([
      this.getProfile(coachUserId),
      this.listClients(coachUserId),
    ]);

    const clientIds = clients.map((row) => row.client.id);
    const goalStats =
      clientIds.length === 0
        ? []
        : await db
            .select({
              userId: goals.userId,
              activeGoals: sql<number>`count(*) FILTER (WHERE ${goals.isArchived} = false)`,
              completedGoals: sql<number>`count(*) FILTER (WHERE ${goals.isCompleted} = true)`,
            })
            .from(goals)
            .where(inArray(goals.userId, clientIds))
            .groupBy(goals.userId);

    const progressCounts =
      clientIds.length === 0
        ? []
        : await db
            .select({
              userId: progressEntries.userId,
              logs: sql<number>`count(*)`,
            })
            .from(progressEntries)
            .where(inArray(progressEntries.userId, clientIds))
            .groupBy(progressEntries.userId);

    const statsByUser = new Map(
      goalStats.map((row) => [row.userId, { activeGoals: row.activeGoals, completedGoals: row.completedGoals }])
    );
    const logsByUser = new Map(progressCounts.map((row) => [row.userId, row.logs]));

    const enrichedClients = clients.map((row) => ({
      ...row.client,
      activeGoals: statsByUser.get(row.client.id)?.activeGoals ?? 0,
      completedGoals: statsByUser.get(row.client.id)?.completedGoals ?? 0,
      progressLogs: logsByUser.get(row.client.id) ?? 0,
    }));

    const [conversions] = await db
      .select({
        totalRevenueCents: sql<number>`COALESCE(sum(${coachReferralConversions.revenueCents}), 0)`,
        totalCommissionCents: sql<number>`COALESCE(sum(${coachReferralConversions.commissionCents}), 0)`,
      })
      .from(coachReferralConversions)
      .where(eq(coachReferralConversions.coachUserId, coachUserId));

    return {
      profile,
      clients: enrichedClients,
      totals: {
        clientCount: enrichedClients.length,
        totalRevenueCents: conversions?.totalRevenueCents ?? 0,
        totalCommissionCents: conversions?.totalCommissionCents ?? 0,
      },
    };
  },

  async recordReferralConversion(input: {
    referralCode: string;
    clientUserId: string;
    revenueCents: number;
  }) {
    const [profile] = await db
      .select({
        userId: coachProfiles.userId,
        commissionRate: coachProfiles.commissionRate,
      })
      .from(coachProfiles)
      .where(
        and(
          eq(coachProfiles.referralCode, input.referralCode.toLowerCase()),
          eq(coachProfiles.isActive, true)
        )
      )
      .limit(1);
    if (!profile) throw new Error("Invalid referral code.");
    if (profile.userId === input.clientUserId) {
      throw new Error("Self-referrals are not allowed.");
    }

    await this.linkClient(profile.userId, input.clientUserId);

    const commissionCents = Math.round(input.revenueCents * profile.commissionRate);
    const [conversion] = await db
      .insert(coachReferralConversions)
      .values({
        coachUserId: profile.userId,
        clientUserId: input.clientUserId,
        revenueCents: input.revenueCents,
        commissionCents,
      })
      .returning();

    if (!conversion) throw new Error("Failed to record referral conversion.");
    return conversion;
  },
};
