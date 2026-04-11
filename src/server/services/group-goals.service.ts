// src/server/services/group-goals.service.ts
// All business logic for group goals lives here.

import { db } from "@/lib/db";
import {
  circleConnections,
  groupGoals,
  groupGoalJoinRequests,
  groupGoalMilestones,
  groupGoalMembers,
  groupGoalMessages,
  progressEntries,
  users,
} from "@/drizzle/schema";
import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { categoryColor, categoryEmoji } from "@/lib/utils/index";
import { notificationsService } from "./notifications.service";
import { emailService } from "@/lib/email";
import { friendActivityService } from "./friend-activity.service";
import type {
  GroupGoal,
  GroupGoalJoinRequest,
  GroupGoalMember,
  GroupGoalMessage,
} from "@/drizzle/schema";

const TASK_PREFIX = "__task__:";
const TASK_DONE_PREFIX = "__task_done__:";
const INTENTION_PREFIX = "__intention__:";
const INTENTION_COMMENT_PREFIX = "__intention_comment__:";
const INTENTION_IDEA_PREFIX = "__intention_idea__:";

// Types
export interface MemberWithUser extends GroupGoalMember {
  user: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
    momentumScore: number;
  };
}

export interface JoinRequestWithUser extends GroupGoalJoinRequest {
  requester: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
}

export interface InvitableFriend {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
  image: string | null;
}

export interface GroupTask {
  id: string;
  text: string;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
  completed: boolean;
  completedAt: Date | null;
  completedBy: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

export type ViewerAccess = "creator" | "member" | "pending" | "public";
export type ViewerJoinRequestStatus = "none" | "pending" | "approved" | "rejected";

export interface GroupGoalWithMembers extends GroupGoal {
  members: MemberWithUser[];
  memberCount: number;
  groupMomentumScore: number;
  percentComplete: number;
  daysLeft: number | null;
}

export interface GroupGoalDiscoverItem extends GroupGoalWithMembers {
  viewerJoinRequestStatus: ViewerJoinRequestStatus;
}

export interface GroupIntentionComment {
  id: string;
  intentionId: string;
  text: string;
  createdAt: Date;
  user: { id: string; name: string | null; username: string | null; image: string | null };
}

export interface GroupIntention {
  id: string;
  groupGoalId: string;
  title: string;
  description?: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  targetDate?: string;
  createdAt: Date;
  createdBy: { id: string; name: string | null; username: string | null; image: string | null };
  comments: GroupIntentionComment[];
}

export interface GroupIdeaSubmission {
  id: string;
  text: string;
  createdAt: Date;
  user: { id: string; name: string | null; username: string | null; image: string | null };
}

export interface GroupGoalDetail extends GroupGoalWithMembers {
  messages: (GroupGoalMessage & {
    user: { id: string; name: string | null; image: string | null };
  })[];
  tasks: GroupTask[];
  intentions: GroupIntention[];
  ideaSubmissions: GroupIdeaSubmission[];
  viewerAccess: ViewerAccess;
  viewerJoinRequestStatus: ViewerJoinRequestStatus;
  canInteract: boolean;
  pendingRequests: JoinRequestWithUser[];
  creatorUser: { id: string; name: string | null; username: string | null; image: string | null } | null;
  rank: number;
}

export interface CreateGroupGoalInput {
  title: string;
  description?: string;
  category: "health" | "finance" | "writing" | "body" | "mindset" | "custom";
  targetValue?: number;
  unit?: string;
  emoji?: string;
  color?: string;
  startDate?: string;
  endDate?: string;
  isPublic?: boolean;
  memberLimit?: number;
  inviteUserIds?: string[];
}

type MessageWithUser = GroupGoalMessage & {
  user: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
};

// Helpers
function calcPercentComplete(group: GroupGoal): number {
  if (!group.targetValue || group.targetValue <= 0) return 0;
  return Math.min(100, Math.round((group.currentValue / group.targetValue) * 100));
}

function calcDaysLeft(group: GroupGoal): number | null {
  if (!group.endDate) return null;
  const days = Math.ceil((group.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

function calcGroupMomentumScore(members: MemberWithUser[]): number {
  if (members.length === 0) return 0;
  const avg = members.reduce((sum, member) => sum + member.user.momentumScore, 0) / members.length;
  return Math.round(avg);
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function isSystemMessage(text: string): boolean {
  return (
    text.startsWith(TASK_PREFIX) ||
    text.startsWith(TASK_DONE_PREFIX) ||
    text.startsWith(INTENTION_PREFIX) ||
    text.startsWith(INTENTION_COMMENT_PREFIX) ||
    text.startsWith(INTENTION_IDEA_PREFIX)
  );
}

function buildGroupIntentions(rows: MessageWithUser[]): GroupIntention[] {
  const ordered = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const intentionMap = new Map<string, GroupIntention>();
  const commentsList: (GroupIntentionComment & { intentionId: string })[] = [];

  for (const row of ordered) {
    if (row.text.startsWith(INTENTION_PREFIX)) {
      try {
        const raw = JSON.parse(row.text.slice(INTENTION_PREFIX.length)) as {
          title: string;
          description?: string;
          frequency: "daily" | "weekly" | "monthly" | "yearly" | "custom";
          targetDate?: string;
        };
        intentionMap.set(row.id, {
          id: row.id,
          groupGoalId: row.groupGoalId,
          title: raw.title,
          description: raw.description,
          frequency: raw.frequency,
          targetDate: raw.targetDate,
          createdAt: row.createdAt,
          createdBy: {
            id: row.user.id,
            name: row.user.name,
            username: row.user.username,
            image: row.user.image,
          },
          comments: [],
        });
      } catch {
        // skip malformed
      }
    }

    if (row.text.startsWith(INTENTION_COMMENT_PREFIX)) {
      try {
        const raw = JSON.parse(row.text.slice(INTENTION_COMMENT_PREFIX.length)) as {
          intentionId: string;
          text: string;
        };
        commentsList.push({
          id: row.id,
          intentionId: raw.intentionId,
          text: raw.text,
          createdAt: row.createdAt,
          user: {
            id: row.user.id,
            name: row.user.name,
            username: row.user.username,
            image: row.user.image,
          },
        });
      } catch {
        // skip
      }
    }
  }

  for (const comment of commentsList) {
    const intention = intentionMap.get(comment.intentionId);
    if (intention) {
      intention.comments.push({ ...comment });
    }
  }

  return [...intentionMap.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function buildIdeaSubmissions(rows: MessageWithUser[]): GroupIdeaSubmission[] {
  return rows
    .filter((row) => row.text.startsWith(INTENTION_IDEA_PREFIX))
    .map((row) => {
      try {
        const raw = JSON.parse(row.text.slice(INTENTION_IDEA_PREFIX.length)) as { text: string };
        return {
          id: row.id,
          text: raw.text,
          createdAt: row.createdAt,
          user: {
            id: row.user.id,
            name: row.user.name,
            username: row.user.username,
            image: row.user.image,
          },
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as GroupIdeaSubmission[];
}

function toVisibleChatMessages(rows: MessageWithUser[]) {
  return rows
    .filter((row) => !isSystemMessage(row.text))
    .map((row) => ({
      id: row.id,
      groupGoalId: row.groupGoalId,
      userId: row.userId,
      text: row.text,
      createdAt: row.createdAt,
      user: {
        id: row.user.id,
        name: row.user.name,
        image: row.user.image,
      },
    }));
}

function buildGroupTasks(rows: MessageWithUser[]): GroupTask[] {
  const ordered = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const tasks = new Map<string, GroupTask>();

  for (const row of ordered) {
    if (row.text.startsWith(TASK_PREFIX)) {
      const text = row.text.slice(TASK_PREFIX.length).trim();
      if (!text) continue;
      tasks.set(row.id, {
        id: row.id,
        text,
        createdAt: row.createdAt,
        createdBy: {
          id: row.user.id,
          name: row.user.name,
          username: row.user.username,
          image: row.user.image,
        },
        completed: false,
        completedAt: null,
        completedBy: null,
      });
      continue;
    }

    if (row.text.startsWith(TASK_DONE_PREFIX)) {
      const taskId = row.text.slice(TASK_DONE_PREFIX.length).trim();
      if (!taskId) continue;
      const task = tasks.get(taskId);
      if (!task || task.completed) continue;
      task.completed = true;
      task.completedAt = row.createdAt;
      task.completedBy = {
        id: row.user.id,
        name: row.user.name,
        image: row.user.image,
      };
    }
  }

  return [...tasks.values()].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

async function getAcceptedFriendIds(userId: string): Promise<string[]> {
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
}

async function assertCreator(groupGoalId: string, userId: string): Promise<void> {
  const [membership] = await db
    .select({ id: groupGoalMembers.id })
    .from(groupGoalMembers)
    .where(
      and(
        eq(groupGoalMembers.groupGoalId, groupGoalId),
        eq(groupGoalMembers.userId, userId),
        eq(groupGoalMembers.role, "creator")
      )
    )
    .limit(1);

  if (!membership) throw new Error("Only the group owner can do this");
}

async function assertMembership(groupGoalId: string, userId: string): Promise<GroupGoalMember> {
  const [membership] = await db
    .select()
    .from(groupGoalMembers)
    .where(
      and(
        eq(groupGoalMembers.groupGoalId, groupGoalId),
        eq(groupGoalMembers.userId, userId)
      )
    )
    .limit(1);

  if (!membership) {
    throw new Error("Only approved members can do this");
  }

  return membership;
}

async function enrichWithMembers(groupList: GroupGoal[]): Promise<GroupGoalWithMembers[]> {
  if (groupList.length === 0) return [];
  const ids = groupList.map((group) => group.id);

  const memberships = await db
    .select({
      member: groupGoalMembers,
      user: {
        id: users.id,
        name: users.name,
        username: users.username,
        image: users.image,
        momentumScore: users.momentumScore,
      },
    })
    .from(groupGoalMembers)
    .innerJoin(users, eq(groupGoalMembers.userId, users.id))
    .where(inArray(groupGoalMembers.groupGoalId, ids));

  const byGroupId = new Map<string, MemberWithUser[]>();
  for (const row of memberships) {
    const current = byGroupId.get(row.member.groupGoalId) ?? [];
    current.push({ ...row.member, user: row.user });
    byGroupId.set(row.member.groupGoalId, current);
  }

  return groupList.map((group) => {
    const members = byGroupId.get(group.id) ?? [];
    return {
      ...group,
      members,
      memberCount: members.length,
      groupMomentumScore: calcGroupMomentumScore(members),
      percentComplete: calcPercentComplete(group),
      daysLeft: calcDaysLeft(group),
    };
  });
}

async function fetchGroupMessages(
  groupGoalId: string,
  order: "asc" | "desc",
  limit: number
): Promise<MessageWithUser[]> {
  const rows = await db
    .select({
      message: groupGoalMessages,
      user: {
        id: users.id,
        name: users.name,
        username: users.username,
        image: users.image,
      },
    })
    .from(groupGoalMessages)
    .innerJoin(users, eq(groupGoalMessages.userId, users.id))
    .where(eq(groupGoalMessages.groupGoalId, groupGoalId))
    .orderBy(order === "asc" ? asc(groupGoalMessages.createdAt) : desc(groupGoalMessages.createdAt))
    .limit(limit);

  return rows.map((row) => ({ ...row.message, user: row.user }));
}

// Service
export const groupGoalsService = {
  /**
   * Fetch all group goals the user belongs to.
   */
  async getAllForUser(userId: string): Promise<GroupGoalWithMembers[]> {
    const memberships = await db
      .select({ groupGoalId: groupGoalMembers.groupGoalId })
      .from(groupGoalMembers)
      .where(eq(groupGoalMembers.userId, userId));

    if (memberships.length === 0) return [];

    const ids = memberships.map((membership) => membership.groupGoalId);
    const groups = await db
      .select()
      .from(groupGoals)
      .where(and(inArray(groupGoals.id, ids), eq(groupGoals.isArchived, false)))
      .orderBy(desc(groupGoals.createdAt));

    return enrichWithMembers(groups);
  },

  /**
   * Fetch all public group goals (for discovery).
   */
  async getPublic(): Promise<GroupGoalWithMembers[]> {
    const groups = await db
      .select()
      .from(groupGoals)
      .where(and(eq(groupGoals.isPublic, true), eq(groupGoals.isArchived, false)))
      .orderBy(desc(groupGoals.createdAt))
      .limit(20);

    return enrichWithMembers(groups);
  },

  /**
   * Fetch all discoverable groups created by all users that the viewer is not already in.
   * Member identities are intentionally hidden for privacy until someone joins.
   */
  async getDiscoverForUser(userId: string): Promise<GroupGoalDiscoverItem[]> {
    const [memberships, groups] = await Promise.all([
      db
        .select({ groupGoalId: groupGoalMembers.groupGoalId })
        .from(groupGoalMembers)
        .where(eq(groupGoalMembers.userId, userId)),
      db
        .select()
        .from(groupGoals)
        .where(eq(groupGoals.isArchived, false))
        .orderBy(desc(groupGoals.createdAt))
        .limit(120),
    ]);

    const myGroupIds = new Set(memberships.map((membership) => membership.groupGoalId));
    const discoverGroups = groups.filter((group) => !myGroupIds.has(group.id));
    if (discoverGroups.length === 0) return [];

    const discoverIds = discoverGroups.map((group) => group.id);
    const [memberCounts, joinRequests] = await Promise.all([
      db
        .select({
          groupGoalId: groupGoalMembers.groupGoalId,
          count: sql<number>`count(*)`,
        })
        .from(groupGoalMembers)
        .where(inArray(groupGoalMembers.groupGoalId, discoverIds))
        .groupBy(groupGoalMembers.groupGoalId),
      db
        .select({
          groupGoalId: groupGoalJoinRequests.groupGoalId,
          status: groupGoalJoinRequests.status,
        })
        .from(groupGoalJoinRequests)
        .where(
          and(
            eq(groupGoalJoinRequests.requesterId, userId),
            inArray(groupGoalJoinRequests.groupGoalId, discoverIds)
          )
        ),
    ]);

    const countByGroupId = new Map(memberCounts.map((row) => [row.groupGoalId, row.count]));
    const requestStatusByGroupId = new Map(joinRequests.map((row) => [row.groupGoalId, row.status]));

    return discoverGroups.map((group) => ({
      ...group,
      members: [],
      memberCount: countByGroupId.get(group.id) ?? 0,
      percentComplete: calcPercentComplete(group),
      daysLeft: calcDaysLeft(group),
      viewerJoinRequestStatus: requestStatusByGroupId.get(group.id) ?? "none",
      groupMomentumScore: 0,
    }));
  },

  /**
   * List accepted circle friends that can be invited to a group goal.
   */
  async getInvitableFriends(userId: string): Promise<InvitableFriend[]> {
    const friendIds = await getAcceptedFriendIds(userId);
    if (friendIds.length === 0) return [];

    return db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        image: users.image,
      })
      .from(users)
      .where(inArray(users.id, friendIds))
      .orderBy(asc(users.name), asc(users.email));
  },

  /**
   * Create a new group goal and add creator + optional invited friends.
   */
  async createGroupGoal(userId: string, input: CreateGroupGoalInput): Promise<GroupGoalWithMembers> {
    const inviteUserIds = uniqueIds((input.inviteUserIds ?? []).filter((id) => id !== userId));
    const memberLimit = input.memberLimit ?? 20;

    if (1 + inviteUserIds.length > memberLimit) {
      throw new Error("Member limit is smaller than creator + invited friends.");
    }

    if (inviteUserIds.length > 0) {
      const acceptedFriendIds = new Set(await getAcceptedFriendIds(userId));
      const nonFriend = inviteUserIds.find((id) => !acceptedFriendIds.has(id));
      if (nonFriend) {
        throw new Error("You can only invite people from your accepted circle.");
      }

      const existingUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, inviteUserIds));

      if (existingUsers.length !== inviteUserIds.length) {
        throw new Error("One or more invited users were not found.");
      }
    }

    const [group] = await db
      .insert(groupGoals)
      .values({
        creatorId: userId,
        title: input.title,
        description: input.description,
        category: input.category,
        targetValue: input.targetValue,
        unit: input.unit,
        emoji: input.emoji ?? categoryEmoji(input.category),
        color: input.color ?? categoryColor(input.category),
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        isPublic: input.isPublic ?? false,
        memberLimit,
      })
      .returning();

    if (!group) throw new Error("Failed to create group goal");

    await db.insert(groupGoalMembers).values({
      groupGoalId: group.id,
      userId,
      role: "creator",
      contribution: 0,
    });

    if (inviteUserIds.length > 0) {
      await db
        .insert(groupGoalMembers)
        .values(
          inviteUserIds.map((inviteeId) => ({
            groupGoalId: group.id,
            userId: inviteeId,
            role: "member" as const,
            contribution: 0,
          }))
        )
        .onConflictDoNothing();
    }

    const [result] = await enrichWithMembers([group]);
    return result!;
  },

  /**
   * Log a contribution for a group goal member.
   */
  async logGroupContribution(
    groupGoalId: string,
    userId: string,
    value: number,
    note?: string
  ): Promise<{ group: GroupGoal; contribution: number }> {
    const membership = await assertMembership(groupGoalId, userId);

    await db.insert(progressEntries).values({
      goalId: null,
      groupGoalId,
      userId,
      value,
      note: note ?? null,
    });

    const newContribution = membership.contribution + value;
    await db
      .update(groupGoalMembers)
      .set({ contribution: newContribution })
      .where(eq(groupGoalMembers.id, membership.id));

    const [aggregated] = await db
      .select({ total: sql<number>`COALESCE(SUM(${groupGoalMembers.contribution}), 0)` })
      .from(groupGoalMembers)
      .where(eq(groupGoalMembers.groupGoalId, groupGoalId));

    const newTotal = aggregated?.total ?? 0;
    const previousTotal = Math.max(0, newTotal - value);
    const [updatedGroup] = await db
      .update(groupGoals)
      .set({ currentValue: newTotal, updatedAt: new Date() })
      .where(eq(groupGoals.id, groupGoalId))
      .returning();

    if (!updatedGroup) throw new Error("Failed to update group goal");

    if (updatedGroup.targetValue && updatedGroup.targetValue > 0) {
      const beforePct = (previousTotal / updatedGroup.targetValue) * 100;
      const afterPct = (newTotal / updatedGroup.targetValue) * 100;
      const crossedMilestones = [25, 50, 75, 100].filter(
        (milestone) => beforePct < milestone && afterPct >= milestone
      );

      for (const milestone of crossedMilestones) {
        const [existing] = await db
          .select({ id: groupGoalMilestones.id })
          .from(groupGoalMilestones)
          .where(
            and(
              eq(groupGoalMilestones.groupGoalId, groupGoalId),
              eq(groupGoalMilestones.milestonePercent, milestone)
            )
          )
          .limit(1);

        if (existing) continue;

        await db.insert(groupGoalMilestones).values({
          groupGoalId,
          milestonePercent: milestone,
          triggeredByUserId: userId,
        });

        const memberRows = await db
          .select({ userId: groupGoalMembers.userId })
          .from(groupGoalMembers)
          .where(eq(groupGoalMembers.groupGoalId, groupGoalId));

        await Promise.all(
          memberRows.map((member) =>
            notificationsService.createNotification(
              member.userId,
              "group_milestone",
              `${updatedGroup.title}: ${milestone}% milestone`,
              `Your group reached ${milestone}% of its target. Keep the momentum going.`,
              `/groups/${groupGoalId}`
            )
          )
        );

        void friendActivityService.emitActivity({
          actorUserId: userId,
          type: "group_milestone",
          payload: {
            groupGoalId,
            groupTitle: updatedGroup.title,
            milestone,
            message: `group "${updatedGroup.title}" reached ${milestone}%`,
          },
          notifyFriends: true,
          link: `/groups/${groupGoalId}`,
        });
      }
    }

    return { group: updatedGroup, contribution: newContribution };
  },

  /**
   * Full group detail with access-aware payload.
   * Non-members get minimal detail and cannot interact.
   */
  async getGroupDetail(groupGoalId: string, userId: string): Promise<GroupGoalDetail | null> {
    const [group] = await db
      .select()
      .from(groupGoals)
      .where(and(eq(groupGoals.id, groupGoalId), eq(groupGoals.isArchived, false)))
      .limit(1);

    if (!group) return null;

    const [membership] = await db
      .select()
      .from(groupGoalMembers)
      .where(
        and(
          eq(groupGoalMembers.groupGoalId, groupGoalId),
          eq(groupGoalMembers.userId, userId)
        )
      )
      .limit(1);

    const [countRow, momentumRow] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(groupGoalMembers)
        .where(eq(groupGoalMembers.groupGoalId, groupGoalId))
        .then((rows) => rows[0]),
      db
        .select({ avgMomentum: sql<number>`COALESCE(AVG(${users.momentumScore}), 0)` })
        .from(groupGoalMembers)
        .innerJoin(users, eq(groupGoalMembers.userId, users.id))
        .where(eq(groupGoalMembers.groupGoalId, groupGoalId))
        .then((rows) => rows[0]),
    ]);

    let viewerJoinRequestStatus: ViewerJoinRequestStatus = "none";
    if (membership) {
      viewerJoinRequestStatus = "approved";
    } else {
      const [request] = await db
        .select({ status: groupGoalJoinRequests.status })
        .from(groupGoalJoinRequests)
        .where(
          and(
            eq(groupGoalJoinRequests.groupGoalId, groupGoalId),
            eq(groupGoalJoinRequests.requesterId, userId)
          )
        )
        .orderBy(desc(groupGoalJoinRequests.updatedAt))
        .limit(1);
      if (request) viewerJoinRequestStatus = request.status;
    }

    const viewerAccess: ViewerAccess = membership
      ? membership.role === "creator"
        ? "creator"
        : "member"
      : viewerJoinRequestStatus === "pending"
        ? "pending"
        : "public";

    // Fetch creator user info
    const [creatorRow] = await db
      .select({ id: users.id, name: users.name, username: users.username, image: users.image })
      .from(users)
      .where(eq(users.id, group.creatorId))
      .limit(1);
    const creatorUser = creatorRow ?? null;

    // Compute rank among all active public groups by member count
    const allPublicGroups = await db
      .select({ id: groupGoals.id, cnt: sql<number>`count(${groupGoalMembers.id})` })
      .from(groupGoals)
      .leftJoin(groupGoalMembers, eq(groupGoals.id, groupGoalMembers.groupGoalId))
      .where(and(eq(groupGoals.isArchived, false), eq(groupGoals.isPublic, true)))
      .groupBy(groupGoals.id)
      .orderBy(desc(sql<number>`count(${groupGoalMembers.id})`));

    const myRankIndex = allPublicGroups.findIndex((g) => g.id === groupGoalId);
    const rank = myRankIndex >= 0 ? myRankIndex + 1 : allPublicGroups.length + 1;

    let members: MemberWithUser[] = [];
    let messages: GroupGoalDetail["messages"] = [];
    let tasks: GroupTask[] = [];
    let intentions: GroupIntention[] = [];
    let ideaSubmissions: GroupIdeaSubmission[] = [];
    let pendingRequests: JoinRequestWithUser[] = [];

    if (membership) {
      const [memberRows, recentMessageRows, allMessageRows] = await Promise.all([
        db
          .select({
            member: groupGoalMembers,
            user: {
              id: users.id,
              name: users.name,
              username: users.username,
              image: users.image,
              momentumScore: users.momentumScore,
            },
          })
          .from(groupGoalMembers)
          .innerJoin(users, eq(groupGoalMembers.userId, users.id))
          .where(eq(groupGoalMembers.groupGoalId, groupGoalId))
          .orderBy(desc(groupGoalMembers.contribution)),
        fetchGroupMessages(groupGoalId, "desc", 80),
        fetchGroupMessages(groupGoalId, "asc", 500),
      ]);

      members = memberRows.map((row) => ({ ...row.member, user: row.user }));
      messages = toVisibleChatMessages(recentMessageRows).slice(0, 20).reverse();
      tasks = buildGroupTasks(allMessageRows).slice(0, 20);
      intentions = buildGroupIntentions(allMessageRows);
      ideaSubmissions = buildIdeaSubmissions(allMessageRows);

      if (membership.role === "creator") {
        const requestRows = await db
          .select({
            request: groupGoalJoinRequests,
            requester: {
              id: users.id,
              name: users.name,
              username: users.username,
              image: users.image,
            },
          })
          .from(groupGoalJoinRequests)
          .innerJoin(users, eq(groupGoalJoinRequests.requesterId, users.id))
          .where(
            and(
              eq(groupGoalJoinRequests.groupGoalId, groupGoalId),
              eq(groupGoalJoinRequests.status, "pending")
            )
          )
          .orderBy(asc(groupGoalJoinRequests.createdAt));

        pendingRequests = requestRows.map((row) => ({
          ...row.request,
          requester: row.requester,
        }));
      }
    }

    return {
      ...group,
      members,
      memberCount: membership ? members.length : countRow?.count ?? 0,
      groupMomentumScore: membership
        ? calcGroupMomentumScore(members)
        : Math.round(momentumRow?.avgMomentum ?? 0),
      messages,
      tasks,
      intentions,
      ideaSubmissions,
      percentComplete: calcPercentComplete(group),
      daysLeft: calcDaysLeft(group),
      viewerAccess,
      viewerJoinRequestStatus,
      canInteract: Boolean(membership),
      pendingRequests,
      creatorUser,
      rank,
    };
  },

  /**
   * Create or re-open a join request.
   */
  async joinGroup(groupGoalId: string, userId: string, note?: string): Promise<void> {
    const [group] = await db
      .select()
      .from(groupGoals)
      .where(and(eq(groupGoals.id, groupGoalId), eq(groupGoals.isArchived, false)))
      .limit(1);

    if (!group) throw new Error("Group not found");

    const [member] = await db
      .select({ id: groupGoalMembers.id })
      .from(groupGoalMembers)
      .where(
        and(
          eq(groupGoalMembers.groupGoalId, groupGoalId),
          eq(groupGoalMembers.userId, userId)
        )
      )
      .limit(1);
    if (member) throw new Error("You are already a member of this group.");

    const [existingRequest] = await db
      .select()
      .from(groupGoalJoinRequests)
      .where(
        and(
          eq(groupGoalJoinRequests.groupGoalId, groupGoalId),
          eq(groupGoalJoinRequests.requesterId, userId)
        )
      )
      .limit(1);

    if (existingRequest?.status === "pending") {
      throw new Error("Your join request is already pending.");
    }

    if (existingRequest) {
      await db
        .update(groupGoalJoinRequests)
        .set({
          status: "pending",
          note: note ?? existingRequest.note,
          reviewedAt: null,
          reviewedByUserId: null,
          updatedAt: new Date(),
        })
        .where(eq(groupGoalJoinRequests.id, existingRequest.id));
    } else {
      await db.insert(groupGoalJoinRequests).values({
        groupGoalId,
        requesterId: userId,
        status: "pending",
        note,
      });
    }

    if (group.creatorId !== userId) {
      const [requester, owner] = await Promise.all([
        db
          .select({
            id: users.id,
            name: users.name,
            username: users.username,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, group.creatorId))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);

      const requesterName =
        requester?.name ?? (requester?.username ? `@${requester.username}` : "Someone");

      await notificationsService.createNotification(
        group.creatorId,
        "challenge_update",
        "New join request",
        `${requesterName} requested to join "${group.title}".`,
        `/groups/${groupGoalId}`
      );

      if (owner?.email) {
        try {
          await emailService.sendGroupJoinRequestAlert({
            to: owner.email,
            ownerName: owner.name ?? "there",
            requesterName,
            groupTitle: group.title,
            groupUrl: `${process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000"}/groups/${groupGoalId}`,
          });
        } catch (err) {
          console.error("[group join request email]", err);
        }
      }
    }
  },

  /**
   * Creator-only: invite existing users or send email invites.
   */
  async inviteMembers(
    groupGoalId: string,
    ownerId: string,
    input: { userIds?: string[]; emails?: string[] }
  ): Promise<{ invitedUsers: number; emailedInvites: number }> {
    await assertCreator(groupGoalId, ownerId);

    const [group, owner] = await Promise.all([
      db
        .select({
          id: groupGoals.id,
          title: groupGoals.title,
          memberLimit: groupGoals.memberLimit,
        })
        .from(groupGoals)
        .where(eq(groupGoals.id, groupGoalId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
        })
        .from(users)
        .where(eq(users.id, ownerId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

    if (!group) throw new Error("Group not found.");

    const inviteUserIds = uniqueIds((input.userIds ?? []).filter((id) => id !== ownerId));
    const normalizedEmails = uniqueIds(
      (input.emails ?? [])
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    );

    let invitedUsers = 0;

    if (inviteUserIds.length > 0) {
      const [existingUsers, currentMembers] = await Promise.all([
        db
          .select({
            id: users.id,
            name: users.name,
            username: users.username,
          })
          .from(users)
          .where(inArray(users.id, inviteUserIds)),
        db
          .select({ userId: groupGoalMembers.userId })
          .from(groupGoalMembers)
          .where(eq(groupGoalMembers.groupGoalId, groupGoalId)),
      ]);

      if (existingUsers.length !== inviteUserIds.length) {
        throw new Error("One or more selected users were not found.");
      }

      const memberUserIds = new Set(currentMembers.map((member) => member.userId));
      const usersToAdd = existingUsers.filter((member) => !memberUserIds.has(member.id));

      if (currentMembers.length + usersToAdd.length > group.memberLimit) {
        throw new Error(`This group can have at most ${group.memberLimit} members.`);
      }

      if (usersToAdd.length > 0) {
        await db
          .insert(groupGoalMembers)
          .values(
            usersToAdd.map((member) => ({
              groupGoalId,
              userId: member.id,
              role: "member" as const,
              contribution: 0,
            }))
          )
          .onConflictDoNothing();

        const inviterName =
          owner?.name ?? (owner?.username ? `@${owner.username}` : "A group owner");

        await Promise.all(
          usersToAdd.map((member) =>
            notificationsService.createNotification(
              member.id,
              "challenge_update",
              "You've been invited to a group",
              `${inviterName} invited you to join "${group.title}".`,
              `/groups/${groupGoalId}`
            )
          )
        );

        invitedUsers = usersToAdd.length;
      }
    }

    let emailedInvites = 0;
    if (normalizedEmails.length > 0) {
      const groupUrl = `${process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000"}/groups/${groupGoalId}`;
      const inviterName =
        owner?.name ?? (owner?.username ? `@${owner.username}` : "A group owner");

      const results = await Promise.allSettled(
        normalizedEmails.map((email) =>
          emailService.sendGroupInvite({
            to: email,
            inviterName,
            groupTitle: group.title,
            groupUrl,
          })
        )
      );

      emailedInvites = results.filter((result) => result.status === "fulfilled").length;
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("[group invite email]", result.reason);
        }
      }
    }

    return { invitedUsers, emailedInvites };
  },

  /**
   * Creator-only: get pending join requests.
   */
  async getPendingJoinRequests(groupGoalId: string, ownerId: string): Promise<JoinRequestWithUser[]> {
    await assertCreator(groupGoalId, ownerId);

    const rows = await db
      .select({
        request: groupGoalJoinRequests,
        requester: {
          id: users.id,
          name: users.name,
          username: users.username,
          image: users.image,
        },
      })
      .from(groupGoalJoinRequests)
      .innerJoin(users, eq(groupGoalJoinRequests.requesterId, users.id))
      .where(
        and(
          eq(groupGoalJoinRequests.groupGoalId, groupGoalId),
          eq(groupGoalJoinRequests.status, "pending")
        )
      )
      .orderBy(asc(groupGoalJoinRequests.createdAt));

    return rows.map((row) => ({ ...row.request, requester: row.requester }));
  },

  /**
   * Creator-only: approve or reject a request.
   */
  async reviewJoinRequest(
    groupGoalId: string,
    ownerId: string,
    requestId: string,
    action: "approve" | "reject"
  ): Promise<JoinRequestWithUser> {
    await assertCreator(groupGoalId, ownerId);

    const [request] = await db
      .select()
      .from(groupGoalJoinRequests)
      .where(
        and(
          eq(groupGoalJoinRequests.id, requestId),
          eq(groupGoalJoinRequests.groupGoalId, groupGoalId)
        )
      )
      .limit(1);

    if (!request) throw new Error("Join request not found.");

    if (action === "approve") {
      const [group] = await db
        .select({ memberLimit: groupGoals.memberLimit })
        .from(groupGoals)
        .where(eq(groupGoals.id, groupGoalId))
        .limit(1);

      if (!group) throw new Error("Group not found.");

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(groupGoalMembers)
        .where(eq(groupGoalMembers.groupGoalId, groupGoalId));

      const [existingMember] = await db
        .select({ id: groupGoalMembers.id })
        .from(groupGoalMembers)
        .where(
          and(
            eq(groupGoalMembers.groupGoalId, groupGoalId),
            eq(groupGoalMembers.userId, request.requesterId)
          )
        )
        .limit(1);

      if (!existingMember && (countRow?.count ?? 0) >= group.memberLimit) {
        throw new Error("Group is full.");
      }

      if (!existingMember) {
        await db
          .insert(groupGoalMembers)
          .values({
            groupGoalId,
            userId: request.requesterId,
            role: "member",
            contribution: 0,
          })
          .onConflictDoNothing();
      }
    }

    const [updatedRequest] = await db
      .update(groupGoalJoinRequests)
      .set({
        status: action === "approve" ? "approved" : "rejected",
        reviewedAt: new Date(),
        reviewedByUserId: ownerId,
        updatedAt: new Date(),
      })
      .where(eq(groupGoalJoinRequests.id, request.id))
      .returning();

    if (!updatedRequest) throw new Error("Failed to update join request.");

    const [requester] = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        image: users.image,
      })
      .from(users)
      .where(eq(users.id, updatedRequest.requesterId))
      .limit(1);

    if (!requester) throw new Error("Requester not found.");

    await notificationsService.createNotification(
      requester.id,
      "challenge_update",
      action === "approve" ? "Join request approved" : "Join request rejected",
      action === "approve"
        ? `You are now a member of this group.`
        : `Your request was declined this time.`,
      `/groups/${groupGoalId}`
    );

    return { ...updatedRequest, requester };
  },

  /**
   * Send a message to the group chat.
   */
  async sendMessage(
    groupGoalId: string,
    userId: string,
    text: string
  ): Promise<GroupGoalMessage & { user: { id: string; name: string | null; image: string | null } }> {
    await assertMembership(groupGoalId, userId);

    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error("Message cannot be empty.");
    }
    if (isSystemMessage(trimmed)) {
      throw new Error("Reserved message format.");
    }

    const [message] = await db
      .insert(groupGoalMessages)
      .values({ groupGoalId, userId, text: trimmed })
      .returning();

    if (!message) throw new Error("Failed to send message");

    const [user] = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const peers = await db
      .select({ userId: groupGoalMembers.userId })
      .from(groupGoalMembers)
      .where(and(eq(groupGoalMembers.groupGoalId, groupGoalId), ne(groupGoalMembers.userId, userId)));

    await Promise.all(
      peers.map((peer) =>
        notificationsService.createNotification(
          peer.userId,
          "group_message",
          "New group message",
          `${user?.name ?? "A member"} posted in your group chat.`,
          `/groups/${groupGoalId}`
        )
      )
    );

    return {
      ...message,
      user: user ?? { id: userId, name: null, image: null },
    };
  },

  /**
   * Get last visible messages for a group (members only).
   */
  async getMessages(groupGoalId: string, userId: string) {
    const [membership] = await db
      .select({ id: groupGoalMembers.id })
      .from(groupGoalMembers)
      .where(
        and(
          eq(groupGoalMembers.groupGoalId, groupGoalId),
          eq(groupGoalMembers.userId, userId)
        )
      )
      .limit(1);

    if (!membership) return [];

    const rows = await fetchGroupMessages(groupGoalId, "desc", 80);
    return toVisibleChatMessages(rows).slice(0, 20).reverse();
  },

  /**
   * Get parsed task board from system task messages (members only).
   */
  async getTasks(groupGoalId: string, userId: string): Promise<GroupTask[]> {
    await assertMembership(groupGoalId, userId);
    const rows = await fetchGroupMessages(groupGoalId, "asc", 300);
    return buildGroupTasks(rows).slice(0, 20);
  },

  /**
   * Add a task to the group task board (members only).
   */
  async addTask(groupGoalId: string, userId: string, text: string): Promise<GroupTask[]> {
    await assertMembership(groupGoalId, userId);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      throw new Error("Task must be at least 2 characters.");
    }
    if (trimmed.length > 220) {
      throw new Error("Task must be 220 characters or less.");
    }

    await db.insert(groupGoalMessages).values({
      groupGoalId,
      userId,
      text: `${TASK_PREFIX}${trimmed}`,
    });

    return this.getTasks(groupGoalId, userId);
  },

  /**
   * Mark a task as done by posting a system completion marker (members only).
   */
  async completeTask(groupGoalId: string, userId: string, taskId: string): Promise<GroupTask[]> {
    await assertMembership(groupGoalId, userId);
    const existing = await this.getTasks(groupGoalId, userId);
    const task = existing.find((item) => item.id === taskId);
    if (!task) {
      throw new Error("Task not found.");
    }
    if (!task.completed) {
      await db.insert(groupGoalMessages).values({
        groupGoalId,
        userId,
        text: `${TASK_DONE_PREFIX}${taskId}`,
      });
    }
    return this.getTasks(groupGoalId, userId);
  },

  /**
   * Update group (creator only).
   */
  async updateGroup(
    groupGoalId: string,
    userId: string,
    input: Partial<CreateGroupGoalInput>
  ): Promise<GroupGoal> {
    await assertCreator(groupGoalId, userId);

    const [updated] = await db
      .update(groupGoals)
      .set({
        ...(input.title && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.isPublic !== undefined && { isPublic: input.isPublic }),
        ...(input.memberLimit && { memberLimit: input.memberLimit }),
        updatedAt: new Date(),
      })
      .where(eq(groupGoals.id, groupGoalId))
      .returning();

    if (!updated) throw new Error("Failed to update group");
    return updated;
  },

  /**
   * Archive group (creator only).
   */
  async archiveGroup(groupGoalId: string, userId: string): Promise<void> {
    await assertCreator(groupGoalId, userId);

    await db
      .update(groupGoals)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(eq(groupGoals.id, groupGoalId));
  },
};
