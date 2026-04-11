// src/server/services/groups.service.ts
// Business logic for the Groups feature (community containers).
// Distinct from group-goals.service.ts which handles the old collaborative goal model.

import { db } from "@/lib/db";
import {
  groups,
  groupMembers,
  groupInvites,
  groupEngagementLogs,
  circleConnections,
  users,
} from "@/drizzle/schema";
import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { notificationsService } from "./notifications.service";
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

export interface CreateGroupInput {
  name: string;
  description?: string;
  type: "public" | "private";
  inviteUserIds?: string[];
  inviteEmails?: string[];
}

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
    // Find all group IDs the user belongs to
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

    // Fetch groups + up to 5 member previews per group
    const groupRows = await db
      .select()
      .from(groups)
      .where(
        and(inArray(groups.id, myGroupIds), eq(groups.isArchived, false))
      )
      .orderBy(desc(groups.createdAt));

    if (groupRows.length === 0) return [];

    // Batch fetch member previews for all groups
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

    // Group member rows by groupId
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
   * Fetch public groups the user is NOT a member of (discover section).
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
      .orderBy(desc(groups.engagementScore), desc(groups.memberCount))
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
   * Create a new group.
   * - Creator gets "owner" role
   * - User invites are dispatched immediately with notifications + emails
   * - Email-only invites are dispatched with a group invite email
   * - Engagement log entry written for "join_group" action
   */
  async createGroup(
    creatorId: string,
    input: CreateGroupInput
  ): Promise<GroupWithMeta> {
    const inviteUserIds = [...new Set((input.inviteUserIds ?? []).filter((id) => id !== creatorId))];
    const inviteEmails = [...new Set((input.inviteEmails ?? []).map((e) => e.toLowerCase().trim()).filter(Boolean))];

    // Validate that invited users are actual circle friends
    if (inviteUserIds.length > 0) {
      const friendIds = new Set(await getAcceptedFriendIds(creatorId));
      const nonFriend = inviteUserIds.find((id) => !friendIds.has(id));
      if (nonFriend) {
        throw new Error("You can only invite people from your accepted circle.");
      }
    }

    // Fetch creator info for notification/email messages
    const [creator] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

    if (!creator) throw new Error("Creator not found.");

    const creatorName = creator.name ?? "Someone";
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

    // ── DB writes ────────────────────────────────────────────────────────────

    // 1. Insert group
    const [newGroup] = await db
      .insert(groups)
      .values({
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        type: input.type,
        createdBy: creatorId,
        memberCount: 1,
      })
      .returning();

    if (!newGroup) throw new Error("Failed to create group.");

    // 2. Add creator as owner
    await db.insert(groupMembers).values({
      groupId: newGroup.id,
      userId: creatorId,
      role: "owner",
      status: "active",
    });

    // 3. Write engagement log for creator joining
    await db.insert(groupEngagementLogs).values({
      userId: creatorId,
      groupId: newGroup.id,
      action: "join_group",
      metadata: { role: "owner" },
    });

    // 4. Invite existing users
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

      // Update memberCount (invited but not yet joined — don't count yet, only fire notifications)
      // Send in-app notifications + emails in parallel
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
            // Fetch invitee email for the email notification
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

    // 5. Invite by email (non-users)
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
};
