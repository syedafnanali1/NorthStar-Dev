// src/server/services/group-chat.service.ts
// Business logic for Group Chat: posts, reactions, comments, and member roster.

import { db } from "@/lib/db";
import {
  groupChatPosts,
  groupChatComments,
  groupMembers,
  groups,
  users,
  circleConnections,
  groupEngagementLogs,
} from "@/drizzle/schema";
import {
  and,
  desc,
  eq,
  sql,
} from "drizzle-orm";
import { notificationsService } from "./notifications.service";
import { groupEngagementService } from "./group-engagement.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_EMOJIS = new Set(["👏", "🔥", "💪", "❤️", "🎯"]);
const MAX_WORDS = 100;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Exported Types ───────────────────────────────────────────────────────────

export interface ChatAuthor {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface ChatPostWithMeta {
  id: string;
  groupId: string;
  author: ChatAuthor;
  content: string;
  reactions: ReactionSummary[];
  commentCount: number;
  isDeleted: boolean;
  createdAt: Date;
  editedAt: Date | null;
}

export interface ChatCommentWithAuthor {
  id: string;
  postId: string;
  author: ChatAuthor;
  content: string;
  isDeleted: boolean;
  createdAt: Date;
}

export interface GroupMemberWithMeta {
  userId: string;
  name: string | null;
  username: string | null;
  image: string | null;
  role: "owner" | "admin" | "member";
  joinedAt: Date;
  engagementScore: number;
  engagementBadge: "Newcomer" | "Active" | "Committed" | "Champion";
  connectionStatus: "connected" | "pending_sent" | "pending_received" | "none" | "self";
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const groupChatService = {
  // ── Posts ──────────────────────────────────────────────────────────────────

  async getPosts(groupId: string, viewerId: string, limit = 30): Promise<ChatPostWithMeta[]> {
    const rows = await db
      .select({
        id: groupChatPosts.id,
        groupId: groupChatPosts.groupId,
        content: groupChatPosts.content,
        reactions: groupChatPosts.reactions,
        commentCount: groupChatPosts.commentCount,
        isDeleted: groupChatPosts.isDeleted,
        createdAt: groupChatPosts.createdAt,
        editedAt: groupChatPosts.editedAt,
        authorId: users.id,
        authorName: users.name,
        authorUsername: users.username,
        authorImage: users.image,
      })
      .from(groupChatPosts)
      .innerJoin(users, eq(groupChatPosts.authorId, users.id))
      .where(eq(groupChatPosts.groupId, groupId))
      .orderBy(desc(groupChatPosts.createdAt))
      .limit(limit);

    return rows.map((row) => {
      const reactions = row.reactions ?? [];
      const reactionMap = new Map<string, { count: number; reactedByMe: boolean }>();
      for (const r of reactions) {
        const entry = reactionMap.get(r.emoji) ?? { count: 0, reactedByMe: false };
        entry.count++;
        if (r.userId === viewerId) entry.reactedByMe = true;
        reactionMap.set(r.emoji, entry);
      }

      return {
        id: row.id,
        groupId: row.groupId,
        author: {
          id: row.authorId,
          name: row.authorName,
          username: row.authorUsername,
          image: row.authorImage,
        },
        content: row.isDeleted ? "[This post was deleted]" : row.content,
        reactions: Array.from(reactionMap.entries()).map(([emoji, { count, reactedByMe }]) => ({
          emoji,
          count,
          reactedByMe,
        })),
        commentCount: row.commentCount,
        isDeleted: row.isDeleted,
        createdAt: row.createdAt,
        editedAt: row.editedAt ?? null,
      };
    });
  },

  async createPost(groupId: string, authorId: string, content: string): Promise<ChatPostWithMeta> {
    if (countWords(content) > MAX_WORDS) {
      throw new Error(`Post must be ${MAX_WORDS} words or fewer.`);
    }
    if (!content.trim()) throw new Error("Post content cannot be empty.");

    // Verify active membership
    const [membership] = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, authorId), eq(groupMembers.status, "active")))
      .limit(1);
    if (!membership) throw new Error("Only active group members can post.");

    const [post] = await db
      .insert(groupChatPosts)
      .values({ groupId, authorId, content })
      .returning();
    if (!post) throw new Error("Failed to create post.");

    // Engagement log
    await db.insert(groupEngagementLogs).values({
      userId: authorId,
      groupId,
      action: "post_comment",
      metadata: { postId: post.id },
    });

    // Increment user group engagement counters
    await db
      .update(users)
      .set({
        groupCommentsPosted: sql`${users.groupCommentsPosted} + 1`,
        totalGroupEngagementScore: sql`${users.totalGroupEngagementScore} + 2`,
        lastGroupActiveAt: new Date(),
      })
      .where(eq(users.id, authorId));

    // Per-group engagement tracking (non-blocking)
    void groupEngagementService.incrementComment(authorId, groupId);

    const [author] = await db
      .select({ id: users.id, name: users.name, username: users.username, image: users.image })
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1);
    if (!author) throw new Error("Author not found.");

    return {
      id: post.id,
      groupId: post.groupId,
      author,
      content: post.content,
      reactions: [],
      commentCount: 0,
      isDeleted: false,
      createdAt: post.createdAt,
      editedAt: null,
    };
  },

  // ── Reactions ──────────────────────────────────────────────────────────────

  async toggleReaction(
    postId: string,
    userId: string,
    emoji: string
  ): Promise<{ reactions: ReactionSummary[] }> {
    if (!ALLOWED_EMOJIS.has(emoji)) {
      throw new Error("Emoji not allowed.");
    }

    const [post] = await db
      .select({ reactions: groupChatPosts.reactions, groupId: groupChatPosts.groupId, authorId: groupChatPosts.authorId })
      .from(groupChatPosts)
      .where(eq(groupChatPosts.id, postId))
      .limit(1);
    if (!post) throw new Error("Post not found.");

    const reactions = post.reactions ?? [];
    const existingIndex = reactions.findIndex((r) => r.userId === userId && r.emoji === emoji);
    let updated: Array<{ userId: string; emoji: string }>;

    if (existingIndex >= 0) {
      // Remove reaction (toggle off)
      updated = reactions.filter((_, i) => i !== existingIndex);
    } else {
      // Add reaction
      updated = [...reactions, { userId, emoji }];

      // Notify post author (not self)
      if (post.authorId !== userId) {
        const [reactor] = await db
          .select({ name: users.name, username: users.username })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        const reactorName = reactor?.name ?? reactor?.username ?? "Someone";
        await notificationsService.createNotification(
          post.authorId,
          "reaction",
          `${reactorName} reacted ${emoji}`,
          `${reactorName} reacted to your post in the group.`,
          `/groups/community/${post.groupId}`
        );
      }

      // Engagement log
      await db.insert(groupEngagementLogs).values({
        userId,
        groupId: post.groupId,
        action: "react",
        metadata: { postId, emoji },
      });

      await db
        .update(users)
        .set({
          groupReactionsGiven: sql`${users.groupReactionsGiven} + 1`,
          totalGroupEngagementScore: sql`${users.totalGroupEngagementScore} + 1`,
        })
        .where(eq(users.id, userId));

      // Per-group engagement tracking (non-blocking)
      void groupEngagementService.incrementReaction(userId, post.groupId);
    }

    await db
      .update(groupChatPosts)
      .set({ reactions: updated })
      .where(eq(groupChatPosts.id, postId));

    // Compute summary for response
    const reactionMap = new Map<string, { count: number; reactedByMe: boolean }>();
    for (const r of updated) {
      const entry = reactionMap.get(r.emoji) ?? { count: 0, reactedByMe: false };
      entry.count++;
      if (r.userId === userId) entry.reactedByMe = true;
      reactionMap.set(r.emoji, entry);
    }

    return {
      reactions: Array.from(reactionMap.entries()).map(([em, { count, reactedByMe }]) => ({
        emoji: em,
        count,
        reactedByMe,
      })),
    };
  },

  // ── Comments ───────────────────────────────────────────────────────────────

  async getComments(postId: string): Promise<ChatCommentWithAuthor[]> {
    const rows = await db
      .select({
        id: groupChatComments.id,
        postId: groupChatComments.postId,
        content: groupChatComments.content,
        isDeleted: groupChatComments.isDeleted,
        createdAt: groupChatComments.createdAt,
        authorId: users.id,
        authorName: users.name,
        authorUsername: users.username,
        authorImage: users.image,
      })
      .from(groupChatComments)
      .innerJoin(users, eq(groupChatComments.authorId, users.id))
      .where(eq(groupChatComments.postId, postId))
      .orderBy(groupChatComments.createdAt);

    return rows.map((row) => ({
      id: row.id,
      postId: row.postId,
      author: {
        id: row.authorId,
        name: row.authorName,
        username: row.authorUsername,
        image: row.authorImage,
      },
      content: row.isDeleted ? "[This comment was deleted]" : row.content,
      isDeleted: row.isDeleted,
      createdAt: row.createdAt,
    }));
  },

  async addComment(
    postId: string,
    authorId: string,
    content: string
  ): Promise<ChatCommentWithAuthor> {
    if (countWords(content) > MAX_WORDS) {
      throw new Error(`Comment must be ${MAX_WORDS} words or fewer.`);
    }
    if (!content.trim()) throw new Error("Comment cannot be empty.");

    const [post] = await db
      .select({ groupId: groupChatPosts.groupId, authorId: groupChatPosts.authorId })
      .from(groupChatPosts)
      .where(eq(groupChatPosts.id, postId))
      .limit(1);
    if (!post) throw new Error("Post not found.");

    const [comment] = await db
      .insert(groupChatComments)
      .values({ postId, authorId, content })
      .returning();
    if (!comment) throw new Error("Failed to create comment.");

    // Increment comment counter on post
    await db
      .update(groupChatPosts)
      .set({ commentCount: sql`${groupChatPosts.commentCount} + 1` })
      .where(eq(groupChatPosts.id, postId));

    // Notify post author (not self)
    if (post.authorId !== authorId) {
      const [commenter] = await db
        .select({ name: users.name, username: users.username })
        .from(users)
        .where(eq(users.id, authorId))
        .limit(1);
      const commenterName = commenter?.name ?? commenter?.username ?? "Someone";
      await notificationsService.createNotification(
        post.authorId,
        "comment",
        `${commenterName} commented on your post`,
        `"${content.slice(0, 80)}${content.length > 80 ? "…" : ""}"`,
        `/groups/community/${post.groupId}`
      );
    }

    // Engagement log
    await db.insert(groupEngagementLogs).values({
      userId: authorId,
      groupId: post.groupId,
      action: "post_comment",
      metadata: { postId, commentId: comment.id },
    });

    await db
      .update(users)
      .set({
        groupCommentsPosted: sql`${users.groupCommentsPosted} + 1`,
        totalGroupEngagementScore: sql`${users.totalGroupEngagementScore} + 1`,
        lastGroupActiveAt: new Date(),
      })
      .where(eq(users.id, authorId));

    // Per-group engagement tracking (non-blocking)
    void groupEngagementService.incrementComment(authorId, post.groupId);

    const [author] = await db
      .select({ id: users.id, name: users.name, username: users.username, image: users.image })
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1);
    if (!author) throw new Error("Author not found.");

    return {
      id: comment.id,
      postId: comment.postId,
      author,
      content: comment.content,
      isDeleted: false,
      createdAt: comment.createdAt,
    };
  },

  // ── Members ────────────────────────────────────────────────────────────────

  async getMembers(
    groupId: string,
    viewerId: string
  ): Promise<GroupMemberWithMeta[]> {
    const rows = await db
      .select({
        userId: groupMembers.userId,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
        // Use per-group engagement score (not global)
        engagementScore: groupMembers.engagementScore,
        name: users.name,
        username: users.username,
        image: users.image,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")))
      .orderBy(desc(groupMembers.engagementScore));

    // Fetch circle connections involving the viewer
    const memberIds = rows.map((r) => r.userId);
    const connections =
      memberIds.length > 0
        ? await db
            .select({
              requesterId: circleConnections.requesterId,
              receiverId: circleConnections.receiverId,
              status: circleConnections.status,
            })
            .from(circleConnections)
            .where(
              sql`(${circleConnections.requesterId} = ${viewerId} OR ${circleConnections.receiverId} = ${viewerId})`
            )
        : [];

    const connectionMap = new Map<string, "connected" | "pending_sent" | "pending_received">();
    for (const conn of connections) {
      const otherId = conn.requesterId === viewerId ? conn.receiverId : conn.requesterId;
      if (conn.status === "accepted") {
        connectionMap.set(otherId, "connected");
      } else if (conn.status === "pending") {
        connectionMap.set(otherId, conn.requesterId === viewerId ? "pending_sent" : "pending_received");
      }
    }

    return rows.map((row) => {
      const score = row.engagementScore;
      const engagementBadge: GroupMemberWithMeta["engagementBadge"] =
        score >= 50 ? "Champion"
        : score >= 20 ? "Committed"
        : score >= 5  ? "Active"
        : "Newcomer";

      let connectionStatus: GroupMemberWithMeta["connectionStatus"] = "none";
      if (row.userId === viewerId) {
        connectionStatus = "self";
      } else {
        connectionStatus = connectionMap.get(row.userId) ?? "none";
      }

      return {
        userId: row.userId,
        name: row.name,
        username: row.username,
        image: row.image,
        role: row.role as "owner" | "admin" | "member",
        joinedAt: row.joinedAt,
        engagementScore: row.engagementScore,
        engagementBadge,
        connectionStatus,
      };
    });
  },

  // ── Circle Connection Request ───────────────────────────────────────────────

  async sendCircleRequest(requesterId: string, receiverId: string): Promise<string> {
    if (requesterId === receiverId) throw new Error("Cannot connect with yourself.");

    // Check for existing connection
    const [existing] = await db
      .select({ id: circleConnections.id, status: circleConnections.status })
      .from(circleConnections)
      .where(
        sql`(${circleConnections.requesterId} = ${requesterId} AND ${circleConnections.receiverId} = ${receiverId})
          OR (${circleConnections.requesterId} = ${receiverId} AND ${circleConnections.receiverId} = ${requesterId})`
      )
      .limit(1);

    if (existing) {
      if (existing.status === "accepted") throw new Error("Already connected.");
      if (existing.status === "pending") throw new Error("Request already pending.");
    }

    const [inserted] = await db
      .insert(circleConnections)
      .values({ requesterId, receiverId, status: "pending" })
      .returning({ id: circleConnections.id });

    // Return connection ID so caller can attach rich notification metadata
    return inserted?.id ?? "";
  },
};
