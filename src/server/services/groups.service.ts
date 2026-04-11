// src/server/services/groups.service.ts
// Business logic for the Groups feature (community containers).
// Distinct from group-goals.service.ts which handles the old collaborative goal model.

import { db } from "@/lib/db";
import {
  groups,
  groupMembers,
  groupInvites,
  groupJoinRequests,
  groupEngagementLogs,
  groupChatPosts,
  goals,
  circleConnections,
  users,
} from "@/drizzle/schema";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  or,
  sql,
  ilike,
  gte,
  count,
  avg,
} from "drizzle-orm";
import { notificationsService } from "./notifications.service";
import { groupEngagementService } from "./group-engagement.service";
import { emailService } from "@/lib/email";
import type { Group, GroupMember } from "@/drizzle/schema";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface InvitableFriend {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
  image: string | null;
}

export interface GroupWithMeta extends Group {
  memberCount: number;
  myRole: "owner" | "admin" | "member" | null;
  members: Array<{
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
    role: GroupMember["role"];
  }>;
}

export interface GroupPublicProfile {
  id: string;
  name: string;
  description: string | null;
  type: "public" | "private";
  memberCount: number;
  popularityScore: number;
  popularityRank: number | null;
  popularityTier: "Rising" | "Active" | "Elite";
  createdAt: Date;
  members: Array<{
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
    role: GroupMember["role"];
  }>;
  myRole: "owner" | "admin" | "member" | null;
  myJoinRequestStatus: "pending" | "approved" | "rejected" | null;
  isArchived: boolean;
  coverImage: string | null;
  recentGoalsCount: number;
}

export interface JoinRequestWithUser {
  id: string;
  groupId: string;
  requesterId: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  requestedAt: Date;
  requester: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
}

export type GroupCategory =
  | "health" | "fitness" | "finance" | "mindset" | "writing"
  | "reading" | "career" | "lifestyle" | "creativity" | "community" | "other";

export interface CreateGroupInput {
  name: string;
  description?: string;
  type: "public" | "private";
  category?: GroupCategory;
  inviteUserIds?: string[];
  inviteEmails?: string[];
}

export type DiscoverSortBy = "popularity" | "newest" | "members";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

  return rows.map((r) => (r.requesterId === userId ? r.receiverId : r.requesterId));
}

function popularityTier(score: number): "Rising" | "Active" | "Elite" {
  if (score >= 70) return "Elite";
  if (score >= 35) return "Active";
  return "Rising";
}

// ─── Popularity score calculation ─────────────────────────────────────────────
//
// Weighted formula (0–100):
//   30% — Member count          (capped at 200 for normalization)
//   20% — Comments past 30 days (capped at 500)
//   30% — Avg goal completion % of members
//   20% — Avg recommendation rating of members (1–10 → 0–100)

async function computePopularityScore(groupId: string): Promise<number> {
  // 1. Member count component (30%)
  const [memberRow] = await db
    .select({ cnt: count() })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")));
  const memberCount = memberRow?.cnt ?? 0;
  const memberScore = Math.min(memberCount / 200, 1) * 100 * 0.3;

  // 2. Comment activity in last 30 days (20%)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [chatRow] = await db
    .select({ cnt: count() })
    .from(groupChatPosts)
    .where(
      and(
        eq(groupChatPosts.groupId, groupId),
        eq(groupChatPosts.isDeleted, false),
        gte(groupChatPosts.createdAt, thirtyDaysAgo)
      )
    );
  const recentComments = chatRow?.cnt ?? 0;
  const commentScore = Math.min(recentComments / 500, 1) * 100 * 0.2;

  // 3. Avg goal completion rate of members (30%)
  // Pull member user IDs, then compute avg totalGoalsCompleted / max(1, totalGoals)
  const memberUsers = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")));

  let goalCompletionScore = 0;
  if (memberUsers.length > 0) {
    const userIds = memberUsers.map((m) => m.userId);
    const [goalRow] = await db
      .select({
        totalGoals: count(),
        completed: sql<number>`sum(case when ${goals.isCompleted} then 1 else 0 end)`,
      })
      .from(goals)
      .where(
        and(
          inArray(goals.userId, userIds),
          eq(goals.isArchived, false)
        )
      );
    const total = goalRow?.totalGoals ?? 0;
    const done = Number(goalRow?.completed ?? 0);
    const rate = total > 0 ? done / total : 0;
    goalCompletionScore = rate * 100 * 0.3;
  }

  // 4. Avg recommendation rating 1–10 → 0–100 (20%)
  const [ratingRow] = await db
    .select({ avgRating: avg(groupMembers.recommendationRating) })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.status, "active")
      )
    );
  const avgRating = Number(ratingRow?.avgRating ?? 0);
  const ratingScore = (avgRating / 10) * 100 * 0.2;

  const total = memberScore + commentScore + goalCompletionScore + ratingScore;
  return Math.round(Math.min(total, 100) * 10) / 10;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const groupsService = {
  /**
   * List accepted circle friends eligible to be invited to a group.
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
   * Fetch all groups the user is an active member of, newest first.
   */
  async getGroupsForUser(userId: string): Promise<GroupWithMeta[]> {
    const memberships = await db
      .select({ groupId: groupMembers.groupId, role: groupMembers.role })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, "active")
        )
      );

    if (memberships.length === 0) return [];

    const myGroupIds = memberships.map((m) => m.groupId);
    const roleByGroupId = new Map(memberships.map((m) => [m.groupId, m.role]));

    const groupRows = await db
      .select()
      .from(groups)
      .where(
        and(inArray(groups.id, myGroupIds), eq(groups.isArchived, false))
      )
      .orderBy(desc(groups.createdAt));

    if (groupRows.length === 0) return [];

    const memberRows = await db
      .select({
        groupId: groupMembers.groupId,
        role: groupMembers.role,
        userId: users.id,
        name: users.name,
        username: users.username,
        image: users.image,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(
        and(
          inArray(groupMembers.groupId, myGroupIds),
          eq(groupMembers.status, "active")
        )
      )
      .orderBy(asc(groupMembers.joinedAt))
      .limit(100);

    const membersByGroup = new Map<
      string,
      Array<{ id: string; name: string | null; username: string | null; image: string | null; role: GroupMember["role"] }>
    >();
    for (const m of memberRows) {
      const arr = membersByGroup.get(m.groupId) ?? [];
      arr.push({ id: m.userId, name: m.name, username: m.username, image: m.image, role: m.role });
      membersByGroup.set(m.groupId, arr);
    }

    return groupRows.map((g) => ({
      ...g,
      memberCount: g.memberCount,
      myRole: roleByGroupId.get(g.id) ?? null,
      members: (membersByGroup.get(g.id) ?? []).slice(0, 5),
    }));
  },

  /**
   * Fetch public groups the user is NOT a member of (discover section on the main groups page).
   */
  async getDiscoverGroups(userId: string, limit = 20): Promise<GroupWithMeta[]> {
    const memberships = await db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));

    const joinedIds = new Set(memberships.map((m) => m.groupId));

    const publicGroups = await db
      .select()
      .from(groups)
      .where(and(eq(groups.type, "public"), eq(groups.isArchived, false)))
      .orderBy(desc(groups.popularityScore), desc(groups.memberCount))
      .limit(limit + joinedIds.size);

    const filtered = publicGroups
      .filter((g) => !joinedIds.has(g.id))
      .slice(0, limit);

    if (filtered.length === 0) return [];

    const filteredIds = filtered.map((g) => g.id);
    const memberRows = await db
      .select({
        groupId: groupMembers.groupId,
        role: groupMembers.role,
        userId: users.id,
        name: users.name,
        username: users.username,
        image: users.image,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(
        and(
          inArray(groupMembers.groupId, filteredIds),
          eq(groupMembers.status, "active")
        )
      )
      .limit(150);

    const membersByGroup = new Map<
      string,
      Array<{ id: string; name: string | null; username: string | null; image: string | null; role: GroupMember["role"] }>
    >();
    for (const m of memberRows) {
      const arr = membersByGroup.get(m.groupId) ?? [];
      arr.push({ id: m.userId, name: m.name, username: m.username, image: m.image, role: m.role });
      membersByGroup.set(m.groupId, arr);
    }

    return filtered.map((g) => ({
      ...g,
      memberCount: g.memberCount,
      myRole: null,
      members: (membersByGroup.get(g.id) ?? []).slice(0, 5),
    }));
  },

  /**
   * Full-page discovery: search + sort public groups, excluding groups the user already joined.
   */
  async searchPublicGroups(
    userId: string,
    query: string,
    sortBy: DiscoverSortBy = "popularity",
    category?: GroupCategory,
    limit = 48
  ): Promise<GroupWithMeta[]> {
    const memberships = await db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));
    const joinedIds = new Set(memberships.map((m) => m.groupId));

    const orderClause =
      sortBy === "newest"
        ? desc(groups.createdAt)
        : sortBy === "members"
          ? desc(groups.memberCount)
          : desc(groups.popularityScore);

    const conditions = [eq(groups.type, "public"), eq(groups.isArchived, false)];
    if (query.trim()) {
      conditions.push(
        or(
          ilike(groups.name, `%${query.trim()}%`),
          ilike(groups.description, `%${query.trim()}%`),
          ilike(groups.category, `%${query.trim()}%`)
        )!
      );
    }
    if (category) {
      conditions.push(eq(groups.category, category));
    }

    const rows = await db
      .select()
      .from(groups)
      .where(and(...conditions))
      .orderBy(orderClause)
      .limit(limit + joinedIds.size);

    const filtered = rows.filter((g) => !joinedIds.has(g.id)).slice(0, limit);
    if (filtered.length === 0) return [];

    const filteredIds = filtered.map((g) => g.id);
    const memberRows = await db
      .select({
        groupId: groupMembers.groupId,
        role: groupMembers.role,
        userId: users.id,
        name: users.name,
        username: users.username,
        image: users.image,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(
        and(
          inArray(groupMembers.groupId, filteredIds),
          eq(groupMembers.status, "active")
        )
      )
      .limit(200);

    const membersByGroup = new Map<
      string,
      Array<{ id: string; name: string | null; username: string | null; image: string | null; role: GroupMember["role"] }>
    >();
    for (const m of memberRows) {
      const arr = membersByGroup.get(m.groupId) ?? [];
      arr.push({ id: m.userId, name: m.name, username: m.username, image: m.image, role: m.role });
      membersByGroup.set(m.groupId, arr);
    }

    return filtered.map((g) => ({
      ...g,
      myRole: null,
      members: (membersByGroup.get(g.id) ?? []).slice(0, 5),
    }));
  },

  /**
   * Public group profile — visible to everyone (including non-members) for PUBLIC groups.
   * Private groups only show the gated "invite-only" state.
   */
  async getGroupPublicProfile(
    groupId: string,
    userId: string
  ): Promise<GroupPublicProfile | null> {
    const [group] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.isArchived, false)))
      .limit(1);

    if (!group) return null;

    // Membership check
    const [myMembership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, "active")
        )
      )
      .limit(1);

    const myRole = myMembership?.role ?? null;

    // Join request status for non-members
    let myJoinRequestStatus: "pending" | "approved" | "rejected" | null = null;
    if (!myRole) {
      const [req] = await db
        .select({ status: groupJoinRequests.status })
        .from(groupJoinRequests)
        .where(
          and(
            eq(groupJoinRequests.groupId, groupId),
            eq(groupJoinRequests.requesterId, userId)
          )
        )
        .limit(1);
      myJoinRequestStatus = (req?.status as "pending" | "approved" | "rejected") ?? null;
    }

    // Member preview (top 8)
    const memberRows = await db
      .select({
        userId: users.id,
        name: users.name,
        username: users.username,
        image: users.image,
        role: groupMembers.role,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(
        and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active"))
      )
      .orderBy(asc(groupMembers.joinedAt))
      .limit(8);

    // Recent goals count (goals of active members, not archived)
    const memberUserIds = memberRows.map((m) => m.userId);
    let recentGoalsCount = 0;
    if (memberUserIds.length > 0) {
      const [gc] = await db
        .select({ cnt: count() })
        .from(goals)
        .where(
          and(
            inArray(goals.userId, memberUserIds),
            eq(goals.isArchived, false),
            eq(goals.isCompleted, false)
          )
        );
      recentGoalsCount = gc?.cnt ?? 0;
    }

    const score = group.popularityScore;

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      type: group.type,
      memberCount: group.memberCount,
      popularityScore: score,
      popularityRank: group.popularityRank,
      popularityTier: popularityTier(score),
      createdAt: group.createdAt,
      members: memberRows.map((m) => ({
        id: m.userId,
        name: m.name,
        username: m.username,
        image: m.image,
        role: m.role,
      })),
      myRole,
      myJoinRequestStatus,
      isArchived: group.isArchived,
      coverImage: group.coverImage,
      recentGoalsCount,
    };
  },

  /**
   * Recalculate and persist popularity score for a group.
   * Call after: member join, goal completed, comment posted, rating submitted.
   */
  async recalculatePopularityScore(groupId: string): Promise<number> {
    const score = await computePopularityScore(groupId);
    await db
      .update(groups)
      .set({ popularityScore: score, updatedAt: new Date() })
      .where(eq(groups.id, groupId));
    return score;
  },

  /**
   * Create a new group.
   */
  async createGroup(
    creatorId: string,
    input: CreateGroupInput
  ): Promise<GroupWithMeta> {
    const inviteUserIds = [...new Set((input.inviteUserIds ?? []).filter((id) => id !== creatorId))];
    const inviteEmails = [...new Set((input.inviteEmails ?? []).map((e) => e.toLowerCase().trim()).filter(Boolean))];

    if (inviteUserIds.length > 0) {
      const friendIds = new Set(await getAcceptedFriendIds(creatorId));
      const nonFriend = inviteUserIds.find((id) => !friendIds.has(id));
      if (nonFriend) {
        throw new Error("You can only invite people from your accepted circle.");
      }
    }

    const [creator] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

    if (!creator) throw new Error("Creator not found.");

    const creatorName = creator.name ?? "Someone";
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

    const [newGroup] = await db
      .insert(groups)
      .values({
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        type: input.type,
        category: input.category ?? null,
        createdBy: creatorId,
        memberCount: 1,
      })
      .returning();

    if (!newGroup) throw new Error("Failed to create group.");

    await db.insert(groupMembers).values({
      groupId: newGroup.id,
      userId: creatorId,
      role: "owner",
      status: "active",
    });

    await db.insert(groupEngagementLogs).values({
      userId: creatorId,
      groupId: newGroup.id,
      action: "join_group",
      metadata: { role: "owner" },
    });

    if (inviteUserIds.length > 0) {
      await db.insert(groupInvites).values(
        inviteUserIds.map((uid) => ({
          groupId: newGroup.id,
          invitedBy: creatorId,
          inviteeUserId: uid,
          status: "pending" as const,
          expiresAt,
        }))
      );

      // Per-group invite engagement tracking (non-blocking, one call covers all invites)
      void groupEngagementService.incrementInvite(creatorId, newGroup.id);

      await Promise.allSettled(
        inviteUserIds.map(async (uid) => {
          const groupUrl = `${appUrl}/groups/${newGroup.id}`;
          await Promise.all([
            notificationsService.createNotification(
              uid,
              "group_message",
              "Group invitation",
              `${creatorName} invited you to join "${newGroup.name}"`,
              groupUrl
            ),
            db
              .select({ email: users.email })
              .from(users)
              .where(eq(users.id, uid))
              .limit(1)
              .then(async ([invitee]) => {
                if (invitee?.email) {
                  await emailService.sendGroupInvite({
                    to: invitee.email,
                    inviterName: creatorName,
                    groupTitle: newGroup.name,
                    groupUrl,
                  });
                }
              }),
          ]);
        })
      );
    }

    if (inviteEmails.length > 0) {
      await db.insert(groupInvites).values(
        inviteEmails.map((email) => ({
          groupId: newGroup.id,
          invitedBy: creatorId,
          inviteeEmail: email,
          status: "pending" as const,
          expiresAt,
        }))
      );

      await Promise.allSettled(
        inviteEmails.map((email) =>
          emailService.sendGroupInvite({
            to: email,
            inviterName: creatorName,
            groupTitle: newGroup.name,
            groupUrl: `${appUrl}/groups/${newGroup.id}`,
          })
        )
      );
    }

    // Seed initial popularity score
    void this.recalculatePopularityScore(newGroup.id);

    return {
      ...newGroup,
      memberCount: 1,
      myRole: "owner",
      members: [
        {
          id: creatorId,
          name: creator.name,
          username: null,
          image: null,
          role: "owner",
        },
      ],
    };
  },

  /**
   * Submit a join request for a PUBLIC group.
   * Notifies all owners/admins.
   */
  async requestToJoin(
    groupId: string,
    userId: string,
    note?: string
  ): Promise<void> {
    const [group] = await db
      .select({ id: groups.id, name: groups.name, type: groups.type })
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.isArchived, false)))
      .limit(1);

    if (!group) throw new Error("Group not found.");
    if (group.type !== "public") throw new Error("This group is invite-only.");

    // Check not already a member
    const [existing] = await db
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, "active")
        )
      )
      .limit(1);
    if (existing) throw new Error("You are already a member of this group.");

    // Upsert join request (reset if previously rejected)
    await db
      .insert(groupJoinRequests)
      .values({
        groupId,
        requesterId: userId,
        status: "pending",
        note: note?.trim() ?? null,
      })
      .onConflictDoUpdate({
        target: [groupJoinRequests.groupId, groupJoinRequests.requesterId],
        set: { status: "pending", note: note?.trim() ?? null, requestedAt: new Date() },
      });

    // Get requester info for notification
    const [requester] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const requesterName = requester?.name ?? "Someone";

    // Notify all owners and admins
    const admins = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.status, "active"),
          or(eq(groupMembers.role, "owner"), eq(groupMembers.role, "admin"))
        )
      );

    const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
    const groupUrl = `${appUrl}/groups/${groupId}`;

    await Promise.allSettled(
      admins.map((admin) =>
        notificationsService.createNotification(
          admin.userId,
          "group_message",
          "New join request",
          `${requesterName} wants to join "${group.name}"`,
          groupUrl
        )
      )
    );
  },

  /**
   * List pending join requests for a group (owners/admins only).
   */
  async getPendingJoinRequests(
    groupId: string,
    userId: string
  ): Promise<JoinRequestWithUser[]> {
    // Verify caller is owner/admin
    const [membership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, "active")
        )
      )
      .limit(1);

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Not authorized.");
    }

    const rows = await db
      .select({
        id: groupJoinRequests.id,
        groupId: groupJoinRequests.groupId,
        requesterId: groupJoinRequests.requesterId,
        status: groupJoinRequests.status,
        note: groupJoinRequests.note,
        requestedAt: groupJoinRequests.requestedAt,
        requesterName: users.name,
        requesterUsername: users.username,
        requesterImage: users.image,
      })
      .from(groupJoinRequests)
      .innerJoin(users, eq(groupJoinRequests.requesterId, users.id))
      .where(
        and(
          eq(groupJoinRequests.groupId, groupId),
          eq(groupJoinRequests.status, "pending")
        )
      )
      .orderBy(asc(groupJoinRequests.requestedAt));

    return rows.map((r) => ({
      id: r.id,
      groupId: r.groupId,
      requesterId: r.requesterId,
      status: r.status as "pending" | "approved" | "rejected",
      note: r.note,
      requestedAt: r.requestedAt,
      requester: {
        id: r.requesterId,
        name: r.requesterName,
        username: r.requesterUsername,
        image: r.requesterImage,
      },
    }));
  },

  /**
   * Approve a join request — adds the user as a member and notifies them.
   */
  async approveJoinRequest(requestId: string, adminId: string): Promise<void> {
    const [req] = await db
      .select()
      .from(groupJoinRequests)
      .where(eq(groupJoinRequests.id, requestId))
      .limit(1);

    if (!req) throw new Error("Request not found.");
    if (req.status !== "pending") throw new Error("Request already reviewed.");

    // Verify caller is owner/admin of the group
    const [adminMembership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, req.groupId),
          eq(groupMembers.userId, adminId),
          eq(groupMembers.status, "active")
        )
      )
      .limit(1);

    if (!adminMembership || !["owner", "admin"].includes(adminMembership.role)) {
      throw new Error("Not authorized.");
    }

    const [group] = await db
      .select({ name: groups.name })
      .from(groups)
      .where(eq(groups.id, req.groupId))
      .limit(1);

    // Update request status
    await db
      .update(groupJoinRequests)
      .set({ status: "approved", reviewedBy: adminId, reviewedAt: new Date() })
      .where(eq(groupJoinRequests.id, requestId));

    // Add member (upsert — handle race condition gracefully)
    await db
      .insert(groupMembers)
      .values({
        groupId: req.groupId,
        userId: req.requesterId,
        role: "member",
        status: "active",
      })
      .onConflictDoUpdate({
        target: [groupMembers.groupId, groupMembers.userId],
        set: { status: "active", role: "member", joinedAt: new Date() },
      });

    // Increment member count
    await db
      .update(groups)
      .set({
        memberCount: sql`${groups.memberCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(groups.id, req.groupId));

    // Log engagement
    await db.insert(groupEngagementLogs).values({
      userId: req.requesterId,
      groupId: req.groupId,
      action: "join_group",
      metadata: { approvedBy: adminId },
    });

    // Notify requester
    const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
    await notificationsService.createNotification(
      req.requesterId,
      "group_message",
      "Join request approved",
      `Your request to join "${group?.name ?? "the group"}" was approved!`,
      `${appUrl}/groups/${req.groupId}`
    );

    // Recalculate popularity score
    void this.recalculatePopularityScore(req.groupId);
    // Update behavior profile for the new member (non-blocking)
    void groupEngagementService.updateBehaviorProfile(req.requesterId, "join_group", { groupId: req.groupId });
  },

  /**
   * Reject a join request and notify the requester.
   */
  async rejectJoinRequest(requestId: string, adminId: string): Promise<void> {
    const [req] = await db
      .select()
      .from(groupJoinRequests)
      .where(eq(groupJoinRequests.id, requestId))
      .limit(1);

    if (!req) throw new Error("Request not found.");
    if (req.status !== "pending") throw new Error("Request already reviewed.");

    const [adminMembership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, req.groupId),
          eq(groupMembers.userId, adminId),
          eq(groupMembers.status, "active")
        )
      )
      .limit(1);

    if (!adminMembership || !["owner", "admin"].includes(adminMembership.role)) {
      throw new Error("Not authorized.");
    }

    const [group] = await db
      .select({ name: groups.name })
      .from(groups)
      .where(eq(groups.id, req.groupId))
      .limit(1);

    await db
      .update(groupJoinRequests)
      .set({ status: "rejected", reviewedBy: adminId, reviewedAt: new Date() })
      .where(eq(groupJoinRequests.id, requestId));

    // Notify requester
    const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
    await notificationsService.createNotification(
      req.requesterId,
      "group_message",
      "Join request declined",
      `Your request to join "${group?.name ?? "the group"}" was not approved at this time.`,
      `${appUrl}/groups`
    );
  },

  /**
   * Submit a recommendation rating (1–10) for a group the user is a member of.
   * Triggers a popularity score recalculation.
   */
  async submitRecommendationRating(
    groupId: string,
    userId: string,
    rating: number
  ): Promise<void> {
    if (rating < 1 || rating > 10 || !Number.isInteger(rating)) {
      throw new Error("Rating must be an integer between 1 and 10.");
    }

    const [membership] = await db
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, "active")
        )
      )
      .limit(1);

    if (!membership) throw new Error("You are not an active member of this group.");

    await db
      .update(groupMembers)
      .set({ recommendationRating: rating })
      .where(
        and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
      );

    void this.recalculatePopularityScore(groupId);
  },

  /**
   * Update group details (owner/admin only).
   */
  async updateGroup(
    groupId: string,
    userId: string,
    patch: { name?: string; description?: string; type?: "public" | "private" }
  ): Promise<void> {
    const [membership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, "active")
        )
      )
      .limit(1);

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Not authorized.");
    }

    await db
      .update(groups)
      .set({
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.description !== undefined ? { description: patch.description.trim() || null } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        updatedAt: new Date(),
      })
      .where(eq(groups.id, groupId));
  },

  /**
   * Archive a group (owner only).
   */
  async archiveGroup(groupId: string, userId: string): Promise<void> {
    const [membership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, "active")
        )
      )
      .limit(1);

    if (!membership || membership.role !== "owner") {
      throw new Error("Only the owner can archive a group.");
    }

    await db
      .update(groups)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(eq(groups.id, groupId));
  },
};
