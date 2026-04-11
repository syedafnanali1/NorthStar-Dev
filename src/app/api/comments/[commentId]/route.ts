// src/app/api/comments/[commentId]/route.ts
// DELETE — soft-delete (own comment or post owner)
// PATCH  — edit text if within 5 minutes

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { comments, circlePosts } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { differenceInMinutes } from "date-fns";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ commentId: string }>;
}

const editSchema = z.object({
  text: z.string().min(1).max(500),
});

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await ctx.params;

  const [comment] = await db
    .select({ userId: comments.userId, postId: comments.postId })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check ownership: own comment or post owner
  let allowed = comment.userId === userId;
  if (!allowed) {
    const [post] = await db
      .select({ userId: circlePosts.userId })
      .from(circlePosts)
      .where(eq(circlePosts.id, comment.postId))
      .limit(1);
    if (post?.userId === userId) allowed = true;
  }

  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db
    .update(comments)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(comments.id, commentId));

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await ctx.params;

  const [comment] = await db
    .select({ userId: comments.userId, createdAt: comments.createdAt })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.userId, userId)))
    .limit(1);

  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (comment.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (differenceInMinutes(new Date(), comment.createdAt) > 5) {
    return NextResponse.json({ error: "Edit window expired (5 minutes)" }, { status: 403 });
  }

  const body: unknown = await req.json();
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }

  const [updated] = await db
    .update(comments)
    .set({ text: parsed.data.text, updatedAt: new Date() })
    .where(eq(comments.id, commentId))
    .returning();

  return NextResponse.json({ comment: updated });
}
