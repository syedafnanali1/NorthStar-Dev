export const runtime = "edge";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { circlePosts, postReplies } from "@/drizzle/schema";
import { notificationsService } from "@/server/services/notifications.service";
import { mentionsService } from "@/server/services/mentions.service";
import type { NextRequest } from "next/server";

const replySchema = z.object({
  text: z.string().min(1).max(240),
});

interface RouteParams {
  params: Promise<{ postId: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await params;

  try {
    const body = (await request.json()) as unknown;
    const validated = replySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message ?? "Validation failed" },
        { status: 422 }
      );
    }

    const [reply] = await db
      .insert(postReplies)
      .values({
        postId,
        userId,
        text: validated.data.text,
      })
      .returning();

    void mentionsService.notifyMentionedUsers({
      actorUserId: userId,
      text: validated.data.text,
      link: "/circle",
      contextLabel: "a reply",
    });

    const replyCount = await db
      .select()
      .from(postReplies)
      .where(eq(postReplies.postId, postId));

    await db
      .update(circlePosts)
      .set({ replyCount: replyCount.length })
      .where(eq(circlePosts.id, postId));

    const [post] = await db
      .select({ userId: circlePosts.userId })
      .from(circlePosts)
      .where(eq(circlePosts.id, postId))
      .limit(1);

    if (post && post.userId !== userId) {
      await notificationsService.createNotification(
        post.userId,
        "comment",
        "New reply on your post",
        validated.data.text.length > 80
          ? `${validated.data.text.slice(0, 80)}...`
          : validated.data.text,
        "/circle"
      );
    }

    return NextResponse.json({ reply }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/circle/:postId/reply]", error);
    return NextResponse.json({ error: "Failed to reply" }, { status: 500 });
  }
}
