export const runtime = "edge";

// src/app/api/circle/[postId]/react/route.ts
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { postReactions, circlePosts } from "@/drizzle/schema";
import { notificationsService } from "@/server/services/notifications.service";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { NextRequest } from "next/server";

const schema = z.object({ emoji: z.string().min(1).max(8) });
const NORTH_STAR_REACTIONS = new Set(["🔥", "💪", "✨", "🌟", "⭐", "💙", "👏", "🎯"]);

function normalizeReaction(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase() === "kudos") return "👏";
  return trimmed;
}

interface RouteParams {
  params: Promise<{ postId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { postId } = await params;

  const body = await request.json() as unknown;
  const validated = schema.safeParse(body);
  if (!validated.success) return NextResponse.json({ error: "Invalid emoji" }, { status: 422 });

  const emoji = normalizeReaction(validated.data.emoji);
  if (!NORTH_STAR_REACTIONS.has(emoji)) {
    return NextResponse.json(
      { error: "Invalid reaction", allowed: Array.from(NORTH_STAR_REACTIONS) },
      { status: 422 }
    );
  }

  try {
    // Toggle reaction
    const [existing] = await db
      .select()
      .from(postReactions)
      .where(and(eq(postReactions.postId, postId), eq(postReactions.userId, userId), eq(postReactions.emoji, emoji)))
      .limit(1);

    if (existing) {
      await db.delete(postReactions).where(eq(postReactions.id, existing.id));
    } else {
      await db.insert(postReactions).values({ postId, userId, emoji });
    }

    // Update denormalized reaction counts on post
    const reactions = await db
      .select({ emoji: postReactions.emoji })
      .from(postReactions)
      .where(eq(postReactions.postId, postId));

    const counts: Record<string, number> = {};
    for (const r of reactions) {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    }

    await db
      .update(circlePosts)
      .set({ reactionCounts: counts })
      .where(eq(circlePosts.id, postId));

    if (!existing) {
      const [post] = await db
        .select({ userId: circlePosts.userId })
        .from(circlePosts)
        .where(eq(circlePosts.id, postId))
        .limit(1);

      if (post && post.userId !== userId) {
        await notificationsService.createNotification(
          post.userId,
          "reaction",
          "New reaction on your post",
          `${emoji} on your update`,
          "/circle"
        );
      }
    }

    return NextResponse.json({ counts });
  } catch (err) {
    console.error("[POST /api/circle/:postId/react]", err);
    return NextResponse.json({ error: "Failed to react" }, { status: 500 });
  }
}
