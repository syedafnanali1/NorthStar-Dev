// src/app/api/circle/[postId]/comments/route.ts
// GET  — fetch nested comments for a post
// POST — add a comment (top-level or reply)

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { comments, circlePosts, users } from "@/drizzle/schema";
import { notificationsService } from "@/server/services/notifications.service";
import { mentionsService } from "@/server/services/mentions.service";
import { eq, asc } from "drizzle-orm";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ postId: string }>;
}

const createCommentSchema = z.object({
  text: z.string().min(1).max(500),
  parentCommentId: z.string().optional(),
});

type CommentRow = {
  id: string;
  parentCommentId: string | null;
  text: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  authorName: string | null;
  authorImage: string | null;
};

export async function GET(
  _req: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await ctx.params;

  // Fetch all comments for the post in one query
  const allComments: CommentRow[] = await db
    .select({
      id: comments.id,
      parentCommentId: comments.parentCommentId,
      text: comments.text,
      isDeleted: comments.isDeleted,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      userId: comments.userId,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));

  // Build reply map then nest
  const replyMap = new Map<string, CommentRow[]>();
  for (const c of allComments) {
    if (c.parentCommentId) {
      const arr = replyMap.get(c.parentCommentId) ?? [];
      arr.push(c);
      replyMap.set(c.parentCommentId, arr);
    }
  }

  const nested = allComments
    .filter((c) => !c.parentCommentId)
    .map((c) => ({ ...c, replies: replyMap.get(c.id) ?? [] }));

  return NextResponse.json({ comments: nested, total: allComments.length });
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await ctx.params;

  const body: unknown = await req.json();
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const { text, parentCommentId } = parsed.data;

  const [comment] = await db
    .insert(comments)
    .values({ postId, userId, text, parentCommentId: parentCommentId ?? null })
    .returning();

  void mentionsService.notifyMentionedUsers({
    actorUserId: userId,
    text,
    link: "/circle",
    contextLabel: "a comment",
  });

  // Notify post owner (if not self)
  const [post] = await db
    .select({ userId: circlePosts.userId })
    .from(circlePosts)
    .where(eq(circlePosts.id, postId))
    .limit(1);

  if (post && post.userId !== userId) {
    void notificationsService.createNotification(
      post.userId,
      "comment",
      "New comment on your post",
      text.length > 60 ? `${text.slice(0, 60)}…` : text,
      "/circle"
    );
  }

  return NextResponse.json({ comment }, { status: 201 });
}
