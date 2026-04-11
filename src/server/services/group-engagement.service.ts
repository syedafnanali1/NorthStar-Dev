// src/server/services/group-engagement.service.ts
// Central async engine for group engagement: score computation, badge awarding,
// behavioral profile enrichment, and personalized nudge generation.
//
// ALL public methods are designed to be called as `void fn()` — they never
// throw to the caller, so UI latency is never affected.

import { db } from "@/lib/db";
import {
  groupMembers,
  groupEngagementLogs,
  userAchievements,
  groupGoalMemberTrackers,
  groupGoalCheckIns,
  groups,
  users,
} from "@/drizzle/schema";
import { and, desc, eq, gte, sql, count } from "drizzle-orm";
import { notificationsService } from "./notifications.service";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type EngagementTier = "Newcomer" | "Active" | "Committed" | "Champion";

export interface GroupEngagementStats {
  groupId: string;
  groupName: string;
  engagementScore: number;
  tier: EngagementTier;
  goalsCompleted: number;
  commentsPosted: number;
  reactionsGiven: number;
  invitesSent: number;
  sessionVisits: number;
  joinedAt: Date;
}

export interface GroupBadge {
  key: string;
  label: string;
  description: string;
  earnedAt: Date;
  emoji: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

// Point weights — these produce an integer score stored in group_members.engagementScore
const WEIGHTS = {
  goalsCompleted: 4,    // 40% of score weight
  commentsPosted: 2.5,  // 25%
  reactionsGiven: 1.5,  // 15%
  invitesSent:    1.0,  // 10% (includes accepts)
  sessionVisits:  0.5,  // 10%
} as const;

// Tier thresholds
const TIERS: { min: number; tier: EngagementTier }[] = [
  { min: 50, tier: "Champion" },
  { min: 20, tier: "Committed" },
  { min: 5,  tier: "Active" },
  { min: 0,  tier: "Newcomer" },
];

// Group-specific achievement definitions
const GROUP_ACHIEVEMENTS: Record<
  string,
  { label: string; description: string; emoji: string }
> = {
  group_first_goal:    { label: "First Goal Completed", description: "Completed your first group goal check-in.", emoji: "🎯" },
  group_10_checkins:   { label: "10 Check-ins",         description: "Logged 10 check-ins across group goals.",   emoji: "✅" },
  group_connector:     { label: "Group Connector",       description: "Invited 3 or more members to groups.",     emoji: "🤝" },
  group_streak_keeper: { label: "Streak Keeper",         description: "Completed daily check-ins for 7 days in a row.", emoji: "🔥" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeScore(counters: {
  goalsCompleted: number;
  commentsPosted: number;
  reactionsGiven: number;
  invitesSent: number;
  sessionVisits: number;
}): number {
  return Math.round(
    counters.goalsCompleted * WEIGHTS.goalsCompleted +
    counters.commentsPosted * WEIGHTS.commentsPosted +
    counters.reactionsGiven * WEIGHTS.reactionsGiven +
    counters.invitesSent    * WEIGHTS.invitesSent +
    counters.sessionVisits  * WEIGHTS.sessionVisits
  );
}

export function engagementTier(score: number): EngagementTier {
  return (TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1]!).tier;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const groupEngagementService = {
  // ── Score Update ───────────────────────────────────────────────────────────

  /**
   * Recompute and persist the engagement score for a single (user, group) pair.
   * Call as `void` — safe to fire-and-forget.
   */
  async updateScore(userId: string, groupId: string): Promise<void> {
    try {
      const [row] = await db
        .select({
          goalsCompleted: groupMembers.goalsCompleted,
          commentsPosted: groupMembers.commentsPosted,
          reactionsGiven: groupMembers.reactionsGiven,
          invitesSent:    groupMembers.invitesSent,
          sessionVisits:  groupMembers.sessionVisits,
        })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
        .limit(1);

      if (!row) return;

      const score = computeScore(row);
      await db
        .update(groupMembers)
        .set({ engagementScore: score, lastActiveAt: new Date() })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
    } catch (err) {
      console.error("[groupEngagementService.updateScore]", err);
    }
  },

  // ── Counter Increments (atomics) ───────────────────────────────────────────

  async incrementComment(userId: string, groupId: string): Promise<void> {
    try {
      await db
        .update(groupMembers)
        .set({ commentsPosted: sql`${groupMembers.commentsPosted} + 1` })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
      void this.updateScore(userId, groupId);
      void this.checkAndAwardBadges(userId);
      void this.updateBehaviorProfile(userId, "post_comment", { groupId });
    } catch (err) {
      console.error("[groupEngagementService.incrementComment]", err);
    }
  },

  async incrementReaction(userId: string, groupId: string): Promise<void> {
    try {
      await db
        .update(groupMembers)
        .set({ reactionsGiven: sql`${groupMembers.reactionsGiven} + 1` })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
      void this.updateScore(userId, groupId);
      void this.updateBehaviorProfile(userId, "react", { groupId });
    } catch (err) {
      console.error("[groupEngagementService.incrementReaction]", err);
    }
  },

  async incrementGoalCompletion(userId: string, groupId: string): Promise<void> {
    try {
      await db
        .update(groupMembers)
        .set({ goalsCompleted: sql`${groupMembers.goalsCompleted} + 1` })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
      void this.updateScore(userId, groupId);
      void this.checkAndAwardBadges(userId);
      void this.updateBehaviorProfile(userId, "complete_goal", { groupId, outcome: "completed" });
    } catch (err) {
      console.error("[groupEngagementService.incrementGoalCompletion]", err);
    }
  },

  async incrementInvite(userId: string, groupId: string): Promise<void> {
    try {
      await db
        .update(groupMembers)
        .set({ invitesSent: sql`${groupMembers.invitesSent} + 1` })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
      void this.updateScore(userId, groupId);
      void this.checkAndAwardBadges(userId);
      void this.updateBehaviorProfile(userId, "invite_member", { groupId });
    } catch (err) {
      console.error("[groupEngagementService.incrementInvite]", err);
    }
  },

  async recordSessionVisit(userId: string, groupId: string): Promise<void> {
    try {
      // Deduplicate: only count once per day per group
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [existing] = await db
        .select({ id: groupEngagementLogs.id })
        .from(groupEngagementLogs)
        .where(
          and(
            eq(groupEngagementLogs.userId, userId),
            eq(groupEngagementLogs.groupId, groupId),
            eq(groupEngagementLogs.action, "session_visit"),
            gte(groupEngagementLogs.timestamp, today)
          )
        )
        .limit(1);

      if (existing) return; // already logged today

      await db.insert(groupEngagementLogs).values({
        userId,
        groupId,
        action: "session_visit",
        metadata: {},
      });

      await db
        .update(groupMembers)
        .set({ sessionVisits: sql`${groupMembers.sessionVisits} + 1` })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));

      void this.updateScore(userId, groupId);
      void this.updateBehaviorProfile(userId, "session_visit", { groupId });
    } catch (err) {
      console.error("[groupEngagementService.recordSessionVisit]", err);
    }
  },

  // ── Badge Award ────────────────────────────────────────────────────────────

  async checkAndAwardBadges(userId: string): Promise<void> {
    try {
      // Fetch already-earned group badges for this user
      const earned = await db
        .select({ key: userAchievements.achievementKey })
        .from(userAchievements)
        .where(
          and(
            eq(userAchievements.userId, userId),
            sql`${userAchievements.achievementKey} LIKE 'group_%'`
          )
        );
      const earnedSet = new Set(earned.map((r) => r.key));

      const toAward: string[] = [];

      // — group_first_goal: completed at least 1 check-in total
      if (!earnedSet.has("group_first_goal")) {
        const rows = await db
          .select({ val: count(groupGoalCheckIns.id) })
          .from(groupGoalCheckIns)
          .where(eq(groupGoalCheckIns.userId, userId));
        if ((rows[0]?.val ?? 0) >= 1) toAward.push("group_first_goal");
      }

      // — group_10_checkins: completed 10+ check-ins total
      if (!earnedSet.has("group_10_checkins")) {
        const rows = await db
          .select({ val: count(groupGoalCheckIns.id) })
          .from(groupGoalCheckIns)
          .where(eq(groupGoalCheckIns.userId, userId));
        if ((rows[0]?.val ?? 0) >= 10) toAward.push("group_10_checkins");
      }

      // — group_connector: sent 3+ invites total across all groups
      if (!earnedSet.has("group_connector")) {
        const rows = await db
          .select({ val: sql<number>`COALESCE(SUM(${groupMembers.invitesSent}), 0)` })
          .from(groupMembers)
          .where(eq(groupMembers.userId, userId));
        if (Number(rows[0]?.val ?? 0) >= 3) toAward.push("group_connector");
      }

      // — group_streak_keeper: 7 consecutive days with a check-in
      if (!earnedSet.has("group_streak_keeper")) {
        const hasStreak = await this._hasSevenDayCheckInStreak(userId);
        if (hasStreak) toAward.push("group_streak_keeper");
      }

      if (toAward.length === 0) return;

      // Insert and notify (ignore conflict = already earned)
      for (const key of toAward) {
        try {
          await db
            .insert(userAchievements)
            .values({ userId, achievementKey: key })
            .onConflictDoNothing();

          const def = GROUP_ACHIEVEMENTS[key];
          if (def) {
            await notificationsService.createNotification(
              userId,
              "achievement_unlocked",
              `${def.emoji} ${def.label}`,
              def.description,
              "/analytics"
            );
          }
        } catch {
          // Silently swallow duplicate-key errors
        }
      }
    } catch (err) {
      console.error("[groupEngagementService.checkAndAwardBadges]", err);
    }
  },

  async _hasSevenDayCheckInStreak(userId: string): Promise<boolean> {
    try {
      // Fetch distinct check-in dates for last 14 days, newest first
      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const rows = await db
        .select({
          day: sql<string>`DATE(${groupGoalCheckIns.loggedAt})`,
        })
        .from(groupGoalCheckIns)
        .where(
          and(
            eq(groupGoalCheckIns.userId, userId),
            gte(groupGoalCheckIns.loggedAt, cutoff)
          )
        )
        .groupBy(sql`DATE(${groupGoalCheckIns.loggedAt})`)
        .orderBy(desc(sql`DATE(${groupGoalCheckIns.loggedAt})`));

      if (rows.length < 7) return false;

      // Check if the 7 most recent dates are consecutive calendar days
      for (let i = 0; i < 7; i++) {
        const row = rows[i];
        const prev = rows[i - 1];
        if (i === 0) continue;
        if (!row || !prev) return false;
        const diff =
          new Date(prev.day).getTime() - new Date(row.day).getTime();
        if (diff !== 86400000) return false; // not exactly 1 day apart
      }
      return true;
    } catch {
      return false;
    }
  },

  // ── Behavior Profile Update ────────────────────────────────────────────────

  async updateBehaviorProfile(
    userId: string,
    action: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      // Aggregate current group stats for the profile summary
      const groupStats = await db
        .select({
          groupId: groupMembers.groupId,
          engagementScore: groupMembers.engagementScore,
          goalsCompleted: groupMembers.goalsCompleted,
          commentsPosted: groupMembers.commentsPosted,
        })
        .from(groupMembers)
        .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "active")));

      const totalGoals = groupStats.reduce((s, r) => s + r.goalsCompleted, 0);
      const totalComments = groupStats.reduce((s, r) => s + r.commentsPosted, 0);
      const bestGroup = groupStats.sort((a, b) => b.engagementScore - a.engagementScore)[0];

      const profile = {
        lastAction: { action, ...metadata, at: new Date().toISOString() },
        groupCount: groupStats.length,
        summary: {
          totalGoalsCompleted: totalGoals,
          totalCommentsPosted: totalComments,
        },
        mostActiveGroupId: bestGroup?.groupId ?? null,
        updatedAt: new Date().toISOString(),
      };

      await db
        .update(users)
        .set({ groupBehaviorProfile: profile })
        .where(eq(users.id, userId));
    } catch (err) {
      console.error("[groupEngagementService.updateBehaviorProfile]", err);
    }
  },

  // ── Nudges ─────────────────────────────────────────────────────────────────

  /**
   * Returns personalized nudge messages for a user based on their group activity.
   * Used in the analytics tab and AI coaching.
   */
  async getNudges(userId: string): Promise<{ groupId: string; groupName: string; message: string }[]> {
    try {
      const nudges: { groupId: string; groupName: string; message: string }[] = [];

      // Find group goal trackers where the user hasn't checked in for 3+ days
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const staleTrackers = await db
        .select({
          groupId: groupGoalMemberTrackers.groupId,
          lastCheckedInAt: groupGoalMemberTrackers.lastCheckedInAt,
          groupName: groups.name,
        })
        .from(groupGoalMemberTrackers)
        .innerJoin(groups, eq(groupGoalMemberTrackers.groupId, groups.id))
        .where(
          and(
            eq(groupGoalMemberTrackers.userId, userId),
            eq(groupGoalMemberTrackers.isCompleted, false),
            sql`(${groupGoalMemberTrackers.lastCheckedInAt} IS NULL OR ${groupGoalMemberTrackers.lastCheckedInAt} < ${cutoff})`
          )
        )
        .limit(5);

      for (const t of staleTrackers) {
        const daysSince = t.lastCheckedInAt
          ? Math.floor((Date.now() - new Date(t.lastCheckedInAt).getTime()) / 86400000)
          : null;
        nudges.push({
          groupId: t.groupId,
          groupName: t.groupName,
          message: daysSince
            ? `You haven't checked in on your group goal in ${daysSince} days.`
            : "You have a group goal waiting for your first check-in!",
        });
      }

      return nudges;
    } catch {
      return [];
    }
  },

  // ── Analytics ──────────────────────────────────────────────────────────────

  /**
   * Returns per-group engagement stats for a user's analytics view.
   */
  async getUserGroupAnalytics(userId: string): Promise<GroupEngagementStats[]> {
    try {
      const rows = await db
        .select({
          groupId: groupMembers.groupId,
          groupName: groups.name,
          engagementScore: groupMembers.engagementScore,
          goalsCompleted: groupMembers.goalsCompleted,
          commentsPosted: groupMembers.commentsPosted,
          reactionsGiven: groupMembers.reactionsGiven,
          invitesSent: groupMembers.invitesSent,
          sessionVisits: groupMembers.sessionVisits,
          joinedAt: groupMembers.joinedAt,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "active")))
        .orderBy(desc(groupMembers.engagementScore));

      return rows.map((r) => ({
        groupId: r.groupId,
        groupName: r.groupName,
        engagementScore: r.engagementScore,
        tier: engagementTier(r.engagementScore),
        goalsCompleted: r.goalsCompleted,
        commentsPosted: r.commentsPosted,
        reactionsGiven: r.reactionsGiven,
        invitesSent: r.invitesSent,
        sessionVisits: r.sessionVisits,
        joinedAt: r.joinedAt,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Returns earned group badges for a user (for profile badge shelf).
   */
  async getUserGroupBadges(userId: string): Promise<GroupBadge[]> {
    try {
      const rows = await db
        .select({ key: userAchievements.achievementKey, earnedAt: userAchievements.earnedAt })
        .from(userAchievements)
        .where(
          and(
            eq(userAchievements.userId, userId),
            sql`${userAchievements.achievementKey} LIKE 'group_%'`
          )
        )
        .orderBy(desc(userAchievements.earnedAt));

      return rows.flatMap((r) => {
        const def = GROUP_ACHIEVEMENTS[r.key];
        if (!def) return [];
        return [{ key: r.key, label: def.label, description: def.description, emoji: def.emoji, earnedAt: r.earnedAt }];
      });
    } catch {
      return [];
    }
  },

  /**
   * Top N members by engagement score within a group (for "Top Contributors" section).
   */
  async getTopContributors(
    groupId: string,
    limit = 3
  ): Promise<
    {
      userId: string;
      name: string | null;
      username: string | null;
      image: string | null;
      engagementScore: number;
      tier: EngagementTier;
    }[]
  > {
    try {
      const rows = await db
        .select({
          userId: groupMembers.userId,
          engagementScore: groupMembers.engagementScore,
          name: users.name,
          username: users.username,
          image: users.image,
        })
        .from(groupMembers)
        .innerJoin(users, eq(groupMembers.userId, users.id))
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")))
        .orderBy(desc(groupMembers.engagementScore))
        .limit(limit);

      return rows.map((r) => ({
        userId: r.userId,
        name: r.name,
        username: r.username,
        image: r.image,
        engagementScore: r.engagementScore,
        tier: engagementTier(r.engagementScore),
      }));
    } catch {
      return [];
    }
  },
};
